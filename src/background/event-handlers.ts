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
  } catch {
    return DEFAULT_VIEW_ID;
  }
}

const pendingTabParents = new Map<number, number>();

const pendingDuplicateSources = new Map<number, { url: string; windowId: number }>();

const pendingGroupTabIds = new Set<number>();

let isCreatingGroupTab = false;

const lastActiveTabByWindow = new Map<number, number>();

const pendingLinkClicks = new Map<number, number>();

// E2Eテスト等のService Worker評価コンテキストからアクセスするためglobalThisにエクスポート
declare global {
   
  var pendingTabParents: Map<number, number>;
   
  var pendingDuplicateSources: Map<number, { url: string; windowId: number }>;
   
  var pendingGroupTabIds: Set<number>;
   
  var pendingLinkClicks: Map<number, number>;
   
  var treeStateManager: TreeStateManager;
}
globalThis.pendingTabParents = pendingTabParents;
globalThis.pendingDuplicateSources = pendingDuplicateSources;
globalThis.pendingGroupTabIds = pendingGroupTabIds;
globalThis.pendingLinkClicks = pendingLinkClicks;
globalThis.treeStateManager = treeStateManager;

/**
 * Chromeタブイベントリスナーを登録
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
 * Chromeウィンドウイベントリスナーを登録
 */
export function registerWindowEventListeners(): void {
  chrome.windows.onCreated.addListener(handleWindowCreated);
  chrome.windows.onRemoved.addListener(handleWindowRemoved);
}

/**
 * webNavigationイベントリスナーを登録
 * onCreatedNavigationTargetはリンククリックまたはwindow.open()呼び出し時に発火する。
 * 以下のケースでは発火しないため、リンククリックを確実に検出できる:
 * - chrome.tabs.create()
 * - ブックマーク
 * - アドレスバー操作
 * - Ctrl+T（新規タブ）
 */
export function registerWebNavigationListeners(): void {
  chrome.webNavigation.onCreatedNavigationTarget.addListener(handleCreatedNavigationTarget);
}

/**
 * webNavigation.onCreatedNavigationTargetイベントを処理
 * リンククリックまたはwindow.open()で新しいタブが作成された際に発火する。
 * リンククリックから開かれたタブを確実に識別するために追跡する。
 */
function handleCreatedNavigationTarget(
  details: chrome.webNavigation.WebNavigationSourceCallbackDetails
): void {
  pendingLinkClicks.set(details.tabId, details.sourceTabId);

  // onCreatedが発火しないケースに備えてクリーンアップ
  setTimeout(() => {
    pendingLinkClicks.delete(details.tabId);
  }, 5000);
}

/**
 * Chromeランタイムメッセージリスナーを登録
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

  // 非同期操作の前にlastActiveTabByWindowをキャプチャ
  // onActivatedがmapを更新する前に値を取得する必要がある
  const capturedLastActiveTabId = tab.windowId !== undefined
    ? lastActiveTabByWindow.get(tab.windowId)
    : undefined;

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
    // ストレージから最新状態を読み込む（Side Panelのドラッグ&ドロップで設定された親子関係を上書きしないため）
    await treeStateManager.loadState();

    const settings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);

    // ChromeのonCreatedイベントは常にopenerTabIdを含むとは限らないため、タブを再取得して確認する
    let openerTabIdFromChrome: number | undefined = tab.openerTabId;
    if (openerTabIdFromChrome === undefined) {
      try {
        const freshTab = await chrome.tabs.get(tab.id);
        openerTabIdFromChrome = freshTab.openerTabId;
      } catch {
        // タブが既に閉じられている場合は無視
      }
    }

    const pendingOpenerTabId = pendingTabParents.get(tab.id);

    let newTabPosition: 'child' | 'sibling' | 'end';

    // chrome.webNavigation.onCreatedNavigationTargetで検出されたタブをリンククリックとして扱う
    // このAPIはリンククリック/window.open()でのみ発火し、
    // chrome.tabs.create()、ブックマーク、アドレスバー、Ctrl+Tでは発火しない
    const linkClickSourceTabId = pendingLinkClicks.get(tab.id);
    const isLinkClick = linkClickSourceTabId !== undefined;

    const effectiveOpenerTabId = isLinkClick
      ? linkClickSourceTabId
      : (pendingOpenerTabId || openerTabIdFromChrome);

    if (isLinkClick) {
      pendingLinkClicks.delete(tab.id);
    }

    if (isLinkClick) {
      newTabPosition = settings?.newTabPositionFromLink ?? 'child';
    } else {
      newTabPosition = settings?.newTabPositionManual ?? 'end';
    }

    let parentId: string | null = null;

    let isDuplicatedTab = false;
    let duplicateSourceTabId: number | null = null;

    // 複製タブの検出: chrome.tabs.duplicate()はopenerTabIdが正しく設定されない場合があるためURLで照合する
    const tabUrl = tab.url || tab.pendingUrl || '';
    for (const [sourceTabId, sourceInfo] of pendingDuplicateSources.entries()) {
      if (sourceInfo.url === tabUrl && sourceInfo.windowId === tab.windowId) {
        isDuplicatedTab = true;
        duplicateSourceTabId = sourceTabId;
        pendingDuplicateSources.delete(sourceTabId);
        break;
      }
    }

    const duplicateTabPosition = settings?.duplicateTabPosition || 'sibling';

    let insertAfterNodeId: string | undefined;
    if (isDuplicatedTab && duplicateSourceTabId !== null) {
      if (duplicateTabPosition === 'sibling') {
        const openerNode = treeStateManager.getNodeByTabId(duplicateSourceTabId);
        if (openerNode) {
          parentId = openerNode.parentId;
          insertAfterNodeId = openerNode.id;
        }
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
    } else if (!isLinkClick && newTabPosition === 'child') {
      // 手動で開かれたタブで'child'設定の場合、関数先頭でキャプチャした最後のアクティブタブを親とする
      if (capturedLastActiveTabId !== undefined && capturedLastActiveTabId !== tab.id) {
        const lastActiveNode = treeStateManager.getNodeByTabId(capturedLastActiveTabId);
        if (lastActiveNode) {
          parentId = lastActiveNode.id;
        }
      }
    }

    if (pendingOpenerTabId) {
      pendingTabParents.delete(tab.id);
    }

    const currentViewId = await getCurrentViewId();

    const shouldMoveToEnd = (newTabPosition === 'end' && !isDuplicatedTab) ||
                            (isDuplicatedTab && duplicateTabPosition === 'end');
    if (shouldMoveToEnd && tab.windowId !== undefined) {
      try {
        await chrome.tabs.move(tab.id, { index: -1 });
      } catch {
        // タブ移動失敗は無視
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
  } catch {
    // タブ追加失敗は無視
  }
}

/**
 * 空ウィンドウ自動クローズ
 *
 * ウィンドウ内のタブ数を確認し、タブが残っていなければ自動的に閉じる
 * 最後のウィンドウは閉じない（ブラウザ終了防止）
 */
async function tryCloseEmptyWindow(windowId: number): Promise<void> {
  console.log('[EMPTY WINDOW DEBUG] tryCloseEmptyWindow called for windowId:', windowId);
  try {
    const tabs = await chrome.tabs.query({ windowId });
    console.log('[EMPTY WINDOW DEBUG] tabs.length:', tabs.length, 'tabs:', tabs.map(t => ({ id: t.id, url: t.url })));
    if (tabs.length > 0) {
      console.log('[EMPTY WINDOW DEBUG] Window has tabs, not closing');
      return;
    }

    const allWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    console.log('[EMPTY WINDOW DEBUG] allWindows.length:', allWindows.length);
    if (allWindows.length <= 1) {
      console.log('[EMPTY WINDOW DEBUG] Only one window, not closing');
      return;
    }

    console.log('[EMPTY WINDOW DEBUG] CLOSING EMPTY WINDOW:', windowId);
    console.log('[EMPTY WINDOW DEBUG] Stack trace:', new Error().stack);
    await chrome.windows.remove(windowId);
  } catch {
    // ウィンドウクローズ失敗は無視
  }
}

export async function handleTabRemoved(
  tabId: number,
  removeInfo: chrome.tabs.TabRemoveInfo,
): Promise<void> {
  console.log('[TAB REMOVED DEBUG] handleTabRemoved called with tabId:', tabId, 'removeInfo:', removeInfo);
  const { windowId, isWindowClosing } = removeInfo;

  try {
    // ストレージから最新状態を読み込む（Side Panelのドラッグ&ドロップで設定された親子関係を上書きしないため）
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
    } catch {
      // ファビコン削除失敗は無視
    }

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});

    if (!isWindowClosing) {
      await tryCloseEmptyWindow(windowId);
    }
  } catch {
    // タブ削除処理失敗は無視
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
  } catch {
    // タブ移動処理失敗は無視
  }
}

export async function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  console.log('[TAB UPDATED DEBUG] handleTabUpdated called with tabId:', tabId, 'changeInfo:', JSON.stringify(changeInfo));
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
      } catch {
        // ファビコン保存失敗は無視
      }
    }

    // タイトル、URL、ステータス、ファビコン、discardedの変更時のみUI通知（statusのみの変更では通知しない）
    if (
      changeInfo.title !== undefined ||
      changeInfo.url !== undefined ||
      changeInfo.status !== undefined ||
      changeInfo.favIconUrl !== undefined ||
      changeInfo.discarded !== undefined
    ) {
      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
    }
  } catch {
    // タブ更新処理失敗は無視
  }
}

async function handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {
  try {
    // 'child'設定の手動タブ作成時に親を決定するために記録
    lastActiveTabByWindow.set(activeInfo.windowId, activeInfo.tabId);

    if (unreadTracker.isUnread(activeInfo.tabId)) {
      await unreadTracker.markAsRead(activeInfo.tabId);

      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
    }
  } catch {
    // タブアクティブ化処理失敗は無視
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
  } catch {
    // メッセージ送信失敗は無視
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
  } catch {
    // メッセージ送信失敗は無視
  }
}

async function handleWindowCreated(window: chrome.windows.Window): Promise<void> {
  try {
    if (window.id !== undefined) {
      await treeStateManager.syncWithChromeTabs();
    }

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch {
    // ウィンドウ作成処理失敗は無視
  }
}

function handleWindowRemoved(_windowId: number): void {
  try {
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch {
    // メッセージ送信失敗は無視
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

      case 'DUPLICATE_SUBTREE':
        handleDuplicateSubtree(message.payload.tabId, sendResponse);
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

  // Chrome拡張APIは非同期レスポンスを示すためにtrueを返す必要がある
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
    // ストレージから最新状態を読み込む（テスト等で直接更新された場合に正確なサブツリーを取得するため）
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
          } catch {
            // タブ移動失敗は無視
          }
        }
      }

      if (sourceWindowId !== undefined) {
        try {
          const remainingTabs = await chrome.tabs.query({ windowId: sourceWindowId });
          console.log('[CREATE_WINDOW_WITH_SUBTREE DEBUG] remainingTabs in source window:', remainingTabs.length);
          if (remainingTabs.length === 0) {
            console.log('[CREATE_WINDOW_WITH_SUBTREE DEBUG] CLOSING EMPTY SOURCE WINDOW:', sourceWindowId);
            console.log('[CREATE_WINDOW_WITH_SUBTREE DEBUG] Stack trace:', new Error().stack);
            await chrome.windows.remove(sourceWindowId);
          }
        } catch {
          // ウィンドウクローズ失敗は無視
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
      } catch {
        // タブ移動失敗は無視
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
 * SYNC_TABSメッセージを処理し、TreeStateManagerをChromeタブと同期
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
 * REFRESH_TREE_STRUCTUREメッセージを処理
 * Side Panelからのドラッグ&ドロップ操作後に呼び出す。
 * ストレージから最新の状態を読み込み、treeStructureを再構築して保存する。
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
 * 複数タブが選択されている状態でグループ化を実行する。
 *
 * レースコンディション対策として以下の順序で処理:
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
    } catch {
      // タブ情報取得失敗は無視
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

    // handleTabCreatedとのレースコンディションを防止
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
 * openerTabIdが正しく設定されない場合でも複製タブを識別できるよう、
 * URLとwindowIdを保存する。
 */
async function handleRegisterDuplicateSource(
  sourceTabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const tab = await chrome.tabs.get(sourceTabId);
    pendingDuplicateSources.set(sourceTabId, {
      url: tab.url || tab.pendingUrl || '',
      windowId: tab.windowId,
    });

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * サブツリーを複製
 * 対象タブとその全ての子孫タブを複製し、元のツリー構造を維持する。
 */
async function handleDuplicateSubtree(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await treeStateManager.loadState();

    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    const tabIdToNewTabId = new Map<number, number>();

    for (const node of subtree) {
      pendingDuplicateSources.set(node.tabId, {
        url: '',
        windowId: -1,
      });
      const duplicatedTab = await chrome.tabs.duplicate(node.tabId);
      if (duplicatedTab?.id) {
        tabIdToNewTabId.set(node.tabId, duplicatedTab.id);
      }
      pendingDuplicateSources.delete(node.tabId);
    }

    await new Promise(resolve => setTimeout(resolve, 100));
    await treeStateManager.loadState();

    const rootNode = subtree[0];
    const rootNewTabId = tabIdToNewTabId.get(rootNode.tabId);
    const rootNewNode = rootNewTabId ? treeStateManager.getNodeByTabId(rootNewTabId) : null;

    if (rootNewNode) {
      for (let i = 1; i < subtree.length; i++) {
        const originalNode = subtree[i];
        const newTabId = tabIdToNewTabId.get(originalNode.tabId);
        if (!newTabId) continue;

        const newNode = treeStateManager.getNodeByTabId(newTabId);
        if (!newNode) continue;

        const originalParentTabId = originalNode.parentId
          ? treeStateManager.getNodeById(originalNode.parentId)?.tabId
          : null;

        if (originalParentTabId) {
          const newParentTabId = tabIdToNewTabId.get(originalParentTabId);
          if (newParentTabId) {
            const newParentNode = treeStateManager.getNodeByTabId(newParentTabId);
            if (newParentNode) {
              await treeStateManager.moveNode(newNode.id, newParentNode.id, -1);
            }
          }
        }
      }
    }

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

