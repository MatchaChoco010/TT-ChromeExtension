import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '@/test/chrome-mock';
import { StorageService, STORAGE_KEYS } from '@/storage/StorageService';
import { TreeStateManager } from '@/services/TreeStateManager';
import type { UserSettings } from '@/types';

describe('新規タブ位置の統合テスト', () => {
  let testStorageService: StorageService;
  let testTreeStateManager: TreeStateManager;

  beforeEach(async () => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();

    testStorageService = new StorageService();
    testTreeStateManager = new TreeStateManager(testStorageService);

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
        newTabPositionFromLink: 'child', // リンクから開かれたタブは子として配置
        newTabPositionManual: 'end',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      // 親タブを作成
      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
        title: '親タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(parentTab, null, 'default-view');

      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        url: 'https://example.com/page',
        title: '子タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
        openerTabId: 1,
      } as chrome.tabs.Tab;

      const parentNodeResult = testTreeStateManager.getNodeByTabId(1);
      await testTreeStateManager.addTab(
        childTab,
        parentNodeResult?.node.id || null,
        'default-view',
      );

      const parentResult = testTreeStateManager.getNodeByTabId(1);
      const childResult = testTreeStateManager.getNodeByTabId(2);

      expect(parentResult).toBeDefined();
      expect(childResult).toBeDefined();
      expect(childResult?.node.parentId).toBe(parentResult?.node.id);
      expect(parentResult?.node.children).toHaveLength(1);
      expect(parentResult?.node.children[0].id).toBe(childResult?.node.id);
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
        windowId: 1,
        url: 'https://parent.com',
        title: '親タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(parentTab, null, 'default-view');

      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        url: 'https://child.com',
        title: '子タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
        openerTabId: 1,
      } as chrome.tabs.Tab;

      const parentNodeResult = testTreeStateManager.getNodeByTabId(1);
      await testTreeStateManager.addTab(
        childTab,
        parentNodeResult?.node.id || null,
        'default-view',
      );

      const parentResult = testTreeStateManager.getNodeByTabId(1);
      const childResult = testTreeStateManager.getNodeByTabId(2);

      expect(childResult?.node.parentId).toBe(parentResult?.node.id);
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
        newTabPositionManual: 'end', // 手動で開かれたタブはツリーの最後に配置
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
        windowId: 1,
        url: 'https://existing.com',
        title: '既存タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(existingTab, null, 'default-view');

      const manualTab = {
        id: 2,
        index: 1,
        windowId: 1,
        url: 'https://manual.com',
        title: '手動タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(manualTab, null, 'default-view');

      const manualResult = testTreeStateManager.getNodeByTabId(2);

      expect(manualResult).toBeDefined();
      expect(manualResult?.node.parentId).toBeNull();

      const tree = testTreeStateManager.getTree('default-view');
      expect(tree).toHaveLength(2);
      expect(tree[1].id).toBe(manualResult?.node.id);
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
        windowId: 1,
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
        windowId: 1,
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
        windowId: 1,
        url: 'https://tab3.com',
        title: 'タブ3',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(tab1, null, 'default-view');
      await testTreeStateManager.addTab(tab2, null, 'default-view');
      await testTreeStateManager.addTab(tab3, null, 'default-view');

      const tree = testTreeStateManager.getTree('default-view');
      expect(tree).toHaveLength(3);
      expect(tree[0].tabId).toBe(1);
      expect(tree[1].tabId).toBe(2);
      expect(tree[2].tabId).toBe(3);

      expect(tree[0].parentId).toBeNull();
      expect(tree[1].parentId).toBeNull();
      expect(tree[2].parentId).toBeNull();
    });
  });

  describe('エッジケース', () => {
    it('設定が「sibling」の場合、兄弟として配置される', async () => {
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'sibling',
        newTabPositionFromLink: 'sibling',
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
        windowId: 1,
        url: 'https://parent.com',
        title: '親タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(parentTab, null, 'default-view');

      const siblingTab = {
        id: 2,
        index: 1,
        windowId: 1,
        url: 'https://sibling.com',
        title: '兄弟タブ',
        active: false,
        pinned: false,
        highlighted: false,
        incognito: false,
        openerTabId: 1,
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(siblingTab, null, 'default-view');

      const siblingResult = testTreeStateManager.getNodeByTabId(2);
      expect(siblingResult?.node.parentId).toBeNull();
    });
  });
});
