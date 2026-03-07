export async function openDashboardTab(): Promise<void> {
  const dashboardUrl = chrome.runtime.getURL('tabmd.html');
  const existingTabs = await chrome.tabs.query({ url: dashboardUrl });
  const existingTab = existingTabs[0];

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { active: true });
    if (typeof existingTab.windowId === 'number') {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    return;
  }

  await chrome.tabs.create({ url: dashboardUrl, active: true });
}

