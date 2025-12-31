import React, { useRef, useCallback } from 'react';
import type { TabInfoMap } from '@/types';
import { useDragDrop, DropTargetType } from '../hooks/useDragDrop';
import { DragOverlay } from './DragOverlay';

interface PinnedTabsSectionProps {
  pinnedTabIds: number[];
  tabInfoMap: TabInfoMap;
  onTabClick: (tabId: number) => void;
  /** ピン留めタブの右クリック時に呼ばれるコールバック (要件1.6, 1.7) */
  onContextMenu?: (tabId: number, position: { x: number; y: number }) => void;
  /** Task 6.1 (tab-tree-bugfix): アクティブタブID（ハイライト表示用） */
  activeTabId?: number | null;
  /** Task 11.1 (tab-tree-bugfix): ピン留めタブの並び替えコールバック (Requirements 10.1, 10.2, 10.3, 10.4) */
  onPinnedTabReorder?: (tabId: number, newIndex: number) => void;
}

/**
 * ピン留めタブアイテムコンポーネント
 * Task 10.2 (tab-tree-bugfix-2): dnd-kit削除、自前D&D実装に移行
 */
interface PinnedTabItemProps {
  tabId: number;
  tabInfo: { title: string; favIconUrl?: string };
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
      {/* ファビコン */}
      {tabInfo.favIconUrl ? (
        <img
          src={tabInfo.favIconUrl}
          alt={tabInfo.title}
          className="w-4 h-4"
          onError={(e) => {
            // ファビコンの読み込みに失敗した場合は非表示にしてデフォルトアイコンを表示
            e.currentTarget.style.display = 'none';
            const defaultIcon = e.currentTarget.parentElement?.querySelector('[data-default-icon]');
            if (defaultIcon) {
              (defaultIcon as HTMLElement).style.display = 'block';
            }
          }}
        />
      ) : (
        <div
          data-testid={`pinned-tab-${tabId}-default-icon`}
          className="w-4 h-4 bg-gray-400 rounded"
        />
      )}
      {/* 閉じるボタンは表示しない（要件1.1）*/}
    </div>
  );
};

/**
 * Task 3.1: ピン留めタブセクションコンポーネント
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5 (tree-tab-ux-improvements)
 * Task 11.1 (tab-tree-bugfix): ドラッグ＆ドロップ並び替え機能を追加 (Requirements 10.1, 10.2, 10.3, 10.4)
 * Task 10.2 (tab-tree-bugfix-2): dnd-kit削除、自前D&D実装に移行 (Requirements 3.1.1, 3.1.7)
 *
 * - ピン留めタブをツリービュー上部に配置
 * - ファビコンサイズで横並びグリッド表示
 * - 通常タブとの間に区切り線
 * - ピン留めタブが0件の場合は非表示
 * - 閉じるボタンは表示しない（要件1.1）
 * - ピン留めタブに対する閉じる操作は無効化（要件1.3）
 * - ドラッグ＆ドロップによる並び替え機能（自前D&D実装、水平モード）
 */
const PinnedTabsSection: React.FC<PinnedTabsSectionProps> = ({
  pinnedTabIds,
  tabInfoMap,
  onTabClick,
  onContextMenu,
  activeTabId,
  onPinnedTabReorder,
}) => {
  // コンテナの参照
  const containerRef = useRef<HTMLDivElement | null>(null);

  // ピン留めタブが0件の場合は何も表示しない
  if (pinnedTabIds.length === 0) {
    return null;
  }

  // tabInfoMapに存在するピン留めタブのみをフィルタリング
  const validPinnedTabs = pinnedTabIds.filter(tabId => tabInfoMap[tabId]);

  // 有効なピン留めタブがない場合も非表示
  if (validPinnedTabs.length === 0) {
    return null;
  }

  // ドラッグ可能かどうか
  const isDraggable = !!onPinnedTabReorder;

  // 自前D&Dフックに渡すアイテムリスト
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

/**
 * ピン留めタブセクションのコンテンツ（フック使用のため分離）
 */
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
  // refコールバックでcontainerRefに値を設定
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [containerRef]);

  /**
   * ドラッグ終了ハンドラ
   * Task 10.2 (tab-tree-bugfix-2): 自前D&D実装でピン留めタブの順序変更
   */
  const handleDragEnd = useCallback((itemId: string, dropTarget: { type: string; insertIndex?: number } | null) => {
    if (!dropTarget || dropTarget.type !== DropTargetType.HorizontalGap || !onPinnedTabReorder) {
      return;
    }

    // ピン留めタブのIDを抽出（"pinned-123" -> 123）
    if (!itemId.startsWith('pinned-')) {
      return;
    }

    const draggedTabId = parseInt(itemId.replace('pinned-', ''), 10);
    const newIndex = dropTarget.insertIndex;

    if (newIndex !== undefined && newIndex !== -1) {
      // 元のインデックスを取得
      const oldIndex = validPinnedTabs.indexOf(draggedTabId);

      // 挿入位置を調整（自分より後ろに移動する場合は-1）
      let adjustedIndex = newIndex;
      if (oldIndex < newIndex) {
        adjustedIndex = newIndex - 1;
      }

      // 同じ位置なら何もしない
      if (oldIndex !== adjustedIndex) {
        onPinnedTabReorder(draggedTabId, adjustedIndex);
      }
    }
  }, [onPinnedTabReorder, validPinnedTabs]);

  // 自前D&Dフック（水平モード）
  const { dragState, getItemProps } = useDragDrop({
    activationDistance: 5, // 5px移動でドラッグ開始
    direction: 'horizontal',
    containerRef,
    items,
    onDragEnd: handleDragEnd,
  });

  const handleTabClick = (tabId: number) => {
    onTabClick(tabId);
  };

  /**
   * 右クリックハンドラ（要件1.6, 1.7対応）
   * ピン留めタブを右クリックした場合にコンテキストメニューを表示するため
   */
  const handleContextMenu = (tabId: number, event: React.MouseEvent) => {
    event.preventDefault();
    if (onContextMenu) {
      onContextMenu(tabId, { x: event.clientX, y: event.clientY });
    }
  };

  // ドラッグ中のタブ情報を取得
  const draggedTabId = dragState.draggedTabId;
  const draggedTabInfo = draggedTabId ? tabInfoMap[draggedTabId] : null;

  return (
    <>
      {/* ピン留めタブセクション */}
      <div
        ref={setContainerRef}
        data-testid="pinned-tabs-section"
        className="flex flex-wrap gap-1 p-2"
      >
        {validPinnedTabs.map((tabId, index) => {
          const tabInfo = tabInfoMap[tabId];
          // Task 6.1 (tab-tree-bugfix): アクティブタブの判定
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

      {/* ドラッグオーバーレイ */}
      {isDraggable && draggedTabInfo && (
        <DragOverlay
          isDragging={dragState.isDragging}
          position={dragState.currentPosition}
          offset={dragState.offset}
        >
          <div className="flex items-center justify-center w-7 h-7 rounded bg-gray-700 shadow-lg">
            {draggedTabInfo.favIconUrl ? (
              <img
                src={draggedTabInfo.favIconUrl}
                alt={draggedTabInfo.title}
                className="w-4 h-4"
              />
            ) : (
              <div className="w-4 h-4 bg-gray-400 rounded" />
            )}
          </div>
        </DragOverlay>
      )}

      {/* 区切り線 */}
      <div
        data-testid="pinned-tabs-separator"
        className="border-b border-gray-700 mx-2"
      />
    </>
  );
};

export default PinnedTabsSection;
