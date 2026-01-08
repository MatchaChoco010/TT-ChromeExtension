import React, { useState, useCallback } from 'react';
import type { View } from '@/types';
import { ViewContextMenu } from './ViewContextMenu';
import { ViewEditModal } from './ViewEditModal';
import { getIconByName, isCustomIcon } from './IconPicker';

export interface ViewSwitcherProps {
  /** すべてのビュー */
  views: View[];
  /** 現在アクティブなビューのID */
  currentViewId: string;
  /** 各ビューのタブ数 */
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

interface ContextMenuState {
  view: View;
  position: { x: number; y: number };
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  views,
  currentViewId,
  tabCounts,
  onViewSwitch,
  onViewCreate,
  onViewDelete,
  onViewUpdate,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingView, setEditingView] = useState<View | null>(null);

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

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleEdit = useCallback((view: View) => {
    setEditingView(view);
  }, []);

  const handleDelete = useCallback(
    (viewId: string) => {
      onViewDelete(viewId);
    },
    [onViewDelete]
  );

  const handleCloseModal = useCallback(() => {
    setEditingView(null);
  }, []);

  const handleSaveView = useCallback(
    (view: View) => {
      onViewUpdate(view.id, view);
      setEditingView(null);
    },
    [onViewUpdate]
  );

  const handleImmediateUpdate = useCallback(
    (view: View) => {
      onViewUpdate(view.id, view);
    },
    [onViewUpdate]
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (event.deltaY === 0) {
        return;
      }

      const currentIndex = views.findIndex((v) => v.id === currentViewId);
      if (currentIndex === -1) {
        return;
      }

      if (event.deltaY < 0) {
        if (currentIndex > 0) {
          onViewSwitch(views[currentIndex - 1].id);
        }
      } else {
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
              {view.icon ? (
                isCustomIcon(view.icon) ? (
                  <span
                    className="w-5 h-5 text-gray-200"
                    data-testid="view-custom-icon"
                  >
                    {getIconByName(view.icon)?.svg}
                  </span>
                ) : (
                  <img
                    src={view.icon}
                    alt={view.name}
                    className="w-5 h-5 rounded object-cover"
                    data-testid="view-url-icon"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const fallback = target.nextElementSibling as HTMLElement;
                      if (fallback) {
                        fallback.style.display = 'block';
                      }
                    }}
                  />
                )
              ) : null}
              <span
                className={`w-5 h-5 rounded-full flex-shrink-0 ${view.icon && !isCustomIcon(view.icon) ? 'hidden' : view.icon ? 'hidden' : ''}`}
                style={{ backgroundColor: view.color }}
                aria-hidden="true"
                data-testid="view-color-circle"
              />
              {tabCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[20px] h-4 px-1 rounded-full bg-blue-500 text-white text-xs font-medium flex items-center justify-center"
                  data-testid={`tab-count-badge-${view.id}`}
                >
                  {tabCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <button
        onClick={onViewCreate}
        className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-800 text-gray-400 hover:bg-gray-700 transition-colors duration-150 flex-shrink-0"
        aria-label="Add new view"
        title="Add new view"
      >
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

      <ViewEditModal
        key={editingView?.id ?? 'closed'}
        view={editingView}
        isOpen={editingView !== null}
        onSave={handleSaveView}
        onClose={handleCloseModal}
        onImmediateUpdate={handleImmediateUpdate}
      />
    </>
  );
};

export default ViewSwitcher;
