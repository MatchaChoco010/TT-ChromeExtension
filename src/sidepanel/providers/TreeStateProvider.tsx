import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { TreeState, TabNode, View, Group, ExtendedTabInfo, TabInfoMap, SiblingDropInfo, DragEndEvent, ViewState } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

interface TreeStateContextType {
  treeState: TreeState | null;
  isLoading: boolean;
  error: Error | null;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  handleSiblingDrop: (info: SiblingDropInfo) => Promise<void>;
  switchView: (viewId: string) => void;
  createView: () => void;
  deleteView: (viewId: string) => void;
  updateView: (viewId: string, updates: Partial<View>) => void;
  groups: Record<string, Group>;
  createGroup: (name: string, color: string) => string;
  deleteGroup: (nodeId: string) => void;
  updateGroup: (nodeId: string, updates: Partial<Group>) => void;
  toggleGroupExpanded: (nodeId: string) => void;
  addTabToGroup: (nodeId: string, targetGroupNodeId: string) => void;
  removeTabFromGroup: (nodeId: string) => void;
  getGroupTabCount: (nodeId: string) => number;
  unreadTabIds: Set<number>;
  isTabUnread: (tabId: number) => boolean;
  getUnreadCount: () => number;
  getUnreadChildCount: (nodeId: string) => number;
  activeTabId: number | null;
  tabInfoMap: TabInfoMap;
  getTabInfo: (tabId: number) => ExtendedTabInfo | undefined;
  pinnedTabIds: number[];
  handlePinnedTabReorder: (tabId: number, newIndex: number) => Promise<void>;
  selectedNodeIds: Set<string>;
  lastSelectedNodeId: string | null;
  selectNode: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  clearSelection: () => void;
  isNodeSelected: (nodeId: string) => boolean;
  getSelectedTabIds: () => number[];
  viewTabCounts: Record<string, number>;
  moveTabsToView: (viewId: string, tabIds: number[]) => Promise<void>;
  currentWindowId: number | null;
  /** 現在のウィンドウのcurrentViewId（ウィンドウ毎に独立） */
  currentViewId: string;
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
 * デフォルトのViewStateを作成
 */
function createDefaultViewState(): ViewState {
  return {
    info: {
      id: 'default',
      name: 'Default',
      color: '#3B82F6',
    },
    rootNodeIds: [],
    nodes: {},
  };
}

/**
 * ストレージから読み込んだツリー状態の children 参照を再構築
 * JSONシリアライズにより失われた参照関係を復元する
 * また、views が存在しない場合はデフォルトビューを追加する
 */
function reconstructChildrenReferences(treeState: TreeState): TreeState {
  if (!treeState.views || Object.keys(treeState.views).length === 0) {
    return {
      ...treeState,
      views: { default: createDefaultViewState() },
      currentViewId: 'default',
      tabToNode: treeState.tabToNode || {},
    };
  }

  const reconstructedViews: Record<string, ViewState> = {};

  for (const [viewId, viewState] of Object.entries(treeState.views)) {
    const reconstructedNodes: Record<string, TabNode> = {};

    Object.entries(viewState.nodes).forEach(([id, node]) => {
      reconstructedNodes[id] = {
        ...node,
        children: [],
      };
    });

    // ストレージに保存されたchildren配列の順序を維持して再構築
    const addedChildIds = new Set<string>();

    Object.entries(viewState.nodes).forEach(([parentId, parentNode]) => {
      const parent = reconstructedNodes[parentId];
      if (!parent) return;

      if (parentNode.children && Array.isArray(parentNode.children)) {
        for (const storedChild of parentNode.children) {
          if (!storedChild || typeof storedChild !== 'object') continue;
          const childId = (storedChild as { id?: string }).id;
          if (!childId) continue;
          const child = reconstructedNodes[childId];
          if (child && child.parentId === parentId) {
            parent.children.push(child);
            addedChildIds.add(childId);
          }
        }
      }
    });

    // parentIdで関連付けられているが、まだ追加されていない子を追加（フォールバック）
    Object.entries(reconstructedNodes).forEach(([id, node]) => {
      if (addedChildIds.has(id)) return;
      if (node.parentId && reconstructedNodes[node.parentId]) {
        const parent = reconstructedNodes[node.parentId];
        parent.children.push(node);
      }
    });

    const recalculateDepth = (node: TabNode, depth: number): void => {
      node.depth = depth;
      for (const child of node.children) {
        recalculateDepth(child, depth + 1);
      }
    };

    for (const nodeId of viewState.rootNodeIds) {
      const node = reconstructedNodes[nodeId];
      if (node && !node.parentId) {
        recalculateDepth(node, 0);
      }
    }

    reconstructedViews[viewId] = {
      info: viewState.info,
      rootNodeIds: viewState.rootNodeIds || [],
      nodes: reconstructedNodes,
    };
  }

  const currentViewId = treeState.currentViewId || 'default';
  const currentViewByWindowId = treeState.currentViewByWindowId;

  return {
    ...treeState,
    views: reconstructedViews,
    currentViewId,
    currentViewByWindowId,
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
  const [groups, setGroups] = useState<Record<string, Group>>({});
  const [unreadTabIds, setUnreadTabIds] = useState<Set<number>>(new Set());
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [tabInfoMap, setTabInfoMap] = useState<TabInfoMap>({});
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [viewActiveTabIds, setViewActiveTabIds] = useState<Record<string, number>>({});

  const loadGroups = React.useCallback(async () => {
    try {
      const result = await chrome.storage.local.get('groups');
      if (result.groups) {
        setGroups(result.groups as Record<string, Group>);
      }
    } catch {
      // グループ読み込みエラーは無視（初期状態として空を使用）
    }
  }, []);

  const loadUnreadTabs = React.useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.UNREAD_TABS);
      if (result[STORAGE_KEYS.UNREAD_TABS]) {
        setUnreadTabIds(new Set(result[STORAGE_KEYS.UNREAD_TABS] as number[]));
      }
    } catch {
      // 未読タブ読み込みエラーは無視（初期状態として空を使用）
    }
  }, []);

  const loadActiveTab = React.useCallback(async () => {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id) {
        setActiveTabId(activeTab.id);
      }
    } catch {
      // アクティブタブ取得エラーは無視
    }
  }, []);

  const loadCurrentWindowId = React.useCallback(async () => {
    try {
      // URLパラメータからウィンドウIDを取得（別ウィンドウ用サイドパネルの場合）
      const urlParams = new URLSearchParams(window.location.search);
      const windowIdParam = urlParams.get('windowId');
      if (windowIdParam) {
        setCurrentWindowId(parseInt(windowIdParam, 10));
        return;
      }
      const currentWindow = await chrome.windows.getCurrent();
      if (currentWindow?.id !== undefined) {
        setCurrentWindowId(currentWindow.id);
      }
    } catch {
      // ウィンドウID取得エラーは無視（APIが利用できない場合はnullのまま）
    }
  }, []);

  const loadTabInfoMap = React.useCallback(async () => {
    try {
      const storedTitlesResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_TITLES);
      const persistedTitles: Record<number, string> = (storedTitlesResult[STORAGE_KEYS.TAB_TITLES] as Record<number, string> | undefined) || {};

      const storedFaviconsResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_FAVICONS);
      const persistedFavicons: Record<string, string> = (storedFaviconsResult[STORAGE_KEYS.TAB_FAVICONS] as Record<string, string> | undefined) || {};

      const tabs = await chrome.tabs.query({});

      const newTabInfoMap: TabInfoMap = {};
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          // 永続化されたタイトルがあればそれを使用
          // タブがローディング中でChromeからのタイトルが空の場合に特に有効
          const persistedTitle = persistedTitles[tab.id];
          const title = tab.title || persistedTitle || '';

          // 永続化されたファビコンがあればそれを使用（ブラウザ再起動後に有効）
          // URLをキーとして保存しているので、tabIdが変わっても復元可能
          const persistedFavicon = tab.url ? persistedFavicons[tab.url] : undefined;
          const favIconUrl = tab.favIconUrl || persistedFavicon;

          newTabInfoMap[tab.id] = {
            id: tab.id,
            title,
            url: tab.url || '',
            favIconUrl,
            status: tab.status === 'loading' ? 'loading' : 'complete',
            isPinned: tab.pinned || false,
            windowId: tab.windowId,
            discarded: tab.discarded || false,
            index: tab.index,
          };
        }
      }

      setTabInfoMap(newTabInfoMap);
    } catch {
      // タブ情報読み込みエラーは無視
    }
  }, []);

  const getTabInfo = useCallback((tabId: number): ExtendedTabInfo | undefined => {
    return tabInfoMap[tabId];
  }, [tabInfoMap]);

  const saveGroups = React.useCallback(async (newGroups: Record<string, Group>) => {
    setGroups(newGroups);
    await chrome.runtime.sendMessage({
      type: 'SAVE_GROUPS',
      payload: { groups: newGroups },
    });
  }, []);

  const loadTreeState = React.useCallback(async () => {
    try {
      const result = await chrome.storage.local.get('tree_state');
      const treeStateData = result.tree_state as TreeState | undefined;
      if (treeStateData && treeStateData.views && Object.keys(treeStateData.views).length > 0) {
        const reconstructedState = reconstructChildrenReferences(treeStateData);
        setTreeState(reconstructedState);
      } else {
        try {
          await chrome.runtime.sendMessage({ type: 'SYNC_TABS' });

          await new Promise(resolve => setTimeout(resolve, 500));

          const syncedResult = await chrome.storage.local.get('tree_state');
          const syncedTreeStateData = syncedResult.tree_state as TreeState | undefined;
          if (syncedTreeStateData && syncedTreeStateData.views) {
            const reconstructedState = reconstructChildrenReferences(syncedTreeStateData);
            setTreeState(reconstructedState);
          } else {
            const initialState: TreeState = {
              views: { default: createDefaultViewState() },
              viewOrder: ['default'],
              currentViewId: 'default',
              tabToNode: {},
              treeStructure: [],
            };
            setTreeState(initialState);
          }
        } catch {
          const initialState: TreeState = {
            views: { default: createDefaultViewState() },
            viewOrder: ['default'],
            currentViewId: 'default',
            tabToNode: {},
            treeStructure: [],
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
    const initializeTreeState = async () => {
      setIsLoading(true);
      await Promise.all([loadTreeState(), loadGroups(), loadUnreadTabs(), loadActiveTab(), loadTabInfoMap(), loadCurrentWindowId()]);
      setIsLoading(false);
    };

    initializeTreeState();
  }, [loadTreeState, loadGroups, loadUnreadTabs, loadActiveTab, loadTabInfoMap, loadCurrentWindowId]);

  useEffect(() => {
    // STATE_UPDATEDメッセージのペイロードから直接状態を取得
    // ストレージを共有メモリとして使わず、メッセージで状態を伝達する

    const messageListener = (message: { type: string; payload?: TreeState }) => {
      if (message.type === 'STATE_UPDATED' && message.payload) {
        const reconstructedState = reconstructChildrenReferences(message.payload);
        setTreeState(reconstructedState);
        loadTabInfoMap();
        loadUnreadTabs();
        loadGroups();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [loadTabInfoMap, loadUnreadTabs, loadGroups]);

  useEffect(() => {
    const handleTabActivated = (activeInfo: chrome.tabs.OnActivatedInfo) => {
      setActiveTabId(activeInfo.tabId);
      // Note: アクティブタブ変更時に選択状態を解除しない
      // ツリー内でのタブクリックでもonActivatedが発火するため、
      // クリック時の選択操作と競合してしまう
      // 代わりに、新しいタブ作成時とタブ削除時にのみ選択を解除する

      if (treeState) {
        const mapping = treeState.tabToNode[activeInfo.tabId];
        if (mapping) {
          setViewActiveTabIds(prev => ({
            ...prev,
            [mapping.viewId]: activeInfo.tabId,
          }));
        }
      }
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [treeState]);

  useEffect(() => {
    // タブ作成時は選択状態のみクリア
    // tabInfoMapの更新はSTATE_UPDATED経由のloadTabInfoMap()で行う（競合防止）
    const handleTabCreated = () => {
      setSelectedNodeIds(new Set());
      setLastSelectedNodeId(null);
    };

    chrome.tabs.onCreated.addListener(handleTabCreated);

    return () => {
      chrome.tabs.onCreated.removeListener(handleTabCreated);
    };
  }, []);

  useEffect(() => {
    // タブ削除時は選択状態のみクリア
    // tabInfoMapの更新はSTATE_UPDATED経由のloadTabInfoMap()で行う（競合防止）
    const handleTabRemoved = () => {
      setSelectedNodeIds(new Set());
      setLastSelectedNodeId(null);
    };

    chrome.tabs.onRemoved.addListener(handleTabRemoved);

    return () => {
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
    };
  }, []);

  /**
   * 現在のウィンドウのcurrentViewIdを取得
   * currentViewByWindowIdからウィンドウ固有のビューを取得し、
   * なければグローバルなcurrentViewIdにフォールバック
   */
  const currentViewId = useMemo((): string => {
    if (!treeState) return 'default';

    if (currentWindowId !== null && treeState.currentViewByWindowId) {
      const windowViewId = treeState.currentViewByWindowId[currentWindowId];
      if (windowViewId) {
        return windowViewId;
      }
    }

    return treeState.currentViewId || 'default';
  }, [treeState, currentWindowId]);

  const currentViewState = useMemo((): ViewState | null => {
    if (!treeState) return null;
    return treeState.views[currentViewId] || null;
  }, [treeState, currentViewId]);

  /**
   * ビュー切り替え
   * 現在のウィンドウのビューのみを切り替える（他のウィンドウには影響しない）
   * 切り替え先ビューの最後にアクティブだったタブをChromeでアクティブにする
   */
  const switchView = useCallback(async (viewId: string) => {
    if (!treeState || currentWindowId === null) return;

    // 現在のビューのアクティブタブを記憶（切り替え前）
    // React state更新が非同期のため、handleTabActivatedでの記憶が間に合わない場合の対策
    if (activeTabId !== null) {
      const mapping = treeState.tabToNode[activeTabId];
      if (mapping && mapping.viewId === currentViewId) {
        setViewActiveTabIds(prev => ({
          ...prev,
          [currentViewId]: activeTabId,
        }));
      }
    }

    await chrome.runtime.sendMessage({
      type: 'SWITCH_VIEW',
      payload: {
        viewId,
        windowId: currentWindowId,
        previousViewId: currentViewId,
        activeTabId,
      },
    });

    // Note: setViewActiveTabIds は非同期なので、最新値を使うために直接計算
    let tabIdToActivate = viewActiveTabIds[viewId];

    if (tabIdToActivate !== undefined) {
      const mapping = treeState.tabToNode[tabIdToActivate];
      const tabInfo = tabInfoMap[tabIdToActivate];
      const isInCurrentWindow = currentWindowId === null || (tabInfo && tabInfo.windowId === currentWindowId);
      if (mapping && mapping.viewId === viewId && isInCurrentWindow) {
        try {
          await chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', payload: { tabId: tabIdToActivate } });
          return;
        } catch {
          // タブが存在しない場合は無視してフォールバック
        }
      }
    }

    // 記憶されたタブがない、または既に別ビューに移動している場合は、
    // そのビューの最初のタブをアクティブにする（現在のウィンドウのみ）
    const targetViewState = treeState.views[viewId];
    if (!targetViewState) return;

    const viewTabs: number[] = [];
    for (const nodeId of Object.keys(targetViewState.nodes)) {
      const node = targetViewState.nodes[nodeId];
      if (!node) continue;
      if (currentWindowId !== null) {
        const tabInfo = tabInfoMap[node.tabId];
        if (tabInfo && tabInfo.windowId !== currentWindowId) continue;
      }
      viewTabs.push(node.tabId);
    }

    if (viewTabs.length > 0) {
      try {
        await chrome.runtime.sendMessage({ type: 'ACTIVATE_TAB', payload: { tabId: viewTabs[0] } });
      } catch {
        // タブが存在しない場合は無視
      }
    }
    // ビューにタブがない場合は何もしない（アクティブタブは変更しない）
  }, [treeState, viewActiveTabIds, activeTabId, currentViewId, currentWindowId, tabInfoMap]);

  const createView = useCallback(async () => {
    await chrome.runtime.sendMessage({ type: 'CREATE_VIEW' });
  }, []);

  /**
   * ビューを削除
   * 削除されるビューのタブはviewOrder上の前のビューに移動
   * 削除されるビューを表示していたウィンドウは移動先ビューに切り替え
   */
  const deleteView = useCallback(async (viewId: string) => {
    if (viewId === 'default') return;

    await chrome.runtime.sendMessage({
      type: 'DELETE_VIEW',
      payload: { viewId },
    });
  }, []);

  const updateView = useCallback(async (viewId: string, updates: Partial<View>) => {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_VIEW',
      payload: { viewId, updates },
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

      await chrome.runtime.sendMessage({
        type: 'MOVE_NODE',
        payload: {
          nodeId: activeId,
          targetParentId: overId,
          viewId: currentViewId,
          selectedNodeIds: Array.from(selectedNodeIds),
        },
      });
    },
    [selectedNodeIds, currentViewId]
  );

  /**
   * 兄弟としてドロップ（Gapドロップ）時のハンドラ
   * タブを兄弟として指定位置に挿入する
   */
  const handleSiblingDrop = useCallback(
    async (info: SiblingDropInfo) => {
      const { activeNodeId, aboveNodeId, belowNodeId } = info;

      await chrome.runtime.sendMessage({
        type: 'MOVE_NODE_AS_SIBLING',
        payload: {
          nodeId: activeNodeId,
          aboveNodeId,
          belowNodeId,
          viewId: currentViewId,
          selectedNodeIds: Array.from(selectedNodeIds),
        },
      });
    },
    [selectedNodeIds, currentViewId]
  );

  /**
   * 新しいグループを作成
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

  const deleteGroup = useCallback(async (nodeId: string) => {
    const newGroups = { ...groups };
    delete newGroups[nodeId];
    saveGroups(newGroups);

    await chrome.runtime.sendMessage({
      type: 'DELETE_TREE_GROUP',
      payload: { nodeId, viewId: currentViewId },
    });
  }, [groups, saveGroups, currentViewId]);

  const updateGroupFn = useCallback((nodeId: string, updates: Partial<Group>) => {
    const group = groups[nodeId];
    if (!group) return;

    const updatedGroup = { ...group, ...updates };
    const newGroups = { ...groups, [nodeId]: updatedGroup };
    saveGroups(newGroups);
  }, [groups, saveGroups]);

  const toggleGroupExpanded = useCallback((nodeId: string) => {
    const group = groups[nodeId];
    if (!group) return;

    const updatedGroup = { ...group, isExpanded: !group.isExpanded };
    const newGroups = { ...groups, [nodeId]: updatedGroup };
    saveGroups(newGroups);
  }, [groups, saveGroups]);

  const addTabToGroup = useCallback(async (nodeId: string, targetGroupNodeId: string) => {
    await chrome.runtime.sendMessage({
      type: 'ADD_TAB_TO_TREE_GROUP',
      payload: { nodeId, targetGroupNodeId, viewId: currentViewId },
    });
  }, [currentViewId]);

  const removeTabFromGroup = useCallback(async (nodeId: string) => {
    await chrome.runtime.sendMessage({
      type: 'REMOVE_TAB_FROM_TREE_GROUP',
      payload: { nodeId, viewId: currentViewId },
    });
  }, [currentViewId]);

  const getGroupTabCount = useCallback((nodeId: string): number => {
    if (!currentViewState) return 0;

    return Object.values(currentViewState.nodes).filter(
      (node) => node.parentId === nodeId
    ).length;
  }, [currentViewState]);

  const isTabUnread = useCallback((tabId: number): boolean => {
    return unreadTabIds.has(tabId);
  }, [unreadTabIds]);

  const getUnreadCount = useCallback((): number => {
    return unreadTabIds.size;
  }, [unreadTabIds]);

  const getUnreadChildCount = useCallback((nodeId: string): number => {
    if (!currentViewState) return 0;

    const node = currentViewState.nodes[nodeId];
    if (!node) return 0;

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
  }, [currentViewState, unreadTabIds]);

  const pinnedTabIds = useMemo((): number[] => {
    return Object.values(tabInfoMap)
      .filter(tabInfo => {
        if (currentWindowId !== null && tabInfo.windowId !== currentWindowId) {
          return false;
        }
        if (!tabInfo.isPinned) {
          return false;
        }
        // ビュー毎のピン留め独立: 現在のビューのピン留めタブのみ表示
        if (treeState) {
          const mapping = treeState.tabToNode[tabInfo.id];
          if (mapping && mapping.viewId !== currentViewId) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => a.index - b.index)
      .map(tabInfo => tabInfo.id);
  }, [tabInfoMap, currentWindowId, treeState, currentViewId]);

  const handlePinnedTabReorder = useCallback(async (tabId: number, newIndex: number): Promise<void> => {
    if (!currentWindowId) return;

    try {
      await chrome.runtime.sendMessage({
        type: 'REORDER_PINNED_TAB',
        payload: { tabId, newIndex },
      });
    } catch (error) {
      console.error('Failed to reorder pinned tab:', error);
    }
  }, [currentWindowId]);

  const selectNode = useCallback((nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => {
    if (!treeState || !currentViewState) return;

    if (!currentViewState.nodes[nodeId]) return;

    if (modifiers.ctrl) {
      setSelectedNodeIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(nodeId)) {
          newSet.delete(nodeId);
        } else {
          newSet.add(nodeId);
        }
        return newSet;
      });
      setLastSelectedNodeId(nodeId);
    } else if (modifiers.shift && lastSelectedNodeId) {
      // Chromeのタブインデックスではなく、ツリー表示順（深さ優先探索順）を使用
      const pinnedTabIdSet = new Set(pinnedTabIds);
      const currentWindowTabIds = new Set<number>();
      if (currentWindowId !== null) {
        Object.values(tabInfoMap).forEach(tabInfo => {
          if (tabInfo.windowId === currentWindowId) {
            currentWindowTabIds.add(tabInfo.id);
          }
        });
      }

      const rootNodesInView = currentViewState.rootNodeIds
        .map(id => currentViewState.nodes[id])
        .filter((node): node is TabNode => {
          if (!node) return false;
          if (pinnedTabIdSet.has(node.tabId)) return false;
          if (currentWindowId !== null && !currentWindowTabIds.has(node.tabId)) return false;
          return true;
        });

      const nodeIdsInDisplayOrder: string[] = [];
      const collectNodesInOrder = (node: TabNode) => {
        if (pinnedTabIdSet.has(node.tabId)) return;
        if (currentWindowId !== null && !currentWindowTabIds.has(node.tabId)) return;
        if (!tabInfoMap[node.tabId]) return;

        nodeIdsInDisplayOrder.push(node.id);

        if (node.isExpanded && node.children) {
          for (const child of node.children) {
            const childNode = currentViewState.nodes[child.id];
            if (childNode) {
              collectNodesInOrder(childNode);
            }
          }
        }
      };

      for (const rootNode of rootNodesInView) {
        collectNodesInOrder(rootNode);
      }

      const lastIndex = nodeIdsInDisplayOrder.indexOf(lastSelectedNodeId);
      const currentIndex = nodeIdsInDisplayOrder.indexOf(nodeId);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const startIndex = Math.min(lastIndex, currentIndex);
        const endIndex = Math.max(lastIndex, currentIndex);
        const rangeNodeIds = nodeIdsInDisplayOrder.slice(startIndex, endIndex + 1);
        setSelectedNodeIds(new Set(rangeNodeIds));
      } else {
        setSelectedNodeIds(new Set([nodeId]));
        setLastSelectedNodeId(nodeId);
      }
    } else {
      setSelectedNodeIds(new Set([nodeId]));
      setLastSelectedNodeId(nodeId);
    }
  }, [treeState, currentViewState, lastSelectedNodeId, tabInfoMap, pinnedTabIds, currentWindowId]);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setLastSelectedNodeId(null);
  }, []);

  const isNodeSelected = useCallback((nodeId: string): boolean => {
    return selectedNodeIds.has(nodeId);
  }, [selectedNodeIds]);

  const getSelectedTabIds = useCallback((): number[] => {
    if (!currentViewState) return [];

    const tabIds: number[] = [];
    for (const nodeId of selectedNodeIds) {
      const node = currentViewState.nodes[nodeId];
      if (node) {
        tabIds.push(node.tabId);
      }
    }
    return tabIds;
  }, [currentViewState, selectedNodeIds]);

  /**
   * 実際に存在するタブのみをカウント
   * - currentWindowIdでフィルタリング（現在のウィンドウのタブのみ）
   * - ピン留めタブも含む
   */
  const viewTabCounts = useMemo((): Record<string, number> => {
    if (!treeState) return {};

    const counts: Record<string, number> = {};

    for (const [viewId, viewState] of Object.entries(treeState.views)) {
      let count = 0;
      for (const node of Object.values(viewState.nodes)) {
        const tabInfo = tabInfoMap[node.tabId];
        if (tabInfo) {
          if (currentWindowId !== null && tabInfo.windowId !== currentWindowId) continue;
          count++;
        }
      }
      counts[viewId] = count;
    }

    return counts;
  }, [treeState, tabInfoMap, currentWindowId]);

  const moveTabsToView = useCallback(async (viewId: string, tabIds: number[]) => {
    await chrome.runtime.sendMessage({
      type: 'MOVE_TABS_TO_VIEW',
      payload: { targetViewId: viewId, tabIds },
    });
  }, []);

  return (
    <TreeStateContext.Provider
      value={{
        treeState,
        isLoading,
        error,
        handleDragEnd,
        handleSiblingDrop,
        switchView,
        createView,
        deleteView,
        updateView,
        groups,
        createGroup,
        deleteGroup,
        updateGroup: updateGroupFn,
        toggleGroupExpanded,
        addTabToGroup,
        removeTabFromGroup,
        getGroupTabCount,
        unreadTabIds,
        isTabUnread,
        getUnreadCount,
        getUnreadChildCount,
        activeTabId,
        tabInfoMap,
        getTabInfo,
        pinnedTabIds,
        handlePinnedTabReorder,
        selectedNodeIds,
        lastSelectedNodeId,
        selectNode,
        clearSelection,
        isNodeSelected,
        getSelectedTabIds,
        viewTabCounts,
        moveTabsToView,
        currentWindowId,
        currentViewId,
      }}
    >
      {children}
    </TreeStateContext.Provider>
  );
};

export default TreeStateProvider;
