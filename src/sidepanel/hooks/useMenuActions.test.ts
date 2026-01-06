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
  },
  windows: {
    create: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
  },
};

vi.stubGlobal('chrome', chromeMock);

describe('useMenuActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('メニュー項目の実装', () => {
    it('closeアクション: 指定されたタブを閉じる', async () => {
      chromeMock.tabs.remove.mockResolvedValue(undefined);

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('close', [1, 2, 3]);
      });

      expect(chromeMock.tabs.remove).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('duplicateアクション: タブを複製する', async () => {
      chromeMock.tabs.duplicate.mockResolvedValue({ id: 4 });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('duplicate', [1]);
      });

      expect(chromeMock.tabs.duplicate).toHaveBeenCalledWith(1);
    });

    it('複数タブ選択時: 各タブを順に複製する', async () => {
      chromeMock.tabs.duplicate.mockResolvedValue({ id: 4 });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('duplicate', [1, 2, 3]);
      });

      expect(chromeMock.tabs.duplicate).toHaveBeenCalledTimes(3);
      expect(chromeMock.tabs.duplicate).toHaveBeenNthCalledWith(1, 1);
      expect(chromeMock.tabs.duplicate).toHaveBeenNthCalledWith(2, 2);
      expect(chromeMock.tabs.duplicate).toHaveBeenNthCalledWith(3, 3);
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
      chromeMock.windows.create.mockResolvedValue({ id: 2 });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('newWindow', [1, 2]);
      });

      expect(chromeMock.windows.create).toHaveBeenCalledWith({ tabId: 1 });
      expect(chromeMock.windows.create).toHaveBeenCalledWith({ tabId: 2 });
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
