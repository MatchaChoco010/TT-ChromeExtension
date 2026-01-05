import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { TreeState, TabNode, View, Group, ExtendedTabInfo, TabInfoMap, SiblingDropInfo, DragEndEvent } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

interface TreeStateContextType {
  treeState: TreeState | null;
  isLoading: boolean;
  error: Error | null;
  updateTreeState: (state: TreeState) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  // 兄弟としてドロップ（Gapドロップ）時のハンドラ
  handleSiblingDrop: (info: SiblingDropInfo) => Promise<void>;
  // ビュー管理機能
  switchView: (viewId: string) => void;
  createView: () => void;
  deleteView: (viewId: string) => void;
  updateView: (viewId: string, updates: Partial<View>) => void;
  // グループ管理機能
  groups: Record<string, Group>;
  createGroup: (name: string, color: string) => string;
  deleteGroup: (groupId: string) => void;
  updateGroup: (groupId: string, updates: Partial<Group>) => void;
  toggleGroupExpanded: (groupId: string) => void;
  addTabToGroup: (nodeId: string, groupId: string) => void;
  removeTabFromGroup: (nodeId: string) => void;
  getGroupTabCount: (groupId: string) => number;
  // 未読状態管理機能
  unreadTabIds: Set<number>;
  isTabUnread: (tabId: number) => boolean;
  getUnreadCount: () => number;
  getUnreadChildCount: (nodeId: string) => number;
  // アクティブタブID
  activeTabId: number | null;
  // タブ情報マップ管理
  tabInfoMap: TabInfoMap;
  getTabInfo: (tabId: number) => ExtendedTabInfo | undefined;
  // ピン留めタブ専用リスト
  pinnedTabIds: number[];
  // ピン留めタブの並び替え
  handlePinnedTabReorder: (tabId: number, newIndex: number) => Promise<void>;
  // 複数選択状態管理
  selectedNodeIds: Set<string>;
  lastSelectedNodeId: string | null;
  selectNode: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  clearSelection: () => void;
  isNodeSelected: (nodeId: string) => boolean;
  // 選択されたすべてのタブIDを取得
  getSelectedTabIds: () => number[];
  // ビューごとのタブ数
  viewTabCounts: Record<string, number>;
  // タブをビューに移動
  moveTabsToView: (viewId: string, tabIds: number[]) => void;
  // 現在のウィンドウID（複数ウィンドウ対応）
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
  // 新しいノードオブジェクトを作成（children は空配列で初期化）
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

  // 第1段階: 保存されたchildren配列の順序で子を追加
  Object.entries(treeState.nodes).forEach(([parentId, parentNode]) => {
    const parent = reconstructedNodes[parentId];
    if (!parent) return;

    // ストレージから読み込んだchildren配列の順序で子を追加
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

  // views が存在しない場合はデフォルトビューを追加
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

  // ルートノード（parentId === null）を取得
  const rootNodes = Object.values(nodes).filter(
    (node) => node.parentId === null && node.viewId === currentViewId
  );

  // ルートノードをtabInfoMapのインデックスでソート（buildTreeと同じ順序）
  rootNodes.sort((a, b) => {
    const indexA = tabInfoMap[a.tabId]?.index ?? Number.MAX_SAFE_INTEGER;
    const indexB = tabInfoMap[b.tabId]?.index ?? Number.MAX_SAFE_INTEGER;
    return indexA - indexB;
  });

  // 深さ優先で走査
  const traverse = (node: TabNode): void => {
    // ピン留めタブは除外
    if (!pinnedTabIds.has(node.tabId)) {
      result.push(node.tabId);
    }
    // 子ノードを走査（children配列の順序を維持）
    for (const child of node.children) {
      traverse(child);
    }
  };

  // ルートノードから開始
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
  // 正しくピン留めタブIDを取得
  const pinnedSet = new Set<number>();
  for (const [tabIdStr, info] of Object.entries(tabInfoMap)) {
    if (info.isPinned) {
      pinnedSet.add(parseInt(tabIdStr));
    }
  }

  // ツリーを深さ優先でフラット化
  const orderedTabIds = flattenTreeDFS(nodes, currentViewId, pinnedSet, tabInfoMap);

  // ピン留めタブの数を取得（ピン留めタブはインデックス0から始まる）
  const pinnedCount = pinnedSet.size;

  // 各タブのChromeインデックスを更新
  // ピン留めタブの後から開始するので、インデックスはpinnedCount + iとなる
  for (let i = 0; i < orderedTabIds.length; i++) {
    const tabId = orderedTabIds[i];
    const expectedIndex = pinnedCount + i;
    const currentInfo = tabInfoMap[tabId];

    // 現在のインデックスと異なる場合のみ移動
    if (currentInfo && currentInfo.index !== expectedIndex) {
      try {
        await chrome.tabs.move(tabId, { index: expectedIndex });
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
  // グループ状態
  const [groups, setGroups] = useState<Record<string, Group>>({});
  // 未読タブ状態
  const [unreadTabIds, setUnreadTabIds] = useState<Set<number>>(new Set());
  // アクティブタブID
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  // ローカル更新中フラグ（storage.onChangedからの更新をスキップするため）
  const isLocalUpdateRef = useRef<boolean>(false);
  // タブ情報マップ
  const [tabInfoMap, setTabInfoMap] = useState<TabInfoMap>({});
  // 複数選択状態
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);
  // 現在のウィンドウID（複数ウィンドウ対応）
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);

  // ストレージからグループを読み込む
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

  // ストレージから未読タブを読み込む
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

  // 現在のアクティブタブを読み込む
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

  // 現在のウィンドウIDを取得する（複数ウィンドウ対応）
  // chrome.windows.getCurrent()を呼び出して確実にウィンドウIDを取得
  const loadCurrentWindowId = React.useCallback(async () => {
    try {
      // URLパラメータからウィンドウIDを取得（別ウィンドウ用サイドパネルの場合）
      const urlParams = new URLSearchParams(window.location.search);
      const windowIdParam = urlParams.get('windowId');
      if (windowIdParam) {
        setCurrentWindowId(parseInt(windowIdParam, 10));
        return;
      }
      // chrome.windows.getCurrent()を使用してウィンドウIDを取得
      // これにより各ウィンドウのサイドパネルで自ウィンドウのタブのみが表示される
      const currentWindow = await chrome.windows.getCurrent();
      if (currentWindow?.id !== undefined) {
        setCurrentWindowId(currentWindow.id);
      }
    } catch (_err) {
      // Failed to load current window ID silently
      // APIが利用できない場合はnullのまま（全タブを表示）
    }
  }, []);

  // 全タブ情報を読み込む
  // 永続化されたタイトルも復元して使用する
  // 永続化されたファビコンも復元して使用する
  // windowIdを含める（複数ウィンドウ対応）
  // discardedを含める（休止タブの視覚的区別）
  // indexを含める（ピン留めタブの順序同期）
  const loadTabInfoMap = React.useCallback(async () => {
    try {
      // 永続化されたタイトルを取得
      const storedTitlesResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_TITLES);
      const persistedTitles: Record<number, string> = storedTitlesResult[STORAGE_KEYS.TAB_TITLES] || {};

      // 永続化されたファビコンを取得
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
    } catch (_err) {
      // Failed to load tab info silently
    }
  }, []);

  const getTabInfo = useCallback((tabId: number): ExtendedTabInfo | undefined => {
    return tabInfoMap[tabId];
  }, [tabInfoMap]);

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
    // 初期化時にストレージからツリー状態とグループと未読タブとアクティブタブとタブ情報をロード
    const initializeTreeState = async () => {
      setIsLoading(true);
      await Promise.all([loadTreeState(), loadGroups(), loadUnreadTabs(), loadActiveTab(), loadTabInfoMap(), loadCurrentWindowId()]);
      setIsLoading(false);
    };

    initializeTreeState();
  }, [loadTreeState, loadGroups, loadUnreadTabs, loadActiveTab, loadTabInfoMap, loadCurrentWindowId]);

  useEffect(() => {
    // STATE_UPDATED メッセージをリッスン
    const messageListener = (message: { type: string }) => {
      if (message.type === 'STATE_UPDATED') {
        // ストレージから最新の状態を再読み込み
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

  // タブのアクティブ化イベントをリッスン
  useEffect(() => {
    const handleTabActivated = (activeInfo: chrome.tabs.TabActiveInfo) => {
      setActiveTabId(activeInfo.tabId);
      // Note: アクティブタブ変更時に選択状態を解除しない
      // ツリー内でのタブクリックでもonActivatedが発火するため、
      // クリック時の選択操作と競合してしまう
      // 代わりに、新しいタブ作成時とタブ削除時にのみ選択を解除する
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, []);

  // chrome.tabs.onCreatedで新しいタブをtabInfoMapに追加
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
        // 新しいタブが作成されたら選択状態を解除
        setSelectedNodeIds(new Set());
        setLastSelectedNodeId(null);
      }
    };

    chrome.tabs.onCreated.addListener(handleTabCreated);

    return () => {
      chrome.tabs.onCreated.removeListener(handleTabCreated);
    };
  }, []);

  // chrome.tabs.onRemovedでタブをtabInfoMapから削除
  useEffect(() => {
    const handleTabRemoved = (tabId: number) => {
      setTabInfoMap(prev => {
        const newMap = { ...prev };
        delete newMap[tabId];
        return newMap;
      });
      // タブが削除されたら選択状態を解除
      setSelectedNodeIds(new Set());
      setLastSelectedNodeId(null);
    };

    chrome.tabs.onRemoved.addListener(handleTabRemoved);

    return () => {
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
    };
  }, []);

  // chrome.tabs.onUpdatedでタブ情報を更新
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

        // ファビコンが変更された場合、永続化データを更新
        if (changeInfo.favIconUrl !== undefined && changeInfo.favIconUrl !== null && changeInfo.favIconUrl !== '') {
          try {
            const storedResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_FAVICONS);
            const persistedFavicons: Record<number, string> = storedResult[STORAGE_KEYS.TAB_FAVICONS] || {};
            persistedFavicons[tabId] = changeInfo.favIconUrl;
            await chrome.storage.local.set({ [STORAGE_KEYS.TAB_FAVICONS]: persistedFavicons });
          } catch (_err) {
            // Failed to persist favicon silently
          }
        }

        // タイトルが変更された場合、永続化データを更新
        if (changeInfo.title !== undefined && changeInfo.title !== null && changeInfo.title !== '') {
          try {
            const storedResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_TITLES);
            const persistedTitles: Record<number, string> = storedResult[STORAGE_KEYS.TAB_TITLES] || {};
            persistedTitles[tabId] = changeInfo.title;
            await chrome.storage.local.set({ [STORAGE_KEYS.TAB_TITLES]: persistedTitles });
          } catch (_err) {
            // Failed to persist title silently
          }
        }
      }
    };

    chrome.tabs.onUpdated.addListener(handleTabUpdated);

    return () => {
      chrome.tabs.onUpdated.removeListener(handleTabUpdated);
    };
  }, []);

  // chrome.tabs.onMovedでタブのインデックスを更新
  useEffect(() => {
    const handleTabMoved = async (
      _tabId: number,
      moveInfo: chrome.tabs.TabMoveInfo
    ) => {
      // タブが移動されると、同じウィンドウ内の他のタブのインデックスも変更される
      // 最新のインデックスを取得して全タブを更新
      try {
        const tabs = await chrome.tabs.query({ windowId: moveInfo.windowId });
        setTabInfoMap(prev => {
          const newMap = { ...prev };
          for (const tab of tabs) {
            if (tab.id !== undefined && newMap[tab.id]) {
              newMap[tab.id] = {
                ...newMap[tab.id],
                index: tab.index,
              };
            }
          }
          return newMap;
        });

        // ツリー状態を再読み込みしてブラウザタブ順序と同期
        loadTreeState();
      } catch (_err) {
        // Failed to update tab indices silently
      }
    };

    chrome.tabs.onMoved.addListener(handleTabMoved);

    return () => {
      chrome.tabs.onMoved.removeListener(handleTabMoved);
    };
  }, [loadTreeState]);

  // chrome.tabs.onDetachedでタブがウィンドウから取り外されたときにtabInfoMapを更新
  useEffect(() => {
    const handleTabDetached = (
      tabId: number,
      _detachInfo: chrome.tabs.TabDetachInfo
    ) => {
      // タブがウィンドウから取り外されたとき、tabInfoMapを更新
      // 新しいウィンドウIDはonAttachedで更新される
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
      // ツリー状態を再読み込み
      loadTreeState();
      loadTabInfoMap();
    };

    chrome.tabs.onDetached.addListener(handleTabDetached);

    return () => {
      chrome.tabs.onDetached.removeListener(handleTabDetached);
    };
  }, [loadTreeState, loadTabInfoMap]);

  // chrome.tabs.onAttachedでタブが新しいウィンドウにアタッチされたときにtabInfoMapを更新
  useEffect(() => {
    const handleTabAttached = async (
      tabId: number,
      attachInfo: chrome.tabs.TabAttachInfo
    ) => {
      // タブが新しいウィンドウにアタッチされたとき、tabInfoMapを更新
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
      // ツリー状態を再読み込み
      loadTreeState();
      loadTabInfoMap();
    };

    chrome.tabs.onAttached.addListener(handleTabAttached);

    return () => {
      chrome.tabs.onAttached.removeListener(handleTabAttached);
    };
  }, [loadTreeState, loadTabInfoMap]);

  useEffect(() => {
    // chrome.storage.onChanged をリッスン
    const storageListener = (
      changes: { [key: string]: chrome.storage.StorageChange }
    ) => {
      // ローカル更新中はスキップ（レースコンディション防止）
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
    // ローカル更新フラグを設定（storage.onChangedからの更新をスキップするため）
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
   * ビュー切り替え
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
   * 新しいビューを作成
   */
  const createView = useCallback(() => {
    if (!treeState) return;

    // 既存のビュー数に基づいて色パレットから次の色を選択
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
  }, [treeState]);

  /**
   * ビューを削除
   * 削除されるビューのタブは配列上の前のビューに移動
   */
  const deleteView = useCallback((viewId: string) => {
    if (!treeState) return;

    // デフォルトビューは削除不可
    if (viewId === 'default') return;

    // 削除対象ビューのインデックスを取得
    const viewIndex = treeState.views.findIndex(v => v.id === viewId);
    if (viewIndex === -1) return;

    // 移動先ビューを決定（配列上の前のビュー、なければdefault）
    const targetViewId = viewIndex > 0
      ? treeState.views[viewIndex - 1].id
      : 'default';

    // 削除対象ビューのタブを移動先ビューに移動
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

    // 削除されたビューが現在のビューだった場合、移動先ビューに切り替え
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
  }, [treeState]);

  /**
   * ビューを更新（名前、色など）
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

      // 子を親の直上にドロップした場合、最後の子として配置
      updatedActiveNode.parentId = overId;

      // 親子関係を再構築（元のchildren配列の順序を維持）
      Object.entries(treeState.nodes).forEach(([parentId, originalNode]) => {
        const parent = updatedNodes[parentId];
        if (!parent) return;

        // 対象の親（overId）の場合は特別処理
        // activeNodeを除いた子リストを構築し、最後にactiveNodeを追加
        if (parentId === overId) {
          for (const originalChild of originalNode.children) {
            const childId = originalChild.id;
            const child = updatedNodes[childId];
            if (child && child.parentId === parentId && childId !== activeId) {
              parent.children.push(child);
            }
          }
          // activeNodeを最後に追加
          const activeChild = updatedNodes[activeId];
          if (activeChild && activeChild.parentId === overId) {
            parent.children.push(activeChild);
          }
        } else {
          // 他の親の場合: 元のchildren配列の順序を維持
          for (const originalChild of originalNode.children) {
            const childId = originalChild.id;
            const child = updatedNodes[childId];
            // activeNodeが他の親から移動している場合は除外
            if (child && child.parentId === parentId) {
              parent.children.push(child);
            }
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

      // ツリー構造をChromeタブインデックスに同期
      try {
        await syncTreeToChromeTabs(updatedNodes, treeState.currentViewId, tabInfoMap);
      } catch {
        // 同期に失敗してもツリー状態の更新は維持する
      }

      // Note: We don't send UPDATE_TREE message because:
      // 1. TreeStateProvider directly updates storage
      // 2. Service worker's TreeStateManager will reload from storage when needed
      // 3. Sending UPDATE_TREE would cause duplicate updates and potential race conditions
      //
      // しかし、treeStructureを更新する必要があるので、REFRESH_TREE_STRUCTUREを送信
      // これにより、ブラウザ再起動時に親子関係が正しく復元される
      chrome.runtime.sendMessage({ type: 'REFRESH_TREE_STRUCTURE' }).catch((_error) => {
        // Ignore errors when no listeners are available
      });
    },
    [treeState, updateTreeState, tabInfoMap]
  );

  /**
   * 兄弟としてドロップ（Gapドロップ）時のハンドラ
   * タブを兄弟として指定位置に挿入する
   */
  const handleSiblingDrop = useCallback(
    async (info: SiblingDropInfo) => {
      // insertIndexはツリー内の位置であり、ブラウザタブのインデックスとは異なる
      const { activeNodeId, insertIndex: _insertIndex, aboveNodeId, belowNodeId } = info;

      if (!treeState) {
        return;
      }

      const activeNode = treeState.nodes[activeNodeId];
      if (!activeNode) {
        return;
      }

      // 挿入先の親ノードと挿入位置を決定
      // 異なる深度のタブ間にドロップした場合は「下のノードの親」を使用する
      let targetParentId: string | null = null;

      if (belowNodeId && treeState.nodes[belowNodeId]) {
        // 下のノードが存在する場合、下のノードと同じ親を持つ兄弟として挿入
        // これにより異なる深度間のドロップでも正しい位置に配置される
        targetParentId = treeState.nodes[belowNodeId].parentId;
      } else if (aboveNodeId && treeState.nodes[aboveNodeId]) {
        // 下のノードがない場合（リスト末尾にドロップ）、上のノードの親を使用
        targetParentId = treeState.nodes[aboveNodeId].parentId;
      }

      // 自分自身の子孫への移動をチェック
      if (targetParentId) {
        const isDescendant = (ancestorId: string, descendantId: string): boolean => {
          const ancestor = treeState.nodes[ancestorId];
          if (!ancestor) return false;

          for (const child of ancestor.children) {
            if (child.id === descendantId) return true;
            if (isDescendant(child.id, descendantId)) return true;
          }

          return false;
        };

        if (isDescendant(activeNodeId, targetParentId)) {
          return;
        }
      }

      // 深いコピーを作成して変更を加える
      const updatedNodes: Record<string, TabNode> = {};
      Object.entries(treeState.nodes).forEach(([id, node]) => {
        updatedNodes[id] = {
          ...node,
          children: [], // 子配列は後で再構築
        };
      });

      // activeNodeの親を更新
      const updatedActiveNode = updatedNodes[activeNodeId];
      updatedActiveNode.parentId = targetParentId;

      // 親子関係を再構築（元のchildren配列の順序を維持しつつ、activeNodeを正しい位置に挿入）
      // Step 1: 元のchildren配列からactiveNodeを除いた状態で再構築
      Object.entries(treeState.nodes).forEach(([parentId, originalNode]) => {
        const parent = updatedNodes[parentId];
        if (!parent) return;

        // 元のchildren配列の順序を維持
        for (const originalChild of originalNode.children) {
          const childId = originalChild.id;
          // activeNodeは後で正しい位置に挿入するのでスキップ
          if (childId === activeNodeId) continue;
          const child = updatedNodes[childId];
          // 元の親と同じ親を持つ子のみ追加（activeNodeの移動による変更は除く）
          if (child && child.parentId === parentId) {
            parent.children.push(child);
          }
        }
      });

      // Step 2: activeNodeを正しい位置に挿入
      if (targetParentId) {
        // 親がいる場合
        const targetParent = updatedNodes[targetParentId];
        if (targetParent) {
          // belowNodeIdがある場合、その前に挿入
          if (belowNodeId) {
            const belowNode = updatedNodes[belowNodeId];
            // belowNodeが同じ親を持つ場合のみ
            if (belowNode && belowNode.parentId === targetParentId) {
              const insertIndex = targetParent.children.findIndex(c => c.id === belowNodeId);
              if (insertIndex !== -1) {
                targetParent.children.splice(insertIndex, 0, updatedActiveNode);
              } else {
                targetParent.children.push(updatedActiveNode);
              }
            } else {
              // belowNodeが同じ親を持たない場合（リスト末尾）
              targetParent.children.push(updatedActiveNode);
            }
          } else if (aboveNodeId) {
            // aboveNodeIdしかない場合（リスト末尾）、その後に挿入
            const aboveNode = updatedNodes[aboveNodeId];
            if (aboveNode && aboveNode.parentId === targetParentId) {
              const insertIndex = targetParent.children.findIndex(c => c.id === aboveNodeId);
              if (insertIndex !== -1) {
                targetParent.children.splice(insertIndex + 1, 0, updatedActiveNode);
              } else {
                targetParent.children.push(updatedActiveNode);
              }
            } else {
              targetParent.children.push(updatedActiveNode);
            }
          } else {
            targetParent.children.push(updatedActiveNode);
          }
        }
      }
      // ルートレベルの場合、親子関係は不要（親がnull）

      // 深さを再計算
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

      // tabToNodeマッピングを更新
      const updatedTabToNode = { ...treeState.tabToNode };

      // 状態を更新
      const newTreeState = {
        ...treeState,
        nodes: updatedNodes,
        tabToNode: updatedTabToNode,
      };

      await updateTreeState(newTreeState);

      // ドロップ位置からChromeタブインデックスを計算してサブツリー全体を移動
      try {
        // ドロップ位置からターゲットChromeインデックスを計算
        let targetChromeIndex: number;
        const activeTabInfo = tabInfoMap[activeNode.tabId];
        const activeTabIndex = activeTabInfo?.index ?? 0;

        if (belowNodeId && updatedNodes[belowNodeId]) {
          // belowNodeの位置に挿入（belowNodeの前に配置）
          const belowNode = updatedNodes[belowNodeId];
          const belowTabInfo = tabInfoMap[belowNode.tabId];
          let belowIndex = belowTabInfo?.index ?? 0;
          // アクティブタブがbelowタブより前にある場合、chrome.tabs.moveで
          // アクティブタブが除外されてからbelowタブのインデックスが1つ減るため、
          // 目的インデックスを1減らす
          if (activeTabIndex < belowIndex) {
            belowIndex -= 1;
          }
          targetChromeIndex = belowIndex;
        } else if (aboveNodeId && updatedNodes[aboveNodeId]) {
          // aboveNodeの後に挿入（リスト末尾）
          const aboveNode = updatedNodes[aboveNodeId];
          const aboveTabInfo = tabInfoMap[aboveNode.tabId];
          let aboveIndex = aboveTabInfo?.index ?? 0;
          // アクティブタブがaboveタブより前にある場合、同様にインデックスを調整
          if (activeTabIndex < aboveIndex) {
            aboveIndex -= 1;
          }
          targetChromeIndex = aboveIndex + 1;
        } else {
          // 位置情報がない場合は現在位置を維持
          targetChromeIndex = activeTabIndex;
        }

        // サブツリー内のタブIDを深さ優先で収集
        const collectSubtreeTabIds = (node: TabNode): number[] => {
          const result: number[] = [node.tabId];
          for (const child of node.children) {
            result.push(...collectSubtreeTabIds(child));
          }
          return result;
        };
        const subtreeTabIds = collectSubtreeTabIds(updatedNodes[activeNodeId]);

        // サブツリー内のタブを順番に移動（深さ優先順で連続配置）
        for (let i = 0; i < subtreeTabIds.length; i++) {
          const tabId = subtreeTabIds[i];
          const currentInfo = tabInfoMap[tabId];
          if (!currentInfo?.isPinned) {
            try {
              await chrome.tabs.move(tabId, { index: targetChromeIndex + i });
            } catch {
              // タブが存在しない場合などのエラーは無視
            }
          }
        }
      } catch {
        // 同期に失敗してもツリー状態の更新は維持する
      }

      // treeStructureを更新するためにREFRESH_TREE_STRUCTUREを送信
      // これにより、ブラウザ再起動時に親子関係が正しく復元される
      chrome.runtime.sendMessage({ type: 'REFRESH_TREE_STRUCTURE' }).catch((_error) => {
        // Ignore errors when no listeners are available
      });
    },
    [treeState, updateTreeState, tabInfoMap]
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

  /**
   * グループを削除
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
   * グループを更新（名前、色など）
   */
  const updateGroupFn = useCallback((groupId: string, updates: Partial<Group>) => {
    const group = groups[groupId];
    if (!group) return;

    const updatedGroup = { ...group, ...updates };
    const newGroups = { ...groups, [groupId]: updatedGroup };
    saveGroups(newGroups);
  }, [groups, saveGroups]);

  /**
   * グループの展開/折りたたみを切り替え
   */
  const toggleGroupExpanded = useCallback((groupId: string) => {
    const group = groups[groupId];
    if (!group) return;

    const updatedGroup = { ...group, isExpanded: !group.isExpanded };
    const newGroups = { ...groups, [groupId]: updatedGroup };
    saveGroups(newGroups);
  }, [groups, saveGroups]);

  /**
   * タブをグループに追加
   */
  const addTabToGroup = useCallback((nodeId: string, groupId: string) => {
    if (!treeState) return;

    const node = treeState.nodes[nodeId];
    if (!node) return;

    // グループノードを取得して深さを計算
    const groupNode = treeState.nodes[groupId];
    const groupDepth = groupNode?.depth ?? 0;

    const updatedNodes = { ...treeState.nodes };
    updatedNodes[nodeId] = {
      ...node,
      groupId,
      parentId: groupId,  // グループノードを親として設定
      depth: groupDepth + 1,  // グループの深さ + 1
    };

    // グループノードのchildrenに追加
    if (groupNode) {
      const updatedGroupNode = {
        ...groupNode,
        children: [...groupNode.children, updatedNodes[nodeId]],
      };
      updatedNodes[groupId] = updatedGroupNode;
    }

    updateTreeState({ ...treeState, nodes: updatedNodes });
  }, [treeState, updateTreeState]);

  /**
   * タブをグループから削除
   */
  const removeTabFromGroup = useCallback((nodeId: string) => {
    if (!treeState) return;

    const node = treeState.nodes[nodeId];
    if (!node) return;

    const updatedNodes = { ...treeState.nodes };

    // グループノードからchildrenを削除
    if (node.groupId && updatedNodes[node.groupId]) {
      const groupNode = updatedNodes[node.groupId];
      const updatedGroupNode = {
        ...groupNode,
        children: groupNode.children.filter((child) => child.id !== nodeId),
      };
      updatedNodes[node.groupId] = updatedGroupNode;
    }

    // ノードをルートレベルに戻す
    const updatedNode = {
      ...node,
      groupId: undefined,
      parentId: null,
      depth: 0,
    };
    updatedNodes[nodeId] = updatedNode;

    updateTreeState({ ...treeState, nodes: updatedNodes });
  }, [treeState, updateTreeState]);

  /**
   * グループ内のタブ数を取得
   */
  const getGroupTabCount = useCallback((groupId: string): number => {
    if (!treeState) return 0;

    return Object.values(treeState.nodes).filter(
      (node) => node.groupId === groupId
    ).length;
  }, [treeState]);

  /**
   * タブが未読かどうかを確認
   */
  const isTabUnread = useCallback((tabId: number): boolean => {
    return unreadTabIds.has(tabId);
  }, [unreadTabIds]);

  /**
   * 未読タブの総数を取得
   */
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

  /**
   * ピン留めタブIDの配列を算出
   * tabInfoMapからピン留め状態のタブIDをフィルタリングして配列を返す
   */
  const pinnedTabIds = useMemo((): number[] => {
    return Object.values(tabInfoMap)
      .filter(tabInfo => {
        // 現在のウィンドウのタブのみ
        if (currentWindowId !== null && tabInfo.windowId !== currentWindowId) {
          return false;
        }
        return tabInfo.isPinned;
      })
      // ブラウザのタブ順序と同期するために、indexでソートする
      .sort((a, b) => a.index - b.index)
      .map(tabInfo => tabInfo.id);
  }, [tabInfoMap, currentWindowId]);

  /**
   * ピン留めタブの並び替え
   * ドラッグ＆ドロップでピン留めタブの順序を変更し、ブラウザタブと同期する
   */
  const handlePinnedTabReorder = useCallback(async (tabId: number, newIndex: number): Promise<void> => {
    if (!currentWindowId) return;

    try {
      // ピン留めタブの新しい位置を計算
      // chrome.tabs.move()はピン留めタブに対しても使用可能
      // newIndexはピン留めタブセクション内でのインデックス
      await chrome.tabs.move(tabId, { index: newIndex });
    } catch (error) {
      console.error('Failed to reorder pinned tab:', error);
    }
  }, [currentWindowId]);

  /**
   * ノードを選択
   * Shift/Ctrlキーに応じた選択ロジックを提供する
   */
  const selectNode = useCallback((nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => {
    if (!treeState) return;

    // ノードが存在しない場合は何もしない
    if (!treeState.nodes[nodeId]) return;

    if (modifiers.ctrl) {
      // Ctrlキー押下時: トグル追加/削除
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
      // Shiftキー押下時: 範囲選択
      // ノードの表示順序を取得
      const nodeIds = Object.keys(treeState.nodes);
      const lastIndex = nodeIds.indexOf(lastSelectedNodeId);
      const currentIndex = nodeIds.indexOf(nodeId);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const startIndex = Math.min(lastIndex, currentIndex);
        const endIndex = Math.max(lastIndex, currentIndex);
        const rangeNodeIds = nodeIds.slice(startIndex, endIndex + 1);
        setSelectedNodeIds(new Set(rangeNodeIds));
      } else {
        // インデックスが見つからない場合は単一選択
        setSelectedNodeIds(new Set([nodeId]));
        setLastSelectedNodeId(nodeId);
      }
    } else {
      // 通常クリック: 既存の選択をクリアして新しいノードを選択
      setSelectedNodeIds(new Set([nodeId]));
      setLastSelectedNodeId(nodeId);
    }
  }, [treeState, lastSelectedNodeId]);

  /**
   * 選択をすべてクリア
   */
  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setLastSelectedNodeId(null);
  }, []);

  /**
   * ノードが選択されているかを確認
   */
  const isNodeSelected = useCallback((nodeId: string): boolean => {
    return selectedNodeIds.has(nodeId);
  }, [selectedNodeIds]);

  /**
   * 選択されたすべてのタブIDを取得
   * 複数選択時にコンテキストメニューで使用
   */
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
   * ビューごとのタブ数を計算（メモ化）
   * 実際に存在するタブのみをカウント
   */
  const viewTabCounts = useMemo((): Record<string, number> => {
    if (!treeState) return {};

    const counts: Record<string, number> = {};

    // 各ノードをビューIDでグループ化してカウント（tabInfoMapに存在するタブのみ）
    Object.values(treeState.nodes).forEach((node) => {
      // タブが実際に存在するかを確認
      if (tabInfoMap[node.tabId]) {
        const viewId = node.viewId;
        counts[viewId] = (counts[viewId] || 0) + 1;
      }
    });

    return counts;
  }, [treeState, tabInfoMap]);

  /**
   * タブを別のビューに移動
   */
  const moveTabsToView = useCallback((viewId: string, tabIds: number[]) => {
    if (!treeState) return;

    // tabIdからnodeIdを取得し、対象ノードのviewIdを更新
    const updatedNodes = { ...treeState.nodes };

    tabIds.forEach(tabId => {
      const nodeId = treeState.tabToNode[tabId];
      if (nodeId && updatedNodes[nodeId]) {
        updatedNodes[nodeId] = {
          ...updatedNodes[nodeId],
          viewId,
          // 親子関係をルートに移動（異なるビューへの移動時）
          parentId: null,
        };
      }
    });

    // 親子関係を再構築
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

    // 深さを再計算
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
        // グループ管理機能
        groups,
        createGroup,
        deleteGroup,
        updateGroup: updateGroupFn,
        toggleGroupExpanded,
        addTabToGroup,
        removeTabFromGroup,
        getGroupTabCount,
        // 未読状態管理機能
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
