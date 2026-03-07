import { createSnackbarNotifier } from '../ui/notifications';
import { readSettings, writeSettings, type TabmdSettings, type ThemeMode } from '../shared/storage';
import { logExtensionError } from '../shared/utils';

let notify: ReturnType<typeof createSnackbarNotifier>;
let currentSettings: TabmdSettings;

function applyThemeToPage(theme: ThemeMode) {
  if (theme === 'os') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

async function saveCurrentSettings(newSettingsContent: Partial<TabmdSettings>) {
  try {
    const updated = { ...currentSettings, ...newSettingsContent };

    await writeSettings(updated);
    currentSettings = updated;

    // Immediately apply theme visual
    applyThemeToPage(currentSettings.theme);

    if (notify) {
      notify.notify('Settings saved');
    }
  } catch (err: unknown) {
    logExtensionError('Failed to save settings', err, 'options_page');
  }
}

function initThemeControls() {
  const themeRadios = Array.from(document.querySelectorAll<HTMLInputElement>('input[name="theme"]'));

  for (const radio of themeRadios) {
    if (radio.value === currentSettings.theme) {
      radio.checked = true;
    }

    radio.addEventListener('change', () => {
      if (radio.checked) {
        void saveCurrentSettings({ theme: radio.value as ThemeMode });
      }
    });
  }
}

export async function initSettingsPage() {
  try {
    currentSettings = await readSettings();
    applyThemeToPage(currentSettings.theme);

    initThemeControls();

    // Setting up our notification system
    const snackbarEl = document.getElementById('snackbar');
    if (snackbarEl) {
      notify = createSnackbarNotifier(snackbarEl);
    }
  } catch (err: unknown) {
    logExtensionError('Failed to initialize options page', err, 'options_page');
  }
}
