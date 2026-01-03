// Chrome API mock for testing
import { vi } from 'vitest';

/**
 * Generic callback function type for Chrome API events.
 * Uses 'never[]' for args to allow any callback signature to be assigned.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GenericCallback = (...args: any[]) => unknown;

interface MockListener<T extends GenericCallback> {
  callback: T;
}

class MockEvent<T extends GenericCallback> {
  private listeners: MockListener<T>[] = [];

  addListener(callback: T): void {
    this.listeners.push({ callback });
  }

  removeListener(callback: T): void {
    const index = this.listeners.findIndex((l) => l.callback === callback);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  hasListener(callback: T): boolean {
    return this.listeners.some((l) => l.callback === callback);
  }

  hasListeners(): boolean {
    return this.listeners.length > 0;
  }

  trigger(...args: Parameters<T>): void {
    this.listeners.forEach((l) => l.callback(...args));
  }

  clear(): void {
    this.listeners = [];
  }
}

export class ChromeMock {
  // Internal storage map for chrome.storage.local
  private storageData: Record<string, unknown> = {};

  tabs = {
    onCreated: new MockEvent<(tab: chrome.tabs.Tab) => void>(),
    onRemoved: new MockEvent<
      (tabId: number, removeInfo: chrome.tabs.TabRemoveInfo) => void
    >(),
    onMoved: new MockEvent<
      (tabId: number, moveInfo: chrome.tabs.TabMoveInfo) => void
    >(),
    onUpdated: new MockEvent<
      (
        tabId: number,
        changeInfo: chrome.tabs.TabChangeInfo,
        tab: chrome.tabs.Tab,
      ) => void
    >(),
    onActivated: new MockEvent<
      (activeInfo: chrome.tabs.TabActiveInfo) => void
    >(),
    get: vi.fn<(tabId: number) => Promise<chrome.tabs.Tab | null>>(() => Promise.resolve(null)),
    move: vi.fn<(tabIds: number | number[], moveProperties: chrome.tabs.MoveProperties) => Promise<chrome.tabs.Tab | chrome.tabs.Tab[]>>(() => Promise.resolve([] as chrome.tabs.Tab[])),
    update: vi.fn<(tabId: number, updateProperties: chrome.tabs.UpdateProperties) => Promise<chrome.tabs.Tab | null>>(() => Promise.resolve(null)),
    remove: vi.fn<(tabIds: number | number[]) => Promise<void>>(() => Promise.resolve()),
    query: vi.fn<(queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>>(() => Promise.resolve([])),
    duplicate: vi.fn<(tabId: number) => Promise<chrome.tabs.Tab | undefined>>(() => Promise.resolve(undefined)),
    reload: vi.fn<(tabId?: number) => Promise<void>>(() => Promise.resolve()),
    create: vi.fn<(createProperties: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>>(() => Promise.resolve({} as chrome.tabs.Tab)),
  };

  windows = {
    onCreated: new MockEvent<(window: chrome.windows.Window) => void>(),
    onRemoved: new MockEvent<(windowId: number) => void>(),
    create: vi.fn<(createData?: chrome.windows.CreateData) => Promise<chrome.windows.Window>>(() => Promise.resolve({} as chrome.windows.Window)),
    get: vi.fn<(windowId: number, getInfo?: { populate?: boolean }) => Promise<chrome.windows.Window>>(() => Promise.resolve({} as chrome.windows.Window)),
    getCurrent: vi.fn<(getInfo?: { populate?: boolean }) => Promise<chrome.windows.Window>>(() => Promise.resolve({ id: 1 } as chrome.windows.Window)),
    remove: vi.fn<(windowId: number) => Promise<void>>(() => Promise.resolve()),
  };

  runtime = {
    onMessage: new MockEvent<
      (
        message: Record<string, unknown>,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: unknown) => void,
      ) => boolean | void
    >(),
    sendMessage: vi.fn<(message: unknown) => Promise<unknown>>(() => Promise.resolve()),
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    lastError: undefined as chrome.runtime.LastError | undefined,
  };

  sidePanel = {
    open: vi.fn(() => Promise.resolve()),
    getOptions: vi.fn(() => Promise.resolve({ enabled: true })),
    setOptions: vi.fn(() => Promise.resolve()),
  };

  storage = {
    local: {
      get: vi.fn((keys?: string | string[] | null) => {
        if (!keys) {
          return Promise.resolve({ ...this.storageData });
        }
        if (typeof keys === 'string') {
          return Promise.resolve(
            keys in this.storageData
              ? { [keys]: this.storageData[keys] }
              : {},
          );
        }
        const result: Record<string, unknown> = {};
        keys.forEach((key) => {
          if (key in this.storageData) {
            result[key] = this.storageData[key];
          }
        });
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, unknown>) => {
        Object.assign(this.storageData, items);
        return Promise.resolve();
      }),
      remove: vi.fn((keys: string | string[]) => {
        const keysArray = typeof keys === 'string' ? [keys] : keys;
        keysArray.forEach((key) => {
          delete this.storageData[key];
        });
        return Promise.resolve();
      }),
      clear: vi.fn(() => {
        this.storageData = {};
        return Promise.resolve();
      }),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  };

  clearAllListeners(): void {
    this.tabs.onCreated.clear();
    this.tabs.onRemoved.clear();
    this.tabs.onMoved.clear();
    this.tabs.onUpdated.clear();
    this.tabs.onActivated.clear();
    this.windows.onCreated.clear();
    this.windows.onRemoved.clear();
    this.runtime.onMessage.clear();
    this.storage.onChanged.addListener.mockClear();
    this.storage.onChanged.removeListener.mockClear();

    // Clear storage data
    this.storageData = {};

    // Reset mock implementations
    this.runtime.sendMessage.mockImplementation(() => Promise.resolve());
    this.runtime.lastError = undefined;

    // Re-apply storage mock implementations (may be cleared by vi.clearAllMocks())
    this.storage.local.get.mockImplementation((keys?: string | string[] | null) => {
      if (!keys) {
        return Promise.resolve({ ...this.storageData });
      }
      if (typeof keys === 'string') {
        return Promise.resolve(
          keys in this.storageData
            ? { [keys]: this.storageData[keys] }
            : {},
        );
      }
      const result: Record<string, unknown> = {};
      keys.forEach((key) => {
        if (key in this.storageData) {
          result[key] = this.storageData[key];
        }
      });
      return Promise.resolve(result);
    });

    this.storage.local.set.mockImplementation((items: Record<string, unknown>) => {
      Object.assign(this.storageData, items);
      return Promise.resolve();
    });

    this.storage.local.remove.mockImplementation((keys: string | string[]) => {
      const keysArray = typeof keys === 'string' ? [keys] : keys;
      keysArray.forEach((key) => {
        delete this.storageData[key];
      });
      return Promise.resolve();
    });

    this.storage.local.clear.mockImplementation(() => {
      this.storageData = {};
      return Promise.resolve();
    });
  }
}

// Create a singleton mock instance
export const chromeMock = new ChromeMock();

// Setup global chrome object using vitest's stubGlobal
// This properly handles type conflicts with @types/chrome
vi.stubGlobal('chrome', chromeMock);
