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
