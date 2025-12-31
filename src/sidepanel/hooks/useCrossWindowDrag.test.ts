/**
 * Task 13.2: useCrossWindowDragフックのテスト
 *
 * Requirements:
 * - 6.1: 別ウィンドウでドラッグ中のタブが新しいウィンドウのツリービューにホバーされたとき、タブを新しいウィンドウに移動
 * - 6.2: クロスウィンドウドラッグが発生したとき、ドロップ位置に応じてツリーにタブを配置
 * - 6.3: クロスウィンドウドラッグはドラッグアウトとして判定されない
 * - 6.4: ドラッグ中のタブが新しいウィンドウのツリービューに入ったとき、元のウィンドウはタブをタブツリーから削除
 * - 6.5: ドラッグ中のタブが新しいウィンドウのツリービューに入ったとき、新しいウィンドウはタブをタブツリーに追加してドラッグ状態で表示
 * - 6.7: Service Worker接続エラーが発生した場合、ドラッグ操作はサイレントにキャンセル
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCrossWindowDrag } from './useCrossWindowDrag';
import type { DragSession } from '@/background/drag-session-manager';

// Mock chrome.windows.getCurrent
const mockGetCurrent = vi.fn();
const mockSendMessage = vi.fn();

// Setup chrome mock
beforeEach(() => {
  global.chrome = {
    windows: {
      getCurrent: mockGetCurrent,
    },
    runtime: {
      sendMessage: mockSendMessage,
    },
  } as never;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('useCrossWindowDrag', () => {
  const createMockDragSession = (overrides: Partial<DragSession> = {}): DragSession => ({
    sessionId: 'test-session-id',
    tabId: 123,
    state: 'dragging_local',
    sourceWindowId: 2,
    currentWindowId: 2,
    startedAt: Date.now(),
    updatedAt: Date.now(),
    treeData: [],
    isLocked: false,
    ...overrides,
  });

  describe('mouseenter event handling', () => {
    it('should check for drag session when mouse enters container', async () => {
      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({ success: true, data: null });
        }
        return Promise.resolve({ success: true });
      });

      const containerRef = { current: document.createElement('div') };
      const onDragReceived = vi.fn();

      renderHook(() =>
        useCrossWindowDrag({
          containerRef,
          onDragReceived,
        })
      );

      // Wait for window ID to be fetched
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Simulate mouseenter event
      await act(async () => {
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          clientX: 100,
          clientY: 200,
          bubbles: true,
        });
        containerRef.current?.dispatchEvent(mouseEnterEvent);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GET_DRAG_SESSION' })
      );
    });

    it('should not trigger onDragReceived when session is idle', async () => {
      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({
            success: true,
            data: createMockDragSession({ state: 'idle' }),
          });
        }
        return Promise.resolve({ success: true });
      });

      const containerRef = { current: document.createElement('div') };
      const onDragReceived = vi.fn();

      renderHook(() =>
        useCrossWindowDrag({
          containerRef,
          onDragReceived,
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          clientX: 100,
          clientY: 200,
          bubbles: true,
        });
        containerRef.current?.dispatchEvent(mouseEnterEvent);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(onDragReceived).not.toHaveBeenCalled();
    });

    it('should not trigger onDragReceived when dragging in same window', async () => {
      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({
            success: true,
            data: createMockDragSession({
              currentWindowId: 1, // Same window
            }),
          });
        }
        return Promise.resolve({ success: true });
      });

      const containerRef = { current: document.createElement('div') };
      const onDragReceived = vi.fn();

      renderHook(() =>
        useCrossWindowDrag({
          containerRef,
          onDragReceived,
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          clientX: 100,
          clientY: 200,
          bubbles: true,
        });
        containerRef.current?.dispatchEvent(mouseEnterEvent);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(onDragReceived).not.toHaveBeenCalled();
    });
  });

  describe('cross-window drag detection', () => {
    it('should begin cross-window move when drag is from different window', async () => {
      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({
            success: true,
            data: createMockDragSession({
              currentWindowId: 2, // Different window
              tabId: 123,
            }),
          });
        }
        if (message.type === 'BEGIN_CROSS_WINDOW_MOVE') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true });
      });

      const containerRef = { current: document.createElement('div') };
      const onDragReceived = vi.fn();

      renderHook(() =>
        useCrossWindowDrag({
          containerRef,
          onDragReceived,
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          clientX: 100,
          clientY: 200,
          bubbles: true,
        });
        containerRef.current?.dispatchEvent(mouseEnterEvent);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'BEGIN_CROSS_WINDOW_MOVE',
          targetWindowId: 1,
        })
      );
    });

    it('should call onDragReceived with tab info after successful move', async () => {
      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({
            success: true,
            data: createMockDragSession({
              currentWindowId: 2,
              tabId: 123,
            }),
          });
        }
        if (message.type === 'BEGIN_CROSS_WINDOW_MOVE') {
          return Promise.resolve({ success: true });
        }
        return Promise.resolve({ success: true });
      });

      const containerRef = { current: document.createElement('div') };
      const onDragReceived = vi.fn();

      renderHook(() =>
        useCrossWindowDrag({
          containerRef,
          onDragReceived,
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          clientX: 100,
          clientY: 200,
          bubbles: true,
        });
        containerRef.current?.dispatchEvent(mouseEnterEvent);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(onDragReceived).toHaveBeenCalledWith(123, { x: 100, y: 200 });
    });
  });

  describe('error handling', () => {
    it('should silently cancel on BEGIN_CROSS_WINDOW_MOVE error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({
            success: true,
            data: createMockDragSession({
              currentWindowId: 2,
              tabId: 123,
            }),
          });
        }
        if (message.type === 'BEGIN_CROSS_WINDOW_MOVE') {
          return Promise.resolve({ success: false, error: 'Tab not found' });
        }
        return Promise.resolve({ success: true });
      });

      const containerRef = { current: document.createElement('div') };
      const onDragReceived = vi.fn();

      renderHook(() =>
        useCrossWindowDrag({
          containerRef,
          onDragReceived,
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          clientX: 100,
          clientY: 200,
          bubbles: true,
        });
        containerRef.current?.dispatchEvent(mouseEnterEvent);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Should log error but not throw
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[CrossWindowDrag] Failed to move tab:',
        'Tab not found'
      );
      // Should not call onDragReceived on error
      expect(onDragReceived).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });

    it('should silently cancel on network error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({
            success: true,
            data: createMockDragSession({
              currentWindowId: 2,
              tabId: 123,
            }),
          });
        }
        if (message.type === 'BEGIN_CROSS_WINDOW_MOVE') {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ success: true });
      });

      const containerRef = { current: document.createElement('div') };
      const onDragReceived = vi.fn();

      renderHook(() =>
        useCrossWindowDrag({
          containerRef,
          onDragReceived,
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      await act(async () => {
        const mouseEnterEvent = new MouseEvent('mouseenter', {
          clientX: 100,
          clientY: 200,
          bubbles: true,
        });
        containerRef.current?.dispatchEvent(mouseEnterEvent);
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      // Should log error but not throw
      expect(consoleErrorSpy).toHaveBeenCalled();
      // Should not call onDragReceived on error
      expect(onDragReceived).not.toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('cleanup', () => {
    it('should remove event listener on unmount', async () => {
      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockResolvedValue({ success: true, data: null });

      const containerRef = { current: document.createElement('div') };
      const removeEventListenerSpy = vi.spyOn(
        containerRef.current,
        'removeEventListener'
      );

      const { unmount } = renderHook(() =>
        useCrossWindowDrag({
          containerRef,
          onDragReceived: vi.fn(),
        })
      );

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        'mouseenter',
        expect.any(Function)
      );
    });
  });
});
