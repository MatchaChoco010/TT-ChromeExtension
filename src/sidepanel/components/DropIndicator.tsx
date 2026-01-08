import React from 'react';

export interface DropIndicatorProps {
  targetIndex: number;
  targetDepth: number;
  indentWidth: number;
  isVisible: boolean;
  containerPadding?: number;
  topPosition?: number;
}
const DropIndicator: React.FC<DropIndicatorProps> = ({
  targetIndex,
  targetDepth,
  indentWidth,
  isVisible,
  containerPadding = 8,
  topPosition,
}) => {
  if (!isVisible) {
    return null;
  }

  const leftPosition = containerPadding + targetDepth * indentWidth;

  return (
    <div
      data-testid="drop-indicator"
      data-target-index={targetIndex}
      data-target-depth={targetDepth}
      className="absolute bg-blue-500 transition-all duration-75 ease-out pointer-events-none"
      style={{
        left: `${leftPosition}px`,
        right: '8px',
        height: '2px',
        top: topPosition !== undefined ? `${topPosition}px` : undefined,
      }}
    />
  );
};

export default DropIndicator;
