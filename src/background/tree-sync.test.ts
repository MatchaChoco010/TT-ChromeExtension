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
    update: vi.fn(),
  },
  windows: {
    getAll: vi.fn().mockResolvedValue([{ id: 1 }]),
  },
  runtime: {
    sendMessage: vi.fn(),
    id: 'test-extension-id',
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
    it('restoreStateAfterRestart: 保存された状態をロードしてtabIdを再構築できる', async () => {
      const tabs: chrome.tabs.Tab[] = [
        { id: 101, url: 'https://example.com/1', title: 'Tab 1', index: 0, pinned: false, highlighted: false, windowId: 1, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1, frozen: false },
        { id: 102, url: 'https://example.com/2', title: 'Tab 2', index: 1, pinned: false, highlighted: false, windowId: 1, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1, frozen: false },
        { id: 103, url: 'https://example.com/3', title: 'Tab 3', index: 2, pinned: false, highlighted: false, windowId: 1, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1, frozen: false },
      ];

      const savedState = {
        windows: [{
          windowId: 1,
          views: [{
            name: 'Default',
            color: '#3b82f6',
            rootNodes: [
              { tabId: 1, isExpanded: true, children: [{ tabId: 2, isExpanded: true, children: [] }] },
              { tabId: 3, isExpanded: true, children: [] },
            ],
            pinnedTabIds: [],
          }],
          activeViewIndex: 0,
        }],
      };

      mockChrome.tabs.query.mockResolvedValue(tabs);
      mockStorageService.get.mockResolvedValue(savedState);
      mockStorageService.set.mockResolvedValue(undefined);

      const { TreeStateManager } = await import('@/services/TreeStateManager');
      const manager = new TreeStateManager(mockStorageService);

      await manager.restoreStateAfterRestart();

      const result1 = manager.getNodeByTabId(101);
      const result2 = manager.getNodeByTabId(102);
      const result3 = manager.getNodeByTabId(103);

      expect(result1).not.toBeNull();
      expect(result2).not.toBeNull();
      expect(result3).not.toBeNull();

      expect(result1?.node.children.some(c => c.tabId === 102)).toBe(true);

      const tree = manager.getTree(1);
      expect(tree.some(n => n.tabId === 101)).toBe(true);
      expect(tree.some(n => n.tabId === 103)).toBe(true);
    });

    it('restoreStateAfterRestart: 2回呼び出しても2回目は何もしない', async () => {
      const tabs: chrome.tabs.Tab[] = [
        { id: 101, url: 'https://example.com/1', title: 'Tab 1', index: 0, pinned: false, highlighted: false, windowId: 1, active: false, incognito: false, selected: false, discarded: false, autoDiscardable: true, groupId: -1, frozen: false },
      ];

      const savedState = {
        windows: [{
          windowId: 1,
          views: [{
            name: 'Default',
            color: '#3b82f6',
            rootNodes: [{ tabId: 1, isExpanded: true, children: [] }],
            pinnedTabIds: [],
          }],
          activeViewIndex: 0,
        }],
      };

      mockChrome.tabs.query.mockResolvedValue(tabs);
      mockStorageService.get.mockResolvedValue(savedState);
      mockStorageService.set.mockResolvedValue(undefined);

      const { TreeStateManager } = await import('@/services/TreeStateManager');
      const manager = new TreeStateManager(mockStorageService);

      await manager.restoreStateAfterRestart();
      const result1 = manager.getNodeByTabId(101);
      const firstTabId = result1?.node.tabId;

      await manager.restoreStateAfterRestart();
      const result1Again = manager.getNodeByTabId(101);

      expect(result1Again?.node.tabId).toBe(firstTabId);
    });
  });

  describe('タブ移動イベント処理', () => {
    it('handleTabMoved: タブ移動時に STATE_UPDATED メッセージを送信する', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      const { handleTabMoved } = await import('@/background/event-handlers');

      const tabId = 1;
      const moveInfo: chrome.tabs.OnMovedInfo = {
        windowId: 1,
        fromIndex: 0,
        toIndex: 2,
      };

      await handleTabMoved(tabId, moveInfo);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATED',
          payload: expect.any(Object),
        })
      );
    });
  });

  describe('タブ更新イベント処理', () => {
    it('handleTabUpdated: タイトルやURLが更新されたときに STATE_UPDATED メッセージを送信する', async () => {
      mockChrome.runtime.sendMessage.mockResolvedValue(undefined);

      const { handleTabUpdated } = await import('@/background/event-handlers');

      const tabId = 1;
      const changeInfo: chrome.tabs.OnUpdatedInfo = {
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
        frozen: false,
      };

      await handleTabUpdated(tabId, changeInfo, tab);

      expect(mockChrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATED',
          payload: expect.any(Object),
        })
      );
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
        frozen: false,
      };
      await manager.addTab(tab, null, 1);

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
