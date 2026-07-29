import fs from 'node:fs';
import { getTabValues, updateValues } from '../../netlify/functions/_lib/sheets.js';

process.env.GOOGLE_SHEETS_CREDENTIALS = fs.readFileSync('C:/Users/Admin/Downloads/gen-lang-client-0093084150-c362dec4bef9.json', 'utf8');

const SHEET_ID = '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const LISTINGS_TAB = 'HomesConnect Listings';

function colLetter(idx0) { // correct base-26 conversion, handles idx0 > 25
  let n = idx0 + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const values = await getTabValues(SHEET_ID, LISTINGS_TAB, 'A1:BZ2000');
const headers = values[0];
const hIdx = Object.fromEntries(headers.map((h, i) => [h, i]));
console.log('title col letter:', colLetter(hIdx.title), '(index', hIdx.title, ')');
console.log('agent_email col letter:', colLetter(hIdx.agent_email), '(index', hIdx.agent_email, ')');

const rows = values.slice(1).filter((r) => (r[0] || '').trim());
const sanIdx = rows.findIndex((r) => r[0] === 'HC-SAN-004');
if (sanIdx === -1) throw new Error('HC-SAN-004 not found');
const sheetRowNumber = sanIdx + 2;
console.log('HC-SAN-004 sheet row:', sheetRowNumber);
console.log('current (corrupted) title:', JSON.stringify(rows[sanIdx][hIdx.title]));
console.log('current agent_email:', JSON.stringify(rows[sanIdx][hIdx.agent_email]));

const CORRECT_TITLE = '3 Bedroom Apartment For Sale in Klein Welgevonden';
const titleCol = colLetter(hIdx.title);
const emailCol = colLetter(hIdx.agent_email);

await updateValues(SHEET_ID, `${LISTINGS_TAB}!${titleCol}${sheetRowNumber}:${titleCol}${sheetRowNumber}`, [[CORRECT_TITLE]]);
console.log(`Restored title at ${titleCol}${sheetRowNumber} to: "${CORRECT_TITLE}"`);

await updateValues(SHEET_ID, `${LISTINGS_TAB}!${emailCol}${sheetRowNumber}:${emailCol}${sheetRowNumber}`, [['merinda@sancusrealty.co.za']]);
console.log(`Wrote merinda@sancusrealty.co.za to ${emailCol}${sheetRowNumber}`);

// Re-read to confirm
const after = await getTabValues(SHEET_ID, LISTINGS_TAB, `A${sheetRowNumber}:BZ${sheetRowNumber}`);
console.log('\nRow after fix:', JSON.stringify(after[0]));
