import React from 'react';

interface UnreadBadgeProps {
  /** 未読状態かどうか */
  isUnread: boolean;
  /** 未読インジケータを表示するかどうか（設定による制御） */
  showIndicator: boolean;
  /** タブの階層深度（インジケーター位置の調整に使用） */
  depth?: number;
  /** カスタムクラス名 */
  className?: string;
}

/**
 * UnreadBadge コンポーネント
 *
 * タブの未読状態を示す三角形切り欠きインジケーターを表示する
 * Requirements: 8.1, 8.2, 8.3, 9.1, 9.2, 9.3
 *
 * - 左下角に小さな三角形の切り欠きとして表示
 * - タブ要素に重なる形で配置
 * - 既読状態への変化時に非表示化
 * - タブのdepthに応じた位置にインデント表示
 */
const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  isUnread,
  showIndicator,
  depth = 0,
  className,
}) => {
  // showIndicatorがfalseの場合、または未読でない場合は何も表示しない
  if (!showIndicator || !isUnread) {
    return null;
  }

  // depthに応じたインデント計算（TreeNodeと同じ20px/depth）
  const indentPx = depth * 20;

  // 三角形切り欠きスタイル（CSS border-based triangle technique）
  // 左下角に配置される三角形（depthに応じてインデント）
  const triangleStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${indentPx}px`,
    bottom: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
    // 右上を向いた三角形（左下角に配置）
    // borderWidth: top right bottom left
    borderWidth: '0 8px 8px 0',
    borderColor: 'transparent transparent #3b82f6 transparent',
  };

  return (
    <div
      data-testid="unread-badge"
      className={className}
      style={triangleStyle}
      aria-label="Unread"
      role="status"
    />
  );
};

export default UnreadBadge;
