import React, { useMemo, useRef, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DndContext, closestCenter, DragOverEvent } from '@dnd-kit/core';
import type { TabNode, TabTreeViewProps } from '@/types';

// Task 6.4: ドラッグホバー時のブランチ自動展開の閾値（ミリ秒）
// Requirement 3.4: ホバー時間が1秒を超えたら展開
const AUTO_EXPAND_HOVER_DELAY_MS = 1000;

interface TreeNodeItemProps {
  node: TabNode;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (nodeId: string) => void;
  isDraggable: boolean;
}

/**
 * ドラッグ可能なツリーノード項目コンポーネント
 */
const SortableTreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  onNodeClick,
  onToggleExpand,
  isDraggable,
}) => {
  const hasChildren = node.children && node.children.length > 0;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: node.id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* ノードの内容 */}
      <div
        data-testid={`tree-node-${node.id}`}
        data-sortable-item={`sortable-item-${node.id}`}
        className={`flex items-center p-2 hover:bg-gray-100 cursor-pointer ${isDragging ? 'bg-blue-100 border-2 border-blue-500' : ''}`}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={() => onNodeClick(node.tabId)}
        {...attributes}
        {...listeners}
      >
        {/* 展開/折りたたみボタン */}
        {hasChildren && (
          <button
            data-testid={`toggle-expand-${node.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="mr-2 w-4 h-4 flex items-center justify-center"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* タブの内容 */}
        <div className="flex-1 flex items-center">
          <span className="text-sm">Tab {node.tabId}</span>
        </div>
      </div>

      {/* 子ノードの再帰的レンダリング */}
      {hasChildren && node.isExpanded && (
        <div>
          {node.children.map((child) => (
            <SortableTreeNodeItem
              key={child.id}
              node={child}
              onNodeClick={onNodeClick}
              onToggleExpand={onToggleExpand}
              isDraggable={isDraggable}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 非ドラッグ可能なツリーノード項目コンポーネント
 */
const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  onNodeClick,
  onToggleExpand,
}) => {
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div>
      {/* ノードの内容 */}
      <div
        data-testid={`tree-node-${node.id}`}
        className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={() => onNodeClick(node.tabId)}
      >
        {/* 展開/折りたたみボタン */}
        {hasChildren && (
          <button
            data-testid={`toggle-expand-${node.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="mr-2 w-4 h-4 flex items-center justify-center"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* タブの内容 */}
        <div className="flex-1 flex items-center">
          <span className="text-sm">Tab {node.tabId}</span>
        </div>
      </div>

      {/* 子ノードの再帰的レンダリング */}
      {hasChildren && node.isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              onNodeClick={onNodeClick}
              onToggleExpand={onToggleExpand}
              isDraggable={false}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * すべてのノードIDを再帰的に収集する
 */
const collectAllNodeIds = (nodes: TabNode[]): string[] => {
  const ids: string[] = [];
  const collect = (node: TabNode) => {
    ids.push(node.id);
    if (node.children && node.children.length > 0) {
      node.children.forEach(collect);
    }
  };
  nodes.forEach(collect);
  return ids;
};

/**
 * タブツリービューコンポーネント
 * タブのツリー構造を表示し、現在のビューに基づいてフィルタリングする
 * onDragEndが提供されている場合、ドラッグ&ドロップ機能を有効化
 */
const TabTreeView: React.FC<TabTreeViewProps> = ({
  nodes,
  currentViewId,
  onNodeClick,
  onToggleExpand,
  onDragEnd,
  onDragOver,
}) => {
  // currentViewIdでフィルタリング
  const filteredNodes = useMemo(
    () => nodes.filter((node) => node.viewId === currentViewId),
    [nodes, currentViewId]
  );

  const isDraggable = !!onDragEnd;

  // すべてのノードIDを収集（SortableContext用）
  const allNodeIds = useMemo(
    () => collectAllNodeIds(filteredNodes),
    [filteredNodes]
  );

  // Task 6.4: ドラッグホバー時のブランチ自動展開
  // ホバー中のノードIDとタイマーを管理
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHoverNodeIdRef = useRef<string | null>(null);

  // ホバータイマーをクリーンアップ
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  /**
   * ドラッグオーバーイベントハンドラ
   * 折りたたまれたブランチの上で1秒以上ホバーすると自動展開
   */
  const handleDragOver = React.useCallback(
    (event: DragOverEvent) => {
      // 外部のonDragOverコールバックを呼び出す
      if (onDragOver) {
        onDragOver(event);
      }

      const { over } = event;
      if (!over) {
        // ホバーが解除された場合、タイマーをクリア
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        lastHoverNodeIdRef.current = null;
        return;
      }

      const overId = over.id as string;

      // 同じノードの上でホバーし続けている場合はスキップ
      if (overId === lastHoverNodeIdRef.current) {
        return;
      }

      // 前回のタイマーをクリア
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }

      // 新しいホバーノードを記録
      lastHoverNodeIdRef.current = overId;

      // ノードを探す（全ノードから検索）
      const findNode = (nodeList: TabNode[]): TabNode | null => {
        for (const node of nodeList) {
          if (node.id === overId) {
            return node;
          }
          if (node.children && node.children.length > 0) {
            const found = findNode(node.children);
            if (found) return found;
          }
        }
        return null;
      };

      const overNode = findNode(nodes);

      // ノードが存在し、子を持ち、折りたたまれている場合のみタイマーを設定
      if (
        overNode &&
        overNode.children &&
        overNode.children.length > 0 &&
        !overNode.isExpanded
      ) {
        // AUTO_EXPAND_HOVER_DELAY_MS後に自動展開
        hoverTimerRef.current = setTimeout(() => {
          onToggleExpand(overId);
          hoverTimerRef.current = null;
          lastHoverNodeIdRef.current = null;
        }, AUTO_EXPAND_HOVER_DELAY_MS);
      }
    },
    [nodes, onToggleExpand, onDragOver]
  );

  const content = (
    <div>
      {filteredNodes.map((node) =>
        isDraggable ? (
          <SortableTreeNodeItem
            key={node.id}
            node={node}
            onNodeClick={onNodeClick}
            onToggleExpand={onToggleExpand}
            isDraggable={isDraggable}
          />
        ) : (
          <TreeNodeItem
            key={node.id}
            node={node}
            onNodeClick={onNodeClick}
            onToggleExpand={onToggleExpand}
            isDraggable={false}
          />
        )
      )}
    </div>
  );

  return (
    <div data-testid="tab-tree-view" className="w-full">
      {filteredNodes.length === 0 ? (
        <div className="p-4 text-gray-500 text-sm">No tabs in this view</div>
      ) : isDraggable && onDragEnd ? (
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          onDragOver={handleDragOver}
        >
          <SortableContext
            items={allNodeIds}
            strategy={verticalListSortingStrategy}
          >
            {content}
          </SortableContext>
        </DndContext>
      ) : (
        content
      )}
    </div>
  );
};

export default TabTreeView;
