import { describe, expect, it, vi } from 'vitest';
import { formatTimestamp, logExtensionError } from '../../entrypoints/shared/utils';

describe('utils', () => {
  it('logs extension errors with the operation prefix', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    logExtensionError('Failed', new Error('boom'), 'storage');

    expect(spy).toHaveBeenCalledWith('[tabmd:storage] Failed', expect.any(Error));
    spy.mockRestore();
  });

  it('formats timestamps using Intl.DateTimeFormat', () => {
    const formatted = formatTimestamp(Date.UTC(2026, 2, 7, 12, 30));
    expect(formatted.length).toBeGreaterThan(0);
  });
});
