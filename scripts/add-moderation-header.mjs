// One-off: append the `moderation` header to a listings tab (column AH, after agent_email).
// Usage: GOOGLE_SHEETS_CREDENTIALS=... node scripts/add-moderation-header.mjs <sheetId> <tab>
import { getTabValues, updateCell, listTabs, batchUpdate } from '../netlify/functions/_lib/sheets.js';

const sheetId = process.argv[2];
const tab = process.argv[3];
if (!sheetId || !tab) { console.error('need <sheetId> <tab>'); process.exit(1); }

const rows = await getTabValues(sheetId, tab, 'A1:BZ1');
const header = rows[0] || [];
const existing = header.indexOf('moderation');
if (existing !== -1) {
  console.log(`'moderation' already present at column index ${existing}. Nothing to do.`);
  process.exit(0);
}

// The grid may be sized exactly to the current header (no spare columns), so first
// extend the tab by one column, then write the header into it.
const tabs = await listTabs(sheetId);
const meta = tabs.find((t) => t.title === tab);
if (!meta) { console.error(`tab "${tab}" not found. tabs: ${tabs.map((t) => t.title).join(', ')}`); process.exit(1); }

await batchUpdate(sheetId, [{
  appendDimension: { sheetId: meta.sheetId, dimension: 'COLUMNS', length: 1 },
}]);

const colIdx = header.length; // 0-based -> next (now-existing) empty column
function colLetter(idx) { let s=''; let n=idx; do { s=String.fromCharCode(65+(n%26))+s; n=Math.floor(n/26)-1; } while (n>=0); return s; }
const cell = `${colLetter(colIdx)}1`;
await updateCell(sheetId, tab, cell, 'moderation');
console.log(`Added 1 column + wrote 'moderation' header to ${tab}!${cell} (after ${header[header.length-1] || '(empty)'})`);
