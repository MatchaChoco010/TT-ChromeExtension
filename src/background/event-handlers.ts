// Service Worker event handlers
import type { MessageType, MessageResponse, TabNode } from '@/types';
import { TreeStateManager } from '@/services/TreeStateManager';
import { UnreadTracker } from '@/services/UnreadTracker';
import { StorageService, STORAGE_KEYS } from '@/storage/StorageService';

// Global instances
const storageService = new StorageService();
const treeStateManager = new TreeStateManager(storageService);
const unreadTracker = new UnreadTracker(storageService);

// Initialize unread tracker from storage
unreadTracker.loadFromStorage().catch((_error) => {
  // Failed to load unread tracker silently
});

// Export for testing
export { storageService as testStorageService, treeStateManager as testTreeStateManager, unreadTracker as testUnreadTracker };

// Global drag state for cross-window drag & drop
let dragState: { tabId: number; treeData: TabNode[]; sourceWindowId: number } | null =
  null;

// Default view ID - must match TreeStateProvider's default currentViewId
const DEFAULT_VIEW_ID = 'default';

// Track pending parent relationships for tabs being created
// Map<tabId, openerTabId>
// This is needed because Chrome doesn't reliably include openerTabId in the onCreated event
const pendingTabParents = new Map<number, number>();

// Export to globalThis for access from service worker evaluation contexts (e.g., E2E tests)
declare global {
  // eslint-disable-next-line no-var
  var pendingTabParents: Map<number, number>;
}
globalThis.pendingTabParents = pendingTabParents;

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

// Tab event handlers
export async function handleTabCreated(tab: chrome.tabs.Tab): Promise<void> {

  if (!tab.id) return;

  try {
    // Get user settings to determine new tab position
    const settings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);

    // Task 12.2 (Requirements 9.2, 9.3, 9.4): タブ開き方別の位置ルール適用
    // タブがどのように開かれたかを判定し、適切な位置ルールを選択
    let newTabPosition: 'child' | 'sibling' | 'end';

    if (tab.openerTabId) {
      // Requirement 9.2: リンククリックから開かれたタブ
      // newTabPositionFromLink が設定されていればそれを使用、なければ既存のnewTabPositionを使用(後方互換性)
      newTabPosition =
        settings?.newTabPositionFromLink !== undefined
          ? settings.newTabPositionFromLink
          : settings?.newTabPosition || 'child';
    } else {
      // Requirement 9.3: 手動で開かれたタブ(アドレスバー、新規タブボタンなど)
      // newTabPositionManual が設定されていればそれを使用、なければ既存のnewTabPositionを使用(後方互換性)
      newTabPosition =
        settings?.newTabPositionManual !== undefined
          ? settings.newTabPositionManual
          : settings?.newTabPosition || 'child';
    }

    // Determine parent node
    let parentId: string | null = null;

    // Check if we have a pending parent relationship for this tab
    const pendingOpenerTabId = pendingTabParents.get(tab.id);
    const effectiveOpenerTabId = pendingOpenerTabId || tab.openerTabId;

    if (effectiveOpenerTabId && newTabPosition === 'child') {
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

    // Add tab to tree
    await treeStateManager.addTab(tab, parentId, DEFAULT_VIEW_ID);

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

export async function handleTabRemoved(
  tabId: number,
  removeInfo: chrome.tabs.TabRemoveInfo,
): Promise<void> {
  void removeInfo; // unused parameter

  try {
    // Get user settings for child tab behavior
    const settings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const childTabBehavior = settings?.childTabBehavior || 'promote';

    // Remove tab from tree state
    await treeStateManager.removeTab(tabId, childTabBehavior);

    // Task 4.13: タブが削除された場合、未読状態もクリーンアップ
    if (unreadTracker.isUnread(tabId)) {
      await unreadTracker.markAsRead(tabId);
    }

    // Notify UI about state update
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch((_error) => {
      // Ignore errors when no listeners are available
    });
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
  void tabId; // unused parameter
  void tab; // unused parameter

  try {
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
    // ウィンドウが削除されたとき、UIに状態更新を通知
    // (ウィンドウ内のタブは個別にonRemovedイベントで削除処理される)
    void windowId; // ウィンドウIDは現時点では使用しない

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
        handleCreateWindowWithSubtree(message.payload.tabId, sendResponse);
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
 */
async function handleCreateWindowWithSubtree(
  tabId: number,
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
