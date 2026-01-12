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
  moveTabsToView: (viewId: string, tabIds: number[]) => void;
  currentWindowId: number | null;
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

  return {
    ...treeState,
    views,
    currentViewId,
    nodes: reconstructedNodes,
  };
}

/**
 * ツリーを深さ優先でフラット化
 * 親子関係を維持したまま、深さ優先順序でタブIDのリストを返す
 * ピン留めタブは除外する
 * ルートノードはtabInfoMapのインデックスでソート（buildTreeと同じ順序）
 */
function flattenTreeDFS(
  nodes: Record<string, TabNode>,
  currentViewId: string,
  pinnedTabIds: Set<number>,
  tabInfoMap: Record<number, { index: number }>
): number[] {
  const result: number[] = [];

  const rootNodes = Object.values(nodes).filter(
    (node) => node.parentId === null && node.viewId === currentViewId
  );

  rootNodes.sort((a, b) => {
    const indexA = tabInfoMap[a.tabId]?.index ?? Number.MAX_SAFE_INTEGER;
    const indexB = tabInfoMap[b.tabId]?.index ?? Number.MAX_SAFE_INTEGER;
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
  tabInfoMap: Record<number, { index: number; isPinned: boolean }>
): Promise<void> {
  const pinnedSet = new Set<number>();
  for (const [tabIdStr, info] of Object.entries(tabInfoMap)) {
    if (info.isPinned) {
      pinnedSet.add(parseInt(tabIdStr));
    }
  }

  const orderedTabIds = flattenTreeDFS(nodes, currentViewId, pinnedSet, tabInfoMap);

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
      const persistedFavicons: Record<number, string> = storedFaviconsResult[STORAGE_KEYS.TAB_FAVICONS] || {};

      const tabs = await chrome.tabs.query({});
      const newTabInfoMap: TabInfoMap = {};
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          // 永続化されたタイトルがあればそれを使用
          // タブがローディング中でChromeからのタイトルが空の場合に特に有効
          const persistedTitle = persistedTitles[tab.id];
          const title = tab.title || persistedTitle || '';

          // 永続化されたファビコンがあればそれを使用（ブラウザ再起動後に有効）
          const persistedFavicon = persistedFavicons[tab.id];
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
    const messageListener = (message: { type: string }) => {
      if (message.type === 'STATE_UPDATED') {
        loadTreeState();
        loadUnreadTabs();
        loadTabInfoMap();
        loadGroups();
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
    const handleTabCreated = (tab: chrome.tabs.Tab) => {
      if (tab.id !== undefined) {
        setTabInfoMap(prev => ({
          ...prev,
          [tab.id as number]: {
            id: tab.id as number,
            title: tab.title || '',
            url: tab.url || '',
            favIconUrl: tab.favIconUrl,
            status: tab.status === 'loading' ? 'loading' : 'complete',
            isPinned: tab.pinned || false,
            windowId: tab.windowId,
            discarded: tab.discarded || false,
            index: tab.index,
          },
        }));
        setSelectedNodeIds(new Set());
        setLastSelectedNodeId(null);
      }
    };

    chrome.tabs.onCreated.addListener(handleTabCreated);

    return () => {
      chrome.tabs.onCreated.removeListener(handleTabCreated);
    };
  }, []);

  useEffect(() => {
    const handleTabRemoved = (tabId: number) => {
      setTabInfoMap(prev => {
        const newMap = { ...prev };
        delete newMap[tabId];
        return newMap;
      });
      setSelectedNodeIds(new Set());
      setLastSelectedNodeId(null);
    };

    chrome.tabs.onRemoved.addListener(handleTabRemoved);

    return () => {
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
    };
  }, []);

  useEffect(() => {
    const handleTabUpdated = async (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      // タイトル、ファビコン、URL、ピン状態、discarded状態のいずれかが変更された場合のみ更新
      // Note: status単体の変更では新規エントリを作成しない（余分なLoadingタブ防止）
      if (changeInfo.title !== undefined || changeInfo.favIconUrl !== undefined || changeInfo.url !== undefined || changeInfo.pinned !== undefined || changeInfo.discarded !== undefined) {
        setTabInfoMap(prev => ({
          ...prev,
          [tabId]: {
            id: tabId,
            title: tab.title || prev[tabId]?.title || '',
            url: tab.url || prev[tabId]?.url || '',
            favIconUrl: tab.favIconUrl ?? prev[tabId]?.favIconUrl,
            status: tab.status === 'loading' ? 'loading' : 'complete',
            isPinned: tab.pinned ?? prev[tabId]?.isPinned ?? false,
            windowId: tab.windowId,
            discarded: tab.discarded ?? prev[tabId]?.discarded ?? false,
            index: tab.index,
          },
        }));

        if (changeInfo.favIconUrl !== undefined && changeInfo.favIconUrl !== null && changeInfo.favIconUrl !== '') {
          try {
            const storedResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_FAVICONS);
            const persistedFavicons: Record<number, string> = storedResult[STORAGE_KEYS.TAB_FAVICONS] || {};
            persistedFavicons[tabId] = changeInfo.favIconUrl;
            await chrome.storage.local.set({ [STORAGE_KEYS.TAB_FAVICONS]: persistedFavicons });
          } catch {
            // ファビコン永続化エラーは無視
          }
        }

        if (changeInfo.title !== undefined && changeInfo.title !== null && changeInfo.title !== '') {
          try {
            const storedResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_TITLES);
            const persistedTitles: Record<number, string> = storedResult[STORAGE_KEYS.TAB_TITLES] || {};
            persistedTitles[tabId] = changeInfo.title;
            await chrome.storage.local.set({ [STORAGE_KEYS.TAB_TITLES]: persistedTitles });
          } catch {
            // タイトル永続化エラーは無視
          }
        }
      }
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, []);

  useEffect(() => {
    const handleTabMoved = async (
      _tabId: number,
      moveInfo: chrome.tabs.TabMoveInfo
    ) => {
      // タブが移動されると、同じウィンドウ内の他のタブのインデックスも変更される
      // 最新のインデックスを取得して全タブを更新
      // 注意: 新規タブが作成されて即座に移動された場合、handleTabCreatedの
      // state更新がまだバッチ処理で適用されていない可能性があるため、
      // 既存タブの更新だけでなく、新規タブの追加も行う
      try {
        const tabs = await chrome.tabs.query({ windowId: moveInfo.windowId });
        setTabInfoMap(prev => {
          const newMap = { ...prev };
          for (const tab of tabs) {
            if (tab.id !== undefined) {
              if (newMap[tab.id]) {
                newMap[tab.id] = {
                  ...newMap[tab.id],
                  index: tab.index,
                };
              } else {
                newMap[tab.id] = {
                  id: tab.id,
                  title: tab.title || '',
                  url: tab.url || '',
                  favIconUrl: tab.favIconUrl,
                  status: tab.status === 'loading' ? 'loading' : 'complete',
                  isPinned: tab.pinned || false,
                  windowId: tab.windowId,
                  discarded: tab.discarded || false,
                  index: tab.index,
                };
              }
            }
          }
          return newMap;
        });

        loadTreeState();
      } catch {
        // タブインデックス更新エラーは無視
      }
    };

    chrome.tabs.onMoved.addListener(handleTabMoved);

    return () => {
      chrome.tabs.onMoved.removeListener(handleTabMoved);
    };
  }, [loadTreeState]);

  useEffect(() => {
    const handleTabDetached = (
      tabId: number,
      _detachInfo: chrome.tabs.TabDetachInfo
    ) => {
      setTabInfoMap(prev => {
        if (!prev[tabId]) return prev;
        return {
          ...prev,
          [tabId]: {
            ...prev[tabId],
            windowId: -1, // 一時的にウィンドウから外れた状態
          },
        };
      });
      loadTreeState();
      loadTabInfoMap();
    };

    chrome.tabs.onDetached.addListener(handleTabDetached);

    return () => {
      chrome.tabs.onDetached.removeListener(handleTabDetached);
    };
  }, [loadTreeState, loadTabInfoMap]);

  useEffect(() => {
    const handleTabAttached = async (
      tabId: number,
      attachInfo: chrome.tabs.TabAttachInfo
    ) => {
      setTabInfoMap(prev => {
        if (!prev[tabId]) return prev;
        return {
          ...prev,
          [tabId]: {
            ...prev[tabId],
            windowId: attachInfo.newWindowId,
            index: attachInfo.newPosition,
          },
        };
      });
      loadTreeState();
      loadTabInfoMap();
    };

    chrome.tabs.onAttached.addListener(handleTabAttached);

    return () => {
      chrome.tabs.onAttached.removeListener(handleTabAttached);
    };
  }, [loadTreeState, loadTabInfoMap]);

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
   * ビュー切り替え
   * 切り替え先ビューの最後にアクティブだったタブをChromeでアクティブにする
   */
  const switchView = useCallback(async (viewId: string) => {
    if (!treeState) return;

    // 現在のビューのアクティブタブを記憶（切り替え前）
    // React state更新が非同期のため、handleTabActivatedでの記憶が間に合わない場合の対策
    if (activeTabId !== null) {
      const currentNodeId = treeState.tabToNode[activeTabId];
      const currentNode = currentNodeId ? treeState.nodes[currentNodeId] : null;
      if (currentNode && currentNode.viewId === treeState.currentViewId) {
        setViewActiveTabIds(prev => ({
          ...prev,
          [treeState.currentViewId]: activeTabId,
        }));
      }
    }

    const newState: TreeState = {
      ...treeState,
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
      if (node && node.viewId === viewId) {
        try {
          await chrome.tabs.update(tabIdToActivate, { active: true });
          return;
        } catch {
          // タブが存在しない場合は無視してフォールバック
        }
      }
    }

    // 記憶されたタブがない、または既に別ビューに移動している場合は、
    // そのビューの最初のタブをアクティブにする
    const viewTabs = Object.values(treeState.nodes)
      .filter(node => node.viewId === viewId)
      .map(node => node.tabId);

    if (viewTabs.length > 0) {
      try {
        await chrome.tabs.update(viewTabs[0], { active: true });
      } catch {
        // タブが存在しない場合は無視
      }
    }
    // ビューにタブがない場合は何もしない（アクティブタブは変更しない）
  }, [treeState, updateTreeState, viewActiveTabIds, activeTabId]);

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

    const newState: TreeState = {
      ...treeState,
      views: newViews,
      nodes: updatedNodes,
      currentViewId: newCurrentViewId,
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

      const newTreeState = {
        ...treeState,
        nodes: updatedNodes,
        tabToNode: updatedTabToNode,
      };

      await updateTreeState(newTreeState);

      try {
        await syncTreeToChromeTabs(updatedNodes, treeState.currentViewId, tabInfoMap);
      } catch {
        // タブ同期エラーは無視（タブが既に閉じられている場合など）
      }

      chrome.runtime.sendMessage({ type: 'REFRESH_TREE_STRUCTURE' }).catch(() => {
        // リスナーが存在しない場合のエラーは無視
      });
    },
    [treeState, updateTreeState, tabInfoMap, selectedNodeIds]
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

      const newTreeState = {
        ...treeState,
        nodes: updatedNodes,
        tabToNode: updatedTabToNode,
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
    [treeState, updateTreeState, tabInfoMap, selectedNodeIds]
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
        return tabInfo.isPinned;
      })
      .sort((a, b) => a.index - b.index)
      .map(tabInfo => tabInfo.id);
  }, [tabInfoMap, currentWindowId]);

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
      const nodeIds = Object.keys(treeState.nodes)
        .filter(id => treeState.nodes[id] && tabInfoMap[treeState.nodes[id].tabId])
        .sort((a, b) => {
          const indexA = tabInfoMap[treeState.nodes[a].tabId]?.index ?? Number.MAX_SAFE_INTEGER;
          const indexB = tabInfoMap[treeState.nodes[b].tabId]?.index ?? Number.MAX_SAFE_INTEGER;
          return indexA - indexB;
        });
      const lastIndex = nodeIds.indexOf(lastSelectedNodeId);
      const currentIndex = nodeIds.indexOf(nodeId);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const startIndex = Math.min(lastIndex, currentIndex);
        const endIndex = Math.max(lastIndex, currentIndex);
        const rangeNodeIds = nodeIds.slice(startIndex, endIndex + 1);
        setSelectedNodeIds(new Set(rangeNodeIds));
      } else {
        setSelectedNodeIds(new Set([nodeId]));
        setLastSelectedNodeId(nodeId);
      }
    } else {
      setSelectedNodeIds(new Set([nodeId]));
      setLastSelectedNodeId(nodeId);
    }
  }, [treeState, lastSelectedNodeId, tabInfoMap]);

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
   */
  const viewTabCounts = useMemo((): Record<string, number> => {
    if (!treeState) return {};

    const counts: Record<string, number> = {};

    Object.values(treeState.nodes).forEach((node) => {
      if (tabInfoMap[node.tabId]) {
        const viewId = node.viewId;
        counts[viewId] = (counts[viewId] || 0) + 1;
      }
    });

    return counts;
  }, [treeState, tabInfoMap]);

  const moveTabsToView = useCallback((viewId: string, tabIds: number[]) => {
    if (!treeState) return;

    const updatedNodes = { ...treeState.nodes };

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

    const newTreeState = {
      ...treeState,
      nodes: updatedNodes,
    };

    updateTreeState(newTreeState);
  }, [treeState, updateTreeState]);

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
      }}
    >
      {children}
    </TreeStateContext.Provider>
  );
};

export default TreeStateProvider;
