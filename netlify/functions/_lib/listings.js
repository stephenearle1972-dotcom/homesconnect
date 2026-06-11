// Minimal server-side listing lookup for the Buyer Alerts web functions
// (go.js / enquiry.js). Fetches the same published listings CSV the bot reads
// and resolves a single listing by its Ref id. Header-based parsing with a
// quoted-field-aware CSV splitter (listing rows contain Cloudinary image URLs
// that include commas — a naive split would corrupt them).
//
// Cached per Lambda container for 5 minutes to keep redirects fast.

const CSV_URL =
  process.env.HOMESCONNECT_LISTINGS_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU/export?format=csv&gid=511887476';

const TTL_MS = 5 * 60 * 1000;
let cache = null;
let cacheTime = 0;

function parseCSVLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') { cur += '"'; i++; } else q = !q;
    } else if (ch === ',' && !q) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVLine(lines[i]);
    const row = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = (cells[j] || '').trim();
    if (row.id) rows.push(row);
  }
  return rows;
}

export async function loadAllListings() {
  const now = Date.now();
  if (cache && now - cacheTime < TTL_MS) return cache;
  const res = await fetch(CSV_URL);
  if (!res.ok) throw new Error(`listings CSV ${res.status}`);
  cache = parseCSV(await res.text());
  cacheTime = now;
  return cache;
}

// Case-insensitive match on the Ref id (e.g. "HC009"). Returns the raw row
// object (header-keyed) or null. Never throws — returns null on fetch failure.
export async function getListingByRef(ref) {
  if (!ref) return null;
  const target = String(ref).trim().toUpperCase();
  try {
    const rows = await loadAllListings();
    return rows.find((r) => String(r.id).trim().toUpperCase() === target) || null;
  } catch (err) {
    console.error('[listings] lookup failed for', ref, '-', err.message);
    return null;
  }
}
