import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { TabNode, TabTreeViewProps, MenuAction, ExtendedTabInfo, View, WindowInfo } from '@/types';
import { useDragDrop, type DropTarget, DropTargetType } from '../hooks/useDragDrop';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { DragOverlay } from './DragOverlay';
import { ContextMenu } from './ContextMenu';
import ConfirmDialog from './ConfirmDialog';
import { useMenuActions } from '../hooks/useMenuActions';
import { useTheme } from '../providers/ThemeProvider';
import UnreadBadge from './UnreadBadge';
import CloseButton from './CloseButton';
import DropIndicator from './DropIndicator';
import {
  calculateIndicatorYByNodeIds,
  type TabPosition,
} from './GapDropDetection';
import { TREE_INDENT_WIDTH_PX } from '../utils';

/**
 * ノードとその子孫の数を再帰的にカウント
 */
const countSubtreeNodes = (node: TabNode): number => {
  let count = 1;
  for (const child of node.children) {
    count += countSubtreeNodes(child);
  }
  return count;
};

const AUTO_EXPAND_HOVER_DELAY_MS = 1000;

/**
 * スタートページURLを判定するヘルパー関数
 * Vivaldi/Chromeのスタートページ関連のURLを検出
 */
const isStartPageUrl = (url: string): boolean => {
  if (!url) return false;

  const startPageUrlPatterns = [
    /^chrome:\/\/vivaldi-webui\/startpage/,
    /^vivaldi:\/\/startpage/,
  ];

  return startPageUrlPatterns.some(pattern => pattern.test(url));
};

/**
 * 新しいタブURLを判定するヘルパー関数
 * Vivaldi/Chromeの新しいタブ関連のURLを検出（スタートページ以外）
 *
 * chrome-extension://URLは新しいタブと判定しない
 * 拡張機能ページ（settings.html, group.html等）は独自のタイトルを持つため
 */
const isNewTabUrl = (url: string): boolean => {
  if (!url) return false;

  const newTabUrlPatterns = [
    /^chrome:\/\/newtab/,
    /^vivaldi:\/\/newtab/,
    /^about:blank$/,
  ];

  return newTabUrlPatterns.some(pattern => pattern.test(url));
};

/**
 * 表示するタブタイトルを決定するヘルパー関数
 * - Loading状態の場合: 「Loading...」
 * - スタートページURLの場合: 「スタートページ」
 * - 新しいタブURLの場合: 「新しいタブ」
 * - それ以外: 元のタイトル
 *
 * Vivaldi専用URL（chrome://vivaldi-webui/startpage）の場合、
 * 拡張機能にはURLが公開されないことがあるため、タイトルもチェックする
 */
const getDisplayTitle = (tab: { title: string; url: string; status?: 'loading' | 'complete' }): string => {
  if (tab.status === 'loading') {
    return 'Loading...';
  }

  if (isStartPageUrl(tab.url) || isStartPageUrl(tab.title)) {
    return 'スタートページ';
  }

  if (isNewTabUrl(tab.url) || isNewTabUrl(tab.title)) {
    return '新しいタブ';
  }

  return tab.title;
};

/**
 * 内部ページのデフォルトファビコンを取得するヘルパー関数
 * chrome://, vivaldi://, about:等の内部ページにはブラウザがファビコンURLを提供しないため、
 * chrome://favicon/を使用するか、デフォルトアイコンを返す
 */
const getInternalPageFavicon = (url: string): string | null => {
  if (!url) return null;

  // chrome://favicon/ APIを使用してファビコンを取得
  // このAPIは多くの内部ページでも動作する
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
 * 優先順位:
 * 1. tabInfo.favIconUrl（通常のウェブページのファビコン）
 * 2. 内部ページの場合はchrome://favicon/ APIを使用
 * 3. null（デフォルトアイコンを表示）
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

const INDENT_WIDTH = TREE_INDENT_WIDTH_PX;

interface TreeNodeItemProps {
  node: TabNode;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (nodeId: string) => void;
  isDraggable: boolean;
  isTabUnread?: (tabId: number) => boolean;
  getUnreadChildCount?: (nodeId: string) => number;
  activeTabId?: number;
  getTabInfo?: (tabId: number) => ExtendedTabInfo | undefined;
  isNodeSelected?: (nodeId: string) => boolean;
  onSelect?: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  getSelectedTabIds?: () => number[];
  clearSelection?: () => void;
  isDragHighlighted?: boolean;
  globalIsDragging?: boolean;
  activeNodeId?: string | null;
  onSnapshot?: () => Promise<void>;
  views?: View[];
  currentViewId?: string;
  onMoveToView?: (viewId: string, tabIds: number[]) => void;
  currentWindowId?: number;
  otherWindows?: WindowInfo[];
  onMoveToWindow?: (windowId: number, tabIds: number[]) => void;
  onGroupRequest?: (tabIds: number[]) => void;
  dragItemProps?: {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    'data-dragging': boolean;
  };
  isDragging?: boolean;
  getItemPropsForNode?: (nodeId: string, tabId: number) => {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    'data-dragging': boolean;
  };
  isNodeDragging?: (nodeId: string) => boolean;
}

const DraggableTreeNodeItem: React.FC<TreeNodeItemProps> = ({
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
  clearSelection,
  isDragHighlighted,
  globalIsDragging,
  activeNodeId,
  onSnapshot,
  views,
  currentViewId,
  onMoveToView,
  currentWindowId,
  otherWindows,
  onMoveToWindow,
  onGroupRequest,
  dragItemProps,
  isDragging: isDraggingProp,
  getItemPropsForNode,
  isNodeDragging,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuTargetTabIds, setContextMenuTargetTabIds] = useState<number[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubtreeCount, setPendingSubtreeCount] = useState(0);
  const [pendingCloseAction, setPendingCloseAction] = useState<{ type: 'subtree' | 'tabs'; tabIds: number[] } | null>(null);
  const [isEditingGroupTitle, setIsEditingGroupTitle] = useState(false);
  const [editedGroupTitle, setEditedGroupTitle] = useState('');
  const groupTitleInputRef = useRef<HTMLInputElement>(null);
  const { executeAction } = useMenuActions();
  const { settings } = useTheme();

  const closeWarningThreshold = settings?.closeWarningThreshold ?? 10;

  const isUnread = isTabUnread ? isTabUnread(node.tabId) : false;
  const isActive = activeTabId === node.tabId;
  const tabInfo = getTabInfo ? getTabInfo(node.tabId) : undefined;
  const isSelected = isNodeSelected ? isNodeSelected(node.id) : false;
  const isDragging = isDraggingProp ?? false;

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleCloseClick = () => {
    if (hasChildren && !node.isExpanded) {
      const subtreeCount = countSubtreeNodes(node);
      if (closeWarningThreshold > 0 && subtreeCount >= closeWarningThreshold) {
        setPendingSubtreeCount(subtreeCount);
        setPendingCloseAction({ type: 'subtree', tabIds: [node.tabId] });
        setShowConfirmDialog(true);
        return;
      }
      chrome.runtime.sendMessage({
        type: 'CLOSE_SUBTREE',
        payload: { tabId: node.tabId },
      });
    } else {
      chrome.runtime.sendMessage({
        type: 'CLOSE_TAB',
        payload: { tabId: node.tabId },
      });
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    if (pendingCloseAction?.type === 'subtree') {
      chrome.runtime.sendMessage({
        type: 'CLOSE_SUBTREE',
        payload: { tabId: pendingCloseAction.tabIds[0] },
      });
    } else if (pendingCloseAction?.type === 'tabs') {
      for (const tabId of pendingCloseAction.tabIds) {
        chrome.runtime.sendMessage({
          type: 'CLOSE_TAB',
          payload: { tabId },
        });
      }
    }
    setPendingCloseAction(null);
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
    setPendingCloseAction(null);
  };

  const style: React.CSSProperties = {
    opacity: isDragging ? 0.5 : 1,
    ...dragItemProps?.style,
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // コンテキストメニューを開いた時点のtargetTabIdsを保存
    const targetIds = isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId];
    setContextMenuTargetTabIds(targetIds);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const isCollapsedParent = hasChildren && !node.isExpanded;

  const handleContextMenuAction = (action: MenuAction) => {
    // コンテキストメニューを開いた時点で保存したtargetTabIdsを使用
    const targetTabIds = contextMenuTargetTabIds;
    // expanded: falseの親タブを単独で閉じる場合はサブツリー全体を閉じる
    // 複数タブ選択時（targetTabIds.length > 1）はサブツリー操作ではなく個別操作
    const shouldCloseSubtree = targetTabIds.length === 1 && !isSelected && isCollapsedParent;

    if (action === 'close') {
      const tabCount = shouldCloseSubtree ? countSubtreeNodes(node) : targetTabIds.length;
      if (closeWarningThreshold > 0 && tabCount >= closeWarningThreshold) {
        setPendingSubtreeCount(tabCount);
        if (shouldCloseSubtree) {
          setPendingCloseAction({ type: 'subtree', tabIds: [node.tabId] });
        } else {
          setPendingCloseAction({ type: 'tabs', tabIds: targetTabIds });
        }
        setShowConfirmDialog(true);
        return;
      }
    }

    if (action === 'group' && onGroupRequest) {
      onGroupRequest(targetTabIds);
      if (clearSelection) {
        clearSelection();
      }
      return;
    }

    if (action === 'editGroupTitle' && node.groupInfo) {
      setEditedGroupTitle(node.groupInfo.name);
      setIsEditingGroupTitle(true);
      return;
    }

    executeAction(action, targetTabIds, {
      url: tabInfo?.url || 'about:blank',
      onSnapshot,
      isCollapsedParent: shouldCloseSubtree,
    });

    if (clearSelection) {
      clearSelection();
    }
  };

  const handleGroupTitleSave = useCallback(() => {
    if (node.groupInfo !== undefined && editedGroupTitle.trim()) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_GROUP_NAME',
        payload: { nodeId: node.id, name: editedGroupTitle.trim() },
      });
    }
    setIsEditingGroupTitle(false);
  }, [node.id, node.groupInfo, editedGroupTitle]);

  const handleGroupTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGroupTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingGroupTitle(false);
    }
  }, [handleGroupTitleSave]);

  useEffect(() => {
    if (isEditingGroupTitle && groupTitleInputRef.current) {
      groupTitleInputRef.current.focus();
      groupTitleInputRef.current.select();
    }
  }, [isEditingGroupTitle]);

  const handleNodeClick = (e: React.MouseEvent) => {
    // 注: stopPropagationは不要。SidePanelRootのonClickは
    // data-node-id属性をチェックしてタブノードクリック時はclearSelectionを呼ばない。
    if (onSelect) {
      onSelect(node.id, {
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
      });
    }
    onNodeClick(node.tabId);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    if (!isDraggable) {
      return;
    }
    dragItemProps?.onMouseDown(e);
  };

  return (
    <div style={style}>
      <div
        data-testid={`tree-node-${node.tabId}`}
        data-node-id={node.id}
        data-draggable-item={`draggable-item-${node.id}`}
        data-expanded={node.isExpanded ? 'true' : 'false'}
        data-depth={node.depth}
        className={`relative flex items-center p-2 hover:bg-gray-700 cursor-pointer text-gray-100 select-none ${isDragging ? 'bg-gray-600 ring-2 ring-gray-500 ring-inset is-dragging' : ''} ${isActive && !isDragging ? 'bg-gray-600' : ''} ${isSelected ? 'bg-gray-500' : ''} ${isDragHighlighted && !isDragging ? 'bg-gray-500 ring-2 ring-gray-400 ring-inset' : ''}`}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
      >
        <UnreadBadge isUnread={isUnread} showIndicator={true} depth={node.depth} />
        {hasChildren ? (
          <button
            data-testid="expand-button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="mr-1 w-3 h-3 flex items-center justify-center text-[10px] leading-none"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <div className="mr-1 w-3 h-3 flex-shrink-0" />
        )}

        {getTabInfo && tabInfo ? (
          <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0 relative">
            {(() => {
              const displayFavicon = getDisplayFavicon(tabInfo);
              return displayFavicon ? (
                <img
                  src={displayFavicon}
                  alt="Favicon"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
              ) : null;
            })()}
            <div
              data-testid="default-icon"
              className="w-full h-full bg-gray-300 rounded-sm"
              style={{ display: getDisplayFavicon(tabInfo) ? 'none' : 'block' }}
            />
            {tabInfo.discarded && (
              <div
                data-testid="discarded-favicon-overlay"
                className="absolute inset-0 bg-black/50 rounded-sm"
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

        <div
          data-testid="tab-content"
          className="flex-1 flex items-center justify-between min-w-0"
        >
          <div data-testid="title-area" className="flex items-center min-w-0 flex-1">
            {isEditingGroupTitle ? (
              <input
                ref={groupTitleInputRef}
                type="text"
                value={editedGroupTitle}
                onChange={(e) => setEditedGroupTitle(e.target.value)}
                onBlur={handleGroupTitleSave}
                onKeyDown={handleGroupTitleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-gray-700 text-gray-100 px-1 py-0.5 rounded border border-gray-500 focus:outline-none focus:border-blue-500"
                data-testid="group-title-input"
              />
            ) : (
              <span
                className={`truncate ${tabInfo?.discarded ? 'text-gray-500' : ''}`}
                data-testid={tabInfo?.discarded ? 'discarded-tab-title' : 'tab-title'}
              >
                {node.groupInfo?.name ?? (getTabInfo ? (tabInfo ? getDisplayTitle({ title: tabInfo.title, url: tabInfo.url || '', status: tabInfo.status }) : 'Loading...') : `Tab ${node.tabId}`)}
              </span>
            )}
          </div>
          <div
            data-testid="right-actions-container"
            className="flex items-center flex-shrink-0 ml-2"
          >
            <div
              data-testid="close-button-wrapper"
              className={`flex-shrink-0 ${isHovered ? 'visible' : 'invisible'}`}
            >
              <CloseButton onClose={handleCloseClick} />
            </div>
          </div>
        </div>
      </div>

      {contextMenuOpen && (
        <ContextMenu
          targetTabIds={contextMenuTargetTabIds}
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuOpen(false)}
          hasChildren={hasChildren}
          isGroupTab={node.groupInfo !== undefined}
          tabUrl={tabInfo?.url || 'about:blank'}
          views={views}
          currentViewId={currentViewId}
          onMoveToView={onMoveToView}
          currentWindowId={currentWindowId}
          otherWindows={otherWindows}
          onMoveToWindow={onMoveToWindow}
        />
      )}

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="タブを閉じる"
        message={pendingCloseAction?.type === 'tabs' ? '選択されたタブを閉じますか？' : 'このタブと配下のすべてのタブを閉じますか？'}
        tabCount={pendingSubtreeCount}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />

      {hasChildren && node.isExpanded && (
        <div>
          {node.children.map((child) => (
            <DraggableTreeNodeItem
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
              clearSelection={clearSelection}
              globalIsDragging={globalIsDragging}
              activeNodeId={activeNodeId}
              onSnapshot={onSnapshot}
              views={views}
              currentViewId={currentViewId}
              onMoveToView={onMoveToView}
              currentWindowId={currentWindowId}
              otherWindows={otherWindows}
              onMoveToWindow={onMoveToWindow}
              onGroupRequest={onGroupRequest}
              dragItemProps={getItemPropsForNode?.(child.id, child.tabId)}
              isDragging={isNodeDragging?.(child.id)}
              getItemPropsForNode={getItemPropsForNode}
              isNodeDragging={isNodeDragging}
            />
          ))}
        </div>
      )}
    </div>
  );
};

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
  clearSelection,
  onSnapshot,
  views,
  currentViewId,
  onMoveToView,
  currentWindowId,
  otherWindows,
  onMoveToWindow,
  onGroupRequest,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuTargetTabIds, setContextMenuTargetTabIds] = useState<number[]>([]);
  const [isHovered, setIsHovered] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingSubtreeCount, setPendingSubtreeCount] = useState(0);
  const [pendingCloseAction, setPendingCloseAction] = useState<{ type: 'subtree' | 'tabs'; tabIds: number[] } | null>(null);
  const [isEditingGroupTitle, setIsEditingGroupTitle] = useState(false);
  const [editedGroupTitle, setEditedGroupTitle] = useState('');
  const groupTitleInputRef = useRef<HTMLInputElement>(null);
  const { executeAction } = useMenuActions();
  const { settings } = useTheme();

  const closeWarningThreshold = settings?.closeWarningThreshold ?? 10;

  const isUnread = isTabUnread ? isTabUnread(node.tabId) : false;
  const isActive = activeTabId === node.tabId;
  const tabInfo = getTabInfo ? getTabInfo(node.tabId) : undefined;
  const isSelected = isNodeSelected ? isNodeSelected(node.id) : false;

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleCloseClick = () => {
    if (hasChildren && !node.isExpanded) {
      const subtreeCount = countSubtreeNodes(node);
      if (closeWarningThreshold > 0 && subtreeCount >= closeWarningThreshold) {
        setPendingSubtreeCount(subtreeCount);
        setPendingCloseAction({ type: 'subtree', tabIds: [node.tabId] });
        setShowConfirmDialog(true);
        return;
      }
      chrome.runtime.sendMessage({
        type: 'CLOSE_SUBTREE',
        payload: { tabId: node.tabId },
      });
    } else {
      chrome.runtime.sendMessage({
        type: 'CLOSE_TAB',
        payload: { tabId: node.tabId },
      });
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    if (pendingCloseAction?.type === 'subtree') {
      chrome.runtime.sendMessage({
        type: 'CLOSE_SUBTREE',
        payload: { tabId: pendingCloseAction.tabIds[0] },
      });
    } else if (pendingCloseAction?.type === 'tabs') {
      for (const tabId of pendingCloseAction.tabIds) {
        chrome.runtime.sendMessage({
          type: 'CLOSE_TAB',
          payload: { tabId },
        });
      }
    }
    setPendingCloseAction(null);
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
    setPendingCloseAction(null);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // コンテキストメニューを開いた時点のtargetTabIdsを保存
    const targetIds = isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId];
    setContextMenuTargetTabIds(targetIds);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const isCollapsedParent = hasChildren && !node.isExpanded;

  const handleContextMenuAction = (action: MenuAction) => {
    // コンテキストメニューを開いた時点で保存したtargetTabIdsを使用
    const targetTabIds = contextMenuTargetTabIds;
    // expanded: falseの親タブを単独で閉じる場合はサブツリー全体を閉じる
    // 複数タブ選択時（targetTabIds.length > 1）はサブツリー操作ではなく個別操作
    const shouldCloseSubtree = targetTabIds.length === 1 && !isSelected && isCollapsedParent;

    if (action === 'close') {
      const tabCount = shouldCloseSubtree ? countSubtreeNodes(node) : targetTabIds.length;
      if (closeWarningThreshold > 0 && tabCount >= closeWarningThreshold) {
        setPendingSubtreeCount(tabCount);
        if (shouldCloseSubtree) {
          setPendingCloseAction({ type: 'subtree', tabIds: [node.tabId] });
        } else {
          setPendingCloseAction({ type: 'tabs', tabIds: targetTabIds });
        }
        setShowConfirmDialog(true);
        return;
      }
    }

    if (action === 'group' && onGroupRequest) {
      onGroupRequest(targetTabIds);
      if (clearSelection) {
        clearSelection();
      }
      return;
    }

    if (action === 'editGroupTitle' && node.groupInfo) {
      setEditedGroupTitle(node.groupInfo.name);
      setIsEditingGroupTitle(true);
      return;
    }

    executeAction(action, targetTabIds, {
      url: tabInfo?.url || 'about:blank',
      onSnapshot,
      isCollapsedParent: shouldCloseSubtree,
    });

    if (clearSelection) {
      clearSelection();
    }
  };

  const handleGroupTitleSave = useCallback(() => {
    if (node.groupInfo !== undefined && editedGroupTitle.trim()) {
      chrome.runtime.sendMessage({
        type: 'UPDATE_GROUP_NAME',
        payload: { nodeId: node.id, name: editedGroupTitle.trim() },
      });
    }
    setIsEditingGroupTitle(false);
  }, [node.id, node.groupInfo, editedGroupTitle]);

  const handleGroupTitleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleGroupTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingGroupTitle(false);
    }
  }, [handleGroupTitleSave]);

  useEffect(() => {
    if (isEditingGroupTitle && groupTitleInputRef.current) {
      groupTitleInputRef.current.focus();
      groupTitleInputRef.current.select();
    }
  }, [isEditingGroupTitle]);

  const handleNodeClick = (e: React.MouseEvent) => {
    // 注: stopPropagationは不要。SidePanelRootのonClickは
    // data-node-id属性をチェックしてタブノードクリック時はclearSelectionを呼ばない。
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
        className={`relative flex items-center p-2 hover:bg-gray-700 cursor-pointer text-gray-100 select-none ${isActive ? 'bg-gray-600' : ''} ${isSelected ? 'bg-gray-500' : ''}`}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <UnreadBadge isUnread={isUnread} showIndicator={true} depth={node.depth} />
        {hasChildren ? (
          <button
            data-testid="expand-button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="mr-1 w-3 h-3 flex items-center justify-center text-[10px] leading-none"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <div className="mr-1 w-3 h-3 flex-shrink-0" />
        )}

        {getTabInfo && tabInfo ? (
          <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0 relative">
            {(() => {
              const displayFavicon = getDisplayFavicon(tabInfo);
              return displayFavicon ? (
                <img
                  src={displayFavicon}
                  alt="Favicon"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                    if (fallback) fallback.style.display = 'block';
                  }}
                />
              ) : null;
            })()}
            <div
              data-testid="default-icon"
              className="w-full h-full bg-gray-300 rounded-sm"
              style={{ display: getDisplayFavicon(tabInfo) ? 'none' : 'block' }}
            />
            {tabInfo.discarded && (
              <div
                data-testid="discarded-favicon-overlay"
                className="absolute inset-0 bg-black/50 rounded-sm"
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

        <div
          data-testid="tab-content"
          className="flex-1 flex items-center justify-between min-w-0"
        >
          <div data-testid="title-area" className="flex items-center min-w-0 flex-1">
            {isEditingGroupTitle ? (
              <input
                ref={groupTitleInputRef}
                type="text"
                value={editedGroupTitle}
                onChange={(e) => setEditedGroupTitle(e.target.value)}
                onBlur={handleGroupTitleSave}
                onKeyDown={handleGroupTitleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-full bg-gray-700 text-gray-100 px-1 py-0.5 rounded border border-gray-500 focus:outline-none focus:border-blue-500"
                data-testid="group-title-input"
              />
            ) : (
              <span
                className={`truncate ${tabInfo?.discarded ? 'text-gray-500' : ''}`}
                data-testid={tabInfo?.discarded ? 'discarded-tab-title' : 'tab-title'}
              >
                {node.groupInfo?.name ?? (getTabInfo ? (tabInfo ? getDisplayTitle({ title: tabInfo.title, url: tabInfo.url || '', status: tabInfo.status }) : 'Loading...') : `Tab ${node.tabId}`)}
              </span>
            )}
          </div>
          <div
            data-testid="right-actions-container"
            className="flex items-center flex-shrink-0 ml-2"
          >
            <div
              data-testid="close-button-wrapper"
              className={`flex-shrink-0 ${isHovered ? 'visible' : 'invisible'}`}
            >
              <CloseButton onClose={handleCloseClick} />
            </div>
          </div>
        </div>
      </div>

      {contextMenuOpen && (
        <ContextMenu
          targetTabIds={contextMenuTargetTabIds}
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuOpen(false)}
          hasChildren={hasChildren}
          isGroupTab={node.groupInfo !== undefined}
          tabUrl={tabInfo?.url || 'about:blank'}
          views={views}
          currentViewId={currentViewId}
          onMoveToView={onMoveToView}
          currentWindowId={currentWindowId}
          otherWindows={otherWindows}
          onMoveToWindow={onMoveToWindow}
        />
      )}

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="タブを閉じる"
        message={pendingCloseAction?.type === 'tabs' ? '選択されたタブを閉じますか？' : 'このタブと配下のすべてのタブを閉じますか？'}
        tabCount={pendingSubtreeCount}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />

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
              clearSelection={clearSelection}
              onSnapshot={onSnapshot}
              views={views}
              currentViewId={currentViewId}
              onMoveToView={onMoveToView}
              currentWindowId={currentWindowId}
              otherWindows={otherWindows}
              onMoveToWindow={onMoveToWindow}
              onGroupRequest={onGroupRequest}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TabTreeView: React.FC<TabTreeViewProps> = ({
  nodes,
  currentViewId,
  onNodeClick,
  onToggleExpand,
  onDragEnd,
  onDragStart: onDragStartProp,
  onDragCancel: onDragCancelProp,
  onSiblingDrop,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  getTabInfo,
  isNodeSelected,
  onSelect,
  getSelectedTabIds,
  clearSelection,
  onSnapshot,
  views,
  onMoveToView,
  currentWindowId,
  otherWindows,
  onMoveToWindow,
  onExternalDrop,
  onOutsideTreeChange,
  sidePanelRef,
  onGroupRequest,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [globalIsDragging, setGlobalIsDragging] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const tabPositionsRef = useRef<TabPosition[]>([]);
  const isOutsideTreeRef = useRef<boolean>(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHoverNodeIdRef = useRef<string | null>(null);

  // SidePanelRoot.buildTree() で既に現在のビューのノードのみがフィルタされているため、
  // ここでの追加フィルタリングは不要
  const filteredNodes = nodes;

  const isDraggable = !!onDragEnd;

  const handleDropTargetChange = useCallback((target: DropTarget | null, newTabPositions?: TabPosition[]) => {
    setDropTarget(target);
    if (newTabPositions) {
      tabPositionsRef.current = newTabPositions;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const items = useMemo(() => {
    const result: Array<{ id: string; tabId: number }> = [];
    const collectItems = (nodeList: TabNode[]) => {
      nodeList.forEach((node) => {
        result.push({ id: node.id, tabId: node.tabId });
        if (node.children && node.children.length > 0 && node.isExpanded) {
          collectItems(node.children);
        }
      });
    };
    collectItems(filteredNodes);
    return result;
  }, [filteredNodes]);

  const getSubtreeNodeIds = useCallback((nodeId: string): string[] => {
    const result: string[] = [];

    const findAndCollect = (nodeList: TabNode[]): boolean => {
      for (const node of nodeList) {
        if (node.id === nodeId) {
          const collectNodeAndDescendants = (n: TabNode) => {
            result.push(n.id);
            for (const child of n.children) {
              collectNodeAndDescendants(child);
            }
          };
          collectNodeAndDescendants(node);
          return true;
        }
        if (node.children && node.children.length > 0) {
          if (findAndCollect(node.children)) {
            return true;
          }
        }
      }
      return false;
    };

    findAndCollect(nodes);
    return result;
  }, [nodes]);

  const {
    dragState,
    getItemProps,
    cancelDrag,
  } = useDragDrop({
    containerRef,
    items,
    activationDistance: 8,
    direction: 'vertical',
    getSubtreeNodeIds,
    onDragStart: useCallback((itemId: string, _tabId: number) => {
      setGlobalIsDragging(true);
      setActiveNodeId(itemId);
      if (onDragStartProp) {
        onDragStartProp({ active: { id: itemId } } as Parameters<typeof onDragStartProp>[0]);
      }
    }, [onDragStartProp]),
    onDragMove: useCallback((position: { x: number; y: number }, newDropTarget: DropTarget | null) => {
      handleDropTargetChange(newDropTarget, tabPositionsRef.current);

      const boundary = sidePanelRef?.current ?? containerRef.current;
      if (boundary) {
        const rect = boundary.getBoundingClientRect();
        const isOutside =
          position.x < rect.left ||
          position.x > rect.right ||
          position.y < rect.top ||
          position.y > rect.bottom;

        if (isOutsideTreeRef.current !== isOutside) {
          isOutsideTreeRef.current = isOutside;
          if (onOutsideTreeChange) {
            onOutsideTreeChange(isOutside);
          }
        }
      }

      if (newDropTarget?.type === DropTargetType.Tab && newDropTarget.targetNodeId) {
        const overId = newDropTarget.targetNodeId;

        if (overId !== lastHoverNodeIdRef.current) {
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
          }

          lastHoverNodeIdRef.current = overId;

          const findNode = (nodeList: TabNode[]): TabNode | null => {
            for (const n of nodeList) {
              if (n.id === overId) return n;
              if (n.children && n.children.length > 0) {
                const found = findNode(n.children);
                if (found) return found;
              }
            }
            return null;
          };

          const overNode = findNode(nodes);
          if (overNode && overNode.children && overNode.children.length > 0 && !overNode.isExpanded) {
            hoverTimerRef.current = setTimeout(() => {
              onToggleExpand(overId);
              hoverTimerRef.current = null;
              lastHoverNodeIdRef.current = null;
            }, AUTO_EXPAND_HOVER_DELAY_MS);
          }
        }
      } else {
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        lastHoverNodeIdRef.current = null;
      }
    }, [nodes, onToggleExpand, handleDropTargetChange, onOutsideTreeChange, sidePanelRef]),
    onDragEnd: useCallback(async (itemId: string, finalDropTarget: DropTarget | null): Promise<void> => {
      // 非同期処理の完了前に状態をリセットしない（waitForDragEndがis-draggingクラスで待機するため）
      setActiveNodeId(null);

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      lastHoverNodeIdRef.current = null;

      if (isOutsideTreeRef.current && onExternalDrop) {
        const findTabIdByNodeId = (nodeId: string): number | null => {
          for (const node of nodes) {
            if (node.id === nodeId) return node.tabId;
            const findInChildren = (children: typeof nodes): number | null => {
              for (const child of children) {
                if (child.id === nodeId) return child.tabId;
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

        const tabId = findTabIdByNodeId(itemId);
        if (tabId !== null) {
          isOutsideTreeRef.current = false;
          onExternalDrop(tabId);
          handleDropTargetChange(null);
          setGlobalIsDragging(false);
          return;
        }
      }

      isOutsideTreeRef.current = false;

      // ドラッグ中のノードとそのサブツリーを除外したtabPositionsを使用
      // calculateDropTargetはドラッグノードを除外したeffectiveTabPositionsでgapIndexを計算するため、
      // aboveNodeId/belowNodeIdの参照も同様に除外リストから取得する必要がある
      if (finalDropTarget && finalDropTarget.type === DropTargetType.Gap && onSiblingDrop) {
        const subtreeIds = getSubtreeNodeIds(itemId);
        const subtreeSet = new Set(subtreeIds);
        const effectiveTabPositions = tabPositionsRef.current.filter(pos => !subtreeSet.has(pos.nodeId));
        const gapIndex = finalDropTarget.gapIndex ?? 0;

        let aboveNodeId: string | undefined;
        let belowNodeId: string | undefined;

        if (gapIndex > 0 && gapIndex - 1 < effectiveTabPositions.length) {
          aboveNodeId = effectiveTabPositions[gapIndex - 1]?.nodeId;
        }
        if (gapIndex < effectiveTabPositions.length) {
          belowNodeId = effectiveTabPositions[gapIndex]?.nodeId;
        }

        await onSiblingDrop({
          activeNodeId: itemId,
          insertIndex: gapIndex,
          aboveNodeId,
          belowNodeId,
        });
        handleDropTargetChange(null);
        setGlobalIsDragging(false);
        return;
      }

      if (finalDropTarget?.type === DropTargetType.Tab && onDragEnd) {
        await onDragEnd({
          active: { id: itemId },
          over: finalDropTarget.targetNodeId ? { id: finalDropTarget.targetNodeId } : null,
        } as Parameters<typeof onDragEnd>[0]);
      }

      handleDropTargetChange(null);
      setGlobalIsDragging(false);
    }, [nodes, onDragEnd, onSiblingDrop, onExternalDrop, handleDropTargetChange, getSubtreeNodeIds]),
    onDragCancel: useCallback(() => {
      setGlobalIsDragging(false);
      setActiveNodeId(null);

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      lastHoverNodeIdRef.current = null;
      handleDropTargetChange(null);

      if (onDragCancelProp) {
        onDragCancelProp();
      }
    }, [onDragCancelProp, handleDropTargetChange]),
    onExternalDrop: useCallback((tabId: number) => {
      onExternalDrop?.(tabId);
      setGlobalIsDragging(false);
    }, [onExternalDrop]),
    dragOutBoundaryRef: sidePanelRef,
  });

  const { handleAutoScroll, stopAutoScroll } = useAutoScroll(containerRef, {
    threshold: 50,
    speed: 8,
    clampToContent: true,
  });

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

  useEffect(() => {
    if (dragState.isDragging) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const scrollTop = container.scrollTop || 0;
        const tabPositions: TabPosition[] = [];
        const nodeElements = container.querySelectorAll('[data-node-id]');

        nodeElements.forEach((element) => {
          const nodeId = element.getAttribute('data-node-id');
          const depth = parseInt(element.getAttribute('data-depth') || '0', 10);
          const elemRect = element.getBoundingClientRect();

          if (nodeId) {
            tabPositions.push({
              nodeId,
              top: elemRect.top - rect.top + scrollTop,
              bottom: elemRect.bottom - rect.top + scrollTop,
              depth,
            });
          }
        });

        tabPositionsRef.current = tabPositions;
      }
    }
  }, [dragState.isDragging, dragState.currentPosition]);

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

  const getItemPropsForNode = useCallback((nodeId: string, tabId: number) => {
    return getItemProps(nodeId, tabId);
  }, [getItemProps]);

  const isNodeDragging = useCallback((nodeId: string) => {
    return dragState.isDragging && dragState.draggedItemId === nodeId;
  }, [dragState.isDragging, dragState.draggedItemId]);

  // adjacentNodeIdsを使って元のtabPositions（ドラッグ中ノード含む）での位置を計算
  // これにより、プレースホルダーがドラッグ中タブの中央に表示される問題を回避
  const dropIndicatorPosition = useMemo(() => {
    if (!dropTarget || dropTarget.type !== DropTargetType.Gap) {
      return null;
    }
    const gapIndex = dropTarget.gapIndex ?? 0;

    const aboveNodeId = dropTarget.adjacentNodeIds?.aboveNodeId;
    const belowNodeId = dropTarget.adjacentNodeIds?.belowNodeId;
    // eslint-disable-next-line react-hooks/refs -- ドロップターゲット変更時の位置計算に現在値が必要
    const topY = calculateIndicatorYByNodeIds(aboveNodeId, belowNodeId, tabPositionsRef.current);

    return {
      index: gapIndex,
      depth: dropTarget.adjacentDepths?.below ?? dropTarget.adjacentDepths?.above ?? 0,
      topY,
    };
  }, [dropTarget]);

  const containerClassName = useMemo(() => {
    const baseClass = 'relative';
    if (globalIsDragging) {
      return `${baseClass} overflow-x-hidden is-dragging`;
    }
    return baseClass;
  }, [globalIsDragging]);

  const renderTabNode = (node: TabNode): React.ReactNode => {
    if (isDraggable) {
      return (
        <DraggableTreeNodeItem
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
          clearSelection={clearSelection}
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
          currentWindowId={currentWindowId}
          otherWindows={otherWindows}
          onMoveToWindow={onMoveToWindow}
          onGroupRequest={onGroupRequest}
          dragItemProps={getItemPropsForNode(node.id, node.tabId)}
          isDragging={isNodeDragging(node.id)}
          getItemPropsForNode={getItemPropsForNode}
          isNodeDragging={isNodeDragging}
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
        clearSelection={clearSelection}
        onSnapshot={onSnapshot}
        views={views}
        currentViewId={currentViewId}
        onMoveToView={onMoveToView}
        currentWindowId={currentWindowId}
        otherWindows={otherWindows}
        onMoveToWindow={onMoveToWindow}
        onGroupRequest={onGroupRequest}
      />
    );
  };

  const content = (
    <div
      ref={containerRef}
      className={containerClassName}
      data-drag-container
      data-drop-target-type={dropTarget?.type ?? 'none'}
      data-drop-target-node={dropTarget?.type === DropTargetType.Tab ? dropTarget.targetNodeId : undefined}
    >
      {filteredNodes.map((node) => {
        return renderTabNode(node);
      })}
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

  const draggedNode = useMemo(() => {
    if (!dragState.isDragging || !dragState.draggedItemId) return null;
    const findNode = (nodeList: TabNode[]): TabNode | null => {
      for (const n of nodeList) {
        if (n.id === dragState.draggedItemId) return n;
        if (n.children && n.children.length > 0) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(nodes);
  }, [dragState.isDragging, dragState.draggedItemId, nodes]);

  const draggedTabInfo = draggedNode && getTabInfo ? getTabInfo(draggedNode.tabId) : undefined;

  return (
    <div data-testid="tab-tree-view" className="w-full select-none">
      {filteredNodes.length === 0 ? (
        <div className="p-4 text-gray-400 text-sm">No tabs in this view</div>
      ) : (
        <>
          {content}
          <DragOverlay
            isDragging={dragState.isDragging}
            position={dragState.currentPosition}
            offset={dragState.offset}
          >
            {draggedNode && (
              <div
                className="flex items-center p-2 bg-gray-700 text-gray-100 shadow-lg rounded border border-gray-600"
                style={{ width: '250px' }}
              >
                {(() => {
                  const displayFavicon = draggedTabInfo ? getDisplayFavicon(draggedTabInfo) : null;
                  return displayFavicon ? (
                    <img
                      src={displayFavicon}
                      alt="Favicon"
                      className="w-4 h-4 mr-2 flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                  ) : null;
                })()}
                <div
                  className="w-4 h-4 mr-2 bg-gray-300 rounded-sm flex-shrink-0"
                  style={{ display: draggedTabInfo && getDisplayFavicon(draggedTabInfo) ? 'none' : 'block' }}
                />
                <span className="truncate">
                  {draggedTabInfo ? getDisplayTitle({ title: draggedTabInfo.title, url: draggedTabInfo.url || '', status: draggedTabInfo.status }) : `Tab ${draggedNode.tabId}`}
                </span>
              </div>
            )}
          </DragOverlay>
        </>
      )}
    </div>
  );
};

export default TabTreeView;
