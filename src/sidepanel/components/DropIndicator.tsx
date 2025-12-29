/**
 * DropIndicatorコンポーネント
 * Task 4.1: ドロップ位置とdepthを視覚的に表示する水平線インジケーター
 * Requirements: 7.2 (隙間のハイライト表示), 8.4 (depthの視覚的表示), 16.4 (インジケーターでドロップ先を表示)
 */
import React from 'react';

export interface DropIndicatorProps {
  /** ドロップ位置のインデックス（親コンポーネントで位置計算に使用） */
  targetIndex: number;
  /** ドロップ先のdepth（インデント計算に使用） */
  targetDepth: number;
  /** インデント幅（ピクセル） */
  indentWidth: number;
  /** インジケーターの表示/非表示 */
  isVisible: boolean;
  /** コンテナの左パディング（デフォルト: 8px） */
  containerPadding?: number;
}

/**
 * ドロップ位置を示す水平線インジケーター
 * - ドラッグ中のみ表示
 * - インデント幅に応じて左位置を計算し、depthを視覚化
 * - 高速なマウス移動時のちらつき防止のためtransition効果を適用
 */
const DropIndicator: React.FC<DropIndicatorProps> = ({
  targetIndex,
  targetDepth,
  indentWidth,
  isVisible,
  containerPadding = 8,
}) => {
  if (!isVisible) {
    return null;
  }

  // 左位置の計算: containerPadding + depth * indentWidth
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
      }}
    />
  );
};

export default DropIndicator;
