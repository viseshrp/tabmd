export type ThemeMode = 'os' | 'light' | 'dark';

export type TabmdSettings = {
  theme: ThemeMode;
  openInNewTab: boolean;
  compactCards: boolean;
};

export type ResourceItem = {
  id: string;
  title: string;
  url: string;
  summary: string;
  tags: string[];
  savedAt: number;
};

export type WorkspaceCollection = {
  id: string;
  title: string;
  description: string;
  createdAt: number;
  items: ResourceItem[];
};

export const STORAGE_KEYS = {
  settings: 'tabmd:settings',
  collections: 'tabmd:collections'
} as const;

export const DEFAULT_SETTINGS: TabmdSettings = {
  theme: 'os',
  openInNewTab: true,
  compactCards: false
};

export function normalizeSettings(value: unknown): TabmdSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;
  const raw = value as Partial<TabmdSettings>;
  return {
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'os',
    openInNewTab: typeof raw.openInNewTab === 'boolean' ? raw.openInNewTab : DEFAULT_SETTINGS.openInNewTab,
    compactCards: typeof raw.compactCards === 'boolean' ? raw.compactCards : DEFAULT_SETTINGS.compactCards
  };
}

export async function readSettings(): Promise<TabmdSettings> {
  const result = await chrome.storage.local.get({ [STORAGE_KEYS.settings]: DEFAULT_SETTINGS });
  return normalizeSettings(result[STORAGE_KEYS.settings]);
}

export async function writeSettings(settings: TabmdSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}

export async function readCollections(): Promise<WorkspaceCollection[]> {
  const result = await chrome.storage.local.get({ [STORAGE_KEYS.collections]: [] });
  const collections = result[STORAGE_KEYS.collections];
  return Array.isArray(collections) ? (collections as WorkspaceCollection[]) : [];
}

export async function writeCollections(collections: WorkspaceCollection[]): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.collections]: collections });
}

export async function ensureCollections(): Promise<WorkspaceCollection[]> {
  return readCollections();
}
