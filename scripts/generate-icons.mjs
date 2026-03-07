import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');
const iconDir = resolve(rootDir, 'public/icon');
const svgPath = resolve(iconDir, 'icon.svg');
const sizes = [16, 19, 32, 38, 48, 96, 128];

function buildSvg(size = 128) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128" fill="none">
  <rect x="4" y="4" width="120" height="120" rx="30" fill="#1450D2"/>
  <path d="M18 28C18 21.3726 23.3726 16 30 16H51L62 27H98C104.627 27 110 32.3726 110 39V49H18V28Z" fill="#3B82F6"/>
  <rect x="18" y="27" width="92" height="85" rx="16" fill="#FFFDF7"/>
  <path d="M85 27H94C102.837 27 110 34.1634 110 43V52H85V27Z" fill="#DCEBFF"/>
  <path d="M81 27H94C102.837 27 110 34.1634 110 43V56L81 27Z" fill="#9BC7FF"/>
  <rect x="31" y="44" width="12" height="38" rx="6" fill="#081225"/>
  <rect x="52" y="44" width="12" height="38" rx="6" fill="#081225"/>
  <rect x="20" y="57" width="55" height="12" rx="6" fill="#081225"/>
  <rect x="20" y="76" width="55" height="12" rx="6" fill="#081225"/>
  <rect x="30" y="95" width="68" height="8" rx="4" fill="#2563EB" opacity="0.75"/>
</svg>
`.trim();
}

mkdirSync(iconDir, { recursive: true });
writeFileSync(svgPath, `${buildSvg()}\n`);

const browser = await chromium.launch();

try {
  for (const size of sizes) {
    const page = await browser.newPage({
      deviceScaleFactor: 1,
      viewport: { width: size, height: size }
    });

    await page.setContent(
      `<!doctype html><html><body style="margin:0;background:transparent;overflow:hidden;">${buildSvg(size)}</body></html>`
    );

    await page.screenshot({
      omitBackground: true,
      path: resolve(iconDir, `${size}.png`)
    });

    await page.close();
  }
} finally {
  await browser.close();
}
