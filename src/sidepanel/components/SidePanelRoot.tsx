import React, { useCallback, useState } from 'react';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import ErrorBoundary from './ErrorBoundary';
import TabTreeView from './TabTreeView';
import ViewSwitcher from './ViewSwitcher';
import PinnedTabsSection from './PinnedTabsSection';
// Task 9.1: OpenSettingsButton をサイドパネルから削除（要件20.1）
// 設定へのアクセスはポップアップメニュー（Task 9.2）から行う
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
    // Task 5.3: 兄弟としてドロップ（Gapドロップ）時のハンドラ
    handleSiblingDrop,
    switchView,
    createView,
    deleteView,
    updateView,
    // Task 4.9: グループ機能
    groups,
    toggleGroupExpanded,
    // Task 4.13: 未読状態管理
    isTabUnread,
    getUnreadChildCount,
    // Task 8.5.4: アクティブタブID
    activeTabId,
    // Task 3.1: ピン留めタブ機能
    pinnedTabIds,
    tabInfoMap,
    // Task 1.1: タブ情報取得関数
    getTabInfo,
    // Task 1.3: 複数選択状態管理
    isNodeSelected,
    selectNode,
    // Task 12.2: 選択されたすべてのタブIDを取得
    getSelectedTabIds,
    // Task 3.3: ビューごとのタブ数
    viewTabCounts,
    // Task 12.1: ビュー移動機能 (Requirements 18.1, 18.2, 18.3)
    moveTabsToView,
  } = useTreeState();

  // Task 8.2: 設定画面はサイドパネル内ではなく、新規タブで開くように変更
  // const [isSettingsOpen, setIsSettingsOpen] = useState(false); // 削除

  // Task 5.1: ExternalDropZone（新規ウィンドウドロップエリア）を削除
  // useExternalDropフックの使用を削除（要件6.1: 専用領域を表示しない）

  // Task 6.2: スナップショット取得ハンドラ
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

  // ノードをツリー構造に変換
  const buildTree = (): TabNode[] => {
    if (!treeState) return [];

    // 各ノードに対して children 配列を再構築
    const nodesWithChildren: Record<string, TabNode> = {};

    // まず、すべてのノードのコピーを作成（children は空配列で初期化）
    Object.entries(treeState.nodes).forEach(([id, node]) => {
      nodesWithChildren[id] = {
        ...node,
        children: [],
      };
    });

    // 親子関係を構築
    Object.entries(treeState.nodes).forEach(([id, node]) => {
      if (node.parentId && nodesWithChildren[node.parentId]) {
        nodesWithChildren[node.parentId].children.push(nodesWithChildren[id]);
      }
    });

    // ルートノードのみを返す
    const rootNodes: TabNode[] = [];
    Object.values(nodesWithChildren).forEach((node) => {
      if (!node.parentId) {
        rootNodes.push(node);
      }
    });
    return rootNodes;
  };

  const nodes = buildTree();

  // Task 3.1: ピン留めタブのクリックハンドラ
  const handlePinnedTabClick = (tabId: number) => {
    chrome.tabs.update(tabId, { active: true });
  };

  // 要件1.1: ピン留めタブには閉じるボタンを表示しない
  // handlePinnedTabCloseは削除（閉じる操作は無効化）

  // Task 2.2: ピン留めタブのコンテキストメニュー機能（要件1.6, 1.7）
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

  // Task 5.1: ExternalDropZone関連のドラッグハンドラを削除
  // handleTreeDragStart, handleTreeDragCancel, handleTreeDragEndのラッパーを削除
  // 要件6.1: 専用領域を表示しないため、外部ドロップ連携は不要

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Task 9.1: サイドパネルから設定ボタンを削除（要件20.1） */}
      {/* 設定へのアクセスはポップアップメニュー（Task 9.2）から行う */}

      {/* Task 4.8: ビュースイッチャー */}
      {/* Task 3.3: ビューごとのタブ数を表示 */}
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
      {/* Task 6.1: 独立したGroupSectionを削除 - グループはTabTreeView内に統合表示される */}
      {/* Task 6.2: スナップショットセクションを削除し、コンテキストメニューからスナップショットを取得可能に */}
      {/* Task 3.1: ピン留めタブセクション（要件1.1: 閉じるボタンなし） */}
      {/* Task 2.2: 右クリックでコンテキストメニュー表示（要件1.6, 1.7） */}
      <PinnedTabsSection
        pinnedTabIds={pinnedTabIds}
        tabInfoMap={tabInfoMap}
        onTabClick={handlePinnedTabClick}
        onContextMenu={handlePinnedTabContextMenu}
      />
      {/* Task 2.2: ピン留めタブのコンテキストメニュー（要件1.6, 1.7） */}
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
      {/* Task 4.3: カスタムスクロールバースタイルを適用 */}
      {/* Task 5.1: ExternalDropZone（新規ウィンドウドロップエリア）を削除（要件6.1） */}
      <div className="flex-1 overflow-auto custom-scrollbar" data-testid="tab-tree-root">
        <TabTreeView
          nodes={nodes}
          currentViewId={treeState?.currentViewId || 'default'}
          onNodeClick={handleNodeClick}
          onToggleExpand={handleToggleExpand}
          onDragEnd={handleDragEnd}
          // Task 5.3: 兄弟としてドロップ（Gapドロップ）時のハンドラ
          onSiblingDrop={handleSiblingDrop}
          isTabUnread={isTabUnread}
          getUnreadChildCount={getUnreadChildCount}
          activeTabId={activeTabId ?? undefined}
          getTabInfo={getTabInfo}
          isNodeSelected={isNodeSelected}
          onSelect={selectNode}
          getSelectedTabIds={getSelectedTabIds}
          onSnapshot={handleSnapshot}
          // Task 6.1: グループ機能をツリー内に統合表示
          groups={groups}
          onGroupToggle={toggleGroupExpanded}
          // Task 12.1: ビュー移動サブメニュー用 (Requirements 18.1, 18.2, 18.3)
          views={treeState?.views}
          onMoveToView={moveTabsToView}
        />
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
          {/* Task 4.3: カスタムスクロールバースタイルを適用 */}
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
