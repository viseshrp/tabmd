import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from '../../entrypoints/shared/storage';

describe('storage helpers', () => {
  it('falls back to defaults for invalid values', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('preserves valid settings', () => {
    expect(
      normalizeSettings({
        theme: 'dark',
        openInNewTab: false,
        compactCards: true,
      }),
    ).toEqual({
      theme: 'dark',
      openInNewTab: false,
      compactCards: true,
    });
  });
});
