import { openDashboardTab } from '../shared/condense';
import { logExtensionError } from '../shared/utils';

export { openDashboardTab };

export function registerActionClickHandler(): void {
  chrome.action.onClicked.addListener(() => {
    void openDashboardTab().catch((error: unknown) => {
      logExtensionError('Failed to open dashboard', error, 'runtime_context');
    });
  });
}

export default defineBackground(() => {
  registerActionClickHandler();
});

