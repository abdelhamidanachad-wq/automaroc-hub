const memoryCache = new Map();
const ipBuckets = new Map();
const CACHE_MS = 6 * 60 * 60 * 1000;
const MAX_PER_MINUTE = 40;

const textOnly = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&#039;/g, "'").replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim().slice(0, 500);
const normal = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const safeInput = (value, max = 100) => String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);

function send(res, status, body, cache = 'no-store') {
  res.status(status);
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', cache);
  return res.json(body);
}

function brandAliases(brand) {
  const n = normal(brand);
  if (n === 'mercedes benz' || n === 'mercedes') return ['mercedes benz', 'mercedes'];
  if (n === 'volkswagen' || n === 'vw') return ['volkswagen', 'vw'];
  if (n === 'land rover') return ['land rover', 'range rover'];
  if (n === 'alfa romeo') return ['alfa romeo', 'alfa'];
  return [n];
}

function modelSearchTerms(model) {
  let m = String(model || '').replace(/série/ig, 'Series').replace(/classe/ig, 'Class').replace(/coupé/ig, 'Coupe');
  const parentheticals = [...m.matchAll(/\(([^)]*)\)/g)].map(x => x[1]);
  const generationCodes = parentheticals
    .filter(x => !/gen(?:eration)?\s*\d/i.test(x))
    .flatMap(x => normal(x).split(' ')).filter(x => x.length >= 2);
  m = m.replace(/\((?:gen(?:eration)?\s*)?\d+(?:\s*[-/]\s*\d+)?\)/ig, ' ')
       .replace(/\([^)]*\)/g, ' ')
       .replace(/\b(?:gen|generation)\s*\d+\b/ig, ' ')
       .replace(/\s+/g, ' ').trim();
  const core = normal(m).split(' ').filter(Boolean);
  const stop = new Set(['series','class','the','and','or','van','gen','generation','diesel','essence','hybride','electrique','electric','berline','break','cabriolet','coupe','sportback','line','gt']);
  const modelTokens = core.filter(x => !stop.has(x) && (x.length >= 2 || /^\d+$/.test(x)));
  const codeTokens = generationCodes.filter(x => !stop.has(x));
  return { clean: m, modelTokens: [...new Set(modelTokens)], codeTokens: [...new Set(codeTokens)] };
}

function scoreCandidate(page, {brand, year, modelTokens, codeTokens, aliases}) {
  const title = normal(page.title.replace(/^File:/i, ''));
  const meta = page.imageinfo?.[0]?.extmetadata || {};
  const extra = normal(textOnly(meta.ImageDescription?.value) + ' ' + textOnly(meta.ObjectName?.value));
  const full = title + ' ' + extra;
  let score = 0;
  if (aliases.some(alias => alias && title.includes(alias))) score += 10;
  else if (aliases.some(alias => alias && full.includes(alias))) score += 5;

  const titleModelHits = modelTokens.filter(token => title.split(' ').includes(token)).length;
  const allModelHits = modelTokens.filter(token => full.split(' ').includes(token)).length;
  score += titleModelHits * 5 + Math.max(0, allModelHits - titleModelHits) * 2;
  score += codeTokens.filter(token => title.split(' ').includes(token)).length * 7;

  const y = Number(year);
  if (Number.isInteger(y) && y >= 1950 && y <= new Date().getFullYear() + 1) {
    const yearText = String(y);
    const yearDecade = String(Math.floor(y / 10) * 10);
    if (title.includes(yearText)) score += 4;
    else if (title.includes(yearDecade)) score += 1;
  }

  const bad = /\b(logo|badge|emblem|steering wheel|engine|gearbox|interior|dashboard|headlight|taillight|wheel rim|rim only|toy car|model kit|scale model|drawing|diagram|blueprint|brochure|poster|screenshot|video game|hot wheels|matchbox|motor show stand|car dealer logo)\b/;
  if (bad.test(title)) score -= 18;
  if (/\.(svg|gif)$/i.test(page.title)) score -= 8;
  const info = page.imageinfo?.[0] || {};
  if (info.thumburl) score += 2;
  if (info.width && info.height && Math.min(info.width, info.height) >= 350) score += 2;
  return score;
}

async function commonsSearch(searchText) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  const params = {
    action: 'query',
    generator: 'search',
    gsrsearch: searchText,
    gsrnamespace: '6',
    gsrwhat: 'text',
    gsrlimit: '30',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1000',
    format: 'json',
    origin: '*'
  };
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  const response = await fetch(url, {
    headers: { 'User-Agent': 'MOROTTO/1.0 (automaroc-hub.vercel.app; vehicle image matching)' },
    signal: AbortSignal.timeout(9000)
  });
  if (!response.ok) throw new Error('Image source unavailable');
  const payload = await response.json();
  return Object.values(payload.query?.pages || {}).filter(page => page.imageinfo?.[0]?.thumburl);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return send(res, 405, { error: 'Method not allowed.' });
  }

  const brand = safeInput(req.query?.brand, 80);
  const model = safeInput(req.query?.model, 120);
  const year = Number(req.query?.year);
  const variant = Math.abs(Number.parseInt(req.query?.variant, 10) || 0) % 4;
  if (!brand || !model) return send(res, 400, { error: 'Brand and model are required.' });

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const now = Date.now();
  for (const [key, value] of ipBuckets) if (now - value.started > 120000) ipBuckets.delete(key);
  const bucket = ipBuckets.get(ip);
  if (bucket && now - bucket.started < 60000 && bucket.count >= MAX_PER_MINUTE) {
    return send(res, 429, { error: 'Too many image lookups. Retry shortly.' }, 'public, max-age=60');
  }
  if (!bucket || now - bucket.started >= 60000) ipBuckets.set(ip, { started: now, count: 1 });
  else bucket.count++;

  const cacheKey = [normal(brand), normal(model), Number.isInteger(year) ? year : '', variant].join('|');
  const cached = memoryCache.get(cacheKey);
  if (cached && now - cached.at < CACHE_MS) {
    return send(res, 200, cached.result, 'public, s-maxage=21600, stale-while-revalidate=604800');
  }

  try {
    const { clean, modelTokens, codeTokens } = modelSearchTerms(model);
    const aliases = brandAliases(brand);
    const yearTerm = Number.isInteger(year) && year >= 1950 && year <= new Date().getFullYear() + 1 ? String(year) : '';
    const queries = [
      [brand, clean, codeTokens.join(' '), yearTerm, 'car'].filter(Boolean).join(' '),
      [brand, clean, 'automobile'].filter(Boolean).join(' ')
    ].filter((q, i, arr) => arr.indexOf(q) === i);

    let pages = [];
    for (const query of queries) {
      try { pages = await commonsSearch(query); } catch { pages = []; }
      if (pages.length >= 8) break;
    }

    const candidates = pages
      .filter(page => {
        const info = page.imageinfo?.[0];
        const meta = info?.extmetadata || {};
        const title = normal(page.title);
        const license = normal(textOnly(meta.LicenseShortName?.value));
        if (!info?.thumburl || !/^https?:\/\//i.test(info.thumburl)) return false;
        if (/\.(svg|gif)$/i.test(page.title)) return false;
        if (/\b(logo|badge|emblem|steering wheel|engine|gearbox|interior|dashboard|headlight|taillight|toy car|model kit|scale model|drawing|diagram|blueprint|brochure|poster|screenshot|hot wheels|matchbox)\b/.test(title)) return false;
        if (!license || /all rights reserved|non free|fair use/.test(license)) return false;
        return true;
      })
      .map(page => ({
        page,
        score: scoreCandidate(page, {brand, year: yearTerm, modelTokens, codeTokens, aliases})
      }))
      .filter(item => item.score >= 9)
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) {
      const result = { imageUrl: null, sourceUrl: null, title: null, artist: null, license: null, licenseUrl: null };
      memoryCache.set(cacheKey, { at: now, result });
      return send(res, 200, result, 'public, s-maxage=21600, stale-while-revalidate=604800');
    }

    const bestScore = candidates[0].score;
    const nearBest = candidates.filter(item => item.score >= bestScore - 5);
    const chosen = nearBest[variant % nearBest.length].page;
    const info = chosen.imageinfo[0];
    const meta = info.extmetadata || {};
    const result = {
      imageUrl: info.thumburl,
      sourceUrl: info.descriptionurl || info.url,
      title: textOnly(meta.ObjectName?.value) || chosen.title.replace(/^File:/i, ''),
      artist: textOnly(meta.Artist?.value) || textOnly(meta.Credit?.value) || 'Wikimedia Commons contributor',
      license: textOnly(meta.LicenseShortName?.value) || 'See file page',
      licenseUrl: textOnly(meta.LicenseUrl?.value) || info.descriptionurl || '',
      confidence: bestScore >= 26 ? 'high' : bestScore >= 16 ? 'medium' : 'low'
    };
    memoryCache.set(cacheKey, { at: now, result });
    return send(res, 200, result, 'public, s-maxage=21600, stale-while-revalidate=604800');
  } catch (error) {
    console.error('Demo vehicle image lookup failed:', error?.message || 'unknown error');
    return send(res, 502, { imageUrl: null, sourceUrl: null, error: 'Image lookup failed.' }, 'public, max-age=300');
  }
}
