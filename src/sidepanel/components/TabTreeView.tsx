import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useSortable, SortableContext } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  DndContext,
  closestCenter,
  DragOverEvent,
  DragMoveEvent,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDndMonitor,
} from '@dnd-kit/core';
import type { TabNode, TabTreeViewProps, MenuAction, ExtendedTabInfo, Group, View } from '@/types';
import { ContextMenu } from './ContextMenu';
import { useMenuActions } from '../hooks/useMenuActions';
import UnreadBadge from './UnreadBadge';
import CloseButton from './CloseButton';
import DropIndicator from './DropIndicator';
import {
  calculateDropTarget,
  calculateIndicatorY,
  DropTargetType,
  type DropTarget,
  type TabPosition,
} from './GapDropDetection';

// Task 6.4: ドラッグホバー時のブランチ自動展開の閾値（ミリ秒）
// Requirement 3.4: ホバー時間が1秒を超えたら展開
const AUTO_EXPAND_HOVER_DELAY_MS = 1000;

// Task 4.3: インデント幅（ピクセル）
const INDENT_WIDTH = 20;

// Task 5.2: autoScroll設定
// 要件7.1, 7.2: スクロール可能範囲を実際のコンテンツ範囲内に制限
const AUTO_SCROLL_CONFIG = {
  // スクロール開始のしきい値（上下それぞれ15%の領域で自動スクロール開始）
  threshold: {
    x: 0.1,
    y: 0.15,
  },
  // 加速度を抑えて過度なスクロールを防止
  acceleration: 5,
  // スクロール間隔を長めに設定して過度なスクロールを防止
  interval: 10,
} as const;

interface TreeNodeItemProps {
  node: TabNode;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (nodeId: string) => void;
  isDraggable: boolean;
  // Task 4.13: 未読状態を確認する関数
  isTabUnread?: (tabId: number) => boolean;
  // Task 4.13: 子孫の未読数を取得する関数
  getUnreadChildCount?: (nodeId: string) => number;
  // Task 8.5.4: アクティブタブID
  activeTabId?: number;
  // Task 2.1: タブ情報取得関数
  getTabInfo?: (tabId: number) => ExtendedTabInfo | undefined;
  // Task 2.3: 選択状態管理
  isNodeSelected?: (nodeId: string) => boolean;
  onSelect?: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  // Task 12.2: 選択されたすべてのタブIDを取得するヘルパー
  getSelectedTabIds?: () => number[];
  // Task 4.3: ドラッグホバーハイライト状態
  isDragHighlighted?: boolean;
  // Task 4.4: グローバルドラッグ中フラグ（他のノードのtransformを無効化するため）
  globalIsDragging?: boolean;
  // Task 4.4: ドラッグ中のアクティブノードID
  activeNodeId?: string | null;
  // Task 6.2: スナップショット取得コールバック
  onSnapshot?: () => Promise<void>;
  // Task 7.2: ビュー移動サブメニュー用
  views?: View[];
  currentViewId?: string;
  onMoveToView?: (viewId: string, tabIds: number[]) => void;
}

/**
 * ドラッグ可能なツリーノード項目コンポーネント
 * Task 4.11: コンテキストメニュー機能を追加
 * Task 4.13: 未読バッジ表示を追加
 * Task 2.1: タブ情報（タイトル、ファビコン）表示を追加
 */
const SortableTreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  onNodeClick,
  onToggleExpand,
  isDraggable,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  getTabInfo,
  isNodeSelected,
  onSelect,
  getSelectedTabIds,
  isDragHighlighted,
  globalIsDragging,
  activeNodeId,
  onSnapshot,
  views,
  currentViewId,
  onMoveToView,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  // Task 2.2: ホバー状態管理
  const [isHovered, setIsHovered] = useState(false);
  const { executeAction } = useMenuActions();

  // Task 4.13: 未読状態とカウントを計算
  const isUnread = isTabUnread ? isTabUnread(node.tabId) : false;
  const unreadChildCount = getUnreadChildCount ? getUnreadChildCount(node.id) : 0;
  // Task 8.5.4: アクティブ状態を計算
  const isActive = activeTabId === node.tabId;
  // Task 2.1: タブ情報を取得
  const tabInfo = getTabInfo ? getTabInfo(node.tabId) : undefined;
  // Task 2.3: 選択状態を計算
  const isSelected = isNodeSelected ? isNodeSelected(node.id) : false;

  // Task 2.2: ホバー時のイベントハンドラ
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Task 2.2: 閉じるボタンクリック時にchrome.tabs.removeを呼び出す
  const handleCloseClick = () => {
    chrome.tabs.remove(node.tabId);
  };

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

  // Task 4.4: ドラッグ中は他のノードのtransformを無効化してタブ位置を固定
  // ドラッグ中のアイテム自体のみtransformを適用
  const isActiveItem = activeNodeId === node.id;
  const shouldApplyTransform = isDragging || (isActiveItem && globalIsDragging);

  const style = {
    // Task 4.4: ドラッグ中のアイテム以外はtransformを適用しない（リアルタイム並べ替え無効化）
    transform: shouldApplyTransform ? CSS.Transform.toString(transform) : undefined,
    transition: shouldApplyTransform ? transition : undefined,
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
  // Task 6.2: snapshotアクションにはonSnapshotコールバックを渡す
  // Task 12.2: 複数選択時は選択されたすべてのタブIDを使用
  const handleContextMenuAction = (action: MenuAction) => {
    const targetTabIds = isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId];
    executeAction(action, targetTabIds, { url: tabInfo?.url || 'about:blank', onSnapshot });
  };

  // Task 2.3: クリック時に選択状態を処理
  const handleNodeClick = (e: React.MouseEvent) => {
    // 選択機能が有効な場合は選択処理を行う
    if (onSelect) {
      onSelect(node.id, {
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
      });
    }
    // タブをアクティブにする
    onNodeClick(node.tabId);
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
        className={`flex items-center p-2 hover:bg-gray-700 cursor-pointer text-gray-100 ${isDragging ? 'bg-gray-600 border-2 border-gray-500' : ''} ${isActive && !isDragging ? 'bg-gray-600' : ''} ${isSelected ? 'bg-gray-500' : ''} ${isDragHighlighted && !isDragging ? 'bg-gray-500 border-2 border-gray-400' : ''}`}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
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

        {/* Task 2.1: ファビコン表示 */}
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
          /* タブ情報ロード中のプレースホルダー */
          <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0">
            <div
              data-testid="default-icon"
              className="w-full h-full bg-gray-300 rounded-sm animate-pulse"
            />
          </div>
        ) : null}

        {/* タブの内容 - Task 2.3: justify-betweenで閉じるボタンを右端に固定 */}
        <div
          data-testid="tab-content"
          className="flex-1 flex items-center justify-between min-w-0"
        >
          {/* タブタイトルエリア */}
          <div className="flex items-center min-w-0 flex-1">
            {/* Task 2.1: タブタイトル表示 */}
            <span className="text-sm truncate">
              {getTabInfo ? (tabInfo ? tabInfo.title : 'Loading...') : `Tab ${node.tabId}`}
            </span>
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
          {/* Task 2.3: 閉じるボタン - 常にDOMに存在し、visible/invisibleで制御してサイズ変化を防止 */}
          <div
            data-testid="close-button-wrapper"
            className={`flex-shrink-0 ${isHovered ? 'visible' : 'invisible'}`}
          >
            <CloseButton onClose={handleCloseClick} />
          </div>
        </div>
      </div>

      {/* Task 4.11: コンテキストメニュー */}
      {/* Task 12.2: 複数選択時は選択されたすべてのタブIDを使用 */}
      {contextMenuOpen && (
        <ContextMenu
          targetTabIds={isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId]}
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuOpen(false)}
          hasChildren={hasChildren}
          tabUrl={tabInfo?.url || 'about:blank'}
          views={views}
          currentViewId={currentViewId}
          onMoveToView={onMoveToView}
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
              activeTabId={activeTabId}
              getTabInfo={getTabInfo}
              isNodeSelected={isNodeSelected}
              onSelect={onSelect}
              getSelectedTabIds={getSelectedTabIds}
              globalIsDragging={globalIsDragging}
              activeNodeId={activeNodeId}
              onSnapshot={onSnapshot}
              views={views}
              currentViewId={currentViewId}
              onMoveToView={onMoveToView}
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
 * Task 2.1: タブ情報（タイトル、ファビコン）表示を追加
 * Task 2.3: 選択状態管理を追加
 */
const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  onNodeClick,
  onToggleExpand,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  getTabInfo,
  isNodeSelected,
  onSelect,
  getSelectedTabIds,
  onSnapshot,
  views,
  currentViewId,
  onMoveToView,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  // Task 2.2: ホバー状態管理
  const [isHovered, setIsHovered] = useState(false);
  const { executeAction } = useMenuActions();

  // Task 4.13: 未読状態とカウントを計算
  const isUnread = isTabUnread ? isTabUnread(node.tabId) : false;
  const unreadChildCount = getUnreadChildCount ? getUnreadChildCount(node.id) : 0;
  // Task 8.5.4: アクティブ状態を計算
  const isActive = activeTabId === node.tabId;
  // Task 2.1: タブ情報を取得
  const tabInfo = getTabInfo ? getTabInfo(node.tabId) : undefined;
  // Task 2.3: 選択状態を計算
  const isSelected = isNodeSelected ? isNodeSelected(node.id) : false;

  // Task 2.2: ホバー時のイベントハンドラ
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Task 2.2: 閉じるボタンクリック時にchrome.tabs.removeを呼び出す
  const handleCloseClick = () => {
    chrome.tabs.remove(node.tabId);
  };

  // Task 4.11: 右クリック時のコンテキストメニュー表示
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  // Task 4.11: コンテキストメニューのアクション実行
  // Task 6.2: snapshotアクションにはonSnapshotコールバックを渡す
  // Task 12.2: 複数選択時は選択されたすべてのタブIDを使用
  const handleContextMenuAction = (action: MenuAction) => {
    const targetTabIds = isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId];
    executeAction(action, targetTabIds, { url: tabInfo?.url || 'about:blank', onSnapshot });
  };

  // Task 2.3: クリック時に選択状態を処理
  const handleNodeClick = (e: React.MouseEvent) => {
    // 選択機能が有効な場合は選択処理を行う
    if (onSelect) {
      onSelect(node.id, {
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
      });
    }
    // タブをアクティブにする
    onNodeClick(node.tabId);
  };

  return (
    <div>
      {/* ノードの内容 */}
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

        {/* Task 2.1: ファビコン表示 */}
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
          /* タブ情報ロード中のプレースホルダー */
          <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0">
            <div
              data-testid="default-icon"
              className="w-full h-full bg-gray-300 rounded-sm animate-pulse"
            />
          </div>
        ) : null}

        {/* タブの内容 - Task 2.3: justify-betweenで閉じるボタンを右端に固定 */}
        <div
          data-testid="tab-content"
          className="flex-1 flex items-center justify-between min-w-0"
        >
          {/* タブタイトルエリア */}
          <div className="flex items-center min-w-0 flex-1">
            {/* Task 2.1: タブタイトル表示 */}
            <span className="text-sm truncate">
              {getTabInfo ? (tabInfo ? tabInfo.title : 'Loading...') : `Tab ${node.tabId}`}
            </span>
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
          {/* Task 2.3: 閉じるボタン - 常にDOMに存在し、visible/invisibleで制御してサイズ変化を防止 */}
          <div
            data-testid="close-button-wrapper"
            className={`flex-shrink-0 ${isHovered ? 'visible' : 'invisible'}`}
          >
            <CloseButton onClose={handleCloseClick} />
          </div>
        </div>
      </div>

      {/* Task 4.11: コンテキストメニュー */}
      {/* Task 12.2: 複数選択時は選択されたすべてのタブIDを使用 */}
      {contextMenuOpen && (
        <ContextMenu
          targetTabIds={isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId]}
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuOpen(false)}
          hasChildren={hasChildren}
          tabUrl={tabInfo?.url || 'about:blank'}
          views={views}
          currentViewId={currentViewId}
          onMoveToView={onMoveToView}
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
              activeTabId={activeTabId}
              getTabInfo={getTabInfo}
              isNodeSelected={isNodeSelected}
              onSelect={onSelect}
              getSelectedTabIds={getSelectedTabIds}
              onSnapshot={onSnapshot}
              views={views}
              currentViewId={currentViewId}
              onMoveToView={onMoveToView}
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
 * Task 4.3: ドラッグ中のドロップターゲット状態を監視するコンポーネント
 * useDndMonitorはDndContext内で使用する必要があるため、別コンポーネントに分離
 * Task 5.3: tabPositionsも提供（Gapドロップ時のノードID特定用）
 */
interface DragMonitorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onDropTargetChange: (target: DropTarget | null, tabPositions?: TabPosition[]) => void;
}

const DragMonitor: React.FC<DragMonitorProps> = ({
  containerRef,
  onDropTargetChange,
}) => {
  useDndMonitor({
    onDragStart: () => {
      // ドラッグ開始時は初期化
      onDropTargetChange(null);
    },
    onDragMove: (event: DragMoveEvent) => {
      // マウス位置からドロップターゲットを計算
      const container = containerRef.current;
      if (!container) {
        onDropTargetChange(null);
        return;
      }

      // コンテナ内のタブ要素の位置を取得
      const containerRect = container.getBoundingClientRect();
      const mouseY = event.activatorEvent instanceof MouseEvent
        ? event.activatorEvent.clientY + event.delta.y - containerRect.top
        : 0;

      // 各タブノードの位置情報を構築
      const tabPositions: TabPosition[] = [];
      const nodeElements = container.querySelectorAll('[data-node-id]');

      nodeElements.forEach((element) => {
        const nodeId = element.getAttribute('data-node-id');
        const depth = parseInt(element.getAttribute('data-depth') || '0', 10);
        const rect = element.getBoundingClientRect();

        if (nodeId) {
          tabPositions.push({
            nodeId,
            top: rect.top - containerRect.top,
            bottom: rect.bottom - containerRect.top,
            depth,
          });
        }
      });

      // ドロップターゲットを計算
      // Task 5.3: tabPositionsも提供（Gapドロップ時のノードID特定用）
      const target = calculateDropTarget(mouseY, tabPositions);
      onDropTargetChange(target, tabPositions);
    },
    onDragEnd: () => {
      // ドラッグ終了時にリセット
      // Note: リセット前にhandleDragEndが呼ばれるため、dropTargetRefには最新の値が残っている
      onDropTargetChange(null);
    },
    onDragCancel: () => {
      // ドラッグキャンセル時にリセット
      onDropTargetChange(null);
    },
  });

  return null;
};

/**
 * Task 6.1: グループノードヘッダーコンポーネント
 * グループをツリー内に統合表示するためのヘッダー
 */
interface GroupNodeHeaderProps {
  group: Group;
  onToggle: (groupId: string) => void;
}

const GroupNodeHeader: React.FC<GroupNodeHeaderProps> = ({ group, onToggle }) => {
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(group.id);
  };

  return (
    <div
      data-testid={`group-tree-node-${group.id}`}
      className="flex items-center p-2 bg-gray-800 hover:bg-gray-700 cursor-pointer"
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
  );
};

/**
 * タブツリービューコンポーネント
 * タブのツリー構造を表示し、現在のビューに基づいてフィルタリングする
 * onDragEndが提供されている場合、ドラッグ&ドロップ機能を有効化
 * Task 4.13: 未読状態表示機能を追加
 * Task 2.1: タブ情報（タイトル、ファビコン）表示機能を追加
 * Task 2.3: 選択状態管理機能を追加
 * Task 4.3: 隙間ドロップ判定とビジュアルフィードバック
 * Task 6.2: スナップショット取得機能を追加
 * Task 6.1: グループ機能をツリー内に統合表示
 */
const TabTreeView: React.FC<TabTreeViewProps> = ({
  nodes,
  currentViewId,
  onNodeClick,
  onToggleExpand,
  onDragEnd,
  onDragOver,
  onDragStart: onDragStartProp,
  onDragCancel: onDragCancelProp,
  // Task 5.3: 兄弟としてドロップ（Gapドロップ）時のコールバック
  onSiblingDrop,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  getTabInfo,
  isNodeSelected,
  onSelect,
  getSelectedTabIds,
  onSnapshot,
  // Task 6.1: グループ機能をツリー内に統合表示
  groups,
  onGroupToggle,
  // Task 7.2: ビュー移動サブメニュー用
  views,
  onMoveToView,
  // Task 4.3: ツリー外ドロップで新規ウィンドウ作成
  onExternalDrop,
}) => {
  // Task 4.3: ドロップターゲット状態とコンテナ参照
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  // Task 5.3: dropTargetをrefでも追跡（handleDragEnd内で最新値を参照するため）
  const dropTargetRef = useRef<DropTarget | null>(null);
  // Task 5.3: tabPositionsもrefで追跡（Gapドロップ時のノードID特定用）
  const tabPositionsRef = useRef<TabPosition[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  // Task 4.4: ドラッグ中のグローバル状態とアクティブノードID
  const [globalIsDragging, setGlobalIsDragging] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // dnd-kit sensors: MouseSensor + TouchSensor + KeyboardSensor
  // PointerSensorはPlaywrightなどのE2Eテストツールでヘッドレスモードで問題が発生するため使用しない
  // activationConstraint: { distance: 8 } で誤操作を防止
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 250,
      tolerance: 5,
    },
  });
  const keyboardSensor = useSensor(KeyboardSensor);
  const sensors = useSensors(mouseSensor, touchSensor, keyboardSensor);

  // currentViewIdでフィルタリング
  const filteredNodes = useMemo(
    () => nodes.filter((node) => node.viewId === currentViewId),
    [nodes, currentViewId]
  );

  // Task 6.1: グループ別にタブをグループ化
  const { groupedNodes, ungroupedNodes } = useMemo(() => {
    if (!groups) {
      return { groupedNodes: {}, ungroupedNodes: filteredNodes };
    }

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

  const isDraggable = !!onDragEnd;

  // すべてのノードIDを収集（SortableContext用）
  const allNodeIds = useMemo(
    () => collectAllNodeIds(filteredNodes),
    [filteredNodes]
  );

  // Task 4.3: ドロップターゲット変更ハンドラ
  // Task 5.3: refも更新してhandleDragEnd内で最新値を参照可能に
  const handleDropTargetChange = useCallback((target: DropTarget | null, tabPositions?: TabPosition[]) => {
    setDropTarget(target);
    dropTargetRef.current = target;
    if (tabPositions) {
      tabPositionsRef.current = tabPositions;
    }
  }, []);

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
   * Task 4.4: ドラッグ開始イベントハンドラ
   * ドラッグ開始時にisDraggingフラグを立て、アクティブノードIDを設定
   * Task 5.2: 外部ドロップ連携のため、propsのonDragStartも呼び出す
   */
  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      setGlobalIsDragging(true);
      setActiveNodeId(event.active.id as string);
      // Task 5.2: 外部ドロップ連携のため、propsのonDragStartを呼び出す
      if (onDragStartProp) {
        onDragStartProp(event);
      }
    },
    [onDragStartProp]
  );

  /**
   * ドラッグ終了イベントハンドラ
   * ホバータイマーをクリアしてから元のonDragEndを呼び出す
   * Task 4.4: ドラッグ終了時にisDraggingをfalseにする
   * Task 5.3: Gap判定の場合はonSiblingDropを呼び出す
   * Task 4.3: ツリー外ドロップの場合はonExternalDropを呼び出す
   */
  const handleDragEnd = React.useCallback(
    (event: Parameters<NonNullable<typeof onDragEnd>>[0]) => {
      // Task 4.4: ドラッグ終了時にフラグをリセット
      setGlobalIsDragging(false);
      const currentActiveNodeId = activeNodeId;
      setActiveNodeId(null);

      // ドラッグ終了時にホバータイマーをクリア
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      lastHoverNodeIdRef.current = null;

      // Task 4.3: ツリー外ドロップの検出
      // event.overがnullの場合、ドロップ先がツリー外であることを意味する
      if (!event.over && onExternalDrop && currentActiveNodeId) {
        // ノードIDからタブIDを取得
        const findTabIdByNodeId = (nodeId: string): number | null => {
          for (const node of nodes) {
            if (node.id === nodeId) {
              return node.tabId;
            }
            // 再帰的に子ノードを検索
            const findInChildren = (children: typeof nodes): number | null => {
              for (const child of children) {
                if (child.id === nodeId) {
                  return child.tabId;
                }
                const found = findInChildren(child.children);
                if (found !== null) return found;
              }
              return null;
            };
            const found = findInChildren(node.children);
            if (found !== null) return found;
          }
          return null;
        };

        const tabId = findTabIdByNodeId(currentActiveNodeId);
        if (tabId !== null) {
          onExternalDrop(tabId);
          return;
        }
      }

      // Task 5.3: Gap判定の場合はonSiblingDropを呼び出す
      const currentDropTarget = dropTargetRef.current;
      if (currentDropTarget && currentDropTarget.type === DropTargetType.Gap && onSiblingDrop && currentActiveNodeId) {
        const tabPositions = tabPositionsRef.current;
        const gapIndex = currentDropTarget.gapIndex ?? 0;

        // gapIndexから上下のノードIDを取得
        let aboveNodeId: string | undefined;
        let belowNodeId: string | undefined;

        if (gapIndex > 0 && gapIndex - 1 < tabPositions.length) {
          aboveNodeId = tabPositions[gapIndex - 1]?.nodeId;
        }
        if (gapIndex < tabPositions.length) {
          belowNodeId = tabPositions[gapIndex]?.nodeId;
        }

        // 兄弟として挿入
        onSiblingDrop({
          activeNodeId: currentActiveNodeId,
          insertIndex: gapIndex,
          aboveNodeId,
          belowNodeId,
        });
        return;
      }

      // Tab判定の場合は元のonDragEndを呼び出す（子として配置）
      if (onDragEnd) {
        onDragEnd(event);
      }
    },
    [onDragEnd, onSiblingDrop, onExternalDrop, activeNodeId, nodes]
  );

  /**
   * ドラッグキャンセルイベントハンドラ
   * Escapeキー等でドラッグがキャンセルされた場合にホバータイマーをクリア
   * Task 4.4: ドラッグキャンセル時にisDraggingをfalseにする
   * Task 5.2: 外部ドロップ連携のため、propsのonDragCancelも呼び出す
   */
  const handleDragCancel = React.useCallback(() => {
    // Task 4.4: ドラッグキャンセル時にフラグをリセット
    setGlobalIsDragging(false);
    setActiveNodeId(null);

    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    lastHoverNodeIdRef.current = null;

    // Task 5.2: 外部ドロップ連携のため、propsのonDragCancelを呼び出す
    if (onDragCancelProp) {
      onDragCancelProp();
    }
  }, [onDragCancelProp]);

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

  // Task 4.3: ドロップインジケーターの位置を計算
  // Task 4.1: Y座標（top）も計算してDropIndicatorに渡す
  const dropIndicatorPosition = useMemo(() => {
    if (!dropTarget || dropTarget.type !== DropTargetType.Gap) {
      return null;
    }
    const gapIndex = dropTarget.gapIndex ?? 0;
    const tabPositions = tabPositionsRef.current;
    // gapIndexからY位置を計算
    const topY = calculateIndicatorY(gapIndex, tabPositions);
    return {
      index: gapIndex,
      depth: dropTarget.adjacentDepths?.below ?? dropTarget.adjacentDepths?.above ?? 0,
      topY,
    };
  }, [dropTarget]);

  // Task 4.5: ドラッグ中の横スクロール防止
  // isDraggingがtrueの間はoverflow-x: hiddenを適用
  const containerClassName = useMemo(() => {
    const baseClass = 'relative';
    if (globalIsDragging) {
      return `${baseClass} overflow-x-hidden is-dragging`;
    }
    return baseClass;
  }, [globalIsDragging]);

  // タブノードをレンダリングするヘルパー関数
  const renderTabNode = (node: TabNode) => {
    if (isDraggable) {
      return (
        <SortableTreeNodeItem
          key={node.id}
          node={node}
          onNodeClick={onNodeClick}
          onToggleExpand={onToggleExpand}
          isDraggable={isDraggable}
          isTabUnread={isTabUnread}
          getUnreadChildCount={getUnreadChildCount}
          activeTabId={activeTabId}
          getTabInfo={getTabInfo}
          isNodeSelected={isNodeSelected}
          onSelect={onSelect}
          getSelectedTabIds={getSelectedTabIds}
          isDragHighlighted={
            dropTarget?.type === DropTargetType.Tab &&
            dropTarget.targetNodeId === node.id
          }
          globalIsDragging={globalIsDragging}
          activeNodeId={activeNodeId}
          onSnapshot={onSnapshot}
          views={views}
          currentViewId={currentViewId}
          onMoveToView={onMoveToView}
        />
      );
    }
    return (
      <TreeNodeItem
        key={node.id}
        node={node}
        onNodeClick={onNodeClick}
        onToggleExpand={onToggleExpand}
        isDraggable={false}
        isTabUnread={isTabUnread}
        getUnreadChildCount={getUnreadChildCount}
        activeTabId={activeTabId}
        getTabInfo={getTabInfo}
        isNodeSelected={isNodeSelected}
        onSelect={onSelect}
        getSelectedTabIds={getSelectedTabIds}
        onSnapshot={onSnapshot}
        views={views}
        currentViewId={currentViewId}
        onMoveToView={onMoveToView}
      />
    );
  };

  const content = (
    <div ref={containerRef} className={containerClassName} data-drag-container>
      {/* Task 6.1: グループとそのタブを表示 */}
      {groups && onGroupToggle && Object.entries(groups).map(([groupId, group]) => {
        const childNodes = groupedNodes[groupId] || [];
        return (
          <div key={groupId}>
            <GroupNodeHeader group={group} onToggle={onGroupToggle} />
            {/* グループ内のタブ（展開時のみ表示） */}
            {group.isExpanded && childNodes.map((node) => renderTabNode(node))}
          </div>
        );
      })}

      {/* グループに属さないタブを表示 */}
      {ungroupedNodes.map((node) => renderTabNode(node))}
      {/* Task 4.3: ドロップインジケーター表示 */}
      {/* Task 4.1: topPositionを渡して正しい位置にインジケーターを表示 */}
      {dropIndicatorPosition && (
        <DropIndicator
          targetIndex={dropIndicatorPosition.index}
          targetDepth={dropIndicatorPosition.depth}
          indentWidth={INDENT_WIDTH}
          isVisible={true}
          topPosition={dropIndicatorPosition.topY}
        />
      )}
    </div>
  );

  return (
    <div data-testid="tab-tree-view" className="w-full">
      {filteredNodes.length === 0 ? (
        <div className="p-4 text-gray-400 text-sm">No tabs in this view</div>
      ) : isDraggable ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragOver={handleDragOver}
          onDragCancel={handleDragCancel}
          autoScroll={AUTO_SCROLL_CONFIG}
        >
          {/* Task 4.3: ドラッグ中のドロップターゲット監視 */}
          <DragMonitor
            containerRef={containerRef}
            onDropTargetChange={handleDropTargetChange}
          />
          {/* Task 4.4: strategyをundefinedにしてリアルタイム並べ替えを無効化 */}
          <SortableContext
            items={allNodeIds}
            strategy={undefined}
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
