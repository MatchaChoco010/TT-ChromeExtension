import React, { useState, useCallback, useRef } from 'react';
import type { View } from '@/types';
import { ViewContextMenu } from './ViewContextMenu';
import { ViewEditModal } from './ViewEditModal';
import { getIconByName, isCustomIcon } from './IconPicker';
import { useDragDrop, DropTargetType } from '../hooks/useDragDrop';
import { DragOverlay } from './DragOverlay';

export interface ViewSwitcherProps {
  views: View[];
  currentViewIndex: number;
  tabCounts?: number[];
  onViewSwitch: (viewIndex: number) => void;
  onViewCreate: () => void;
  onViewDelete: (viewIndex: number) => void;
  onViewUpdate: (viewIndex: number, updates: Partial<View>) => void;
  onViewReorder?: (viewIndex: number, newIndex: number) => void;
}

interface ContextMenuState {
  view: View;
  viewIndex: number;
  position: { x: number; y: number };
}

interface ViewButtonProps {
  view: View;
  index: number;
  isActive: boolean;
  tabCount: number;
  isDragging: boolean;
  isDraggable: boolean;
  onViewSwitch: (index: number) => void;
  onContextMenu: (e: React.MouseEvent, view: View, index: number) => void;
  onMouseDown?: (e: React.MouseEvent) => void;
}

const ViewButton: React.FC<ViewButtonProps> = ({
  view,
  index,
  isActive,
  tabCount,
  isDragging,
  isDraggable,
  onViewSwitch,
  onContextMenu,
  onMouseDown,
}) => {
  return (
    <button
      onClick={() => onViewSwitch(index)}
      onContextMenu={(e) => onContextMenu(e, view, index)}
      onMouseDown={isDraggable ? onMouseDown : undefined}
      className={`
        relative flex items-center justify-center w-8 h-8 rounded-md flex-shrink-0
        transition-colors duration-150
        ${
          isActive
            ? 'ring-2 ring-gray-400 bg-gray-700'
            : 'bg-gray-800 hover:bg-gray-700'
        }
      `}
      aria-label={`Switch to ${view.name} view`}
      aria-current={isActive}
      data-active={isActive}
      data-color={view.color}
      data-view-index={index}
      data-node-id={`view-${index}`}
      title={view.name}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDraggable ? 'grab' : 'pointer',
      }}
    >
      {view.icon ? (
        isCustomIcon(view.icon) ? (
          <span
            className="w-5 h-5"
            style={{ color: view.color }}
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
          className="absolute -top-0.5 -right-0.5 min-w-[18px] h-3.5 px-1 rounded-full bg-gray-600 text-white text-[10px] font-medium flex items-center justify-center"
          data-testid={`tab-count-badge-${index}`}
        >
          {tabCount}
        </span>
      )}
    </button>
  );
};

export const ViewSwitcher: React.FC<ViewSwitcherProps> = ({
  views,
  currentViewIndex,
  tabCounts,
  onViewSwitch,
  onViewCreate,
  onViewDelete,
  onViewUpdate,
  onViewReorder,
}) => {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [editingView, setEditingView] = useState<{ view: View; viewIndex: number } | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const isDraggable = !!onViewReorder;

  const items = views.map((_, index) => ({
    id: `view-${index}`,
    tabId: index,
  }));

  const handleDragEnd = useCallback(async (itemId: string, dropTarget: { type: string; insertIndex?: number } | null): Promise<void> => {
    if (!dropTarget || dropTarget.type !== DropTargetType.HorizontalGap || !onViewReorder) {
      return;
    }

    if (!itemId.startsWith('view-')) {
      return;
    }

    const draggedViewIndex = parseInt(itemId.replace('view-', ''), 10);
    const newIndex = dropTarget.insertIndex;

    if (newIndex !== undefined && newIndex !== -1) {
      let adjustedIndex = newIndex;
      if (draggedViewIndex < newIndex) {
        adjustedIndex = newIndex - 1;
      }

      if (draggedViewIndex !== adjustedIndex) {
        onViewReorder(draggedViewIndex, adjustedIndex);
      }
    }
  }, [onViewReorder]);

  const { dragState, getItemProps } = useDragDrop({
    activationDistance: 5,
    direction: 'horizontal',
    containerRef,
    items,
    onDragEnd: handleDragEnd,
  });

  const draggedViewIndex = dragState.draggedTabId;
  const draggedView = draggedViewIndex !== null ? views[draggedViewIndex] : null;

  const getIndicatorInfo = useCallback((): { insertIndex: number; leftPosition: number } | null => {
    if (!dragState.isDragging || !dragState.dropTarget) return null;
    if (dragState.dropTarget.type !== DropTargetType.HorizontalGap) return null;

    const insertIndex = dragState.dropTarget.insertIndex ?? 0;
    const viewCount = views.length;

    if (viewCount === 0) return null;

    const VIEW_WIDTH = 32;
    const GAP = 4;
    const PADDING = 0;

    let leftPosition: number;
    if (insertIndex === 0) {
      leftPosition = PADDING;
    } else if (insertIndex >= viewCount) {
      leftPosition = PADDING + viewCount * VIEW_WIDTH + (viewCount - 1) * GAP + GAP / 2;
    } else {
      leftPosition = PADDING + insertIndex * VIEW_WIDTH + (insertIndex - 1) * GAP + GAP / 2;
    }

    return {
      insertIndex,
      leftPosition,
    };
  }, [dragState.isDragging, dragState.dropTarget, views.length]);

  const indicatorInfo = getIndicatorInfo();

  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, []);

  return (
    <>
    <div
      className="flex items-center gap-1 p-2 border-b border-gray-700 bg-gray-900"
      data-testid="view-switcher-container"
      onWheel={handleWheel}
    >
      <div
        ref={setContainerRef}
        className="relative flex items-center gap-1 overflow-x-auto flex-1 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent"
      >
        {views.map((view, index) => {
          const isActive = index === currentViewIndex;
          const tabCount = tabCounts?.[index] ?? 0;
          const itemId = `view-${index}`;
          const itemProps = isDraggable ? getItemProps(itemId, index) : { onMouseDown: () => {}, style: {}, 'data-dragging': false };
          const isDragging = dragState.draggedItemId === itemId && dragState.isDragging;

          return (
            <ViewButton
              key={`view-${index}`}
              view={view}
              index={index}
              isActive={isActive}
              tabCount={tabCount}
              isDragging={isDragging}
              isDraggable={isDraggable}
              onViewSwitch={onViewSwitch}
              onContextMenu={handleContextMenu}
              onMouseDown={itemProps.onMouseDown}
            />
          );
        })}

        {isDraggable && indicatorInfo && (
          <div
            data-testid="view-drop-indicator"
            data-insert-index={indicatorInfo.insertIndex}
            className="absolute bg-blue-500 transition-all duration-75 ease-out pointer-events-none rounded-sm"
            style={{
              left: `${indicatorInfo.leftPosition}px`,
              width: '4px',
              top: '0px',
              bottom: '0px',
            }}
          />
        )}
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

      {isDraggable && draggedView && (
        <DragOverlay
          isDragging={dragState.isDragging}
          position={dragState.currentPosition}
          offset={dragState.offset}
        >
          <div
            className="flex items-center justify-center w-8 h-8 rounded-md bg-gray-700 shadow-lg"
          >
            {draggedView.icon ? (
              isCustomIcon(draggedView.icon) ? (
                <span
                  className="w-5 h-5"
                  style={{ color: draggedView.color }}
                >
                  {getIconByName(draggedView.icon)?.svg}
                </span>
              ) : (
                <img
                  src={draggedView.icon}
                  alt={draggedView.name}
                  className="w-5 h-5 rounded object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
              )
            ) : null}
            <span
              className={`w-5 h-5 rounded-full flex-shrink-0 ${draggedView.icon ? 'hidden' : ''}`}
              style={{ backgroundColor: draggedView.color }}
              aria-hidden="true"
            />
          </div>
        </DragOverlay>
      )}
    </>
  );
};

export default ViewSwitcher;
