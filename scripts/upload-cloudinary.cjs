// One-shot script to upload the 6 HomesConnect property images to Cloudinary.
// Loads cloudinary from Askari-Photo's node_modules (same Stephen-owned account).

const path = require('path');
const cloudinary = require(path.join('C:/Users/Admin/Desktop/Askari-Photo/node_modules', 'cloudinary')).v2;

// Read env directly so we don't need dotenv.
const fs = require('fs');
const envText = fs.readFileSync('C:/Users/Admin/Desktop/Askari-Photo/.env', 'utf8');
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const DOWNLOADS = 'C:/Users/Admin/Downloads';

// Source filename (May 19, 08:49 set) → Cloudinary public_id.
// (N).png inversely maps to property-NN where higher (N) = lower number.
const UPLOADS = [
  { file: 'ChatGPT Image May 19, 2026, 08_49_55 AM (6).png', publicId: 'homesconnect/property-01-karoo-farmhouse',  desc: 'Karoo/Cape farmhouse' },
  { file: 'ChatGPT Image May 19, 2026, 08_49_55 AM (5).png', publicId: 'homesconnect/property-02-bushveld-lodge',   desc: 'Thatched bushveld lodge with infinity pool' },
  { file: 'ChatGPT Image May 19, 2026, 08_49_54 AM (4).png', publicId: 'homesconnect/property-03-kzn-ocean-modern', desc: 'KZN oceanfront modern' },
  { file: 'ChatGPT Image May 19, 2026, 08_49_54 AM (3).png', publicId: 'homesconnect/property-04-sandton-mansion',  desc: 'Sandton-style modern mansion' },
  { file: 'ChatGPT Image May 19, 2026, 08_49_53 AM (2).png', publicId: 'homesconnect/property-05-cape-dutch',       desc: 'Cape Dutch heritage home' },
  { file: 'ChatGPT Image May 19, 2026, 08_49_53 AM (1).png', publicId: 'homesconnect/property-06-cpt-mountain',     desc: 'Cape Town home with Table Mountain' },
];

(async () => {
  for (const item of UPLOADS) {
    const src = path.join(DOWNLOADS, item.file);
    process.stdout.write(`→ ${item.publicId}  (${item.desc}) ... `);
    try {
      const res = await cloudinary.uploader.upload(src, {
        public_id: item.publicId,
        overwrite: true,
        resource_type: 'image',
        // Cloudinary detects PNG; we store original. Site transforms via URL.
      });
      console.log(`OK  ${res.bytes} bytes`);
    } catch (err) {
      console.log(`FAIL: ${err.message || err}`);
      process.exitCode = 1;
    }
  }
})();
