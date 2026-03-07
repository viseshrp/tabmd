export function createSnackbarNotifier(element: HTMLElement | null, duration = 2400) {
  let timeoutId = 0;

  return {
    notify(message: string) {
      if (!element) return;
      element.textContent = message;
      element.classList.add('show');
      window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        element.classList.remove('show');
      }, duration);
    }
  };
}
