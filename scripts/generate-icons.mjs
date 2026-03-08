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
  <defs>
    <linearGradient id="bg" x1="20" y1="10" x2="108" y2="118" gradientUnits="userSpaceOnUse">
      <stop stop-color="#E8F0FE"/>
      <stop offset="1" stop-color="#C6DAFC"/>
    </linearGradient>
    <linearGradient id="tab" x1="21" y1="20" x2="104" y2="95" gradientUnits="userSpaceOnUse">
      <stop stop-color="#42A5F5"/>
      <stop offset="1" stop-color="#1565C0"/>
    </linearGradient>
    <filter id="shadow" x="12" y="10" width="104" height="110" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB">
      <feFlood flood-opacity="0" result="BackgroundImageFix"/>
      <feColorMatrix in="SourceAlpha" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
      <feOffset dy="4"/>
      <feGaussianBlur stdDeviation="4"/>
      <feColorMatrix values="0 0 0 0 0.0784314 0 0 0 0 0.219608 0 0 0 0 0.45098 0 0 0 0.22 0"/>
      <feBlend in2="BackgroundImageFix" result="effect1_dropShadow_1_1"/>
      <feBlend in="SourceGraphic" in2="effect1_dropShadow_1_1" result="shape"/>
    </filter>
  </defs>

  <rect x="8" y="8" width="112" height="112" rx="28" fill="url(#bg)"/>

  <g filter="url(#shadow)">
    <path d="M21 35C21 27.8203 26.8203 22 34 22H50.8C54.1937 22 57.4485 23.3482 59.8489 25.7486L65.2 31.1C67.6004 33.5003 70.8551 34.8485 74.2488 34.8485H94C101.18 34.8485 107 40.6688 107 47.8485V51H21V35Z" fill="url(#tab)"/>
    <path d="M21 47.5H107V91C107 98.1797 101.18 104 94 104H34C26.8203 104 21 98.1797 21 91V47.5Z" fill="#FFFDF9"/>
    <path d="M77 34.8485H94C101.18 34.8485 107 40.6688 107 47.8485V51H92C83.7157 51 77 44.2843 77 36V34.8485Z" fill="#90CAF9"/>
  </g>

  <g transform="translate(33 55)">
    <rect x="0.75" y="0.75" width="60.5" height="35.5" rx="7.25" fill="#FFFFFF" stroke="#263238" stroke-width="1.5"/>
    <path d="M8 28V10.5L16.5 18.5L25 10.5V28" stroke="#263238" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M34 10H50V18" stroke="#263238" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M42 10V27" stroke="#263238" stroke-width="4" stroke-linecap="round"/>
    <path d="M34 27H50" stroke="#263238" stroke-width="4" stroke-linecap="round"/>
    <path d="M45 22L50 27L55 22" stroke="#263238" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
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
