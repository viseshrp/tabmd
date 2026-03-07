export type ThemeMode = 'os' | 'light' | 'dark';

export type TabmdSettings = {
  theme: ThemeMode;
};

export type NoteRecord = {
  id: string;          // UUID v4
  content: string;     // Raw Markdown
  title: string | null;// null = use first-line derivation
  createdAt: number;   // Unix ms
  modifiedAt: number;  // Unix ms
};

export const STORAGE_KEYS = {
  settings: 'tabmd:settings',
  notes: 'tabmd:notes'
} as const;

export const DEFAULT_SETTINGS: TabmdSettings = {
  theme: 'os'
};

export function normalizeSettings(value: unknown): TabmdSettings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;
  const raw = value as Partial<TabmdSettings>;
  return {
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'os'
  };
}

export async function readSettings(): Promise<TabmdSettings> {
  const result = await chrome.storage.local.get({ [STORAGE_KEYS.settings]: DEFAULT_SETTINGS });
  return normalizeSettings(result[STORAGE_KEYS.settings]);
}

export async function writeSettings(settings: TabmdSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.settings]: settings });
}
