/**
 * ViewSwitcher コンポーネント
 * Task 8.2: ViewSwitcher UI コンポーネントの実装
 * Task 7.1: ファビコンサイズアイコンボタンへの改修
 * Task 7.3: ビューボタンの右クリックコンテキストメニューの実装
 * Task 3.2: ビューのスクロール切り替え機能を追加
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.3, 16.1, 16.2, 16.3
 *
 * サイドパネル上部で複数のビューをファビコンサイズのアイコンボタンで切り替えるUIを提供します。
 * ビューボタンを右クリックするとコンテキストメニューが表示され、編集・削除が可能です。
 * マウスホイールでビューを切り替えることができます。
 */

import React, { useState, useCallback } from 'react';
import type { View } from '@/types';
import { ViewContextMenu } from './ViewContextMenu';
import { ViewEditModal } from './ViewEditModal';

export interface ViewSwitcherProps {
  /** すべてのビュー */
  views: View[];
  /** 現在アクティブなビューのID */
  currentViewId: string;
  /** 各ビューのタブ数 (Task 3.3: Requirements 17.1, 17.2, 17.3) */
  tabCounts?: Record<string, number>;
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
 * コンテキストメニューの状態
 */
interface ContextMenuState {
  view: View;
  position: { x: number; y: number };
}

/**
 * ViewSwitcher コンポーネント
 *
 * サイドパネル上部にファビコンサイズのアイコンボタンを横並びで表示し、
 * ユーザーがビューを切り替えたり、新しいビューを作成したりできるようにします。
 *
 * Task 7.1:
 * - 各ビューはファビコンサイズ(32x32px)のアイコンボタンで表示
 * - アイコンが設定されていない場合はカラーサークルを表示
 * - 鉛筆ボタンによるインライン編集UIは削除
 *
 * Task 7.3:
 * - ビューボタンを右クリックするとコンテキストメニューを表示
 * - メニューから「ビューの編集」を選択するとViewEditModalを開く
 * - メニューから「ビューの削除」を選択するとビューを削除する
 */
export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  views,
  currentViewId,
  tabCounts,
  onViewSwitch,
  onViewCreate,
  onViewDelete,
  onViewUpdate,
}) => {
  // Task 7.3: コンテキストメニューの状態
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Task 7.3: モーダルで編集中のビュー
  const [editingView, setEditingView] = useState<View | null>(null);

  // 右クリックハンドラー
  const handleContextMenu = useCallback(
    (event: React.MouseEvent, view: View) => {
      event.preventDefault();
      setContextMenu({
        view,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    []
  );

  // コンテキストメニューを閉じる
  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  // 編集アクション
  const handleEdit = useCallback((view: View) => {
    setEditingView(view);
  }, []);

  // 削除アクション
  const handleDelete = useCallback(
    (viewId: string) => {
      onViewDelete(viewId);
    },
    [onViewDelete]
  );

  // モーダルを閉じる
  const handleCloseModal = useCallback(() => {
    setEditingView(null);
  }, []);

  // モーダルで保存
  const handleSaveView = useCallback(
    (view: View) => {
      onViewUpdate(view.id, view);
      setEditingView(null);
    },
    [onViewUpdate]
  );

  // Task 3.2: マウスホイールでビュー切り替え
  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      // deltaYが0の場合は何もしない
      if (event.deltaY === 0) {
        return;
      }

      // 現在のビューのインデックスを取得
      const currentIndex = views.findIndex((v) => v.id === currentViewId);
      if (currentIndex === -1) {
        return;
      }

      if (event.deltaY < 0) {
        // 上スクロール: 前のビューに切り替え
        if (currentIndex > 0) {
          onViewSwitch(views[currentIndex - 1].id);
        }
      } else {
        // 下スクロール: 次のビューに切り替え
        if (currentIndex < views.length - 1) {
          onViewSwitch(views[currentIndex + 1].id);
        }
      }
    },
    [views, currentViewId, onViewSwitch]
  );

  return (
    <>
    <div
      className="flex items-center gap-1 p-2 border-b border-gray-700 bg-gray-900"
      data-testid="view-switcher-container"
      onWheel={handleWheel}
    >
      {/* ビューリスト（横スクロール可能） */}
      <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {views.map((view) => {
          const isActive = view.id === currentViewId;
          const tabCount = tabCounts?.[view.id] ?? 0;

          return (
            <button
              key={view.id}
              onClick={() => onViewSwitch(view.id)}
              onContextMenu={(e) => handleContextMenu(e, view)}
              className={`
                relative flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0
                transition-colors duration-150
                ${
                  isActive
                    ? 'ring-2 ring-blue-400 bg-gray-700'
                    : 'bg-gray-800 hover:bg-gray-700'
                }
              `}
              aria-label={`Switch to ${view.name} view`}
              aria-current={isActive}
              data-active={isActive}
              data-color={view.color}
              title={view.name}
            >
              {/* アイコンが設定されている場合はアイコン画像を表示 */}
              {view.icon ? (
                <img
                  src={view.icon}
                  alt={view.name}
                  className="w-5 h-5 rounded object-cover"
                  onError={(e) => {
                    // アイコン読み込み失敗時はカラーサークルにフォールバック
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) {
                      fallback.style.display = 'block';
                    }
                  }}
                />
              ) : null}
              {/* アイコンがない場合、またはフォールバック用のカラーサークル */}
              <span
                className={`w-5 h-5 rounded-full flex-shrink-0 ${view.icon ? 'hidden' : ''}`}
                style={{ backgroundColor: view.color }}
                aria-hidden="true"
                data-testid="view-color-circle"
              />
              {/* Task 3.3: タブ数バッジ (Requirements 17.1, 17.2, 17.3) */}
              {tabCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-blue-500 text-white text-xs font-medium flex items-center justify-center"
                  data-testid={`tab-count-badge-${view.id}`}
                >
                  {tabCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 新しいビュー追加ボタン */}
      <button
        onClick={onViewCreate}
        className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors duration-150 flex-shrink-0"
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

      {/* Task 7.3: コンテキストメニュー */}
      {contextMenu && (
        <ViewContextMenu
          view={contextMenu.view}
          position={contextMenu.position}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onClose={handleCloseContextMenu}
          isLastView={views.length === 1}
        />
      )}

      {/* Task 7.3: 編集モーダル */}
      {/* key を使用してviewが変わるたびにコンポーネントを再マウント */}
      <ViewEditModal
        key={editingView?.id ?? 'closed'}
        view={editingView}
        isOpen={editingView !== null}
        onSave={handleSaveView}
        onClose={handleCloseModal}
      />
    </>
  );
};

export default ViewSwitcher;
