// Ad-hoc probe: is Cloud Vision enabled, and does SafeSearch return on a Cloudinary URL?
// Usage: GOOGLE_SHEETS_CREDENTIALS="$(...)" node scripts/test-vision.mjs <imageUrl>
import { moderateImages } from '../netlify/functions/_lib/vision.js';

const url = process.argv[2] || 'https://res.cloudinary.com/dkn6tnxao/image/upload/v1780501579/homesconnect/user-uploads/suxdygbyshz8pp3mynoq.jpg';
const out = await moderateImages([url]);
console.log(JSON.stringify(out, null, 2));
