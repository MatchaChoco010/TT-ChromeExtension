import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CrossWindowDragHandler } from './CrossWindowDragHandler';
import React from 'react';

// Mock the useCrossWindowDrag hook
vi.mock('../hooks/useCrossWindowDrag', () => ({
  useCrossWindowDrag: vi.fn(() => ({
    handleDragStart: vi.fn(),
    handleDragEnd: vi.fn(),
    handleDropFromOtherWindow: vi.fn(),
  })),
}));

describe('CrossWindowDragHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock chrome.windows API
    global.chrome = {
      windows: {
        getCurrent: vi.fn((callback) => {
          callback({ id: 1 } as chrome.windows.Window);
        }),
      },
    } as never;
  });

  it('should render children', () => {
    render(
      <CrossWindowDragHandler>
        <div data-testid="child">Test Child</div>
      </CrossWindowDragHandler>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('should get current window ID on mount', () => {
    const getCurrent = vi.fn((callback) => {
      callback({ id: 1 } as chrome.windows.Window);
    });

    global.chrome = {
      windows: {
        getCurrent,
      },
    } as never;

    render(
      <CrossWindowDragHandler>
        <div>Test</div>
      </CrossWindowDragHandler>
    );

    expect(getCurrent).toHaveBeenCalled();
  });

  it('should handle errors when getting current window', () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const getCurrent = vi.fn(() => {
      throw new Error('Test error');
    });

    global.chrome = {
      windows: {
        getCurrent,
      },
    } as never;

    render(
      <CrossWindowDragHandler>
        <div>Test</div>
      </CrossWindowDragHandler>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error getting current window:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
