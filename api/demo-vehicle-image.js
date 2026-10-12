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
  const generationMatch = m.match(/\b(?:gen(?:eration)?\s*)(\d+)(?:\s*[-/]\s*(\d+))?/i)
    || m.match(/\b(golf|polo)\s*([1-8])\b/i);
  const generationNumbers = generationMatch
    ? generationMatch.slice(1).filter(value => /^\d+$/.test(value || '')).map(Number)
    : [];
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
  return { clean: m, modelTokens: [...new Set(modelTokens)], codeTokens: [...new Set(codeTokens)], generationNumbers };
}

function targetedRoadCar(brand, model) {
  const b = normal(brand);
  const m = normal(model);
  if (b === 'dacia' && m.includes('duster')) return 'duster';
  if ((b === 'volkswagen' || b === 'vw') && m.includes('golf')) return 'golf';
  if (b === 'ford' && m.includes('fiesta')) return 'fiesta';
  if ((b === 'volkswagen' || b === 'vw') && m.includes('polo')) return 'polo';
  return '';
}

function generationForYear(kind, model, year, generationNumbers) {
  const y = Number(year);
  const m = normal(model);
  if (kind === 'duster') {
    if (/gen\s*1|generation\s*1/.test(m)) return 1;
    if (/gen\s*2|generation\s*2/.test(m)) return 2;
    if (y >= 2010 && y <= 2017) return 1;
    if (y >= 2018 && y <= 2024) return 2;
  }
  if (kind === 'golf') {
    const explicit = m.match(/\bgolf\s*([1-8])\b/);
    if (explicit) return Number(explicit[1]);
    if (generationNumbers?.length === 1) return generationNumbers[0];
    if (y >= 1974 && y <= 1983) return 1;
    if (y >= 1984 && y <= 1991) return 2;
    if (y >= 1992 && y <= 1997) return 3;
    if (y >= 1998 && y <= 2003) return 4;
    if (y >= 2004 && y <= 2008) return 5;
    if (y >= 2009 && y <= 2012) return 6;
    if (y >= 2013 && y <= 2019) return 7;
    if (y >= 2020 && y <= 2025) return 8;
  }
  return null;
}

function explicitlyNamedGolfGeneration(value) {
  const text = normal(value);
  const numeric = text.match(/\bmk\s*([1-8])\b/) || text.match(/\bgolf\s+([1-8])\b/);
  if (numeric) return Number(numeric[1]);
  const roman = text.match(/\bgolf\s+(viii|vii|vi|iv|iii|ii|i|v)\b/);
  if (!roman) return null;
  return ({i:1,ii:2,iii:3,iv:4,v:5,vi:6,vii:7,viii:8})[roman[1]] || null;
}

function targetedQueries({kind, brand, model, year, clean, generationNumbers}) {
  const y = Number(year);
  const yValid = Number.isInteger(y) && y >= 1950 && y <= new Date().getFullYear() + 1;
  const yearLabel = yValid ? String(y) : '';
  const generation = generationForYear(kind, model, y, generationNumbers);
  if (kind === 'duster') {
    if (generation === 1) return [
      ['Dacia Duster Laureate', yearLabel].filter(Boolean).join(' '),
      ['Dacia Duster', yearLabel, '4x2'].filter(Boolean).join(' '),
      'Dacia Duster first generation'
    ];
    if (generation === 2) return [
      ['Dacia Duster II', yearLabel].filter(Boolean).join(' '),
      ['Dacia Duster', yearLabel, 'Comfort'].filter(Boolean).join(' '),
      'Dacia Duster second generation'
    ];
    return [['Dacia Duster', yearLabel].filter(Boolean).join(' '), 'Dacia Duster Laureate'];
  }
  if (kind === 'golf') {
    const generationLabel = generation ? 'Volkswagen Golf Mk' + generation : 'Volkswagen Golf';
    const golfCode = ({1:'Golf I',2:'Golf II',3:'1H',4:'1J',5:'1K',6:'5K',7:'5G',8:'Golf VIII'})[generation] || '';
    return [
      [generationLabel, yearLabel].filter(Boolean).join(' '),
      ['Volkswagen Golf', golfCode, yearLabel].filter(Boolean).join(' '),
      ['Volkswagen Golf', yearLabel, 'Comfortline hatchback'].filter(Boolean).join(' ')
    ];
  }
  if (kind === 'fiesta') {
    return [
      ['Ford Fiesta', yearLabel, 'hatchback'].filter(Boolean).join(' '),
      ['Ford Fiesta', yearLabel, 'CL hatchback'].filter(Boolean).join(' '),
      ['Ford Fiesta', yearLabel, 'Trend Zetec hatchback'].filter(Boolean).join(' ')
    ];
  }
  if (kind === 'polo') {
    return [
      ['Volkswagen Polo', yearLabel, 'hatchback'].filter(Boolean).join(' '),
      ['Volkswagen Polo', yearLabel, 'Comfortline hatchback'].filter(Boolean).join(' '),
      ['Volkswagen Polo', yearLabel, 'Trendline hatchback'].filter(Boolean).join(' ')
    ];
  }
  return [
    [brand, clean, yearLabel].filter(Boolean).join(' '),
    [brand, clean, 'automobile'].filter(Boolean).join(' ')
  ];
}

function scoreCandidate(page, {brand, year, modelTokens, codeTokens, aliases, kind}) {
  const title = normal(page.title.replace(/^File:/i, ''));
  const meta = page.imageinfo?.[0]?.extmetadata || {};
  const extra = normal(textOnly(meta.ImageDescription?.value) + ' ' + textOnly(meta.ObjectName?.value) + ' ' + textOnly(meta.ImageNotes?.value));
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
    if (title.includes(yearText)) score += 6;
    else if (title.includes(yearDecade)) score += 1;
    const titledYears = [...title.matchAll(/\b(19[5-9]\d|20[0-3]\d)\b/g)].map(match => Number(match[1]));
    if (titledYears.length) {
      const closest = Math.min(...titledYears.map(value => Math.abs(value - y)));
      if (closest <= 2) score += 6;
      else if (closest >= 8) score -= 4;
    }
  }

  const nonVehicle = /\b(logo|badge|emblem|steering wheel|engine|gearbox|interior|dashboard|headlight|taillight|wheel rim|rim only|toy car|model kit|scale model|drawing|diagram|blueprint|brochure|poster|screenshot|video game|hot wheels|matchbox|motor show stand|car dealer logo)\b/;
  const racingContext = /\b(race|racing|racecar|race car|rally|rallying|rallycross|motorsport|motor sport|track day|track car|circuit|drift|hillclimb|hill climb|time attack|wrc|racing livery|race livery|sponsored race|competition car|racing car|rally car|cup car|trophy car|pace car|racing championship|race weekend)\b/;
  if (nonVehicle.test(title)) score -= 18;
  if (racingContext.test(full)) score -= 100;
  if (kind === 'golf' && /\b(gti|gtd|gte|r32|golf r|clubsport|tcr|cup edition)\b/.test(full)) score -= 30;
  if (kind === 'fiesta' && /\b(fiesta st|st\s*\d{2,3}|fiesta rs|fiesta wrc)\b/.test(full)) score -= 30;
  if (kind === 'polo' && /\b(polo gti|polo r wrc|polo r5|polo cup)\b/.test(full)) score -= 30;

  if (kind === 'duster') {
    const generation = generationForYear(kind, '', y, []);
    if (generation === 1 && /\b(duster ii|second generation|2018|2019|2020|2021|2022|2023|2024)\b/.test(title)) score -= 30;
    if (generation === 2 && /\b(duster i|first generation|2010|2011|2012|2013|2014|2015|2016|2017)\b/.test(title)) score -= 30;
  }
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

  const cacheKey = ['road-photo-v2', normal(brand), normal(model), Number.isInteger(year) ? year : '', variant].join('|');
  const cached = memoryCache.get(cacheKey);
  if (cached && now - cached.at < CACHE_MS) {
    return send(res, 200, cached.result, 'public, s-maxage=21600, stale-while-revalidate=604800');
  }

  try {
    const { clean, modelTokens, codeTokens, generationNumbers } = modelSearchTerms(model);
    const aliases = brandAliases(brand);
    const yearTerm = Number.isInteger(year) && year >= 1950 && year <= new Date().getFullYear() + 1 ? String(year) : '';
    const kind = targetedRoadCar(brand, model);
    const queries = targetedQueries({kind, brand, model, year: yearTerm, clean, generationNumbers});

    let pages = [];
    const pagesByTitle = new Map();
    for (const query of queries.slice(0, 3)) {
      try {
        const found = await commonsSearch(query);
        for (const page of found) pagesByTitle.set(page.title, page);
      } catch { /* use the remaining queries if one Commons search times out */ }
      pages = [...pagesByTitle.values()];
      if (pages.length >= 45) break;
    }

    const tokenPresent = (text, token) => {
      const words = normal(text).split(' ');
      if (words.includes(token)) return true;
      return /^\d+$/.test(token) && words.includes('mk' + token);
    };
    const candidates = pages
      .filter(page => {
        const info = page.imageinfo?.[0];
        const meta = info?.extmetadata || {};
        const title = normal(page.title);
        const fullText = title + ' ' + normal(textOnly(meta.ImageDescription?.value) + ' ' + textOnly(meta.ObjectName?.value) + ' ' + textOnly(meta.ImageNotes?.value));
        const license = normal(textOnly(meta.LicenseShortName?.value));
        if (!info?.thumburl || !/^https?:\/\//i.test(info.thumburl)) return false;
        if (/\.(svg|gif)$/i.test(page.title)) return false;
        if (/\b(logo|badge|emblem|steering wheel|engine|gearbox|interior|dashboard|headlight|taillight|toy car|model kit|scale model|drawing|diagram|blueprint|brochure|poster|screenshot|hot wheels|matchbox)\b/.test(title)) return false;
        if (/\b(race|racing|racecar|race car|rally|rallying|rallycross|motorsport|motor sport|track day|track car|circuit|drift|hillclimb|hill climb|time attack|wrc|racing livery|race livery|sponsored race|competition car|racing car|rally car|cup car|trophy car|pace car|racing championship|race weekend)\b/.test(fullText)) return false;
        if (kind === 'golf' && /\b(gti|gtd|gte|r32|golf r|clubsport|tcr|cup edition)\b/.test(fullText)) return false;
        if (kind === 'fiesta' && /\b(fiesta st|st\s*\d{2,3}|fiesta rs|fiesta wrc)\b/.test(fullText)) return false;
        if (kind === 'polo' && /\b(polo gti|polo r wrc|polo r5|polo cup)\b/.test(fullText)) return false;
        if (kind === 'golf') {
          const expectedGeneration = generationForYear(kind, model, yearTerm, generationNumbers);
          const namedGeneration = explicitlyNamedGolfGeneration(title);
          if (expectedGeneration && namedGeneration && expectedGeneration !== namedGeneration) return false;
        }
        if (kind === 'duster') {
          const generation = generationForYear(kind, model, yearTerm, generationNumbers);
          if (generation === 1 && /\b(duster ii|second generation|2018|2019|2020|2021|2022|2023|2024)\b/.test(title)) return false;
          if (generation === 2 && /\b(duster i|first generation|2010|2011|2012|2013|2014|2015|2016|2017)\b/.test(title)) return false;
        }
        if (!license || /all rights reserved|non free|fair use|non commercial|noncommercial/.test(license)) return false;
        const modelMatch = [...modelTokens, ...codeTokens].some(token => tokenPresent(fullText, token));
        if (!modelMatch) return false;
        return true;
      })
      .map(page => ({
        page,
        score: scoreCandidate(page, {brand, year: yearTerm, modelTokens, codeTokens, aliases, kind})
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
