import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { TreeState, TabNode, View, Group } from '@/types';
import type { DragEndEvent } from '@dnd-kit/core';
import { STORAGE_KEYS } from '@/storage/StorageService';

interface TreeStateContextType {
  treeState: TreeState | null;
  isLoading: boolean;
  error: Error | null;
  updateTreeState: (state: TreeState) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  // Task 4.8: ビュー管理機能
  switchView: (viewId: string) => void;
  createView: () => void;
  deleteView: (viewId: string) => void;
  updateView: (viewId: string, updates: Partial<View>) => void;
  // Task 4.9: グループ管理機能
  groups: Record<string, Group>;
  createGroup: (name: string, color: string) => string;
  deleteGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<Group>) => void;
  toggleGroupExpanded: (groupId: string) => void;
  addTabToGroup: (nodeId: string, groupId: string) => void;
  removeTabFromGroup: (nodeId: string) => void;
  getGroupTabCount: (groupId: string) => number;
  // Task 4.13: 未読状態管理機能
  unreadTabIds: Set<number>;
  isTabUnread: (tabId: number) => boolean;
  getUnreadCount: () => number;
  getUnreadChildCount: (nodeId: string) => number;
  // Task 8.5.4: アクティブタブID
  activeTabId: number | null;
}

const TreeStateContext = createContext<TreeStateContextType | undefined>(
  undefined
);

export const useTreeState = () => {
  const context = useContext(TreeStateContext);
  if (!context) {
    throw new Error('useTreeState must be used within TreeStateProvider');
  }
  return context;
};

/**
 * デフォルトビューを持つviews配列を返す
 */
function getDefaultViews(): View[] {
  return [
    {
      id: 'default',
      name: 'Default',
      color: '#3b82f6',
    },
  ];
}

/**
 * ストレージから読み込んだツリー状態の children 参照を再構築
 * JSONシリアライズにより失われた参照関係を復元する
 * また、views が存在しない場合はデフォルトビューを追加する
 */
function reconstructChildrenReferences(treeState: TreeState): TreeState {
  // 新しいノードオブジェクトを作成（children は空配列で初期化）
  const reconstructedNodes: Record<string, TabNode> = {};

  Object.entries(treeState.nodes).forEach(([id, node]) => {
    reconstructedNodes[id] = {
      ...node,
      children: [],
    };
  });

  // parentId に基づいて children 参照を再構築
  Object.entries(treeState.nodes).forEach(([id, node]) => {
    if (node.parentId && reconstructedNodes[node.parentId]) {
      const parent = reconstructedNodes[node.parentId];
      const child = reconstructedNodes[id];
      if (child) {
        parent.children.push(child);
      }
    }
  });

  // すべてのノードの depth を再計算（ルートノードから開始して再帰的に）
  const recalculateDepth = (node: TabNode, depth: number): void => {
    node.depth = depth;
    for (const child of node.children) {
      recalculateDepth(child, depth + 1);
    }
  };

  // ルートノード（parentId が null）から開始
  Object.values(reconstructedNodes).forEach((node) => {
    if (!node.parentId) {
      recalculateDepth(node, 0);
    }
  });

  // Task 4.8: views が存在しない場合はデフォルトビューを追加
  const views = treeState.views && treeState.views.length > 0
    ? treeState.views
    : getDefaultViews();

  // currentViewId がない場合はデフォルトを設定
  const currentViewId = treeState.currentViewId || 'default';

  return {
    ...treeState,
    views,
    currentViewId,
    nodes: reconstructedNodes,
  };
}

interface TreeStateProviderProps {
  children: React.ReactNode;
}

export const TreeStateProvider: React.FC<TreeStateProviderProps> = ({
  children,
}) => {
  const [treeState, setTreeState] = useState<TreeState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  // Task 4.9: グループ状態
  const [groups, setGroups] = useState<Record<string, Group>>({});
  // Task 4.13: 未読タブ状態
  const [unreadTabIds, setUnreadTabIds] = useState<Set<number>>(new Set());
  // Task 8.5.4: アクティブタブID
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  // Task 10.2.1: ローカル更新中フラグ（storage.onChangedからの更新をスキップするため）
  const isLocalUpdateRef = useRef<boolean>(false);

  // Task 4.9: ストレージからグループを読み込む
  const loadGroups = React.useCallback(async () => {
    try {
      const result = await chrome.storage.local.get('groups');
      if (result.groups) {
        setGroups(result.groups);
      }
    } catch (_err) {
      // Failed to load groups silently
    }
  }, []);

  // Task 4.13: ストレージから未読タブを読み込む
  const loadUnreadTabs = React.useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.UNREAD_TABS);
      if (result[STORAGE_KEYS.UNREAD_TABS]) {
        setUnreadTabIds(new Set(result[STORAGE_KEYS.UNREAD_TABS]));
      }
    } catch (_err) {
      // Failed to load unread tabs silently
    }
  }, []);

  // Task 8.5.4: 現在のアクティブタブを読み込む
  const loadActiveTab = React.useCallback(async () => {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        setActiveTabId(activeTab.id);
      }
    } catch (_err) {
      // Failed to load active tab silently
    }
  }, []);

  // Task 4.9: グループをストレージに保存
  const saveGroups = React.useCallback(async (newGroups: Record<string, Group>) => {
    setGroups(newGroups);
    await chrome.storage.local.set({ groups: newGroups });
  }, []);

  // ストレージからツリー状態をロードし、必要に応じてブラウザタブと同期する関数
  const loadTreeState = React.useCallback(async () => {
    try {
      // chrome.storage.local から tree_state を読み込む
      const result = await chrome.storage.local.get('tree_state');
      if (result.tree_state && Object.keys(result.tree_state.nodes).length > 0) {
        // ツリー状態が存在し、ノードがある場合はそれを使用
        // JSONシリアライズで失われた children 参照を再構築
        const reconstructedState = reconstructChildrenReferences(result.tree_state);
        setTreeState(reconstructedState);
      } else {
        // ツリー状態が空の場合、実際のChrome Tabsと同期
        // Service Workerに同期をリクエスト
        try {
          await chrome.runtime.sendMessage({ type: 'SYNC_TABS' });

          // 同期完了を待つために少し待機してから再読み込み
          await new Promise(resolve => setTimeout(resolve, 500));

          const syncedResult = await chrome.storage.local.get('tree_state');
          if (syncedResult.tree_state) {
            // JSONシリアライズで失われた children 参照を再構築
            const reconstructedState = reconstructChildrenReferences(syncedResult.tree_state);
            setTreeState(reconstructedState);
          } else {
            // それでも状態がない場合は初期状態を作成
            const initialState: TreeState = {
              views: [
                {
                  id: 'default',
                  name: 'Default',
                  color: '#3b82f6',
                },
              ],
              currentViewId: 'default',
              nodes: {},
              tabToNode: {},
            };
            setTreeState(initialState);
          }
        } catch (_error) {
          // 同期に失敗しても初期状態を設定
          const initialState: TreeState = {
            views: [
              {
                id: 'default',
                name: 'Default',
                color: '#3b82f6',
              },
            ],
            currentViewId: 'default',
            nodes: {},
            tabToNode: {},
          };
          setTreeState(initialState);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load tree state')
      );
    }
  }, []);

  useEffect(() => {
    // 初期化時にストレージからツリー状態とグループと未読タブとアクティブタブをロード
    const initializeTreeState = async () => {
      setIsLoading(true);
      await Promise.all([loadTreeState(), loadGroups(), loadUnreadTabs(), loadActiveTab()]);
      setIsLoading(false);
    };

    initializeTreeState();
  }, [loadTreeState, loadGroups, loadUnreadTabs, loadActiveTab]);

  useEffect(() => {
    // STATE_UPDATED メッセージをリッスン
    const messageListener = (message: { type: string }) => {
      if (message.type === 'STATE_UPDATED') {
        // ストレージから最新の状態を再読み込み（未読タブも含む）
        loadTreeState();
        loadUnreadTabs();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [loadTreeState]);

  // Task 8.5.4: タブのアクティブ化イベントをリッスン
  useEffect(() => {
    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      setActiveTabId(activeInfo.tabId);
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, []);

  useEffect(() => {
    // chrome.storage.onChanged をリッスン
    const storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange }
    ) => {
      // Task 10.2.1: ローカル更新中はスキップ（レースコンディション防止）
      if (isLocalUpdateRef.current) {
        return;
      }

      if (changes.tree_state && changes.tree_state.newValue) {
        // ストレージの変更を状態に反映
        // JSONシリアライズで失われた children 参照を再構築
        const reconstructedState = reconstructChildrenReferences(changes.tree_state.newValue);
        setTreeState(reconstructedState);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  const updateTreeState = async (state: TreeState) => {
    // Task 10.2.1: ローカル更新フラグを設定（storage.onChangedからの更新をスキップするため）
    isLocalUpdateRef.current = true;
    try {
      // Update local state first for immediate UI response
      setTreeState(state);
      // Then save to storage (storage listener will also trigger, but with same data)
      await chrome.storage.local.set({ tree_state: state });
    } finally {
      // フラグをリセット（次のイベントループでストレージリスナーが完了した後）
      setTimeout(() => {
        isLocalUpdateRef.current = false;
      }, 0);
    }
  };

  /**
   * Task 4.8: ビュー切り替え
   * Requirements: 3.8
   */
  const switchView = useCallback((viewId: string) => {
    if (!treeState) return;

    const newState: TreeState = {
      ...treeState,
      currentViewId: viewId,
    };
    updateTreeState(newState);
  }, [treeState]);

  /**
   * Task 4.8: 新しいビューを作成
   * Requirements: 3.8
   */
  const createView = useCallback(() => {
    if (!treeState) return;

    const newViewId = `view_${Date.now()}`;
    const newView: View = {
      id: newViewId,
      name: 'New View',
      color: '#6b7280', // gray-500
    };

    const newState: TreeState = {
      ...treeState,
      views: [...treeState.views, newView],
    };
    updateTreeState(newState);
  }, [treeState]);

  /**
   * Task 4.8: ビューを削除
   * Requirements: 3.8
   */
  const deleteView = useCallback((viewId: string) => {
    if (!treeState) return;

    // デフォルトビューは削除不可
    if (viewId === 'default') return;

    const newViews = treeState.views.filter(v => v.id !== viewId);

    // 削除されたビューが現在のビューだった場合、デフォルトビューに切り替え
    const newCurrentViewId = treeState.currentViewId === viewId
      ? 'default'
      : treeState.currentViewId;

    const newState: TreeState = {
      ...treeState,
      views: newViews,
      currentViewId: newCurrentViewId,
    };
    updateTreeState(newState);
  }, [treeState]);

  /**
   * Task 4.8: ビューを更新（名前、色など）
   * Requirements: 3.8
   */
  const updateView = useCallback((viewId: string, updates: Partial<View>) => {
    if (!treeState) return;

    const newViews = treeState.views.map(v =>
      v.id === viewId ? { ...v, ...updates } : v
    );

    const newState: TreeState = {
      ...treeState,
      views: newViews,
    };
    updateTreeState(newState);
  }, [treeState]);

  /**
   * ドラッグ&ドロップイベントハンドラ
   * タスク 6.3: ドラッグ&ドロップによるツリー再構成
   * Requirements: 3.2, 3.3
   */
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id || !treeState) {
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      // ノードを探す
      const findNode = (
        nodes: Record<string, TabNode>,
        nodeId: string
      ): TabNode | null => {
        return nodes[nodeId] || null;
      };

      const activeNode = findNode(treeState.nodes, activeId);
      const overNode = findNode(treeState.nodes, overId);

      if (!activeNode || !overNode) {
        return;
      }

      // 循環参照のチェック
      const isDescendant = (ancestorId: string, descendantId: string): boolean => {
        const ancestor = treeState.nodes[ancestorId];
        if (!ancestor) return false;

        for (const child of ancestor.children) {
          if (child.id === descendantId) return true;
          if (isDescendant(child.id, descendantId)) return true;
        }

        return false;
      };

      if (isDescendant(activeId, overId)) {
        return;
      }

      // 深いコピーを作成して変更を加える
      // まず全ノードの浅いコピーを作成
      const updatedNodes: Record<string, TabNode> = {};
      Object.entries(treeState.nodes).forEach(([id, node]) => {
        updatedNodes[id] = {
          ...node,
          children: [], // 子配列は後で再構築
        };
      });

      // activeNodeを更新（新しい親の子として設定）
      const updatedActiveNode = updatedNodes[activeId];

      updatedActiveNode.parentId = overId;

      // 親子関係を再構築（更新後の parentId を基に）
      Object.entries(updatedNodes).forEach(([id, node]) => {
        if (node.parentId && updatedNodes[node.parentId]) {
          const parent = updatedNodes[node.parentId];
          const child = updatedNodes[id];
          if (child && !parent.children.some(c => c.id === id)) {
            parent.children.push(child);
          }
        }
      });

      // 深さを再計算（parentIdベースで、children配列に依存しない）
      const calculateDepth = (nodeId: string, visited: Set<string> = new Set()): number => {
        if (visited.has(nodeId)) {
          return 0;
        }
        visited.add(nodeId);

        const node = updatedNodes[nodeId];
        if (!node) return 0;
        if (!node.parentId) return 0;

        const parentDepth = calculateDepth(node.parentId, visited);
        return parentDepth + 1;
      };

      // すべてのノードの深さを再計算
      Object.values(updatedNodes).forEach((node) => {
        node.depth = calculateDepth(node.id);
      });

      // 新しい親を自動展開
      const updatedOverNode = updatedNodes[overId];
      updatedOverNode.isExpanded = true; // 自動展開

      // tabToNodeマッピングを更新
      const updatedTabToNode = { ...treeState.tabToNode };

      // 状態を更新
      const newTreeState = {
        ...treeState,
        nodes: updatedNodes,
        tabToNode: updatedTabToNode,
      };

      await updateTreeState(newTreeState);

      // Note: We don't send UPDATE_TREE message because:
      // 1. TreeStateProvider directly updates storage
      // 2. Service worker's TreeStateManager will reload from storage when needed
      // 3. Sending UPDATE_TREE would cause duplicate updates and potential race conditions
    },
    [treeState, updateTreeState]
  );

  /**
   * Task 4.9: 新しいグループを作成
   * Requirements: 3.9
   * @returns 作成されたグループのID
   */
  const createGroup = useCallback((name: string, color: string): string => {
    const newGroupId = `group_${Date.now()}`;
    const newGroup: Group = {
      id: newGroupId,
      name,
      color,
      isExpanded: true,
    };

    const newGroups = { ...groups, [newGroupId]: newGroup };
    saveGroups(newGroups);
    return newGroupId;
  }, [groups, saveGroups]);

  /**
   * Task 4.9: グループを削除
   * Requirements: 3.9
   */
  const deleteGroup = useCallback((groupId: string) => {
    const newGroups = { ...groups };
    delete newGroups[groupId];
    saveGroups(newGroups);

    // グループに属していたタブのグループIDをクリア
    if (treeState) {
      const updatedNodes = { ...treeState.nodes };
      Object.values(updatedNodes).forEach((node) => {
        if (node.groupId === groupId) {
          node.groupId = undefined;
        }
      });
      updateTreeState({ ...treeState, nodes: updatedNodes });
    }
  }, [groups, saveGroups, treeState, updateTreeState]);

  /**
   * Task 4.9: グループを更新（名前、色など）
   * Requirements: 3.9
   */
  const updateGroupFn = useCallback((groupId: string, updates: Partial<Group>) => {
    const group = groups[groupId];
    if (!group) return;

    const updatedGroup = { ...group, ...updates };
    const newGroups = { ...groups, [groupId]: updatedGroup };
    saveGroups(newGroups);
  }, [groups, saveGroups]);

  /**
   * Task 4.9: グループの展開/折りたたみを切り替え
   * Requirements: 3.9
   */
  const toggleGroupExpanded = useCallback((groupId: string) => {
    const group = groups[groupId];
    if (!group) return;

    const updatedGroup = { ...group, isExpanded: !group.isExpanded };
    const newGroups = { ...groups, [groupId]: updatedGroup };
    saveGroups(newGroups);
  }, [groups, saveGroups]);

  /**
   * Task 4.9: タブをグループに追加
   * Requirements: 3.9
   */
  const addTabToGroup = useCallback((nodeId: string, groupId: string) => {
    if (!treeState) return;

    const node = treeState.nodes[nodeId];
    if (!node) return;

    const updatedNodes = { ...treeState.nodes };
    updatedNodes[nodeId] = { ...node, groupId };
    updateTreeState({ ...treeState, nodes: updatedNodes });
  }, [treeState, updateTreeState]);

  /**
   * Task 4.9: タブをグループから削除
   * Requirements: 3.9
   */
  const removeTabFromGroup = useCallback((nodeId: string) => {
    if (!treeState) return;

    const node = treeState.nodes[nodeId];
    if (!node) return;

    const updatedNodes = { ...treeState.nodes };
    const updatedNode = { ...node, groupId: undefined };
    updatedNodes[nodeId] = updatedNode;
    updateTreeState({ ...treeState, nodes: updatedNodes });
  }, [treeState, updateTreeState]);

  /**
   * Task 4.9: グループ内のタブ数を取得
   * Requirements: 3.9
   */
  const getGroupTabCount = useCallback((groupId: string): number => {
    if (!treeState) return 0;

    return Object.values(treeState.nodes).filter(
      (node) => node.groupId === groupId
    ).length;
  }, [treeState]);

  /**
   * Task 4.13: タブが未読かどうかを確認
   * Requirements: 3.13.1
   */
  const isTabUnread = useCallback((tabId: number): boolean => {
    return unreadTabIds.has(tabId);
  }, [unreadTabIds]);

  /**
   * Task 4.13: 未読タブの総数を取得
   * Requirements: 3.13.4
   */
  const getUnreadCount = useCallback((): number => {
    return unreadTabIds.size;
  }, [unreadTabIds]);

  /**
   * Task 4.13: 指定ノードの子孫の未読タブ数を取得
   * Requirements: 3.13.3
   */
  const getUnreadChildCount = useCallback((nodeId: string): number => {
    if (!treeState) return 0;

    const node = treeState.nodes[nodeId];
    if (!node) return 0;

    // 再帰的に子孫タブの未読数をカウント
    const countUnreadInSubtree = (currentNode: TabNode): number => {
      let count = 0;
      for (const child of currentNode.children) {
        if (unreadTabIds.has(child.tabId)) {
          count++;
        }
        count += countUnreadInSubtree(child);
      }
      return count;
    };

    return countUnreadInSubtree(node);
  }, [treeState, unreadTabIds]);

  return (
    <TreeStateContext.Provider
      value={{
        treeState,
        isLoading,
        error,
        updateTreeState,
        handleDragEnd,
        // Task 4.8: ビュー管理機能
        switchView,
        createView,
        deleteView,
        updateView,
        // Task 4.9: グループ管理機能
        groups,
        createGroup,
        deleteGroup,
        updateGroup: updateGroupFn,
        toggleGroupExpanded,
        addTabToGroup,
        removeTabFromGroup,
        getGroupTabCount,
        // Task 4.13: 未読状態管理機能
        unreadTabIds,
        isTabUnread,
        getUnreadCount,
        getUnreadChildCount,
        // Task 8.5.4: アクティブタブID
        activeTabId,
      }}
    >
      {children}
    </TreeStateContext.Provider>
  );
};

export default TreeStateProvider;
