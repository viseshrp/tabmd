// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createSnackbarNotifier } from '../../entrypoints/ui/notifications';

describe('snackbar notifier', () => {
  it('writes text and applies the show class', () => {
    vi.useFakeTimers();
    const element = document.createElement('div');
    const notifier = createSnackbarNotifier(element, 100);

    notifier.notify('Saved');

    expect(element.textContent).toBe('Saved');
    expect(element.classList.contains('show')).toBe(true);

    vi.advanceTimersByTime(100);
    expect(element.classList.contains('show')).toBe(false);
    vi.useRealTimers();
  });
});
