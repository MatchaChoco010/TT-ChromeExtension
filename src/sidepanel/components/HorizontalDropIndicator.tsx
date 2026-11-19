import React from 'react';

export interface HorizontalDropIndicatorProps {
  insertIndex: number;
  isVisible: boolean;
  leftPosition: number;
  topPosition?: number;
  height?: number;
}

const HorizontalDropIndicator: React.FC<HorizontalDropIndicatorProps> = ({
  insertIndex,
  isVisible,
  leftPosition,
  topPosition,
  height,
}) => {
  if (!isVisible) {
    return null;
  }

  const verticalStyle: React.CSSProperties =
    topPosition !== undefined && height !== undefined
      ? { top: `${topPosition}px`, height: `${height}px` }
      : { top: '4px', bottom: '4px' };

  return (
    <div
      data-testid="horizontal-drop-indicator"
      data-insert-index={insertIndex}
      className="absolute bg-blue-500 transition-all duration-75 ease-out pointer-events-none"
      style={{
        left: `${leftPosition}px`,
        transform: 'translateX(-50%)',
        width: '2px',
        ...verticalStyle,
      }}
    />
  );
};

export default HorizontalDropIndicator;
