import React, { useCallback, useState, useRef } from 'react';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import ErrorBoundary from './ErrorBoundary';
import TabTreeView from './TabTreeView';
import ViewSwitcher from './ViewSwitcher';
import PinnedTabsSection from './PinnedTabsSection';
import NewTabButton from './NewTabButton';
import { ContextMenu } from './ContextMenu';
import { useMenuActions } from '../hooks/useMenuActions';
import { indexedDBService } from '@/storage/IndexedDBService';
import { storageService } from '@/storage/StorageService';
import { SnapshotManager } from '@/services/SnapshotManager';
import type { TabNode, MenuAction } from '@/types';

interface SidePanelRootProps {
  children?: React.ReactNode;
}

// ツリービューを表示するコンポーネント
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
    addTabToGroup,
    isTabUnread,
    getUnreadChildCount,
    activeTabId,
    pinnedTabIds,
    tabInfoMap,
    handlePinnedTabReorder,
    getTabInfo,
    isNodeSelected,
    selectNode,
    getSelectedTabIds,
    viewTabCounts,
    moveTabsToView,
    currentWindowId,
    handleCrossWindowDragStart,
    handleCrossWindowDrop,
    clearCrossWindowDragState,
  } = useTreeState();

  // サイドパネル境界参照（ドラッグアウト判定に使用）
  const sidePanelRef = useRef<HTMLDivElement>(null);

  // スナップショット取得ハンドラ
  const handleSnapshot = useCallback(async () => {
    try {
      const snapshotManager = new SnapshotManager(indexedDBService, storageService);
      const timestamp = new Date().toISOString().split('T')[0];
      const name = `Manual Snapshot - ${timestamp} ${new Date().toLocaleTimeString()}`;
      await snapshotManager.createSnapshot(name, false);
    } catch (error) {
      console.error('Failed to create snapshot:', error);
    }
  }, []);

  // タブをグループに追加するハンドラ
  const handleAddToGroup = useCallback((groupId: string, tabIds: number[]) => {
    if (!treeState) return;
    for (const tabId of tabIds) {
      const nodeId = treeState.tabToNode[tabId];
      if (nodeId) {
        addTabToGroup(nodeId, groupId);
      }
    }
  }, [treeState, addTabToGroup]);

  const handleNodeClick = (tabId: number) => {
    // タブをアクティブ化
    chrome.tabs.update(tabId, { active: true });
  };

  const handleToggleExpand = (nodeId: string) => {
    if (!treeState) return;

    // ノードの展開状態をトグル
    const updatedNodes = { ...treeState.nodes };
    const node = updatedNodes[nodeId];
    if (node) {
      updatedNodes[nodeId] = { ...node, isExpanded: !node.isExpanded };
      updateTreeState({ ...treeState, nodes: updatedNodes });
    }
  };

  // ノードをツリー構造に変換（ピン留めタブを除外、現在のウィンドウのみ表示）
  const buildTree = (): TabNode[] => {
    if (!treeState) return [];

    const pinnedTabIdSet = new Set(pinnedTabIds);

    // 現在のウィンドウに属するタブのIDセットを作成
    const currentWindowTabIds = new Set<number>();
    const shouldFilterByWindow = currentWindowId !== null;
    if (shouldFilterByWindow) {
      Object.values(tabInfoMap).forEach(tabInfo => {
        if (tabInfo.windowId === currentWindowId) {
          currentWindowTabIds.add(tabInfo.id);
        }
      });
    }

    // 各ノードに対して children 配列を再構築（ピン留めタブと他ウィンドウのタブを除外）
    const nodesWithChildren: Record<string, TabNode> = {};

    // すべてのノードのコピーを作成（children は空配列で初期化）
    Object.entries(treeState.nodes).forEach(([id, node]) => {
      // ピン留めタブは除外
      if (pinnedTabIdSet.has(node.tabId)) {
        return;
      }
      // 現在のウィンドウに属さないタブを除外（グループノード（tabId < 0）は除く）
      if (shouldFilterByWindow && node.tabId >= 0 && !currentWindowTabIds.has(node.tabId)) {
        return;
      }
      nodesWithChildren[id] = {
        ...node,
        children: [],
      };
    });

    // 親子関係を構築（元のchildren配列の順序を維持）
    Object.entries(treeState.nodes).forEach(([parentId, parentNode]) => {
      // 親ノードがnodesWithChildrenに存在しない場合はスキップ
      if (!nodesWithChildren[parentId]) {
        return;
      }
      // 元のchildren配列の順序で子ノードを追加
      for (const child of parentNode.children) {
        const childId = child.id;
        // 子ノードがnodesWithChildrenに存在する場合のみ追加
        if (nodesWithChildren[childId]) {
          nodesWithChildren[parentId].children.push(nodesWithChildren[childId]);
        }
      }
    });

    // ルートノードのみを返す
    const rootNodes: TabNode[] = [];
    Object.values(nodesWithChildren).forEach((node) => {
      if (!node.parentId) {
        rootNodes.push(node);
      }
    });

    // ブラウザタブのインデックス順でソート
    rootNodes.sort((a, b) => {
      const indexA = tabInfoMap[a.tabId]?.index ?? Number.MAX_SAFE_INTEGER;
      const indexB = tabInfoMap[b.tabId]?.index ?? Number.MAX_SAFE_INTEGER;
      return indexA - indexB;
    });

    return rootNodes;
  };

  const nodes = buildTree();

  // ピン留めタブのクリックハンドラ
  const handlePinnedTabClick = (tabId: number) => {
    chrome.tabs.update(tabId, { active: true });
  };

  // ピン留めタブのコンテキストメニュー機能
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

  // ツリー外ドロップで新規ウィンドウ作成（サブツリーごと移動、空ウィンドウは自動クローズ）
  const handleExternalDrop = useCallback((tabId: number) => {
    chrome.runtime.sendMessage({
      type: 'CREATE_WINDOW_WITH_SUBTREE',
      payload: { tabId, sourceWindowId: currentWindowId ?? undefined },
    });
    // クロスウィンドウドラッグ状態をクリア
    clearCrossWindowDragState();
  }, [clearCrossWindowDragState, currentWindowId]);

  // クロスウィンドウドラッグ開始ハンドラ
  const handleTreeDragStart = useCallback((event: { active: { id: string | number } }) => {
    // ドラッグ開始時にクロスウィンドウドラッグ状態を設定
    const nodeId = event.active.id as string;
    // ノードからタブIDを取得
    const node = treeState?.nodes[nodeId];
    if (node) {
      handleCrossWindowDragStart(node.tabId, nodes);
    }
  }, [treeState, nodes, handleCrossWindowDragStart]);

  // クロスウィンドウドロップを含むドラッグ終了ハンドラ
  const handleTreeDragEnd = useCallback(async (event: Parameters<typeof handleDragEnd>[0]) => {
    // まずクロスウィンドウドロップかどうかを確認
    const wasCrossWindowDrop = await handleCrossWindowDrop();

    if (wasCrossWindowDrop) {
      // クロスウィンドウドロップが処理された場合は終了
      return;
    }

    // クロスウィンドウドロップでない場合は通常のドラッグ終了処理
    await handleDragEnd(event);

    // ドラッグ状態をクリア
    await clearCrossWindowDragState();
  }, [handleDragEnd, handleCrossWindowDrop, clearCrossWindowDragState]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* ビュースイッチャー */}
      {treeState && (
        <ViewSwitcher
          views={treeState.views}
          currentViewId={treeState.currentViewId}
          tabCounts={viewTabCounts}
          onViewSwitch={switchView}
          onViewCreate={createView}
          onViewDelete={deleteView}
          onViewUpdate={updateView}
        />
      )}
      {/* ピン留めタブセクション */}
      <PinnedTabsSection
        pinnedTabIds={pinnedTabIds}
        tabInfoMap={tabInfoMap}
        onTabClick={handlePinnedTabClick}
        onContextMenu={handlePinnedTabContextMenu}
        activeTabId={activeTabId}
        onPinnedTabReorder={handlePinnedTabReorder}
      />
      {/* ピン留めタブのコンテキストメニュー */}
      {pinnedContextMenu && (
        <ContextMenu
          targetTabIds={[pinnedContextMenu.tabId]}
          position={pinnedContextMenu.position}
          onAction={handlePinnedContextMenuAction}
          onClose={handlePinnedContextMenuClose}
          isPinned={true}
          tabUrl={tabInfoMap[pinnedContextMenu.tabId]?.url}
        />
      )}
      {/* タブツリービュー */}
      <div ref={sidePanelRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar" data-testid="tab-tree-root">
        <TabTreeView
          nodes={nodes}
          currentViewId={treeState?.currentViewId || 'default'}
          onNodeClick={handleNodeClick}
          onToggleExpand={handleToggleExpand}
          onDragStart={handleTreeDragStart}
          onDragEnd={handleTreeDragEnd}
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
          onAddToGroup={handleAddToGroup}
          views={treeState?.views}
          onMoveToView={moveTabsToView}
          onExternalDrop={handleExternalDrop}
          sidePanelRef={sidePanelRef}
        />
        {/* 新規タブ追加ボタン */}
        <NewTabButton />
      </div>
    </div>
  );
};

// ローディング状態を表示するコンポーネント
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
