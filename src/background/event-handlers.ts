// Service Worker event handlers
import type { MessageType, MessageResponse, TabNode } from '@/types';
import { TreeStateManager } from '@/services/TreeStateManager';
import { UnreadTracker } from '@/services/UnreadTracker';
import { TitlePersistenceService } from '@/services/TitlePersistenceService';
import { StorageService, STORAGE_KEYS } from '@/storage/StorageService';
import { dragSessionManager } from './drag-session-manager';

// Global instances
const storageService = new StorageService();
const treeStateManager = new TreeStateManager(storageService);
const unreadTracker = new UnreadTracker(storageService);
const titlePersistence = new TitlePersistenceService(storageService);

// Initialize unread tracker from storage
unreadTracker.loadFromStorage().catch((_error) => {
  // Failed to load unread tracker silently
});

// Initialize title persistence from storage (Requirement 5.2)
titlePersistence.loadFromStorage().catch((_error) => {
  // Failed to load title persistence silently
});

// Export for testing
export { storageService as testStorageService, treeStateManager as testTreeStateManager, unreadTracker as testUnreadTracker, titlePersistence as testTitlePersistence };

// Global drag state for cross-window drag & drop
let dragState: { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null =
  null;

// Default view ID - must match TreeStateProvider's default currentViewId
const DEFAULT_VIEW_ID = 'default';

/**
 * Requirement 15.1: 現在アクティブなビューIDを取得する
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

// Task 4.2 (tab-tree-bugfix-2): Track source tabs for pending duplications
// Set<sourceTabId>
// When a tab is duplicated, we want the new tab to be placed as a sibling, not a child
const pendingDuplicateSources = new Set<number>();

/**
 * Task 3.1 (tab-tree-bugfix-2): システムページ判定
 * Requirements: 17.6, 17.7
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
  var treeStateManager: TreeStateManager;
}
globalThis.pendingTabParents = pendingTabParents;
globalThis.pendingDuplicateSources = pendingDuplicateSources;
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
 * Register Chrome alarms listener (for DragSessionManager keep-alive)
 * Task 13.1: chrome.alarmsによるService Worker keep-alive
 */
export function registerAlarmListener(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    dragSessionManager.handleAlarm(alarm);
  });
  // Start timeout check for drag session
  dragSessionManager.startTimeoutCheck();
}

// Tab event handlers
export async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {

  if (!tab.id) return;

  try {
    // Get user settings to determine new tab position
    const settings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);

    // Check if we have a pending parent relationship for this tab
    const pendingOpenerTabId = pendingTabParents.get(tab.id);
    const effectiveOpenerTabId = pendingOpenerTabId || tab.openerTabId;

    // Task 12.2 (Requirements 9.2, 9.3, 9.4): タブ開き方別の位置ルール適用
    // Task 3.1 (tab-tree-bugfix-2): システムページ判定を追加 (Requirements 17.6, 17.7)
    // タブがどのように開かれたかを判定し、適切な位置ルールを選択
    let newTabPosition: 'child' | 'sibling' | 'end';

    // Requirement 17.6: openerTabIdがあってもシステムページの場合は手動タブとして扱う
    // effectiveOpenerTabIdを使用してpendingTabParentsも考慮する
    const tabUrl = tab.url || '';
    const isLinkClick = effectiveOpenerTabId && !isSystemPage(tabUrl);

    if (isLinkClick) {
      // Requirement 9.2: リンククリックから開かれたタブ（システムページ以外）
      // newTabPositionFromLink が設定されていればそれを使用、なければ既存のnewTabPositionを使用(後方互換性)
      newTabPosition =
        settings?.newTabPositionFromLink !== undefined
          ? settings.newTabPositionFromLink
          : settings?.newTabPosition || 'child';
    } else {
      // Requirement 9.3: 手動で開かれたタブ(アドレスバー、新規タブボタン、システムページなど)
      // Requirement 17.3: デフォルト設定は「手動：リストの最後」
      // newTabPositionManual が設定されていればそれを使用、なければデフォルト'end'を使用
      newTabPosition =
        settings?.newTabPositionManual !== undefined
          ? settings.newTabPositionManual
          : settings?.newTabPosition || 'end';
    }

    // Determine parent node
    let parentId: string | null = null;

    // Task 4.2 (tab-tree-bugfix-2): Check if this tab was duplicated
    // If the opener tab is registered as a duplicate source, place this tab as sibling
    let isDuplicatedTab = false;
    if (effectiveOpenerTabId && pendingDuplicateSources.has(effectiveOpenerTabId)) {
      isDuplicatedTab = true;
      // Remove the source tab from pending duplicates (one-time registration per duplicate operation)
      pendingDuplicateSources.delete(effectiveOpenerTabId);
    }

    // Task 3.1: システムページの場合は、effectiveOpenerTabIdがあっても親タブとしては扱わない
    // isLinkClick を使用して親タブを決定する（システムページはリンククリックとして扱わない）
    // Task 4.2: 複製されたタブの場合は、元のタブの親を引き継いで兄弟として配置
    if (isDuplicatedTab && effectiveOpenerTabId) {
      // Requirement 16.1, 16.2, 16.3: 複製タブは元のタブの兄弟として配置
      // 元のタブの親IDを取得して、同じ親の下に配置
      const openerNode = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (openerNode) {
        parentId = openerNode.parentId;
      }
    } else if (isLinkClick && effectiveOpenerTabId && newTabPosition === 'child') {
      // Find parent node by openerTabId
      const parentNode = treeStateManager.getNodeByTabId(effectiveOpenerTabId);
      if (parentNode) {
        parentId = parentNode.id;
      }
    }

    // Clean up pending parent mapping
    if (pendingOpenerTabId) {
      pendingTabParents.delete(tab.id);
    }

    // Requirement 15.1: 現在アクティブなビューIDを取得し、新しいタブをそのビューに追加
    const currentViewId = await getCurrentViewId();

    // Add tab to tree
    await treeStateManager.addTab(tab, parentId, currentViewId);

    // Task 9.1 (comprehensive-bugfix): 親タブの自動展開
    // Requirement 10.1, 10.2: 新規タブ作成時に親タブが折りたたまれている場合は展開する
    if (parentId) {
      await treeStateManager.expandNode(parentId);
    }

    // Task 4.13: Requirement 3.13.1 - バックグラウンドで作成されたタブを未読としてマーク
    // タブがアクティブでない場合（バックグラウンドで読み込まれた場合）、未読としてマーク
    if (!tab.active && tab.id) {
      await unreadTracker.markAsUnread(tab.id);
    }

    // Notify UI about state update
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
      // Ignore errors when no listeners are available
    });
  } catch (_error) {
    // Error in handleTabCreated silently
  }
}

/**
 * Task 8.1 (comprehensive-bugfix): 空ウィンドウ自動クローズ
 * Requirements: 5.1, 5.2, 5.3
 *
 * ウィンドウ内のタブ数を確認し、タブが残っていなければ自動的に閉じる
 * 最後のウィンドウは閉じない（ブラウザ終了防止）
 */
async function tryCloseEmptyWindow(windowId: number): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({ windowId });
    if (tabs.length > 0) return; // タブが残っている場合は閉じない

    const allWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    if (allWindows.length <= 1) return; // 最後のウィンドウは閉じない

    await chrome.windows.remove(windowId);
  } catch {
    // エラーは無視（ウィンドウが既に閉じられている等）
  }
}

export async function handleTabRemoved(
  tabId: number,
  removeInfo: chrome.tabs.TabRemoveInfo,
): Promise<void> {
  const { windowId, isWindowClosing } = removeInfo;

  try {
    // Task 13.1: ドラッグセッションのクリーンアップ
    // ドラッグ中のタブが削除された場合はセッションを終了
    dragSessionManager.handleTabRemoved(tabId);

    // Get user settings for child tab behavior
    const settings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const childTabBehavior = settings?.childTabBehavior || 'promote';

    // Remove tab from tree state
    await treeStateManager.removeTab(tabId, childTabBehavior);

    // Task 4.13: タブが削除された場合、未読状態もクリーンアップ
    if (unreadTracker.isUnread(tabId)) {
      await unreadTracker.markAsRead(tabId);
    }

    // Requirement 5.4: タブが閉じられた際に該当タブのタイトルデータを削除
    titlePersistence.removeTitle(tabId);

    // Task 4.4 (tab-tree-bugfix-2): タブが閉じられた際にファビコンの永続化データを削除
    // Requirements: 14.1, 14.2
    try {
      const storedFaviconsResult = await storageService.get(STORAGE_KEYS.TAB_FAVICONS);
      if (storedFaviconsResult) {
        const favicons = { ...storedFaviconsResult };
        delete favicons[tabId];
        await storageService.set(STORAGE_KEYS.TAB_FAVICONS, favicons);
      }
    } catch (_error) {
      // Failed to remove favicon silently
    }

    // Notify UI about state update
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
      // Ignore errors when no listeners are available
    });

    // Task 8.1 (comprehensive-bugfix): 空ウィンドウ自動クローズ
    // Requirements: 5.1, 5.2, 5.3
    // ウィンドウ自体が閉じられている場合は処理スキップ
    if (!isWindowClosing) {
      // ドラッグセッション中は自動クローズを抑止
      const dragSession = await dragSessionManager.getSession(0);
      if (!dragSession || dragSession.sourceWindowId !== windowId) {
        // ドラッグ中でなければ空ウィンドウを閉じる
        await tryCloseEmptyWindow(windowId);
      }
      // Note: ドラッグ中の場合はTask 8.2でドラッグ完了時にクローズ処理を行う
    }
  } catch (_error) {
    // Error in handleTabRemoved silently
  }
}

export async function handleTabMoved(
  tabId: number,
  moveInfo: chrome.tabs.TabMoveInfo,
): Promise<void> {
  void tabId; // unused parameter
  void moveInfo; // unused parameter

  try {
    // Tab moved event doesn't affect tree structure (parent-child relationships)
    // Only notify UI to re-render with updated tab order
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
      // Ignore errors when no listeners are available
    });
  } catch (_error) {
    // Error in handleTabMoved silently
  }
}

export async function handleTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
  tab: chrome.tabs.Tab,
): Promise<void> {
  try {
    // Requirement 5.1, 5.3: タイトルが変更された場合、永続化する
    if (changeInfo.title !== undefined && tab.title) {
      titlePersistence.saveTitle(tabId, tab.title);
    }

    // Task 4.4 (tab-tree-bugfix-2): ファビコンが変更された場合、永続化する
    // Requirements: 14.1, 14.2
    if (changeInfo.favIconUrl !== undefined && changeInfo.favIconUrl !== null && changeInfo.favIconUrl !== '') {
      try {
        const storedFaviconsResult = await storageService.get(STORAGE_KEYS.TAB_FAVICONS);
        const favicons = storedFaviconsResult ? { ...storedFaviconsResult } : {};
        favicons[tabId] = changeInfo.favIconUrl;
        await storageService.set(STORAGE_KEYS.TAB_FAVICONS, favicons);
      } catch (_error) {
        // Failed to persist favicon silently
      }
    }

    // Only notify UI for meaningful changes (title, url, status, favIconUrl)
    if (
      changeInfo.title !== undefined ||
      changeInfo.url !== undefined ||
      changeInfo.status !== undefined ||
      changeInfo.favIconUrl !== undefined
    ) {
      // Notify UI about state update
      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
        // Ignore errors when no listeners are available
      });
    }
  } catch (_error) {
    // Error in handleTabUpdated silently
  }
}

async function handleTabActivated(activeInfo: chrome.tabs.TabActiveInfo): Promise<void> {

  // Task 4.13: Requirement 3.13.2 - 未読タブをアクティブにした場合、未読バッジを消す
  try {
    // タブが未読だった場合、既読としてマーク
    if (unreadTracker.isUnread(activeInfo.tabId)) {
      await unreadTracker.markAsRead(activeInfo.tabId);

      // Notify UI about state update
      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
        // Ignore errors when no listeners are available
      });
    }
  } catch (_error) {
    // Error in handleTabActivated silently
  }
}

// Window event handlers
async function handleWindowCreated(window: chrome.windows.Window): Promise<void> {
  try {
    // 新しいウィンドウが作成されたとき、そのウィンドウ内のタブを同期
    // (タブは個別にonCreatedイベントで処理されるが、念のため同期を実行)
    if (window.id !== undefined) {
      await treeStateManager.syncWithChromeTabs();
    }

    // UIに状態更新を通知
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
      // Ignore errors when no listeners are available
    });
  } catch (_error) {
    // Error in handleWindowCreated silently
  }
}

function handleWindowRemoved(windowId: number): void {
  try {
    // Task 13.1: ドラッグセッションのクリーンアップ
    // ウィンドウクローズ時にセッションを終了
    dragSessionManager.handleWindowRemoved(windowId);

    // UIに状態更新を通知
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
      // Ignore errors when no listeners are available
    });
  } catch (_error) {
    // Error in handleWindowRemoved silently
  }
}

// Message handler
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
        // Task 14.1: sourceWindowIdを渡す（空ウィンドウ自動クローズ用）
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

      // Task 6.2: グループ化機能
      case 'CREATE_GROUP':
        handleCreateGroup(message.payload.tabIds, sendResponse);
        break;

      case 'DISSOLVE_GROUP':
        handleDissolveGroup(message.payload.tabIds, sendResponse);
        break;

      // Task 4.2 (tab-tree-bugfix-2): タブ複製時の兄弟配置
      case 'REGISTER_DUPLICATE_SOURCE':
        handleRegisterDuplicateSource(message.payload.sourceTabId, sendResponse);
        break;

      // Task 13.1 (tab-tree-bugfix-2): クロスウィンドウドラッグセッション管理
      case 'START_DRAG_SESSION':
        handleStartDragSession(message.payload, sendResponse);
        break;

      case 'GET_DRAG_SESSION':
        handleGetDragSession(sendResponse);
        break;

      case 'END_DRAG_SESSION':
        handleEndDragSession(message.payload?.reason, sendResponse);
        break;

      case 'BEGIN_CROSS_WINDOW_MOVE':
        handleBeginCrossWindowMove(message.payload.targetWindowId, sendResponse);
        break;

      // Task 15.1 (tab-tree-bugfix-2): グループ情報取得
      case 'GET_GROUP_INFO':
        handleGetGroupInfo(message.payload.tabId, sendResponse);
        break;

      // Task 7.2 (comprehensive-bugfix): ツリービュー上のホバー検知
      case 'NOTIFY_TREE_VIEW_HOVER':
        handleNotifyTreeViewHover(message.payload.windowId, sendResponse);
        break;

      case 'NOTIFY_DRAG_OUT':
        handleNotifyDragOut(sendResponse);
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

  // Return true to indicate async response
  return true;
}

// Message handler implementations
async function handleGetState(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // ストレージから状態を復元
    await treeStateManager.loadState();

    // デフォルトビューのツリーを取得
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

    // TreeStateManagerでノードを移動
    await treeStateManager.moveNode(nodeId, newParentId, index);

    // 更新通知を送信
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
      // Ignore errors when no listeners are available
    });

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
 * Requirement 3.11: サブツリーを閉じる
 * 対象タブとその全ての子孫タブを閉じる
 */
async function handleCloseSubtree(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // ストレージから最新の状態をロード（テストなどで直接ストレージを更新した場合に対応）
    await treeStateManager.loadState();

    // サブツリー全体を取得
    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    // すべてのタブIDを取得
    const tabIds = subtree.map((node) => node.tabId);

    // タブを一括で閉じる
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
 * Task 7.3: サブツリー全体で新しいウィンドウを作成
 * Requirement 4.2, 4.3: パネル外へのドロップで新しいウィンドウを作成し、サブツリー全体を移動
 * Task 14.1: ドラッグアウト後の空ウィンドウ自動クローズ
 * Requirements: 7.1, 7.2
 */
async function handleCreateWindowWithSubtree(
  tabId: number,
  sourceWindowId: number | undefined,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // サブツリー全体を取得
    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    // すべてのタブIDを取得
    const tabIds = subtree.map((node) => node.tabId);

    // 新しいウィンドウを作成し、最初のタブを移動
    chrome.windows.create({ tabId }, async (window) => {
      if (chrome.runtime.lastError || !window || !window.id) {
        sendResponse({
          success: false,
          error: chrome.runtime.lastError?.message || 'Failed to create window',
        });
        return;
      }

      // 残りのタブを新しいウィンドウに移動
      if (tabIds.length > 1) {
        const remainingTabIds = tabIds.slice(1);

        // タブを順番に移動
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
            // Failed to move tab silently
          }
        }
      }

      // Task 14.1: 空ウィンドウの自動クローズ
      // Requirements: 7.1, 7.2
      // sourceWindowIdが指定されている場合、元のウィンドウにタブが残っていなければ閉じる
      if (sourceWindowId !== undefined) {
        try {
          const remainingTabs = await chrome.tabs.query({ windowId: sourceWindowId });
          if (remainingTabs.length === 0) {
            // ウィンドウにタブが残っていない場合、自動的に閉じる
            await chrome.windows.remove(sourceWindowId);
          }
        } catch (_error) {
          // ウィンドウのクローズに失敗してもエラーにしない（既に閉じられている可能性）
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
 * Task 7.3: サブツリー全体を別のウィンドウに移動
 * Requirement 4.1, 4.3, 4.4: タブを別ウィンドウに移動し、ツリー構造を維持
 */
async function handleMoveSubtreeToWindow(
  tabId: number,
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // サブツリー全体を取得
    const subtree = treeStateManager.getSubtree(tabId);
    if (subtree.length === 0) {
      sendResponse({
        success: false,
        error: 'Tab not found',
      });
      return;
    }

    // すべてのタブIDを取得
    const tabIds = subtree.map((node) => node.tabId);

    // タブを順番に移動
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
        // Failed to move tab silently
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

// Export drag state getter for testing
export function getDragState():
  { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null {
  return dragState;
}

// Export drag state setter for testing
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
 * Task 15.2: グループ作成（実タブ作成版）
 * Requirement 5.1, 5.2, 5.3, 5.6, 5.7: 複数タブが選択されている状態でグループ化を実行
 * - chrome.tabs.create()でグループタブを実際に作成
 * - 選択されたすべてのタブを新しいグループの子要素として移動
 * - グループ化後に親子関係を正しくツリーに反映
 *
 * レースコンディション対策（design.md 解決策1）:
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

    // 最初のタブからウィンドウIDを取得
    let windowId: number | undefined;
    try {
      const firstTab = await chrome.tabs.get(tabIds[0]);
      windowId = firstTab.windowId;
    } catch (_err) {
      // タブ取得に失敗した場合はデフォルトウィンドウを使用
    }

    // 1. グループタブをバックグラウンドで作成（active: false）
    // URLにはtabIdパラメータを使用（GroupPage.tsxがtabIdを使用）
    const createOptions: chrome.tabs.CreateProperties = {
      url: `chrome-extension://${chrome.runtime.id}/group.html`,  // tabIdは作成後に追加
      active: false,  // まだアクティブにしない
    };
    if (windowId !== undefined) {
      createOptions.windowId = windowId;
    }

    const groupTab = await chrome.tabs.create(createOptions);

    if (!groupTab.id) {
      sendResponse({
        success: false,
        error: 'Failed to create group tab',
      });
      return;
    }

    // URLにtabIdパラメータを追加（タブ作成後にIDが確定）
    const groupPageUrl = `chrome-extension://${chrome.runtime.id}/group.html?tabId=${groupTab.id}`;
    await chrome.tabs.update(groupTab.id, { url: groupPageUrl });

    // 2. ツリー状態を更新（グループ情報を登録）
    // 注意: loadState()はService Worker起動時に呼ばれているため、ここでは不要
    // Requirement 3.4: デフォルト名「新しいグループ」を設定
    const groupNodeId = await treeStateManager.createGroupWithRealTab(groupTab.id, tabIds, '新しいグループ');

    // 3. ツリー状態更新完了を待ってからアクティブ化
    await chrome.tabs.update(groupTab.id, { active: true });

    // UIに状態更新を通知
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
      // Ignore errors when no listeners are available
    });

    sendResponse({ success: true, data: { groupId: groupNodeId, groupTabId: groupTab.id } });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Task 6.2: グループ解除
 * Requirement 12: グループを解除し、子タブをルートレベルに移動
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

    // 最初のtabIdに対応するノードを見つけ、それがグループノードなら解除
    await treeStateManager.dissolveGroup(tabIds[0]);

    // UIに状態更新を通知
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
      // Ignore errors when no listeners are available
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
 * Task 4.2 (tab-tree-bugfix-2): 複製元タブの登録
 * Requirement 16.1, 16.2, 16.3: 複製されたタブを元のタブの兄弟として配置するために、
 * 複製される前に複製元のタブIDを登録する
 */
function handleRegisterDuplicateSource(
  sourceTabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  try {
    // 複製元タブIDを追加
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
 * Task 15.1 (tab-tree-bugfix-2): グループ情報取得
 * Requirements: 5.4, 5.5, 5.8
 */
async function handleGetGroupInfo(
  tabId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // ストレージから状態を復元
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

/**
 * Task 13.1 (tab-tree-bugfix-2): ドラッグセッション開始
 * Requirements: 6.1, 6.2, 6.3
 */
async function handleStartDragSession(
  payload: { tabId: number; windowId: number; treeData: TabNode[] },
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const { tabId, windowId, treeData } = payload;
    const session = await dragSessionManager.startSession(tabId, windowId, treeData);
    sendResponse({ success: true, data: session });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Task 13.1 (tab-tree-bugfix-2): ドラッグセッション取得
 * Requirements: 6.1, 6.2, 6.7
 */
async function handleGetDragSession(
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    const session = await dragSessionManager.getSession();
    sendResponse({ success: true, data: session });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Task 13.1 (tab-tree-bugfix-2): ドラッグセッション終了
 * Task 8.2 (comprehensive-bugfix): ドラッグ完了時の空ウィンドウ自動クローズ
 * Requirements: 5.4, 5.5, 6.1, 6.7
 */
async function handleEndDragSession(
  reason: string | undefined,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    // Task 8.2: ドラッグ完了時の空ウィンドウ自動クローズ
    // Requirements: 5.4, 5.5
    // セッション終了前にソースウィンドウIDを取得
    const session = await dragSessionManager.getSession(0);
    const sourceWindowId = session?.sourceWindowId;

    await dragSessionManager.endSession(reason || 'COMPLETED');

    // ドラッグ完了時にソースウィンドウが空なら自動クローズ
    if (sourceWindowId !== undefined) {
      await tryCloseEmptyWindow(sourceWindowId);
    }

    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Task 13.1 (tab-tree-bugfix-2): クロスウィンドウ移動開始
 * Requirements: 6.1, 6.2, 6.3, 6.6
 */
async function handleBeginCrossWindowMove(
  targetWindowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await dragSessionManager.beginCrossWindowMove(targetWindowId);
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Task 7.2 (comprehensive-bugfix): ツリービュー上のホバー通知
 * Requirements: 4.4, 4.5
 * 別ウィンドウのツリービュー領域上にマウスがある場合に呼び出す
 * バックグラウンドスロットリング回避のため、対象ウィンドウにフォーカスを移動する
 */
async function handleNotifyTreeViewHover(
  windowId: number,
  sendResponse: (response: MessageResponse<unknown>) => void,
): Promise<void> {
  try {
    await dragSessionManager.notifyTreeViewHover(windowId);
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Task 7.2 (comprehensive-bugfix): ドラッグアウト通知
 * Requirements: 4.4, 4.5
 * ドラッグ中のタブがツリービュー領域を離れた際に呼び出す
 */
function handleNotifyDragOut(
  sendResponse: (response: MessageResponse<unknown>) => void,
): void {
  try {
    dragSessionManager.notifyDragOut();
    sendResponse({ success: true, data: null });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
