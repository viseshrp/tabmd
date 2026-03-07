import type { ResourceItem } from '../shared/storage';

export async function openResource(item: ResourceItem, _openInNewTab: boolean): Promise<void> {
  await chrome.tabs.create({ url: item.url, active: true });
}

