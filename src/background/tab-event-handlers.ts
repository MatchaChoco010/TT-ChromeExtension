/**
 * Chromeのタブ・webNavigationイベントの処理
 */
import { storageService, treeStateManager, unreadTracker, titlePersistence } from './background-services';
import { pendingTabParents, pendingDuplicateSources, pendingLinkClicks, restoringTabIds, lastActiveTabByWindow, detachedPinnedTabsByWindow, snapshotRestoreState } from './pending-state';
import { trackHandler, waitForTreeStateInitialization, runEventHandler } from './handler-tracking';
import { isGroupTabUrl, isSidePanelUrl } from '@/utils/extension-urls';
import { getSettingsWithDefaults } from './tab-position-settings';
import { STORAGE_KEYS } from '@/storage/StorageService';
import { ignoreMissingTabOrWindow } from '@/utils/chrome-errors';

export function registerTabEventListeners(): void {
  chrome.tabs.onCreated.addListener((tab) => {
    trackHandler(() => handleTabCreated(tab)).catch((error: unknown) => {
      console.error('[tabs.onCreated] Handler failed:', error);
    });
  });
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    runEventHandler('tabs.onRemoved', () => handleTabRemoved(tabId, removeInfo));
  });
  chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
    runEventHandler('tabs.onMoved', () => handleTabMoved(tabId, moveInfo));
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    runEventHandler('tabs.onUpdated', () => handleTabUpdated(tabId, changeInfo, tab));
  });
  chrome.tabs.onActivated.addListener((activeInfo) => {
    runEventHandler('tabs.onActivated', () => handleTabActivated(activeInfo));
  });
  chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
    runEventHandler('tabs.onDetached', () => handleTabDetached(tabId, detachInfo));
  });
  chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
    runEventHandler('tabs.onAttached', () => handleTabAttached(tabId, attachInfo));
  });
  chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    runEventHandler('tabs.onReplaced', () => handleTabReplaced(addedTabId, removedTabId));
  });
}

export function registerWebNavigationListeners(): void {
  chrome.webNavigation.onCreatedNavigationTarget.addListener((details) => {
    handleCreatedNavigationTarget(details);
  });
}

function handleCreatedNavigationTarget(
  details: chrome.webNavigation.WebNavigationSourceCallbackDetails
): void {
  pendingLinkClicks.set(details.tabId, details.sourceTabId);

  setTimeout(() => {
    pendingLinkClicks.delete(details.tabId);
  }, 5000);
}

export async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) {
    return;
  }

  const arrivedBeforeInitialization = !treeStateManager.isInitialized();

  // onActivatedがmapを更新する前に値を取得
  const capturedLastActiveTabId = tab.windowId !== undefined
    ? lastActiveTabByWindow.get(tab.windowId)
    : undefined;

  await waitForTreeStateInitialization(`tabs.onCreated(${tab.id})`);

  // ブラウザ再起動時のセッション復元で作成されたタブは、restoreStateAfterRestartで既存ノードに対応付けている
  if (arrivedBeforeInitialization && treeStateManager.wasRestoredFromPreviousBrowserSession()) {
    return;
  }

  const existingNode = treeStateManager.getNodeByTabId(tab.id);
  if (existingNode) {
    return;
  }

  // グループタブはcreateGroupWithRealTab・restoreGroupTabsがツリーに登録する
  if (isGroupTabUrl(tab.url) || isGroupTabUrl(tab.pendingUrl)) {
    return;
  }

  if (isSidePanelUrl(tab.url) || isSidePanelUrl(tab.pendingUrl)) {
    return;
  }

  if (snapshotRestoreState.inProgress || restoringTabIds.has(tab.id)) {
    restoringTabIds.delete(tab.id);
    return;
  }

  const tabIdForCheck = tab.id;
  const isDetachedPinnedTab = Array.from(detachedPinnedTabsByWindow.values()).some(
    tabIds => tabIds.has(tabIdForCheck)
  );
  if (isDetachedPinnedTab) {
    return;
  }

  const currentTab = await ignoreMissingTabOrWindow(chrome.tabs.get(tab.id));
  if (!currentTab) {
    return;
  }
  if (currentTab.pinned) {
    if (!treeStateManager.isPinnedTabInAnyView(tab.id, currentTab.windowId)) {
      treeStateManager.updatePinnedStateFromChromeEvent(tab.id, currentTab.windowId, true);
    }
    return;
  }

  // ウィンドウが閉じられる時にChromeがアンピンして移動したタブを検出
  if (tab.windowId !== undefined && !tab.openerTabId) {
    const allWindowStates = treeStateManager.getAllWindowStates();
    for (const windowState of allWindowStates) {
      if (windowState.windowId === tab.windowId) continue;
      const activeViewState = windowState.views[windowState.activeViewIndex];
      if (!activeViewState || activeViewState.pinnedTabIds.length === 0) continue;

      const pinnedTabsWindow = await ignoreMissingTabOrWindow(chrome.windows.get(windowState.windowId));
      if (!pinnedTabsWindow) {
        // ウィンドウが閉じられている途中なので、移動されたタブを閉じる
        await ignoreMissingTabOrWindow(chrome.tabs.remove(tab.id));
        return;
      }
    }
  }

  try {
    const rawSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const effectiveSettings = getSettingsWithDefaults(rawSettings);

    let openerTabIdFromChrome: number | undefined = tab.openerTabId;
    if (openerTabIdFromChrome === undefined) {
      const freshTab = await ignoreMissingTabOrWindow(chrome.tabs.get(tab.id));
      openerTabIdFromChrome = freshTab?.openerTabId;
    }

    const pendingOpenerTabId = pendingTabParents.get(tab.id);

    let newTabPosition: 'child' | 'nextSibling' | 'lastSibling' | 'end';

    const linkClickSourceTabId = pendingLinkClicks.get(tab.id);
    const isLinkClick = linkClickSourceTabId !== undefined;

    const effectiveOpenerTabId = isLinkClick
      ? linkClickSourceTabId
      : (pendingOpenerTabId || openerTabIdFromChrome);

    if (isLinkClick) {
      pendingLinkClicks.delete(tab.id);
    }

    if (isLinkClick) {
      newTabPosition = effectiveSettings.newTabPositionFromLink;
    } else {
      newTabPosition = effectiveSettings.newTabPositionManual;
    }

    let parentTabId: number | null = null;

    let isDuplicatedTab = false;
    let duplicateSourceTabId: number | null = null;
    let isSubtreeDuplicate = false;

    const tabUrl = tab.url || tab.pendingUrl || '';
    for (const [sourceTabId, sourceInfo] of pendingDuplicateSources.entries()) {
      if (sourceInfo.url === tabUrl && sourceInfo.windowId === tab.windowId) {
        isDuplicatedTab = true;
        duplicateSourceTabId = sourceTabId;
        isSubtreeDuplicate = sourceInfo.isSubtreeDuplicate;
        pendingDuplicateSources.delete(sourceTabId);
        break;
      }
    }

    const duplicateTabPosition = effectiveSettings.duplicateTabPosition;

    let insertAfterTabId: number | undefined;
    if (isDuplicatedTab && duplicateSourceTabId !== null) {
      if (duplicateTabPosition === 'nextSibling') {
        const openerResult = treeStateManager.getNodeByTabId(duplicateSourceTabId);
        if (openerResult) {
          parentTabId = treeStateManager.getParentTabId(duplicateSourceTabId);
          insertAfterTabId = duplicateSourceTabId;
        }
      }
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'child') {
      const parentResult = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (parentResult) {
        parentTabId = effectiveOpenerTabId;
      }
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'nextSibling') {
      const openerResult = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (openerResult) {
        parentTabId = treeStateManager.getParentTabId(effectiveOpenerTabId);
        insertAfterTabId = effectiveOpenerTabId;
      }
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'lastSibling') {
      const openerResult = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (openerResult) {
        parentTabId = treeStateManager.getParentTabId(effectiveOpenerTabId);
        insertAfterTabId = treeStateManager.getLastSiblingTabId(effectiveOpenerTabId);
      }
    } else if (!isLinkClick && pendingOpenerTabId) {
      const parentResult = treeStateManager.getNodeByTabId(pendingOpenerTabId);
      if (parentResult) {
        parentTabId = pendingOpenerTabId;
      }
    } else if (!isLinkClick && newTabPosition === 'child') {
      if (capturedLastActiveTabId !== undefined && capturedLastActiveTabId !== tab.id) {
        const lastActiveResult = treeStateManager.getNodeByTabId(capturedLastActiveTabId);
        if (lastActiveResult) {
          parentTabId = capturedLastActiveTabId;
        }
      }
    } else if (!isLinkClick && newTabPosition === 'nextSibling') {
      if (capturedLastActiveTabId !== undefined && capturedLastActiveTabId !== tab.id) {
        const lastActiveResult = treeStateManager.getNodeByTabId(capturedLastActiveTabId);
        if (lastActiveResult) {
          parentTabId = treeStateManager.getParentTabId(capturedLastActiveTabId);
          insertAfterTabId = capturedLastActiveTabId;
        }
      }
    } else if (!isLinkClick && newTabPosition === 'lastSibling') {
      if (capturedLastActiveTabId !== undefined && capturedLastActiveTabId !== tab.id) {
        const lastActiveResult = treeStateManager.getNodeByTabId(capturedLastActiveTabId);
        if (lastActiveResult) {
          parentTabId = treeStateManager.getParentTabId(capturedLastActiveTabId);
          insertAfterTabId = treeStateManager.getLastSiblingTabId(capturedLastActiveTabId);
        }
      }
    }

    if (pendingOpenerTabId) {
      pendingTabParents.delete(tab.id);
    }

    const isNormalDuplicate = isDuplicatedTab && !isSubtreeDuplicate;

    await treeStateManager.addTab(tab, parentTabId, tab.windowId!, undefined, insertAfterTabId);

    // 複製タブは元のタブが見えている=親は既に展開済みなのでスキップ
    if (parentTabId && !isDuplicatedTab) {
      await treeStateManager.expandNode(parentTabId);
    }

    if (!tab.active && tab.id) {
      await unreadTracker.markAsUnread(tab.id);
    }

    if (!isNormalDuplicate) {
      await treeStateManager.syncTreeStateToChromeTabs();
    }

    treeStateManager.notifyStateChanged();
  } catch (error) {
    console.error('[handleTabCreated] Error:', error);
  }
}

export async function handleTabRemoved(
  tabId: number,
  removeInfo: chrome.tabs.OnRemovedInfo,
): Promise<void> {
  const { isWindowClosing } = removeInfo;

  if (isWindowClosing) {
    if (unreadTracker.isUnread(tabId)) {
      await unreadTracker.markAsRead(tabId);
    }
    titlePersistence.removeTitle(tabId);
    treeStateManager.notifyStateChanged();
    return;
  }

  const rawSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
  const effectiveSettings = getSettingsWithDefaults(rawSettings);

  await treeStateManager.removeTab(tabId, effectiveSettings.childTabBehavior);

  if (unreadTracker.isUnread(tabId)) {
    await unreadTracker.markAsRead(tabId);
  }

  titlePersistence.removeTitle(tabId);

  await treeStateManager.syncTreeStateToChromeTabs();

  // ビューの最後のタブを閉じた時、Chromeが別ビューのタブをアクティブにする問題に対応
  const { windowId } = removeInfo;
  const viewTabIds = treeStateManager.getViewTabIds(windowId);
  if (viewTabIds.length > 0) {
    const [activeTab] = await chrome.tabs.query({ active: true, windowId });
    const isActiveTabInOtherView = activeTab?.id !== undefined &&
      !viewTabIds.includes(activeTab.id) &&
      (treeStateManager.getNodeByTabId(activeTab.id)?.windowId === windowId ||
        treeStateManager.isPinnedTabInAnyView(activeTab.id, windowId));
    if (isActiveTabInOtherView) {
      const lastTabId = viewTabIds[viewTabIds.length - 1];
      await ignoreMissingTabOrWindow(chrome.tabs.update(lastTabId, { active: true }));
    }
  }

  treeStateManager.notifyStateChanged();
}

export async function handleTabMoved(
  tabId: number,
  moveInfo: chrome.tabs.OnMovedInfo,
): Promise<void> {
  // ピン留め操作時はonMoved→onUpdatedの順でイベントが発火し、TreeStateに未反映のため判定
  const tab = await ignoreMissingTabOrWindow(chrome.tabs.get(tabId));
  if (tab?.pinned && !treeStateManager.isPinnedTabInAnyView(tabId, tab.windowId)) {
    treeStateManager.notifyStateChanged();
    return;
  }

  await treeStateManager.syncTreeStateToChromeTabs(moveInfo.windowId);
  treeStateManager.notifyStateChanged();
}

export async function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  if (changeInfo.title !== undefined && tab.title) {
    titlePersistence.saveTitle(tabId, tab.title);
  }

  if (changeInfo.favIconUrl && tab.url) {
    const storedFavicons = await storageService.get(STORAGE_KEYS.TAB_FAVICONS);
    await storageService.set(STORAGE_KEYS.TAB_FAVICONS, {
      ...storedFavicons,
      [tab.url]: changeInfo.favIconUrl,
    });
  }

  if (changeInfo.pinned !== undefined) {
    treeStateManager.updatePinnedStateFromChromeEvent(tabId, tab.windowId, changeInfo.pinned);
  }

  if (
    changeInfo.title !== undefined ||
    changeInfo.url !== undefined ||
    changeInfo.status !== undefined ||
    changeInfo.favIconUrl !== undefined ||
    changeInfo.discarded !== undefined ||
    changeInfo.pinned !== undefined
  ) {
    treeStateManager.notifyStateChanged();
  }
}

export async function handleTabActivated(activeInfo: chrome.tabs.OnActivatedInfo): Promise<void> {
  lastActiveTabByWindow.set(activeInfo.windowId, activeInfo.tabId);

  if (unreadTracker.isUnread(activeInfo.tabId)) {
    await unreadTracker.markAsRead(activeInfo.tabId);
    treeStateManager.notifyStateChanged();
  }
}

export async function handleTabDetached(
  tabId: number,
  detachInfo: chrome.tabs.OnDetachedInfo,
): Promise<void> {
  const tab = await ignoreMissingTabOrWindow(chrome.tabs.get(tabId));
  if (!tab) {
    return;
  }
  if (tab.pinned) {
    const oldWindowId = detachInfo.oldWindowId;
    const detachedTabIds = detachedPinnedTabsByWindow.get(oldWindowId) ?? new Set<number>();
    detachedTabIds.add(tabId);
    detachedPinnedTabsByWindow.set(oldWindowId, detachedTabIds);
  }

  treeStateManager.notifyStateChanged();
}

export async function handleTabAttached(
  tabId: number,
  attachInfo: chrome.tabs.OnAttachedInfo,
): Promise<void> {
  const isDetachedPinnedTab = Array.from(detachedPinnedTabsByWindow.values()).some(
    tabIds => tabIds.has(tabId)
  );

  if (!isDetachedPinnedTab) {
    const parentTabId = await treeStateManager.getParentTabId(tabId);
    let parentInSameWindow = false;

    if (parentTabId !== null) {
      const parentTab = await ignoreMissingTabOrWindow(chrome.tabs.get(parentTabId));
      parentInSameWindow = parentTab?.windowId === attachInfo.newWindowId;
    }

    if (!parentInSameWindow) {
      await treeStateManager.moveTabToRootEnd(tabId, attachInfo.newWindowId);
    }

    await treeStateManager.syncTreeStateToChromeTabs(attachInfo.newWindowId);
  }

  for (const [windowId, tabIds] of detachedPinnedTabsByWindow.entries()) {
    if (tabIds.has(tabId)) {
      const sourceWindow = await ignoreMissingTabOrWindow(chrome.windows.get(windowId));
      if (sourceWindow) {
        tabIds.delete(tabId);
        if (tabIds.size === 0) {
          detachedPinnedTabsByWindow.delete(windowId);
        }
      }
      break;
    }
  }

  treeStateManager.notifyStateChanged();
}

export async function handleTabReplaced(
  addedTabId: number,
  removedTabId: number,
): Promise<void> {
  await treeStateManager.replaceTabId(removedTabId, addedTabId);
  treeStateManager.notifyStateChanged();
}
