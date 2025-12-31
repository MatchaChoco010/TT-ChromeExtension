import React, { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import type { TabNode, Group, ExtendedTabInfo, MenuAction } from '@/types';
import { ContextMenu } from './ContextMenu';
import { useMenuActions } from '../hooks/useMenuActions';
import UnreadBadge from './UnreadBadge';
import CloseButton from './CloseButton';
import { useDragDrop, type DropTarget, DropTargetType } from '../hooks/useDragDrop';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { DragOverlay } from './DragOverlay';

/**
 * Task 11.1: タブグループをツリービュー内に表示するコンポーネント
 * Requirements: 2.1, 2.3
 *
 * このコンポーネントは、タブグループを通常のタブと同じツリービュー内に統合して表示します:
 * - グループノードがタブと同じツリービュー内に表示される
 * - グループノードが展開/折りたたみ可能である
 * - グループ内のタブはグループの子として表示される
 */

interface TabTreeViewWithGroupsProps {
  nodes: TabNode[];
  groups: Record<string, Group>;
  currentViewId: string;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (nodeId: string) => void;
  onGroupToggle: (groupId: string) => void;
  getTabInfo?: (tabId: number) => ExtendedTabInfo | undefined;
  isTabUnread?: (tabId: number) => boolean;
  getUnreadChildCount?: (nodeId: string) => number;
  activeTabId?: number;
  isNodeSelected?: (nodeId: string) => boolean;
  onSelect?: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  onSnapshot?: () => Promise<void>;
}

interface GroupTreeNodeProps {
  group: Group;
  childNodes: TabNode[];
  onGroupToggle: (groupId: string) => void;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (nodeId: string) => void;
  getTabInfo?: (tabId: number) => ExtendedTabInfo | undefined;
  isTabUnread?: (tabId: number) => boolean;
  getUnreadChildCount?: (nodeId: string) => number;
  activeTabId?: number;
  isNodeSelected?: (nodeId: string) => boolean;
  onSelect?: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  onSnapshot?: () => Promise<void>;
}

/**
 * Task 11.2: ドラッグ可能なグループツリーノードのprops
 * Requirements: 2.2
 * Task 12.1 (tab-tree-bugfix-2): dnd-kitからuseDragDropへ移行
 */
interface DraggableGroupTreeNodeProps extends GroupTreeNodeProps {
  /** 自前D&D: このグループがドラッグ中かどうか */
  isDragging?: boolean;
  /** 自前D&D: グローバルでドラッグ中かどうか */
  globalIsDragging?: boolean;
  /** 自前D&D: マウスダウンハンドラ */
  onMouseDown?: (e: React.MouseEvent) => void;
}

/**
 * グループツリーノードコンポーネント
 * グループとその子タブを表示
 */
const GroupTreeNode: React.FC<GroupTreeNodeProps> = ({
  group,
  childNodes,
  onGroupToggle,
  onNodeClick,
  onToggleExpand,
  getTabInfo,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  isNodeSelected,
  onSelect,
  onSnapshot,
}) => {
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onGroupToggle(group.id);
  };

  return (
    <div data-testid={`group-tree-node-${group.id}`}>
      {/* グループヘッダー */}
      <div
        className="flex items-center p-2 hover:bg-gray-700 cursor-pointer bg-gray-800"
        style={{ paddingLeft: '8px' }}
      >
        {/* 展開/折りたたみボタン */}
        <button
          data-testid={`toggle-expand-${group.id}`}
          onClick={handleToggleClick}
          className="mr-2 w-4 h-4 flex items-center justify-center text-gray-300"
          aria-label={group.isExpanded ? 'Collapse' : 'Expand'}
        >
          {group.isExpanded ? '▼' : '▶'}
        </button>

        {/* グループカラーインジケータ */}
        <div
          data-testid={`group-color-indicator-${group.id}`}
          className="mr-2 w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: group.color }}
        />

        {/* グループ名 */}
        <span className="text-sm font-medium truncate text-gray-100">{group.name}</span>
      </div>

      {/* グループ内のタブ（展開時のみ表示） */}
      {group.isExpanded && childNodes.length > 0 && (
        <div>
          {childNodes.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              onNodeClick={onNodeClick}
              onToggleExpand={onToggleExpand}
              getTabInfo={getTabInfo}
              isTabUnread={isTabUnread}
              getUnreadChildCount={getUnreadChildCount}
              activeTabId={activeTabId}
              isNodeSelected={isNodeSelected}
              onSelect={onSelect}
              onSnapshot={onSnapshot}
            />
          ))}
        </div>
      )}
    </div>
  );
};

interface TreeNodeItemProps {
  node: TabNode;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (nodeId: string) => void;
  getTabInfo?: (tabId: number) => ExtendedTabInfo | undefined;
  isTabUnread?: (tabId: number) => boolean;
  getUnreadChildCount?: (nodeId: string) => number;
  activeTabId?: number;
  isNodeSelected?: (nodeId: string) => boolean;
  onSelect?: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  onSnapshot?: () => Promise<void>;
}

/**
 * ツリーノードアイテムコンポーネント
 * タブを表示
 */
const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  onNodeClick,
  onToggleExpand,
  getTabInfo,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  isNodeSelected,
  onSelect,
  onSnapshot,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const { executeAction } = useMenuActions();

  const isUnread = isTabUnread ? isTabUnread(node.tabId) : false;
  const unreadChildCount = getUnreadChildCount ? getUnreadChildCount(node.id) : 0;
  const isActive = activeTabId === node.tabId;
  const tabInfo = getTabInfo ? getTabInfo(node.tabId) : undefined;
  const isSelected = isNodeSelected ? isNodeSelected(node.id) : false;

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => setIsHovered(false);

  const handleCloseClick = () => {
    chrome.tabs.remove(node.tabId);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const handleContextMenuAction = (action: MenuAction) => {
    executeAction(action, [node.tabId], { url: tabInfo?.url || 'about:blank', onSnapshot });
  };

  const handleNodeClick = (e: React.MouseEvent) => {
    if (onSelect) {
      onSelect(node.id, {
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
      });
    }
    onNodeClick(node.tabId);
  };

  return (
    <div>
      <div
        data-testid={`tree-node-${node.tabId}`}
        data-node-id={node.id}
        data-expanded={node.isExpanded ? 'true' : 'false'}
        data-depth={node.depth}
        className={`flex items-center p-2 hover:bg-gray-700 cursor-pointer text-gray-100 ${isActive ? 'bg-gray-600' : ''} ${isSelected ? 'bg-gray-500' : ''}`}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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

        {/* ファビコン表示 */}
        {getTabInfo && tabInfo ? (
          <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0">
            {tabInfo.favIconUrl ? (
              <img
                src={tabInfo.favIconUrl}
                alt="Favicon"
                className="w-full h-full object-contain"
              />
            ) : (
              <div
                data-testid="default-icon"
                className="w-full h-full bg-gray-300 rounded-sm"
              />
            )}
          </div>
        ) : getTabInfo && !tabInfo ? (
          <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0">
            <div
              data-testid="default-icon"
              className="w-full h-full bg-gray-300 rounded-sm animate-pulse"
            />
          </div>
        ) : null}

        {/* タブの内容 - Task 2.3 (tab-tree-bugfix-2): タイトルと右端固定要素を分離 */}
        <div
          data-testid="tab-content"
          className="flex-1 flex items-center justify-between min-w-0"
        >
          {/* タブタイトルエリア - Task 2.3 (tab-tree-bugfix-2): 左側エリア */}
          <div data-testid="title-area" className="flex items-center min-w-0 flex-1">
            <span
              className="truncate"
              data-testid="tab-title"
            >
              {getTabInfo ? (tabInfo ? tabInfo.title : 'Loading...') : `Tab ${node.tabId}`}
            </span>
          </div>
          {/* Task 2.3 (tab-tree-bugfix-2): 右端固定コンテナ - 未読インジケータと閉じるボタン */}
          {/* Requirement 13.1, 13.2: 未読インジケーターをタブの右端に固定表示 */}
          <div
            data-testid="right-actions-container"
            className="flex items-center flex-shrink-0 ml-2"
          >
            <UnreadBadge isUnread={isUnread} showIndicator={true} />
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
            {isHovered && <CloseButton onClose={handleCloseClick} />}
          </div>
        </div>
      </div>

      {/* コンテキストメニュー */}
      {contextMenuOpen && (
        <ContextMenu
          targetTabIds={[node.tabId]}
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuOpen(false)}
          hasChildren={hasChildren}
          tabUrl={tabInfo?.url || 'about:blank'}
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
              getTabInfo={getTabInfo}
              isTabUnread={isTabUnread}
              getUnreadChildCount={getUnreadChildCount}
              activeTabId={activeTabId}
              isNodeSelected={isNodeSelected}
              onSelect={onSelect}
              onSnapshot={onSnapshot}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * タブグループを統合したツリービューコンポーネント
 */
export const TabTreeViewWithGroups: React.FC<TabTreeViewWithGroupsProps> = ({
  nodes,
  groups,
  currentViewId,
  onNodeClick,
  onToggleExpand,
  onGroupToggle,
  getTabInfo,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  isNodeSelected,
  onSelect,
  onSnapshot,
}) => {
  // 現在のビューでフィルタリングされたノード
  const filteredNodes = useMemo(
    () => nodes.filter((node) => node.viewId === currentViewId),
    [nodes, currentViewId]
  );

  // グループ別にタブをグループ化
  const { groupedNodes, ungroupedNodes } = useMemo(() => {
    const grouped: Record<string, TabNode[]> = {};
    const ungrouped: TabNode[] = [];

    filteredNodes.forEach((node) => {
      if (node.groupId && groups[node.groupId]) {
        if (!grouped[node.groupId]) {
          grouped[node.groupId] = [];
        }
        grouped[node.groupId].push(node);
      } else {
        ungrouped.push(node);
      }
    });

    return { groupedNodes: grouped, ungroupedNodes: ungrouped };
  }, [filteredNodes, groups]);

  return (
    <div data-testid="tab-tree-view-with-groups" className="w-full">
      {/* グループとそのタブを表示 */}
      {Object.entries(groups).map(([groupId, group]) => {
        const childNodes = groupedNodes[groupId] || [];
        // グループ内にタブがない場合でもグループを表示
        return (
          <GroupTreeNode
            key={groupId}
            group={group}
            childNodes={childNodes}
            onGroupToggle={onGroupToggle}
            onNodeClick={onNodeClick}
            onToggleExpand={onToggleExpand}
            getTabInfo={getTabInfo}
            isTabUnread={isTabUnread}
            getUnreadChildCount={getUnreadChildCount}
            activeTabId={activeTabId}
            isNodeSelected={isNodeSelected}
            onSelect={onSelect}
            onSnapshot={onSnapshot}
          />
        );
      })}

      {/* グループに属さないタブを表示 */}
      {ungroupedNodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          onNodeClick={onNodeClick}
          onToggleExpand={onToggleExpand}
          getTabInfo={getTabInfo}
          isTabUnread={isTabUnread}
          getUnreadChildCount={getUnreadChildCount}
          activeTabId={activeTabId}
          isNodeSelected={isNodeSelected}
          onSelect={onSelect}
          onSnapshot={onSnapshot}
        />
      ))}

      {/* 何も表示するものがない場合 */}
      {Object.keys(groups).length === 0 && ungroupedNodes.length === 0 && (
        <div className="p-4 text-gray-400 text-sm">No tabs in this view</div>
      )}
    </div>
  );
};

export default TabTreeViewWithGroups;

/**
 * Task 11.2: ドラッグ可能なグループツリーノードコンポーネント
 * Requirements: 2.2
 * Task 12.1 (tab-tree-bugfix-2): dnd-kitからuseDragDropへ移行
 *
 * グループをドラッグ可能にして、グループ単位での移動を可能にする
 */
const DraggableGroupTreeNode: React.FC<DraggableGroupTreeNodeProps> = ({
  group,
  childNodes,
  onGroupToggle,
  onNodeClick,
  onToggleExpand,
  getTabInfo,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  isNodeSelected,
  onSelect,
  onSnapshot,
  isDragging = false,
  // globalIsDraggingは将来の拡張用に残しておく（ドラッグ中の他のグループのスタイリングなど）
  globalIsDragging: _globalIsDragging,
  onMouseDown,
}) => {
  const style: React.CSSProperties = {
    opacity: isDragging ? 0.5 : 1,
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onGroupToggle(group.id);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // 展開ボタンのクリックは除外
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    onMouseDown?.(e);
  };

  return (
    <div style={style} data-testid={`group-tree-node-${group.id}`}>
      {/* グループヘッダー（ドラッグハンドル付き） */}
      <div
        data-draggable-item={`draggable-group-${group.id}`}
        data-node-id={`group-${group.id}`}
        data-depth={0}
        className={`flex items-center p-2 hover:bg-gray-700 cursor-grab bg-gray-800 select-none ${isDragging ? 'bg-gray-600 ring-2 ring-gray-500 ring-inset is-dragging' : ''}`}
        style={{ paddingLeft: '8px' }}
        onMouseDown={handleMouseDown}
      >
        {/* 展開/折りたたみボタン */}
        <button
          data-testid={`toggle-expand-${group.id}`}
          onClick={handleToggleClick}
          onPointerDown={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          className="mr-2 w-4 h-4 flex items-center justify-center text-gray-300"
          aria-label={group.isExpanded ? 'Collapse' : 'Expand'}
        >
          {group.isExpanded ? '▼' : '▶'}
        </button>

        {/* グループカラーインジケータ */}
        <div
          data-testid={`group-color-indicator-${group.id}`}
          className="mr-2 w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: group.color }}
        />

        {/* グループ名 */}
        <span className="text-sm font-medium truncate text-gray-100">{group.name}</span>
      </div>

      {/* グループ内のタブ（展開時のみ表示、ドラッグ中は非表示） */}
      {group.isExpanded && childNodes.length > 0 && !isDragging && (
        <div>
          {childNodes.map((node) => (
            <TreeNodeItem
              key={node.id}
              node={node}
              onNodeClick={onNodeClick}
              onToggleExpand={onToggleExpand}
              getTabInfo={getTabInfo}
              isTabUnread={isTabUnread}
              getUnreadChildCount={getUnreadChildCount}
              activeTabId={activeTabId}
              isNodeSelected={isNodeSelected}
              onSelect={onSelect}
              onSnapshot={onSnapshot}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Task 11.2: ドラッグ可能なタブグループ統合ツリービュー
 * Requirements: 2.2
 * Task 12.1 (tab-tree-bugfix-2): dnd-kitからuseDragDropへ移行
 *
 * タブグループとタブをドラッグ&ドロップで並び替え可能にする
 */
interface DraggableTabTreeViewWithGroupsProps extends TabTreeViewWithGroupsProps {
  /** ドラッグ終了時のコールバック（dnd-kit形式の互換性を維持） */
  onDragEnd: (event: { active: { id: string }; over: { id: string } | null }) => void;
  /** グループドラッグ終了時のコールバック */
  onGroupDragEnd: (groupId: string, newIndex: number, tabIds: number[]) => void;
  /** ドラッグ開始時のコールバック（dnd-kit形式の互換性を維持） */
  onDragStart?: (event: { active: { id: string } }) => void;
}

export const DraggableTabTreeViewWithGroups: React.FC<DraggableTabTreeViewWithGroupsProps> = ({
  nodes,
  groups,
  currentViewId,
  onNodeClick,
  onToggleExpand,
  onGroupToggle,
  onDragEnd,
  onGroupDragEnd,
  onDragStart,
  getTabInfo,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  isNodeSelected,
  onSelect,
  onSnapshot,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [globalIsDragging, setGlobalIsDragging] = useState(false);

  // 現在のビューでフィルタリングされたノード
  const filteredNodes = useMemo(
    () => nodes.filter((node) => node.viewId === currentViewId),
    [nodes, currentViewId]
  );

  // グループ別にタブをグループ化
  const { groupedNodes, ungroupedNodes } = useMemo(() => {
    const grouped: Record<string, TabNode[]> = {};
    const ungrouped: TabNode[] = [];

    filteredNodes.forEach((node) => {
      if (node.groupId && groups[node.groupId]) {
        if (!grouped[node.groupId]) {
          grouped[node.groupId] = [];
        }
        grouped[node.groupId].push(node);
      } else {
        ungrouped.push(node);
      }
    });

    return { groupedNodes: grouped, ungroupedNodes: ungrouped };
  }, [filteredNodes, groups]);

  // 自前D&D用のアイテムリストを生成
  const items = useMemo(() => {
    const result: Array<{ id: string; tabId: number }> = [];

    // グループIDを追加（group-プレフィックス付き、tabIdは-1とする仮想ID）
    Object.keys(groups).forEach((groupId, idx) => {
      result.push({ id: `group-${groupId}`, tabId: -(idx + 1) });
    });

    // グループに属さないノードを追加
    ungroupedNodes.forEach((node) => {
      result.push({ id: node.id, tabId: node.tabId });
    });

    return result;
  }, [groups, ungroupedNodes]);

  // Task 12.1: 自前D&Dフックを使用
  const {
    dragState,
    getItemProps,
    cancelDrag,
  } = useDragDrop({
    containerRef,
    items,
    activationDistance: 8,
    direction: 'vertical',
    onDragStart: useCallback((itemId: string, _tabId: number) => {
      setGlobalIsDragging(true);
      if (onDragStart) {
        onDragStart({ active: { id: itemId } });
      }
    }, [onDragStart]),
    onDragMove: useCallback((_position: { x: number; y: number }, _dropTarget: DropTarget | null) => {
      // ドロップターゲットの更新（必要に応じて実装）
    }, []),
    onDragEnd: useCallback((itemId: string, dropTarget: DropTarget | null) => {
      setGlobalIsDragging(false);

      // ドロップターゲットがない場合は何もしない
      if (!dropTarget) {
        return;
      }

      // グループがドラッグされた場合
      if (itemId.startsWith('group-')) {
        const groupId = itemId.replace('group-', '');
        const childTabIds = groupedNodes[groupId]?.map((node) => node.tabId) || [];

        // 新しいインデックスを計算（dropTarget.gapIndexを使用）
        const newIndex = dropTarget.gapIndex ?? 0;
        onGroupDragEnd(groupId, newIndex, childTabIds);
      } else {
        // 通常のタブがドラッグされた場合
        // dnd-kit形式の互換イベントを作成
        const overId = dropTarget.type === DropTargetType.Tab
          ? dropTarget.targetNodeId
          : null;

        if (overId) {
          onDragEnd({
            active: { id: itemId },
            over: { id: overId },
          });
        }
      }
    }, [onDragEnd, onGroupDragEnd, groupedNodes]),
    onDragCancel: useCallback(() => {
      setGlobalIsDragging(false);
    }, []),
  });

  // 自動スクロールフック
  const { handleAutoScroll, stopAutoScroll } = useAutoScroll(containerRef, {
    threshold: 50,
    speed: 8,
    clampToContent: true,
  });

  // ドラッグ中の自動スクロール処理
  useEffect(() => {
    if (dragState.isDragging) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        handleAutoScroll(dragState.currentPosition.y, rect);
      }
    } else {
      stopAutoScroll();
    }
  }, [dragState.isDragging, dragState.currentPosition.y, handleAutoScroll, stopAutoScroll]);

  // ESCキーでドラッグキャンセル
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.isDragging) {
        cancelDrag();
      }
    };

    if (dragState.isDragging) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [dragState.isDragging, cancelDrag]);

  // グループ用のマウスダウンハンドラを生成
  const getGroupMouseDownHandler = useCallback((groupId: string, idx: number) => {
    return (e: React.MouseEvent) => {
      const props = getItemProps(`group-${groupId}`, -(idx + 1));
      props.onMouseDown(e);
    };
  }, [getItemProps]);

  // ドラッグ中のグループ情報を取得
  const draggedGroup = useMemo(() => {
    if (!dragState.isDragging || !dragState.draggedItemId) return null;
    if (!dragState.draggedItemId.startsWith('group-')) return null;
    const groupId = dragState.draggedItemId.replace('group-', '');
    return groups[groupId] || null;
  }, [dragState.isDragging, dragState.draggedItemId, groups]);

  return (
    <div ref={containerRef} data-testid="tab-tree-view-with-groups" className="w-full">
      {/* グループとそのタブを表示 */}
      {Object.entries(groups).map(([groupId, group], idx) => {
        const childNodes = groupedNodes[groupId] || [];
        const isDragging = dragState.isDragging && dragState.draggedItemId === `group-${groupId}`;

        return (
          <DraggableGroupTreeNode
            key={groupId}
            group={group}
            childNodes={childNodes}
            onGroupToggle={onGroupToggle}
            onNodeClick={onNodeClick}
            onToggleExpand={onToggleExpand}
            getTabInfo={getTabInfo}
            isTabUnread={isTabUnread}
            getUnreadChildCount={getUnreadChildCount}
            activeTabId={activeTabId}
            isNodeSelected={isNodeSelected}
            onSelect={onSelect}
            onSnapshot={onSnapshot}
            isDragging={isDragging}
            globalIsDragging={globalIsDragging}
            onMouseDown={getGroupMouseDownHandler(groupId, idx)}
          />
        );
      })}

      {/* グループに属さないタブを表示 */}
      {ungroupedNodes.map((node) => (
        <TreeNodeItem
          key={node.id}
          node={node}
          onNodeClick={onNodeClick}
          onToggleExpand={onToggleExpand}
          getTabInfo={getTabInfo}
          isTabUnread={isTabUnread}
          getUnreadChildCount={getUnreadChildCount}
          activeTabId={activeTabId}
          isNodeSelected={isNodeSelected}
          onSelect={onSelect}
          onSnapshot={onSnapshot}
        />
      ))}

      {/* 何も表示するものがない場合 */}
      {Object.keys(groups).length === 0 && ungroupedNodes.length === 0 && (
        <div className="p-4 text-gray-400 text-sm">No tabs in this view</div>
      )}

      {/* ドラッグオーバーレイ（グループ用） */}
      <DragOverlay
        isDragging={dragState.isDragging && !!draggedGroup}
        position={dragState.currentPosition}
        offset={dragState.offset}
      >
        {draggedGroup && (
          <div
            className="flex items-center p-2 bg-gray-700 text-gray-100 shadow-lg rounded border border-gray-600"
            style={{ width: '250px' }}
          >
            {/* グループカラーインジケータ */}
            <div
              className="mr-2 w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: draggedGroup.color }}
            />
            {/* グループ名 */}
            <span className="truncate text-sm font-medium">{draggedGroup.name}</span>
          </div>
        )}
      </DragOverlay>
    </div>
  );
};
