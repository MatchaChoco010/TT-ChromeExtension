import React from 'react';
import { TREE_INDENT_WIDTH_PX } from '../utils';

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

const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  isUnread,
  showIndicator,
  depth = 0,
  className,
}) => {
  if (!showIndicator || !isUnread) {
    return null;
  }

  const indentPx = depth * TREE_INDENT_WIDTH_PX;

  const triangleStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${indentPx}px`,
    bottom: 0,
    width: 0,
    height: 0,
    borderStyle: 'solid',
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
