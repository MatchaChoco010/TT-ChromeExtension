import React, { useState, useCallback } from 'react';
import type { View } from '@/types';
import { ViewContextMenu } from './ViewContextMenu';
import { ViewEditModal } from './ViewEditModal';
import { getIconByName, isCustomIcon } from './IconPicker';

export interface ViewSwitcherProps {
  /** すべてのビュー */
  views: View[];
  /** 現在アクティブなビューのインデックス */
  currentViewIndex: number;
  /** 各ビューのタブ数（インデックスベース） */
  tabCounts?: number[];
  /** ビュー切り替え時のコールバック */
  onViewSwitch: (viewIndex: number) => void;
  /** 新しいビュー作成時のコールバック */
  onViewCreate: () => void;
  /** ビュー削除時のコールバック */
  onViewDelete: (viewIndex: number) => void;
  /** ビュー更新時のコールバック */
  onViewUpdate: (viewIndex: number, updates: Partial<View>) => void;
}

interface ContextMenuState {
  view: View;
  viewIndex: number;
  position: { x: number; y: number };
}

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  views,
  currentViewIndex,
  tabCounts,
  onViewSwitch,
  onViewCreate,
  onViewDelete,
  onViewUpdate,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingView, setEditingView] = useState<{ view: View; viewIndex: number } | null>(null);

  const handleContextMenu = useCallback(
    (event: React.MouseEvent, view: View, viewIndex: number) => {
      event.preventDefault();
      setContextMenu({
        view,
        viewIndex,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    []
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleEdit = useCallback((view: View) => {
    if (contextMenu) {
      setEditingView({ view, viewIndex: contextMenu.viewIndex });
    }
  }, [contextMenu]);

  const handleDelete = useCallback(() => {
    if (contextMenu) {
      onViewDelete(contextMenu.viewIndex);
    }
  }, [contextMenu, onViewDelete]);

  const handleCloseModal = useCallback(() => {
    setEditingView(null);
  }, []);

  const handleSaveView = useCallback(
    (view: View) => {
      if (editingView) {
        onViewUpdate(editingView.viewIndex, view);
      }
      setEditingView(null);
    },
    [editingView, onViewUpdate]
  );

  const handleImmediateUpdate = useCallback(
    (view: View) => {
      if (editingView) {
        onViewUpdate(editingView.viewIndex, view);
      }
    },
    [editingView, onViewUpdate]
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent) => {
      if (event.deltaY === 0) {
        return;
      }

      if (event.deltaY < 0) {
        if (currentViewIndex > 0) {
          onViewSwitch(currentViewIndex - 1);
        }
      } else {
        if (currentViewIndex < views.length - 1) {
          onViewSwitch(currentViewIndex + 1);
        }
      }
    },
    [views.length, currentViewIndex, onViewSwitch]
  );

  return (
    <>
    <div
      className="flex items-center gap-1 p-2 border-b border-gray-700 bg-gray-900"
      data-testid="view-switcher-container"
      onWheel={handleWheel}
    >
      <div className="flex items-center gap-1 overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent">
        {views.map((view, index) => {
          const isActive = index === currentViewIndex;
          const tabCount = tabCounts?.[index] ?? 0;

          return (
            <button
              key={`view-${index}`}
              onClick={() => onViewSwitch(index)}
              onContextMenu={(e) => handleContextMenu(e, view, index)}
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
              data-view-index={index}
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
                  data-testid={`tab-count-badge-${index}`}
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
        key={editingView ? `edit-${editingView.viewIndex}` : 'closed'}
        view={editingView?.view ?? null}
        isOpen={editingView !== null}
        onSave={handleSaveView}
        onClose={handleCloseModal}
        onImmediateUpdate={handleImmediateUpdate}
      />
    </>
  );
};

export default ViewSwitcher;
