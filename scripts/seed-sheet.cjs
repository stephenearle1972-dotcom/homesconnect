// Find the HomesConnect Listings sheet via Drive, then write headers + 25 rows.
// Uses the existing TownConnect service account.

const path = require('path');
const fs = require('fs');

const GA = require(path.join('C:/Users/Admin/Desktop/vaalwaterconnect/node_modules', 'googleapis'));
const { google } = GA;

const CREDS_PATH = 'F:/My Drive/TOWN CONNECT/google-sheets-credentials.json.json';
const SEED_CSV = 'C:/Users/Admin/Desktop/homesconnect/seed/listings_seed.csv';

function parseCsvLine(line) {
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

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.length);
  return lines.map(parseCsvLine);
}

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.readonly'],
  });

  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  // 1. Find the sheet shared with the service account.
  console.log('Searching Drive for "HomesConnect"…');
  const listRes = await drive.files.list({
    q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false and name contains 'HomesConnect'",
    fields: 'files(id,name,owners(emailAddress))',
    pageSize: 25,
  });
  const candidates = listRes.data.files || [];
  if (!candidates.length) {
    console.error('No matching sheets. Service account may not have access. Falling back to wider search…');
    const all = await drive.files.list({
      q: "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false",
      fields: 'files(id,name)',
      pageSize: 100,
      orderBy: 'modifiedTime desc',
    });
    console.error('Visible sheets to service account:');
    for (const f of all.data.files) console.error(`  ${f.id}  ${f.name}`);
    process.exit(2);
  }
  console.log(`Found ${candidates.length} candidate(s):`);
  for (const f of candidates) console.log(`  ${f.id}  "${f.name}"`);

  // Pick the most-recent HomesConnect Listings sheet.
  const chosen = candidates.find((f) => /listing/i.test(f.name)) || candidates[0];
  console.log(`\nUsing: ${chosen.id} — "${chosen.name}"`);

  // 2. Read seed CSV.
  const text = fs.readFileSync(SEED_CSV, 'utf8');
  const rows = parseCsv(text);
  console.log(`Seed: ${rows.length} rows (incl. header) × ${rows[0].length} cols`);

  // 3. Get the first sheet/tab and its current row count.
  const meta = await sheets.spreadsheets.get({ spreadsheetId: chosen.id });
  const firstSheet = meta.data.sheets[0];
  const tabName = firstSheet.properties.title;
  console.log(`First tab: "${tabName}"`);

  // Clear it first, then write fresh (in case Stephen tested with junk rows).
  await sheets.spreadsheets.values.clear({
    spreadsheetId: chosen.id,
    range: `${tabName}!A1:Z2000`,
  });
  console.log('Cleared existing rows.');

  await sheets.spreadsheets.values.update({
    spreadsheetId: chosen.id,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: rows },
  });
  console.log(`Wrote ${rows.length} rows.`);

  console.log(`\n✓ Sheet seeded. Edit URL: https://docs.google.com/spreadsheets/d/${chosen.id}/edit`);
})().catch((err) => {
  console.error('FAILED:', err.message || err);
  if (err.errors) console.error(JSON.stringify(err.errors, null, 2));
  process.exit(1);
});
