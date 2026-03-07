// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createMockChrome, setMockChrome } from '../helpers/mock_chrome';

describe('options entrypoint', () => {
  it('initializes the settings page module', async () => {
    const mock = createMockChrome();
    setMockChrome(mock);

    document.body.innerHTML = `
      <input type="radio" name="theme" value="os" checked />
      <input type="radio" name="theme" value="light" />
      <input type="radio" name="theme" value="dark" />
      <div id="snackbar"></div>
    `;

    await import('../../entrypoints/options/settings_page');

    expect(document.querySelector('input[name="theme"]')).not.toBeNull();
  });
});
