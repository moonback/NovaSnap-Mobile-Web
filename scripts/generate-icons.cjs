const sharp = require('sharp');
const path = require('path');

const SRC = path.resolve(__dirname, '..', 'public', 'logo.png');
const OUT = path.resolve(__dirname, '..', 'public', 'icons');

async function main() {
  const sizes = [48, 72, 96, 128, 144, 192, 256, 384, 512];

  // Standard icons
  for (const s of sizes) {
    await sharp(SRC)
      .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(OUT, `icon-${s}.png`));
    console.log(`✓ icon-${s}.png`);
  }

  // Maskable icons (with safe-zone padding on dark bg)
  for (const s of [192, 512]) {
    const pad = Math.round(s * 0.1);
    await sharp(SRC)
      .resize(s - pad * 2, s - pad * 2, { fit: 'contain', background: { r: 10, g: 10, b: 15, alpha: 255 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 10, g: 10, b: 15, alpha: 255 } })
      .png()
      .toFile(path.join(OUT, `icon-${s}-maskable.png`));
    console.log(`✓ icon-${s}-maskable.png`);
  }

  // Badge
  await sharp(SRC)
    .resize(72, 72, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(OUT, 'badge-72.png'));
  console.log('✓ badge-72.png');

  // Apple touch icon (180x180)
  await sharp(SRC)
    .resize(180, 180, { fit: 'contain', background: { r: 10, g: 10, b: 15, alpha: 255 } })
    .png()
    .toFile(path.join(OUT, 'apple-touch-icon.png'));
  console.log('✓ apple-touch-icon.png');

  // Favicon 32x32
  await sharp(SRC)
    .resize(32, 32, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(OUT, 'favicon-32.png'));
  console.log('✓ favicon-32.png');

  // Favicon 16x16
  await sharp(SRC)
    .resize(16, 16, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(path.join(OUT, 'favicon-16.png'));
  console.log('✓ favicon-16.png');

  console.log('\n🎉 All icons generated!');
}

main().catch(console.error);
