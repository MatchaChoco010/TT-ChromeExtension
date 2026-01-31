import React from 'react';

export interface HorizontalDropIndicatorProps {
  insertIndex: number;
  isVisible: boolean;
  leftPosition: number;
}

const HorizontalDropIndicator: React.FC<HorizontalDropIndicatorProps> = ({
  insertIndex,
  isVisible,
  leftPosition,
}) => {
  if (!isVisible) {
    return null;
  }

  return (
    <div
      data-testid="horizontal-drop-indicator"
      data-insert-index={insertIndex}
      className="absolute bg-blue-500 transition-all duration-75 ease-out pointer-events-none"
      style={{
        left: `${leftPosition}px`,
        width: '2px',
        top: '4px',
        bottom: '4px',
      }}
    />
  );
};

export default HorizontalDropIndicator;
