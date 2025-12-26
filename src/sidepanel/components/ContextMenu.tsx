import React, { useEffect, useRef } from 'react';
import type { MenuAction, ContextMenuProps } from '@/types';

// Re-export MenuAction for backward compatibility
export type { MenuAction };

export const ContextMenu: React.FC<ContextMenuProps> = ({
  targetTabIds,
  position,
  onAction,
  onClose,
  isPinned = false,
  isGrouped = false,
  hasChildren = false,
  tabUrl,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const isMultipleSelection = targetTabIds.length > 1;

  // 画面端での位置調整
  const adjustedPosition = React.useMemo(() => {
    const menuWidth = 200; // メニューの推定幅
    const menuHeight = 300; // メニューの推定高さ

    let { x, y } = position;

    // 右端を超える場合は左に調整
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }

    // 下端を超える場合は上に調整
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    // 最小位置を保証
    x = Math.max(10, x);
    y = Math.max(10, y);

    return { x, y };
  }, [position]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // クリックイベントを非同期で登録（現在のクリックイベントが終わった後）
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Escapeキーで閉じる
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleMenuItemClick = (action: MenuAction) => {
    onAction(action);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg py-2 min-w-[200px]"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      {/* 閉じる */}
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
        onClick={() => handleMenuItemClick('close')}
      >
        {isMultipleSelection
          ? `選択されたタブを閉じる (${targetTabIds.length}件)`
          : 'タブを閉じる'}
      </button>

      {/* サブツリーを閉じる（子タブがある場合のみ） */}
      {hasChildren && (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
          onClick={() => handleMenuItemClick('closeSubtree')}
        >
          サブツリーを閉じる
        </button>
      )}

      {/* 他のタブを閉じる (複数選択時のみ) */}
      {isMultipleSelection && (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
          onClick={() => handleMenuItemClick('closeOthers')}
        >
          他のタブを閉じる
        </button>
      )}

      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

      {/* 複製 */}
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
        onClick={() => handleMenuItemClick('duplicate')}
      >
        タブを複製
      </button>

      {/* 再読み込み */}
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
        onClick={() => handleMenuItemClick('reload')}
      >
        タブを再読み込み
      </button>

      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

      {/* ピン留め/ピン留め解除 */}
      {isPinned ? (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
          onClick={() => handleMenuItemClick('unpin')}
        >
          ピン留めを解除
        </button>
      ) : (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
          onClick={() => handleMenuItemClick('pin')}
        >
          タブをピン留め
        </button>
      )}

      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

      {/* 新しいウィンドウで開く */}
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
        onClick={() => handleMenuItemClick('newWindow')}
      >
        新しいウィンドウで開く
      </button>

      <div className="border-t border-gray-200 dark:border-gray-600 my-1" />

      {/* グループ化/グループ解除 */}
      {isGrouped ? (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
          onClick={() => handleMenuItemClick('ungroup')}
        >
          グループを解除
        </button>
      ) : (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
          onClick={() => handleMenuItemClick('group')}
        >
          {isMultipleSelection ? 'タブをグループ化' : 'グループに追加'}
        </button>
      )}

      {/* URLをコピー（単一選択時のみ） */}
      {!isMultipleSelection && tabUrl && (
        <>
          <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
          <button
            role="menuitem"
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
            onClick={() => handleMenuItemClick('copyUrl')}
          >
            URLをコピー
          </button>
        </>
      )}
    </div>
  );
};
