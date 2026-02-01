import type { MessageType, MessageResponse, TabNode, UserSettings } from '@/types';
import { TreeStateManager } from '@/services/TreeStateManager';
import { UnreadTracker } from '@/services/UnreadTracker';
import { TitlePersistenceService } from '@/services/TitlePersistenceService';
import { SnapshotManager } from '@/services/SnapshotManager';
import { StorageService, STORAGE_KEYS } from '@/storage/StorageService';
import { downloadService } from '@/storage/DownloadService';

const TAB_POSITION_DEFAULTS = {
  newTabPositionFromLink: 'child' as const,
  newTabPositionManual: 'end' as const,
  duplicateTabPosition: 'nextSibling' as const,
};

function getSettingsWithDefaults(settings: UserSettings | null): {
  newTabPositionFromLink: 'child' | 'nextSibling' | 'lastSibling' | 'end';
  newTabPositionManual: 'child' | 'nextSibling' | 'lastSibling' | 'end';
  duplicateTabPosition: 'nextSibling' | 'end';
  childTabBehavior: 'promote' | 'close_all';
} {
  const migratePosition = (pos: string | undefined, defaultValue: string): string => {
    if (pos === 'sibling') return 'nextSibling';
    return pos ?? defaultValue;
  };

  return {
    newTabPositionFromLink: migratePosition(settings?.newTabPositionFromLink, TAB_POSITION_DEFAULTS.newTabPositionFromLink) as 'child' | 'nextSibling' | 'lastSibling' | 'end',
    newTabPositionManual: migratePosition(settings?.newTabPositionManual, TAB_POSITION_DEFAULTS.newTabPositionManual) as 'child' | 'nextSibling' | 'lastSibling' | 'end',
    duplicateTabPosition: migratePosition(settings?.duplicateTabPosition, TAB_POSITION_DEFAULTS.duplicateTabPosition) as 'nextSibling' | 'end',
    childTabBehavior: settings?.childTabBehavior ?? 'promote',
  };
}

const storageService = new StorageService();
const treeStateManager = new TreeStateManager(storageService);
const unreadTracker = new UnreadTracker(storageService);
const titlePersistence = new TitlePersistenceService(storageService);
const snapshotManager = new SnapshotManager(downloadService, storageService);

unreadTracker.loadFromStorage().catch(() => {});

titlePersistence.loadFromStorage().catch(() => {});

declare global {
  var treeStateManager: TreeStateManager;
}

globalThis.treeStateManager = treeStateManager;

export { storageService as testStorageService, treeStateManager as testTreeStateManager, unreadTracker as testUnreadTracker, titlePersistence as testTitlePersistence, snapshotManager as testSnapshotManager };

/**
 * イベントハンドラー完了追跡システム（E2Eテスト用）
 *
 * Chromeはイベントリスナーのコールバック完了を待たない。
 * そのため、テストでタブを閉じた後すぐにリセット処理を開始すると、
 * handleTabRemoved等のハンドラーがバックグラウンドで実行中のまま
 * 状態がクリアされ、競合が発生する。
 *
 * Service Workerの全ての非同期イベントハンドラーはtrackHandler()で
 * ラップする必要がある。
 */
let pendingHandlerCount = 0;
let pendingHandlerResolvers: (() => void)[] = [];


/**
 * 非同期イベントハンドラーをラップして完了を追跡する（E2Eテスト用）
 */
export async function trackHandler<T>(fn: () => Promise<T>): Promise<T> {
  pendingHandlerCount++;
  try {
    return await fn();
  } finally {
    pendingHandlerCount--;
    if (pendingHandlerCount === 0) {
      const resolvers = pendingHandlerResolvers;
      pendingHandlerResolvers = [];
      resolvers.forEach(resolve => resolve());
    }
  }
}

/**
 * 全ての実行中イベントハンドラーの完了を待機する（E2Eテスト専用）
 */
async function waitForPendingHandlers(timeoutMs: number = 5000): Promise<void> {
  if (pendingHandlerCount === 0) {
    return;
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      const index = pendingHandlerResolvers.indexOf(wrappedResolve);
      if (index !== -1) {
        pendingHandlerResolvers.splice(index, 1);
      }
      reject(new Error(
        `waitForPendingHandlers timed out after ${timeoutMs}ms. ` +
        `${pendingHandlerCount} handler(s) still running.`
      ));
    }, timeoutMs);

    const wrappedResolve = () => {
      clearTimeout(timeoutId);
      resolve();
    };

    pendingHandlerResolvers.push(wrappedResolve);
  });
}

/**
 * E2Eテスト用のリセット関数
 *
 * この関数はE2Eテストのextension.ts内autoResetフィクスチャのリセット処理
 * 時のみに使用すること。以下の使用は禁止:
 * - createTab, closeTab等のタブ操作関数内での状態同期待機
 * - 個別のテストケース内での直接呼び出し
 * - 本番コードからの呼び出し
 *
 * 理由: 内部状態（ハンドラー完了）への依存はフレーキーさの原因となる。
 * タブ操作後の状態確認は必ずassertTabStructure等のUI検証関数を使用すること。
 */
async function prepareForReset(): Promise<void> {
  await waitForPendingHandlers();
  isCreatingGroupTab = false;
  isRestoringSnapshot = false;
  restoringTabIds.clear();
  lastActiveTabByWindow.clear();
  detachedPinnedTabsByWindow.clear();
  dragState = null;
}

let dragState: { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null =
  null;

const pendingTabParents = new Map<number, number>();

const pendingDuplicateSources = new Map<number, { url: string; windowId: number; isSubtreeDuplicate: boolean }>();

const pendingGroupTabIds = new Set<number>();

let isCreatingGroupTab = false;

const lastActiveTabByWindow = new Map<number, number>();

const pendingLinkClicks = new Map<number, number>();

const restoringTabIds = new Set<number>();

let isRestoringSnapshot = false;

declare global {

  var pendingTabParents: Map<number, number>;

  var pendingDuplicateSources: Map<number, { url: string; windowId: number; isSubtreeDuplicate: boolean }>;

  var pendingGroupTabIds: Set<number>;

  var pendingLinkClicks: Map<number, number>;

  var treeStateManager: TreeStateManager;

  function prepareForReset(): Promise<void>;
  function waitForHandlers(): Promise<void>;
}
globalThis.pendingTabParents = pendingTabParents;
globalThis.pendingDuplicateSources = pendingDuplicateSources;
globalThis.pendingGroupTabIds = pendingGroupTabIds;
globalThis.pendingLinkClicks = pendingLinkClicks;
globalThis.treeStateManager = treeStateManager;
globalThis.prepareForReset = prepareForReset;
globalThis.waitForHandlers = waitForPendingHandlers;

export function registerTabEventListeners(): void {
  chrome.tabs.onCreated.addListener((tab) => {
    trackHandler(() => handleTabCreated(tab));
  });
  chrome.tabs.onRemoved.addListener((tabId, removeInfo) => {
    trackHandler(() => handleTabRemoved(tabId, removeInfo));
  });
  chrome.tabs.onMoved.addListener((tabId, moveInfo) => {
    trackHandler(() => handleTabMoved(tabId, moveInfo));
  });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    trackHandler(() => handleTabUpdated(tabId, changeInfo, tab));
  });
  chrome.tabs.onActivated.addListener((activeInfo) => {
    trackHandler(() => handleTabActivated(activeInfo));
  });
  chrome.tabs.onDetached.addListener((tabId, detachInfo) => {
    trackHandler(() => handleTabDetached(tabId, detachInfo));
  });
  chrome.tabs.onAttached.addListener((tabId, attachInfo) => {
    trackHandler(() => handleTabAttached(tabId, attachInfo));
  });
  chrome.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
    trackHandler(() => handleTabReplaced(addedTabId, removedTabId));
  });
}

export function registerWindowEventListeners(): void {
  chrome.windows.onCreated.addListener((window) => {
    trackHandler(() => handleWindowCreated(window));
  });
  chrome.windows.onRemoved.addListener((windowId) => {
    trackHandler(() => handleWindowRemoved(windowId));
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

export function registerMessageListener(): void {
  chrome.runtime.onMessage.addListener(handleMessage);
}


function isOwnExtensionUrl(url: string | undefined, path: string): boolean {
  if (!url) return false;
  const extensionBaseUrl = `chrome-extension://${chrome.runtime.id}`;
  return url === `${extensionBaseUrl}/${path}` || url.startsWith(`${extensionBaseUrl}/${path}?`);
}

function isGroupTabUrl(url: string | undefined): boolean {
  return isOwnExtensionUrl(url, 'group.html');
}

function isSidePanelUrl(url: string | undefined): boolean {
  return isOwnExtensionUrl(url, 'sidepanel.html');
}

export async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {
  if (!tab.id) {
    return;
  }

  // waitForInitialization()の前にフラグをキャプチャ（待機中にフラグがfalseに変わるため）
  const wasTriggeredDuringRestore = treeStateManager.isRestoringState;

  // onActivatedがmapを更新する前に値を取得
  const capturedLastActiveTabId = tab.windowId !== undefined
    ? lastActiveTabByWindow.get(tab.windowId)
    : undefined;

  const initialized = treeStateManager.isInitialized();
  if (!initialized) {
    const completed = await treeStateManager.waitForInitialization(15000);
    if (!completed) {
      throw new Error(`Initialization did not complete within timeout for tab ${tab.id}`);
    }
  }

  if (wasTriggeredDuringRestore) {
    return;
  }

  const existingNode = treeStateManager.getNodeByTabId(tab.id);
  if (existingNode) {
    return;
  }

  if (isCreatingGroupTab) {
    await new Promise(resolve => setTimeout(resolve, 50));
    if (pendingGroupTabIds.has(tab.id)) {
      pendingGroupTabIds.delete(tab.id);
      return;
    }
    const refreshedTab = await chrome.tabs.get(tab.id);
    if (isGroupTabUrl(refreshedTab.url) || isGroupTabUrl(refreshedTab.pendingUrl)) {
      return;
    }
  }

  if (pendingGroupTabIds.has(tab.id)) {
    pendingGroupTabIds.delete(tab.id);
    return;
  }
  if (isGroupTabUrl(tab.url) || isGroupTabUrl(tab.pendingUrl)) {
    return;
  }

  if (isSidePanelUrl(tab.url) || isSidePanelUrl(tab.pendingUrl)) {
    return;
  }

  const isUrlIndeterminate = (!tab.url && !tab.pendingUrl) ||
    ((!tab.url || tab.url === 'about:blank') && (!tab.pendingUrl || tab.pendingUrl === 'about:blank'));
  if (isUrlIndeterminate) {
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 50));
      try {
        const refreshedTab = await chrome.tabs.get(tab.id);
        if (!refreshedTab) {
          break;
        }
        const actualUrl = refreshedTab.url || refreshedTab.pendingUrl || '';
        if (actualUrl && actualUrl !== 'about:blank') {
          if (isSidePanelUrl(refreshedTab.url) || isSidePanelUrl(refreshedTab.pendingUrl)) {
            return;
          }
          if (isGroupTabUrl(refreshedTab.url) || isGroupTabUrl(refreshedTab.pendingUrl)) {
            return;
          }
          break;
        }
      } catch {
        return;
      }
    }
  }

  if (isRestoringSnapshot || restoringTabIds.has(tab.id)) {
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

  try {
    const currentTab = await chrome.tabs.get(tab.id);
    if (currentTab.pinned) {
      if (currentTab.windowId !== undefined) {
        if (!treeStateManager.isPinnedTabInAnyView(tab.id, currentTab.windowId)) {
          treeStateManager.updatePinnedStateFromChromeEvent(tab.id, currentTab.windowId, true);
        }
      }
      return;
    }
  } catch {
    // タブが既に閉じられている場合
  }

  // ウィンドウが閉じられる時にChromeがアンピンして移動したタブを検出
  if (tab.windowId !== undefined && !tab.openerTabId) {
    const allWindowStates = treeStateManager.getAllWindowStates();
    for (const windowState of allWindowStates) {
      if (windowState.windowId === tab.windowId) continue;
      const activeViewState = windowState.views[windowState.activeViewIndex];
      if (!activeViewState || activeViewState.pinnedTabIds.length === 0) continue;

      try {
        await chrome.windows.get(windowState.windowId);
      } catch {
        // ウィンドウが閉じられている途中なので、移動されたタブを閉じる
        try {
          await chrome.tabs.remove(tab.id);
        } catch {
          // タブが既に閉じられている
        }
        return;
      }
    }
  }

  try {
    const rawSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const effectiveSettings = getSettingsWithDefaults(rawSettings);

    let openerTabIdFromChrome: number | undefined = tab.openerTabId;
    if (openerTabIdFromChrome === undefined) {
      try {
        const freshTab = await chrome.tabs.get(tab.id);
        openerTabIdFromChrome = freshTab?.openerTabId;
      } catch {
        // タブが既に閉じられている
      }
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
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, windowId });
      if (activeTab && activeTab.id !== undefined && !viewTabIds.includes(activeTab.id)) {
        const lastTabId = viewTabIds[viewTabIds.length - 1];
        await chrome.tabs.update(lastTabId, { active: true });
      }
    } catch {
      // タブが存在しない
    }
  }

  treeStateManager.notifyStateChanged();
}

export async function handleTabMoved(
  tabId: number,
  moveInfo: chrome.tabs.OnMovedInfo,
): Promise<void> {
  // ピン留め操作時はonMoved→onUpdatedの順でイベントが発火し、TreeStateに未反映のため判定
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.pinned && tab.windowId !== undefined) {
      const isPinnedInTreeState = treeStateManager.isPinnedTabInAnyView(tabId, tab.windowId);
      if (!isPinnedInTreeState) {
        treeStateManager.notifyStateChanged();
        return;
      }
    }
  } catch {
    // タブが存在しない
  }

  try {
    await treeStateManager.syncTreeStateToChromeTabs(moveInfo.windowId);
  } catch {
    // 同期失敗
  }
  treeStateManager.notifyStateChanged();
}

export async function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.OnUpdatedInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  try {
    if (changeInfo.title !== undefined && tab.title) {
      titlePersistence.saveTitle(tabId, tab.title);
    }

    if (changeInfo.favIconUrl !== undefined && changeInfo.favIconUrl !== null && changeInfo.favIconUrl !== '' && tab.url) {
      try {
        const storedFaviconsResult = await storageService.get(STORAGE_KEYS.TAB_FAVICONS);
        const favicons = storedFaviconsResult ? { ...storedFaviconsResult } : {};
        favicons[tab.url] = changeInfo.favIconUrl;
        await storageService.set(STORAGE_KEYS.TAB_FAVICONS, favicons);
      } catch {
        // ファビコン保存失敗
      }
    }

    if (changeInfo.pinned !== undefined && tab.windowId !== undefined) {
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
  } catch {
    // タブ更新処理失敗
  }
}

async function handleTabActivated(activeInfo: chrome.tabs.OnActivatedInfo): Promise<void> {
  try {
    lastActiveTabByWindow.set(activeInfo.windowId, activeInfo.tabId);

    if (unreadTracker.isUnread(activeInfo.tabId)) {
      await unreadTracker.markAsRead(activeInfo.tabId);

      treeStateManager.notifyStateChanged();
    }
  } catch {
    // タブアクティブ化処理失敗
  }
}

const detachedPinnedTabsByWindow = new Map<number, Set<number>>();

async function handleTabDetached(
  tabId: number,
  detachInfo: chrome.tabs.OnDetachedInfo,
): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.pinned) {
      const oldWindowId = detachInfo.oldWindowId;
      if (!detachedPinnedTabsByWindow.has(oldWindowId)) {
        detachedPinnedTabsByWindow.set(oldWindowId, new Set());
      }
      detachedPinnedTabsByWindow.get(oldWindowId)!.add(tabId);
    }

    treeStateManager.notifyStateChanged();
  } catch {
    // タブが存在しない
  }
}

async function handleTabAttached(
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
      try {
        const parentTab = await chrome.tabs.get(parentTabId);
        parentInSameWindow = parentTab.windowId === attachInfo.newWindowId;
      } catch {
        // 親タブが存在しない
      }
    }

    if (!parentInSameWindow) {
      await treeStateManager.moveTabToRootEnd(tabId, attachInfo.newWindowId);
    }

    await treeStateManager.syncTreeStateToChromeTabs(attachInfo.newWindowId);
  }

  for (const [windowId, tabIds] of detachedPinnedTabsByWindow.entries()) {
    if (tabIds.has(tabId)) {
      try {
        await chrome.windows.get(windowId);
        tabIds.delete(tabId);
        if (tabIds.size === 0) {
          detachedPinnedTabsByWindow.delete(windowId);
        }
      } catch {
        // ウィンドウが存在しない
      }
      break;
    }
  }

  treeStateManager.notifyStateChanged();
}

async function handleTabReplaced(
  addedTabId: number,
  removedTabId: number,
): Promise<void> {
  await treeStateManager.replaceTabId(removedTabId, addedTabId);
  treeStateManager.notifyStateChanged();
}

async function handleWindowCreated(_window: chrome.windows.Window): Promise<void> {
}

async function handleWindowRemoved(windowId: number): Promise<void> {
  try {
    const pinnedTabsToClose = detachedPinnedTabsByWindow.get(windowId);
    if (pinnedTabsToClose && pinnedTabsToClose.size > 0) {
      const tabIds = Array.from(pinnedTabsToClose);
      for (const tabId of tabIds) {
        try {
          await chrome.tabs.remove(tabId);
        } catch {
          // タブが既に閉じられている
        }
      }
      detachedPinnedTabsByWindow.delete(windowId);
    }

    await treeStateManager.removeWindow(windowId);

    await treeStateManager.syncTreeStateToChromeTabs();

    treeStateManager.notifyStateChanged();
  } catch {
    // メッセージ送信失敗
  }
}

function handleMessage(
  message: MessageType,

  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse<unknown>) => void,
): boolean {
  try {
    switch (message.type) {
      case 'GET_STATE':
        trackHandler(() => handleGetState(sendResponse));
        break;

      case 'UPDATE_TREE':
        trackHandler(() => handleUpdateTree(message.payload, sendResponse));
        break;

      case 'ACTIVATE_TAB':
        handleActivateTab(message.payload.tabId, sendResponse);
        break;

      case 'CLOSE_TAB':
        handleCloseTab(message.payload.tabId, sendResponse);
        break;

      case 'CLOSE_SUBTREE':
        trackHandler(() => handleCloseSubtree(message.payload.tabId, sendResponse));
        break;

      case 'CLOSE_TABS_WITH_COLLAPSED_SUBTREES':
        trackHandler(() => handleCloseTabsWithCollapsedSubtrees(message.payload.tabIds, sendResponse));
        break;

      case 'MOVE_TAB_TO_WINDOW':
        handleMoveTabToWindow(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse,
        );
        break;

      case 'CREATE_WINDOW_WITH_TAB':
        handleCreateWindowWithTab(message.payload.tabId, sendResponse);
        break;

      case 'CREATE_WINDOW_WITH_SUBTREE':
        trackHandler(() => handleCreateWindowWithSubtree(message.payload.tabId, sendResponse));
        break;

      case 'MOVE_SUBTREE_TO_WINDOW':
        trackHandler(() => handleMoveSubtreeToWindow(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse,
        ));
        break;

      case 'SET_DRAG_STATE':
        handleSetDragState(message.payload, sendResponse);
        break;

      case 'GET_DRAG_STATE':
        handleGetDragState(sendResponse);
        break;

      case 'CLEAR_DRAG_STATE':
        handleClearDragState(sendResponse);
        break;

      case 'SYNC_TABS':
        trackHandler(() => handleSyncTabs(sendResponse));
        break;

      case 'REFRESH_TREE_STRUCTURE':
        trackHandler(() => handleRefreshTreeStructure(sendResponse));
        break;

      case 'CREATE_GROUP':
        trackHandler(() => handleCreateGroup(message.payload.tabIds, message.payload.groupName, message.payload.contextMenuTabId, sendResponse));
        break;

      case 'DISSOLVE_GROUP':
        trackHandler(() => handleDissolveGroup(message.payload.tabIds, sendResponse));
        break;

      case 'UPDATE_GROUP_NAME':
        trackHandler(() => handleUpdateGroupName(message.payload.tabId, message.payload.name, sendResponse));
        break;

      case 'REGISTER_DUPLICATE_SOURCE':
        trackHandler(() => handleRegisterDuplicateSource(message.payload.sourceTabId, sendResponse));
        break;

      case 'DUPLICATE_SUBTREE':
        trackHandler(() => handleDuplicateSubtree(message.payload.tabId, sendResponse));
        break;

      case 'GET_GROUP_INFO':
        trackHandler(() => handleGetGroupInfo(message.payload.tabId, sendResponse));
        break;

      case 'CREATE_SNAPSHOT':
        trackHandler(() => handleCreateSnapshot(sendResponse));
        break;

      case 'RESTORE_SNAPSHOT':
        trackHandler(() => handleRestoreSnapshot(
          message.payload.jsonData,
          message.payload.closeCurrentTabs,
          sendResponse
        ));
        break;

      case 'CLOSE_OTHER_TABS':
        trackHandler(() => handleCloseOtherTabs(message.payload.excludeTabIds, sendResponse));
        break;

      case 'DUPLICATE_TABS':
        trackHandler(() => handleDuplicateTabs(message.payload.tabIds, sendResponse));
        break;

      case 'PIN_TABS':
        trackHandler(() => handlePinTabs(message.payload.tabIds, sendResponse));
        break;

      case 'UNPIN_TABS':
        trackHandler(() => handleUnpinTabs(message.payload.tabIds, sendResponse));
        break;

      case 'MOVE_TABS_TO_NEW_WINDOW':
        trackHandler(() => handleMoveTabsToNewWindow(message.payload.tabIds, sendResponse));
        break;

      case 'RELOAD_TABS':
        trackHandler(() => handleReloadTabs(message.payload.tabIds, sendResponse));
        break;

      case 'DISCARD_TABS':
        trackHandler(() => handleDiscardTabs(message.payload.tabIds, sendResponse));
        break;

      case 'REORDER_PINNED_TAB':
        trackHandler(() => handleReorderPinnedTab(message.payload.tabId, message.payload.newIndex, sendResponse));
        break;

      case 'REORDER_VIEW':
        trackHandler(() => handleReorderView(message.payload.viewIndex, message.payload.newIndex, message.payload.windowId, sendResponse));
        break;

      case 'MOVE_NODE':
        trackHandler(() => handleMoveNode(
          message.payload.tabId,
          message.payload.targetParentTabId,
          message.payload.windowId,
          message.payload.selectedTabIds,
          sendResponse
        ));
        break;

      case 'MOVE_NODE_AS_SIBLING':
        trackHandler(() => handleMoveNodeAsSibling(
          message.payload.tabId,
          message.payload.aboveTabId,
          message.payload.belowTabId,
          message.payload.windowId,
          message.payload.selectedTabIds,
          message.payload.targetDepth,
          sendResponse
        ));
        break;

      case 'SWITCH_VIEW':
        trackHandler(() => handleSwitchView(
          message.payload.viewIndex,
          message.payload.windowId,
          message.payload.previousViewIndex,
          message.payload.activeTabId,
          sendResponse
        ));
        break;

      case 'CREATE_VIEW':
        trackHandler(() => handleCreateView(message.payload.windowId, sendResponse));
        break;

      case 'DELETE_VIEW':
        trackHandler(() => handleDeleteView(message.payload.windowId, message.payload.viewIndex, sendResponse));
        break;

      case 'UPDATE_VIEW':
        trackHandler(() => handleUpdateView(
          message.payload.windowId,
          message.payload.viewIndex,
          message.payload.updates,
          sendResponse
        ));
        break;

      case 'TOGGLE_NODE_EXPAND':
        trackHandler(() => handleToggleNodeExpand(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse
        ));
        break;

      case 'MOVE_TABS_TO_VIEW':
        trackHandler(() => handleMoveTabsToView(
          message.payload.windowId,
          message.payload.targetViewIndex,
          message.payload.tabIds,
          sendResponse
        ));
        break;

      case 'DELETE_TREE_GROUP':
        trackHandler(() => handleDeleteTreeGroup(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse
        ));
        break;

      case 'ADD_TAB_TO_TREE_GROUP':
        trackHandler(() => handleAddTabToTreeGroup(
          message.payload.tabId,
          message.payload.targetGroupTabId,
          message.payload.windowId,
          sendResponse
        ));
        break;

      case 'REMOVE_TAB_FROM_TREE_GROUP':
        trackHandler(() => handleRemoveTabFromTreeGroup(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse
        ));
        break;

      case 'SAVE_GROUPS':
        trackHandler(() => handleSaveGroups(message.payload.groups, sendResponse));
        break;

      case 'SAVE_USER_SETTINGS':
        trackHandler(() => handleSaveUserSettings(message.payload.settings, sendResponse));
        break;

      case 'CREATE_NEW_TAB':
        trackHandler(() => handleCreateNewTab(sendResponse));
        break;

      case 'OPEN_SETTINGS_TAB':
        trackHandler(() => handleOpenSettingsTab(sendResponse));
        break;

      default:
        sendResponse({
          success: false,
          error: `Unknown message type: ${message.type}`,
        });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  return true;
}

async function handleGetState(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const state = treeStateManager.toJSON();
    sendResponse({ success: true, data: state });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleUpdateTree(
  payload: { nodeId: string; newParentId: string | null; index: number },
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const { nodeId, newParentId, index } = payload;

    const tabId = parseInt(nodeId, 10);
    const newParentTabId = newParentId !== null ? parseInt(newParentId, 10) : null;

    await treeStateManager.moveNode(tabId, newParentTabId, index);

    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function handleActivateTab(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  chrome.tabs.update(tabId, { active: true }, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message || 'Unknown error',
      });
    } else {
      sendResponse({ success: true, data: null });
    }
  });
}

function handleCloseTab(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  chrome.tabs.remove(tabId, () => {
    if (chrome.runtime.lastError) {
      sendResponse({
        success: false,
        error: chrome.runtime.lastError.message || 'Unknown error',
      });
    } else {
      sendResponse({ success: true, data: null });
    }
  });
}

async function handleCloseSubtree(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    const tabIds = subtree.map((node) => node.tabId);

    await chrome.tabs.remove(tabIds);

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCloseTabsWithCollapsedSubtrees(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const allTabIdsToClose = new Set<number>();

    for (const tabId of tabIds) {
      const nodeResult = treeStateManager.getNodeByTabId(tabId);
      if (!nodeResult) {
        allTabIdsToClose.add(tabId);
        continue;
      }

      if (!nodeResult.node.isExpanded && nodeResult.node.children.length > 0) {
        const subtree = treeStateManager.getSubtree(tabId);
        for (const subtreeNode of subtree) {
          allTabIdsToClose.add(subtreeNode.tabId);
        }
      } else {
        allTabIdsToClose.add(tabId);
      }
    }

    await chrome.tabs.remove([...allTabIdsToClose]);

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleMoveTabToWindow(
  tabId: number,
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.moveTabToWindow(tabId, windowId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCreateWindowWithTab(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.createWindowWithTab(tabId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCreateWindowWithSubtree(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    const newWindowId = await treeStateManager.createWindowWithSubtree(tabId);

    if (newWindowId === undefined) {
      sendResponse({
        success: false,
        error: 'Failed to create window',
      });
      return;
    }

    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleMoveSubtreeToWindow(
  tabId: number,
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    await treeStateManager.moveSubtreeToWindow(tabId, windowId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function handleSetDragState(
  payload: { tabId: number; treeData: TabNode[]; sourceWindowId: number },
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  dragState = payload;
  sendResponse({ success: true, data: null });
}

function handleGetDragState(
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  sendResponse({ success: true, data: dragState });
}

function handleClearDragState(
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  dragState = null;
  sendResponse({ success: true, data: null });
}

export function getDragState():
  { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null {
  return dragState;
}

export function setDragState(
  state: { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null,
): void {
  dragState = state;
}

async function handleSyncTabs(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const rawSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const syncSettings = {
      newTabPositionManual: rawSettings?.newTabPositionManual ?? 'end' as const,
    };
    await treeStateManager.restoreStateAfterRestart(syncSettings);
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleRefreshTreeStructure(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.refreshTreeStructure();
    await treeStateManager.syncTreeStateToChromeTabs();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCreateGroup(
  tabIds: number[],
  groupName: string | undefined,
  contextMenuTabId: number | undefined,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    if (tabIds.length === 0) {
      sendResponse({
        success: false,
        error: 'No tabs specified for grouping',
      });
      return;
    }

    const targetTabId = contextMenuTabId ?? tabIds[0];
    let windowId: number | undefined;
    let targetTabIndex: number | undefined;
    try {
      const targetTab = await chrome.tabs.get(targetTabId);
      windowId = targetTab.windowId;
      targetTabIndex = targetTab.index;
    } catch {
      // タブ情報取得失敗
    }

    const createOptions: chrome.tabs.CreateProperties = {
      url: `chrome-extension://${chrome.runtime.id}/group.html`,
      active: false,
    };
    if (windowId !== undefined) {
      createOptions.windowId = windowId;
    }
    if (targetTabIndex !== undefined) {
      createOptions.index = targetTabIndex;
    }

    isCreatingGroupTab = true;
    const groupTab = await chrome.tabs.create(createOptions);

    if (!groupTab.id) {
      isCreatingGroupTab = false;
      sendResponse({
        success: false,
        error: 'Failed to create group tab',
      });
      return;
    }

    pendingGroupTabIds.add(groupTab.id);
    isCreatingGroupTab = false;

    const groupPageUrl = `chrome-extension://${chrome.runtime.id}/group.html`;
    await chrome.tabs.update(groupTab.id, { url: groupPageUrl });

    await treeStateManager.createGroupWithRealTab(groupTab.id, tabIds, groupName ?? 'グループ', windowId!, targetTabId);

    await treeStateManager.syncTreeStateToChromeTabs(windowId);

    await chrome.tabs.update(groupTab.id, { active: true });

    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: { groupTabId: groupTab.id } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleDissolveGroup(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    if (tabIds.length === 0) {
      sendResponse({
        success: false,
        error: 'No tabs specified for ungrouping',
      });
      return;
    }

    await treeStateManager.dissolveGroup(tabIds[0]);

    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleUpdateGroupName(
  tabId: number,
  name: string,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const updated = await treeStateManager.updateGroupName(tabId, name || 'グループ');
    if (!updated) {
      sendResponse({
        success: false,
        error: 'Group not found',
      });
      return;
    }

    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleRegisterDuplicateSource(
  sourceTabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const tab = await chrome.tabs.get(sourceTabId);
    pendingDuplicateSources.set(sourceTabId, {
      url: tab.url || tab.pendingUrl || '',
      windowId: tab.windowId,
      isSubtreeDuplicate: false,
    });

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleDuplicateSubtree(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    const oldTabIdToNewTabId = new Map<number, number>();

    for (const node of subtree) {
      const sourceTab = await chrome.tabs.get(node.tabId);
      pendingDuplicateSources.set(node.tabId, {
        url: sourceTab.url || '',
        windowId: sourceTab.windowId,
        isSubtreeDuplicate: true,
      });
      const duplicatedTab = await chrome.tabs.duplicate(node.tabId);
      if (duplicatedTab?.id) {
        oldTabIdToNewTabId.set(node.tabId, duplicatedTab.id);
      }
    }

    const newTabIds = Array.from(oldTabIdToNewTabId.values());
    const maxIterations = 100;
    for (let i = 0; i < maxIterations; i++) {
      const allTabsInTree = newTabIds.every(tid =>
        treeStateManager.getNodeByTabId(tid) !== null
      );
      if (allTabsInTree) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    const rootNode = subtree[0];
    const rootNewTabId = oldTabIdToNewTabId.get(rootNode.tabId);
    const rootNewNodeResult = rootNewTabId ? treeStateManager.getNodeByTabId(rootNewTabId) : null;
    const originalRootNodeResult = treeStateManager.getNodeByTabId(rootNode.tabId);

    if (rootNewNodeResult && originalRootNodeResult) {
      const originalParentTabId = treeStateManager.getParentTabId(rootNode.tabId);
      if (originalParentTabId !== null) {
        const originalSiblingIndex = treeStateManager.getSiblingIndex(rootNode.tabId);
        await treeStateManager.moveNode(rootNewTabId!, originalParentTabId, originalSiblingIndex + 1);
      }

      if (!originalRootNodeResult.node.isExpanded) {
        await treeStateManager.toggleExpand(rootNewTabId!);
      }

      for (let i = 1; i < subtree.length; i++) {
        const originalNode = subtree[i];
        const newTabId = oldTabIdToNewTabId.get(originalNode.tabId);
        if (!newTabId) continue;

        const originalParentTabId2 = treeStateManager.getParentTabId(originalNode.tabId);
        if (originalParentTabId2 !== null) {
          const newParentTabId = oldTabIdToNewTabId.get(originalParentTabId2);
          if (newParentTabId) {
            await treeStateManager.moveNode(newTabId, newParentTabId, -1);
          }
        }
      }
    }

    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleGetGroupInfo(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const groupInfo = await treeStateManager.getGroupInfo(tabId);
    sendResponse({ success: true, data: groupInfo });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCreateSnapshot(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const timestamp = new Date().toLocaleString();
    const name = `Manual Snapshot - ${timestamp}`;
    await snapshotManager.createSnapshot(name, false);
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleRestoreSnapshot(
  jsonData: string,
  closeCurrentTabs: boolean,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    isRestoringSnapshot = true;

    const parsed = JSON.parse(jsonData);
    const snapshotTabs: Array<{
      index: number;
      url: string;
      title: string;
      parentIndex: number | null;
      viewId: string;
      isExpanded: boolean;
      pinned: boolean;
      windowIndex?: number;
    }> = parsed.data.tabs;
    const snapshotViews: Array<{
      id: string;
      name: string;
      color: string;
    }> = parsed.data.views;

    if (snapshotTabs.length === 0) {
      sendResponse({ success: true, data: null });
      isRestoringSnapshot = false;
      return;
    }

    const sidePanelUrlBase = `chrome-extension://${chrome.runtime.id}/sidepanel.html`;
    const existingTabs = await chrome.tabs.query({});
    const existingTabIds = existingTabs
      .filter(t => t.id !== undefined && !t.url?.startsWith(sidePanelUrlBase))
      .map(t => t.id as number);

    const sortedTabs = [...snapshotTabs].sort((a, b) => {
      if (a.parentIndex === null && b.parentIndex !== null) return -1;
      if (a.parentIndex !== null && b.parentIndex === null) return 1;
      return a.index - b.index;
    });

    const indexToNewTabId = new Map<number, number>();
    const indexToSnapshot = new Map<number, typeof sortedTabs[0]>();

    for (const tabSnapshot of sortedTabs) {
      indexToSnapshot.set(tabSnapshot.index, tabSnapshot);
    }

    const windowIndexSet = new Set<number>();
    for (const tabSnapshot of sortedTabs) {
      windowIndexSet.add(tabSnapshot.windowIndex ?? 0);
    }
    const windowIndices = Array.from(windowIndexSet).sort((a, b) => a - b);

    const windowIndexToNewWindowId = new Map<number, number>();
    const blankTabsToRemove: number[] = [];

    for (const windowIndex of windowIndices) {
      try {
        const newWindow = await chrome.windows.create({});
        if (newWindow && newWindow.id !== undefined) {
          windowIndexToNewWindowId.set(windowIndex, newWindow.id);
          if (newWindow.tabs && newWindow.tabs.length > 0) {
            const blankTabId = newWindow.tabs[0].id;
            if (blankTabId !== undefined) {
              blankTabsToRemove.push(blankTabId);
            }
          }
        }
      } catch (error) {
        console.error('Failed to create window for windowIndex:', windowIndex, error);
      }
    }

    for (const tabSnapshot of sortedTabs) {
      try {
        const windowIndex = tabSnapshot.windowIndex ?? 0;
        const targetWindowId = windowIndexToNewWindowId.get(windowIndex);

        const newTab = await chrome.tabs.create({
          url: tabSnapshot.url,
          active: false,
          pinned: tabSnapshot.pinned,
          windowId: targetWindowId,
        });

        if (newTab.id !== undefined) {
          indexToNewTabId.set(tabSnapshot.index, newTab.id);
          restoringTabIds.add(newTab.id);
        }
      } catch (error) {
        console.error('Failed to create tab:', tabSnapshot.url, error);
      }
    }

    for (const blankTabId of blankTabsToRemove) {
      try {
        await chrome.tabs.remove(blankTabId);
      } catch {
        // 既に閉じられている
      }
    }

    await treeStateManager.restoreTreeStateFromSnapshot(
      snapshotViews,
      indexToNewTabId,
      indexToSnapshot,
      closeCurrentTabs,
      windowIndexToNewWindowId
    );

    if (closeCurrentTabs && existingTabIds.length > 0) {
      try {
        await chrome.tabs.remove(existingTabIds);
      } catch {
        // タブ削除失敗
      }
    }

    restoringTabIds.clear();
    isRestoringSnapshot = false;

    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    isRestoringSnapshot = false;
    restoringTabIds.clear();
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCloseOtherTabs(
  excludeTabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const excludeSet = new Set(excludeTabIds);
    const tabsToClose = tabs
      .filter(tab => tab.id !== undefined && !excludeSet.has(tab.id))
      .map(tab => tab.id as number);

    if (tabsToClose.length > 0) {
      await chrome.tabs.remove(tabsToClose);
    }

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleDuplicateTabs(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    for (const tabId of tabIds) {
      const tab = await chrome.tabs.get(tabId);
      pendingDuplicateSources.set(tabId, {
        url: tab.url || tab.pendingUrl || '',
        windowId: tab.windowId,
        isSubtreeDuplicate: false,
      });
      await chrome.tabs.duplicate(tabId);
    }
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handlePinTabs(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const tabsByWindow = new Map<number, number[]>();
    for (const tabId of tabIds) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId !== undefined) {
          const windowTabs = tabsByWindow.get(tab.windowId) ?? [];
          windowTabs.push(tabId);
          tabsByWindow.set(tab.windowId, windowTabs);
        }
      } catch {
        // タブが存在しない
      }
    }

    for (const [windowId, windowTabIds] of tabsByWindow) {
      await treeStateManager.pinTabs(windowTabIds, windowId);
    }

    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleUnpinTabs(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const tabsByWindow = new Map<number, number[]>();
    for (const tabId of tabIds) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId !== undefined) {
          const windowTabs = tabsByWindow.get(tab.windowId) ?? [];
          windowTabs.push(tabId);
          tabsByWindow.set(tab.windowId, windowTabs);
        }
      } catch {
        // タブが存在しない
      }
    }

    for (const [windowId, windowTabIds] of tabsByWindow) {
      await treeStateManager.unpinTabs(windowTabIds, windowId);
    }

    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleMoveTabsToNewWindow(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    if (tabIds.length === 0) {
      sendResponse({ success: true, data: null });
      return;
    }

    const newWindowId = await treeStateManager.moveTabsToNewWindow(tabIds);
    if (newWindowId === undefined) {
      sendResponse({
        success: false,
        error: 'Failed to create new window',
      });
      return;
    }

    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleReloadTabs(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    for (const tabId of tabIds) {
      await chrome.tabs.reload(tabId);
    }
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleDiscardTabs(
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ currentWindow: true });
    const activeTab = tabs.find(tab => tab.active);
    const tabIdSet = new Set(tabIds);

    if (activeTab?.id && tabIdSet.has(activeTab.id)) {
      const alternativeTab = tabs.find(tab =>
        tab.id &&
        !tabIdSet.has(tab.id) &&
        !tab.discarded &&
        !tab.pinned
      );

      const alternativeTabWithPinned = alternativeTab ?? tabs.find(tab =>
        tab.id &&
        !tabIdSet.has(tab.id) &&
        !tab.discarded
      );

      if (alternativeTabWithPinned?.id) {
        await chrome.tabs.update(alternativeTabWithPinned.id, { active: true });
      }
    }

    for (const tabId of tabIds) {
      try {
        const tab = await chrome.tabs.get(tabId);
        if (!tab.active) {
          await chrome.tabs.discard(tabId);
        }
      } catch {
        // タブが既に休止されている
      }
    }

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleReorderPinnedTab(
  tabId: number,
  newIndex: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (tab.windowId === undefined) {
      sendResponse({ success: false, error: 'Tab has no window' });
      return;
    }

    await treeStateManager.reorderPinnedTab(tabId, newIndex, tab.windowId);

    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reorder pinned tab',
    });
  }
}

async function handleReorderView(
  viewIndex: number,
  newIndex: number,
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.reorderView(viewIndex, newIndex, windowId);
    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reorder view',
    });
  }
}

async function handleMoveNode(
  tabId: number,
  targetParentTabId: number | null,
  _windowId: number,
  selectedTabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.moveNodeToParent(tabId, targetParentTabId, selectedTabIds);
    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleMoveNodeAsSibling(
  tabId: number,
  aboveTabId: number | undefined,
  belowTabId: number | undefined,
  _windowId: number,
  selectedTabIds: number[],
  targetDepth: number | undefined,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.moveNodeAsSibling(tabId, aboveTabId, belowTabId, selectedTabIds, targetDepth);
    await treeStateManager.syncTreeStateToChromeTabs();
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleSwitchView(
  viewIndex: number,
  windowId: number,
  _previousViewIndex: number,
  _activeTabId: number | null,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.switchView(windowId, viewIndex);
    await treeStateManager.syncTreeStateToChromeTabs(windowId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCreateView(
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const newViewIndex = await treeStateManager.createViewWithAutoColor(windowId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: { viewIndex: newViewIndex } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleDeleteView(
  windowId: number,
  viewIndex: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.deleteView(windowId, viewIndex);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleUpdateView(
  windowId: number,
  viewIndex: number,
  updates: { name?: string; color?: string; icon?: string },
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.updateView(windowId, viewIndex, updates);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleToggleNodeExpand(
  tabId: number,
  _windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.toggleExpand(tabId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleMoveTabsToView(
  windowId: number,
  targetViewIndex: number,
  tabIds: number[],
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.moveTabsToViewInternal(tabIds, windowId, targetViewIndex);
    await treeStateManager.syncTreeStateToChromeTabs(windowId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleDeleteTreeGroup(
  tabId: number,
  _windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.deleteTreeGroup(tabId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleAddTabToTreeGroup(
  tabId: number,
  targetGroupTabId: number,
  _windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.addTabToTreeGroup(tabId, targetGroupTabId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleRemoveTabFromTreeGroup(
  tabId: number,
  _windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.removeTabFromTreeGroup(tabId);
    treeStateManager.notifyStateChanged();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleSaveGroups(
  groups: Record<string, { id: string; name: string; color: string; isExpanded: boolean }>,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await storageService.set(STORAGE_KEYS.GROUPS, groups);
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleSaveUserSettings(
  settings: UserSettings,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await storageService.set(STORAGE_KEYS.USER_SETTINGS, settings);
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleCreateNewTab(
  sendResponse: (response: MessageResponse<{ tabId: number }>) => void,
): Promise<void> {
  try {
    const tab = await chrome.tabs.create({
      active: true,
      url: 'chrome://vivaldi-webui/startpage',
    });
    sendResponse({ success: true, data: { tabId: tab.id ?? -1 } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function handleOpenSettingsTab(
  sendResponse: (response: MessageResponse<{ tabId: number }>) => void,
): Promise<void> {
  try {
    const settingsUrl = chrome.runtime.getURL('settings.html');
    const tab = await chrome.tabs.create({ url: settingsUrl });
    sendResponse({ success: true, data: { tabId: tab.id ?? -1 } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
