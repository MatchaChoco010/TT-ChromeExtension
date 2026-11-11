import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { TreeState, TabNode, View, Group, ExtendedTabInfo, TabInfoMap, SiblingDropInfo, DragEndEvent, ViewState, WindowState } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';
import { getVivaldiInternalPageTitle } from '@/utils/vivaldi-internal-pages';
import { useLatestRequestGuard } from '../hooks/useLatestRequestGuard';
import { sendServiceWorkerRequest } from '@/messaging/service-worker-client';
import { isMissingTabOrWindowError } from '@/utils/chrome-errors';

interface TreeStateContextType {
  treeState: TreeState | null;
  isLoading: boolean;
  error: Error | null;
  handleDragEnd: (event: DragEndEvent) => Promise<void>;
  handleSiblingDrop: (info: SiblingDropInfo) => Promise<void>;
  switchView: (viewIndex: number) => void;
  createView: () => void;
  deleteView: (viewIndex: number) => void;
  updateView: (viewIndex: number, updates: Partial<View>) => void;
  groups: Record<string, Group>;
  createGroup: (name: string, color: string) => string;
  deleteGroup: (tabId: number) => void;
  updateGroup: (tabId: number, updates: Partial<Group>) => void;
  toggleGroupExpanded: (tabId: number) => void;
  addTabToGroup: (tabId: number, targetGroupTabId: number) => void;
  removeTabFromGroup: (tabId: number) => void;
  getGroupTabCount: (tabId: number) => number;
  unreadTabIds: Set<number>;
  isTabUnread: (tabId: number) => boolean;
  getUnreadCount: () => number;
  getUnreadChildCount: (tabId: number) => number;
  activeTabId: number | null;
  tabInfoMap: TabInfoMap;
  getTabInfo: (tabId: number) => ExtendedTabInfo | undefined;
  pinnedTabIds: number[];
  handlePinnedTabReorder: (tabId: number, newIndex: number) => Promise<void>;
  handleViewReorder: (viewIndex: number, newIndex: number) => Promise<void>;
  selectedTabIds: Set<number>;
  lastSelectedTabId: number | null;
  selectNode: (tabId: number, modifiers: { shift: boolean; ctrl: boolean }) => void;
  clearSelection: () => void;
  isNodeSelected: (tabId: number) => boolean;
  getSelectedTabIds: () => number[];
  viewTabCounts: number[];
  moveTabsToView: (viewIndex: number, tabIds: number[]) => Promise<void>;
  currentWindowId: number | null;
  currentViewIndex: number;
  views: View[];
  currentWindowState: WindowState | null;
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
  const [selectedTabIds, setSelectedTabIds] = useState<Set<number>>(new Set());
  const [lastSelectedTabId, setLastSelectedTabId] = useState<number | null>(null);
  const [currentWindowId, setCurrentWindowId] = useState<number | null>(null);
  const viewActiveTabIdsRef = useRef<Record<number, number>>({});
  const beginTreeStateRequest = useLatestRequestGuard();
  const beginGroupsRequest = useLatestRequestGuard();
  const beginUnreadTabsRequest = useLatestRequestGuard();
  const beginActiveTabRequest = useLatestRequestGuard();
  const beginTabInfoRequest = useLatestRequestGuard();

  const loadGroups = React.useCallback(async () => {
    const isLatestRequest = beginGroupsRequest();
    try {
      const result = await chrome.storage.local.get('groups');
      if (result.groups && isLatestRequest()) {
        setGroups(result.groups as Record<string, Group>);
      }
    } catch (error) {
      console.error('[TreeStateProvider] Failed to load groups:', error);
    }
  }, [beginGroupsRequest]);

  const loadUnreadTabs = React.useCallback(async () => {
    const isLatestRequest = beginUnreadTabsRequest();
    try {
      const result = await chrome.storage.local.get(STORAGE_KEYS.UNREAD_TABS);
      if (result[STORAGE_KEYS.UNREAD_TABS] && isLatestRequest()) {
        setUnreadTabIds(new Set(result[STORAGE_KEYS.UNREAD_TABS] as number[]));
      }
    } catch (error) {
      console.error('[TreeStateProvider] Failed to load unread tabs:', error);
    }
  }, [beginUnreadTabsRequest]);

  const loadActiveTab = React.useCallback(async () => {
    const isLatestRequest = beginActiveTabRequest();
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (activeTab?.id && isLatestRequest()) {
        setActiveTabId(activeTab.id);
      }
    } catch (error) {
      console.error('[TreeStateProvider] Failed to load active tab:', error);
    }
  }, [beginActiveTabRequest]);

  const loadCurrentWindowId = React.useCallback(async () => {
    try {
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
    } catch (error) {
      console.error('[TreeStateProvider] Failed to resolve current window:', error);
    }
  }, []);

  const loadTabInfoMap = React.useCallback(async () => {
    const isLatestRequest = beginTabInfoRequest();
    try {
      const storedTitlesResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_TITLES);
      const persistedTitles: Record<number, string> = (storedTitlesResult[STORAGE_KEYS.TAB_TITLES] as Record<number, string> | undefined) || {};

      const storedFaviconsResult = await chrome.storage.local.get(STORAGE_KEYS.TAB_FAVICONS);
      const persistedFavicons: Record<string, string> = (storedFaviconsResult[STORAGE_KEYS.TAB_FAVICONS] as Record<string, string> | undefined) || {};

      const tabs = await chrome.tabs.query({});

      const newTabInfoMap: TabInfoMap = {};
      for (const tab of tabs) {
        if (tab.id !== undefined) {
          const persistedTitle = persistedTitles[tab.id];
          const vivaldiTitle = tab.url ? getVivaldiInternalPageTitle(tab.url) : null;
          const title = vivaldiTitle || tab.title || persistedTitle || '';

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

      if (isLatestRequest()) {
        setTabInfoMap(newTabInfoMap);
      }
    } catch (error) {
      console.error('[TreeStateProvider] Failed to load tab info:', error);
    }
  }, [beginTabInfoRequest]);

  const getTabInfo = useCallback((tabId: number): ExtendedTabInfo | undefined => {
    return tabInfoMap[tabId];
  }, [tabInfoMap]);

  const saveGroups = React.useCallback(async (newGroups: Record<string, Group>) => {
    setGroups(newGroups);
    await sendServiceWorkerRequest('SAVE_GROUPS', { groups: newGroups });
  }, []);

  const loadTreeState = React.useCallback(async () => {
    const isLatestRequest = beginTreeStateRequest();
    try {
      const state = await sendServiceWorkerRequest('GET_STATE');
      if (isLatestRequest()) {
        setTreeState(state);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error('Failed to load tree state')
      );
    }
  }, [beginTreeStateRequest]);

  useEffect(() => {
    const initializeTreeState = async () => {
      setIsLoading(true);
      await Promise.all([loadTreeState(), loadGroups(), loadUnreadTabs(), loadActiveTab(), loadTabInfoMap(), loadCurrentWindowId()]);
      setIsLoading(false);
    };

    initializeTreeState();
  }, [loadTreeState, loadGroups, loadUnreadTabs, loadActiveTab, loadTabInfoMap, loadCurrentWindowId]);

  useEffect(() => {
    const messageListener = (message: { type: string; payload?: TreeState }) => {
      if (message.type === 'STATE_UPDATED' && message.payload) {
        beginTreeStateRequest();
        setTreeState(message.payload);
        loadTabInfoMap();
        loadUnreadTabs();
        loadGroups();
      }
    };

    chrome.runtime.onMessage.addListener(messageListener);

    return () => {
      chrome.runtime.onMessage.removeListener(messageListener);
    };
  }, [beginTreeStateRequest, loadTabInfoMap, loadUnreadTabs, loadGroups]);

  useEffect(() => {
    const handleTabActivated = (activeInfo: chrome.tabs.OnActivatedInfo) => {
      beginActiveTabRequest();
      setActiveTabId(activeInfo.tabId);
    };

    chrome.tabs.onActivated.addListener(handleTabActivated);

    return () => {
      chrome.tabs.onActivated.removeListener(handleTabActivated);
    };
  }, [beginActiveTabRequest]);

  useEffect(() => {
    const handleTabCreated = () => {
      setSelectedTabIds(new Set());
      setLastSelectedTabId(null);
    };

    chrome.tabs.onCreated.addListener(handleTabCreated);

    return () => {
      chrome.tabs.onCreated.removeListener(handleTabCreated);
    };
  }, []);

  useEffect(() => {
    const handleTabRemoved = () => {
      setSelectedTabIds(new Set());
      setLastSelectedTabId(null);
    };

    chrome.tabs.onRemoved.addListener(handleTabRemoved);

    return () => {
      chrome.tabs.onRemoved.removeListener(handleTabRemoved);
    };
  }, []);

  const currentWindowState = useMemo((): WindowState | null => {
    if (!treeState || currentWindowId === null) return null;
    return treeState.windows.find(w => w.windowId === currentWindowId) || null;
  }, [treeState, currentWindowId]);

  const currentViewIndex = useMemo((): number => {
    return currentWindowState?.activeViewIndex ?? 0;
  }, [currentWindowState]);

  const currentViewState = useMemo((): ViewState | null => {
    if (!currentWindowState) return null;
    return currentWindowState.views[currentViewIndex] || null;
  }, [currentWindowState, currentViewIndex]);

  const views = useMemo((): View[] => {
    if (!currentWindowState) return [];
    return currentWindowState.views.map((v, index) => ({
      id: `${currentWindowId}-${index}`,
      name: v.name,
      color: v.color,
      icon: v.icon,
    }));
  }, [currentWindowState, currentWindowId]);

  const switchView = useCallback(async (viewIndex: number) => {
    if (!treeState || currentWindowId === null) return;

    const tabIdToActivate = viewActiveTabIdsRef.current[viewIndex];

    if (activeTabId !== null) {
      viewActiveTabIdsRef.current[currentViewIndex] = activeTabId;
    }

    await sendServiceWorkerRequest('SWITCH_VIEW', { viewIndex, windowId: currentWindowId });

    if (tabIdToActivate !== undefined) {
      const tabInfo = tabInfoMap[tabIdToActivate];
      const isInCurrentWindow = tabInfo && tabInfo.windowId === currentWindowId;
      if (isInCurrentWindow) {
        try {
          await sendServiceWorkerRequest('ACTIVATE_TAB', { tabId: tabIdToActivate });
          return;
        } catch (error) {
          // 記憶していたタブが閉じられていた場合は、ビューの先頭のタブをアクティブにする
          if (!isMissingTabOrWindowError(error)) {
            throw error;
          }
        }
      }
    }

    const windowState = treeState.windows.find(w => w.windowId === currentWindowId);
    if (!windowState) return;
    const targetViewState = windowState.views[viewIndex];
    if (!targetViewState) return;

    const collectTabIds = (nodes: TabNode[]): number[] => {
      const result: number[] = [];
      for (const node of nodes) {
        const tabInfo = tabInfoMap[node.tabId];
        if (tabInfo && tabInfo.windowId === currentWindowId) {
          result.push(node.tabId);
        }
        result.push(...collectTabIds(node.children));
      }
      return result;
    };

    const viewTabs = collectTabIds(targetViewState.rootNodes);

    if (viewTabs.length > 0) {
      await sendServiceWorkerRequest('ACTIVATE_TAB', { tabId: viewTabs[0] });
    }
  }, [treeState, activeTabId, currentViewIndex, currentWindowId, tabInfoMap]);

  const createView = useCallback(async () => {
    if (currentWindowId === null) return;
    await sendServiceWorkerRequest('CREATE_VIEW', { windowId: currentWindowId });
  }, [currentWindowId]);

  const deleteView = useCallback(async (viewIndex: number) => {
    if (viewIndex === 0 || currentWindowId === null) return;

    await sendServiceWorkerRequest('DELETE_VIEW', { viewIndex, windowId: currentWindowId });
  }, [currentWindowId]);

  const updateView = useCallback(async (viewIndex: number, updates: Partial<View>) => {
    if (currentWindowId === null) return;
    await sendServiceWorkerRequest('UPDATE_VIEW', { viewIndex, updates, windowId: currentWindowId });
  }, [currentWindowId]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const activeTabId = Number(active.id);
      const overTabId = Number(over.id);

      await sendServiceWorkerRequest('MOVE_NODE', {
        tabId: activeTabId,
        targetParentTabId: overTabId,
        selectedTabIds: Array.from(selectedTabIds),
      });
    },
    [selectedTabIds]
  );

  const handleSiblingDrop = useCallback(
    async (info: SiblingDropInfo) => {
      const { activeTabId, aboveTabId, belowTabId, targetDepth } = info;

      await sendServiceWorkerRequest('MOVE_NODE_AS_SIBLING', {
        tabId: activeTabId,
        aboveTabId,
        belowTabId,
        selectedTabIds: Array.from(selectedTabIds),
        targetDepth,
      });
    },
    [selectedTabIds]
  );

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

  const deleteGroup = useCallback(async (tabId: number) => {
    const newGroups = { ...groups };
    delete newGroups[`group_${tabId}`];
    saveGroups(newGroups);

    await sendServiceWorkerRequest('DELETE_TREE_GROUP', { tabId });
  }, [groups, saveGroups]);

  const updateGroupFn = useCallback((tabId: number, updates: Partial<Group>) => {
    const groupKey = `group_${tabId}`;
    const group = groups[groupKey];
    if (!group) return;

    const updatedGroup = { ...group, ...updates };
    const newGroups = { ...groups, [groupKey]: updatedGroup };
    saveGroups(newGroups);
  }, [groups, saveGroups]);

  const toggleGroupExpanded = useCallback((tabId: number) => {
    const groupKey = `group_${tabId}`;
    const group = groups[groupKey];
    if (!group) return;

    const updatedGroup = { ...group, isExpanded: !group.isExpanded };
    const newGroups = { ...groups, [groupKey]: updatedGroup };
    saveGroups(newGroups);
  }, [groups, saveGroups]);

  const addTabToGroup = useCallback(async (tabId: number, targetGroupTabId: number) => {
    await sendServiceWorkerRequest('ADD_TAB_TO_TREE_GROUP', { tabId, targetGroupTabId });
  }, []);

  const removeTabFromGroup = useCallback(async (tabId: number) => {
    await sendServiceWorkerRequest('REMOVE_TAB_FROM_TREE_GROUP', { tabId });
  }, []);

  const getGroupTabCount = useCallback((tabId: number): number => {
    if (!currentViewState) return 0;

    const findNode = (nodes: TabNode[], targetTabId: number): TabNode | null => {
      for (const node of nodes) {
        if (node.tabId === targetTabId) return node;
        const found = findNode(node.children, targetTabId);
        if (found) return found;
      }
      return null;
    };

    const node = findNode(currentViewState.rootNodes, tabId);
    return node?.children.length ?? 0;
  }, [currentViewState]);

  const isTabUnread = useCallback((tabId: number): boolean => {
    return unreadTabIds.has(tabId);
  }, [unreadTabIds]);

  const getUnreadCount = useCallback((): number => {
    return unreadTabIds.size;
  }, [unreadTabIds]);

  const getUnreadChildCount = useCallback((tabId: number): number => {
    if (!currentViewState) return 0;

    const findNode = (nodes: TabNode[], targetTabId: number): TabNode | null => {
      for (const node of nodes) {
        if (node.tabId === targetTabId) return node;
        const found = findNode(node.children, targetTabId);
        if (found) return found;
      }
      return null;
    };

    const node = findNode(currentViewState.rootNodes, tabId);
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
    if (!currentWindowState) return [];
    const currentView = currentWindowState.views[currentViewIndex];
    return currentView?.pinnedTabIds ?? [];
  }, [currentWindowState, currentViewIndex]);

  const handlePinnedTabReorder = useCallback(async (tabId: number, newIndex: number): Promise<void> => {
    if (currentWindowId === null) return;

    try {
      await sendServiceWorkerRequest('REORDER_PINNED_TAB', { tabId, newIndex });
    } catch (error) {
      console.error('Failed to reorder pinned tab:', error);
    }
  }, [currentWindowId]);

  const handleViewReorder = useCallback(async (viewIndex: number, newIndex: number): Promise<void> => {
    if (currentWindowId === null) return;

    try {
      await sendServiceWorkerRequest('REORDER_VIEW', { viewIndex, newIndex, windowId: currentWindowId });
    } catch (error) {
      console.error('Failed to reorder view:', error);
    }
  }, [currentWindowId]);

  const selectNode = useCallback((tabId: number, modifiers: { shift: boolean; ctrl: boolean }) => {
    if (!currentViewState) return;

    const findNode = (nodes: TabNode[], targetTabId: number): boolean => {
      for (const node of nodes) {
        if (node.tabId === targetTabId) return true;
        if (findNode(node.children, targetTabId)) return true;
      }
      return false;
    };

    if (!findNode(currentViewState.rootNodes, tabId)) return;

    if (modifiers.ctrl) {
      setSelectedTabIds(prev => {
        const newSet = new Set(prev);
        if (newSet.has(tabId)) {
          newSet.delete(tabId);
        } else {
          newSet.add(tabId);
        }
        return newSet;
      });
      setLastSelectedTabId(tabId);
    } else if (modifiers.shift && lastSelectedTabId) {
      const pinnedTabIdSet = new Set(pinnedTabIds);
      const currentWindowTabIds = new Set<number>();
      if (currentWindowId !== null) {
        Object.values(tabInfoMap).forEach(tabInfo => {
          if (tabInfo.windowId === currentWindowId) {
            currentWindowTabIds.add(tabInfo.id);
          }
        });
      }

      const tabIdsInDisplayOrder: number[] = [];
      const collectNodesInOrder = (nodes: TabNode[]) => {
        for (const node of nodes) {
          if (pinnedTabIdSet.has(node.tabId)) continue;
          if (currentWindowId !== null && !currentWindowTabIds.has(node.tabId)) continue;
          if (!tabInfoMap[node.tabId]) continue;

          tabIdsInDisplayOrder.push(node.tabId);

          if (node.isExpanded && node.children) {
            collectNodesInOrder(node.children);
          }
        }
      };

      collectNodesInOrder(currentViewState.rootNodes);

      const lastIndex = tabIdsInDisplayOrder.indexOf(lastSelectedTabId);
      const currentIndex = tabIdsInDisplayOrder.indexOf(tabId);

      if (lastIndex !== -1 && currentIndex !== -1) {
        const startIndex = Math.min(lastIndex, currentIndex);
        const endIndex = Math.max(lastIndex, currentIndex);
        const rangeTabIds = tabIdsInDisplayOrder.slice(startIndex, endIndex + 1);
        setSelectedTabIds(new Set(rangeTabIds));
      } else {
        setSelectedTabIds(new Set([tabId]));
        setLastSelectedTabId(tabId);
      }
    } else {
      setSelectedTabIds(new Set([tabId]));
      setLastSelectedTabId(tabId);
    }
  }, [currentViewState, lastSelectedTabId, tabInfoMap, pinnedTabIds, currentWindowId]);

  const clearSelection = useCallback(() => {
    setSelectedTabIds(new Set());
    setLastSelectedTabId(null);
  }, []);

  const isNodeSelected = useCallback((tabId: number): boolean => {
    return selectedTabIds.has(tabId);
  }, [selectedTabIds]);

  const getSelectedTabIds = useCallback((): number[] => {
    if (!currentViewState || selectedTabIds.size === 0) {
      return [];
    }

    const tabIdsInTreeOrder: number[] = [];
    const collectNodesInOrder = (nodes: TabNode[]) => {
      for (const node of nodes) {
        if (selectedTabIds.has(node.tabId)) {
          tabIdsInTreeOrder.push(node.tabId);
        }
        collectNodesInOrder(node.children);
      }
    };
    collectNodesInOrder(currentViewState.rootNodes);

    return tabIdsInTreeOrder;
  }, [selectedTabIds, currentViewState]);

  const viewTabCounts = useMemo((): number[] => {
    if (!currentWindowState) return [];

    const countNodes = (nodes: TabNode[]): number => {
      let count = 0;
      for (const node of nodes) {
        const tabInfo = tabInfoMap[node.tabId];
        if (tabInfo && (currentWindowId === null || tabInfo.windowId === currentWindowId)) {
          count++;
        }
        count += countNodes(node.children);
      }
      return count;
    };

    return currentWindowState.views.map((viewState) => {
      const pinnedCount = viewState.pinnedTabIds.filter((tabId) => {
        const tabInfo = tabInfoMap[tabId];
        return tabInfo && (currentWindowId === null || tabInfo.windowId === currentWindowId);
      }).length;
      return countNodes(viewState.rootNodes) + pinnedCount;
    });
  }, [currentWindowState, tabInfoMap, currentWindowId]);

  const moveTabsToView = useCallback(async (viewIndex: number, tabIds: number[]) => {
    if (currentWindowId === null) return;
    await sendServiceWorkerRequest('MOVE_TABS_TO_VIEW', { targetViewIndex: viewIndex, tabIds, windowId: currentWindowId });
  }, [currentWindowId]);

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
        handleViewReorder,
        selectedTabIds,
        lastSelectedTabId,
        selectNode,
        clearSelection,
        isNodeSelected,
        getSelectedTabIds,
        viewTabCounts,
        moveTabsToView,
        currentWindowId,
        currentViewIndex,
        views,
        currentWindowState,
      }}
    >
      {children}
    </TreeStateContext.Provider>
  );
};

export default TreeStateProvider;
