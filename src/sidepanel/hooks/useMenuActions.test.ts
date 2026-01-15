import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMenuActions } from './useMenuActions';
import type { MenuAction } from '@/types';

const chromeMock = {
  tabs: {
    remove: vi.fn(),
    duplicate: vi.fn(),
    update: vi.fn(),
    reload: vi.fn(),
    query: vi.fn(),
    get: vi.fn(),
    move: vi.fn(),
  },
  windows: {
    create: vi.fn(),
    remove: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
  },
  storage: {
    local: {
      get: vi.fn().mockResolvedValue({}),
    },
  },
};

vi.stubGlobal('chrome', chromeMock);

describe('useMenuActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('メニュー項目の実装', () => {
    it('closeアクション: 単一タブを閉じる', async () => {
      chromeMock.tabs.remove.mockResolvedValue(undefined);

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('close', [1]);
      });

      expect(chromeMock.tabs.remove).toHaveBeenCalledWith([1]);
    });

    it('closeアクション: 複数タブを閉じる場合はサブツリーも含めて閉じる', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('close', [1, 2, 3]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CLOSE_TABS_WITH_COLLAPSED_SUBTREES',
        payload: { tabIds: [1, 2, 3] },
      });
    });

    it('duplicateアクション: タブを複製する', async () => {
      chromeMock.tabs.duplicate.mockResolvedValue({ id: 4 });
      chromeMock.tabs.get.mockResolvedValue({ id: 1, index: 0 });
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('duplicate', [1]);
      });

      expect(chromeMock.tabs.duplicate).toHaveBeenCalledWith(1);
    });

    it('複数タブ選択時: sibling設定の場合はインデックス降順で複製する', async () => {
      chromeMock.tabs.duplicate
        .mockResolvedValueOnce({ id: 4 })
        .mockResolvedValueOnce({ id: 5 })
        .mockResolvedValueOnce({ id: 6 });
      chromeMock.tabs.get.mockImplementation(async (tabId: number) => {
        const tabData: Record<number, { id: number; index: number }> = {
          1: { id: 1, index: 0 },
          2: { id: 2, index: 1 },
          3: { id: 3, index: 2 },
        };
        return tabData[tabId] ?? { id: tabId, index: 0 };
      });
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('duplicate', [1, 2, 3]);
      });

      expect(chromeMock.tabs.duplicate).toHaveBeenCalledTimes(3);
      expect(chromeMock.tabs.duplicate).toHaveBeenNthCalledWith(1, 3);
      expect(chromeMock.tabs.duplicate).toHaveBeenNthCalledWith(2, 2);
      expect(chromeMock.tabs.duplicate).toHaveBeenNthCalledWith(3, 1);
    });

    it('複数タブ選択時（逆順で選択）: sibling設定でも選択順序に関係なくインデックス降順で処理される', async () => {
      chromeMock.tabs.duplicate
        .mockResolvedValueOnce({ id: 4 })
        .mockResolvedValueOnce({ id: 5 })
        .mockResolvedValueOnce({ id: 6 });
      chromeMock.tabs.get.mockImplementation(async (tabId: number) => {
        const tabData: Record<number, { id: number; index: number }> = {
          1: { id: 1, index: 0 },
          2: { id: 2, index: 1 },
          3: { id: 3, index: 2 },
        };
        return tabData[tabId] ?? { id: tabId, index: 0 };
      });
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('duplicate', [3, 2, 1]);
      });

      expect(chromeMock.tabs.duplicate).toHaveBeenCalledTimes(3);
      expect(chromeMock.tabs.duplicate).toHaveBeenNthCalledWith(1, 3);
      expect(chromeMock.tabs.duplicate).toHaveBeenNthCalledWith(2, 2);
      expect(chromeMock.tabs.duplicate).toHaveBeenNthCalledWith(3, 1);
    });

    it('pinアクション: タブをピン留めする', async () => {
      chromeMock.tabs.update.mockResolvedValue({ id: 1, pinned: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('pin', [1]);
      });

      expect(chromeMock.tabs.update).toHaveBeenCalledWith(1, { pinned: true });
    });

    it('unpinアクション: タブのピン留めを解除する', async () => {
      chromeMock.tabs.update.mockResolvedValue({ id: 1, pinned: false });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('unpin', [1]);
      });

      expect(chromeMock.tabs.update).toHaveBeenCalledWith(1, { pinned: false });
    });

    it('reloadアクション: タブを再読み込みする', async () => {
      chromeMock.tabs.reload.mockResolvedValue(undefined);

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('reload', [1, 2]);
      });

      expect(chromeMock.tabs.reload).toHaveBeenCalledTimes(2);
      expect(chromeMock.tabs.reload).toHaveBeenNthCalledWith(1, 1);
      expect(chromeMock.tabs.reload).toHaveBeenNthCalledWith(2, 2);
    });

    it('newWindowアクション: 新しいウィンドウでタブを開く', async () => {
      chromeMock.tabs.get.mockResolvedValue({ id: 1, windowId: 100 });
      chromeMock.windows.create.mockResolvedValue({ id: 200 });
      chromeMock.tabs.move.mockResolvedValue({});
      chromeMock.tabs.query.mockResolvedValue([{ id: 3 }]);

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('newWindow', [1, 2]);
      });

      expect(chromeMock.tabs.get).toHaveBeenCalledWith(1);
      expect(chromeMock.windows.create).toHaveBeenCalledWith({ tabId: 1 });
      expect(chromeMock.tabs.move).toHaveBeenCalledWith([2], { windowId: 200, index: -1 });
      expect(chromeMock.tabs.query).toHaveBeenCalledWith({ windowId: 100 });
      expect(chromeMock.windows.remove).not.toHaveBeenCalled();
    });

    it('newWindowアクション: 最後のタブを移動した場合、元のウィンドウを閉じる', async () => {
      chromeMock.tabs.get.mockResolvedValue({ id: 1, windowId: 100 });
      chromeMock.windows.create.mockResolvedValue({ id: 200 });
      chromeMock.tabs.query.mockResolvedValue([]);
      chromeMock.windows.remove.mockResolvedValue(undefined);

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('newWindow', [1]);
      });

      expect(chromeMock.tabs.get).toHaveBeenCalledWith(1);
      expect(chromeMock.windows.create).toHaveBeenCalledWith({ tabId: 1 });
      expect(chromeMock.tabs.query).toHaveBeenCalledWith({ windowId: 100 });
      expect(chromeMock.windows.remove).toHaveBeenCalledWith(100);
    });
  });

  describe('グループ化アクション', () => {
    it('groupアクション: 複数タブをグループ化する', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('group', [1, 2, 3]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CREATE_GROUP',
        payload: { tabIds: [1, 2, 3] },
      });
    });

    it('ungroupアクション: グループを解除する', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('ungroup', [1, 2, 3]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DISSOLVE_GROUP',
        payload: { tabIds: [1, 2, 3] },
      });
    });
  });

  describe('他のタブを閉じるアクション', () => {
    it('closeOthersアクション: 選択されたタブ以外を閉じる', async () => {
      chromeMock.tabs.query.mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
        { id: 5 },
      ]);
      chromeMock.tabs.remove.mockResolvedValue(undefined);

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('closeOthers', [2, 3]);
      });

      expect(chromeMock.tabs.query).toHaveBeenCalledWith({ currentWindow: true });
      expect(chromeMock.tabs.remove).toHaveBeenCalledWith([1, 4, 5]);
    });

    it('closeOthersアクション: 選択されたタブが1つだけの場合', async () => {
      chromeMock.tabs.query.mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);
      chromeMock.tabs.remove.mockResolvedValue(undefined);

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('closeOthers', [2]);
      });

      expect(chromeMock.tabs.remove).toHaveBeenCalledWith([1, 3]);
    });
  });

  describe('エラーハンドリング', () => {
    it('Chrome API エラー時にエラーをログに出力する', async () => {
      chromeMock.tabs.remove.mockRejectedValue(new Error('API Error'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('close', [1]);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to execute menu action close:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });

    it('未知のアクションの場合はエラーをログに出力する', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('unknown' as MenuAction, [1]);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Unknown menu action:',
        'unknown'
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
