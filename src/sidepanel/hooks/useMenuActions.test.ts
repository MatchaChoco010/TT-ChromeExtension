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
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('close', [1]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CLOSE_TAB',
        payload: { tabId: 1 },
      });
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
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('duplicate', [1]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DUPLICATE_TABS',
        payload: { tabIds: [1] },
      });
    });

    it('複数タブ選択時: タブを複製する', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('duplicate', [1, 2, 3]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DUPLICATE_TABS',
        payload: { tabIds: [1, 2, 3] },
      });
    });

    it('複数タブ選択時（逆順で選択）: タブを複製する', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('duplicate', [3, 2, 1]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DUPLICATE_TABS',
        payload: { tabIds: [3, 2, 1] },
      });
    });

    it('pinアクション: タブをピン留めする', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('pin', [1]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PIN_TABS',
        payload: { tabIds: [1] },
      });
    });

    it('unpinアクション: タブのピン留めを解除する', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('unpin', [1]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'UNPIN_TABS',
        payload: { tabIds: [1] },
      });
    });

    it('reloadアクション: タブを再読み込みする', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('reload', [1, 2]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'RELOAD_TABS',
        payload: { tabIds: [1, 2] },
      });
    });

    it('newWindowアクション: 新しいウィンドウでタブを開く', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('newWindow', [1, 2]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_TABS_TO_NEW_WINDOW',
        payload: { tabIds: [1, 2] },
      });
    });

    it('newWindowアクション: 単一タブを新しいウィンドウで開く', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('newWindow', [1]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_TABS_TO_NEW_WINDOW',
        payload: { tabIds: [1] },
      });
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
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('closeOthers', [2, 3]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CLOSE_OTHER_TABS',
        payload: { excludeTabIds: [2, 3] },
      });
    });

    it('closeOthersアクション: 選択されたタブが1つだけの場合', async () => {
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useMenuActions());

      await act(async () => {
        await result.current.executeAction('closeOthers', [2]);
      });

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CLOSE_OTHER_TABS',
        payload: { excludeTabIds: [2] },
      });
    });
  });

  describe('エラーハンドリング', () => {
    it('Chrome API エラー時にエラーをログに出力する', async () => {
      chromeMock.runtime.sendMessage.mockRejectedValue(new Error('API Error'));
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
