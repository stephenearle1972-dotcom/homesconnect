// GA4 analytics. Silently disabled whenever VITE_GA_MEASUREMENT_ID is unset
// or empty — this must never break the site or log noise if the variable
// is missing. Every call in this module is a no-op in that case.
//
// Loaded async so it can never block or slow page rendering. Config:
// Google Signals + ads personalization off, send_page_view off (route
// changes are tracked manually — see trackPageView — so gtag's own
// automatic page_view on load would double-count the first page).
// (No anonymize_ip: it's a Universal Analytics-only key GA4 doesn't
// recognize — GA4 does IP anonymization by default regardless — and it
// was confirmed, on CarsConnect's identical setup, to do nothing but
// attach a stray `anonymize_ip` param to every event when passed here.)
//
// IMPORTANT: the shim below must use the `arguments` object, not a rest
// parameter (`...args`). Confirmed by direct testing against a real GA4
// endpoint on CarsConnect: `function(){ dataLayer.push(arguments) }`
// delivers hits correctly; `function(...args){ dataLayer.push(args) }`
// builds an identical-looking dataLayer entry but gtag.js's own queue
// processor silently swallows it — no error, no hit, ever. Do not
// "clean this up" to rest params.
//
// Never pass name/email/phone/photo URLs or any other personal value as an
// event parameter here — counts and categories only. This is a separate
// module from src/lib/track.ts (HomesConnect's own first-party Buyer
// Alerts tracking) — do not conflate the two or touch track.ts here.

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
const enabled = Boolean(MEASUREMENT_ID && MEASUREMENT_ID.trim());

let initialized = false;

export function initAnalytics(): void {
  if (!enabled || initialized) return;
  initialized = true;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    // eslint-disable-next-line prefer-rest-params -- see note above, this is deliberate
    window.dataLayer.push(arguments);
  };
  window.gtag('js', new Date());
  window.gtag('config', MEASUREMENT_ID, {
    allow_google_signals: false,
    allow_ad_personalization_signals: false,
    send_page_view: false,
  });

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);
}

export function trackPageView(path: string): void {
  if (!enabled) return;
  window.gtag?.('event', 'page_view', {
    page_location: window.location.href,
    page_path: path,
  });
}

export function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
  if (!enabled) return;
  window.gtag?.('event', name, params);
}
