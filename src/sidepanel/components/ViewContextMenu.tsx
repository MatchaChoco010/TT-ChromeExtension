/**
 * ViewContextMenu コンポーネント
 * Task 7.3: ビューボタンの右クリックコンテキストメニューの実装
 * Requirements: 3.3, 3.4
 *
 * ビューボタンを右クリックした際に表示されるコンテキストメニューを提供します。
 * メニューから「ビューの編集」を選択するとViewEditModalを開き、
 * 「ビューの削除」を選択するとビューを削除します。
 */

import React, { useEffect, useRef, useMemo } from 'react';
import type { View } from '@/types';

/**
 * ビューコンテキストメニューのアクション型
 */
export type ViewMenuAction = 'edit' | 'delete';

export interface ViewContextMenuProps {
  /** 対象のビュー */
  view: View;
  /** メニューの表示位置 */
  position: { x: number; y: number };
  /** 編集アクションのコールバック */
  onEdit: (view: View) => void;
  /** 削除アクションのコールバック */
  onDelete: (viewId: string) => void;
  /** メニューを閉じるコールバック */
  onClose: () => void;
  /** 最後のビューかどうか（最後のビューは削除不可） */
  isLastView?: boolean;
}

/**
 * ViewContextMenu コンポーネント
 *
 * ビューボタンの右クリックメニューを提供します。
 * - ビューの編集: ViewEditModalを開く
 * - ビューの削除: ビューを削除する（最後のビューは削除不可）
 */
export const ViewContextMenu: React.FC<ViewContextMenuProps> = ({
  view,
  position,
  onEdit,
  onDelete,
  onClose,
  isLastView = false,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);

  // 画面端での位置調整
  const adjustedPosition = useMemo(() => {
    const menuWidth = 160; // メニューの推定幅
    const menuHeight = 80; // メニューの推定高さ

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

  const handleEdit = () => {
    onEdit(view);
    onClose();
  };

  const handleDelete = () => {
    if (!isLastView) {
      onDelete(view.id);
      onClose();
    }
  };

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 min-w-[160px]"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
      data-testid="view-context-menu"
    >
      {/* ビューを編集 */}
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100 flex items-center gap-2"
        onClick={handleEdit}
      >
        {/* 編集アイコン */}
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
          />
        </svg>
        ビューを編集
      </button>

      <div className="border-t border-gray-700 my-1" />

      {/* ビューを削除 */}
      <button
        role="menuitem"
        className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 ${
          isLastView
            ? 'text-gray-500 cursor-not-allowed'
            : 'hover:bg-gray-700 text-red-400'
        }`}
        onClick={handleDelete}
        disabled={isLastView}
        title={isLastView ? '最後のビューは削除できません' : undefined}
      >
        {/* 削除アイコン */}
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
          />
        </svg>
        ビューを削除
      </button>
    </div>
  );
};

export default ViewContextMenu;
