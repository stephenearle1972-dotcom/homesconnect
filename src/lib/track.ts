// HomesConnect — client-side Buyer Alerts tracking helpers.
// No cookies, no third-party trackers, no PII: a random per-browser id lives in
// localStorage purely to group a visitor's own events. All network calls are
// fire-and-forget and swallow errors so they never affect the UI.

const SID_KEY = 'hc_sid';

export function getSid(): string {
  try {
    let v = localStorage.getItem(SID_KEY);
    if (!v) {
      v = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
      localStorage.setItem(SID_KEY, v);
    }
    return v;
  } catch {
    return 'anon';
  }
}

type TrackEvent =
  | { event_type: 'web_view'; listing_ref: string }
  | { event_type: 'web_search'; query_text: string };

export function track(ev: TrackEvent): void {
  try {
    const body = JSON.stringify({ ...ev, session_hash: getSid() });
    fetch('/.netlify/functions/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* never let tracking surface to the UI */
  }
}

// Build a tracked contact-redirect URL for the go.js function.
export function goUrl(ref: string, to: 'agent' | 'hc', src: 'web' | 'bot' = 'web'): string {
  return `/.netlify/functions/go?ref=${encodeURIComponent(ref)}&src=${src}&to=${to}&sid=${encodeURIComponent(getSid())}`;
}
