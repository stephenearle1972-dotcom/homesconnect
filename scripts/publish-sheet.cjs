// Publish the HomesConnect Listings sheet to web (CSV) and grant anyone-with-link
// read access as belt-and-braces (so the export?format=csv URL also works).

const path = require('path');
const GA = require(path.join('C:/Users/Admin/Desktop/vaalwaterconnect/node_modules', 'googleapis'));
const { google } = GA;

const CREDS_PATH = 'F:/My Drive/TOWN CONNECT/google-sheets-credentials.json.json';
const SHEET_ID = '1SMlKNPToUnmh0VzxJmcjti6DPsUML1K7xk4PqvOMKmU';

(async () => {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDS_PATH,
    scopes: ['https://www.googleapis.com/auth/drive', 'https://www.googleapis.com/auth/spreadsheets'],
  });
  const drive = google.drive({ version: 'v3', auth });
  const sheets = google.sheets({ version: 'v4', auth });

  // ---- 1. Grant anyone-with-link read access (lets export?format=csv work) ----
  try {
    const perm = await drive.permissions.create({
      fileId: SHEET_ID,
      requestBody: { role: 'reader', type: 'anyone' },
    });
    console.log('Anyone-with-link reader permission:', perm.data.id || 'ok');
  } catch (err) {
    console.error('Permission create failed:', err.message || err);
  }

  // ---- 2. Mark the latest revision as published (publish-to-web) ----
  try {
    const revs = await drive.revisions.list({ fileId: SHEET_ID, fields: 'revisions(id)' });
    const latest = (revs.data.revisions || []).at(-1);
    if (!latest) throw new Error('No revisions returned');
    console.log('Latest revision id:', latest.id);
    const upd = await drive.revisions.update({
      fileId: SHEET_ID,
      revisionId: latest.id,
      requestBody: { published: true, publishAuto: true, publishedOutsideDomain: true },
    });
    console.log('Revision published:', upd.data.published, '(auto:', upd.data.publishAuto, ')');
  } catch (err) {
    console.error('Revision publish failed:', err.message || err);
  }

  // ---- 3. Resolve the first tab's gid (for the export URL) ----
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const firstSheet = meta.data.sheets[0];
  const gid = firstSheet.properties.sheetId;
  const tabName = firstSheet.properties.title;
  console.log(`\nFirst tab: "${tabName}" (gid=${gid})`);

  // Working CSV URL (export endpoint — requires anyone-with-link reader):
  const exportUrl = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  console.log('\nUSE THIS CSV URL:');
  console.log(exportUrl);
})().catch((err) => {
  console.error('FATAL:', err.message || err);
  process.exit(1);
});
