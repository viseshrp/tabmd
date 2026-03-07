import { expect, test, chromium } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const extensionPath = resolve(process.cwd(), '.output', 'chrome-mv3-e2e');

test('loads dashboard and options pages from the built extension', async () => {
  if (!existsSync(extensionPath)) {
    throw new Error('Extension build not found. Run `pnpm build:e2e` before e2e tests.');
  }

  const context = await chromium.launchPersistentContext('', {
    headless: process.env.PW_HEADLESS === 'true',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });

  const background = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const extensionId = new URL(background.url()).host;
  const dashboard = await context.newPage();
  const options = await context.newPage();

  await dashboard.goto(`chrome-extension://${extensionId}/tabmd.html`);
  await options.goto(`chrome-extension://${extensionId}/options.html`);

  await expect(dashboard.locator('h1')).toContainText('tabmd');
  await expect(options.locator('h1')).toContainText('tabmd settings');

  await context.close();
});

