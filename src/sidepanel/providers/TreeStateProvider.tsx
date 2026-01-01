import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import type { TreeState, TabNode, View, Group, ExtendedTabInfo, TabInfoMap, SiblingDropInfo, DragEndEvent } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

interface TreeStateContextType {
  treeState: TreeState | null;
  isLoading: boolean;
  error: Error | null;
  updateTreeState: (state: TreeState) => void;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  // Task 5.3: 兄弟としてドロップ（Gapドロップ）時のハンドラ
  handleSiblingDrop: (info: SiblingDropInfo) => Promise<void>;
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
  // Task 1.1: タブ情報マップ管理
  tabInfoMap: TabInfoMap;
  getTabInfo: (tabId: number) => ExtendedTabInfo | undefined;
  // Task 1.2: ピン留めタブ専用リスト
  pinnedTabIds: number[];
  // Task 11.1 (tab-tree-bugfix): ピン留めタブの並び替え (Requirements 10.1, 10.2, 10.3, 10.4)
  handlePinnedTabReorder: (tabId: number, newIndex: number) => Promise<void>;
  // Task 1.3: 複数選択状態管理
  selectedNodeIds: Set<string>;
  lastSelectedNodeId: string | null;
  selectNode: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  clearSelection: () => void;
  isNodeSelected: (nodeId: string) => boolean;
  // Task 12.2: 選択されたすべてのタブIDを取得
  getSelectedTabIds: () => number[];
  // Task 3.3: ビューごとのタブ数 (Requirements 17.1, 17.2, 17.3)
  viewTabCounts: Record<string, number>;
  // Task 7.2: タブをビューに移動 (Requirements 18.1, 18.2, 18.3)
  moveTabsToView: (viewId: string, tabIds: number[]) => void;
  // Task 6.2: 現在のウィンドウID（複数ウィンドウ対応）
  currentWindowId: number | null;
  // Task 7.2 (tab-tree-comprehensive-fix): クロスウィンドウドラッグ&ドロップ
  // Requirement 7.2: 別ウィンドウのツリービュー上でのドロップでタブを移動
  handleCrossWindowDragStart: (tabId: number, treeData: TabNode[]) => Promise<void>;
  handleCrossWindowDrop: () => Promise<boolean>;
  clearCrossWindowDragState: () => Promise<void>;
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
  // Task 1.1: タブ情報マップ
  const [tabInfoMap, setTabInfoMap] = useState<TabInfoMap>({});
  // Task 1.3: 複数選択状態
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [lastSelectedNodeId, setLastSelectedNodeId] = useState<string | null>(null);
  // Task 6.2: 現在のウィンドウID（複数ウィンドウ対応）
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);

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

  // Task 6.2: 現在のウィンドウIDを取得する（複数ウィンドウ対応）
  // Task 1.1 (tab-tree-bugfix): chrome.windows.getCurrent()を呼び出して確実にウィンドウIDを取得
  const loadCurrentWindowId = React.useCallback(async () => {
    try {
      // URLパラメータからウィンドウIDを取得（別ウィンドウ用サイドパネルの場合）
      const urlParams = new URLSearchParams(window.location.search);
      const windowIdParam = urlParams.get('windowId');
      if (windowIdParam) {
        setCurrentWindowId(parseInt(windowIdParam, 10));
        return;
      }
      // Task 1.1 (tab-tree-bugfix): chrome.windows.getCurrent()を使用してウィンドウIDを取得
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

  // Task 1.1: 全タブ情報を読み込む
  // Requirement 5.2: 永続化されたタイトルも復元して使用する
  // Task 2.1 (tab-tree-bugfix): 永続化されたファビコンも復元して使用する
  // Task 6.2: windowIdを含める（複数ウィンドウ対応）
  // Task 4.1 (tab-tree-bugfix): discardedを含める（休止タブの視覚的区別）
  // Task 12.1 (tab-tree-comprehensive-fix): indexを含める（ピン留めタブの順序同期）
  const loadTabInfoMap = React.useCallback(async () => {
    try {
      // 永続化されたタイトルを取得
      const storedTitlesResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_TITLES);
      const persistedTitles: Record<number, string> = storedTitlesResult[STORAGE_KEYS.TAB_TITLES] || {};

      // Task 2.1 (tab-tree-bugfix): 永続化されたファビコンを取得
      const storedFaviconsResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_FAVICONS);
      const persistedFavicons: Record<number, string> = storedFaviconsResult[STORAGE_KEYS.TAB_FAVICONS] || {};

      const tabs = await chrome.tabs.query({});
      const newTabInfoMap: TabInfoMap = {};
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          // Requirement 5.2: 永続化されたタイトルがあればそれを使用
          // タブがローディング中でChromeからのタイトルが空の場合に特に有効
          const persistedTitle = persistedTitles[tab.id];
          const title = tab.title || persistedTitle || '';

          // Task 2.1 (tab-tree-bugfix): 永続化されたファビコンがあればそれを使用
          // ブラウザ再起動後にタブが読み込まれていない場合に有効
          const persistedFavicon = persistedFavicons[tab.id];
          const favIconUrl = tab.favIconUrl || persistedFavicon;

          newTabInfoMap[tab.id] = {
            id: tab.id,
            title,
            url: tab.url || '',
            favIconUrl,
            status: tab.status === 'loading' ? 'loading' : 'complete',
            isPinned: tab.pinned || false,
            // Task 6.2: windowIdを含める（複数ウィンドウ対応）
            windowId: tab.windowId,
            // Task 4.1 (tab-tree-bugfix): discardedを含める（休止タブの視覚的区別）
            discarded: tab.discarded || false,
            // Task 12.1 (tab-tree-comprehensive-fix): indexを含める（ピン留めタブの順序同期）
            index: tab.index,
          };
        }
      }
      setTabInfoMap(newTabInfoMap);
    } catch (_err) {
      // Failed to load tab info silently
    }
  }, []);

  // Task 1.1: タブ情報を取得するヘルパー
  const getTabInfo = useCallback((tabId: number): ExtendedTabInfo | undefined => {
    return tabInfoMap[tabId];
  }, [tabInfoMap]);

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
    // 初期化時にストレージからツリー状態とグループと未読タブとアクティブタブとタブ情報をロード
    // Task 6.2: 現在のウィンドウIDも取得（複数ウィンドウ対応）
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
        // ストレージから最新の状態を再読み込み（未読タブも含む）
        // Task 12.3 (tab-tree-bugfix): タブ情報も再読み込みして新しいタブをUIに反映
        // Task 12.3 (tab-tree-bugfix): グループも再読み込みして新しいグループをUIに反映
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

  // Task 8.5.4: タブのアクティブ化イベントをリッスン
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

  // Task 12.3 (tab-tree-bugfix): chrome.tabs.onCreatedで新しいタブをtabInfoMapに追加
  // これにより、新しく作成されたタブが即座にUIに反映される
  // Task 12.1 (tab-tree-comprehensive-fix): indexを含める（ピン留めタブの順序同期）
  // Task 4.1 (tab-tree-bugfix-2): 新しいタブ作成時に選択状態を解除
  // Requirements: 15.1, 15.2
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
        // Task 4.1: 新しいタブが作成されたら選択状態を解除
        setSelectedNodeIds(new Set());
        setLastSelectedNodeId(null);
      }
    };

    chrome.tabs.onCreated.addListener(handleTabCreated);

    return () => {
      chrome.tabs.onCreated.removeListener(handleTabCreated);
    };
  }, []);

  // Task 12.3 (tab-tree-bugfix): chrome.tabs.onRemovedでタブをtabInfoMapから削除
  // Task 4.1 (tab-tree-bugfix-2): タブ削除時に選択状態を解除
  // Requirements: 15.1, 15.2
  useEffect(() => {
    const handleTabRemoved = (tabId: number) => {
      setTabInfoMap(prev => {
        const newMap = { ...prev };
        delete newMap[tabId];
        return newMap;
      });
      // Task 4.1: タブが削除されたら選択状態を解除
      setSelectedNodeIds(new Set());
      setLastSelectedNodeId(null);
    };

    chrome.tabs.onRemoved.addListener(handleTabRemoved);

    return () => {
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
    };
  }, []);

  // Task 1.1: chrome.tabs.onUpdatedでタブ情報を更新
  // Task 2.1 (tab-tree-bugfix): ファビコン変更時に永続化
  // Task 6.2: windowIdを含める（複数ウィンドウ対応）
  // Task 4.1 (tab-tree-bugfix): discardedを含める（休止タブの視覚的区別）
  // Task 9.2 (tab-tree-comprehensive-fix): URL変更時もtabInfoMapを更新（スタートページタイトル表示）
  // Task 12.1 (tab-tree-comprehensive-fix): indexを含める（ピン留めタブの順序同期）
  useEffect(() => {
    const handleTabUpdated = async (
      tabId: number,
      changeInfo: chrome.tabs.TabChangeInfo,
      tab: chrome.tabs.Tab
    ) => {
      // タイトル、ファビコン、URL、ピン状態、discarded状態のいずれかが変更された場合のみ更新
      // Task 4.1 (tab-tree-bugfix): discardedの変更も監視（休止タブがアクティブ化された場合にグレーアウト解除）
      // Task 9.2 (tab-tree-comprehensive-fix): URL変更も監視（ページ遷移時のタイトル表示更新に必要）
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
            // Task 6.2: windowIdを含める（複数ウィンドウ対応）
            windowId: tab.windowId,
            // Task 4.1 (tab-tree-bugfix): discardedを含める（休止タブの視覚的区別）
            discarded: tab.discarded ?? prev[tabId]?.discarded ?? false,
            // Task 12.1 (tab-tree-comprehensive-fix): indexを含める（ピン留めタブの順序同期）
            index: tab.index,
          },
        }));

        // Task 2.1 (tab-tree-bugfix): ファビコンが変更された場合、永続化データを更新
        // undefinedの場合は既存の永続化データを維持する
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

        // Task 2.2 (tab-tree-bugfix): タイトルが変更された場合、永続化データを更新
        // undefined/空文字列の場合は既存の永続化データを維持する
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

  // Task 12.1 (tab-tree-comprehensive-fix): chrome.tabs.onMovedでタブのインデックスを更新
  // ピン留めタブの並び替え同期に必要
  // Requirements: 12.1, 12.2, 12.3, 12.4
  // Task 2.1 (tree-tab-bugfixes-and-ux-improvements): ツリー状態も再読み込みしてブラウザタブ順序と同期
  // Requirements: 2.1, 2.2, 2.3
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

        // Task 2.1: ツリー状態を再読み込みしてブラウザタブ順序と同期
        // ブラウザ側でタブが並び替えられた場合（タブバーでのドラッグ等）に
        // ツリービューの表示を更新する
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
   * Task 5.3: 兄弟としてドロップ（Gapドロップ）時のハンドラ
   * Requirements: 8.1, 8.2, 8.3, 8.4
   * Task 8.1 (tab-tree-bugfix): ドロップ位置への正確な挿入
   * Requirements: 7.1, 7.2 - insertIndexを使用して正しい位置にタブを挿入し、ブラウザタブの順序を同期
   * タブを兄弟として指定位置に挿入する
   */
  const handleSiblingDrop = useCallback(
    async (info: SiblingDropInfo) => {
      // Task 7.3: insertIndexはツリー内の位置であり、ブラウザタブのインデックスとは異なるため未使用
      // belowNodeIdのタブのインデックスを直接取得してブラウザタブを移動する
      const { activeNodeId, insertIndex: _insertIndex, aboveNodeId, belowNodeId } = info;

      if (!treeState) {
        return;
      }

      const activeNode = treeState.nodes[activeNodeId];
      if (!activeNode) {
        return;
      }

      // Task 3.1 (tab-tree-comprehensive-fix): 挿入先の親ノードと挿入位置を決定
      // Requirements: 3.1, 3.2, 3.3
      // 異なる深度のタブ間にドロップした場合は、「下のノードの親」を使用する
      // これにより、プレースホルダーが示す位置（下のノードの直前）に正しく配置される
      // 下のノードがない場合（リストの末尾）のみ、上のノードの親を使用
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

      // Task 7.3 (tab-tree-bugfix-2): ブラウザタブの順序をツリー構造と同期
      // Requirements: 2.1, 2.2, 2.3 - ドロップ位置に対応した正しいインデックスにタブを移動
      // insertIndexはツリー内のインデックスであり、ブラウザタブのインデックスとは異なる
      // belowNodeIdのタブのインデックスを使用するか、リスト末尾の場合は-1を使用
      try {
        let browserTabIndex: number;

        if (belowNodeId && treeState.nodes[belowNodeId]) {
          // 下のノードが存在する場合、下のノードのタブのインデックスを取得
          const belowNode = treeState.nodes[belowNodeId];
          const belowTabInfo = tabInfoMap[belowNode.tabId];
          if (belowTabInfo) {
            browserTabIndex = belowTabInfo.index;
          } else {
            // tabInfoMapにない場合はchrome.tabs.getでインデックスを取得
            const tab = await chrome.tabs.get(belowNode.tabId);
            browserTabIndex = tab.index;
          }
        } else {
          // リスト末尾にドロップした場合は-1（末尾に移動）
          browserTabIndex = -1;
        }

        await chrome.tabs.move(activeNode.tabId, { index: browserTabIndex });
      } catch (_err) {
        // タブ移動に失敗してもツリー状態の更新は維持する
        // タブが既に存在しない場合などに発生する可能性がある
      }
    },
    [treeState, updateTreeState, tabInfoMap]
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

  /**
   * Task 1.2: ピン留めタブIDの配列を算出
   * tabInfoMapからピン留め状態のタブIDをフィルタリングして配列を返す
   * Task 6.2: 現在のウィンドウのタブのみをフィルタリング（複数ウィンドウ対応）
   * Task 12.1 (tab-tree-comprehensive-fix): インデックス順でソート（ピン留めタブの順序同期）
   * Requirements: 12.1, 12.2, 12.3, 12.4, 14.1, 14.2, 14.3
   */
  const pinnedTabIds = useMemo((): number[] => {
    return Object.values(tabInfoMap)
      .filter(tabInfo => {
        // Task 6.2: 現在のウィンドウのタブのみ
        if (currentWindowId !== null && tabInfo.windowId !== currentWindowId) {
          return false;
        }
        return tabInfo.isPinned;
      })
      // Task 12.1 (tab-tree-comprehensive-fix): インデックス順でソート
      // ブラウザのタブ順序と同期するために、indexでソートする
      .sort((a, b) => a.index - b.index)
      .map(tabInfo => tabInfo.id);
  }, [tabInfoMap, currentWindowId]);

  /**
   * Task 11.1 (tab-tree-bugfix): ピン留めタブの並び替え
   * ドラッグ＆ドロップでピン留めタブの順序を変更し、ブラウザタブと同期する
   * Requirements: 10.1, 10.2, 10.3, 10.4
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
   * Task 1.3: ノードを選択
   * Shift/Ctrlキーに応じた選択ロジックを提供する
   * Requirements: 9.1, 9.2
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
   * Task 1.3: 選択をすべてクリア
   * Requirements: 9.1, 9.2
   */
  const clearSelection = useCallback(() => {
    setSelectedNodeIds(new Set());
    setLastSelectedNodeId(null);
  }, []);

  /**
   * Task 1.3: ノードが選択されているかを確認
   * Requirements: 9.1, 9.2
   */
  const isNodeSelected = useCallback((nodeId: string): boolean => {
    return selectedNodeIds.has(nodeId);
  }, [selectedNodeIds]);

  /**
   * Task 12.2: 選択されたすべてのタブIDを取得
   * 複数選択時にコンテキストメニューで使用
   * Requirements: 9.3, 9.4, 9.5
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
   * Task 3.3: ビューごとのタブ数を計算（メモ化）
   * Requirements: 17.1, 17.2, 17.3
   * Task 2.1 (tab-tree-comprehensive-fix): 実際に存在するタブのみをカウント
   * Requirements: 2.1, 2.3 - 不整合タブ削除時にカウントを再計算
   */
  const viewTabCounts = useMemo((): Record<string, number> => {
    if (!treeState) return {};

    const counts: Record<string, number> = {};

    // 各ノードをビューIDでグループ化してカウント
    // Task 2.1: tabInfoMapに存在するタブのみをカウント（不整合タブを除外）
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
   * Task 7.2: タブを別のビューに移動
   * Requirements: 18.1, 18.2, 18.3
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

  /**
   * Task 7.2 (tab-tree-comprehensive-fix): クロスウィンドウドラッグ開始
   * Task 5.2 (tree-stability-v2): DragSessionManagerを使用するように修正
   * Requirement 7.2: 別ウィンドウのツリービュー上でのドロップでタブを移動
   * ドラッグ開始時にService WorkerにDragSessionを開始
   */
  const handleCrossWindowDragStart = useCallback(async (tabId: number, treeData: TabNode[]) => {
    if (currentWindowId === null) return;

    return new Promise<void>((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'START_DRAG_SESSION',
          payload: {
            tabId,
            windowId: currentWindowId,
            treeData,
          },
        },
        () => {
          resolve();
        }
      );
    });
  }, [currentWindowId]);

  /**
   * Task 7.2 (tab-tree-comprehensive-fix): クロスウィンドウドロップ処理
   * Task 5.2 (tree-stability-v2): DragSessionManagerを使用するように修正
   * Requirement 7.2: 別ウィンドウのツリービュー上でのドロップでタブを移動
   * ドロップ時に別ウィンドウからのドラッグかどうかを確認し、タブを移動
   * @returns true if cross-window drop was handled, false otherwise
   */
  const handleCrossWindowDrop = useCallback(async (): Promise<boolean> => {
    if (currentWindowId === null) return false;

    return new Promise<boolean>((resolve) => {
      chrome.runtime.sendMessage(
        { type: 'GET_DRAG_SESSION' },
        (response: { success: boolean; data: { tabId: number; sourceWindowId: number; state: string } | null }) => {
          if (!response.success || !response.data) {
            resolve(false);
            return;
          }

          const dragSession = response.data;

          // 同じウィンドウからのドラッグは通常のドラッグとして処理
          if (dragSession.sourceWindowId === currentWindowId) {
            resolve(false);
            return;
          }

          // 別ウィンドウからのドロップ: タブを現在のウィンドウに移動
          chrome.runtime.sendMessage(
            {
              type: 'MOVE_TAB_TO_WINDOW',
              payload: { tabId: dragSession.tabId, windowId: currentWindowId },
            },
            () => {
              // ドラッグセッションを終了
              chrome.runtime.sendMessage({ type: 'END_DRAG_SESSION', payload: { reason: 'COMPLETED' } }, () => {
                resolve(true);
              });
            }
          );
        }
      );
    });
  }, [currentWindowId]);

  /**
   * Task 7.2 (tab-tree-comprehensive-fix): クロスウィンドウドラッグ状態をクリア
   * Task 5.2 (tree-stability-v2): DragSessionManagerを使用するように修正
   * ドラッグ終了時にService WorkerのDragSessionを終了
   */
  const clearCrossWindowDragState = useCallback(async () => {
    return new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ type: 'END_DRAG_SESSION', payload: { reason: 'CANCELLED' } }, () => {
        resolve();
      });
    });
  }, []);

  return (
    <TreeStateContext.Provider
      value={{
        treeState,
        isLoading,
        error,
        updateTreeState,
        handleDragEnd,
        // Task 5.3: 兄弟としてドロップ（Gapドロップ）時のハンドラ
        handleSiblingDrop,
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
        // Task 1.1: タブ情報マップ管理
        tabInfoMap,
        getTabInfo,
        // Task 1.2: ピン留めタブ専用リスト
        pinnedTabIds,
        // Task 11.1 (tab-tree-bugfix): ピン留めタブの並び替え
        handlePinnedTabReorder,
        // Task 1.3: 複数選択状態管理
        selectedNodeIds,
        lastSelectedNodeId,
        selectNode,
        clearSelection,
        isNodeSelected,
        // Task 12.2: 選択されたすべてのタブIDを取得
        getSelectedTabIds,
        // Task 3.3: ビューごとのタブ数
        viewTabCounts,
        // Task 7.2: タブをビューに移動
        moveTabsToView,
        // Task 6.2: 現在のウィンドウID（複数ウィンドウ対応）
        currentWindowId,
        // Task 7.2 (tab-tree-comprehensive-fix): クロスウィンドウドラッグ&ドロップ
        handleCrossWindowDragStart,
        handleCrossWindowDrop,
        clearCrossWindowDragState,
      }}
    >
      {children}
    </TreeStateContext.Provider>
  );
};

export default TreeStateProvider;
