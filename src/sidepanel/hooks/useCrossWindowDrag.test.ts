import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCrossWindowDrag } from './useCrossWindowDrag';

describe('useCrossWindowDrag', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock chrome.runtime.sendMessage
    mockSendMessage = vi.fn((message, callback) => {
      if (callback) {
        callback({ success: true });
      }
      return true;
    });

    global.chrome = {
      runtime: {
        sendMessage: mockSendMessage,
      },
    } as never;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('handleDragStart', () => {
    it('should set drag state in service worker when drag starts', async () => {
      const { result } = renderHook(() =>
        useCrossWindowDrag({
          currentWindowId: 1,
        })
      );

      const tabId = 123;
      const treeData = { nodeId: 'node-1', children: [] };

      await act(async () => {
        await result.current.handleDragStart(tabId, treeData);
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        {
          type: 'SET_DRAG_STATE',
          payload: {
            tabId,
            treeData,
            sourceWindowId: 1,
          },
        },
        expect.any(Function)
      );
    });

    it('should handle errors when setting drag state fails', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      mockSendMessage.mockImplementation((message, callback) => {
        if (callback) {
          callback({ success: false, error: 'Test error' });
        }
        return true;
      });

      const { result } = renderHook(() =>
        useCrossWindowDrag({
          currentWindowId: 1,
        })
      );

      await act(async () => {
        await result.current.handleDragStart(123, {});
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to set drag state:',
        'Test error'
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleDragEnd', () => {
    it('should clear drag state when drag ends inside panel', async () => {
      const { result } = renderHook(() =>
        useCrossWindowDrag({
          currentWindowId: 1,
        })
      );

      await act(async () => {
        await result.current.handleDragEnd(false);
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        {
          type: 'CLEAR_DRAG_STATE',
        },
        expect.any(Function)
      );
    });

    it('should detect drag outside panel and get drag state', async () => {
      // Mock GET_DRAG_STATE response
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_DRAG_STATE' && callback) {
          callback({
            success: true,
            data: {
              tabId: 123,
              treeData: {},
              sourceWindowId: 1,
            },
          });
        } else if (callback) {
          callback({ success: true });
        }
        return true;
      });

      const { result } = renderHook(() =>
        useCrossWindowDrag({
          currentWindowId: 1,
        })
      );

      await act(async () => {
        await result.current.handleDragEnd(true);
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        {
          type: 'GET_DRAG_STATE',
        },
        expect.any(Function)
      );

      // Should clear drag state after handling
      expect(mockSendMessage).toHaveBeenCalledWith(
        {
          type: 'CLEAR_DRAG_STATE',
        },
        expect.any(Function)
      );
    });

    it('should create new window when dragged outside panel', async () => {
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_DRAG_STATE' && callback) {
          callback({
            success: true,
            data: {
              tabId: 123,
              treeData: {},
              sourceWindowId: 1,
            },
          });
        } else if (callback) {
          callback({ success: true });
        }
        return true;
      });

      const { result } = renderHook(() =>
        useCrossWindowDrag({
          currentWindowId: 1,
        })
      );

      await act(async () => {
        await result.current.handleDragEnd(true);
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        {
          type: 'CREATE_WINDOW_WITH_TAB',
          payload: { tabId: 123 },
        },
        expect.any(Function)
      );
    });
  });

  describe('handleDropFromOtherWindow', () => {
    it('should move tab to current window when dropped from another window', async () => {
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_DRAG_STATE' && callback) {
          callback({
            success: true,
            data: {
              tabId: 123,
              treeData: {},
              sourceWindowId: 2, // Different window
            },
          });
        } else if (callback) {
          callback({ success: true });
        }
        return true;
      });

      const { result } = renderHook(() =>
        useCrossWindowDrag({
          currentWindowId: 1,
        })
      );

      await act(async () => {
        await result.current.handleDropFromOtherWindow();
      });

      expect(mockSendMessage).toHaveBeenCalledWith(
        {
          type: 'MOVE_TAB_TO_WINDOW',
          payload: { tabId: 123, windowId: 1 },
        },
        expect.any(Function)
      );

      // Should clear drag state after moving
      expect(mockSendMessage).toHaveBeenCalledWith(
        {
          type: 'CLEAR_DRAG_STATE',
        },
        expect.any(Function)
      );
    });

    it('should not move tab if drag state is null', async () => {
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_DRAG_STATE' && callback) {
          callback({ success: true, data: null });
        } else if (callback) {
          callback({ success: true });
        }
        return true;
      });

      const { result } = renderHook(() =>
        useCrossWindowDrag({
          currentWindowId: 1,
        })
      );

      await act(async () => {
        await result.current.handleDropFromOtherWindow();
      });

      // Should only call GET_DRAG_STATE
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(
        {
          type: 'GET_DRAG_STATE',
        },
        expect.any(Function)
      );
    });

    it('should not move tab if source window is the same as current window', async () => {
      mockSendMessage.mockImplementation((message, callback) => {
        if (message.type === 'GET_DRAG_STATE' && callback) {
          callback({
            success: true,
            data: {
              tabId: 123,
              treeData: {},
              sourceWindowId: 1, // Same window
            },
          });
        } else if (callback) {
          callback({ success: true });
        }
        return true;
      });

      const { result } = renderHook(() =>
        useCrossWindowDrag({
          currentWindowId: 1,
        })
      );

      await act(async () => {
        await result.current.handleDropFromOtherWindow();
      });

      // Should only call GET_DRAG_STATE
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
      expect(mockSendMessage).toHaveBeenCalledWith(
        {
          type: 'GET_DRAG_STATE',
        },
        expect.any(Function)
      );
    });
  });
});
