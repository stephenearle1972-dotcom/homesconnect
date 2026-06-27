// Build-time sitemap generator. Runs in the `prebuild` step (before `vite build`)
// so the fresh sitemap lands in public/ and Vite copies it into dist/.
//
// It lists the static public routes plus one URL per active, moderation-approved
// listing, read from the SAME published CSV the live site consumes. We parse with
// papaparse (header mode) — NEVER a naive comma split — because listing rows
// contain Cloudinary image URLs with commas in them.
//
// If no CSV URL is configured (e.g. a local build with no env), it still writes a
// valid sitemap of the static routes and logs how many listing URLs were skipped.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Papa from 'papaparse';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(__dirname, '..', 'public');
const SITE = 'https://homesconnect.co.za';

// Stable, public, indexable routes. (Transactional/private routes such as
// /seller, /make-offer, /offer-consent, /listing-success are intentionally omitted.)
const STATIC_ROUTES = [
  { loc: '/', changefreq: 'daily', priority: '1.0' },
  { loc: '/listings', changefreq: 'daily', priority: '0.9' },
  { loc: '/search', changefreq: 'weekly', priority: '0.7' },
  { loc: '/conveyancers', changefreq: 'weekly', priority: '0.6' },
  { loc: '/list-property', changefreq: 'monthly', priority: '0.7' },
  { loc: '/list-conveyancer', changefreq: 'monthly', priority: '0.4' },
  { loc: '/faq', changefreq: 'yearly', priority: '0.2' },
  { loc: '/terms', changefreq: 'yearly', priority: '0.2' },
  { loc: '/privacy', changefreq: 'yearly', priority: '0.2' },
  { loc: '/disclaimer', changefreq: 'yearly', priority: '0.2' },
  { loc: '/cookies', changefreq: 'yearly', priority: '0.2' },
];

const CSV_URL =
  process.env.VITE_LISTINGS_CSV_URL || process.env.LISTINGS_CSV_URL || '';

function xmlEscape(s) {
  return String(s).replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c]));
}

// Mirror the site's isPublic(): visible only if active (or blank) AND moderation
// approved (or blank). Blank is grandfathered as approved.
function isPublic(row) {
  const status = (row.status || '').trim().toLowerCase();
  const mod = (row.moderation || '').trim().toLowerCase();
  const statusOk = !status || status === 'active';
  const modOk = !mod || mod === 'approved';
  return statusOk && modOk && !!(row.id || '').trim();
}

function lastmodOf(row) {
  const d = (row.date_listed || row.dateListed || '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(d) ? d.slice(0, 10) : null;
}

async function fetchListings() {
  if (!CSV_URL) return { rows: [], reason: 'no CSV URL configured' };
  try {
    const res = await fetch(CSV_URL);
    if (!res.ok) return { rows: [], reason: `CSV HTTP ${res.status}` };
    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    const rows = (parsed.data || []).filter(isPublic);
    return { rows, reason: null };
  } catch (err) {
    return { rows: [], reason: `fetch failed: ${err.message}` };
  }
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  return [
    '  <url>',
    `    <loc>${xmlEscape(SITE + loc)}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    changefreq ? `    <changefreq>${changefreq}</changefreq>` : null,
    priority ? `    <priority>${priority}</priority>` : null,
    '  </url>',
  ].filter(Boolean).join('\n');
}

const { rows, reason } = await fetchListings();

const entries = [
  ...STATIC_ROUTES.map(urlEntry),
  ...rows.map((r) =>
    urlEntry({ loc: `/listing/${encodeURIComponent(r.id.trim())}`, lastmod: lastmodOf(r), changefreq: 'weekly', priority: '0.8' })),
];

const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  entries.join('\n') +
  `\n</urlset>\n`;

writeFileSync(join(PUBLIC, 'sitemap.xml'), sitemap);

const robots =
  `User-agent: *\n` +
  `Allow: /\n\n` +
  `Sitemap: ${SITE}/sitemap.xml\n`;
writeFileSync(join(PUBLIC, 'robots.txt'), robots);

const total = STATIC_ROUTES.length + rows.length;
console.log(
  `sitemap.xml written: ${total} URLs (${STATIC_ROUTES.length} static + ${rows.length} listings)` +
  (reason ? ` — listings skipped: ${reason}` : '') +
  `\nrobots.txt written.`);
