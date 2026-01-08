import React, { useRef, useCallback } from 'react';
import type { TabInfoMap } from '@/types';
import { useDragDrop, DropTargetType } from '../hooks/useDragDrop';
import { DragOverlay } from './DragOverlay';

/**
 * 内部ページのデフォルトファビコンを取得するヘルパー関数
 */
const getInternalPageFavicon = (url: string): string | null => {
  if (!url) return null;

  if (url.startsWith('chrome://') ||
      url.startsWith('vivaldi://') ||
      url.startsWith('chrome-extension://') ||
      url.startsWith('about:') ||
      url.startsWith('edge://') ||
      url.startsWith('brave://')) {
    return `chrome://favicon/size/16@2x/${url}`;
  }

  return null;
};

/**
 * タブ情報から表示用ファビコンURLを取得するヘルパー関数
 */
const getDisplayFavicon = (tabInfo: { favIconUrl?: string; url?: string }): string | null => {
  if (tabInfo.favIconUrl) {
    return tabInfo.favIconUrl;
  }

  if (tabInfo.url) {
    const internalFavicon = getInternalPageFavicon(tabInfo.url);
    if (internalFavicon) {
      return internalFavicon;
    }
  }

  return null;
};

interface PinnedTabsSectionProps {
  pinnedTabIds: number[];
  tabInfoMap: TabInfoMap;
  onTabClick: (tabId: number) => void;
  /** ピン留めタブの右クリック時に呼ばれるコールバック */
  onContextMenu?: (tabId: number, position: { x: number; y: number }) => void;
  /** アクティブタブID（ハイライト表示用） */
  activeTabId?: number | null;
  /** ピン留めタブの並び替えコールバック */
  onPinnedTabReorder?: (tabId: number, newIndex: number) => void;
}

interface PinnedTabItemProps {
  tabId: number;
  tabInfo: { title: string; favIconUrl?: string; url?: string };
  isActive: boolean;
  isDraggable: boolean;
  isDragging: boolean;
  index: number;
  onTabClick: (tabId: number) => void;
  onContextMenu: (tabId: number, event: React.MouseEvent) => void;
  onMouseDown: (e: React.MouseEvent) => void;
}

const PinnedTabItem: React.FC<PinnedTabItemProps> = ({
  tabId,
  tabInfo,
  isActive,
  isDraggable,
  isDragging,
  index,
  onTabClick,
  onContextMenu,
  onMouseDown,
}) => {
  const nodeId = `pinned-${tabId}`;

  return (
    <div
      data-testid={`pinned-tab-${tabId}`}
      data-sortable={isDraggable ? 'true' : undefined}
      data-pinned-id={isDraggable ? nodeId : undefined}
      data-node-id={isDraggable ? nodeId : undefined}
      data-pinned-index={index}
      className={`relative flex items-center justify-center w-7 h-7 rounded cursor-pointer hover:bg-gray-700 ${isActive ? 'bg-gray-600' : ''}`}
      style={{
        opacity: isDragging ? 0.5 : 1,
        cursor: isDraggable ? 'grab' : 'pointer',
      }}
      title={tabInfo.title}
      onClick={() => onTabClick(tabId)}
      onContextMenu={(e) => onContextMenu(tabId, e)}
      onMouseDown={isDraggable ? onMouseDown : undefined}
    >
      {(() => {
        const displayFavicon = getDisplayFavicon(tabInfo);
        return displayFavicon ? (
          <img
            src={displayFavicon}
            alt={tabInfo.title}
            className="w-4 h-4"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
              const defaultIcon = e.currentTarget.parentElement?.querySelector('[data-default-icon]');
              if (defaultIcon) {
                (defaultIcon as HTMLElement).style.display = 'block';
              }
            }}
          />
        ) : null;
      })()}
      <div
        data-testid={`pinned-tab-${tabId}-default-icon`}
        data-default-icon="true"
        className="w-4 h-4 bg-gray-400 rounded"
        style={{ display: getDisplayFavicon(tabInfo) ? 'none' : 'block' }}
      />
    </div>
  );
};

const PinnedTabsSection: React.FC<PinnedTabsSectionProps> = ({
  pinnedTabIds,
  tabInfoMap,
  onTabClick,
  onContextMenu,
  activeTabId,
  onPinnedTabReorder,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (pinnedTabIds.length === 0) {
    return null;
  }

  const validPinnedTabs = pinnedTabIds.filter(tabId => tabInfoMap[tabId]);

  if (validPinnedTabs.length === 0) {
    return null;
  }

  const isDraggable = !!onPinnedTabReorder;

  const items = validPinnedTabs.map(tabId => ({
    id: `pinned-${tabId}`,
    tabId,
  }));

  return (
    <PinnedTabsSectionContent
      validPinnedTabs={validPinnedTabs}
      tabInfoMap={tabInfoMap}
      onTabClick={onTabClick}
      onContextMenu={onContextMenu}
      activeTabId={activeTabId}
      onPinnedTabReorder={onPinnedTabReorder}
      isDraggable={isDraggable}
      items={items}
      containerRef={containerRef}
    />
  );
};

interface PinnedTabsSectionContentProps {
  validPinnedTabs: number[];
  tabInfoMap: TabInfoMap;
  onTabClick: (tabId: number) => void;
  onContextMenu?: (tabId: number, position: { x: number; y: number }) => void;
  activeTabId?: number | null;
  onPinnedTabReorder?: (tabId: number, newIndex: number) => void;
  isDraggable: boolean;
  items: Array<{ id: string; tabId: number }>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const PinnedTabsSectionContent: React.FC<PinnedTabsSectionContentProps> = ({
  validPinnedTabs,
  tabInfoMap,
  onTabClick,
  onContextMenu,
  activeTabId,
  onPinnedTabReorder,
  isDraggable,
  items,
  containerRef,
}) => {
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    // eslint-disable-next-line react-hooks/immutability -- propsで渡されたrefへの設定は意図的
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [containerRef]);

  const handleDragEnd = useCallback(async (itemId: string, dropTarget: { type: string; insertIndex?: number } | null): Promise<void> => {
    if (!dropTarget || dropTarget.type !== DropTargetType.HorizontalGap || !onPinnedTabReorder) {
      return;
    }

    if (!itemId.startsWith('pinned-')) {
      return;
    }

    const draggedTabId = parseInt(itemId.replace('pinned-', ''), 10);
    const newIndex = dropTarget.insertIndex;

    if (newIndex !== undefined && newIndex !== -1) {
      const oldIndex = validPinnedTabs.indexOf(draggedTabId);

      let adjustedIndex = newIndex;
      if (oldIndex < newIndex) {
        adjustedIndex = newIndex - 1;
      }

      if (oldIndex !== adjustedIndex) {
        onPinnedTabReorder(draggedTabId, adjustedIndex);
      }
    }
  }, [onPinnedTabReorder, validPinnedTabs]);

  const { dragState, getItemProps } = useDragDrop({
    activationDistance: 5,
    direction: 'horizontal',
    containerRef,
    items,
    onDragEnd: handleDragEnd,
  });

  const handleTabClick = (tabId: number) => {
    onTabClick(tabId);
  };

  const handleContextMenu = (tabId: number, event: React.MouseEvent) => {
    event.preventDefault();
    if (onContextMenu) {
      onContextMenu(tabId, { x: event.clientX, y: event.clientY });
    }
  };

  const draggedTabId = dragState.draggedTabId;
  const draggedTabInfo = draggedTabId ? tabInfoMap[draggedTabId] : null;

  return (
    <>
      <div
        ref={setContainerRef}
        data-testid="pinned-tabs-section"
        className="flex flex-wrap gap-1 p-2"
      >
        {validPinnedTabs.map((tabId, index) => {
          const tabInfo = tabInfoMap[tabId];
          const isActive = activeTabId === tabId;
          const itemId = `pinned-${tabId}`;
          const itemProps = isDraggable ? getItemProps(itemId, tabId) : { onMouseDown: () => {}, style: {}, 'data-dragging': false };
          const isDragging = dragState.draggedItemId === itemId && dragState.isDragging;

          return (
            <PinnedTabItem
              key={tabId}
              tabId={tabId}
              tabInfo={tabInfo}
              isActive={isActive}
              isDraggable={isDraggable}
              isDragging={isDragging}
              index={index}
              onTabClick={handleTabClick}
              onContextMenu={handleContextMenu}
              onMouseDown={itemProps.onMouseDown}
            />
          );
        })}
      </div>

      {isDraggable && draggedTabInfo && (
        <DragOverlay
          isDragging={dragState.isDragging}
          position={dragState.currentPosition}
          offset={dragState.offset}
        >
          <div className="flex items-center justify-center w-7 h-7 rounded bg-gray-700 shadow-lg">
            {(() => {
              const displayFavicon = getDisplayFavicon(draggedTabInfo);
              return displayFavicon ? (
                <img
                  src={displayFavicon}
                  alt={draggedTabInfo.title}
                  className="w-4 h-4"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
              ) : null;
            })()}
            <div
              className="w-4 h-4 bg-gray-400 rounded"
              style={{ display: getDisplayFavicon(draggedTabInfo) ? 'none' : 'block' }}
            />
          </div>
        </DragOverlay>
      )}

      <div
        data-testid="pinned-tabs-separator"
        className="border-b border-gray-700 mx-2"
      />
    </>
  );
};

export default PinnedTabsSection;
