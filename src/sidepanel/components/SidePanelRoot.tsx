import React, { useState } from 'react';
import { TreeStateProvider, useTreeState } from '../providers/TreeStateProvider';
import { ThemeProvider, useTheme } from '../providers/ThemeProvider';
import ErrorBoundary from './ErrorBoundary';
import TabTreeView from './TabTreeView';
import ViewSwitcher from './ViewSwitcher';
import GroupSection from './GroupSection';
import SnapshotSection from './SnapshotSection';
import SettingsPanel from './SettingsPanel';
import { indexedDBService } from '@/storage/IndexedDBService';
import { storageService } from '@/storage/StorageService';

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
  } = useTreeState();

  const { settings, updateSettings } = useTheme();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
  const buildTree = (): typeof treeState extends { nodes: infer N } ? N extends Record<string, infer T> ? T[] : never : never => {
    if (!treeState) return [];

    // 各ノードに対して children 配列を再構築
    const nodesWithChildren: Record<string, any> = {};

    // まず、すべてのノードのコピーを作成（children は空配列で初期化）
    Object.entries(treeState.nodes).forEach(([id, node]: [string, any]) => {
      nodesWithChildren[id] = {
        ...node,
        children: [],
      };
    });

    // 親子関係を構築
    Object.entries(treeState.nodes).forEach(([id, node]: [string, any]) => {
      if (node.parentId && nodesWithChildren[node.parentId]) {
        nodesWithChildren[node.parentId].children.push(nodesWithChildren[id]);
      }
    });

    // ルートノードのみを返す
    const rootNodes: any[] = [];
    Object.values(nodesWithChildren).forEach((node: any) => {
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

  return (
    <div className="flex flex-col h-full">
      {/* ヘッダー: 設定ボタン */}
      <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm font-medium">Vivaldi-TT</span>
        <button
          data-testid="settings-button"
          onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
          aria-label="設定"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
        </button>
      </div>

      {/* Task 4.12: 設定パネル */}
      {isSettingsOpen && settings && (
        <div
          data-testid="settings-panel"
          className="absolute inset-0 bg-white dark:bg-gray-800 z-50 overflow-auto"
        >
          <div className="flex items-center justify-between p-2 border-b border-gray-200 dark:border-gray-700">
            <span className="text-sm font-medium">設定</span>
            <button
              data-testid="settings-close-button"
              onClick={() => setIsSettingsOpen(false)}
              className="p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
              aria-label="閉じる"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
          <SettingsPanel settings={settings} onSettingsChange={updateSettings} />
        </div>
      )}

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
      {/* Task 4.10: スナップショットセクション */}
      <SnapshotSection
        indexedDBService={indexedDBService}
        storageService={storageService}
      />
      {/* タブツリービュー */}
      <div className="flex-1 overflow-auto" data-testid="tab-tree-root">
        <TabTreeView
          nodes={nodes}
          currentViewId={treeState?.currentViewId || 'default'}
          onNodeClick={handleNodeClick}
          onToggleExpand={handleToggleExpand}
          onDragEnd={handleDragEnd}
          isTabUnread={isTabUnread}
          getUnreadChildCount={getUnreadChildCount}
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
      <div className="flex items-center justify-center h-screen bg-red-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-700">{error.message}</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
          <p className="text-gray-600">Loading...</p>
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
          <div data-testid="side-panel-root" className="h-screen w-full overflow-auto">
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
