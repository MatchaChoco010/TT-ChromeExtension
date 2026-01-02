/**
 * 新規タブ位置のテスト
 *
 * このテストでは以下を検証します:
 * - 設定が「子として配置」の場合に新規タブが元のタブの子になること
 * - 設定が「リストの最後」の場合に新規タブがツリーの最後に配置されること
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '@/test/chrome-mock';
import { StorageService, STORAGE_KEYS } from '@/storage/StorageService';
import { TreeStateManager } from '@/services/TreeStateManager';
import type { UserSettings } from '@/types';

describe('新規タブ位置の統合テスト', () => {
  // テストごとに新しいインスタンスを作成
  let testStorageService: StorageService;
  let testTreeStateManager: TreeStateManager;

  beforeEach(async () => {
    // Chrome API モックをクリア
    chromeMock.clearAllListeners();
    vi.clearAllMocks();

    // 新しいインスタンスを作成
    testStorageService = new StorageService();
    testTreeStateManager = new TreeStateManager(testStorageService);

    // ストレージをクリア
    await testStorageService.set(STORAGE_KEYS.TREE_STATE, {
      views: [{ id: 'default-view', name: 'デフォルト', color: '#3b82f6' }],
      currentViewId: 'default-view',
      nodes: {},
      tabToNode: {},
    });

    // デフォルト設定を保存
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
    };
    await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, defaultSettings);

    // 未読タブリストをクリア
    await testStorageService.set(STORAGE_KEYS.UNREAD_TABS, []);

    // グループをクリア
    await testStorageService.set(STORAGE_KEYS.GROUPS, {});

    // Chrome runtime sendMessage をモック
    chromeMock.runtime.sendMessage = vi.fn(() => Promise.resolve());
  });

  describe('設定が「子として配置」の場合', () => {
    it('リンクから開かれた新規タブが元のタブの子になる', async () => {
      // Arrange: 設定を「child」に設定
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

      // リンクから子タブを作成
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
        openerTabId: 1, // リンクから開かれた
      } as chrome.tabs.Tab;

      // 子タブを追加 (openerTabIdがあるので親の子として配置)
      const parentNode = testTreeStateManager.getNodeByTabId(1);
      await testTreeStateManager.addTab(
        childTab,
        parentNode?.id || null,
        'default-view',
      );

      // Assert: 子タブが親タブの子として配置されていることを確認
      const parent = testTreeStateManager.getNodeByTabId(1);
      const child = testTreeStateManager.getNodeByTabId(2);

      expect(parent).toBeDefined();
      expect(child).toBeDefined();
      expect(child?.parentId).toBe(parent?.id);
      expect(parent?.children).toHaveLength(1);
      expect(parent?.children[0].id).toBe(child?.id);
    });

    it('newTabPosition設定が「child」の場合、openerTabIdを持つタブが子として配置される', async () => {
      // Arrange
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child', // デフォルト設定
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      // 親タブを作成
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

      // 子タブを作成
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

      const parentNode = testTreeStateManager.getNodeByTabId(1);
      await testTreeStateManager.addTab(
        childTab,
        parentNode?.id || null,
        'default-view',
      );

      // Assert
      const parent = testTreeStateManager.getNodeByTabId(1);
      const child = testTreeStateManager.getNodeByTabId(2);

      expect(child?.parentId).toBe(parent?.id);
    });
  });

  describe('設定が「リストの最後」の場合', () => {
    it('手動で開かれた新規タブがツリーの最後に配置される', async () => {
      // Arrange: 設定を「end」に設定
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
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      // 既存のタブを作成
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

      // 手動で新しいタブを作成 (openerTabIdなし)
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
        // openerTabId なし = 手動で開かれた
      } as chrome.tabs.Tab;

      await testTreeStateManager.addTab(manualTab, null, 'default-view');

      // Assert: 手動タブがルートレベルに配置されていることを確認
      const manual = testTreeStateManager.getNodeByTabId(2);

      expect(manual).toBeDefined();
      expect(manual?.parentId).toBeNull(); // 親なし = ルートレベル

      // ツリーのルートノードを取得
      const tree = testTreeStateManager.getTree('default-view');
      expect(tree).toHaveLength(2); // 既存タブと手動タブの2つ
      expect(tree[1].id).toBe(manual?.id); // 最後に配置されている
    });

    it('newTabPosition設定が「end」の場合、新しいタブがルートレベルの最後に配置される', async () => {
      // Arrange
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'end', // デフォルト設定
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      // 複数のタブを作成
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

      // Assert: すべてのタブがルートレベルに順番に配置されている
      const tree = testTreeStateManager.getTree('default-view');
      expect(tree).toHaveLength(3);
      expect(tree[0].tabId).toBe(1);
      expect(tree[1].tabId).toBe(2);
      expect(tree[2].tabId).toBe(3);

      // すべてルートレベル
      expect(tree[0].parentId).toBeNull();
      expect(tree[1].parentId).toBeNull();
      expect(tree[2].parentId).toBeNull();
    });
  });

  describe('エッジケース', () => {
    it('設定が「sibling」の場合、兄弟として配置される', async () => {
      // Arrange
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
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      // 親タブを作成
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

      // 子タブを作成（本来は子だが、siblingなので兄弟になる）
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

      // siblingの場合は親と同じレベルに配置
      await testTreeStateManager.addTab(siblingTab, null, 'default-view');

      // Assert
      const sibling = testTreeStateManager.getNodeByTabId(2);
      expect(sibling?.parentId).toBeNull(); // 親なし = ルートレベル
    });
  });
});
