// HomesConnect — Buyer Alerts event logger.
// Appends one row to the "events" tab of the private HomesConnect Analytics
// sheet. Best-effort: a logging failure must NEVER break a page function or a
// bot reply, so every path is wrapped and swallows errors.
//
// Schema (events tab, 8 cols):
//   timestamp | event_type | channel | listing_ref | agent_id | query_text | session_hash | meta
//   event_type ∈ bot_appearance | bot_connect_request | web_view | web_search | contact_click | enquiry
//   channel    ∈ bot | web
//   meta       = compact JSON string for anything extra (results_count, src, ...)
//
// This module is intentionally duplicated (with an identical logHcEvent
// interface and identical row shape) in vaalwaterconnect at
// netlify/functions/utils/hcEvents.js. The two differ ONLY in how they obtain
// Google credentials: this copy reuses the repo's _lib/sheets.js (which reads
// the GOOGLE_SHEETS_CREDENTIALS env var — already set on the homesconnect
// Netlify site); the vaalwaterconnect copy reuses analyticsLogger's inlined
// service-account auth (that site is at its 4KB Lambda env-var ceiling, so a
// credentials env var can't be added there).

import { appendRowToTab } from './sheets.js';

// A sheet ID is an identifier for a private, unpublished workbook, not a
// credential. Prefer the env var on the homesconnect site; fall back to the
// known ID so the logger works even if the var is unset.
const SHEET_ID = process.env.HOMESCONNECT_ANALYTICS_SHEET_ID || '1oFPMW5oEdHA3yPe-Fsb6KMiXMLU6D374Lv4qP1tZAa8';
const TAB = 'events';

function clean(s) {
  return String(s ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, 200);
}

export function buildEventRow({ event_type, channel, listing_ref, agent_id, query_text, session_hash, meta }) {
  return [
    new Date().toISOString(),                          // timestamp
    event_type || '',                                  // event_type
    channel || '',                                     // channel
    listing_ref || '',                                 // listing_ref
    agent_id || '',                                    // agent_id
    clean(query_text),                                 // query_text (≤200 chars)
    session_hash || '',                                // session_hash
    meta ? (typeof meta === 'string' ? meta : JSON.stringify(meta)) : '', // meta
  ];
}

export async function logHcEvent(event) {
  try {
    await appendRowToTab(SHEET_ID, TAB, buildEventRow(event));
  } catch (err) {
    console.error('[hc-event-fail]', event?.event_type || '?', '-', err.message);
  }
}
