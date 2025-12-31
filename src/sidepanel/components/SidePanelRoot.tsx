import React, { useCallback, useState, useRef } from 'react';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import ErrorBoundary from './ErrorBoundary';
import TabTreeView from './TabTreeView';
import ViewSwitcher from './ViewSwitcher';
import PinnedTabsSection from './PinnedTabsSection';
// Task 8.1 (tab-tree-comprehensive-fix): 新規タブ追加ボタン (Requirement 8.1, 8.2, 8.3, 8.4)
import NewTabButton from './NewTabButton';
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
    // Task 12.2 (tab-tree-bugfix): グループ追加機能
    addTabToGroup,
    // Task 4.13: 未読状態管理
    isTabUnread,
    getUnreadChildCount,
    // Task 8.5.4: アクティブタブID
    activeTabId,
    // Task 3.1: ピン留めタブ機能
    pinnedTabIds,
    tabInfoMap,
    // Task 11.1 (tab-tree-bugfix): ピン留めタブの並び替え
    handlePinnedTabReorder,
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
    // Task 6.2: 現在のウィンドウID（複数ウィンドウ対応）
    currentWindowId,
    // Task 7.2 (tab-tree-comprehensive-fix): クロスウィンドウドラッグ&ドロップ
    handleCrossWindowDragStart,
    handleCrossWindowDrop,
    clearCrossWindowDragState,
  } = useTreeState();

  // Task 8.2: 設定画面はサイドパネル内ではなく、新規タブで開くように変更
  // const [isSettingsOpen, setIsSettingsOpen] = useState(false); // 削除

  // Task 5.1: ExternalDropZone（新規ウィンドウドロップエリア）を削除
  // useExternalDropフックの使用を削除（要件6.1: 専用領域を表示しない）

  // Task 7.2 (tab-tree-bugfix-2): サイドパネル境界参照
  // Requirement 4.2, 4.3: ドラッグアウト判定はサイドパネル全体の境界を基準にする
  const sidePanelRef = useRef<HTMLDivElement>(null);

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

  // Task 12.2 (tab-tree-bugfix): タブをグループに追加するハンドラ
  // ContextMenuからgroupIdとtabIdsを受け取り、各タブをグループに追加
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

  // ノードをツリー構造に変換
  // Task 3.1: ピン留めタブはツリーから除外する（要件10.1）
  // Task 6.2: 現在のウィンドウのタブのみを表示（要件14.1, 14.2, 14.3）
  const buildTree = (): TabNode[] => {
    if (!treeState) return [];

    // Task 3.1: ピン留めタブのIDセットを作成（高速検索用）
    const pinnedTabIdSet = new Set(pinnedTabIds);

    // Task 6.2: 現在のウィンドウに属するタブのIDセットを作成
    // currentWindowIdがnullの場合はフィルタリングをスキップ（全タブを表示）
    const currentWindowTabIds = new Set<number>();
    const shouldFilterByWindow = currentWindowId !== null;
    if (shouldFilterByWindow) {
      Object.values(tabInfoMap).forEach(tabInfo => {
        if (tabInfo.windowId === currentWindowId) {
          currentWindowTabIds.add(tabInfo.id);
        }
      });
    }

    // 各ノードに対して children 配列を再構築
    // Task 3.1: ピン留めタブを除外
    // Task 6.2: 現在のウィンドウに属さないタブを除外
    const nodesWithChildren: Record<string, TabNode> = {};

    // まず、すべてのノードのコピーを作成（children は空配列で初期化）
    // Task 3.1: ピン留めタブは除外
    // Task 6.2: 現在のウィンドウに属さないタブを除外
    Object.entries(treeState.nodes).forEach(([id, node]) => {
      // ピン留めタブは除外
      if (pinnedTabIdSet.has(node.tabId)) {
        return;
      }
      // Task 6.2: 現在のウィンドウに属さないタブを除外（フィルタリングが有効な場合のみ）
      // Task 12.3 (tab-tree-bugfix): グループノード（tabId < 0）はフィルタリングから除外
      if (shouldFilterByWindow && node.tabId >= 0 && !currentWindowTabIds.has(node.tabId)) {
        return;
      }
      nodesWithChildren[id] = {
        ...node,
        children: [],
      };
    });

    // 親子関係を構築
    Object.entries(treeState.nodes).forEach(([id, node]) => {
      // 自分自身がピン留めタブの場合はスキップ
      if (pinnedTabIdSet.has(node.tabId)) {
        return;
      }
      // Task 6.2: 現在のウィンドウに属さないタブはスキップ（フィルタリングが有効な場合のみ）
      // Task 12.3 (tab-tree-bugfix): グループノード（tabId < 0）はフィルタリングから除外
      if (shouldFilterByWindow && node.tabId >= 0 && !currentWindowTabIds.has(node.tabId)) {
        return;
      }
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

    // Task 2.1 (tree-tab-bugfixes-and-ux-improvements): ブラウザタブのインデックス順でソート
    // Requirements: 2.1, 2.2, 2.3 - ドラッグ&ドロップでタブを並び替えた際にツリービューも更新
    // tabInfoMapのindexを使用してソートし、ブラウザタブの表示順序と同期させる
    rootNodes.sort((a, b) => {
      const indexA = tabInfoMap[a.tabId]?.index ?? Number.MAX_SAFE_INTEGER;
      const indexB = tabInfoMap[b.tabId]?.index ?? Number.MAX_SAFE_INTEGER;
      return indexA - indexB;
    });

    // 子ノードも再帰的にソート
    const sortChildrenRecursively = (node: TabNode): void => {
      if (node.children.length > 0) {
        node.children.sort((a, b) => {
          const indexA = tabInfoMap[a.tabId]?.index ?? Number.MAX_SAFE_INTEGER;
          const indexB = tabInfoMap[b.tabId]?.index ?? Number.MAX_SAFE_INTEGER;
          return indexA - indexB;
        });
        node.children.forEach(sortChildrenRecursively);
      }
    };

    rootNodes.forEach(sortChildrenRecursively);

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

  // Task 4.3: ツリー外ドロップで新規ウィンドウ作成（要件13.1, 13.2）
  // Task 14.1: 空ウィンドウの自動クローズ（Requirements 7.1, 7.2）
  const handleExternalDrop = useCallback((tabId: number) => {
    // サブツリーごと新しいウィンドウに移動（子タブがある場合は一緒に移動）
    // Task 14.1: sourceWindowIdを渡して、全タブ移動後にウィンドウを閉じる
    chrome.runtime.sendMessage({
      type: 'CREATE_WINDOW_WITH_SUBTREE',
      payload: { tabId, sourceWindowId: currentWindowId ?? undefined },
    });
    // クロスウィンドウドラッグ状態をクリア
    clearCrossWindowDragState();
  }, [clearCrossWindowDragState, currentWindowId]);

  // Task 7.2 (tab-tree-comprehensive-fix): クロスウィンドウドラッグ開始ハンドラ
  // Requirement 7.2: 別ウィンドウのツリービュー上でのドロップでタブを移動
  const handleTreeDragStart = useCallback((event: { active: { id: string | number } }) => {
    // ドラッグ開始時にクロスウィンドウドラッグ状態を設定
    const nodeId = event.active.id as string;
    // ノードからタブIDを取得
    const node = treeState?.nodes[nodeId];
    if (node) {
      handleCrossWindowDragStart(node.tabId, nodes);
    }
  }, [treeState, nodes, handleCrossWindowDragStart]);

  // Task 7.2 (tab-tree-comprehensive-fix): クロスウィンドウドロップを含むドラッグ終了ハンドラ
  // Requirement 7.2: 別ウィンドウのツリービュー上でのドロップでタブを移動
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
      {/* Task 6.1 (tab-tree-bugfix): アクティブタブのハイライト */}
      {/* Task 11.1 (tab-tree-bugfix): ピン留めタブの並び替え (Requirements 10.1, 10.2, 10.3, 10.4) */}
      <PinnedTabsSection
        pinnedTabIds={pinnedTabIds}
        tabInfoMap={tabInfoMap}
        onTabClick={handlePinnedTabClick}
        onContextMenu={handlePinnedTabContextMenu}
        activeTabId={activeTabId}
        onPinnedTabReorder={handlePinnedTabReorder}
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
      {/* Task 2.4: タブツリーの水平スクロール禁止（要件12.1, 12.2） */}
      {/* Task 7.2 (tab-tree-bugfix-2): サイドパネル境界参照を設定 */}
      <div ref={sidePanelRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar" data-testid="tab-tree-root">
        <TabTreeView
          nodes={nodes}
          currentViewId={treeState?.currentViewId || 'default'}
          onNodeClick={handleNodeClick}
          onToggleExpand={handleToggleExpand}
          // Task 7.2 (tab-tree-comprehensive-fix): クロスウィンドウドラッグ統合
          onDragStart={handleTreeDragStart}
          onDragEnd={handleTreeDragEnd}
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
          // Task 12.2 (tab-tree-bugfix): グループ追加サブメニュー用
          onAddToGroup={handleAddToGroup}
          // Task 12.1: ビュー移動サブメニュー用 (Requirements 18.1, 18.2, 18.3)
          views={treeState?.views}
          onMoveToView={moveTabsToView}
          // Task 4.3: ツリー外ドロップで新規ウィンドウ作成 (Requirements 13.1, 13.2)
          onExternalDrop={handleExternalDrop}
          // Task 7.2 (tab-tree-bugfix-2): サイドパネル境界参照 (Requirement 4.2, 4.3)
          sidePanelRef={sidePanelRef}
        />
        {/* Task 8.1 (tab-tree-comprehensive-fix): 新規タブ追加ボタン */}
        {/* Requirement 8.1: 全てのタブの最後に新規タブ追加ボタンを表示 */}
        {/* Requirement 8.2: ツリービューの横幅いっぱいの幅を持つ */}
        {/* Requirement 8.3: クリック時に新しいタブをツリーの末尾に追加 */}
        {/* Requirement 8.4: クリック時に新しいタブをブラウザでアクティブにする */}
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
