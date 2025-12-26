import React from 'react';

interface UnreadBadgeProps {
  /** 未読状態かどうか */
  isUnread: boolean;
  /** 未読インジケータを表示するかどうか（設定による制御） */
  showIndicator: boolean;
  /** 未読タブ数（オプション） */
  count?: number;
  /** カスタムクラス名 */
  className?: string;
}

/**
 * UnreadBadge コンポーネント
 *
 * タブの未読状態を示すバッジを表示する
 * Requirements: 7.1, 7.3, 7.4
 */
const UnreadBadge: React.FC<UnreadBadgeProps> = ({
  isUnread,
  showIndicator,
  count,
  className,
}) => {
  // showIndicatorがfalseの場合、または未読でない場合は何も表示しない
  if (!showIndicator || !isUnread) {
    return null;
  }

  // カウント表示の処理
  const displayCount =
    count !== undefined && count > 0
      ? count > 99
        ? '99+'
        : count.toString()
      : null;

  // aria-labelの生成
  const ariaLabel = displayCount ? `Unread (${count})` : 'Unread';

  // カウント表示がある場合は拡張スタイル、ない場合はドット
  const defaultClassName = displayCount
    ? 'ml-2 min-w-[20px] h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 px-1.5'
    : 'ml-2 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0';

  return (
    <div
      data-testid="unread-badge"
      className={className || defaultClassName}
      aria-label={ariaLabel}
      role="status"
    >
      {displayCount && (
        <span
          data-testid="unread-count"
          className="text-xs font-semibold text-white leading-none"
        >
          {displayCount}
        </span>
      )}
    </div>
  );
};

export default UnreadBadge;
