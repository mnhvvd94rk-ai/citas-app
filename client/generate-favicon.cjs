// Genera los PNG del favicon/PWA a partir de public/kohtun-logo.svg.
// Uso: node generate-favicon.cjs   (desde client/)
const sharp = require('sharp');
const fs = require('fs');

const svg = fs.readFileSync('./public/kohtun-logo.svg', 'utf8');

sharp(Buffer.from(svg))
  .png()
  .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toFile('./public/kohtun-192x192.png')
  .then(() => console.log('✓ kohtun-192x192.png creado'))
  .catch((err) => console.error('Error 192:', err));

sharp(Buffer.from(svg))
  .png()
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toFile('./public/kohtun-512x512.png')
  .then(() => console.log('✓ kohtun-512x512.png creado'))
  .catch((err) => console.error('Error 512:', err));
