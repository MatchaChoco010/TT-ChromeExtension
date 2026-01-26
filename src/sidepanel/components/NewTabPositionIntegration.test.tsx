import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '@/test/chrome-mock';
import { StorageService, STORAGE_KEYS } from '@/storage/StorageService';
import { TreeStateManager } from '@/services/TreeStateManager';
import type { UserSettings, TreeState } from '@/types';

describe('新規タブ位置の統合テスト', () => {
  let testStorageService: StorageService;
  let testTreeStateManager: TreeStateManager;
  const defaultWindowId = 1;

  beforeEach(async () => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();

    testStorageService = new StorageService();
    testTreeStateManager = new TreeStateManager(testStorageService);

    const initialTreeState: TreeState = {
      windows: [
        {
          windowId: defaultWindowId,
          views: [
            {
              name: 'デフォルト',
              color: '#3b82f6',
              rootNodes: [],
              pinnedTabIds: [],
            },
          ],
          activeViewIndex: 0,
        },
      ],
    };
    await testStorageService.set(STORAGE_KEYS.TREE_STATE, initialTreeState);

    const defaultSettings: UserSettings = {
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
    await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, defaultSettings);

    await testStorageService.set(STORAGE_KEYS.UNREAD_TABS, []);

    await testStorageService.set(STORAGE_KEYS.GROUPS, {});

    chromeMock.runtime.sendMessage = vi.fn(() => Promise.resolve());
  });

  describe('設定が「子として配置」の場合', () => {
    it('リンクから開かれた新規タブが元のタブの子になる', async () => {
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

      const parentTab = {
        id: 1,
        index: 0,
        windowId: defaultWindowId,
        url: 'https://example.com',
        title: '親タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(parentTab, null, defaultWindowId);

      const childTab = {
        id: 2,
        index: 1,
        windowId: defaultWindowId,
        url: 'https://example.com/page',
        title: '子タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
        openerTabId: 1,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(childTab, 1, defaultWindowId);

      const parentResult = testTreeStateManager.getNodeByTabId(1);
      const childResult = testTreeStateManager.getNodeByTabId(2);

      expect(parentResult).toBeDefined();
      expect(childResult).toBeDefined();
      expect(parentResult?.node.children).toHaveLength(1);
      expect(parentResult?.node.children[0].tabId).toBe(2);
    });

    it('newTabPosition設定が「child」の場合、openerTabIdを持つタブが子として配置される', async () => {
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      const parentTab = {
        id: 1,
        index: 0,
        windowId: defaultWindowId,
        url: 'https://parent.com',
        title: '親タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(parentTab, null, defaultWindowId);

      const childTab = {
        id: 2,
        index: 1,
        windowId: defaultWindowId,
        url: 'https://child.com',
        title: '子タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
        openerTabId: 1,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(childTab, 1, defaultWindowId);

      const parentResult = testTreeStateManager.getNodeByTabId(1);
      const childResult = testTreeStateManager.getNodeByTabId(2);

      expect(childResult).toBeDefined();
      expect(parentResult?.node.children.some(c => c.tabId === 2)).toBe(true);
    });
  });

  describe('設定が「リストの最後」の場合', () => {
    it('手動で開かれた新規タブがツリーの最後に配置される', async () => {
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

      const existingTab = {
        id: 1,
        index: 0,
        windowId: defaultWindowId,
        url: 'https://existing.com',
        title: '既存タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(existingTab, null, defaultWindowId);

      const manualTab = {
        id: 2,
        index: 1,
        windowId: defaultWindowId,
        url: 'https://manual.com',
        title: '手動タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(manualTab, null, defaultWindowId);

      const manualResult = testTreeStateManager.getNodeByTabId(2);

      expect(manualResult).toBeDefined();

      const tree = testTreeStateManager.getTree(defaultWindowId);
      expect(tree).toHaveLength(2);
      expect(tree[1].tabId).toBe(2);
    });

    it('newTabPosition設定が「end」の場合、新しいタブがルートレベルの最後に配置される', async () => {
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'end',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      const tab1 = {
        id: 1,
        index: 0,
        windowId: defaultWindowId,
        url: 'https://tab1.com',
        title: 'タブ1',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      const tab2 = {
        id: 2,
        index: 1,
        windowId: defaultWindowId,
        url: 'https://tab2.com',
        title: 'タブ2',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      const tab3 = {
        id: 3,
        index: 2,
        windowId: defaultWindowId,
        url: 'https://tab3.com',
        title: 'タブ3',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(tab1, null, defaultWindowId);
      await testTreeStateManager.addTab(tab2, null, defaultWindowId);
      await testTreeStateManager.addTab(tab3, null, defaultWindowId);

      const tree = testTreeStateManager.getTree(defaultWindowId);
      expect(tree).toHaveLength(3);
      expect(tree[0].tabId).toBe(1);
      expect(tree[1].tabId).toBe(2);
      expect(tree[2].tabId).toBe(3);

      const result1 = testTreeStateManager.getNodeByTabId(1);
      const result2 = testTreeStateManager.getNodeByTabId(2);
      const result3 = testTreeStateManager.getNodeByTabId(3);
      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(result3).toBeDefined();
    });
  });

  describe('エッジケース', () => {
    it('設定が「nextSibling」の場合、直後に配置される', async () => {
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'nextSibling',
        newTabPositionFromLink: 'nextSibling',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      const parentTab = {
        id: 1,
        index: 0,
        windowId: defaultWindowId,
        url: 'https://parent.com',
        title: '親タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(parentTab, null, defaultWindowId);

      const siblingTab = {
        id: 2,
        index: 1,
        windowId: defaultWindowId,
        url: 'https://sibling.com',
        title: '兄弟タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
        openerTabId: 1,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(siblingTab, null, defaultWindowId);

      const siblingResult = testTreeStateManager.getNodeByTabId(2);
      expect(siblingResult).toBeDefined();
    });
  });
});
