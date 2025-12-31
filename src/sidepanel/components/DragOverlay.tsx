/**
 * Task 6.3: DragOverlayコンポーネント
 *
 * Requirement 3.1.4: ドラッグ中の要素をマウスカーソルに追従させること
 *
 * ReactDOM.createPortalでbody直下に描画し、
 * コンテナのoverflow:hiddenに影響されないようにする。
 * pointer-events: noneでマウスイベントを透過し、
 * transformでマウス位置に追従する。
 */

import React from 'react';
import { createPortal } from 'react-dom';

/**
 * DragOverlayコンポーネントのprops
 */
export interface DragOverlayProps {
  /** ドラッグ中かどうか */
  isDragging: boolean;
  /** ドラッグ中の要素の内容 */
  children: React.ReactNode;
  /** 現在のマウス位置 */
  position: { x: number; y: number };
  /** 要素内でのクリック位置オフセット */
  offset: { x: number; y: number };
}

/**
 * ドラッグ中の要素をReactPortalでbody直下に描画
 * これによりコンテナのoverflow:hiddenに影響されない
 */
export const DragOverlay: React.FC<DragOverlayProps> = ({
  isDragging,
  children,
  position,
  offset,
}) => {
  if (!isDragging) {
    return null;
  }

  // 位置計算: position - offset
  const x = position.x - offset.x;
  const y = position.y - offset.y;

  return createPortal(
    <div
      data-testid="drag-overlay"
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        transform: `translate3d(${x}px, ${y}px, 0px)`,
        pointerEvents: 'none',
        zIndex: 9999,
        willChange: 'transform',
      }}
    >
      <div className="opacity-80 shadow-lg">
        {children}
      </div>
    </div>,
    document.body
  );
};
