import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrossWindowDragHandler } from './CrossWindowDragHandler';
import { useCrossWindowDrag } from '../hooks/useCrossWindowDrag';

// Mock the useCrossWindowDrag hook
vi.mock('../hooks/useCrossWindowDrag', () => ({
  useCrossWindowDrag: vi.fn(),
}));

describe('CrossWindowDragHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chrome.windows API
    global.chrome = {
      windows: {
        getCurrent: vi.fn().mockResolvedValue({ id: 1 }),
      },
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({ success: true, data: null }),
      },
    } as never;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should render children', () => {
    render(
      <CrossWindowDragHandler>
        <div data-testid="child">Test Child</div>
      </CrossWindowDragHandler>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should render children inside a container div', () => {
    const { container } = render(
      <CrossWindowDragHandler>
        <div data-testid="child">Test Child</div>
      </CrossWindowDragHandler>
    );

    // Container should be a div with children
    expect(container.firstChild).toBeInstanceOf(HTMLDivElement);
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should call useCrossWindowDrag with containerRef and onDragReceived', () => {
    const mockedUseCrossWindowDrag = vi.mocked(useCrossWindowDrag);
    const onDragReceived = vi.fn();

    render(
      <CrossWindowDragHandler onDragReceived={onDragReceived}>
        <div>Test</div>
      </CrossWindowDragHandler>
    );

    expect(mockedUseCrossWindowDrag).toHaveBeenCalledWith({
      containerRef: expect.objectContaining({ current: expect.any(HTMLDivElement) }),
      onDragReceived: expect.any(Function),
    });
  });

  it('should work without onDragReceived callback', () => {
    const mockedUseCrossWindowDrag = vi.mocked(useCrossWindowDrag);

    render(
      <CrossWindowDragHandler>
        <div>Test</div>
      </CrossWindowDragHandler>
    );

    expect(mockedUseCrossWindowDrag).toHaveBeenCalledWith({
      containerRef: expect.objectContaining({ current: expect.any(HTMLDivElement) }),
      onDragReceived: expect.any(Function),
    });
  });
});
