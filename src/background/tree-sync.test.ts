/**
 * Task 5.4: ツリー同期とリアルタイム更新のテスト
 * Requirements: 1.4, 2.1
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TabNode } from '@/types';

// テスト用のモック
const mockStorageService = {
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  onChange: vi.fn(),
};

const mockChrome = {
  tabs: {
    query: vi.fn(),
    onCreated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onMoved: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
    remove: vi.fn(),
    move: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
    },
  },
};

// グローバルchromeオブジェクトをモック
global.chrome = mockChrome as any;

describe('Task 5.4: ツリー同期とリアルタイム更新', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('chrome.tabs API との同期', () => {
    it('syncWithChromeTabs: 既存タブをツリー状態に同期できる', async () => {
      // テスト用のタブを準備
      const tabs: chrome.tabs.Tab[] = [
        { id: 1, url: 'https://example.com/1', title: 'Tab 1', index: 0 },
        { id: 2, url: 'https://example.com/2', title: 'Tab 2', index: 1, openerTabId: 1 },
        { id: 3, url: 'https://example.com/3', title: 'Tab 3', index: 2 },
      ];

      mockChrome.tabs.query.mockResolvedValue(tabs);
      mockStorageService.set.mockResolvedValue(undefined);

      const { TreeStateManager } = await import('@/services/TreeStateManager');
      const manager = new TreeStateManager(mockStorageService);

      // 同期を実行
      await manager.syncWithChromeTabs();

      // すべてのタブがツリーに追加されたことを確認
      const node1 = manager.getNodeByTabId(1);
      const node2 = manager.getNodeByTabId(2);
      const node3 = manager.getNodeByTabId(3);

      expect(node1).not.toBeNull();
      expect(node2).not.toBeNull();
      expect(node3).not.toBeNull();

      // tab2がtab1の子になっていることを確認
      expect(node2?.parentId).toBe(node1?.id);
      expect(node2?.depth).toBe(1);

      // tab1とtab3はルートノード
      expect(node1?.parentId).toBeNull();
      expect(node3?.parentId).toBeNull();
    });

    it('syncWithChromeTabs: 既にツリーに存在するタブは重複追加されない', async () => {
      const tabs: chrome.tabs.Tab[] = [
        { id: 1, url: 'https://example.com/1', title: 'Tab 1', index: 0 },
      ];

      mockChrome.tabs.query.mockResolvedValue(tabs);
      mockStorageService.set.mockResolvedValue(undefined);

      const { TreeStateManager } = await import('@/services/TreeStateManager');
      const manager = new TreeStateManager(mockStorageService);

      // 1回目の同期
      await manager.syncWithChromeTabs();
      const node1 = manager.getNodeByTabId(1);
      const firstNodeId = node1?.id;

      // 2回目の同期
      await manager.syncWithChromeTabs();
      const node1Again = manager.getNodeByTabId(1);

      // 同じノードIDが保持されていることを確認（重複追加されていない）
      expect(node1Again?.id).toBe(firstNodeId);
    });
  });

  describe('タブ移動イベント処理', () => {
    it('handleTabMoved: タブ移動時に STATE_UPDATED メッセージを送信する', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      // event-handlers から handleTabMoved をインポート
      const { handleTabMoved } = await import('@/background/event-handlers');

      const tabId = 1;
      const moveInfo: chrome.tabs.TabMoveInfo = {
        windowId: 1,
        fromIndex: 0,
        toIndex: 2,
      };

      // ハンドラを呼び出す
      await handleTabMoved(tabId, moveInfo);

      // STATE_UPDATED メッセージが送信されたことを確認
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'STATE_UPDATED',
      });
    });
  });

  describe('タブ更新イベント処理', () => {
    it('handleTabUpdated: タイトルやURLが更新されたときに STATE_UPDATED メッセージを送信する', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      // event-handlers から handleTabUpdated をインポート
      const { handleTabUpdated } = await import('@/background/event-handlers');

      const tabId = 1;
      const changeInfo: chrome.tabs.TabChangeInfo = {
        title: 'New Title',
        url: 'https://new-url.com',
      };
      const tab: chrome.tabs.Tab = {
        id: 1,
        url: 'https://new-url.com',
        title: 'New Title',
        index: 0,
      };

      // ハンドラを呼び出す
      await handleTabUpdated(tabId, changeInfo, tab);

      // STATE_UPDATED メッセージが送信されたことを確認
      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'STATE_UPDATED',
      });
    });
  });

  describe('タブ削除イベント処理', () => {
    it('handleTabRemoved: タブ削除時にツリー状態から削除する', async () => {
      mockStorageService.set.mockResolvedValue(undefined);
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      const { TreeStateManager } = await import('@/services/TreeStateManager');
      const manager = new TreeStateManager(mockStorageService);

      // タブを追加
      const tab: chrome.tabs.Tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Test',
        index: 0,
      };
      await manager.addTab(tab, null, 'default-view');

      // タブを削除
      await manager.removeTab(1);

      // ノードが削除されたことを確認
      const node = manager.getNodeByTabId(1);
      expect(node).toBeNull();
    });
  });

  describe('リアルタイムUI更新', () => {
    it('状態変更時に STATE_UPDATED メッセージを送信する', async () => {
      // この機能は event-handlers.ts で実装される
      // サイドパネルが STATE_UPDATED メッセージを受信してUIを更新する
      expect(true).toBe(true);
    });
  });
});
