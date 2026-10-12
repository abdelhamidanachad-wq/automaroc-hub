const recentRequests = new Map();
const MAX_IMAGE_CHARS = 2_800_000;
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 8;

function send(res, status, body) {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  return res.json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return send(res, 405, { error: 'Méthode non autorisée.' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return send(res, 503, {
      error: 'La reconnaissance IA n’est pas encore activée. Ajoutez OPENAI_API_KEY dans les variables d’environnement Vercel, puis redéployez.'
    });
  }

  const image = req.body?.image;
  if (typeof image !== 'string' || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(image)) {
    return send(res, 400, { error: 'Image invalide. Envoyez une photo JPG, PNG ou WEBP.' });
  }
  if (image.length > MAX_IMAGE_CHARS) {
    return send(res, 413, { error: 'La photo est trop volumineuse. Choisissez une image plus petite.' });
  }

  const forwarded = String(req.headers['x-forwarded-for'] || '');
  const ip = forwarded.split(',')[0].trim() || 'unknown';
  const now = Date.now();
  const state = recentRequests.get(ip);
  if (state && now - state.startedAt < WINDOW_MS && state.count >= MAX_REQUESTS_PER_WINDOW) {
    return send(res, 429, { error: 'Trop de tentatives rapprochées. Réessayez dans une minute.' });
  }
  if (!state || now - state.startedAt >= WINDOW_MS) recentRequests.set(ip, { startedAt: now, count: 1 });
  else state.count += 1;

  try {
    const upstream = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.OPENAI_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini',
        max_output_tokens: 250,
        input: [{
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                'You are helping a user prefill a car value estimator for Morocco.',
                'Inspect this single vehicle photo. Return ONLY one JSON object with keys: brand, model, year, fuel, bodyType, confidence, notes.',
                'brand and model should be strings or null. year should be an integer or null.',
                'fuel must be one of "Diesel", "Essence", "Hybride", "Électrique", "Autre", or null.',
                'bodyType should be a short string or null. confidence must be "high", "medium", or "low". notes should be a short string.',
                'Only identify details supported by visible evidence. Do not guess an exact year if not distinguishable; use null. Exterior photos usually cannot reliably reveal fuel, so use null unless there is clear evidence.',
                'The result is a suggestion, not a verified VIN decode. Do not estimate price and do not claim certainty.'
              ].join(' ')
            },
            { type: 'input_image', image_url: image, detail: 'high' }
          ]
        }]
      })
    });

    const payload = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      console.error('Vehicle recognition provider returned status', upstream.status);
      return send(res, 502, { error: 'Le service de reconnaissance IA a échoué. Réessayez avec une photo plus nette.' });
    }

    const outputText = payload.output?.flatMap(item => item.content || []).find(item => item.type === 'output_text')?.text || payload.output_text || '';
    let parsed;
    try {
      const start = outputText.indexOf('{');
      const end = outputText.lastIndexOf('}');
      if (start < 0 || end <= start) throw new Error('No JSON object');
      parsed = JSON.parse(outputText.slice(start, end + 1));
    } catch {
      return send(res, 502, { error: 'L’IA n’a pas pu identifier clairement ce véhicule. Essayez une photo de face ou de trois-quarts.' });
    }

    const year = Number(parsed.year);
    const normalized = {
      brand: typeof parsed.brand === 'string' ? parsed.brand.trim().slice(0, 80) || null : null,
      model: typeof parsed.model === 'string' ? parsed.model.trim().slice(0, 120) || null : null,
      year: Number.isInteger(year) && year >= 1950 && year <= new Date().getFullYear() + 1 ? year : null,
      fuel: ['Diesel', 'Essence', 'Hybride', 'Électrique', 'Autre'].includes(parsed.fuel) ? parsed.fuel : null,
      bodyType: typeof parsed.bodyType === 'string' ? parsed.bodyType.trim().slice(0, 50) || null : null,
      confidence: ['high', 'medium', 'low'].includes(parsed.confidence) ? parsed.confidence : 'low',
      notes: typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 240) : ''
    };
    if (!normalized.brand && !normalized.model) {
      return send(res, 422, { error: 'Impossible d’identifier la marque ou le modèle. Saisissez les informations manuellement.' });
    }
    return send(res, 200, normalized);
  } catch (error) {
    console.error('Vehicle recognition request failed:', error?.message || 'unknown error');
    return send(res, 502, { error: 'Impossible de joindre le service de reconnaissance. Réessayez plus tard.' });
  }
}
