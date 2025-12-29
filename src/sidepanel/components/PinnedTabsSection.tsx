import React from 'react';
import {
  DndContext,
  closestCenter,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TabInfoMap } from '@/types';

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
 * ソート可能なピン留めタブアイテムコンポーネント
 * Task 11.1 (tab-tree-bugfix): ドラッグ＆ドロップ並び替え機能を追加
 */
interface SortablePinnedTabItemProps {
  tabId: number;
  tabInfo: { title: string; favIconUrl?: string };
  isActive: boolean;
  isDraggable: boolean;
  onTabClick: (tabId: number) => void;
  onContextMenu: (tabId: number, event: React.MouseEvent) => void;
}

const SortablePinnedTabItem: React.FC<SortablePinnedTabItemProps> = ({
  tabId,
  tabInfo,
  isActive,
  isDraggable,
  onTabClick,
  onContextMenu,
}) => {
  const sortableId = `pinned-${tabId}`;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortableId,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isDraggable ? listeners : {})}
      key={tabId}
      data-testid={`pinned-tab-${tabId}`}
      data-sortable={isDraggable ? 'true' : undefined}
      data-pinned-id={isDraggable ? sortableId : undefined}
      className={`relative flex items-center justify-center w-7 h-7 rounded cursor-pointer hover:bg-gray-700 ${isActive ? 'bg-gray-600' : ''}`}
      title={tabInfo.title}
      onClick={() => onTabClick(tabId)}
      onContextMenu={(e) => onContextMenu(tabId, e)}
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
 *
 * - ピン留めタブをツリービュー上部に配置
 * - ファビコンサイズで横並びグリッド表示
 * - 通常タブとの間に区切り線
 * - ピン留めタブが0件の場合は非表示
 * - 閉じるボタンは表示しない（要件1.1）
 * - ピン留めタブに対する閉じる操作は無効化（要件1.3）
 * - ドラッグ＆ドロップによる並び替え機能（Requirements 10.1, 10.2, 10.3, 10.4）
 */
const PinnedTabsSection: React.FC<PinnedTabsSectionProps> = ({
  pinnedTabIds,
  tabInfoMap,
  onTabClick,
  onContextMenu,
  activeTabId,
  onPinnedTabReorder,
}) => {
  // ドラッグセンサー設定
  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5, // 5px移動でドラッグ開始
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 5,
      },
    })
  );

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

  // SortableContext用のID配列を生成
  const sortableIds = validPinnedTabs.map(tabId => `pinned-${tabId}`);

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

  /**
   * ドラッグ終了ハンドラ
   * Task 11.1 (tab-tree-bugfix): ピン留めタブの順序変更をブラウザと同期
   */
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id || !onPinnedTabReorder) {
      return;
    }

    // ピン留めタブのIDを抽出（"pinned-123" -> 123）
    const activeId = String(active.id);
    const overId = String(over.id);

    if (!activeId.startsWith('pinned-') || !overId.startsWith('pinned-')) {
      return;
    }

    const activeTabId = parseInt(activeId.replace('pinned-', ''), 10);
    const overTabId = parseInt(overId.replace('pinned-', ''), 10);

    // 新しいインデックスを計算
    const newIndex = validPinnedTabs.indexOf(overTabId);

    if (newIndex !== -1) {
      onPinnedTabReorder(activeTabId, newIndex);
    }
  };

  // ドラッグ可能かどうか
  const isDraggable = !!onPinnedTabReorder;

  // コンテンツ部分
  const content = (
    <div
      data-testid="pinned-tabs-section"
      className="flex flex-wrap gap-1 p-2"
    >
      {validPinnedTabs.map(tabId => {
        const tabInfo = tabInfoMap[tabId];
        // Task 6.1 (tab-tree-bugfix): アクティブタブの判定
        const isActive = activeTabId === tabId;

        return (
          <SortablePinnedTabItem
            key={tabId}
            tabId={tabId}
            tabInfo={tabInfo}
            isActive={isActive}
            isDraggable={isDraggable}
            onTabClick={handleTabClick}
            onContextMenu={handleContextMenu}
          />
        );
      })}
    </div>
  );

  return (
    <>
      {/* ピン留めタブセクション */}
      {isDraggable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            {content}
          </SortableContext>
        </DndContext>
      ) : (
        content
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
