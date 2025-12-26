import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMenuActions } from './useMenuActions';
import type { MenuAction } from '@/types';

// Chrome API のモック
global.chrome = {
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
} as any;

describe('useMenuActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Requirement 12.2: メニュー項目の実装', () => {
    it('closeアクション: 指定されたタブを閉じる', async () => {
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      (chrome.tabs.remove as any) = mockRemove;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('close', [1, 2, 3]);
      });

      expect(mockRemove).toHaveBeenCalledWith([1, 2, 3]);
    });

    it('duplicateアクション: タブを複製する', async () => {
      const mockDuplicate = vi.fn().mockResolvedValue({ id: 4 });
      (chrome.tabs.duplicate as any) = mockDuplicate;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('duplicate', [1]);
      });

      expect(mockDuplicate).toHaveBeenCalledWith(1);
    });

    it('複数タブ選択時: 各タブを順に複製する', async () => {
      const mockDuplicate = vi.fn().mockResolvedValue({ id: 4 });
      (chrome.tabs.duplicate as any) = mockDuplicate;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('duplicate', [1, 2, 3]);
      });

      expect(mockDuplicate).toHaveBeenCalledTimes(3);
      expect(mockDuplicate).toHaveBeenNthCalledWith(1, 1);
      expect(mockDuplicate).toHaveBeenNthCalledWith(2, 2);
      expect(mockDuplicate).toHaveBeenNthCalledWith(3, 3);
    });

    it('pinアクション: タブをピン留めする', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ id: 1, pinned: true });
      (chrome.tabs.update as any) = mockUpdate;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('pin', [1]);
      });

      expect(mockUpdate).toHaveBeenCalledWith(1, { pinned: true });
    });

    it('unpinアクション: タブのピン留めを解除する', async () => {
      const mockUpdate = vi.fn().mockResolvedValue({ id: 1, pinned: false });
      (chrome.tabs.update as any) = mockUpdate;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('unpin', [1]);
      });

      expect(mockUpdate).toHaveBeenCalledWith(1, { pinned: false });
    });

    it('reloadアクション: タブを再読み込みする', async () => {
      const mockReload = vi.fn().mockResolvedValue(undefined);
      (chrome.tabs.reload as any) = mockReload;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('reload', [1, 2]);
      });

      expect(mockReload).toHaveBeenCalledTimes(2);
      expect(mockReload).toHaveBeenNthCalledWith(1, 1);
      expect(mockReload).toHaveBeenNthCalledWith(2, 2);
    });

    it('newWindowアクション: 新しいウィンドウでタブを開く', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: 2 });
      (chrome.windows.create as any) = mockCreate;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('newWindow', [1, 2]);
      });

      expect(mockCreate).toHaveBeenCalledWith({ tabId: 1 });
      expect(mockCreate).toHaveBeenCalledWith({ tabId: 2 });
    });
  });

  describe('Requirement 12.3: グループ化アクション', () => {
    it('groupアクション: 複数タブをグループ化する', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
      (chrome.runtime.sendMessage as any) = mockSendMessage;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('group', [1, 2, 3]);
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'CREATE_GROUP',
        payload: { tabIds: [1, 2, 3] },
      });
    });

    it('ungroupアクション: グループを解除する', async () => {
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
      (chrome.runtime.sendMessage as any) = mockSendMessage;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('ungroup', [1, 2, 3]);
      });

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'DISSOLVE_GROUP',
        payload: { tabIds: [1, 2, 3] },
      });
    });
  });

  describe('Requirement 12.4: 他のタブを閉じるアクション', () => {
    it('closeOthersアクション: 選択されたタブ以外を閉じる', async () => {
      const mockQuery = vi.fn().mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
        { id: 5 },
      ]);
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      (chrome.tabs.query as any) = mockQuery;
      (chrome.tabs.remove as any) = mockRemove;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('closeOthers', [2, 3]);
      });

      expect(mockQuery).toHaveBeenCalledWith({ currentWindow: true });
      expect(mockRemove).toHaveBeenCalledWith([1, 4, 5]);
    });

    it('closeOthersアクション: 選択されたタブが1つだけの場合', async () => {
      const mockQuery = vi.fn().mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
      ]);
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      (chrome.tabs.query as any) = mockQuery;
      (chrome.tabs.remove as any) = mockRemove;

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('closeOthers', [2]);
      });

      expect(mockRemove).toHaveBeenCalledWith([1, 3]);
    });
  });

  describe('エラーハンドリング', () => {
    it('Chrome API エラー時にエラーをログに出力する', async () => {
      const mockRemove = vi.fn().mockRejectedValue(new Error('API Error'));
      (chrome.tabs.remove as any) = mockRemove;
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
