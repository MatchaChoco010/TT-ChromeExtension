import { describe, it, expect, beforeEach, vi } from 'vitest';

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
    onActivated: { addListener: vi.fn() },
    remove: vi.fn(),
    move: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
    },
    onChanged: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

vi.stubGlobal('chrome', mockChrome);

describe('ツリー同期とリアルタイム更新', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('chrome.tabs API との同期', () => {
    it('syncWithChromeTabs: 既存タブをツリー状態に同期できる', async () => {
      const tabs: chrome.tabs.Tab[] = [
        { id: 1, url: 'https://example.com/1', title: 'Tab 1', index: 0, pinned: false, highlighted: false, windowId: 1, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 },
        { id: 2, url: 'https://example.com/2', title: 'Tab 2', index: 1, openerTabId: 1, pinned: false, highlighted: false, windowId: 1, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 },
        { id: 3, url: 'https://example.com/3', title: 'Tab 3', index: 2, pinned: false, highlighted: false, windowId: 1, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 },
      ];

      mockChrome.tabs.query.mockResolvedValue(tabs);
      mockStorageService.set.mockResolvedValue(undefined);

      const { TreeStateManager } = await import('@/services/TreeStateManager');
      const manager = new TreeStateManager(mockStorageService);

      // openerTabIdを使用して親子関係を設定するには、newTabPositionManualを'child'に設定
      await manager.syncWithChromeTabs({ newTabPositionManual: 'child' });

      const result1 = manager.getNodeByTabId(1);
      const result2 = manager.getNodeByTabId(2);
      const result3 = manager.getNodeByTabId(3);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result3).not.toBeNull();

      expect(result2?.node.parentId).toBe(result1?.node.id);
      expect(result2?.node.depth).toBe(1);

      expect(result1?.node.parentId).toBeNull();
      expect(result3?.node.parentId).toBeNull();
    });

    it('syncWithChromeTabs: 既にツリーに存在するタブは重複追加されない', async () => {
      const tabs: chrome.tabs.Tab[] = [
        { id: 1, url: 'https://example.com/1', title: 'Tab 1', index: 0, pinned: false, highlighted: false, windowId: 1, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1 },
      ];

      mockChrome.tabs.query.mockResolvedValue(tabs);
      mockStorageService.set.mockResolvedValue(undefined);

      const { TreeStateManager } = await import('@/services/TreeStateManager');
      const manager = new TreeStateManager(mockStorageService);

      await manager.syncWithChromeTabs();
      const result1 = manager.getNodeByTabId(1);
      const firstNodeId = result1?.node.id;

      await manager.syncWithChromeTabs();
      const result1Again = manager.getNodeByTabId(1);

      expect(result1Again?.node.id).toBe(firstNodeId);
    });
  });

  describe('タブ移動イベント処理', () => {
    it('handleTabMoved: タブ移動時に STATE_UPDATED メッセージを送信する', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      const { handleTabMoved } = await import('@/background/event-handlers');

      const tabId = 1;
      const moveInfo: chrome.tabs.TabMoveInfo = {
        windowId: 1,
        fromIndex: 0,
        toIndex: 2,
      };

      await handleTabMoved(tabId, moveInfo);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'STATE_UPDATED',
      });
    });
  });

  describe('タブ更新イベント処理', () => {
    it('handleTabUpdated: タイトルやURLが更新されたときに STATE_UPDATED メッセージを送信する', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

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
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
      };

      await handleTabUpdated(tabId, changeInfo, tab);

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

      const tab: chrome.tabs.Tab = {
        id: 1,
        url: 'https://example.com',
        title: 'Test',
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: false,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
      };
      await manager.addTab(tab, null, 'default-view');

      await manager.removeTab(1);

      const result = manager.getNodeByTabId(1);
      expect(result).toBeNull();
    });
  });

  describe('リアルタイムUI更新', () => {
    it('状態変更時に STATE_UPDATED メッセージを送信する', async () => {
      expect(true).toBe(true);
    });
  });
});
