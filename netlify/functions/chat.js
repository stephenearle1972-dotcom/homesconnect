// HomesConnect on-site chat — Gemini-powered property assistant.
// Reads the listings CSV (cached in lambda memory for 60s), then calls Gemini
// with the listings as system context and the user message as the prompt.

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const CSV_URL = process.env.LISTINGS_CSV_URL || process.env.VITE_LISTINGS_CSV_URL || '';
const SITE_URL = process.env.SITE_URL_HOMESCONNECT || 'https://homesconnect.co.za';
const WA_LINK = 'https://wa.me/27767959872';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

let cache = { rows: null, fetchedAt: 0 };

function ok(body) { return { statusCode: 200, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }
function bad(status, body) { return { statusCode: status, headers: { ...CORS, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }; }

// Minimal CSV parser (handles quoted fields with commas).
function parseCsv(text) {
  const rows = [];
  let row = []; let field = ''; let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQ = false; }
      } else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else if (c === '\r') { /* skip */ }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map((h) => h.trim());
  return rows
    .filter((r) => r.some((v) => v && v.length))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, (r[i] ?? '').trim()])));
}

async function loadListings() {
  const now = Date.now();
  if (cache.rows && now - cache.fetchedAt < 60_000) return cache.rows;
  if (!CSV_URL) { cache = { rows: [], fetchedAt: now }; return []; }
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`CSV ${res.status}`);
  const text = await res.text();
  // Only expose fully-active, moderation-approved listings to the chat assistant.
  // Filter out pending_payment rows (intake form before PayFast ITN confirms) and
  // flagged/rejected images. Blank moderation = grandfathered approved.
  const rows = parseCsv(text).filter((r) => {
    const statusOk = !r.status || r.status === 'active';
    const mod = (r.moderation || '').trim().toLowerCase();
    const modOk = !mod || mod === 'approved';
    return statusOk && modOk;
  });
  cache = { rows, fetchedAt: now };
  return rows;
}

function rowsToContext(rows) {
  // 300 is generous headroom over the launch-day figure of 80 (picked when there
  // were only 25 seed listings, not from a measured token budget — the trimmed
  // per-row context is small enough that 300 rows is still well under Gemini's
  // input context limit; see cc-report for the empirical token math).
  const trimmed = rows.slice(0, 300).map((r) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    price: r.price_display || r.price,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms,
    propertyType: r.property_type,
    suburb: r.suburb,
    city: r.city,
    province: r.province,
    pool: r.pool,
    garden: r.garden,
    description: r.description,
    agent: r.agent_name,
    agentPhone: r.agent_phone,
  }));
  return JSON.stringify(trimmed, null, 0);
}

function buildSystemPrompt(rows) {
  return `You are the HomesConnect property assistant. HomesConnect is a South African property search platform.

Your job: help users find properties in the LISTINGS data below. Search by suburb, city, province, bedrooms, price, property type (house/apartment/townhouse), and features (pool, garden, pet-friendly).

LISTINGS (JSON):
${rowsToContext(rows)}

RULES:
- Match listings that satisfy the user's query. Be generous on near-matches (e.g. "Pretoria East" should match suburbs in Pretoria like Faerie Glen, Garsfontein).
- Return AT MOST 3 results per query. Format each as:
  • **<title>** — <price>
    <suburb>, <city> · <beds> bed · <baths> bath · key features
    Agent: <agent_name>
    View: ${SITE_URL}/listing/<id>
- If NO listings match, reply: "I don't have properties matching that search right now, but new listings are added daily. Want to try a broader search, or message our WhatsApp bot at ${WA_LINK} for live help?"
- Keep responses short, friendly, and conversational. Plain text only (markdown bold OK). No HTML.
- Never invent listings. Only reference listings present in the JSON above.
- At the end of every multi-result reply, add: "Want full photos and details? Click any listing or message our WhatsApp bot at ${WA_LINK}."`;
}

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return bad(405, { error: 'Method not allowed' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return bad(400, { error: 'Bad JSON' }); }

  const message = (body.message || '').toString().trim();
  if (!message) return bad(400, { error: 'No message provided' });

  if (!GEMINI_API_KEY) {
    return ok({ response: "The assistant isn't configured yet. Please message our WhatsApp bot at " + WA_LINK });
  }

  try {
    const rows = await loadListings();
    const systemPrompt = buildSystemPrompt(rows);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
    const history = Array.isArray(body.history) ? body.history.slice(-6) : [];
    const contents = [
      ...history.map((m) => ({ role: m.role === 'user' ? 'user' : 'model', parts: [{ text: String(m.text || '') }] })),
      { role: 'user', parts: [{ text: message }] },
    ];

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[chat] Gemini error', res.status, errText);
      return ok({ response: "I'm having trouble right now. Please try again, or message our WhatsApp bot at " + WA_LINK });
    }
    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't process that. Try rephrasing?";
    return ok({ response: reply });
  } catch (err) {
    console.error('[chat] Error:', err);
    return ok({ response: "I'm having trouble right now. Please try again, or message our WhatsApp bot at " + WA_LINK });
  }
};
