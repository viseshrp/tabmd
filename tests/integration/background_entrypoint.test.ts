import { describe, expect, it } from 'vitest';
import { createMockChrome, setMockChrome, setMockDefineBackground } from '../helpers/mock_chrome';

describe('background entrypoint', () => {
  it('registers an action click handler', async () => {
    const mockChrome = createMockChrome();
    setMockChrome(mockChrome);
    setMockDefineBackground((callback) => callback());

    await import('../../entrypoints/background/index');

    expect(mockChrome.action.onClicked.__listeners.length).toBe(1);
  });
});

