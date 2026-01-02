import React, { useRef, useCallback } from 'react';
import { useCrossWindowDrag, type Position } from '../hooks/useCrossWindowDrag';

interface CrossWindowDragHandlerProps {
  children: React.ReactNode;
  /** ドラッグ受信時のコールバック（タブID、マウス位置） */
  onDragReceived?: (tabId: number, position: Position) => void;
}

/**
 * Component for handling cross-window drag and drop operations
 * useCrossWindowDragフックを使用したクロスウィンドウドラッグの検知
 *
 * This component:
 * - Monitors mouseenter events on the container
 * - Detects cross-window drag sessions from DragSessionManager
 * - Triggers onDragReceived callback when a tab is dragged from another window
 */
export const CrossWindowDragHandler: React.FC<CrossWindowDragHandlerProps> = ({
  children,
  onDragReceived,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Default callback if not provided
  const handleDragReceived = useCallback(
    (tabId: number, position: Position) => {
      if (onDragReceived) {
        onDragReceived(tabId, position);
      }
    },
    [onDragReceived]
  );

  // Initialize cross-window drag detection
  useCrossWindowDrag({
    containerRef,
    onDragReceived: handleDragReceived,
  });

  return <div ref={containerRef}>{children}</div>;
};

export default CrossWindowDragHandler;
