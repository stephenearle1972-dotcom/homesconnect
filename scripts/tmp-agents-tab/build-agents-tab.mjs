import fs from 'node:fs';
import {
  getTabValues, updateValues, batchUpdate, listTabs, appendRowToTab,
} from '../../netlify/functions/_lib/sheets.js';

process.env.GOOGLE_SHEETS_CREDENTIALS = fs.readFileSync('C:/Users/Admin/Downloads/gen-lang-client-0093084150-c362dec4bef9.json', 'utf8');

const SHEET_ID = '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const LISTINGS_TAB = 'HomesConnect Listings';
const AGENTS_TAB = 'Agents';
const WRITE = process.argv.includes('--write');

const CLOUD = 'dkn6tnxao';
function agentPhoto(slug) {
  return `https://res.cloudinary.com/${CLOUD}/image/upload/c_fill,w_200,h_200,g_face,q_auto,f_auto/townconnect/homesconnect/agents/${slug}.jpg`;
}
const SANCUS_LOGO_WHITE = `https://res.cloudinary.com/${CLOUD}/image/upload/c_limit,w_160,q_auto,f_auto/townconnect/homesconnect/agencies/sancus-realty-white.png`;
const SANCUS_LOGO_COLOUR = `https://res.cloudinary.com/${CLOUD}/image/upload/c_limit,w_160,q_auto,f_auto/townconnect/homesconnect/agencies/sancus-realty-colour.png`;

function norm(s) { return String(s || '').trim().toLowerCase(); }

// --- Step 1: read live Listings tab, compute distinct agents ---
const listingsValues = await getTabValues(SHEET_ID, LISTINGS_TAB, 'A1:BZ2000');
const headers = listingsValues[0];
const rows = listingsValues.slice(1).filter((r) => (r[0] || '').trim());
console.log(`Production rows read: ${rows.length}`);
if (rows.length !== 117) throw new Error(`Expected 117 existing rows, found ${rows.length} — STOPPING`);

const hIdx = Object.fromEntries(headers.map((h, i) => [h, i]));
const byNormName = new Map();
for (const r of rows) {
  const rawName = r[hIdx.agent_name];
  const n = norm(rawName);
  if (!n) continue; // blank-agent rows excluded
  if (!byNormName.has(n)) {
    byNormName.set(n, { rawName, agency: r[hIdx.agent_agency], phone: r[hIdx.agent_phone], email: r[hIdx.agent_email], count: 0 });
  }
  byNormName.get(n).count += 1;
}
console.log(`Distinct agents found: ${byNormName.size}`);
for (const [n, a] of byNormName) console.log(`  ${a.rawName} | ${a.agency} | ${a.count} listings`);

// --- Step 2: build the Agents tab rows ---
const AGENTS_HEADER = ['agent_name', 'photo_url', 'agency_logo_white_url', 'agency_logo_colour_url', 'email', 'job_title', 'bio'];
const agentRows = [];
for (const [n, a] of byNormName) {
  let photoUrl = '';
  let logoWhite = '';
  let logoColour = '';
  let email = a.email;
  if (n === 'nicola voges') {
    photoUrl = agentPhoto('nicola-voges');
    logoWhite = SANCUS_LOGO_WHITE;
    logoColour = SANCUS_LOGO_COLOUR;
  } else if (n === 'merinda maartens') {
    photoUrl = agentPhoto('merinda-maartens');
    logoWhite = SANCUS_LOGO_WHITE;
    logoColour = SANCUS_LOGO_COLOUR;
    email = 'merinda@sancusrealty.co.za'; // corrected this run, kept in sync with the listing row
  }
  agentRows.push([a.rawName, photoUrl, logoWhite, logoColour, email, '', '']);
}

console.log('\nAgents tab rows to write:');
agentRows.forEach((r) => console.log(' ', JSON.stringify(r)));

if (!WRITE) {
  console.log('\nDRY RUN — no changes written. Re-run with --write to apply.');
  process.exit(0);
}

// --- Step 3: create the Agents tab if it doesn't exist ---
const tabsBefore = await listTabs(SHEET_ID);
if (tabsBefore.some((t) => t.title === AGENTS_TAB)) {
  console.log(`Tab "${AGENTS_TAB}" already exists — will overwrite its values, not recreate it.`);
} else {
  await batchUpdate(SHEET_ID, [{ addSheet: { properties: { title: AGENTS_TAB } } }]);
  console.log(`Created tab: ${AGENTS_TAB}`);
}

// --- Step 4: write header + rows in one PUT ---
const values2d = [AGENTS_HEADER, ...agentRows];
const range = `${AGENTS_TAB}!A1:${String.fromCharCode(65 + AGENTS_HEADER.length - 1)}${values2d.length}`;
await updateValues(SHEET_ID, range, values2d);
console.log(`Wrote ${agentRows.length} agent rows to ${range}.`);

// --- Step 5: fix HC-SAN-004's agent_email ---
const sanIdx = rows.findIndex((r) => r[0] === 'HC-SAN-004');
if (sanIdx === -1) throw new Error('HC-SAN-004 not found — STOPPING, not touching anything else.');
const sheetRowNumber = sanIdx + 2; // +1 header, +1 for 1-based
const emailCol = String.fromCharCode(65 + hIdx.agent_email);
const currentEmail = rows[sanIdx][hIdx.agent_email];
console.log(`\nHC-SAN-004 current agent_email: "${currentEmail}" (row ${sheetRowNumber}, col ${emailCol})`);
await updateValues(SHEET_ID, `${LISTINGS_TAB}!${emailCol}${sheetRowNumber}:${emailCol}${sheetRowNumber}`, [['merinda@sancusrealty.co.za']]);
console.log(`Wrote merinda@sancusrealty.co.za to ${LISTINGS_TAB}!${emailCol}${sheetRowNumber}`);
