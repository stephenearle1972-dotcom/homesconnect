export const SITE_NAME = 'HomesConnect';
export const TAGLINE = 'Find Your Next Home via WhatsApp';
export const WA_NUMBER = '27767959872';
export const WA_LINK = `https://wa.me/${WA_NUMBER}`;
export const WA_DISPLAY = '+27 76 795 9872';
export const SUPPORT_EMAIL = 'hello@townconnect.co.za';

export const CSV_URL =
  import.meta.env.VITE_LISTINGS_CSV_URL ||
  // Placeholder — Stephen replaces via Netlify env var VITE_LISTINGS_CSV_URL.
  '';

// Free conveyancer directory — separate tab, published CSV (VITE_CONVEYANCERS_CSV_URL).
export const CONVEYANCERS_CSV_URL = import.meta.env.VITE_CONVEYANCERS_CSV_URL || '';

// ECTA supplier disclosure for the add-on checkout. Replace `address` with the exact
// registered street address when provided (one-line change).
export const COMPANY = {
  name: 'TownConnect (Pty) Ltd t/a HomesConnect',
  reg: '2026/106250/07',
  address: 'Registered office — full physical address available on request to hello@townconnect.co.za',
  phone: '+27 68 898 6081',
  email: 'hello@townconnect.co.za',
  website: 'https://homesconnect.co.za',
};
export const ADDON = {
  name: 'Make an Offer add-on',
  price: 'R299',
  includes: [
    'Buyers can send structured, non-binding proposed terms on this listing',
    'A private dashboard to review and compare all proposals',
    'A neutral handoff to a conveyancer of your choice when you are ready',
  ],
  excludes: [
    'No legal advice', 'No conveyancing or attorney services', 'No property valuation',
    'No bond/finance approval', 'No payment of attorney/conveyancing fees',
    'HomesConnect never creates a binding sale and never holds deposits',
  ],
  duration: 'Active for as long as your listing remains active. Once-off fee — no recurring billing.',
  refund: 'Because the service is activated and performance begins immediately on your request, the fee is non-refundable once activated. If activation fails (payment captured but the add-on not enabled), the fee is refunded in full.',
  privacy: 'Buyer proposals are stored privately and accessed only via authenticated processes — never published. We never send banking details.',
  conduct: 'HomesConnect does not act as your estate agent, negotiate on your behalf, recommend terms, hold deposits, or earn commission.',
};

// Public gate (reversible) — mirrors the server MAO_PUBLIC_ENABLED. When false, the
// buyer button + seller enable path are hidden on REAL listings; demo listings
// (HCDEMO*) stay fully functional. Default enabled unless explicitly 'false'.
export const MAO_PUBLIC_ENABLED = import.meta.env.VITE_MAO_PUBLIC_ENABLED !== 'false';
export function isDemoListing(id: string): boolean {
  return /^HCDEMO/i.test(id || '');
}
export function maoAllowed(id: string): boolean {
  return MAO_PUBLIC_ENABLED || isDemoListing(id);
}

// "Make an Offer" — language discipline (shown verbatim at every stage).
export const NONBINDING_NOTICE =
  'This online process does not create a binding sale of immovable property. It records ' +
  'proposed terms for discussion. A sale becomes binding only once the parties sign a ' +
  'written Offer to Purchase that complies with South African law.';
export const FRAUD_NOTICE =
  'HomesConnect will never send banking details. Verify all payment instructions directly ' +
  'with the conveyancer using independently confirmed contact details.';

// Shown verbatim on both the directory page and the submission form.
export const CONVEYANCER_DISCLAIMER =
  'This directory is provided by TownConnect as a free public service. Listings are not ' +
  'endorsements. TownConnect does not receive payment for any listing and is not involved ' +
  'in your dealings with any conveyancer. Please verify a conveyancer’s credentials and ' +
  'standing with the Legal Practice Council before instructing them.';

export const PROVINCES = [
  'Gauteng',
  'Western Cape',
  'KwaZulu-Natal',
  'Limpopo',
  'Eastern Cape',
  'Free State',
  'North West',
  'Mpumalanga',
  'Northern Cape',
];
