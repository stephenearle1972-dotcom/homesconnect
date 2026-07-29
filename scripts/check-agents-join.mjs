// Re-runnable health check for the Listings <-> Agents join.
// Run any time after editing either tab: node scripts/check-agents-join.mjs
//
// Checks (report only — never auto-fixes, never guesses):
//   1. Name collisions: the same normalised agent_name appearing under more
//      than one distinct agent_agency on the Listings sheet. The site's
//      /agent/<slug> page groups purely by name, so a collision here means
//      two different agents' listings would show up on one shared page.
//   2. Silent join failure, both directions:
//        a) a listing's agent_name has no matching row in the Agents tab
//           (that agent's page will render with no photo/logo — degrades
//           cleanly, but worth knowing about)
//        b) an Agents tab row matches no listing at all (dead data — an
//           agent who's been fully removed from the catalogue, or a typo)
//   3. Near-misses: names that don't match exactly (after trim + lowercase)
//      but are textually close (Levenshtein distance <= 3). Reported only —
//      never auto-joined. Fix the data by hand if one of these is real.
//
// Join rule enforced everywhere below: trim + lowercase, nothing fuzzier.

const LISTINGS_CSV = 'https://docs.google.com/spreadsheets/d/1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU/export?format=csv&gid=511887476';
const AGENTS_CSV = 'https://docs.google.com/spreadsheets/d/1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU/export?format=csv&gid=1896003175';

function parseCSV(str) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (inQuotes) { if (c === '"') { if (str[i + 1] === '"') { field += '"'; i++; } else inQuotes = false; } else field += c; }
    else { if (c === '"') inQuotes = true; else if (c === ',') { row.push(field); field = ''; } else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; } else if (c === '\r') { /* skip */ } else field += c; }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

function norm(s) { return String(s || '').trim().toLowerCase(); }

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

async function fetchRows(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed ${res.status} for ${url}`);
  const text = await res.text();
  const rows = parseCSV(text);
  const header = rows[0];
  const data = rows.slice(1).filter((r) => r.length > 1 || r[0] !== '');
  return { header, data };
}

const listings = await fetchRows(LISTINGS_CSV);
const agents = await fetchRows(AGENTS_CSV);

const lIdx = Object.fromEntries(listings.header.map((h, i) => [h, i]));
const aIdx = Object.fromEntries(agents.header.map((h, i) => [h, i]));

console.log(`Listings rows: ${listings.data.length} | Agents rows: ${agents.data.length}`);

// --- Group listings by normalised name ---
const listingsByNormName = new Map(); // normName -> { rawNames:Set, agencies:Set, count }
let blankAgentCount = 0;
for (const r of listings.data) {
  const raw = r[lIdx.agent_name];
  const n = norm(raw);
  if (!n) { blankAgentCount++; continue; }
  if (!listingsByNormName.has(n)) listingsByNormName.set(n, { rawNames: new Set(), agencies: new Set(), count: 0 });
  const g = listingsByNormName.get(n);
  g.rawNames.add(raw);
  g.agencies.add(r[lIdx.agent_agency]);
  g.count++;
}
console.log(`Blank-agent listing rows (no agent at all, excluded from all checks below): ${blankAgentCount}`);

// --- Check 1: collisions ---
console.log('\n=== CHECK 1: name collisions across different agencies ===');
let anyCollision = false;
for (const [n, g] of listingsByNormName) {
  if (g.agencies.size > 1) {
    anyCollision = true;
    console.log(`COLLISION: "${[...g.rawNames].join(' / ')}" appears under agencies: ${[...g.agencies].join(', ')} — these would share ONE /agent/ page today.`);
  }
}
if (!anyCollision) console.log('None found. (If this ever fires: the site groups purely by name, so two different people with the same name at different agencies will silently share one page and one set of listings — there is no code-level guard against this, only this check.)');

// --- Check 2a: listing agent_name with no matching Agents row ---
console.log('\n=== CHECK 2a: listing agents with no Agents-tab row ===');
const agentNormNames = new Set(agents.data.map((r) => norm(r[aIdx.agent_name])));
let anyMissingAgentRow = false;
for (const [n, g] of listingsByNormName) {
  if (!agentNormNames.has(n)) {
    anyMissingAgentRow = true;
    console.log(`NO AGENTS ROW: "${[...g.rawNames].join(' / ')}" (${g.count} listing(s)) has no matching row in the Agents tab — that agent's page will render with no photo/logo (degrades cleanly, not broken, but flagging).`);
  }
}
if (!anyMissingAgentRow) console.log('None — every distinct listing agent has a matching Agents-tab row.');

// --- Check 2b: Agents row with no matching listing ---
console.log('\n=== CHECK 2b: Agents-tab rows with no matching listing ===');
let anyDeadAgentRow = false;
for (const r of agents.data) {
  const n = norm(r[aIdx.agent_name]);
  if (!listingsByNormName.has(n)) {
    anyDeadAgentRow = true;
    console.log(`DEAD ROW: Agents-tab row "${r[aIdx.agent_name]}" matches no listing at all — either a typo, or every listing for this agent has been removed.`);
  }
}
if (!anyDeadAgentRow) console.log('None — every Agents-tab row matches at least one listing.');

// --- Check 3: near-misses (report only, never auto-join) ---
console.log('\n=== CHECK 3: near-misses (Levenshtein <= 3, listing names vs Agents-tab names) ===');
const listingNames = [...listingsByNormName.keys()];
const agentNames = [...agentNormNames];
let anyNearMiss = false;
for (const ln of listingNames) {
  for (const an of agentNames) {
    if (ln === an) continue;
    const d = levenshtein(ln, an);
    if (d > 0 && d <= 3) {
      anyNearMiss = true;
      console.log(`NEAR-MISS: listing agent "${ln}" vs Agents-tab "${an}" (distance ${d}) — NOT auto-joined. Fix the data by hand if these are the same person.`);
    }
  }
}
if (!anyNearMiss) console.log('None found.');

console.log('\nDone.');
