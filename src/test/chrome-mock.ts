// Chrome API mock for testing
/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from 'vitest';

interface MockListener {
  callback: (...args: any[]) => void;
}

class MockEvent<T extends (...args: any[]) => void> {
  private listeners: MockListener[] = [];

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

  trigger(...args: Parameters<T>): void {
    this.listeners.forEach((l) => l.callback(...args));
  }

  clear(): void {
    this.listeners = [];
  }
}

export class ChromeMock {
  // Internal storage map for chrome.storage.local
  private storageData: Record<string, any> = {};

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
    get: vi.fn(),
    move: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    query: vi.fn(),
  };

  windows = {
    onCreated: new MockEvent<(window: chrome.windows.Window) => void>(),
    onRemoved: new MockEvent<(windowId: number) => void>(),
    create: vi.fn(),
    get: vi.fn(),
  };

  runtime = {
    onMessage: new MockEvent<
      (
        message: any,
        sender: chrome.runtime.MessageSender,
        sendResponse: (response?: any) => void,
      ) => boolean | void
    >(),
    sendMessage: vi.fn(() => Promise.resolve()),
    getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
    lastError: undefined,
  };

  sidePanel = {
    setOptions: vi.fn(),
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
        const result: Record<string, any> = {};
        keys.forEach((key) => {
          if (key in this.storageData) {
            result[key] = this.storageData[key];
          }
        });
        return Promise.resolve(result);
      }),
      set: vi.fn((items: Record<string, any>) => {
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
    onChanged: new MockEvent<
      (
        changes: { [key: string]: chrome.storage.StorageChange },
        areaName: string,
      ) => void
    >(),
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
    this.storage.onChanged.clear();

    // Clear storage data
    this.storageData = {};

    // Reset mock implementations
    this.runtime.sendMessage.mockImplementation(() => Promise.resolve());
    this.runtime.lastError = undefined;
  }
}

// Create a singleton mock instance
export const chromeMock = new ChromeMock();

// Setup global chrome object
(globalThis as any).chrome = chromeMock;
