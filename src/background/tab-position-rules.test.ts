/**
 * Task 12.2: タブ開き方別の位置ルール適用のテスト
 * Requirements: 9.2, 9.3, 9.4
 *
 * Task 3.1 (tab-tree-bugfix-2): システムページ判定の追加
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '@/test/chrome-mock';
import {
  registerTabEventListeners,
  testStorageService,
  testTreeStateManager,
  isSystemPage,
} from './event-handlers';
import { STORAGE_KEYS } from '@/storage/StorageService';
import type { UserSettings } from '@/types';

describe('Task 12.2: タブ開き方別の位置ルール', () => {
  beforeEach(async () => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();

    // Clear storage using the same instances as event-handlers
    await testStorageService.set(STORAGE_KEYS.TREE_STATE, {
      views: [{ id: 'default-view', name: 'デフォルト', color: '#3b82f6' }],
      currentViewId: 'default-view',
      nodes: {},
      tabToNode: {},
    });

    // Mock chrome.runtime.sendMessage
    chromeMock.runtime.sendMessage = vi.fn(() => Promise.resolve());
  });

  describe('Requirement 9.2: リンククリックから開かれたタブ', () => {
    it('newTabPositionFromLink が「child」の場合、元のタブの子として配置される', async () => {
      // Arrange: 設定を保存
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'end', // デフォルトは end
        newTabPositionFromLink: 'child', // リンクからは child
        newTabPositionManual: 'end',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();

      // 親タブを作成
      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // リンクから子タブを作成
      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1, // リンクから開かれた
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(childTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: 子タブが親タブの子として追加されていることを確認
      const parentNode = testTreeStateManager.getNodeByTabId(1);
      const childNode = testTreeStateManager.getNodeByTabId(2);

      expect(parentNode).toBeDefined();
      expect(childNode).toBeDefined();
      expect(childNode?.parentId).toBe(parentNode?.id);
    });

    it('newTabPositionFromLink が「end」の場合、ツリーの最後に配置される', async () => {
      // Arrange
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        newTabPositionFromLink: 'end', // リンクからは end
        newTabPositionManual: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();

      // 親タブを作成
      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // リンクから子タブを作成
      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1, // リンクから開かれたが、設定はend
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(childTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: 子タブがルートレベルに配置されていることを確認
      const childNode = testTreeStateManager.getNodeByTabId(2);
      expect(childNode).toBeDefined();
      expect(childNode?.parentId).toBeNull(); // 親なし
    });
  });

  describe('Requirement 9.3: 手動で開かれたタブ', () => {
    it('newTabPositionManual が「end」の場合、ツリーの最後に配置される', async () => {
      // Arrange
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        newTabPositionFromLink: 'child',
        newTabPositionManual: 'end', // 手動は end
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();

      // 手動でタブを作成 (openerTabId なし)
      const manualTab = {
        id: 1,
        index: 0,
        windowId: 1,
        // openerTabId がない = 手動
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(manualTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: タブがルートレベルに配置
      const node = testTreeStateManager.getNodeByTabId(1);
      expect(node).toBeDefined();
      expect(node?.parentId).toBeNull();
    });
  });

  describe('Requirement 9.4: 後方互換性', () => {
    it('newTabPositionFromLink/Manual がない場合、既存の newTabPosition 設定を使用', async () => {
      // Arrange: 古い設定 (新しいフィールドなし)
      const settings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child' as const, // 既存の設定のみ
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote' as const,
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();

      // 親タブを作成
      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // リンクから子タブを作成
      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1,
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(childTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: 既存の newTabPosition (child) に従って子として配置
      const parentNode = testTreeStateManager.getNodeByTabId(1);
      const childNode = testTreeStateManager.getNodeByTabId(2);

      expect(childNode?.parentId).toBe(parentNode?.id);
    });
  });
});

/**
 * Task 3.1 (tab-tree-bugfix-2): システムページ判定と新規タブ位置設定の修正
 * Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7
 */
describe('Task 3.1: システムページ判定と新規タブ位置設定', () => {
  beforeEach(async () => {
    chromeMock.clearAllListeners();
    vi.clearAllMocks();

    // Clear storage using the same instances as event-handlers
    await testStorageService.set(STORAGE_KEYS.TREE_STATE, {
      views: [{ id: 'default-view', name: 'デフォルト', color: '#3b82f6' }],
      currentViewId: 'default-view',
      nodes: {},
      tabToNode: {},
    });

    // Mock chrome.runtime.sendMessage
    chromeMock.runtime.sendMessage = vi.fn(() => Promise.resolve());
  });

  describe('isSystemPage 関数のテスト', () => {
    it('chrome:// スキームはシステムページとして判定される', () => {
      expect(isSystemPage('chrome://settings')).toBe(true);
      expect(isSystemPage('chrome://extensions')).toBe(true);
      expect(isSystemPage('chrome://newtab')).toBe(true);
    });

    it('chrome-extension:// スキームはシステムページとして判定される', () => {
      expect(isSystemPage('chrome-extension://abc123/options.html')).toBe(true);
      expect(isSystemPage('chrome-extension://xyz/popup.html')).toBe(true);
    });

    it('vivaldi:// スキームはシステムページとして判定される', () => {
      expect(isSystemPage('vivaldi://settings')).toBe(true);
      expect(isSystemPage('vivaldi://extensions')).toBe(true);
    });

    it('about: スキームはシステムページとして判定される', () => {
      expect(isSystemPage('about:blank')).toBe(true);
      expect(isSystemPage('about:newtab')).toBe(true);
    });

    it('http/https はシステムページではないと判定される', () => {
      expect(isSystemPage('https://example.com')).toBe(false);
      expect(isSystemPage('http://localhost:3000')).toBe(false);
    });

    it('空文字列やundefinedはシステムページではないと判定される', () => {
      expect(isSystemPage('')).toBe(false);
    });
  });

  describe('Requirement 17.6: openerTabIdがあってもシステムページの場合は手動タブとして扱う', () => {
    it('設定画面はopenerTabIdがあっても手動タブとして扱われる (リストの最後に配置)', async () => {
      // Arrange: 設定を保存
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        newTabPositionFromLink: 'child', // リンクからは child
        newTabPositionManual: 'end', // 手動は end
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();

      // 親タブを作成
      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 設定画面を開く (openerTabIdがあるが、chrome://なのでシステムページ)
      const settingsTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1, // 親から開かれた
        url: 'chrome://settings', // システムページ
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(settingsTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: システムページなので手動タブとして扱われ、ルートレベルに配置
      const settingsNode = testTreeStateManager.getNodeByTabId(2);
      expect(settingsNode).toBeDefined();
      expect(settingsNode?.parentId).toBeNull(); // 親なし（リストの最後に配置）
    });

    it('vivaldi://settings もopenerTabIdがあっても手動タブとして扱われる', async () => {
      // Arrange
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
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();

      // 親タブを作成
      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Vivaldi設定画面を開く
      const vivaldiSettingsTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1,
        url: 'vivaldi://settings',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(vivaldiSettingsTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      const settingsNode = testTreeStateManager.getNodeByTabId(2);
      expect(settingsNode).toBeDefined();
      expect(settingsNode?.parentId).toBeNull();
    });

    it('chrome-extension:// ページもopenerTabIdがあっても手動タブとして扱われる', async () => {
      // Arrange
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
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();

      // 親タブを作成
      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // 拡張機能のオプションページを開く
      const extensionTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1,
        url: 'chrome-extension://abc123/options.html',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(extensionTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert
      const extensionNode = testTreeStateManager.getNodeByTabId(2);
      expect(extensionNode).toBeDefined();
      expect(extensionNode?.parentId).toBeNull();
    });
  });

  describe('Requirement 17.7: 通常のリンククリックは引き続き子タブとして配置', () => {
    it('http/https ページはopenerTabIdがあれば子タブとして配置される', async () => {
      // Arrange
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
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();

      // 親タブを作成
      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // リンククリックで新しいページを開く
      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1,
        url: 'https://example.com/page',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(childTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: 子タブとして配置
      const parentNode = testTreeStateManager.getNodeByTabId(1);
      const childNode = testTreeStateManager.getNodeByTabId(2);
      expect(childNode).toBeDefined();
      expect(childNode?.parentId).toBe(parentNode?.id);
    });
  });

  describe('Requirement 17.5: 手動タブ位置が「現在のタブの子」設定でも正しく動作', () => {
    it('手動タブ位置が「child」設定でも、システムページは子として配置されない', async () => {
      // Arrange: 手動タブも child に設定
      const settings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        newTabPositionFromLink: 'child',
        newTabPositionManual: 'child', // 手動も child
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, settings);

      registerTabEventListeners();

      // 親タブを作成
      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // chrome://settings を開く（手動タブ設定がchildでも、システムページなので親なし）
      // ただし、openerTabIdがない場合は手動タブとして扱われ、設定に従う
      const settingsTab = {
        id: 2,
        index: 1,
        windowId: 1,
        // openerTabId なし（手動で開いた）
        url: 'chrome://settings',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(settingsTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: openerTabIdがないので手動タブ扱いだが、
      // childの設定は「現在アクティブなタブ」を基準にするため、
      // 実装によっては親がセットされる可能性がある
      // ここでは、openerTabIdがないためparentIdはnullになるはず
      const settingsNode = testTreeStateManager.getNodeByTabId(2);
      expect(settingsNode).toBeDefined();
      // 手動タブはopenerTabIdがないため、child設定でも親タブを特定できない
      expect(settingsNode?.parentId).toBeNull();
    });
  });

  describe('Requirement 17.3: デフォルト設定の確認', () => {
    it('設定が存在しない場合、リンククリックはデフォルトで子タブとして配置', async () => {
      // Arrange: 設定なし
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, null as unknown as UserSettings);

      registerTabEventListeners();

      // 親タブを作成
      const parentTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(parentTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // リンククリックで開く
      const childTab = {
        id: 2,
        index: 1,
        windowId: 1,
        openerTabId: 1,
        url: 'https://example.com/page',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(childTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: デフォルト設定（child）に従って子として配置
      const parentNode = testTreeStateManager.getNodeByTabId(1);
      const childNode = testTreeStateManager.getNodeByTabId(2);
      expect(childNode?.parentId).toBe(parentNode?.id);
    });

    it('設定が存在しない場合、手動タブはデフォルトでリストの最後に配置', async () => {
      // Arrange: 設定なし
      await testStorageService.set(STORAGE_KEYS.USER_SETTINGS, null as unknown as UserSettings);

      registerTabEventListeners();

      // 手動でタブを作成
      const manualTab = {
        id: 1,
        index: 0,
        windowId: 1,
        url: 'https://example.com',
      } as chrome.tabs.Tab;
      chromeMock.tabs.onCreated.trigger(manualTab);
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Assert: デフォルト設定（end）に従ってルートに配置
      const node = testTreeStateManager.getNodeByTabId(1);
      expect(node).toBeDefined();
      expect(node?.parentId).toBeNull();
    });
  });
});
