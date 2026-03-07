import { chromium, expect, test } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), '.output', 'chrome-mv3-e2e');

test('loads new tab and options pages from the built extension', async () => {
  if (!existsSync(extensionPath)) {
    throw new Error('Extension build not found. Run `pnpm build:e2e` before e2e tests.');
  }

  const context = await chromium.launchPersistentContext('', {
    headless: process.env.PW_HEADLESS === 'true',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  const background = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(background.url()).host;
  const newtab = await context.newPage();
  const options = await context.newPage();

  await newtab.goto(`chrome-extension://${extensionId}/newtab.html`);
  await options.goto(`chrome-extension://${extensionId}/options.html`);

  await expect(newtab.locator('h1')).toContainText('TabMD E2E New Tab');
  await expect(options.locator('h1')).toContainText('TabMD E2E Settings');

  await context.close();
});
