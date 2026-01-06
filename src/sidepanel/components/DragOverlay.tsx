import React from 'react';
import { createPortal } from 'react-dom';

export interface DragOverlayProps {
  isDragging: boolean;
  children: React.ReactNode;
  position: { x: number; y: number };
  offset: { x: number; y: number };
}

export const DragOverlay: React.FC<DragOverlayProps> = ({
  isDragging,
  children,
  position,
  offset,
}) => {
  if (!isDragging) {
    return null;
  }

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
