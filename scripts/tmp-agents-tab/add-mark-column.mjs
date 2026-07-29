import fs from 'node:fs';
import { getTabValues, updateValues, batchUpdate, listTabs } from '../../netlify/functions/_lib/sheets.js';

process.env.GOOGLE_SHEETS_CREDENTIALS = fs.readFileSync('C:/Users/Admin/Downloads/gen-lang-client-0093084150-c362dec4bef9.json', 'utf8');

const SHEET_ID = '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const AGENTS_TAB = 'Agents';
const WRITE = process.argv.includes('--write');

const MARK_URL = 'https://res.cloudinary.com/dkn6tnxao/image/upload/c_limit,h_56,q_auto,f_auto/townconnect/homesconnect/agencies/sancus-realty-mark-white.png';

function colLetter(idx0) {
  let n = idx0 + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const values = await getTabValues(SHEET_ID, AGENTS_TAB, 'A1:Z50');
const headers = values[0];
console.log('Current headers:', JSON.stringify(headers));
if (headers.includes('agency_mark_white_url')) throw new Error('Column already exists — aborting to avoid duplicating it.');

const newColIdx = headers.length; // append at end
const newColLetter = colLetter(newColIdx);
console.log(`New column "agency_mark_white_url" will go at ${newColLetter} (index ${newColIdx})`);

const rows = values.slice(1).filter((r) => (r[0] || '').trim());
const nameIdx = headers.indexOf('agent_name');
const plan = rows.map((r) => {
  const name = r[nameIdx];
  const isSancus = name === 'Nicola Voges' || name === 'Merinda Maartens';
  return { name, value: isSancus ? MARK_URL : '' };
});
console.log('\nPlanned column values:');
plan.forEach((p) => console.log(`  ${p.name}: ${p.value ? '[mark URL]' : '(blank)'}`));

if (!WRITE) {
  console.log('\nDRY RUN — no changes written. Re-run with --write to apply.');
  process.exit(0);
}

const columnValues = [['agency_mark_white_url'], ...plan.map((p) => [p.value])];
const range = `${AGENTS_TAB}!${newColLetter}1:${newColLetter}${columnValues.length}`;
await updateValues(SHEET_ID, range, columnValues);
console.log(`\nWrote ${columnValues.length - 1} values to ${range}.`);

const after = await getTabValues(SHEET_ID, AGENTS_TAB, 'A1:Z50');
console.log('\nFinal Agents tab:');
after.forEach((r) => console.log(JSON.stringify(r)));
