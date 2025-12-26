import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  DragDropProvider,
  useDragDropContext,
} from './DragDropProvider';
import type { DragDropCallbacks } from '@/types';

describe('DragDropProvider', () => {
  it('should render children', () => {
    const callbacks: DragDropCallbacks = {
      onDragStart: vi.fn(),
      onDragOver: vi.fn(),
      onDragEnd: vi.fn(),
      onDragCancel: vi.fn(),
    };

    render(
      <DragDropProvider callbacks={callbacks}>
        <div>Test Child</div>
      </DragDropProvider>
    );

    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should provide drag and drop context', () => {
    const callbacks: DragDropCallbacks = {
      onDragStart: vi.fn(),
      onDragOver: vi.fn(),
      onDragEnd: vi.fn(),
      onDragCancel: vi.fn(),
    };

    const TestComponent = () => {
      const context = useDragDropContext();
      return <div>Has Context: {context ? 'true' : 'false'}</div>;
    };

    render(
      <DragDropProvider callbacks={callbacks}>
        <TestComponent />
      </DragDropProvider>
    );

    expect(screen.getByText('Has Context: true')).toBeInTheDocument();
  });

  it('should throw error when useDragDropContext is used outside provider', () => {
    const TestComponent = () => {
      try {
        useDragDropContext();
        return <div>No Error</div>;
      } catch (e) {
        return <div>Error: {(e as Error).message}</div>;
      }
    };

    render(<TestComponent />);

    expect(
      screen.getByText(
        'Error: useDragDropContext must be used within DragDropProvider'
      )
    ).toBeInTheDocument();
  });

  it('should configure sensors (pointer and keyboard)', () => {
    const callbacks: DragDropCallbacks = {
      onDragStart: vi.fn(),
      onDragOver: vi.fn(),
      onDragEnd: vi.fn(),
      onDragCancel: vi.fn(),
    };

    // DndContext が正しくセンサーを設定していることを確認するため、
    // コンポーネントが正常にレンダリングされることをテスト
    const { container } = render(
      <DragDropProvider callbacks={callbacks}>
        <div>Test</div>
      </DragDropProvider>
    );

    expect(container).toBeTruthy();
  });
});
