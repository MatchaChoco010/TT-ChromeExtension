/**
 * Task 13.2: useCrossWindowDragフックのテスト
 * Task 7.2 (comprehensive-bugfix): mousemoveによるホバー検知テストを追加
 *
 * Requirements:
 * - 6.1: 別ウィンドウでドラッグ中のタブが新しいウィンドウのツリービューにホバーされたとき、タブを新しいウィンドウに移動
 * - 6.2: クロスウィンドウドラッグが発生したとき、ドロップ位置に応じてツリーにタブを配置
 * - 6.3: クロスウィンドウドラッグはドラッグアウトとして判定されない
 * - 6.4: ドラッグ中のタブが新しいウィンドウのツリービューに入ったとき、元のウィンドウはタブをタブツリーから削除
 * - 6.5: ドラッグ中のタブが新しいウィンドウのツリービューに入ったとき、新しいウィンドウはタブをタブツリーに追加してドラッグ状態で表示
 * - 6.7: Service Worker接続エラーが発生した場合、ドラッグ操作はサイレントにキャンセル
 * - 4.4 (Task 7.2): mousemoveイベントでホバー検知し、別ウィンドウへのフォーカス移動を通知
 * - 4.5 (Task 7.2): バックグラウンドスロットリング回避のためのフォーカス移動
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
    isOutsideTree: false,
    currentHoverWindowId: null,
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

  /**
   * Task 7.2 (comprehensive-bugfix): mousemoveイベントによるホバー検知テスト
   * Requirements: 4.4, 4.5
   */
  describe('Task 7.2: mousemove event handling for hover detection', () => {
    it('should notify tree view hover on mousemove when session is from different window', async () => {
      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({
            success: true,
            data: createMockDragSession({
              sourceWindowId: 2, // Different window
              currentWindowId: 2,
            }),
          });
        }
        if (message.type === 'NOTIFY_TREE_VIEW_HOVER') {
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

      // Wait for window ID to be fetched and initial session polling
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Simulate mousemove event
      await act(async () => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 100,
          clientY: 200,
          bubbles: true,
        });
        containerRef.current?.dispatchEvent(mouseMoveEvent);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOTIFY_TREE_VIEW_HOVER',
          payload: { windowId: 1 },
        })
      );
    });

    it('should not notify hover when session is from same window', async () => {
      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({
            success: true,
            data: createMockDragSession({
              sourceWindowId: 1, // Same window
              currentWindowId: 1,
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

      // Wait for window ID and session polling
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Clear mock calls to only track new ones
      mockSendMessage.mockClear();

      // Simulate mousemove event
      await act(async () => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 100,
          clientY: 200,
          bubbles: true,
        });
        containerRef.current?.dispatchEvent(mouseMoveEvent);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should not have sent NOTIFY_TREE_VIEW_HOVER
      expect(mockSendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOTIFY_TREE_VIEW_HOVER',
        })
      );
    });

    it('should not send duplicate notifications for same window', async () => {
      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({
            success: true,
            data: createMockDragSession({
              sourceWindowId: 2,
              currentWindowId: 2,
            }),
          });
        }
        if (message.type === 'NOTIFY_TREE_VIEW_HOVER') {
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

      // Wait for window ID and session polling
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Clear mock calls
      mockSendMessage.mockClear();

      // Simulate multiple mousemove events
      await act(async () => {
        for (let i = 0; i < 5; i++) {
          const mouseMoveEvent = new MouseEvent('mousemove', {
            clientX: 100 + i,
            clientY: 200 + i,
            bubbles: true,
          });
          containerRef.current?.dispatchEvent(mouseMoveEvent);
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Should only send NOTIFY_TREE_VIEW_HOVER once (due to duplicate prevention)
      const hoverNotifications = mockSendMessage.mock.calls.filter(
        (call) => call[0]?.type === 'NOTIFY_TREE_VIEW_HOVER'
      );
      expect(hoverNotifications.length).toBe(1);
    });

    it('should not notify when no session is active', async () => {
      mockGetCurrent.mockResolvedValue({ id: 1 });
      mockSendMessage.mockImplementation((message) => {
        if (message.type === 'GET_DRAG_SESSION') {
          return Promise.resolve({
            success: true,
            data: null, // No session
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

      // Wait for window ID and session polling
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
      });

      // Clear mock calls
      mockSendMessage.mockClear();

      // Simulate mousemove event
      await act(async () => {
        const mouseMoveEvent = new MouseEvent('mousemove', {
          clientX: 100,
          clientY: 200,
          bubbles: true,
        });
        containerRef.current?.dispatchEvent(mouseMoveEvent);
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(mockSendMessage).not.toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'NOTIFY_TREE_VIEW_HOVER',
        })
      );
    });

    it('should remove mousemove event listener on unmount', async () => {
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
        'mousemove',
        expect.any(Function)
      );
    });
  });
});
