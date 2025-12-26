import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';
import { CrossWindowDragHandler } from './CrossWindowDragHandler';
import { useCrossWindowDrag } from '../hooks/useCrossWindowDrag';

// Don't mock useCrossWindowDrag for integration test
vi.unmock('../hooks/useCrossWindowDrag');

describe('CrossWindowDragHandler Integration', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockSendMessage = vi.fn((message, callback) => {
      if (callback) {
        callback({ success: true, data: null });
      }
      return true;
    });

    global.chrome = {
      runtime: {
        sendMessage: mockSendMessage,
      },
      windows: {
        getCurrent: vi.fn((callback) => {
          callback({ id: 1 } as chrome.windows.Window);
        }),
      },
    } as never;
  });

  it('should integrate with useCrossWindowDrag hook and get current window ID', async () => {
    render(
      <CrossWindowDragHandler>
        <div>Test Content</div>
      </CrossWindowDragHandler>
    );

    await waitFor(() => {
      expect(global.chrome.windows.getCurrent).toHaveBeenCalled();
    });
  });

  it('should allow drag handlers to be called from integrated hook', async () => {
    const TestComponent = () => {
      const { handleDragStart, handleDragEnd } = useCrossWindowDrag({
        currentWindowId: 1,
      });

      React.useEffect(() => {
        // Simulate drag start
        handleDragStart(123, { nodeId: 'test' });

        // Simulate drag end inside panel
        handleDragEnd(false);
      }, [handleDragStart, handleDragEnd]);

      return <div>Test</div>;
    };

    render(
      <CrossWindowDragHandler>
        <TestComponent />
      </CrossWindowDragHandler>
    );

    await waitFor(() => {
      // Should have called SET_DRAG_STATE
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SET_DRAG_STATE',
        }),
        expect.any(Function)
      );

      // Should have called CLEAR_DRAG_STATE
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CLEAR_DRAG_STATE',
        }),
        expect.any(Function)
      );
    });
  });

  it('should handle drag outside panel scenario', async () => {
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

    const TestComponent = () => {
      const { handleDragEnd } = useCrossWindowDrag({
        currentWindowId: 1,
      });

      React.useEffect(() => {
        // Simulate drag end outside panel
        handleDragEnd(true);
      }, [handleDragEnd]);

      return <div>Test</div>;
    };

    render(
      <CrossWindowDragHandler>
        <TestComponent />
      </CrossWindowDragHandler>
    );

    await waitFor(() => {
      // Should have called CREATE_WINDOW_WITH_TAB
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'CREATE_WINDOW_WITH_TAB',
          payload: { tabId: 123 },
        }),
        expect.any(Function)
      );
    });
  });

  it('should handle drop from other window scenario', async () => {
    mockSendMessage.mockImplementation((message, callback) => {
      if (message.type === 'GET_DRAG_STATE' && callback) {
        callback({
          success: true,
          data: {
            tabId: 456,
            treeData: {},
            sourceWindowId: 2, // Different window
          },
        });
      } else if (callback) {
        callback({ success: true });
      }
      return true;
    });

    const TestComponent = () => {
      const { handleDropFromOtherWindow } = useCrossWindowDrag({
        currentWindowId: 1,
      });

      React.useEffect(() => {
        // Simulate drop from another window
        handleDropFromOtherWindow();
      }, [handleDropFromOtherWindow]);

      return <div>Test</div>;
    };

    render(
      <CrossWindowDragHandler>
        <TestComponent />
      </CrossWindowDragHandler>
    );

    await waitFor(() => {
      // Should have called MOVE_TAB_TO_WINDOW
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MOVE_TAB_TO_WINDOW',
          payload: { tabId: 456, windowId: 1 },
        }),
        expect.any(Function)
      );
    });
  });
});
