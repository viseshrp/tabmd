// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createMockChrome, setMockChrome } from '../helpers/mock_chrome';

describe('options entrypoint', () => {
  it('initializes the settings page module', async () => {
    const mock = createMockChrome();
    setMockChrome(mock);

    document.body.innerHTML = `
      <input id="openInNewTab" type="checkbox" />
      <input id="compactCards" type="checkbox" />
      <input id="themeOs" type="radio" name="theme" value="os" />
      <input id="themeLight" type="radio" name="theme" value="light" />
      <input id="themeDark" type="radio" name="theme" value="dark" />
      <div id="snackbar"></div>
    `;

    await import('../../entrypoints/options/index');

    expect(document.querySelector('#openInNewTab')).not.toBeNull();
  });
});
