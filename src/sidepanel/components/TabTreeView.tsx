import React, { useMemo, useRef, useEffect, useState } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { DndContext, closestCenter, DragOverEvent } from '@dnd-kit/core';
import type { TabNode, TabTreeViewProps, MenuAction } from '@/types';
import { ContextMenu } from './ContextMenu';
import { useMenuActions } from '../hooks/useMenuActions';
import UnreadBadge from './UnreadBadge';

// Task 6.4: ドラッグホバー時のブランチ自動展開の閾値（ミリ秒）
// Requirement 3.4: ホバー時間が1秒を超えたら展開
const AUTO_EXPAND_HOVER_DELAY_MS = 1000;

interface TreeNodeItemProps {
  node: TabNode;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (nodeId: string) => void;
  isDraggable: boolean;
  // Task 4.13: 未読状態を確認する関数
  isTabUnread?: (tabId: number) => boolean;
  // Task 4.13: 子孫の未読数を取得する関数
  getUnreadChildCount?: (nodeId: string) => number;
}

/**
 * ドラッグ可能なツリーノード項目コンポーネント
 * Task 4.11: コンテキストメニュー機能を追加
 * Task 4.13: 未読バッジ表示を追加
 */
const SortableTreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  onNodeClick,
  onToggleExpand,
  isDraggable,
  isTabUnread,
  getUnreadChildCount,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const { executeAction } = useMenuActions();

  // Task 4.13: 未読状態とカウントを計算
  const isUnread = isTabUnread ? isTabUnread(node.tabId) : false;
  const unreadChildCount = getUnreadChildCount ? getUnreadChildCount(node.id) : 0;

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

  // Task 4.11: 右クリック時のコンテキストメニュー表示
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  // Task 4.11: コンテキストメニューのアクション実行
  const handleContextMenuAction = (action: MenuAction) => {
    executeAction(action, [node.tabId], { url: `about:blank` });
  };

  return (
    <div ref={setNodeRef} style={style}>
      {/* ノードの内容 */}
      <div
        data-testid={`tree-node-${node.tabId}`}
        data-node-id={node.id}
        data-sortable-item={`sortable-item-${node.id}`}
        data-expanded={node.isExpanded ? 'true' : 'false'}
        data-depth={node.depth}
        className={`flex items-center p-2 hover:bg-gray-100 cursor-pointer ${isDragging ? 'bg-blue-100 border-2 border-blue-500' : ''}`}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={() => onNodeClick(node.tabId)}
        onContextMenu={handleContextMenu}
        {...attributes}
        {...listeners}
      >
        {/* 展開/折りたたみボタン */}
        {hasChildren && (
          <button
            data-testid="expand-button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="mr-2 w-4 h-4 flex items-center justify-center"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* タブの内容 */}
        <div className="flex-1 flex items-center">
          <span className="text-sm">Tab {node.tabId}</span>
          {/* Task 4.13: 未読バッジ */}
          <UnreadBadge isUnread={isUnread} showIndicator={true} />
          {/* Task 4.13: 子孫の未読数（子がいる場合のみ表示） */}
          {hasChildren && unreadChildCount > 0 && (
            <div
              data-testid="unread-child-indicator"
              className="ml-1 min-w-[20px] h-5 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 px-1.5"
            >
              <span data-testid="unread-count" className="text-xs font-semibold text-white leading-none">
                {unreadChildCount > 99 ? '99+' : unreadChildCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Task 4.11: コンテキストメニュー */}
      {contextMenuOpen && (
        <ContextMenu
          targetTabIds={[node.tabId]}
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuOpen(false)}
          hasChildren={hasChildren}
          tabUrl="about:blank"
        />
      )}

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
              isTabUnread={isTabUnread}
              getUnreadChildCount={getUnreadChildCount}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 非ドラッグ可能なツリーノード項目コンポーネント
 * Task 4.11: コンテキストメニュー機能を追加
 * Task 4.13: 未読バッジ表示を追加
 */
const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  onNodeClick,
  onToggleExpand,
  isTabUnread,
  getUnreadChildCount,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const { executeAction } = useMenuActions();

  // Task 4.13: 未読状態とカウントを計算
  const isUnread = isTabUnread ? isTabUnread(node.tabId) : false;
  const unreadChildCount = getUnreadChildCount ? getUnreadChildCount(node.id) : 0;

  // Task 4.11: 右クリック時のコンテキストメニュー表示
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  // Task 4.11: コンテキストメニューのアクション実行
  const handleContextMenuAction = (action: MenuAction) => {
    executeAction(action, [node.tabId], { url: `about:blank` });
  };

  return (
    <div>
      {/* ノードの内容 */}
      <div
        data-testid={`tree-node-${node.tabId}`}
        data-node-id={node.id}
        data-expanded={node.isExpanded ? 'true' : 'false'}
        data-depth={node.depth}
        className="flex items-center p-2 hover:bg-gray-100 cursor-pointer"
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={() => onNodeClick(node.tabId)}
        onContextMenu={handleContextMenu}
      >
        {/* 展開/折りたたみボタン */}
        {hasChildren && (
          <button
            data-testid="expand-button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="mr-2 w-4 h-4 flex items-center justify-center"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* タブの内容 */}
        <div className="flex-1 flex items-center">
          <span className="text-sm">Tab {node.tabId}</span>
          {/* Task 4.13: 未読バッジ */}
          <UnreadBadge isUnread={isUnread} showIndicator={true} />
          {/* Task 4.13: 子孫の未読数（子がいる場合のみ表示） */}
          {hasChildren && unreadChildCount > 0 && (
            <div
              data-testid="unread-child-indicator"
              className="ml-1 min-w-[20px] h-5 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0 px-1.5"
            >
              <span data-testid="unread-count" className="text-xs font-semibold text-white leading-none">
                {unreadChildCount > 99 ? '99+' : unreadChildCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Task 4.11: コンテキストメニュー */}
      {contextMenuOpen && (
        <ContextMenu
          targetTabIds={[node.tabId]}
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuOpen(false)}
          hasChildren={hasChildren}
          tabUrl="about:blank"
        />
      )}

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
              isTabUnread={isTabUnread}
              getUnreadChildCount={getUnreadChildCount}
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
 * Task 4.13: 未読状態表示機能を追加
 */
const TabTreeView: React.FC<TabTreeViewProps> = ({
  nodes,
  currentViewId,
  onNodeClick,
  onToggleExpand,
  onDragEnd,
  onDragOver,
  isTabUnread,
  getUnreadChildCount,
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
            isTabUnread={isTabUnread}
            getUnreadChildCount={getUnreadChildCount}
          />
        ) : (
          <TreeNodeItem
            key={node.id}
            node={node}
            onNodeClick={onNodeClick}
            onToggleExpand={onToggleExpand}
            isDraggable={false}
            isTabUnread={isTabUnread}
            getUnreadChildCount={getUnreadChildCount}
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
