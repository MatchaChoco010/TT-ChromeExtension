import React, { useCallback } from 'react';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import { ThemeProvider } from '../providers/ThemeProvider';
import ErrorBoundary from './ErrorBoundary';
import TabTreeView from './TabTreeView';
import ViewSwitcher from './ViewSwitcher';
import GroupSection from './GroupSection';
import PinnedTabsSection from './PinnedTabsSection';
import ExternalDropZone from './ExternalDropZone';
import { OpenSettingsButton } from './OpenSettingsButton';
import { useExternalDrop } from '../hooks/useExternalDrop';
import { indexedDBService } from '@/storage/IndexedDBService';
import { storageService } from '@/storage/StorageService';
import { SnapshotManager } from '@/services/SnapshotManager';
import type { TabNode } from '@/types';
import type { DragStartEvent } from '@dnd-kit/core';

interface SidePanelRootProps {
  children?: React.ReactNode;
}

// ツリービューを表示するコンポーネント
const TreeViewContent: React.FC = () => {
  const {
    treeState,
    updateTreeState,
    handleDragEnd,
    switchView,
    createView,
    deleteView,
    updateView,
    // Task 4.9: グループ機能
    groups,
    createGroup,
    deleteGroup,
    toggleGroupExpanded,
    getGroupTabCount,
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
  } = useTreeState();

  // Task 8.2: 設定画面はサイドパネル内ではなく、新規タブで開くように変更
  // const [isSettingsOpen, setIsSettingsOpen] = useState(false); // 削除

  // Task 5.2: 外部ドロップ（新規ウィンドウ作成）機能
  const {
    isDragging: isExternalDragActive,
    setIsDragging: setExternalDragActive,
    setActiveTabId: setDraggedTabId,
    onExternalDrop,
  } = useExternalDrop();

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

  const handleGroupClick = (groupId: string) => {
    // グループをクリックしたときの処理（現在は展開/折りたたみのみ）
    toggleGroupExpanded(groupId);
  };

  // Task 3.1: ピン留めタブのクリックハンドラ
  const handlePinnedTabClick = (tabId: number) => {
    chrome.tabs.update(tabId, { active: true });
  };

  // Task 3.1: ピン留めタブの閉じるハンドラ
  const handlePinnedTabClose = (tabId: number) => {
    chrome.tabs.remove(tabId);
  };

  // Task 5.2: ドラッグ開始時のハンドラ（外部ドロップ連携）
  const handleTreeDragStart = useCallback((event: DragStartEvent) => {
    const nodeId = event.active.id as string;
    // ノードIDからタブIDを取得
    if (treeState?.nodes[nodeId]) {
      const tabId = treeState.nodes[nodeId].tabId;
      setDraggedTabId(tabId);
      setExternalDragActive(true);
    }
  }, [treeState?.nodes, setDraggedTabId, setExternalDragActive]);

  // Task 5.2: ドラッグキャンセル時のハンドラ（外部ドロップ連携）
  const handleTreeDragCancel = useCallback(() => {
    setDraggedTabId(null);
    setExternalDragActive(false);
  }, [setDraggedTabId, setExternalDragActive]);

  // Task 5.2: ドラッグ終了時のハンドラをラップ（外部ドロップ連携）
  const handleTreeDragEnd = useCallback(async (event: Parameters<typeof handleDragEnd>[0]) => {
    // 元のドラッグ終了処理を呼び出す
    await handleDragEnd(event);
    // 外部ドロップ状態をリセット
    setDraggedTabId(null);
    setExternalDragActive(false);
  }, [handleDragEnd, setDraggedTabId, setExternalDragActive]);

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Task 10.2: ヘッダー「Vivaldi-TT」を削除し、設定ボタンのみ表示。タブツリーの表示領域を最大化 */}
      <div className="flex items-center justify-end p-1 border-b border-gray-700">
        {/* Task 8.2: 設定画面を新規タブで開くボタン */}
        <OpenSettingsButton />
      </div>

      {/* Task 4.8: ビュースイッチャー */}
      {treeState && (
        <ViewSwitcher
          views={treeState.views}
          currentViewId={treeState.currentViewId}
          onViewSwitch={switchView}
          onViewCreate={createView}
          onViewDelete={deleteView}
          onViewUpdate={updateView}
        />
      )}
      {/* Task 4.9: グループセクション */}
      <GroupSection
        groups={groups}
        onCreateGroup={createGroup}
        onDeleteGroup={deleteGroup}
        onToggleGroup={toggleGroupExpanded}
        onGroupClick={handleGroupClick}
        getGroupTabCount={getGroupTabCount}
      />
      {/* Task 6.2: スナップショットセクションを削除し、コンテキストメニューからスナップショットを取得可能に */}
      {/* Task 3.1: ピン留めタブセクション */}
      <PinnedTabsSection
        pinnedTabIds={pinnedTabIds}
        tabInfoMap={tabInfoMap}
        onTabClick={handlePinnedTabClick}
        onTabClose={handlePinnedTabClose}
      />
      {/* タブツリービュー */}
      <div className="flex-1 overflow-auto" data-testid="tab-tree-root">
        <TabTreeView
          nodes={nodes}
          currentViewId={treeState?.currentViewId || 'default'}
          onNodeClick={handleNodeClick}
          onToggleExpand={handleToggleExpand}
          onDragEnd={handleTreeDragEnd}
          onDragStart={handleTreeDragStart}
          onDragCancel={handleTreeDragCancel}
          isTabUnread={isTabUnread}
          getUnreadChildCount={getUnreadChildCount}
          activeTabId={activeTabId ?? undefined}
          getTabInfo={getTabInfo}
          isNodeSelected={isNodeSelected}
          onSelect={selectNode}
          getSelectedTabIds={getSelectedTabIds}
          onSnapshot={handleSnapshot}
        />
        {/* Task 5.2: 外部ドロップゾーン（新規ウィンドウ作成） */}
        <ExternalDropZone
          isDragging={isExternalDragActive}
          onDrop={onExternalDrop}
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
          <div data-testid="side-panel-root" className="h-screen w-full overflow-auto bg-gray-900 text-gray-100">
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
