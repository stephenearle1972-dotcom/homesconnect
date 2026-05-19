// Generate the WhatsApp QR code as an SVG so the bundler can import it as a string.
// Runs before `vite build` (npm script "build" hooks this in via prebuild).

const fs = require('fs');
const path = require('path');
const QR = require('qrcode');

const URL = 'https://wa.me/27767959872';
const OUT = path.join(__dirname, '..', 'public', 'whatsapp-qr.svg');

QR.toString(URL, {
  type: 'svg',
  errorCorrectionLevel: 'Q',
  margin: 1,
  color: {
    dark: '#0d1b12',
    light: '#FFFFFF',
  },
}, (err, svg) => {
  if (err) { console.error(err); process.exit(1); }
  fs.writeFileSync(OUT, svg);
  console.log('QR code written:', OUT, '(', svg.length, 'bytes )');
});
