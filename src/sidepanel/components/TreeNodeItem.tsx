/**
 * タブツリーの1ノード（タブ・グループ）と、その子ノードの表示
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { UITabNode, MenuAction, ExtendedTabInfo, View, WindowInfo } from '@/types';
import { ContextMenu } from './ContextMenu';
import ConfirmDialog from './ConfirmDialog';
import UnreadBadge from './UnreadBadge';
import CloseButton from './CloseButton';
import { useMenuActions } from '../hooks/useMenuActions';
import { useTheme } from '../providers/ThemeProvider';
import { getDisplayFavicon, getDisplayTitle } from '../utils/tab-display';
import { dispatchServiceWorkerRequest } from '@/messaging/service-worker-client';

const countSubtreeNodes = (node: UITabNode): number => {
  let count = 1;
  for (const child of node.children) {
    count += countSubtreeNodes(child);
  }
  return count;
};

interface TreeNodeItemProps {
  node: UITabNode;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (tabId: number) => void;
  isDraggable: boolean;
  isTabUnread?: (tabId: number) => boolean;
  getUnreadChildCount?: (tabId: number) => number;
  activeTabId?: number;
  getTabInfo?: (tabId: number) => ExtendedTabInfo | undefined;
  isNodeSelected?: (tabId: number) => boolean;
  onSelect?: (tabId: number, modifiers: { shift: boolean; ctrl: boolean }) => void;
  getSelectedTabIds?: () => number[];
  clearSelection?: () => void;
  isDragHighlighted?: boolean;
  globalIsDragging?: boolean;
  activeTabIdForDrag?: number | null;
  onSnapshot?: () => Promise<void>;
  views?: View[];
  currentViewIndex?: number;
  onMoveToView?: (viewIndex: number, tabIds: number[]) => void;
  currentWindowId?: number;
  otherWindows?: WindowInfo[];
  onMoveToWindow?: (windowId: number, tabIds: number[]) => void;
  onGroupRequest?: (tabIds: number[], contextMenuTabId: number) => void;
  dragItemProps?: {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    'data-dragging': boolean;
  };
  isDragging?: boolean;
  getItemPropsForNode?: (tabId: number) => {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    'data-dragging': boolean;
  };
  isNodeDragging?: (tabId: number) => boolean;
}

export const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
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
  activeTabIdForDrag,
  onSnapshot,
  views,
  currentViewIndex,
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
  const isSelected = isNodeSelected ? isNodeSelected(node.tabId) : false;
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
      dispatchServiceWorkerRequest('CLOSE_SUBTREE', { tabId: node.tabId });
    } else {
      dispatchServiceWorkerRequest('CLOSE_TAB', { tabId: node.tabId });
    }
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    if (pendingCloseAction?.type === 'subtree') {
      dispatchServiceWorkerRequest('CLOSE_SUBTREE', { tabId: pendingCloseAction.tabIds[0] });
    } else if (pendingCloseAction?.type === 'tabs') {
      for (const tabId of pendingCloseAction.tabIds) {
        dispatchServiceWorkerRequest('CLOSE_TAB', { tabId });
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
    const targetIds = isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId];
    setContextMenuTargetTabIds(targetIds);
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const isCollapsedParent = hasChildren && !node.isExpanded;

  const handleContextMenuAction = (action: MenuAction) => {
    const targetTabIds = contextMenuTargetTabIds;
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
      const selectedIds = getSelectedTabIds ? getSelectedTabIds() : [];
      const isRightClickedTabSelected = selectedIds.includes(node.tabId);

      if (selectedIds.length > 1) {
        if (isRightClickedTabSelected) {
          onGroupRequest(selectedIds, node.tabId);
        } else {
          onGroupRequest(selectedIds, selectedIds[selectedIds.length - 1]);
        }
      } else {
        onGroupRequest([node.tabId], node.tabId);
      }

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
      dispatchServiceWorkerRequest('UPDATE_GROUP_NAME', { tabId: node.tabId, name: editedGroupTitle.trim() });
    }
    setIsEditingGroupTitle(false);
  }, [node.tabId, node.groupInfo, editedGroupTitle]);

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
    if (onSelect) {
      onSelect(node.tabId, {
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
        data-tab-id={node.tabId}
        data-node-id={node.tabId}
        data-draggable-item={isDraggable ? `draggable-item-${node.tabId}` : undefined}
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
            {hasChildren && (node.isExpanded ? isHovered : true) && (
              <div
                data-testid="expand-overlay"
                className="absolute inset-0 flex items-center justify-center cursor-pointer rounded-sm bg-black/50"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand(node.tabId);
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
                role="button"
              >
                <span className="text-white text-[10px]">
                  {node.isExpanded ? '▼' : '▶'}
                </span>
              </div>
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
          currentViewIndex={currentViewIndex}
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
              key={child.tabId}
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
              activeTabIdForDrag={activeTabIdForDrag}
              onSnapshot={onSnapshot}
              views={views}
              currentViewIndex={currentViewIndex}
              onMoveToView={onMoveToView}
              currentWindowId={currentWindowId}
              otherWindows={otherWindows}
              onMoveToWindow={onMoveToWindow}
              onGroupRequest={onGroupRequest}
              dragItemProps={getItemPropsForNode?.(child.tabId)}
              isDragging={isNodeDragging?.(child.tabId)}
              getItemPropsForNode={getItemPropsForNode}
              isNodeDragging={isNodeDragging}
            />
          ))}
        </div>
      )}
    </div>
  );
};
