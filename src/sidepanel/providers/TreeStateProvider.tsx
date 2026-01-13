import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { TreeState, TabNode, View, Group, ExtendedTabInfo, TabInfoMap, SiblingDropInfo, DragEndEvent } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

interface TreeStateContextType {
  treeState: TreeState | null;
  isLoading: boolean;
  error: Error | null;
  updateTreeState: (state: TreeState) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  handleSiblingDrop: (info: SiblingDropInfo) => Promise<void>;
  switchView: (viewId: string) => void;
  createView: () => void;
  deleteView: (viewId: string) => void;
  updateView: (viewId: string, updates: Partial<View>) => void;
  groups: Record<string, Group>;
  createGroup: (name: string, color: string) => string;
  deleteGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<Group>) => void;
  toggleGroupExpanded: (groupId: string) => void;
  addTabToGroup: (nodeId: string, groupId: string) => void;
  removeTabFromGroup: (nodeId: string) => void;
  getGroupTabCount: (groupId: string) => number;
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
 * ビューの色パレット
 * 新しいビューを作成するたびに、順番に色を割り当てる
 */
const VIEW_COLOR_PALETTE = [
  '#3B82F6', // blue (default)
  '#10B981', // green
  '#F59E0B', // yellow
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
];

/**
 * デフォルトビューを持つviews配列を返す
 */
function getDefaultViews(): View[] {
  return [
    {
      id: 'default',
      name: 'Default',
      color: '#3B82F6',
    },
  ];
}

/**
 * ストレージから読み込んだツリー状態の children 参照を再構築
 * JSONシリアライズにより失われた参照関係を復元する
 * また、views が存在しない場合はデフォルトビューを追加する
 */
function reconstructChildrenReferences(treeState: TreeState): TreeState {
  const reconstructedNodes: Record<string, TabNode> = {};

  Object.entries(treeState.nodes).forEach(([id, node]) => {
    reconstructedNodes[id] = {
      ...node,
      children: [],
    };
  });

  // ストレージに保存されたchildren配列の順序を維持して再構築
  // 2段階で処理: 1. 保存された順序で追加、2. parentIdで関連付けられているが未追加の子を追加
  const addedChildIds = new Set<string>();

  Object.entries(treeState.nodes).forEach(([parentId, parentNode]) => {
    const parent = reconstructedNodes[parentId];
    if (!parent) return;

    if (parentNode.children && Array.isArray(parentNode.children)) {
      for (const storedChild of parentNode.children) {
        if (!storedChild || typeof storedChild !== 'object') continue;
        const childId = storedChild.id;
        if (!childId) continue;
        const child = reconstructedNodes[childId];
        if (child && child.parentId === parentId) {
          parent.children.push(child);
          addedChildIds.add(childId);
        }
      }
    }
  });

  // 第2段階: parentIdで関連付けられているが、まだ追加されていない子を追加（フォールバック）
  Object.entries(reconstructedNodes).forEach(([id, node]) => {
    if (addedChildIds.has(id)) return; // 既に追加済み
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

  Object.values(reconstructedNodes).forEach((node) => {
    if (!node.parentId) {
      recalculateDepth(node, 0);
    }
  });

  const views = treeState.views && treeState.views.length > 0
    ? treeState.views
    : getDefaultViews();

  const currentViewId = treeState.currentViewId || 'default';
  const currentViewByWindowId = treeState.currentViewByWindowId;

  return {
    ...treeState,
    views,
    currentViewId,
    currentViewByWindowId,
    nodes: reconstructedNodes,
  };
}

/**
 * ツリーを深さ優先でフラット化
 * 親子関係を維持したまま、深さ優先順序でタブIDのリストを返す
 * ピン留めタブは除外する
 * ルートノードはviewNodeOrderでソート（buildTreeと同じ順序）
 */
function flattenTreeDFS(
  nodes: Record<string, TabNode>,
  currentViewId: string,
  pinnedTabIds: Set<number>,
  viewNodeOrder?: Record<string, string[]>
): number[] {
  const result: number[] = [];

  const rootNodes = Object.values(nodes).filter(
    (node) => node.parentId === null && node.viewId === currentViewId
  );

  // viewNodeOrderを使用してソート（buildTreeと同じ順序）
  const nodeOrderArray = viewNodeOrder?.[currentViewId] ?? [];
  const nodeOrderMap = new Map(nodeOrderArray.map((id, index) => [id, index]));
  rootNodes.sort((a, b) => {
    const indexA = nodeOrderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
    const indexB = nodeOrderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
    return indexA - indexB;
  });

  const traverse = (node: TabNode): void => {
    if (!pinnedTabIds.has(node.tabId)) {
      result.push(node.tabId);
    }
    for (const child of node.children) {
      traverse(child);
    }
  };

  for (const root of rootNodes) {
    traverse(root);
  }

  return result;
}

/**
 * ツリー構造をChromeタブインデックスに同期
 * ツリーを深さ優先でフラット化し、各タブのChromeインデックスを更新
 */
async function syncTreeToChromeTabs(
  nodes: Record<string, TabNode>,
  currentViewId: string,
  tabInfoMap: Record<number, { index: number; isPinned: boolean }>,
  viewNodeOrder?: Record<string, string[]>
): Promise<void> {
  const pinnedSet = new Set<number>();
  for (const [tabIdStr, info] of Object.entries(tabInfoMap)) {
    if (info.isPinned) {
      pinnedSet.add(parseInt(tabIdStr));
    }
  }

  const orderedTabIds = flattenTreeDFS(nodes, currentViewId, pinnedSet, viewNodeOrder);

  const pinnedCount = pinnedSet.size;

  // 最新のタブ情報を取得（tabInfoMapはReact stateで古い可能性があるため）
  const currentTabs = await chrome.tabs.query({ currentWindow: true });
  const currentIndexMap = new Map<number, number>();
  for (const tab of currentTabs) {
    if (tab.id !== undefined) {
      currentIndexMap.set(tab.id, tab.index);
    }
  }

  for (let i = 0; i < orderedTabIds.length; i++) {
    const tabId = orderedTabIds[i];
    const expectedIndex = pinnedCount + i;
    const currentIndex = currentIndexMap.get(tabId);

    if (currentIndex !== undefined && currentIndex !== expectedIndex) {
      try {
        await chrome.tabs.move(tabId, { index: expectedIndex });
        const updatedTabs = await chrome.tabs.query({ currentWindow: true });
        currentIndexMap.clear();
        for (const tab of updatedTabs) {
          if (tab.id !== undefined) {
            currentIndexMap.set(tab.id, tab.index);
          }
        }
      } catch {
        // タブが存在しない場合などのエラーは無視
      }
    }
  }
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
  // ローカル更新中フラグ（storage.onChangedからの更新をスキップするため）
  const isLocalUpdateRef = useRef<boolean>(false);
  const [tabInfoMap, setTabInfoMap] = useState<TabInfoMap>({});
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const [viewActiveTabIds, setViewActiveTabIds] = useState<Record<string, number>>({});

  const loadGroups = React.useCallback(async () => {
    try {
      const result = await chrome.storage.local.get('groups');
      if (result.groups) {
        setGroups(result.groups);
      }
    } catch {
      // グループ読み込みエラーは無視（ストレージが空の場合など）
    }
  }, []);

  const loadUnreadTabs = React.useCallback(async () => {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.UNREAD_TABS);
      if (result[STORAGE_KEYS.UNREAD_TABS]) {
        setUnreadTabIds(new Set(result[STORAGE_KEYS.UNREAD_TABS]));
      }
    } catch {
      // 未読タブ読み込みエラーは無視（ストレージが空の場合など）
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
      const persistedTitles: Record<number, string> = storedTitlesResult[STORAGE_KEYS.TAB_TITLES] || {};

      const storedFaviconsResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_FAVICONS);
      // ファビコンはURLベースで保存されている（ブラウザ再起動後もtabIdが変わっても復元可能）
      const persistedFavicons: Record<string, string> = storedFaviconsResult[STORAGE_KEYS.TAB_FAVICONS] || {};

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
    await chrome.storage.local.set({ groups: newGroups });
  }, []);

  const loadTreeState = React.useCallback(async () => {
    try {
      const result = await chrome.storage.local.get('tree_state');
      if (result.tree_state && Object.keys(result.tree_state.nodes).length > 0) {
        const reconstructedState = reconstructChildrenReferences(result.tree_state);
        setTreeState(reconstructedState);
      } else {
        try {
          await chrome.runtime.sendMessage({ type: 'SYNC_TABS' });

          // 同期完了を待つために少し待機してから再読み込み
          await new Promise(resolve => setTimeout(resolve, 500));

          const syncedResult = await chrome.storage.local.get('tree_state');
          if (syncedResult.tree_state) {
            const reconstructedState = reconstructChildrenReferences(syncedResult.tree_state);
            setTreeState(reconstructedState);
          } else {
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
        } catch {
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
    const initializeTreeState = async () => {
      setIsLoading(true);
      await Promise.all([loadTreeState(), loadGroups(), loadUnreadTabs(), loadActiveTab(), loadTabInfoMap(), loadCurrentWindowId()]);
      setIsLoading(false);
    };

    initializeTreeState();
  }, [loadTreeState, loadGroups, loadUnreadTabs, loadActiveTab, loadTabInfoMap, loadCurrentWindowId]);

  useEffect(() => {
    // STATE_UPDATEDメッセージ処理のシリアライズ用フラグ
    // 並行して複数のSTATE_UPDATEDが来た場合、最新の1つだけを処理する
    let isProcessing = false;
    let pendingUpdate = false;

    const processStateUpdate = async () => {
      if (isProcessing) {
        pendingUpdate = true;
        return;
      }

      isProcessing = true;
      try {
        await loadTreeState();
        await loadTabInfoMap();
        await loadUnreadTabs();
        await loadGroups();
      } finally {
        isProcessing = false;
        if (pendingUpdate) {
          pendingUpdate = false;
          processStateUpdate();
        }
      }
    };

    const messageListener = (message: { type: string }) => {
      if (message.type === 'STATE_UPDATED') {
        processStateUpdate();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [loadTreeState, loadUnreadTabs, loadTabInfoMap, loadGroups]);

  useEffect(() => {
    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      setActiveTabId(activeInfo.tabId);
      // Note: アクティブタブ変更時に選択状態を解除しない
      // ツリー内でのタブクリックでもonActivatedが発火するため、
      // クリック時の選択操作と競合してしまう
      // 代わりに、新しいタブ作成時とタブ削除時にのみ選択を解除する

      // タブのビューを特定し、そのビューのアクティブタブとして記憶
      if (treeState) {
        const nodeId = treeState.tabToNode[activeInfo.tabId];
        const node = nodeId ? treeState.nodes[nodeId] : null;
        if (node) {
          setViewActiveTabIds(prev => ({
            ...prev,
            [node.viewId]: activeInfo.tabId,
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

  // Note: chrome.tabs.onUpdatedでのtabInfoMap更新は削除
  // 理由: STATE_UPDATEDメッセージ経由のloadTabInfoMap()との競合を防ぐため
  // 以前は直接イベントリスナーで差分更新し、STATE_UPDATEDで完全置換していたが、
  // 両者の実行順序が不定でtabInfoMapが不整合になる問題があった
  // ファビコンとタイトルの永続化はService Worker側で行われるため、ここでは不要

  // Note: chrome.tabs.onMoved, onDetached, onAttachedでのtabInfoMap更新は削除
  // 理由: Service WorkerがこれらのイベントでSTATE_UPDATEDを送信するため、
  // 直接更新とSTATE_UPDATED経由の更新が競合する問題があった
  // すべてのtabInfoMap更新はSTATE_UPDATED経由のloadTabInfoMap()で一元化

  useEffect(() => {
    const storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange }
    ) => {
      // ローカル更新中はスキップ（レースコンディション防止）
      if (isLocalUpdateRef.current) {
        return;
      }

      if (changes.tree_state && changes.tree_state.newValue) {
        const reconstructedState = reconstructChildrenReferences(changes.tree_state.newValue);
        setTreeState(reconstructedState);
      }
    };

    chrome.storage.onChanged.addListener(storageListener);

    return () => {
      chrome.storage.onChanged.removeListener(storageListener);
    };
  }, []);

  const updateTreeState = useCallback(async (state: TreeState) => {
    isLocalUpdateRef.current = true;
    try {
      setTreeState(state);
      await chrome.storage.local.set({ tree_state: state });
    } finally {
      // フラグをリセット（次のイベントループでストレージリスナーが完了した後）
      setTimeout(() => {
        isLocalUpdateRef.current = false;
      }, 0);
    }
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

  /**
   * ビュー切り替え
   * 現在のウィンドウのビューのみを切り替える（他のウィンドウには影響しない）
   * 切り替え先ビューの最後にアクティブだったタブをChromeでアクティブにする
   */
  const switchView = useCallback(async (viewId: string) => {
    if (!treeState) return;

    // 現在のビューのアクティブタブを記憶（切り替え前）
    // React state更新が非同期のため、handleTabActivatedでの記憶が間に合わない場合の対策
    if (activeTabId !== null) {
      const currentNodeId = treeState.tabToNode[activeTabId];
      const currentNode = currentNodeId ? treeState.nodes[currentNodeId] : null;
      if (currentNode && currentNode.viewId === currentViewId) {
        setViewActiveTabIds(prev => ({
          ...prev,
          [currentViewId]: activeTabId,
        }));
      }
    }

    // ウィンドウ毎のビューを更新
    const newCurrentViewByWindowId = {
      ...(treeState.currentViewByWindowId || {}),
    };
    if (currentWindowId !== null) {
      newCurrentViewByWindowId[currentWindowId] = viewId;
    }

    const newState: TreeState = {
      ...treeState,
      currentViewByWindowId: newCurrentViewByWindowId,
      // グローバルなcurrentViewIdも常に更新（ブラウザ再起動後の復元用）
      currentViewId: viewId,
    };
    updateTreeState(newState);

    // 切り替え先ビューのタブをアクティブにする
    // Note: setViewActiveTabIds は非同期なので、最新値を使うために直接計算
    let tabIdToActivate = viewActiveTabIds[viewId];

    if (tabIdToActivate !== undefined) {
      // 記憶されたアクティブタブが存在し、まだそのビューに属しているか確認
      const nodeId = treeState.tabToNode[tabIdToActivate];
      const node = nodeId ? treeState.nodes[nodeId] : null;
      // さらに現在のウィンドウに属しているかも確認
      const tabInfo = tabInfoMap[tabIdToActivate];
      const isInCurrentWindow = currentWindowId === null || (tabInfo && tabInfo.windowId === currentWindowId);
      if (node && node.viewId === viewId && isInCurrentWindow) {
        try {
          await chrome.tabs.update(tabIdToActivate, { active: true });
          return;
        } catch {
          // タブが存在しない場合は無視してフォールバック
        }
      }
    }

    // 記憶されたタブがない、または既に別ビューに移動している場合は、
    // そのビューの最初のタブをアクティブにする（現在のウィンドウのみ）
    const viewTabs = Object.values(treeState.nodes)
      .filter(node => {
        if (node.viewId !== viewId) return false;
        // 現在のウィンドウのタブのみを対象にする
        if (currentWindowId !== null) {
          const tabInfo = tabInfoMap[node.tabId];
          if (tabInfo && tabInfo.windowId !== currentWindowId) return false;
        }
        return true;
      })
      .map(node => node.tabId);

    if (viewTabs.length > 0) {
      try {
        await chrome.tabs.update(viewTabs[0], { active: true });
      } catch {
        // タブが存在しない場合は無視
      }
    }
    // ビューにタブがない場合は何もしない（アクティブタブは変更しない）
  }, [treeState, updateTreeState, viewActiveTabIds, activeTabId, currentViewId, currentWindowId, tabInfoMap]);

  const createView = useCallback(() => {
    if (!treeState) return;

    const colorIndex = treeState.views.length % VIEW_COLOR_PALETTE.length;
    const newColor = VIEW_COLOR_PALETTE[colorIndex];

    const newViewId = `view_${Date.now()}`;
    const newView: View = {
      id: newViewId,
      name: 'View',
      color: newColor,
    };

    const newState: TreeState = {
      ...treeState,
      views: [...treeState.views, newView],
    };
    updateTreeState(newState);
  }, [treeState, updateTreeState]);

  /**
   * ビューを削除
   * 削除されるビューのタブは配列上の前のビューに移動
   * 削除されるビューを表示していたウィンドウは移動先ビューに切り替え
   */
  const deleteView = useCallback((viewId: string) => {
    if (!treeState) return;

    if (viewId === 'default') return;

    const viewIndex = treeState.views.findIndex(v => v.id === viewId);
    if (viewIndex === -1) return;

    const targetViewId = viewIndex > 0
      ? treeState.views[viewIndex - 1].id
      : 'default';

    const updatedNodes = { ...treeState.nodes };
    for (const nodeId of Object.keys(updatedNodes)) {
      const node = updatedNodes[nodeId];
      if (node.viewId === viewId) {
        updatedNodes[nodeId] = {
          ...node,
          viewId: targetViewId,
          parentId: null,
        };
      }
    }

    const newViews = treeState.views.filter(v => v.id !== viewId);

    const newCurrentViewId = treeState.currentViewId === viewId
      ? targetViewId
      : treeState.currentViewId;

    // 削除されるビューを表示していたウィンドウを移動先ビューに切り替え
    const newCurrentViewByWindowId: Record<number, string> = {};
    if (treeState.currentViewByWindowId) {
      for (const [windowIdStr, windowViewId] of Object.entries(treeState.currentViewByWindowId)) {
        const windowId = parseInt(windowIdStr);
        newCurrentViewByWindowId[windowId] = windowViewId === viewId
          ? targetViewId
          : windowViewId;
      }
    }

    const newState: TreeState = {
      ...treeState,
      views: newViews,
      nodes: updatedNodes,
      currentViewId: newCurrentViewId,
      currentViewByWindowId: Object.keys(newCurrentViewByWindowId).length > 0
        ? newCurrentViewByWindowId
        : undefined,
    };
    updateTreeState(newState);
  }, [treeState, updateTreeState]);

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
  }, [treeState, updateTreeState]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id || !treeState) {
        return;
      }

      const activeId = active.id as string;
      const overId = over.id as string;

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

      const isDescendant = (ancestorId: string, descendantId: string, nodes: Record<string, TabNode>): boolean => {
        const ancestor = nodes[ancestorId];
        if (!ancestor) return false;

        for (const child of ancestor.children) {
          if (child.id === descendantId) return true;
          if (isDescendant(child.id, descendantId, nodes)) return true;
        }

        return false;
      };

      // ドラッグ中のノードが選択に含まれているかチェック
      const isActiveNodeSelected = selectedNodeIds.has(activeId);
      // 移動対象のノードID一覧（選択されていれば全選択ノード、そうでなければアクティブノードのみ）
      const nodesToMove = isActiveNodeSelected ? Array.from(selectedNodeIds) : [activeId];
      const nodesToMoveSet = new Set(nodesToMove);

      // 移動先が移動対象のノードの子孫でないかチェック
      for (const nodeId of nodesToMove) {
        if (isDescendant(nodeId, overId, treeState.nodes)) {
          return;
        }
      }

      const updatedNodes: Record<string, TabNode> = {};
      Object.entries(treeState.nodes).forEach(([id, node]) => {
        updatedNodes[id] = {
          ...node,
          children: [],
        };
      });

      // 移動対象ノードの親IDを更新
      for (const nodeId of nodesToMove) {
        const node = updatedNodes[nodeId];
        if (node) {
          node.parentId = overId;
        }
      }

      // 子配列を再構築
      Object.entries(treeState.nodes).forEach(([parentId, originalNode]) => {
        const parent = updatedNodes[parentId];
        if (!parent) return;

        if (parentId === overId) {
          // 移動先の親の場合：既存の子から移動対象を除き、最後に移動対象を追加
          for (const originalChild of originalNode.children) {
            const childId = originalChild.id;
            const child = updatedNodes[childId];
            if (child && child.parentId === parentId && !nodesToMoveSet.has(childId)) {
              parent.children.push(child);
            }
          }
          // 移動対象ノードを元のツリー順序で追加
          for (const nodeId of nodesToMove) {
            const node = updatedNodes[nodeId];
            if (node && node.parentId === overId) {
              parent.children.push(node);
            }
          }
        } else {
          for (const originalChild of originalNode.children) {
            const childId = originalChild.id;
            const child = updatedNodes[childId];
            if (child && child.parentId === parentId) {
              parent.children.push(child);
            }
          }
        }
      });

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

      Object.values(updatedNodes).forEach((node) => {
        node.depth = calculateDepth(node.id);
      });

      const updatedOverNode = updatedNodes[overId];
      updatedOverNode.isExpanded = true;

      const updatedTabToNode = { ...treeState.tabToNode };

      // viewNodeOrderを更新（移動対象がルートだった場合、viewNodeOrderから削除）
      const updatedViewNodeOrder: Record<string, string[]> = {};
      if (treeState.viewNodeOrder) {
        Object.entries(treeState.viewNodeOrder).forEach(([viewId, nodeIds]) => {
          updatedViewNodeOrder[viewId] = nodeIds.filter(id => !nodesToMoveSet.has(id));
        });
      }

      const newTreeState = {
        ...treeState,
        nodes: updatedNodes,
        tabToNode: updatedTabToNode,
        viewNodeOrder: updatedViewNodeOrder,
      };

      await updateTreeState(newTreeState);

      try {
        await syncTreeToChromeTabs(updatedNodes, currentViewId, tabInfoMap, updatedViewNodeOrder);
      } catch {
        // タブ同期エラーは無視（タブが既に閉じられている場合など）
      }

      chrome.runtime.sendMessage({ type: 'REFRESH_TREE_STRUCTURE' }).catch(() => {
        // リスナーが存在しない場合のエラーは無視
      });
    },
    [treeState, updateTreeState, tabInfoMap, selectedNodeIds, currentViewId]
  );

  /**
   * 兄弟としてドロップ（Gapドロップ）時のハンドラ
   * タブを兄弟として指定位置に挿入する
   */
  const handleSiblingDrop = useCallback(
    async (info: SiblingDropInfo) => {
      const { activeNodeId, insertIndex: _insertIndex, aboveNodeId, belowNodeId } = info;

      if (!treeState) {
        return;
      }

      const activeNode = treeState.nodes[activeNodeId];
      if (!activeNode) {
        return;
      }

      const isActiveNodeSelected = selectedNodeIds.has(activeNodeId);
      const nodesToMove = isActiveNodeSelected ? Array.from(selectedNodeIds) : [activeNodeId];
      const nodesToMoveSet = new Set(nodesToMove);

      let targetParentId: string | null = null;

      if (belowNodeId && treeState.nodes[belowNodeId]) {
        targetParentId = treeState.nodes[belowNodeId].parentId;
      } else if (aboveNodeId && treeState.nodes[aboveNodeId]) {
        targetParentId = treeState.nodes[aboveNodeId].parentId;
      }

      if (targetParentId) {
        const isDescendantFn = (ancestorId: string, descendantId: string): boolean => {
          const ancestor = treeState.nodes[ancestorId];
          if (!ancestor) return false;

          for (const child of ancestor.children) {
            if (child.id === descendantId) return true;
            if (isDescendantFn(child.id, descendantId)) return true;
          }

          return false;
        };

        for (const nodeId of nodesToMove) {
          if (isDescendantFn(nodeId, targetParentId)) {
            return;
          }
        }
      }

      const updatedNodes: Record<string, TabNode> = {};
      Object.entries(treeState.nodes).forEach(([id, node]) => {
        updatedNodes[id] = {
          ...node,
          children: [],
        };
      });

      for (const nodeId of nodesToMove) {
        const node = updatedNodes[nodeId];
        if (node) {
          node.parentId = targetParentId;
        }
      }

      Object.entries(treeState.nodes).forEach(([parentId, originalNode]) => {
        const parent = updatedNodes[parentId];
        if (!parent) return;

        for (const originalChild of originalNode.children) {
          const childId = originalChild.id;
          if (nodesToMoveSet.has(childId)) continue;
          const child = updatedNodes[childId];
          if (child && child.parentId === parentId) {
            parent.children.push(child);
          }
        }
      });

      const sortedNodesToMove = [...nodesToMove].sort((a, b) => {
        const tabInfoA = tabInfoMap[treeState.nodes[a]?.tabId];
        const tabInfoB = tabInfoMap[treeState.nodes[b]?.tabId];
        return (tabInfoA?.index ?? 0) - (tabInfoB?.index ?? 0);
      });

      const nodesToInsert = sortedNodesToMove.map(id => updatedNodes[id]).filter(Boolean);

      if (targetParentId) {
        const targetParent = updatedNodes[targetParentId];
        if (targetParent) {
          if (belowNodeId) {
            const belowNode = updatedNodes[belowNodeId];
            if (belowNode && belowNode.parentId === targetParentId) {
              const insertIndex = targetParent.children.findIndex(c => c.id === belowNodeId);
              if (insertIndex !== -1) {
                targetParent.children.splice(insertIndex, 0, ...nodesToInsert);
              } else {
                targetParent.children.push(...nodesToInsert);
              }
            } else {
              targetParent.children.push(...nodesToInsert);
            }
          } else if (aboveNodeId) {
            const aboveNode = updatedNodes[aboveNodeId];
            if (aboveNode && aboveNode.parentId === targetParentId) {
              const insertIndex = targetParent.children.findIndex(c => c.id === aboveNodeId);
              if (insertIndex !== -1) {
                targetParent.children.splice(insertIndex + 1, 0, ...nodesToInsert);
              } else {
                targetParent.children.push(...nodesToInsert);
              }
            } else {
              targetParent.children.push(...nodesToInsert);
            }
          } else {
            targetParent.children.push(...nodesToInsert);
          }
        }
      }

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

      Object.values(updatedNodes).forEach((node) => {
        node.depth = calculateDepth(node.id);
      });

      const updatedTabToNode = { ...treeState.tabToNode };

      // viewNodeOrderを更新
      const updatedViewNodeOrder: Record<string, string[]> = {};
      if (treeState.viewNodeOrder) {
        Object.entries(treeState.viewNodeOrder).forEach(([viewId, nodeIds]) => {
          // まず移動対象を除外
          updatedViewNodeOrder[viewId] = nodeIds.filter(id => !nodesToMoveSet.has(id));
        });
      }

      // ルートレベルへのドロップの場合、viewNodeOrderに挿入位置を反映
      if (!targetParentId) {
        const viewOrderArray = updatedViewNodeOrder[currentViewId] || [];

        if (belowNodeId) {
          // belowNodeIdの前に挿入
          const insertIndex = viewOrderArray.indexOf(belowNodeId);
          if (insertIndex !== -1) {
            viewOrderArray.splice(insertIndex, 0, ...sortedNodesToMove);
          } else {
            viewOrderArray.push(...sortedNodesToMove);
          }
        } else if (aboveNodeId) {
          // aboveNodeIdの後に挿入
          const insertIndex = viewOrderArray.indexOf(aboveNodeId);
          if (insertIndex !== -1) {
            viewOrderArray.splice(insertIndex + 1, 0, ...sortedNodesToMove);
          } else {
            viewOrderArray.push(...sortedNodesToMove);
          }
        } else {
          // 末尾に追加
          viewOrderArray.push(...sortedNodesToMove);
        }

        updatedViewNodeOrder[currentViewId] = viewOrderArray;
      }

      const newTreeState = {
        ...treeState,
        nodes: updatedNodes,
        tabToNode: updatedTabToNode,
        viewNodeOrder: updatedViewNodeOrder,
      };

      await updateTreeState(newTreeState);

      try {
        const collectSubtreeTabIds = (node: TabNode): number[] => {
          const result: number[] = [node.tabId];
          for (const child of node.children) {
            result.push(...collectSubtreeTabIds(child));
          }
          return result;
        };

        const allSubtreeTabIds: number[] = [];
        for (const nodeId of sortedNodesToMove) {
          const node = updatedNodes[nodeId];
          if (node) {
            allSubtreeTabIds.push(...collectSubtreeTabIds(node));
          }
        }

        const movingTabIndexes = allSubtreeTabIds
          .map(tabId => tabInfoMap[tabId]?.index ?? 0)
          .sort((a, b) => a - b);

        let targetChromeIndex: number;

        if (belowNodeId && updatedNodes[belowNodeId]) {
          const belowNode = updatedNodes[belowNodeId];
          const belowTabInfo = tabInfoMap[belowNode.tabId];
          let belowIndex = belowTabInfo?.index ?? 0;
          const countBefore = movingTabIndexes.filter(idx => idx < belowIndex).length;
          belowIndex -= countBefore;
          targetChromeIndex = belowIndex;
        } else if (aboveNodeId && updatedNodes[aboveNodeId]) {
          const aboveNode = updatedNodes[aboveNodeId];
          const aboveTabInfo = tabInfoMap[aboveNode.tabId];
          let aboveIndex = aboveTabInfo?.index ?? 0;
          const countBefore = movingTabIndexes.filter(idx => idx <= aboveIndex).length;
          aboveIndex -= countBefore;
          targetChromeIndex = aboveIndex + 1;
        } else {
          targetChromeIndex = movingTabIndexes.length > 0 ? movingTabIndexes[0] : 0;
        }

        const tabsToMove = allSubtreeTabIds.filter(tabId => !tabInfoMap[tabId]?.isPinned);
        if (tabsToMove.length > 0) {
          if (!belowNodeId) {
            for (const tabId of tabsToMove) {
              try {
                await chrome.tabs.move(tabId, { index: -1 });
              } catch {
                // タブが存在しない場合などのエラーは無視
              }
            }
          } else {
            for (let i = tabsToMove.length - 1; i >= 0; i--) {
              const tabId = tabsToMove[i];
              try {
                await chrome.tabs.move(tabId, { index: targetChromeIndex });
              } catch {
                // タブが存在しない場合などのエラーは無視
              }
            }
          }
        }
      } catch {
        // 同期に失敗してもツリー状態の更新は維持する
      }

      chrome.runtime.sendMessage({ type: 'REFRESH_TREE_STRUCTURE' }).catch((_error) => {
        // リスナーが存在しない場合のエラーは無視
      });
    },
    [treeState, updateTreeState, tabInfoMap, selectedNodeIds, currentViewId]
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

  const deleteGroup = useCallback((groupId: string) => {
    const newGroups = { ...groups };
    delete newGroups[groupId];
    saveGroups(newGroups);

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

  const updateGroupFn = useCallback((groupId: string, updates: Partial<Group>) => {
    const group = groups[groupId];
    if (!group) return;

    const updatedGroup = { ...group, ...updates };
    const newGroups = { ...groups, [groupId]: updatedGroup };
    saveGroups(newGroups);
  }, [groups, saveGroups]);

  const toggleGroupExpanded = useCallback((groupId: string) => {
    const group = groups[groupId];
    if (!group) return;

    const updatedGroup = { ...group, isExpanded: !group.isExpanded };
    const newGroups = { ...groups, [groupId]: updatedGroup };
    saveGroups(newGroups);
  }, [groups, saveGroups]);

  const addTabToGroup = useCallback((nodeId: string, groupId: string) => {
    if (!treeState) return;

    const node = treeState.nodes[nodeId];
    if (!node) return;

    const groupNode = treeState.nodes[groupId];
    const groupDepth = groupNode?.depth ?? 0;

    const updatedNodes = { ...treeState.nodes };
    updatedNodes[nodeId] = {
      ...node,
      groupId,
      parentId: groupId,
      depth: groupDepth + 1,
    };

    if (groupNode) {
      const updatedGroupNode = {
        ...groupNode,
        children: [...groupNode.children, updatedNodes[nodeId]],
      };
      updatedNodes[groupId] = updatedGroupNode;
    }

    updateTreeState({ ...treeState, nodes: updatedNodes });
  }, [treeState, updateTreeState]);

  const removeTabFromGroup = useCallback((nodeId: string) => {
    if (!treeState) return;

    const node = treeState.nodes[nodeId];
    if (!node) return;

    const updatedNodes = { ...treeState.nodes };

    if (node.groupId && updatedNodes[node.groupId]) {
      const groupNode = updatedNodes[node.groupId];
      const updatedGroupNode = {
        ...groupNode,
        children: groupNode.children.filter((child) => child.id !== nodeId),
      };
      updatedNodes[node.groupId] = updatedGroupNode;
    }

    const updatedNode = {
      ...node,
      groupId: undefined,
      parentId: null,
      depth: 0,
    };
    updatedNodes[nodeId] = updatedNode;

    updateTreeState({ ...treeState, nodes: updatedNodes });
  }, [treeState, updateTreeState]);

  const getGroupTabCount = useCallback((groupId: string): number => {
    if (!treeState) return 0;

    return Object.values(treeState.nodes).filter(
      (node) => node.groupId === groupId
    ).length;
  }, [treeState]);

  const isTabUnread = useCallback((tabId: number): boolean => {
    return unreadTabIds.has(tabId);
  }, [unreadTabIds]);

  const getUnreadCount = useCallback((): number => {
    return unreadTabIds.size;
  }, [unreadTabIds]);

  /**
   * 指定ノードの子孫の未読タブ数を取得
   */
  const getUnreadChildCount = useCallback((nodeId: string): number => {
    if (!treeState) return 0;

    const node = treeState.nodes[nodeId];
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
  }, [treeState, unreadTabIds]);

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
          const nodeId = treeState.tabToNode[tabInfo.id];
          const node = nodeId ? treeState.nodes[nodeId] : null;
          if (node && node.viewId !== currentViewId) {
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
      await chrome.tabs.move(tabId, { index: newIndex });
    } catch (error) {
      console.error('Failed to reorder pinned tab:', error);
    }
  }, [currentWindowId]);

  const selectNode = useCallback((nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => {
    if (!treeState) return;

    if (!treeState.nodes[nodeId]) return;

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
      // ツリー表示順（深さ優先探索順）でノードを取得する
      // Chromeのタブインデックスではなく、実際の表示順序を使用
      const pinnedTabIdSet = new Set(pinnedTabIds);
      const currentWindowTabIds = new Set<number>();
      if (currentWindowId !== null) {
        Object.values(tabInfoMap).forEach(tabInfo => {
          if (tabInfo.windowId === currentWindowId) {
            currentWindowTabIds.add(tabInfo.id);
          }
        });
      }

      // 現在のビューのルートノードを取得してviewNodeOrderでソート
      const rootNodesInView = Object.values(treeState.nodes)
        .filter(node => {
          if (pinnedTabIdSet.has(node.tabId)) return false;
          if (currentWindowId !== null && !currentWindowTabIds.has(node.tabId)) return false;
          if (node.viewId !== currentViewId) return false;
          // 親がいない、または親がフィルタリングされた場合はルートとして扱う
          if (!node.parentId) return true;
          const parent = treeState.nodes[node.parentId];
          if (!parent) return true;
          if (pinnedTabIdSet.has(parent.tabId)) return true;
          if (currentWindowId !== null && !currentWindowTabIds.has(parent.tabId)) return true;
          return false;
        });

      // viewNodeOrderを使用してソート（buildTreeと同じ順序）
      const nodeOrderArray = treeState.viewNodeOrder?.[currentViewId] ?? [];
      const nodeOrderMap = new Map(nodeOrderArray.map((id, index) => [id, index]));
      rootNodesInView.sort((a, b) => {
        const indexA = nodeOrderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
        const indexB = nodeOrderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
        return indexA - indexB;
      });

      // 深さ優先探索順でノードIDを収集
      const nodeIdsInDisplayOrder: string[] = [];
      const collectNodesInOrder = (node: TabNode) => {
        // フィルタリング対象のノードはスキップ
        if (pinnedTabIdSet.has(node.tabId)) return;
        if (currentWindowId !== null && !currentWindowTabIds.has(node.tabId)) return;
        if (!tabInfoMap[node.tabId]) return;

        nodeIdsInDisplayOrder.push(node.id);

        // 展開されている場合のみ子ノードを収集
        if (node.isExpanded && node.children) {
          for (const child of node.children) {
            const childNode = treeState.nodes[child.id];
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
  }, [treeState, lastSelectedNodeId, tabInfoMap, pinnedTabIds, currentWindowId, currentViewId]);

  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setLastSelectedNodeId(null);
  }, []);

  const isNodeSelected = useCallback((nodeId: string): boolean => {
    return selectedNodeIds.has(nodeId);
  }, [selectedNodeIds]);

  const getSelectedTabIds = useCallback((): number[] => {
    if (!treeState) return [];

    const tabIds: number[] = [];
    for (const nodeId of selectedNodeIds) {
      const node = treeState.nodes[nodeId];
      if (node) {
        tabIds.push(node.tabId);
      }
    }
    return tabIds;
  }, [treeState, selectedNodeIds]);

  /**
   * 実際に存在するタブのみをカウント
   * - currentWindowIdでフィルタリング（現在のウィンドウのタブのみ）
   * - ピン留めタブも含む
   */
  const viewTabCounts = useMemo((): Record<string, number> => {
    if (!treeState) return {};

    const counts: Record<string, number> = {};

    Object.values(treeState.nodes).forEach((node) => {
      const tabInfo = tabInfoMap[node.tabId];
      if (tabInfo) {
        // 現在のウィンドウのタブのみカウント（ピン留めタブも含む）
        if (currentWindowId !== null && tabInfo.windowId !== currentWindowId) return;

        const viewId = node.viewId;
        counts[viewId] = (counts[viewId] || 0) + 1;
      }
    });

    return counts;
  }, [treeState, tabInfoMap, currentWindowId]);

  const moveTabsToView = useCallback(async (viewId: string, tabIds: number[]) => {
    if (!treeState) return;

    const updatedNodes = { ...treeState.nodes };

    // サブツリー全体を収集する関数
    const collectSubtreeNodeIds = (nodeId: string): string[] => {
      const result: string[] = [nodeId];
      const node = updatedNodes[nodeId];
      if (node && node.children) {
        for (const child of node.children) {
          result.push(...collectSubtreeNodeIds(child.id));
        }
      }
      return result;
    };

    // 移動対象のタブとそのサブツリー全体を収集
    const allNodeIdsToMove = new Set<string>();
    tabIds.forEach(tabId => {
      const nodeId = treeState.tabToNode[tabId];
      if (nodeId && updatedNodes[nodeId]) {
        const subtreeNodeIds = collectSubtreeNodeIds(nodeId);
        subtreeNodeIds.forEach(id => allNodeIdsToMove.add(id));
      }
    });

    // 収集したすべてのノードのviewIdを更新
    // 最上位のノード（tabIdsで直接指定されたもの）のみparentIdをnullにする
    tabIds.forEach(tabId => {
      const nodeId = treeState.tabToNode[tabId];
      if (nodeId && updatedNodes[nodeId]) {
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          viewId,
          parentId: null,
        };
      }
    });

    // サブツリー内のすべてのノードのviewIdを更新（親子関係は維持）
    allNodeIdsToMove.forEach(nodeId => {
      if (updatedNodes[nodeId]) {
        // 最上位のノードは既に上で処理済みなのでスキップ
        const node = updatedNodes[nodeId];
        const tabId = node.tabId;
        if (!tabIds.includes(tabId)) {
          updatedNodes[nodeId] = {
            ...updatedNodes[nodeId],
            viewId,
          };
        }
      }
    });

    Object.values(updatedNodes).forEach(node => {
      node.children = [];
    });
    Object.entries(updatedNodes).forEach(([id, node]) => {
      if (node.parentId && updatedNodes[node.parentId]) {
        const parent = updatedNodes[node.parentId];
        const child = updatedNodes[id];
        if (child && !parent.children.some(c => c.id === id)) {
          parent.children.push(child);
        }
      }
    });

    const calculateDepth = (nodeId: string, visited: Set<string> = new Set()): number => {
      if (visited.has(nodeId)) return 0;
      visited.add(nodeId);
      const node = updatedNodes[nodeId];
      if (!node || !node.parentId) return 0;
      return calculateDepth(node.parentId, visited) + 1;
    };

    Object.values(updatedNodes).forEach(node => {
      node.depth = calculateDepth(node.id);
    });

    // treeStructureも同期的に更新（Chrome終了時にviewIdが失われることを防ぐ）
    // REFRESH_TREE_STRUCTUREは非同期で処理されるため、その前にChromeが終了すると
    // treeStructureには古いviewIdが残ってしまう問題を解決
    const updatedTreeStructure = treeState.treeStructure?.map(entry => {
      // 移動対象のタブのURLを検索し、マッチしたらviewIdを更新
      const matchingNode = Object.values(updatedNodes).find(node => {
        const tabInfo = tabInfoMap[node.tabId];
        return tabInfo && tabInfo.url === entry.url && allNodeIdsToMove.has(node.id);
      });
      if (matchingNode) {
        return { ...entry, viewId };
      }
      return entry;
    });

    const newTreeState = {
      ...treeState,
      nodes: updatedNodes,
      treeStructure: updatedTreeStructure,
    };

    // ストレージへの保存を待ってからREFRESH_TREE_STRUCTUREを送信
    await updateTreeState(newTreeState);

    // Service Workerにツリー構造の更新を通知
    // treeStructureを再構築して他の属性（parentIndex, isExpanded等）も更新する
    chrome.runtime.sendMessage({ type: 'REFRESH_TREE_STRUCTURE' }).catch(() => {
      // リスナーが存在しない場合のエラーは無視
    });
  }, [treeState, updateTreeState, tabInfoMap]);

  return (
    <TreeStateContext.Provider
      value={{
        treeState,
        isLoading,
        error,
        updateTreeState,
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
