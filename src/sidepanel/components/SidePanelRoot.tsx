import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import ErrorBoundary from './ErrorBoundary';
import TabTreeView from './TabTreeView';
import ViewSwitcher from './ViewSwitcher';
import PinnedTabsSection from './PinnedTabsSection';
import NewTabButton from './NewTabButton';
import { ContextMenu } from './ContextMenu';
import { GroupNameModal } from './GroupNameModal';
import { useMenuActions } from '../hooks/useMenuActions';
import { downloadService } from '@/storage/DownloadService';
import { storageService } from '@/storage/StorageService';
import { SnapshotManager } from '@/services/SnapshotManager';
import type { UITabNode, TabNode, MenuAction, WindowInfo } from '@/types';

interface SidePanelRootProps {
  children?: React.ReactNode;
}

const TreeViewContent: React.FC = () => {
  const {
    treeState,
    handleDragEnd,
    handleSiblingDrop,
    switchView,
    createView,
    deleteView,
    updateView,
    isTabUnread,
    getUnreadChildCount,
    activeTabId,
    pinnedTabIds,
    tabInfoMap,
    handlePinnedTabReorder,
    getTabInfo,
    isNodeSelected,
    selectNode,
    clearSelection,
    getSelectedTabIds,
    viewTabCounts,
    moveTabsToView,
    currentWindowId,
    currentViewIndex,
    views,
  } = useTreeState();

  const sidePanelRef = useRef<HTMLDivElement>(null);

  const [otherWindows, setOtherWindows] = useState<WindowInfo[]>([]);

  useEffect(() => {
    const fetchOtherWindows = async () => {
      if (currentWindowId === null) return;
      try {
        const windows = await chrome.windows.getAll({ populate: true });
        const others: WindowInfo[] = [];
        for (const win of windows) {
          if (win.id !== undefined && win.id !== currentWindowId && win.type === 'normal') {
            others.push({
              id: win.id,
              tabCount: win.tabs?.length ?? 0,
              focused: win.focused ?? false,
            });
          }
        }
        setOtherWindows(others);
      } catch (error) {
        console.error('Failed to fetch windows:', error);
        setOtherWindows([]);
      }
    };

    fetchOtherWindows();

    const handleWindowCreated = () => {
      fetchOtherWindows();
    };
    const handleWindowRemoved = () => {
      fetchOtherWindows();
    };
    const handleWindowFocusChanged = () => {
      fetchOtherWindows();
    };

    chrome.windows.onCreated.addListener(handleWindowCreated);
    chrome.windows.onRemoved.addListener(handleWindowRemoved);
    chrome.windows.onFocusChanged.addListener(handleWindowFocusChanged);

    return () => {
      chrome.windows.onCreated.removeListener(handleWindowCreated);
      chrome.windows.onRemoved.removeListener(handleWindowRemoved);
      chrome.windows.onFocusChanged.removeListener(handleWindowFocusChanged);
    };
  }, [currentWindowId]);

  const handleMoveToWindow = useCallback(async (targetWindowId: number, tabIds: number[]) => {
    try {
      for (const tabId of tabIds) {
        await chrome.runtime.sendMessage({
          type: 'MOVE_SUBTREE_TO_WINDOW',
          payload: { tabId, windowId: targetWindowId },
        });
      }
    } catch (error) {
      console.error('Failed to move tabs to window:', error);
    }
  }, []);

  const handleSnapshot = useCallback(async () => {
    try {
      const snapshotManager = new SnapshotManager(downloadService, storageService);
      const timestamp = new Date().toISOString().split('T')[0];
      const name = `Manual Snapshot - ${timestamp} ${new Date().toLocaleTimeString()}`;
      await snapshotManager.createSnapshot(name, false);
    } catch (error) {
      console.error('Failed to create snapshot:', error);
    }
  }, []);

  const handleNodeClick = (tabId: number) => {
    chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', payload: { tabId } });
  };

  const handleToggleExpand = useCallback((tabId: number) => {
    if (currentWindowId === null) return;
    chrome.runtime.sendMessage({
      type: 'TOGGLE_NODE_EXPAND',
      payload: { tabId, windowId: currentWindowId },
    });
  }, [currentWindowId]);

  // 現在のウィンドウの状態を取得
  const currentWindowState = useMemo(() => {
    if (!treeState || currentWindowId === null) return null;
    return treeState.windows.find(w => w.windowId === currentWindowId) || null;
  }, [treeState, currentWindowId]);

  // 現在のビューの状態を取得
  const currentViewState = useMemo(() => {
    if (!currentWindowState) return null;
    return currentWindowState.views[currentViewIndex] || null;
  }, [currentWindowState, currentViewIndex]);

  /**
   * TabNodeからUITabNodeを構築（depthを計算）
   */
  const buildTree = (): UITabNode[] => {
    if (!currentViewState) return [];

    const pinnedTabIdSet = new Set(pinnedTabIds);

    const currentWindowTabIds = new Set<number>();
    const shouldFilterByWindow = currentWindowId !== null;
    if (shouldFilterByWindow) {
      Object.values(tabInfoMap).forEach(tabInfo => {
        if (tabInfo.windowId === currentWindowId) {
          currentWindowTabIds.add(tabInfo.id);
        }
      });
    }

    // ピン留め/フィルタリングされた親の子ノードを収集するための配列
    const orphanedChildren: UITabNode[] = [];

    // TabNodeをUITabNodeに変換（depthを計算）
    const convertToUINode = (
      node: TabNode,
      depth: number
    ): UITabNode | null => {
      const isPinned = pinnedTabIdSet.has(node.tabId);
      const isFiltered = shouldFilterByWindow && node.tabId >= 0 && !currentWindowTabIds.has(node.tabId);

      // ピン留めまたはフィルタリング対象のタブの場合、子ノードをルートレベルとして収集
      if (isPinned || isFiltered) {
        for (const child of node.children) {
          const uiChild = convertToUINode(child, 0);
          if (uiChild) {
            orphanedChildren.push(uiChild);
          }
        }
        return null;
      }

      const children: UITabNode[] = [];
      for (const child of node.children) {
        const uiChild = convertToUINode(child, depth + 1);
        if (uiChild) {
          children.push(uiChild);
        }
      }

      return {
        tabId: node.tabId,
        isExpanded: node.isExpanded,
        groupInfo: node.groupInfo,
        children,
        depth,
      };
    };

    const rootNodes: UITabNode[] = [];
    for (const node of currentViewState.rootNodes) {
      const uiNode = convertToUINode(node, 0);
      if (uiNode) {
        rootNodes.push(uiNode);
      }
    }

    // ピン留め/フィルタリングされた親の子ノードを末尾に追加
    rootNodes.push(...orphanedChildren);

    return rootNodes;
  };

  const nodes = buildTree();

  const handlePinnedTabClick = (tabId: number) => {
    clearSelection();
    chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', payload: { tabId } });
  };

  const [pinnedContextMenu, setPinnedContextMenu] = useState<{
    tabId: number;
    position: { x: number; y: number };
  } | null>(null);
  const { executeAction } = useMenuActions();

  const handlePinnedTabContextMenu = useCallback((tabId: number, position: { x: number; y: number }) => {
    setPinnedContextMenu({ tabId, position });
  }, []);

  const handlePinnedContextMenuClose = useCallback(() => {
    setPinnedContextMenu(null);
  }, []);

  const handlePinnedContextMenuAction = useCallback((action: MenuAction) => {
    if (pinnedContextMenu) {
      const tabInfo = tabInfoMap[pinnedContextMenu.tabId];
      executeAction(action, [pinnedContextMenu.tabId], {
        url: tabInfo?.url,
        onSnapshot: handleSnapshot,
      });
    }
  }, [pinnedContextMenu, tabInfoMap, executeAction, handleSnapshot]);

  const handleExternalDrop = useCallback((tabId: number) => {
    chrome.runtime.sendMessage({
      type: 'CREATE_WINDOW_WITH_SUBTREE',
      payload: { tabId, sourceWindowId: currentWindowId ?? undefined },
    });
  }, [currentWindowId]);

  const [groupNameModalOpen, setGroupNameModalOpen] = useState(false);
  const [pendingGroupTabIds, setPendingGroupTabIds] = useState<number[]>([]);
  const [pendingContextMenuTabId, setPendingContextMenuTabId] = useState<number | null>(null);

  const handleGroupRequest = useCallback((tabIds: number[], contextMenuTabId: number) => {
    setPendingGroupTabIds(tabIds);
    setPendingContextMenuTabId(contextMenuTabId);
    setGroupNameModalOpen(true);
  }, []);

  const handleGroupNameSave = useCallback(async (groupName: string) => {
    setGroupNameModalOpen(false);
    try {
      await chrome.runtime.sendMessage({
        type: 'CREATE_GROUP',
        payload: { tabIds: pendingGroupTabIds, groupName, contextMenuTabId: pendingContextMenuTabId },
      });
    } catch {
      // グループ化APIのエラーは無視（タブが存在しない場合など）
    }
    setPendingGroupTabIds([]);
    setPendingContextMenuTabId(null);
  }, [pendingGroupTabIds, pendingContextMenuTabId]);

  const handleGroupNameClose = useCallback(() => {
    setGroupNameModalOpen(false);
    setPendingGroupTabIds([]);
    setPendingContextMenuTabId(null);
  }, []);

  const pendingGroupTabTitles = useMemo(() => {
    return pendingGroupTabIds.map((tabId) => tabInfoMap[tabId]?.title || '').filter(Boolean);
  }, [pendingGroupTabIds, tabInfoMap]);

  return (
    <div
      className="flex flex-col h-full bg-gray-900"
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (!target.closest('[data-tab-id]') && !target.closest('button')) {
          clearSelection();
        }
      }}
    >
        {treeState && (
          <ViewSwitcher
            views={views}
            currentViewIndex={currentViewIndex}
            tabCounts={viewTabCounts}
            onViewSwitch={switchView}
            onViewCreate={createView}
            onViewDelete={deleteView}
            onViewUpdate={updateView}
          />
        )}
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={handlePinnedTabClick}
          onContextMenu={handlePinnedTabContextMenu}
          activeTabId={activeTabId}
          onPinnedTabReorder={handlePinnedTabReorder}
        />
        {pinnedContextMenu && (
          <ContextMenu
            targetTabIds={[pinnedContextMenu.tabId]}
            position={pinnedContextMenu.position}
            onAction={handlePinnedContextMenuAction}
            onClose={handlePinnedContextMenuClose}
            isPinned={true}
            tabUrl={tabInfoMap[pinnedContextMenu.tabId]?.url}
            currentWindowId={currentWindowId ?? undefined}
            otherWindows={otherWindows}
            onMoveToWindow={handleMoveToWindow}
            views={views}
            currentViewIndex={currentViewIndex}
            onMoveToView={moveTabsToView}
          />
        )}
        <div
          ref={sidePanelRef}
          className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
          data-testid="tab-tree-root"
        >
          <TabTreeView
            nodes={nodes}
            currentViewIndex={currentViewIndex}
            onNodeClick={handleNodeClick}
            onToggleExpand={handleToggleExpand}
            onDragEnd={handleDragEnd}
            onSiblingDrop={handleSiblingDrop}
            isTabUnread={isTabUnread}
            getUnreadChildCount={getUnreadChildCount}
            activeTabId={activeTabId ?? undefined}
            getTabInfo={getTabInfo}
            isNodeSelected={isNodeSelected}
            onSelect={selectNode}
            getSelectedTabIds={getSelectedTabIds}
            clearSelection={clearSelection}
            onSnapshot={handleSnapshot}
            views={views}
            onMoveToView={moveTabsToView}
            currentWindowId={currentWindowId ?? undefined}
            otherWindows={otherWindows}
            onMoveToWindow={handleMoveToWindow}
            onExternalDrop={handleExternalDrop}
            sidePanelRef={sidePanelRef}
            onGroupRequest={handleGroupRequest}
          />
          <NewTabButton />
        </div>
        <GroupNameModal
          isOpen={groupNameModalOpen}
          tabTitles={pendingGroupTabTitles}
          onSave={handleGroupNameSave}
          onClose={handleGroupNameClose}
        />
      </div>
  );
};

const LoadingWrapper: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { isLoading, error } = useTreeState();

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
          <p className="text-gray-300">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-400 mb-2"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

const SidePanelRoot: React.FC<SidePanelRootProps> = ({ children }) => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <TreeStateProvider>
          <div data-testid="side-panel-root" className="h-screen w-full overflow-auto bg-gray-900 text-gray-100 custom-scrollbar">
            <LoadingWrapper>
              {children || <TreeViewContent />}
            </LoadingWrapper>
          </div>
        </TreeStateProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

export default SidePanelRoot;
