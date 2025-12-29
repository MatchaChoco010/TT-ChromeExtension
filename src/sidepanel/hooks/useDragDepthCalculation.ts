/**
 * useDragDepthCalculation フック
 * Task 4.2: ドラッグ中のdepth計算ロジックを実装する
 * Requirements: 8.3, 8.4, 8.5
 *
 * dnd-kitのドラッグイベントを監視し、マウスX座標からドロップ先のdepthを計算する
 */
import { useState, useCallback, useRef } from 'react';
import { useDndMonitor } from '@dnd-kit/core';
import { calculateTargetDepth } from '../utils/calculateTargetDepth';

export interface DragDepthState {
  /** ドラッグ中かどうか */
  isDragging: boolean;
  /** 現在計算されているドロップ先のdepth */
  targetDepth: number;
  /** ドラッグ中のノードID */
  activeNodeId: string | null;
}

export interface UseDragDepthCalculationOptions {
  /** 1段階のインデント幅（ピクセル） */
  indentWidth: number;
  /** 許容される最大depth（デフォルト: 10） */
  maxDepth?: number;
  /** ツリービューコンテナのref（位置計算に使用） */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** depth変更時のコールバック（オプション） */
  onDepthChange?: (depth: number) => void;
}

/**
 * ドラッグ中のマウスX座標からdepthを計算するフック
 *
 * @param options - 設定オプション
 * @returns ドラッグ状態とdepth情報
 */
export const useDragDepthCalculation = (
  options: UseDragDepthCalculationOptions
): DragDepthState => {
  const { indentWidth, maxDepth = 10, containerRef, onDepthChange } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [targetDepth, setTargetDepth] = useState(0);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // 前回のdepthを記憶（コールバックの重複呼び出し防止）
  const lastDepthRef = useRef<number>(0);
  // ドラッグ開始時のマウスX座標を記憶
  const startXRef = useRef<number>(0);

  const handleDragStart = useCallback(
    (event: Parameters<NonNullable<Parameters<typeof useDndMonitor>[0]['onDragStart']>>[0]) => {
      setIsDragging(true);
      setActiveNodeId(event.active.id as string);
      setTargetDepth(0);
      lastDepthRef.current = 0;
      startXRef.current = 0;
    },
    []
  );

  const handleDragMove = useCallback(
    (event: Parameters<NonNullable<Parameters<typeof useDndMonitor>[0]['onDragMove']>>[0]) => {
      const container = containerRef.current;
      if (!container) {
        return;
      }

      // deltaXを使用して現在のマウス相対位置を計算
      // delta.xはドラッグ開始位置からの相対移動量
      const deltaX = event.delta.x;

      // deltaXからdepthを計算
      const newDepth = calculateTargetDepth(
        deltaX,
        0, // deltaXは相対値なのでcontainerLeftは0
        indentWidth,
        maxDepth
      );

      // depthが変わった場合のみ更新
      if (newDepth !== lastDepthRef.current) {
        setTargetDepth(newDepth);
        lastDepthRef.current = newDepth;

        if (onDepthChange) {
          onDepthChange(newDepth);
        }
      }
    },
    [containerRef, indentWidth, maxDepth, onDepthChange]
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    setActiveNodeId(null);
    setTargetDepth(0);
    lastDepthRef.current = 0;
    startXRef.current = 0;
  }, []);

  const handleDragCancel = useCallback(() => {
    setIsDragging(false);
    setActiveNodeId(null);
    setTargetDepth(0);
    lastDepthRef.current = 0;
    startXRef.current = 0;
  }, []);

  // dnd-kitのイベントを監視
  useDndMonitor({
    onDragStart: handleDragStart,
    onDragMove: handleDragMove,
    onDragEnd: handleDragEnd,
    onDragCancel: handleDragCancel,
  });

  return {
    isDragging,
    targetDepth,
    activeNodeId,
  };
};
