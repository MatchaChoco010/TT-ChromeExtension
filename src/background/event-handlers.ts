import type { MessageType, MessageResponse, TabNode } from '@/types';
import { TreeStateManager } from '@/services/TreeStateManager';
import { UnreadTracker } from '@/services/UnreadTracker';
import { TitlePersistenceService } from '@/services/TitlePersistenceService';
import { StorageService, STORAGE_KEYS } from '@/storage/StorageService';

const storageService = new StorageService();
const treeStateManager = new TreeStateManager(storageService);
const unreadTracker = new UnreadTracker(storageService);
const titlePersistence = new TitlePersistenceService(storageService);

unreadTracker.loadFromStorage().catch(() => {});

titlePersistence.loadFromStorage().catch(() => {});

export { storageService as testStorageService, treeStateManager as testTreeStateManager, unreadTracker as testUnreadTracker, titlePersistence as testTitlePersistence };

let dragState: { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null =
  null;

const DEFAULT_VIEW_ID = 'default';

/**
 * 現在アクティブなビューIDを取得する
 * ストレージからtree_stateを読み込み、currentViewIdを返す
 * 存在しない場合はデフォルトビューIDを返す
 */
async function getCurrentViewId(): Promise<string> {
  try {
    const treeState = await storageService.get(STORAGE_KEYS.TREE_STATE);
    if (treeState && treeState.currentViewId) {
      return treeState.currentViewId;
    }
    return DEFAULT_VIEW_ID;
  } catch (_error) {
    return DEFAULT_VIEW_ID;
  }
}

// Track pending parent relationships for tabs being created
// Map<tabId, openerTabId>
// This is needed because Chrome doesn't reliably include openerTabId in the onCreated event
const pendingTabParents = new Map<number, number>();

// Track source tabs for pending duplications
// Set<sourceTabId>
// When a tab is duplicated, we want the new tab to be placed as a sibling, not a child
const pendingDuplicateSources = new Set<number>();

// Track group tabs being created
// Set<tabId>
// Group tabs are created via createGroupWithRealTab and should be skipped in handleTabCreated
const pendingGroupTabIds = new Set<number>();

// Flag to indicate that a group tab is currently being created
// Used to handle race condition between chrome.tabs.create and onCreated event
let isCreatingGroupTab = false;

/**
 * システムページ判定
 *
 * システムページ（chrome://, vivaldi://, chrome-extension://, about:）を検出する。
 * これらのページはopenerTabIdがあっても手動タブとして扱われる。
 *
 * @param url - 検査するURL
 * @returns システムページの場合はtrue、それ以外はfalse
 */
export function isSystemPage(url: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('vivaldi://') ||
    url.startsWith('about:')
  );
}

// Export to globalThis for access from service worker evaluation contexts (e.g., E2E tests)
declare global {
  // eslint-disable-next-line no-var
  var pendingTabParents: Map<number, number>;
  // eslint-disable-next-line no-var
  var pendingDuplicateSources: Set<number>;
  // eslint-disable-next-line no-var
  var pendingGroupTabIds: Set<number>;
  // eslint-disable-next-line no-var
  var treeStateManager: TreeStateManager;
}
globalThis.pendingTabParents = pendingTabParents;
globalThis.pendingDuplicateSources = pendingDuplicateSources;
globalThis.pendingGroupTabIds = pendingGroupTabIds;
globalThis.treeStateManager = treeStateManager;

/**
 * Register all Chrome tabs event listeners
 */
export function registerTabEventListeners(): void {
  chrome.tabs.onCreated.addListener(handleTabCreated);
  chrome.tabs.onRemoved.addListener(handleTabRemoved);
  chrome.tabs.onMoved.addListener(handleTabMoved);
  chrome.tabs.onUpdated.addListener(handleTabUpdated);
  chrome.tabs.onActivated.addListener(handleTabActivated);
  chrome.tabs.onDetached.addListener(handleTabDetached);
  chrome.tabs.onAttached.addListener(handleTabAttached);
}

/**
 * Register all Chrome windows event listeners
 */
export function registerWindowEventListeners(): void {
  chrome.windows.onCreated.addListener(handleWindowCreated);
  chrome.windows.onRemoved.addListener(handleWindowRemoved);
}

/**
 * Register Chrome runtime message listener
 */
export function registerMessageListener(): void {
  chrome.runtime.onMessage.addListener(handleMessage);
}


/**
 * グループタブ判定
 *
 * グループタブ（group.htmlを開くタブ）を検出する。
 * グループタブはhandleTabCreatedではスキップし、createGroupWithRealTabで処理される。
 */
function isGroupTabUrl(url: string | undefined): boolean {
  if (!url) return false;
  return url.includes('/group.html');
}

export async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {

  if (!tab.id) return;

  if (isCreatingGroupTab) {
    await new Promise(resolve => setTimeout(resolve, 50));
    if (pendingGroupTabIds.has(tab.id)) {
      pendingGroupTabIds.delete(tab.id);
      return;
    }
    try {
      const refreshedTab = await chrome.tabs.get(tab.id);
      if (isGroupTabUrl(refreshedTab.url) || isGroupTabUrl(refreshedTab.pendingUrl)) {
        return;
      }
    } catch {
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

  try {
    // IMPORTANT: Load the latest state from storage before adding a new tab
    // This ensures we don't overwrite parent-child relationships set by Side Panel's drag & drop
    // Side Panel updates storage directly, so we need to sync our in-memory state first
    await treeStateManager.loadState();

    const settings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);

    const pendingOpenerTabId = pendingTabParents.get(tab.id);
    const effectiveOpenerTabId = pendingOpenerTabId || tab.openerTabId;

    let newTabPosition: 'child' | 'sibling' | 'end';

    const tabUrl = tab.url || '';
    const isLinkClick = effectiveOpenerTabId && !isSystemPage(tabUrl);

    if (isLinkClick) {
      newTabPosition =
        settings?.newTabPositionFromLink !== undefined
          ? settings.newTabPositionFromLink
          : settings?.newTabPosition || 'child';
    } else {
      newTabPosition =
        settings?.newTabPositionManual !== undefined
          ? settings.newTabPositionManual
          : settings?.newTabPosition || 'end';
    }

    let parentId: string | null = null;

    let isDuplicatedTab = false;
    if (effectiveOpenerTabId && pendingDuplicateSources.has(effectiveOpenerTabId)) {
      isDuplicatedTab = true;
      pendingDuplicateSources.delete(effectiveOpenerTabId);
    }

    let insertAfterNodeId: string | undefined;
    if (isDuplicatedTab && effectiveOpenerTabId) {
      const openerNode = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (openerNode) {
        parentId = openerNode.parentId;
        insertAfterNodeId = openerNode.id;
      }
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'child') {
      const parentNode = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (parentNode) {
        parentId = parentNode.id;
      }
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'sibling') {
      const openerNode = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (openerNode) {
        parentId = openerNode.parentId;
        insertAfterNodeId = openerNode.id;
      }
    }

    if (pendingOpenerTabId) {
      pendingTabParents.delete(tab.id);
    }

    const currentViewId = await getCurrentViewId();

    if (newTabPosition === 'end' && tab.windowId !== undefined) {
      try {
        await chrome.tabs.move(tab.id, { index: -1 });
      } catch (_moveError) {
      }
    }

    await treeStateManager.addTab(tab, parentId, currentViewId, insertAfterNodeId);

    if (parentId) {
      await treeStateManager.expandNode(parentId);
    }

    if (!tab.active && tab.id) {
      await unreadTracker.markAsUnread(tab.id);
    }

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch (_error) {
  }
}

/**
 * 空ウィンドウ自動クローズ
 *
 * ウィンドウ内のタブ数を確認し、タブが残っていなければ自動的に閉じる
 * 最後のウィンドウは閉じない（ブラウザ終了防止）
 */
async function tryCloseEmptyWindow(windowId: number): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ windowId });
    if (tabs.length > 0) return;

    const allWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    if (allWindows.length <= 1) return;

    await chrome.windows.remove(windowId);
  } catch {
  }
}

export async function handleTabRemoved(
  tabId: number,
  removeInfo: chrome.tabs.TabRemoveInfo,
): Promise<void> {
  const { windowId, isWindowClosing } = removeInfo;

  try {
    // IMPORTANT: Load the latest state from storage before removing a tab
    // This ensures we don't overwrite parent-child relationships set by Side Panel's drag & drop
    await treeStateManager.loadState();

    const settings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const childTabBehavior = settings?.childTabBehavior || 'promote';

    await treeStateManager.removeTab(tabId, childTabBehavior);

    if (unreadTracker.isUnread(tabId)) {
      await unreadTracker.markAsRead(tabId);
    }

    titlePersistence.removeTitle(tabId);

    try {
      const storedFaviconsResult = await storageService.get(STORAGE_KEYS.TAB_FAVICONS);
      if (storedFaviconsResult) {
        const favicons = { ...storedFaviconsResult };
        delete favicons[tabId];
        await storageService.set(STORAGE_KEYS.TAB_FAVICONS, favicons);
      }
    } catch (_error) {
    }

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});

    if (!isWindowClosing) {
      await tryCloseEmptyWindow(windowId);
    }
  } catch (_error) {
  }
}

export async function handleTabMoved(
  tabId: number,
  moveInfo: chrome.tabs.TabMoveInfo,
): Promise<void> {
  void tabId;
  void moveInfo;

  try {
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch (_error) {
  }
}

export async function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  try {
    if (changeInfo.title !== undefined && tab.title) {
      titlePersistence.saveTitle(tabId, tab.title);
    }

    if (changeInfo.favIconUrl !== undefined && changeInfo.favIconUrl !== null && changeInfo.favIconUrl !== '') {
      try {
        const storedFaviconsResult = await storageService.get(STORAGE_KEYS.TAB_FAVICONS);
        const favicons = storedFaviconsResult ? { ...storedFaviconsResult } : {};
        favicons[tabId] = changeInfo.favIconUrl;
        await storageService.set(STORAGE_KEYS.TAB_FAVICONS, favicons);
      } catch (_error) {
      }
    }

    // Only notify UI for meaningful changes (title, url, status, favIconUrl)
    if (
      changeInfo.title !== undefined ||
      changeInfo.url !== undefined ||
      changeInfo.status !== undefined ||
      changeInfo.favIconUrl !== undefined
    ) {
      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
    }
  } catch (_error) {
  }
}

async function handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {
  try {
    if (unreadTracker.isUnread(activeInfo.tabId)) {
      await unreadTracker.markAsRead(activeInfo.tabId);

      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
    }
  } catch (_error) {
  }
}

/**
 * タブがウィンドウから取り外されたときのハンドラ
 * ウィンドウ間のタブ移動で発火する（onMovedはウィンドウ内移動のみ）
 */
function handleTabDetached(
  _tabId: number,
  _detachInfo: chrome.tabs.TabDetachInfo,
): void {
  try {
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch (_error) {
  }
}

/**
 * タブが別のウィンドウにアタッチされたときのハンドラ
 * ウィンドウ間のタブ移動で発火する（onMovedはウィンドウ内移動のみ）
 */
function handleTabAttached(
  _tabId: number,
  _attachInfo: chrome.tabs.TabAttachInfo,
): void {
  try {
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch (_error) {
  }
}

async function handleWindowCreated(window: chrome.windows.Window): Promise<void> {
  try {
    if (window.id !== undefined) {
      await treeStateManager.syncWithChromeTabs();
    }

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch (_error) {
  }
}

function handleWindowRemoved(_windowId: number): void {
  try {
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch (_error) {
  }
}

function handleMessage(
  message: MessageType,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: MessageResponse<unknown>) => void,
): boolean {
  try {
    switch (message.type) {
      case 'GET_STATE':
        handleGetState(sendResponse);
        break;

      case 'UPDATE_TREE':
        handleUpdateTree(message.payload, sendResponse);
        break;

      case 'ACTIVATE_TAB':
        handleActivateTab(message.payload.tabId, sendResponse);
        break;

      case 'CLOSE_TAB':
        handleCloseTab(message.payload.tabId, sendResponse);
        break;

      case 'CLOSE_SUBTREE':
        handleCloseSubtree(message.payload.tabId, sendResponse);
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
        handleCreateWindowWithSubtree(message.payload.tabId, message.payload.sourceWindowId, sendResponse);
        break;

      case 'MOVE_SUBTREE_TO_WINDOW':
        handleMoveSubtreeToWindow(
          message.payload.tabId,
          message.payload.windowId,
          sendResponse,
        );
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
        handleSyncTabs(sendResponse);
        break;

      case 'REFRESH_TREE_STRUCTURE':
        handleRefreshTreeStructure(sendResponse);
        break;

      case 'CREATE_GROUP':
        handleCreateGroup(message.payload.tabIds, sendResponse);
        break;

      case 'DISSOLVE_GROUP':
        handleDissolveGroup(message.payload.tabIds, sendResponse);
        break;

      case 'REGISTER_DUPLICATE_SOURCE':
        handleRegisterDuplicateSource(message.payload.sourceTabId, sendResponse);
        break;

      case 'GET_GROUP_INFO':
        handleGetGroupInfo(message.payload.tabId, sendResponse);
        break;

      default:
        sendResponse({
          success: false,
          error: 'Unknown message type',
        });
    }
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }

  // Return true to indicate async response (required by Chrome extension API)
  return true;
}

async function handleGetState(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.loadState();

    const tree = treeStateManager.getTree(DEFAULT_VIEW_ID);

    sendResponse({ success: true, data: { tree } });
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

    await treeStateManager.moveNode(nodeId, newParentId, index);

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});

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

/**
 * サブツリーを閉じる
 * 対象タブとその全ての子孫タブを閉じる
 */
async function handleCloseSubtree(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // IMPORTANT: Load the latest state from storage
    // This ensures we get accurate subtree when storage was directly updated (e.g., in tests)
    await treeStateManager.loadState();

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

function handleMoveTabToWindow(
  tabId: number,
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  chrome.tabs.move(tabId, { windowId, index: -1 }, () => {
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

function handleCreateWindowWithTab(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  chrome.windows.create({ tabId }, () => {
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

/**
 * サブツリー全体で新しいウィンドウを作成
 * パネル外へのドロップで新しいウィンドウを作成し、サブツリー全体を移動
 * ドラッグアウト後の空ウィンドウ自動クローズ
 */
async function handleCreateWindowWithSubtree(
  tabId: number,
  sourceWindowId: number | undefined,
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

    chrome.windows.create({ tabId }, async (window) => {
      if (chrome.runtime.lastError || !window || !window.id) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError?.message || 'Failed to create window',
        });
        return;
      }

      if (tabIds.length > 1) {
        const remainingTabIds = tabIds.slice(1);

        for (const tid of remainingTabIds) {
          try {
            await new Promise<void>((resolve, reject) => {
              chrome.tabs.move(tid, { windowId: window.id!, index: -1 }, () => {
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                } else {
                  resolve();
                }
              });
            });
          } catch (_error) {
          }
        }
      }

      if (sourceWindowId !== undefined) {
        try {
          const remainingTabs = await chrome.tabs.query({ windowId: sourceWindowId });
          if (remainingTabs.length === 0) {
            await chrome.windows.remove(sourceWindowId);
          }
        } catch (_error) {
        }
      }

      sendResponse({ success: true, data: null });
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * サブツリー全体を別のウィンドウに移動
 * タブを別ウィンドウに移動し、ツリー構造を維持
 */
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

    const tabIds = subtree.map((node) => node.tabId);

    for (const tid of tabIds) {
      try {
        await new Promise<void>((resolve, reject) => {
          chrome.tabs.move(tid, { windowId, index: -1 }, () => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message || 'Unknown error'));
            } else {
              resolve();
            }
          });
        });
      } catch (_error) {
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

/**
 * Handle SYNC_TABS message - sync TreeStateManager with Chrome tabs
 */
async function handleSyncTabs(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.syncWithChromeTabs();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Handle REFRESH_TREE_STRUCTURE message
 * Side Panelからのドラッグ&ドロップ操作後に呼び出す
 * ストレージから最新の状態を読み込み、treeStructureを再構築して保存
 */
async function handleRefreshTreeStructure(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.refreshTreeStructure();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * グループ作成（実タブ作成版）
 * 複数タブが選択されている状態でグループ化を実行
 * - chrome.tabs.create()でグループタブを実際に作成
 * - 選択されたすべてのタブを新しいグループの子要素として移動
 * - グループ化後に親子関係を正しくツリーに反映
 *
 * レースコンディション対策:
 * 1. グループタブをバックグラウンドで作成（active: false）
 * 2. ツリー状態を更新（グループ情報を登録）
 * 3. ツリー状態更新完了を待ってからアクティブ化
 */
async function handleCreateGroup(
  tabIds: number[],
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

    let windowId: number | undefined;
    let firstTabIndex: number | undefined;
    try {
      const firstTab = await chrome.tabs.get(tabIds[0]);
      windowId = firstTab.windowId;
      firstTabIndex = firstTab.index;
    } catch (_err) {
    }

    const createOptions: chrome.tabs.CreateProperties = {
      url: `chrome-extension://${chrome.runtime.id}/group.html`,
      active: false,
    };
    if (windowId !== undefined) {
      createOptions.windowId = windowId;
    }
    if (firstTabIndex !== undefined) {
      createOptions.index = firstTabIndex;
    }

    // Set flag to prevent race condition with handleTabCreated
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

    const groupPageUrl = `chrome-extension://${chrome.runtime.id}/group.html?tabId=${groupTab.id}`;
    await chrome.tabs.update(groupTab.id, { url: groupPageUrl });

    await treeStateManager.loadState();
    const groupNodeId = await treeStateManager.createGroupWithRealTab(groupTab.id, tabIds, '新しいグループ');

    await chrome.tabs.update(groupTab.id, { active: true });

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});

    sendResponse({ success: true, data: { groupId: groupNodeId, groupTabId: groupTab.id } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * グループ解除
 * グループを解除し、子タブをルートレベルに移動
 */
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

    await treeStateManager.loadState();
    await treeStateManager.dissolveGroup(tabIds[0]);

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * 複製元タブの登録
 * 複製されたタブを元のタブの兄弟として配置するために、
 * 複製される前に複製元のタブIDを登録する
 */
function handleRegisterDuplicateSource(
  sourceTabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  try {
    pendingDuplicateSources.add(sourceTabId);

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * グループ情報取得
 */
async function handleGetGroupInfo(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.loadState();

    const groupInfo = await treeStateManager.getGroupInfo(tabId);
    sendResponse({ success: true, data: groupInfo });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

