// Create/verify an unsigned upload preset for the HomesConnect listing form.
// Idempotent — if it already exists, the script verifies and exits 0.

const path = require('path');
const fs = require('fs');
const https = require('https');

const cloudinary = require(path.join('C:/Users/Admin/Desktop/Askari-Photo/node_modules', 'cloudinary')).v2;

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

const PRESET_NAME = 'homesconnect_listings';
const TARGET = {
  unsigned: true,
  folder: 'homesconnect/user-uploads',
  allowed_formats: 'jpg,jpeg,png,webp',
  max_file_size: 10 * 1024 * 1024,
  tags: 'homesconnect,listing-upload',
};

(async () => {
  try {
    // Try fetching first — if it exists, ensure it's unsigned.
    let existing = null;
    try {
      existing = await cloudinary.api.upload_preset(PRESET_NAME);
    } catch (err) {
      const code = err.error?.http_code || err.http_code;
      const msg = err.error?.message || err.message || '';
      if (code !== 404 && !String(msg).toLowerCase().includes("can't find")) throw err;
    }

    if (existing) {
      console.log('Preset exists:', existing.name, 'unsigned:', existing.unsigned, 'folder:', existing.settings?.folder);
      if (!existing.unsigned) {
        console.log('Updating to unsigned...');
        await cloudinary.api.update_upload_preset(PRESET_NAME, TARGET);
        console.log('Updated.');
      }
    } else {
      console.log('Creating preset:', PRESET_NAME);
      const created = await cloudinary.api.create_upload_preset({
        name: PRESET_NAME,
        ...TARGET,
      });
      console.log('Created:', created.name);
    }

    console.log('\n✓ Preset ready:', PRESET_NAME);
    console.log('  Upload URL: https://api.cloudinary.com/v1_1/' + process.env.CLOUDINARY_CLOUD_NAME + '/image/upload');
    console.log('  upload_preset:', PRESET_NAME);
  } catch (err) {
    console.error('FAILED:', err.message || err);
    if (err.error) console.error(JSON.stringify(err.error, null, 2));
    process.exit(1);
  }
})();
