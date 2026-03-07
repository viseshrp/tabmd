export function getDashboardUrl(): string {
  return chrome.runtime.getURL('tabmd.html');
}

