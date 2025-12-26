/**
 * Task 12.2: タブ開き方別の位置ルール適用のテスト
 * Requirements: 9.2, 9.3, 9.4
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { chromeMock } from '@/test/chrome-mock';
import {
  registerTabEventListeners,
  testStorageService,
  testTreeStateManager,
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
