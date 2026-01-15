import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '@/test/chrome-mock';
import {
  registerTabEventListeners,
  registerWebNavigationListeners,
  testStorageService,
  testTreeStateManager,
} from './event-handlers';
import { STORAGE_KEYS } from '@/storage/StorageService';
import type { UserSettings } from '@/types';

describe('タブ開き方別の位置ルール', () => {
  beforeEach(async () => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();

    await testStorageService.set(STORAGE_KEYS.TREE_STATE, {
      views: {
        'default-view': {
          info: { id: 'default-view', name: 'デフォルト', color: '#3b82f6' },
          rootNodeIds: [],
          nodes: {},
        },
      },
      viewOrder: ['default-view'],
      currentViewId: 'default-view',
      tabToNode: {},
    });

    testTreeStateManager.resetForTesting();
    await testTreeStateManager.loadState();

    chromeMock.runtime.sendMessage = vi.fn(() => Promise.resolve());
  });

  describe('リンククリックから開かれたタブ', () => {
    it('newTabPositionFromLink が「child」の場合、元のタブの子として配置される', async () => {
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'end',
        newTabPositionFromLink: 'child',
        newTabPositionManual: 'end',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();
      registerWebNavigationListeners();

      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.get.mockImplementation((tabId: number) => {
        if (tabId === 1) return Promise.resolve(parentTab);
        return Promise.resolve(null);
      });
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      chromeMock.webNavigation.onCreatedNavigationTarget.trigger({
        tabId: 2,
        sourceTabId: 1,
        sourceProcessId: 1,
        sourceFrameId: 0,
        url: 'https://example.com/page',
        timeStamp: Date.now(),
      });

      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1,
        url: 'https://example.com/page',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(childTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const parentResult = testTreeStateManager.getNodeByTabId(1);
      const childResult = testTreeStateManager.getNodeByTabId(2);

      expect(parentResult).toBeDefined();
      expect(childResult).toBeDefined();
      expect(childResult?.node.parentId).toBe(parentResult?.node.id);
    });

    it('newTabPositionFromLink が「end」の場合、ツリーの最後に配置される', async () => {
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        newTabPositionFromLink: 'end',
        newTabPositionManual: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();
      registerWebNavigationListeners();

      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.get.mockImplementation((tabId: number) => {
        if (tabId === 1) return Promise.resolve(parentTab);
        return Promise.resolve(null);
      });
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      chromeMock.webNavigation.onCreatedNavigationTarget.trigger({
        tabId: 2,
        sourceTabId: 1,
        sourceProcessId: 1,
        sourceFrameId: 0,
        url: 'https://example.com/page',
        timeStamp: Date.now(),
      });

      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1,
        url: 'https://example.com/page',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(childTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const childResult = testTreeStateManager.getNodeByTabId(2);
      expect(childResult).toBeDefined();
      expect(childResult?.node.parentId).toBeNull();
    });
  });

  describe('手動で開かれたタブ', () => {
    it('newTabPositionManual が「end」の場合、ツリーの最後に配置される', async () => {
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        newTabPositionFromLink: 'child',
        newTabPositionManual: 'end',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();

      const manualTab = {
        id: 1,
        index: 0,
        windowId: 1,
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(manualTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = testTreeStateManager.getNodeByTabId(1);
      expect(result).toBeDefined();
      expect(result?.node.parentId).toBeNull();
    });
  });

  describe('後方互換性', () => {
    it('newTabPositionFromLink/Manual がない場合、既存の newTabPosition 設定を使用', async () => {
      const settings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child' as const,
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote' as const,
        snapshotSubfolder: 'TT-Snapshots',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();
      registerWebNavigationListeners();

      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.get.mockImplementation((tabId: number) => {
        if (tabId === 1) return Promise.resolve(parentTab);
        return Promise.resolve(null);
      });
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      chromeMock.webNavigation.onCreatedNavigationTarget.trigger({
        tabId: 2,
        sourceTabId: 1,
        sourceProcessId: 1,
        sourceFrameId: 0,
        url: 'https://example.com/page',
        timeStamp: Date.now(),
      });

      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1,
        url: 'https://example.com/page',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(childTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const parentResult = testTreeStateManager.getNodeByTabId(1);
      const childResult = testTreeStateManager.getNodeByTabId(2);

      expect(childResult?.node.parentId).toBe(parentResult?.node.id);
    });
  });
});

describe('システムページ判定と新規タブ位置設定', () => {
  beforeEach(async () => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();

    await testStorageService.set(STORAGE_KEYS.TREE_STATE, {
      views: {
        'default-view': {
          info: { id: 'default-view', name: 'デフォルト', color: '#3b82f6' },
          rootNodeIds: [],
          nodes: {},
        },
      },
      viewOrder: ['default-view'],
      currentViewId: 'default-view',
      tabToNode: {},
    });

    testTreeStateManager.resetForTesting();
    await testTreeStateManager.loadState();

    chromeMock.runtime.sendMessage = vi.fn(() => Promise.resolve());
  });

  describe('通常のリンククリックは引き続き子タブとして配置', () => {
    it('http/https ページはwebNavigation経由で検出されれば子タブとして配置される', async () => {
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        newTabPositionFromLink: 'child',
        newTabPositionManual: 'end',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();
      registerWebNavigationListeners();

      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.get.mockImplementation((tabId: number) => {
        if (tabId === 1) return Promise.resolve(parentTab);
        return Promise.resolve(null);
      });
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      chromeMock.webNavigation.onCreatedNavigationTarget.trigger({
        tabId: 2,
        sourceTabId: 1,
        sourceProcessId: 1,
        sourceFrameId: 0,
        url: 'https://example.com/page',
        timeStamp: Date.now(),
      });

      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1,
        url: 'https://example.com/page',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(childTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const parentResult = testTreeStateManager.getNodeByTabId(1);
      const childResult = testTreeStateManager.getNodeByTabId(2);
      expect(childResult).toBeDefined();
      expect(childResult?.node.parentId).toBe(parentResult?.node.id);
    });
  });

  describe('デフォルト設定の確認', () => {
    it('設定が存在しない場合、リンククリックはデフォルトで子タブとして配置', async () => {
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, null as unknown as UserSettings);

      registerTabEventListeners();
      registerWebNavigationListeners();

      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.get.mockImplementation((tabId: number) => {
        if (tabId === 1) return Promise.resolve(parentTab);
        return Promise.resolve(null);
      });
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      chromeMock.webNavigation.onCreatedNavigationTarget.trigger({
        tabId: 2,
        sourceTabId: 1,
        sourceProcessId: 1,
        sourceFrameId: 0,
        url: 'https://example.com/page',
        timeStamp: Date.now(),
      });

      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1,
        url: 'https://example.com/page',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(childTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const parentResult = testTreeStateManager.getNodeByTabId(1);
      const childResult = testTreeStateManager.getNodeByTabId(2);
      expect(childResult?.node.parentId).toBe(parentResult?.node.id);
    });

    it('設定が存在しない場合、手動タブはデフォルトでリストの最後に配置', async () => {
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, null as unknown as UserSettings);

      registerTabEventListeners();

      const manualTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(manualTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      const result = testTreeStateManager.getNodeByTabId(1);
      expect(result).toBeDefined();
      expect(result?.node.parentId).toBeNull();
    });
  });
});
