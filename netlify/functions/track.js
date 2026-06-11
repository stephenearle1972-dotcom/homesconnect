// HomesConnect — lightweight web analytics sink.
//   POST { event_type, listing_ref?, query_text?, session_hash }
// Accepts only web_view and web_search. Logs one events row and returns 200.
// Designed to be called fire-and-forget from the client (errors swallowed both
// sides), so it never blocks the UI and never returns anything sensitive.

import { logHcEvent } from './_lib/hcEvents.js';

const ALLOWED = new Set(['web_view', 'web_search']);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers: CORS, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: CORS, body: '' };

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) }; }

  const event_type = String(body.event_type || '').trim();
  if (!ALLOWED.has(event_type)) {
    // Don't error a fire-and-forget beacon; just ignore unknown types.
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true, ignored: true }) };
  }

  await logHcEvent({
    event_type,
    channel: 'web',
    listing_ref: String(body.listing_ref || '').trim(),
    agent_id: '', // resolved at aggregation time (Phase 2) from listing_ref
    query_text: body.query_text || '',
    session_hash: String(body.session_hash || '').trim() || 'anon',
    meta: {},
  });

  return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: true }) };
};
