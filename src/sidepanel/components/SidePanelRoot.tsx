import React, { useCallback, useState, useRef, useEffect } from 'react';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import ErrorBoundary from './ErrorBoundary';
import TabTreeView from './TabTreeView';
import ViewSwitcher from './ViewSwitcher';
import PinnedTabsSection from './PinnedTabsSection';
import NewTabButton from './NewTabButton';
import { ContextMenu } from './ContextMenu';
import { useMenuActions } from '../hooks/useMenuActions';
import { downloadService } from '@/storage/DownloadService';
import { storageService } from '@/storage/StorageService';
import { SnapshotManager } from '@/services/SnapshotManager';
import type { TabNode, MenuAction, WindowInfo } from '@/types';

interface SidePanelRootProps {
  children?: React.ReactNode;
}

const TreeViewContent: React.FC = () => {
  const {
    treeState,
    updateTreeState,
    handleDragEnd,
    handleSiblingDrop,
    switchView,
    createView,
    deleteView,
    updateView,
    groups,
    toggleGroupExpanded,
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
    currentViewId,
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
    chrome.tabs.update(tabId, { active: true });
  };

  const handleToggleExpand = (nodeId: string) => {
    if (!treeState) return;

    const updatedNodes = { ...treeState.nodes };
    const node = updatedNodes[nodeId];
    if (node) {
      updatedNodes[nodeId] = { ...node, isExpanded: !node.isExpanded };
      updateTreeState({ ...treeState, nodes: updatedNodes });
    }
  };

  const buildTree = (): TabNode[] => {
    if (!treeState) return [];

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

    const nodesWithChildren: Record<string, TabNode> = {};

    Object.entries(treeState.nodes).forEach(([id, node]) => {
      if (pinnedTabIdSet.has(node.tabId)) {
        return;
      }
      if (shouldFilterByWindow && node.tabId >= 0 && !currentWindowTabIds.has(node.tabId)) {
        return;
      }
      // 現在のビュー以外のノードはスキップ
      if (node.viewId !== currentViewId) {
        return;
      }
      nodesWithChildren[id] = {
        ...node,
        children: [],
      };
    });

    Object.entries(treeState.nodes).forEach(([parentId, parentNode]) => {
      if (!nodesWithChildren[parentId]) {
        return;
      }
      for (const child of parentNode.children) {
        const childId = child.id;
        if (nodesWithChildren[childId]) {
          nodesWithChildren[parentId].children.push(nodesWithChildren[childId]);
        }
      }
    });

    const rootNodes: TabNode[] = [];
    Object.values(nodesWithChildren).forEach((node) => {
      // 親がいない、または親がフィルタリングされた（ピン留めタブや別ウィンドウ）場合はルートノードとして扱う
      if (!node.parentId || !nodesWithChildren[node.parentId]) {
        rootNodes.push(node);
      }
    });

    // フィルタリング後のツリー構造に対してdepthを再計算
    const recalculateDepth = (node: TabNode, depth: number): void => {
      node.depth = depth;
      for (const child of node.children) {
        recalculateDepth(child, depth + 1);
      }
    };

    rootNodes.forEach((node) => {
      recalculateDepth(node, 0);
    });

    // viewNodeOrderを使用してソート（Service Workerで管理されている順序を尊重）
    // tab.indexでソートすると、useMenuActionsでの移動直後にtabInfoMapが古い場合に順序が狂う
    const nodeOrderArray = treeState.viewNodeOrder?.[currentViewId] ?? [];
    const nodeOrderMap = new Map(nodeOrderArray.map((id, index) => [id, index]));
    rootNodes.sort((a, b) => {
      const indexA = nodeOrderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const indexB = nodeOrderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return indexA - indexB;
    });

    return rootNodes;
  };

  const nodes = buildTree();

  const handlePinnedTabClick = (tabId: number) => {
    // ピン留めタブをクリックしたとき、通常タブの選択状態をクリアする
    clearSelection();
    chrome.tabs.update(tabId, { active: true });
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

  return (
    <div className="flex flex-col h-full bg-gray-900">
        {treeState && (
          <ViewSwitcher
            views={treeState.views}
            currentViewId={currentViewId}
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
            views={treeState?.views}
            currentViewId={currentViewId}
            onMoveToView={moveTabsToView}
          />
        )}
        <div ref={sidePanelRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar" data-testid="tab-tree-root">
          <TabTreeView
            nodes={nodes}
            currentViewId={currentViewId}
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
            onSnapshot={handleSnapshot}
            groups={groups}
            onGroupToggle={toggleGroupExpanded}
            views={treeState?.views}
            onMoveToView={moveTabsToView}
            currentWindowId={currentWindowId ?? undefined}
            otherWindows={otherWindows}
            onMoveToWindow={handleMoveToWindow}
            onExternalDrop={handleExternalDrop}
            sidePanelRef={sidePanelRef}
          />
          <NewTabButton />
        </div>
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
