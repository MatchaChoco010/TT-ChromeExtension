import type { Mock } from 'vitest';
import type { StorageChanges, UserSettings, TreeState } from '@/types';

export interface MockStorageLocal {
  get: Mock<(keys?: string | string[] | null) => Promise<Record<string, unknown>>>;
  set: Mock<(items: Record<string, unknown>) => Promise<void>>;
  remove: Mock<(keys: string | string[]) => Promise<void>>;
  clear: Mock<() => Promise<void>>;
}

export interface MockStorageOnChanged {
  addListener: Mock<(callback: (changes: StorageChanges, areaName: string) => void) => void>;
  removeListener: Mock<(callback: (changes: StorageChanges, areaName: string) => void) => void>;
}

export interface MockStorage {
  local: MockStorageLocal;
  onChanged: MockStorageOnChanged;
}

export interface MockTabsEvents {
  addListener: Mock;
  removeListener: Mock;
}

export interface MockTabs {
  get: Mock<(tabId: number) => Promise<chrome.tabs.Tab | null>>;
  query: Mock<(queryInfo: chrome.tabs.QueryInfo) => Promise<chrome.tabs.Tab[]>>;
  update: Mock<(tabId: number, updateProperties: chrome.tabs.UpdateProperties) => Promise<chrome.tabs.Tab | null>>;
  move: Mock<(tabIds: number | number[], moveProperties: chrome.tabs.MoveProperties) => Promise<chrome.tabs.Tab | chrome.tabs.Tab[]>>;
  remove: Mock<(tabIds: number | number[]) => Promise<void>>;
  create: Mock<(createProperties: chrome.tabs.CreateProperties) => Promise<chrome.tabs.Tab>>;
  duplicate: Mock<(tabId: number) => Promise<chrome.tabs.Tab | undefined>>;
  reload: Mock<(tabId?: number) => Promise<void>>;
  onCreated: MockTabsEvents;
  onRemoved: MockTabsEvents;
  onMoved: MockTabsEvents;
  onUpdated: MockTabsEvents;
  onActivated: MockTabsEvents;
}

export interface MockWindows {
  get: Mock<(windowId: number, getInfo?: { populate?: boolean; windowTypes?: string[] }) => Promise<chrome.windows.Window>>;
  getCurrent: Mock<() => Promise<chrome.windows.Window>>;
  create: Mock<(createData?: chrome.windows.CreateData) => Promise<chrome.windows.Window>>;
  onCreated: MockTabsEvents;
  onRemoved: MockTabsEvents;
}

export interface MockRuntimeOnMessage {
  addListener: Mock<(callback: (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response?: unknown) => void) => boolean | void) => void>;
  removeListener: Mock;
}

export interface MockRuntime {
  sendMessage: Mock<(message: unknown) => Promise<unknown>>;
  getURL: Mock<(path: string) => string>;
  onMessage: MockRuntimeOnMessage;
  lastError?: chrome.runtime.LastError;
}

export interface MockSidePanel {
  open: Mock<(options?: { windowId?: number }) => Promise<void>>;
  getOptions: Mock<() => Promise<{ enabled: boolean }>>;
  setOptions: Mock<(options: { enabled?: boolean }) => Promise<void>>;
}

export interface MockAlarms {
  create: Mock<(name: string, alarmInfo: chrome.alarms.AlarmCreateInfo) => void>;
  clear: Mock<(name: string) => Promise<boolean>>;
  get: Mock<(name: string) => Promise<chrome.alarms.Alarm | undefined>>;
  onAlarm: MockTabsEvents;
}

export interface MockChrome {
  storage: MockStorage;
  tabs: MockTabs;
  windows: MockWindows;
  runtime: MockRuntime;
  sidePanel: MockSidePanel;
  alarms?: MockAlarms;
}

export interface MockStorageData {
  user_settings?: UserSettings;
  tree_state?: TreeState;
  unread_tabs?: number[];
  groups?: Record<string, { id: string; name: string; color: string; isExpanded: boolean }>;
}

export type StorageChangeListener = (changes: StorageChanges, areaName: string) => void;

export type MessageListener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => boolean | void;

export function getMockChrome(): MockChrome {
  return globalThis.chrome as unknown as MockChrome;
}

export function getMockedFn<T extends (...args: unknown[]) => unknown>(fn: T): Mock<T> {
  return fn as unknown as Mock<T>;
}

export interface MockSnapshotManager {
  getSnapshots: Mock<() => Promise<import('@/types').Snapshot[]>>;
  createSnapshot: Mock<(name: string, isAutoSave?: boolean) => Promise<import('@/types').Snapshot>>;
  restoreSnapshot: Mock<(snapshotId: string) => Promise<void>>;
  deleteSnapshot: Mock<(snapshotId: string) => Promise<void>>;
  exportSnapshot: Mock<(snapshotId: string) => Promise<string>>;
  importSnapshot: Mock<(jsonData: string) => Promise<import('@/types').Snapshot>>;
}

export interface MockIndexedDBService {
  deleteOldSnapshots: Mock<(keepCount: number) => Promise<void>>;
  saveSnapshot?: Mock<(snapshot: import('@/types').Snapshot) => Promise<void>>;
  getSnapshot?: Mock<(id: string) => Promise<import('@/types').Snapshot | null>>;
  getAllSnapshots?: Mock<() => Promise<import('@/types').Snapshot[]>>;
  deleteSnapshot?: Mock<(id: string) => Promise<void>>;
}
