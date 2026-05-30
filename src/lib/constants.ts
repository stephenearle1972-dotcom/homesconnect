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
