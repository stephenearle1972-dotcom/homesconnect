// One-off / re-runnable: assign stable agent_id values to every listing row in
// the HomesConnect listings sheet, grouped by normalized agent_phone in
// first-appearance order (AG001, AG002, ...). Appends the agent_id column at the
// END of the sheet if it does not yet exist. Leaves agent_email untouched
// (that column already exists and is filled manually).
//
// Usage (PowerShell):
//   $env:GOOGLE_SHEETS_CREDENTIALS = Get-Content "F:\My Drive\TOWN CONNECT\google-sheets-credentials.json.json" -Raw
//   node scripts/assign-agent-ids.mjs            # dry run (prints plan, writes nothing)
//   node scripts/assign-agent-ids.mjs --write    # actually write the column
//
// Sheet ID resolves from HOMESCONNECT_SHEET_ID, else the known listings sheet.

import {
  getTabValues, updateValues, batchUpdate, listTabs,
} from '../netlify/functions/_lib/sheets.js';

const SHEET_ID = process.env.HOMESCONNECT_SHEET_ID || '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';
const WRITE = process.argv.includes('--write');

// Must be the PRODUCTION tab by name — the spreadsheet also holds pre-import
// snapshot/backup/demo tabs, and their left-to-right order shifts over time
// (e.g. PreSnapshot_* tabs have ended up left of this one). Picking
// listTabs()[0] previously wrote agent_id into whichever tab happened to be
// leftmost — a real incident risk, not a hypothetical. Pin by title instead.
const PRODUCTION_TAB_NAME = 'HomesConnect Listings';

// 0XXXXXXXXX -> 27XXXXXXXXX; strip +/spaces; leave already-27 numbers as-is.
function normPhone(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('27')) return d;
  if (d.startsWith('0')) return '27' + d.slice(1);
  return d;
}

function colLetter(idx0) { // 0-based column index -> A1 letter(s)
  let n = idx0 + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

const allTabs = await listTabs(SHEET_ID);
const prodTab = allTabs.find((t) => t.title === PRODUCTION_TAB_NAME);
if (!prodTab) {
  console.error(`Tab "${PRODUCTION_TAB_NAME}" not found. Tabs present: ${allTabs.map((t) => t.title).join(', ')}`);
  process.exit(1);
}
const tab = prodTab.title;
const tabGid = prodTab.sheetId;
const values = await getTabValues(SHEET_ID, tab, 'A1:BZ5000');
const headers = values[0] || [];
const rows = values.slice(1).filter((r) => (r[0] || '').trim()); // non-empty id

const phoneIdx = headers.indexOf('agent_phone');
const nameIdx = headers.indexOf('agent_name');
let idIdx = headers.indexOf('agent_id');
if (phoneIdx === -1) { console.error('No agent_phone column found — aborting.'); process.exit(1); }

const appendingColumn = idIdx === -1;
if (appendingColumn) idIdx = headers.length; // new column at the end

console.log(`Sheet: ${SHEET_ID}`);
console.log(`Tab:   ${tab}`);
console.log(`Rows:  ${rows.length}`);
console.log(`agent_id column: ${appendingColumn ? `NEW at ${colLetter(idIdx)} (index ${idIdx})` : `existing at ${colLetter(idIdx)}`}`);

// Assign ids by first-appearance of normalized phone.
const phoneToId = new Map();
let counter = 0;
const assignments = []; // { row, id, phone, name }
for (const r of rows) {
  const phone = normPhone(r[phoneIdx]);
  let id = '';
  if (phone) {
    if (!phoneToId.has(phone)) { counter += 1; phoneToId.set(phone, 'AG' + String(counter).padStart(3, '0')); }
    id = phoneToId.get(phone);
  }
  assignments.push({ id, phone, name: (r[nameIdx] || '').trim(), listingId: (r[0] || '').trim() });
}

// Mapping table (one line per distinct agent).
console.log('\nagent_id -> name / phone (distinct agents):');
const seen = new Set();
for (const a of assignments) {
  if (!a.id || seen.has(a.id)) continue;
  seen.add(a.id);
  console.log(`  ${a.id}  ${a.name || '(no name)'}  ${a.phone}`);
}
const blanks = assignments.filter((a) => !a.id).length;
if (blanks) console.log(`\n${blanks} row(s) have no agent_phone -> left blank.`);

if (!WRITE) {
  console.log('\nDRY RUN — no changes written. Re-run with --write to apply.');
  process.exit(0);
}

// The sheet grid is sized to the existing columns, so a brand-new column at the
// end needs the grid widened first (appendDimension), then the values written.
if (appendingColumn) {
  await batchUpdate(SHEET_ID, [
    { appendDimension: { sheetId: tabGid, dimension: 'COLUMNS', length: 1 } },
  ]);
  console.log(`Widened grid by 1 column for new agent_id at ${colLetter(idIdx)}.`);
}

// Write header + the full agent_id column in one PUT.
const col = colLetter(idIdx);
const columnValues = [['agent_id'], ...assignments.map((a) => [a.id])];
const range = `${tab}!${col}1:${col}${columnValues.length}`;
await updateValues(SHEET_ID, range, columnValues);
console.log(`\nWrote ${columnValues.length - 1} agent_id values to ${range}.`);

// Sanity: confirm tabs unchanged (no accidental structural edits).
const tabs = await listTabs(SHEET_ID);
console.log('Tabs after write:', tabs.map((t) => t.title).join(', '));
