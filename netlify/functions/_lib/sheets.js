// Minimal Google Sheets v4 client. Avoids the `googleapis` npm package
// (its CJS internals don't bundle cleanly for Netlify Functions — they throw
// "Class extends value is not a constructor"). We sign a JWT via node:crypto,
// exchange it for an access token, and call the Sheets REST API with fetch.

import crypto from 'node:crypto';

let cachedToken = null;
let cachedTokenExpiresAt = 0;

function getCreds() {
  const raw = process.env.GOOGLE_SHEETS_CREDENTIALS;
  if (!raw) throw new Error('GOOGLE_SHEETS_CREDENTIALS env var not set');
  return JSON.parse(raw);
}

function base64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedTokenExpiresAt > now + 60) return cachedToken;

  const creds = getCreds();
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({
    iss: creds.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }));
  const signingInput = `${header}.${payload}`;
  const signature = base64url(
    crypto.createSign('RSA-SHA256').update(signingInput).sign(creds.private_key)
  );
  const jwt = `${signingInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`OAuth token exchange ${res.status}: ${await res.text()}`);
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = now + (data.expires_in || 3600);
  return cachedToken;
}

async function sheetsApi(method, path, body) {
  const token = await getAccessToken();
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!res.ok) {
    const err = new Error(`Sheets API ${method} ${path} ${res.status}: ${json.error?.message || text}`);
    err.code = res.status;
    err.detail = json;
    throw err;
  }
  return json;
}

export async function getFirstTabName(sheetId) {
  const meta = await sheetsApi('GET', `/${sheetId}?fields=sheets.properties.title,sheets.properties.sheetId`);
  return meta.sheets[0].properties.title;
}

export async function appendRow(sheetId, row) {
  const tab = await getFirstTabName(sheetId);
  return sheetsApi(
    'POST',
    `/${sheetId}/values/${encodeURIComponent(tab + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: [row] }
  );
}

// Append to a SPECIFIC named tab (appendRow targets the first tab only).
export async function appendRowToTab(sheetId, tab, row) {
  return sheetsApi(
    'POST',
    `/${sheetId}/values/${encodeURIComponent(tab + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    { values: [row] }
  );
}

export async function getAllValues(sheetId, range = 'A1:Z2000') {
  const tab = await getFirstTabName(sheetId);
  const res = await sheetsApi('GET', `/${sheetId}/values/${encodeURIComponent(tab + '!' + range)}`);
  return { tab, values: res.values || [] };
}

export async function updateCell(sheetId, tab, a1Cell, value) {
  return sheetsApi(
    'PUT',
    `/${sheetId}/values/${encodeURIComponent(tab + '!' + a1Cell)}?valueInputOption=RAW`,
    { values: [[value]] }
  );
}
