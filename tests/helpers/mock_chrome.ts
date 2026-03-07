type StorageValue = unknown;
type StorageRecord = Record<string, StorageValue>;
type StorageGetKeys = string | string[] | StorageRecord | null | undefined;
type StorageListener = (
  changes: Record<string, { oldValue?: unknown; newValue?: unknown }>,
  areaName: 'local' | 'sync' | 'managed' | 'session',
) => void;

export type MockChrome = {
  runtime: {
    getURL: (path: string) => string;
  };
  action: {
    onClicked: {
      addListener: (handler: (...args: unknown[]) => void) => void;
      __listeners: Array<(...args: unknown[]) => void>;
    };
  };
  storage: {
    local: {
      get: (keys: StorageGetKeys) => Promise<StorageRecord>;
      set: (payload: StorageRecord) => Promise<void>;
    };
    onChanged: {
      addListener: (listener: StorageListener) => void;
    };
  };
  tabs: {
    query: (queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>;
    update: (tabId: number, updateProperties: chrome.tabs.UpdateProperties) => Promise<chrome.tabs.Tab>;
    create: (createProperties: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>;
  };
  windows: {
    update: (windowId: number, updateInfo: chrome.windows.UpdateInfo) => Promise<chrome.windows.Window>;
  };
};

export function setMockChrome(mockChrome: MockChrome): void {
  Object.defineProperty(globalThis, 'chrome', {
    value: mockChrome,
    configurable: true,
    writable: true,
  });
}

export function setMockDefineBackground(handler: (callback: () => void) => void): void {
  Object.defineProperty(globalThis, 'defineBackground', {
    value: handler,
    configurable: true,
    writable: true,
  });
}

export function createMockChrome(options?: { initialStorage?: StorageRecord }): MockChrome {
  const storageData: StorageRecord = { ...(options?.initialStorage ?? {}) };
  const actionListeners: Array<(...args: unknown[]) => void> = [];
  const storageListeners = new Set<StorageListener>();

  return {
    runtime: {
      getURL: (path: string) => `chrome-extension://mock/${path}`,
    },
    action: {
      onClicked: {
        addListener: (handler) => {
          actionListeners.push(handler);
        },
        __listeners: actionListeners,
      },
    },
    storage: {
      local: {
        async get(keys: StorageGetKeys) {
          if (typeof keys === 'string') return { [keys]: storageData[keys] };
          if (Array.isArray(keys)) {
            const result: StorageRecord = {};
            for (const key of keys) result[key] = storageData[key];
            return result;
          }
          if (keys && typeof keys === 'object') {
            const result: StorageRecord = {};
            for (const key of Object.keys(keys)) {
              result[key] = storageData[key] ?? (keys as StorageRecord)[key];
            }
            return result;
          }
          return { ...storageData };
        },
        async set(payload: StorageRecord) {
          const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
          for (const [key, value] of Object.entries(payload)) {
            changes[key] = { oldValue: storageData[key], newValue: value };
            storageData[key] = value;
          }
          for (const listener of storageListeners) listener(changes, 'local');
        },
      },
      onChanged: {
        addListener: (listener) => {
          storageListeners.add(listener);
        },
      },
    },
    tabs: {
      async query() {
        return [];
      },
      async update(tabId: number, updateProperties: chrome.tabs.UpdateProperties) {
        return { id: tabId, windowId: 1, ...updateProperties } as chrome.tabs.Tab;
      },
      async create(createProperties: chrome.tabs.CreateProperties) {
        return { id: 1, windowId: 1, url: createProperties.url } as chrome.tabs.Tab;
      },
    },
    windows: {
      async update(windowId: number) {
        return { id: windowId, focused: true } as chrome.windows.Window;
      },
    },
  };
}
