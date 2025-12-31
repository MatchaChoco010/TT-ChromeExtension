import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, act } from '@testing-library/react';
import { CrossWindowDragHandler } from './CrossWindowDragHandler';
import type { DragSession } from '@/background/drag-session-manager';

describe('CrossWindowDragHandler Integration', () => {
  let mockSendMessage: ReturnType<typeof vi.fn>;
  let mockGetCurrent: ReturnType<typeof vi.fn>;

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

  beforeEach(() => {
    vi.clearAllMocks();

    mockSendMessage = vi.fn().mockResolvedValue({ success: true, data: null });
    mockGetCurrent = vi.fn().mockResolvedValue({ id: 1 });

    global.chrome = {
      runtime: {
        sendMessage: mockSendMessage,
      },
      windows: {
        getCurrent: mockGetCurrent,
      },
    } as never;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should integrate with useCrossWindowDrag hook and get current window ID', async () => {
    render(
      <CrossWindowDragHandler>
        <div>Test Content</div>
      </CrossWindowDragHandler>
    );

    await waitFor(() => {
      expect(mockGetCurrent).toHaveBeenCalled();
    });
  });

  it('should render children inside the container div', () => {
    const { getByText } = render(
      <CrossWindowDragHandler>
        <div>Test Content</div>
      </CrossWindowDragHandler>
    );

    expect(getByText('Test Content')).toBeDefined();
  });

  it('should call onDragReceived when cross-window drag is detected', async () => {
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

    const onDragReceived = vi.fn();

    const { container } = render(
      <CrossWindowDragHandler onDragReceived={onDragReceived}>
        <div>Test Content</div>
      </CrossWindowDragHandler>
    );

    // Wait for window ID to be fetched
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Simulate mouseenter event on the container
    const containerDiv = container.firstChild as HTMLDivElement;
    await act(async () => {
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        clientX: 100,
        clientY: 200,
        bubbles: true,
      });
      containerDiv.dispatchEvent(mouseEnterEvent);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GET_DRAG_SESSION' })
      );
    });

    await waitFor(() => {
      expect(onDragReceived).toHaveBeenCalledWith(123, { x: 100, y: 200 });
    });
  });

  it('should not call onDragReceived when drag is from same window', async () => {
    mockSendMessage.mockImplementation((message) => {
      if (message.type === 'GET_DRAG_SESSION') {
        return Promise.resolve({
          success: true,
          data: createMockDragSession({
            currentWindowId: 1, // Same window
            tabId: 123,
          }),
        });
      }
      return Promise.resolve({ success: true });
    });

    const onDragReceived = vi.fn();

    const { container } = render(
      <CrossWindowDragHandler onDragReceived={onDragReceived}>
        <div>Test Content</div>
      </CrossWindowDragHandler>
    );

    // Wait for window ID to be fetched
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Simulate mouseenter event
    const containerDiv = container.firstChild as HTMLDivElement;
    await act(async () => {
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        clientX: 100,
        clientY: 200,
        bubbles: true,
      });
      containerDiv.dispatchEvent(mouseEnterEvent);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GET_DRAG_SESSION' })
      );
    });

    // Should not call onDragReceived for same window drag
    expect(onDragReceived).not.toHaveBeenCalled();
  });

  it('should handle BEGIN_CROSS_WINDOW_MOVE error silently', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

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

    const onDragReceived = vi.fn();

    const { container } = render(
      <CrossWindowDragHandler onDragReceived={onDragReceived}>
        <div>Test Content</div>
      </CrossWindowDragHandler>
    );

    // Wait for window ID to be fetched
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    // Simulate mouseenter event
    const containerDiv = container.firstChild as HTMLDivElement;
    await act(async () => {
      const mouseEnterEvent = new MouseEvent('mouseenter', {
        clientX: 100,
        clientY: 200,
        bubbles: true,
      });
      containerDiv.dispatchEvent(mouseEnterEvent);
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    // Should not call onDragReceived on error
    expect(onDragReceived).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
