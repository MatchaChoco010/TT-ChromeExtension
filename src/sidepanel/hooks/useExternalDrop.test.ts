import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExternalDrop } from './useExternalDrop';

// Chrome API モック
const mockSendMessage = vi.fn();
vi.mock('webextension-polyfill', () => ({
  default: {
    runtime: {
      sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    },
  },
}));

// グローバルchrome APIモック
const mockChromeSendMessage = vi.fn();
beforeEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).chrome = {
    runtime: {
      sendMessage: mockChromeSendMessage,
    },
  };
  mockChromeSendMessage.mockClear();
});

afterEach(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (globalThis as any).chrome;
});

describe('useExternalDrop', () => {
  describe('Task 5.2: 新規ウィンドウ作成機能', () => {
    it('handleExternalDropを呼び出すとCREATE_WINDOW_WITH_SUBTREEメッセージが送信される', async () => {
      mockChromeSendMessage.mockResolvedValue({ success: true, data: null });

      const { result } = renderHook(() => useExternalDrop());

      await act(async () => {
        await result.current.handleExternalDrop(123);
      });

      expect(mockChromeSendMessage).toHaveBeenCalledWith({
        type: 'CREATE_WINDOW_WITH_SUBTREE',
        payload: { tabId: 123 },
      });
    });

    it('送信に失敗した場合はエラーがコンソールに出力される', async () => {
      mockChromeSendMessage.mockResolvedValue({ success: false, error: 'Failed to create window' });
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useExternalDrop());

      await act(async () => {
        await result.current.handleExternalDrop(123);
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to create window with subtree:',
        'Failed to create window'
      );
      consoleErrorSpy.mockRestore();
    });

    it('handleExternalDropがnullのtabIdを受け取った場合は何もしない', async () => {
      const { result } = renderHook(() => useExternalDrop());

      await act(async () => {
        await result.current.handleExternalDrop(null);
      });

      expect(mockChromeSendMessage).not.toHaveBeenCalled();
    });

    it('handleExternalDropがundefinedのtabIdを受け取った場合は何もしない', async () => {
      const { result } = renderHook(() => useExternalDrop());

      await act(async () => {
        await result.current.handleExternalDrop(undefined);
      });

      expect(mockChromeSendMessage).not.toHaveBeenCalled();
    });
  });

  describe('isDragging状態管理', () => {
    it('setIsDraggingでドラッグ状態を設定できる', () => {
      const { result } = renderHook(() => useExternalDrop());

      expect(result.current.isDragging).toBe(false);

      act(() => {
        result.current.setIsDragging(true);
      });

      expect(result.current.isDragging).toBe(true);

      act(() => {
        result.current.setIsDragging(false);
      });

      expect(result.current.isDragging).toBe(false);
    });
  });

  describe('activeTabId状態管理', () => {
    it('setActiveTabIdでドラッグ中のタブIDを設定できる', () => {
      const { result } = renderHook(() => useExternalDrop());

      expect(result.current.activeTabId).toBeNull();

      act(() => {
        result.current.setActiveTabId(123);
      });

      expect(result.current.activeTabId).toBe(123);

      act(() => {
        result.current.setActiveTabId(null);
      });

      expect(result.current.activeTabId).toBeNull();
    });
  });

  describe('onExternalDropコールバック', () => {
    it('onExternalDropが呼び出されるとactiveTabIdを使ってhandleExternalDropが実行される', async () => {
      mockChromeSendMessage.mockResolvedValue({ success: true, data: null });

      const { result } = renderHook(() => useExternalDrop());

      // ドラッグ中のタブIDを設定
      act(() => {
        result.current.setActiveTabId(456);
        result.current.setIsDragging(true);
      });

      // ドロップを実行
      await act(async () => {
        await result.current.onExternalDrop();
      });

      expect(mockChromeSendMessage).toHaveBeenCalledWith({
        type: 'CREATE_WINDOW_WITH_SUBTREE',
        payload: { tabId: 456 },
      });
    });

    it('activeTabIdがnullの場合はonExternalDropが何もしない', async () => {
      const { result } = renderHook(() => useExternalDrop());

      // activeTabIdはnullのまま

      await act(async () => {
        await result.current.onExternalDrop();
      });

      expect(mockChromeSendMessage).not.toHaveBeenCalled();
    });
  });
});
