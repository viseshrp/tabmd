import { describe, expect, it } from 'vitest';
import { createMockChrome, setMockChrome, setMockDefineBackground } from '../helpers/mock_chrome';

describe('background entrypoint', () => {
  it('loads without error', async () => {
    const mockChrome = createMockChrome();
    setMockChrome(mockChrome);
    setMockDefineBackground((callback) => callback());

    await import('../../entrypoints/background/index');

    expect(true).toBe(true);
  });
});
