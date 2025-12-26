/**
 * ViewSwitcher コンポーネント
 * Task 8.2: ViewSwitcher UI コンポーネントの実装
 * Task 8.3: ビューのカスタマイズ機能の実装
 * Requirements: 6.3, 6.4
 *
 * サイドパネル上部で複数のビューを切り替えるUIを提供します。
 */

import React, { useState } from 'react';
import type { View } from '@/types';

export interface ViewSwitcherProps {
  /** すべてのビュー */
  views: View[];
  /** 現在アクティブなビューのID */
  currentViewId: string;
  /** ビュー切り替え時のコールバック */
  onViewSwitch: (viewId: string) => void;
  /** 新しいビュー作成時のコールバック */
  onViewCreate: () => void;
  /** ビュー削除時のコールバック */
  onViewDelete: (viewId: string) => void;
  /** ビュー更新時のコールバック */
  onViewUpdate: (viewId: string, updates: Partial<View>) => void;
}

/**
 * ViewSwitcher コンポーネント
 *
 * サイドパネル上部に横スクロール可能なビュータブバーを表示し、
 * ユーザーがビューを切り替えたり、新しいビューを作成したりできるようにします。
 */
export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  views,
  currentViewId,
  onViewSwitch,
  onViewCreate,
  onViewUpdate,
}) => {
  // Task 8.3: 編集中のビューIDを管理
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  // 編集中のビュー情報を保持
  const [editForm, setEditForm] = useState<{
    name: string;
    color: string;
    icon?: string;
  }>({ name: '', color: '' });

  // 編集開始ハンドラ
  const handleEditStart = (view: View) => {
    setEditingViewId(view.id);
    setEditForm({
      name: view.name,
      color: view.color,
      icon: view.icon || '',
    });
  };

  // 保存ハンドラ
  const handleSave = () => {
    if (!editingViewId) return;

    // 変更された項目のみを更新オブジェクトに含める
    const updates: Partial<Omit<View, 'id'>> = {};
    const originalView = views.find((v) => v.id === editingViewId);

    if (!originalView) return;

    if (editForm.name !== originalView.name) {
      updates.name = editForm.name;
    }
    if (editForm.color !== originalView.color) {
      updates.color = editForm.color;
    }
    // アイコンの処理: 空文字列の場合は undefined、変更があれば設定
    if (editForm.icon !== (originalView.icon || '')) {
      updates.icon = editForm.icon || undefined;
    }

    onViewUpdate(editingViewId, updates);
    setEditingViewId(null);
  };

  // キャンセルハンドラ
  const handleCancel = () => {
    setEditingViewId(null);
  };
  // 編集モードのレンダリング
  if (editingViewId) {
    const editingView = views.find((v) => v.id === editingViewId);
    if (!editingView) return null;

    return (
      <div
        className="flex flex-col gap-3 p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
        data-testid="view-edit-form"
      >
        <div className="flex flex-col gap-2">
          {/* ビュー名入力 */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="view-name-input"
              className="text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              View Name
            </label>
            <input
              id="view-name-input"
              type="text"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              aria-label="View Name"
            />
          </div>

          {/* 色入力 */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="view-color-input"
              className="text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              View Color
            </label>
            <input
              id="view-color-input"
              type="color"
              value={editForm.color}
              onChange={(e) =>
                setEditForm({ ...editForm, color: e.target.value })
              }
              className="h-8 w-full border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
              aria-label="View Color"
            />
          </div>

          {/* アイコンURL入力（オプション） */}
          <div className="flex flex-col gap-1">
            <label
              htmlFor="view-icon-input"
              className="text-xs font-medium text-gray-700 dark:text-gray-300"
            >
              Icon URL (Optional)
            </label>
            <input
              id="view-icon-input"
              type="text"
              value={editForm.icon || ''}
              onChange={(e) =>
                setEditForm({ ...editForm, icon: e.target.value })
              }
              className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              placeholder="https://example.com/icon.png"
              aria-label="Icon URL"
            />
          </div>
        </div>

        {/* 保存・キャンセルボタン */}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            className="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded transition-colors"
            aria-label="Save"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
            aria-label="Cancel"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
      data-testid="view-switcher-container"
    >
      {/* ビューリスト（横スクロール可能） */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {views.map((view) => {
          const isActive = view.id === currentViewId;

          return (
            <div key={view.id} className="flex items-center gap-1">
              <button
                onClick={() => onViewSwitch(view.id)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-md whitespace-nowrap
                  transition-colors duration-150 text-sm font-medium
                  ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }
                `}
                aria-label={`Switch to ${view.name} view`}
                aria-current={isActive}
                data-active={isActive}
                data-color={view.color}
              >
                {/* ビューの色インジケーター */}
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: view.color }}
                  aria-hidden="true"
                />

                {/* ビュー名 */}
                <span>{view.name}</span>
              </button>

              {/* 編集ボタン */}
              <button
                onClick={() => handleEditStart(view)}
                className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                aria-label={`Edit view ${view.name}`}
                title="Edit view"
              >
                <svg
                  className="w-3 h-3 text-gray-500 dark:text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                  />
                </svg>
              </button>
            </div>
          );
        })}
      </div>

      {/* 新しいビュー追加ボタン */}
      <button
        onClick={onViewCreate}
        className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors duration-150 flex-shrink-0"
        aria-label="Add new view"
        title="Add new view"
      >
        {/* Plus アイコン */}
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
            d="M12 4v16m8-8H4"
          />
        </svg>
      </button>
    </div>
  );
};

export default ViewSwitcher;
