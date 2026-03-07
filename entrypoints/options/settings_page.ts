import { createSnackbarNotifier } from '../ui/notifications';
import { readSettings, writeSettings, type ThemeMode } from '../shared/storage';

export async function initSettingsPage(): Promise<void> {
  const snackbar = createSnackbarNotifier(document.querySelector('#snackbar'));
  const settings = await readSettings();

  const openInNewTabEl = document.querySelector<HTMLInputElement>('#openInNewTab');
  const compactCardsEl = document.querySelector<HTMLInputElement>('#compactCards');
  const themeEls = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="theme"]'));

  if (!openInNewTabEl || !compactCardsEl || themeEls.length === 0) return;

  const openInNewTab = openInNewTabEl;
  const compactCards = compactCardsEl;

  openInNewTab.checked = settings.openInNewTab;
  compactCards.checked = settings.compactCards;
  for (const input of themeEls) input.checked = input.value === settings.theme;

  async function persist(): Promise<void> {
    const selectedTheme = (themeEls.find((input) => input.checked)?.value ?? 'os') as ThemeMode;
    await writeSettings({
      openInNewTab: openInNewTab.checked,
      compactCards: compactCards.checked,
      theme: selectedTheme
    });
    snackbar.notify('Settings saved.');
  }

  openInNewTab.addEventListener('change', () => void persist());
  compactCards.addEventListener('change', () => void persist());
  for (const input of themeEls) input.addEventListener('change', () => void persist());
}
