/**
 * useDragDepthCalculation フックのユニットテスト
 * Task 4.2: ドラッグ中のdepth計算ロジックを実装する
 * Requirements: 8.3, 8.4, 8.5
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDragDepthCalculation } from './useDragDepthCalculation';
import type { DragMoveEvent, DragStartEvent, DragEndEvent, DragCancelEvent } from '@dnd-kit/core';

// DndMonitorをモック
vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual('@dnd-kit/core');
  return {
    ...actual,
    useDndMonitor: vi.fn((handlers: {
      onDragStart?: (event: DragStartEvent) => void;
      onDragMove?: (event: DragMoveEvent) => void;
      onDragEnd?: (event: DragEndEvent) => void;
      onDragCancel?: (event: DragCancelEvent) => void;
    }) => {
      // ハンドラーをグローバルに保存してテストからアクセス可能にする
      mockHandlers.onDragStart = handlers.onDragStart;
      mockHandlers.onDragMove = handlers.onDragMove;
      mockHandlers.onDragEnd = handlers.onDragEnd;
      mockHandlers.onDragCancel = handlers.onDragCancel;
    }),
  };
});

// テスト用のハンドラー保存場所
const mockHandlers: {
  onDragStart?: (event: DragStartEvent) => void;
  onDragMove?: (event: DragMoveEvent) => void;
  onDragEnd?: (event: DragEndEvent) => void;
  onDragCancel?: (event: DragCancelEvent) => void;
} = {};

// テスト用のイベント作成ヘルパー
const createDragStartEvent = (activeId: string): DragStartEvent => ({
  active: {
    id: activeId,
    data: { current: undefined },
    rect: { current: { initial: null, translated: null } },
  },
  // Minimal mock for DragStartEvent
} as unknown as DragStartEvent);

const createDragMoveEvent = (deltaX: number): DragMoveEvent => ({
  active: {
    id: 'node-1',
    data: { current: undefined },
    rect: { current: { initial: null, translated: null } },
  },
  delta: { x: deltaX, y: 0 },
  // Minimal mock for DragMoveEvent
} as unknown as DragMoveEvent);

const createDragEndEvent = (): DragEndEvent => ({
  active: {
    id: 'node-1',
    data: { current: undefined },
    rect: { current: { initial: null, translated: null } },
  },
  over: null,
  delta: { x: 0, y: 0 },
  // Minimal mock for DragEndEvent
} as unknown as DragEndEvent);

describe('useDragDepthCalculation', () => {
  const defaultOptions = {
    indentWidth: 20,
    maxDepth: 5,
    containerRef: { current: null } as React.RefObject<HTMLDivElement>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockHandlers.onDragStart = undefined;
    mockHandlers.onDragMove = undefined;
    mockHandlers.onDragEnd = undefined;
    mockHandlers.onDragCancel = undefined;
  });

  describe('初期状態', () => {
    it('ドラッグ中でない場合、isDraggingはfalseでdepthは0', () => {
      const { result } = renderHook(() => useDragDepthCalculation(defaultOptions));

      expect(result.current.isDragging).toBe(false);
      expect(result.current.targetDepth).toBe(0);
      expect(result.current.activeNodeId).toBeNull();
    });
  });

  describe('ドラッグ開始', () => {
    it('ドラッグ開始時にisDraggingがtrueになる', () => {
      const { result } = renderHook(() => useDragDepthCalculation(defaultOptions));

      act(() => {
        mockHandlers.onDragStart?.(createDragStartEvent('node-1'));
      });

      expect(result.current.isDragging).toBe(true);
      expect(result.current.activeNodeId).toBe('node-1');
    });
  });

  describe('ドラッグ中のdepth計算', () => {
    it('マウスを右に移動するとdepthが増加する', () => {
      // コンテナのモック（getBoundingClientRectをモック）
      const containerRef = {
        current: {
          getBoundingClientRect: () => ({ left: 0 }),
        } as HTMLDivElement,
      };

      const { result } = renderHook(() =>
        useDragDepthCalculation({
          ...defaultOptions,
          containerRef,
        })
      );

      act(() => {
        mockHandlers.onDragStart?.(createDragStartEvent('node-1'));
      });

      // deltaX=40はインデント幅20の2倍なのでdepth=2になるべき
      act(() => {
        mockHandlers.onDragMove?.(createDragMoveEvent(40));
      });

      expect(result.current.targetDepth).toBe(2);
    });

    it('マウスを左に移動するとdepthが減少する', () => {
      const containerRef = {
        current: {
          getBoundingClientRect: () => ({ left: 0 }),
        } as HTMLDivElement,
      };

      const { result } = renderHook(() =>
        useDragDepthCalculation({
          ...defaultOptions,
          containerRef,
        })
      );

      act(() => {
        mockHandlers.onDragStart?.(createDragStartEvent('node-1'));
      });

      // 最初に右に移動
      act(() => {
        mockHandlers.onDragMove?.(createDragMoveEvent(60));
      });

      expect(result.current.targetDepth).toBe(3);

      // 左に戻る
      act(() => {
        mockHandlers.onDragMove?.(createDragMoveEvent(20));
      });

      expect(result.current.targetDepth).toBe(1);
    });

    it('maxDepthを超えないように制限される', () => {
      const containerRef = {
        current: {
          getBoundingClientRect: () => ({ left: 0 }),
        } as HTMLDivElement,
      };

      const { result } = renderHook(() =>
        useDragDepthCalculation({
          ...defaultOptions,
          maxDepth: 3,
          containerRef,
        })
      );

      act(() => {
        mockHandlers.onDragStart?.(createDragStartEvent('node-1'));
      });

      // 100pxは5インデント分だが、maxDepth=3に制限
      act(() => {
        mockHandlers.onDragMove?.(createDragMoveEvent(100));
      });

      expect(result.current.targetDepth).toBe(3);
    });

    it('負のdepthにならないように0に制限される', () => {
      const containerRef = {
        current: {
          getBoundingClientRect: () => ({ left: 0 }),
        } as HTMLDivElement,
      };

      const { result } = renderHook(() =>
        useDragDepthCalculation({
          ...defaultOptions,
          containerRef,
        })
      );

      act(() => {
        mockHandlers.onDragStart?.(createDragStartEvent('node-1'));
      });

      act(() => {
        mockHandlers.onDragMove?.(createDragMoveEvent(-50));
      });

      expect(result.current.targetDepth).toBe(0);
    });
  });

  describe('ドラッグ終了', () => {
    it('ドラッグ終了時にisDraggingがfalseになる', () => {
      const { result } = renderHook(() => useDragDepthCalculation(defaultOptions));

      act(() => {
        mockHandlers.onDragStart?.(createDragStartEvent('node-1'));
      });

      expect(result.current.isDragging).toBe(true);

      act(() => {
        mockHandlers.onDragEnd?.(createDragEndEvent());
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.activeNodeId).toBeNull();
    });

    it('ドラッグキャンセル時にisDraggingがfalseになる', () => {
      const { result } = renderHook(() => useDragDepthCalculation(defaultOptions));

      act(() => {
        mockHandlers.onDragStart?.(createDragStartEvent('node-1'));
      });

      expect(result.current.isDragging).toBe(true);

      act(() => {
        mockHandlers.onDragCancel?.({} as DragCancelEvent);
      });

      expect(result.current.isDragging).toBe(false);
      expect(result.current.activeNodeId).toBeNull();
    });

    it('ドラッグ終了後にdepthが0にリセットされる', () => {
      const containerRef = {
        current: {
          getBoundingClientRect: () => ({ left: 0 }),
        } as HTMLDivElement,
      };

      const { result } = renderHook(() =>
        useDragDepthCalculation({
          ...defaultOptions,
          containerRef,
        })
      );

      act(() => {
        mockHandlers.onDragStart?.(createDragStartEvent('node-1'));
        mockHandlers.onDragMove?.(createDragMoveEvent(60));
      });

      expect(result.current.targetDepth).toBe(3);

      act(() => {
        mockHandlers.onDragEnd?.(createDragEndEvent());
      });

      expect(result.current.targetDepth).toBe(0);
    });
  });

  describe('コールバック', () => {
    it('onDepthChangeコールバックがdepth変更時に呼ばれる', () => {
      const onDepthChange = vi.fn();
      const containerRef = {
        current: {
          getBoundingClientRect: () => ({ left: 0 }),
        } as HTMLDivElement,
      };

      renderHook(() =>
        useDragDepthCalculation({
          ...defaultOptions,
          containerRef,
          onDepthChange,
        })
      );

      act(() => {
        mockHandlers.onDragStart?.(createDragStartEvent('node-1'));
        mockHandlers.onDragMove?.(createDragMoveEvent(40));
      });

      expect(onDepthChange).toHaveBeenCalledWith(2);
    });

    it('同じdepthでは連続してコールバックが呼ばれない', () => {
      const onDepthChange = vi.fn();
      const containerRef = {
        current: {
          getBoundingClientRect: () => ({ left: 0 }),
        } as HTMLDivElement,
      };

      renderHook(() =>
        useDragDepthCalculation({
          ...defaultOptions,
          containerRef,
          onDepthChange,
        })
      );

      act(() => {
        mockHandlers.onDragStart?.(createDragStartEvent('node-1'));
        mockHandlers.onDragMove?.(createDragMoveEvent(40));
      });

      const callCount = onDepthChange.mock.calls.length;

      // 同じdepth内での移動（40-59pxはすべてdepth=2）
      act(() => {
        mockHandlers.onDragMove?.(createDragMoveEvent(45));
      });

      // コールバックは追加で呼ばれないはず
      expect(onDepthChange).toHaveBeenCalledTimes(callCount);
    });
  });
});
