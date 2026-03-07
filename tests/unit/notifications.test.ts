// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createSnackbarNotifier } from '../../entrypoints/ui/notifications';

describe('snackbar notifier branches', () => {
  it('returns early when no element is provided', () => {
    expect(() => createSnackbarNotifier(null).notify('Hello')).not.toThrow();
  });

  it('clears an existing timeout before showing a new message', () => {
    const element = document.createElement('div');
    const clearSpy = vi.spyOn(window, 'clearTimeout');
    const notifier = createSnackbarNotifier(element, 10);

    notifier.notify('One');
    notifier.notify('Two');

    expect(clearSpy).toHaveBeenCalled();
    expect(element.textContent).toBe('Two');
    clearSpy.mockRestore();
  });
});
