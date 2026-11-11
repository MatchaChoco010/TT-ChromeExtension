/**
 * Chromeのウィンドウイベントの処理
 */
import { treeStateManager } from './background-services';
import { detachedPinnedTabsByWindow } from './pending-state';
import { runEventHandler } from './handler-tracking';
import { ignoreMissingTabOrWindow } from '@/utils/chrome-errors';

export function registerWindowEventListeners(): void {
  chrome.windows.onCreated.addListener((window) => {
    runEventHandler('windows.onCreated', () => handleWindowCreated(window));
  });
  chrome.windows.onRemoved.addListener((windowId) => {
    runEventHandler('windows.onRemoved', () => handleWindowRemoved(windowId));
  });
}

async function handleWindowCreated(_window: chrome.windows.Window): Promise<void> {
}

async function handleWindowRemoved(windowId: number): Promise<void> {
  const pinnedTabsToClose = detachedPinnedTabsByWindow.get(windowId);
  if (pinnedTabsToClose) {
    for (const tabId of pinnedTabsToClose) {
      await ignoreMissingTabOrWindow(chrome.tabs.remove(tabId));
    }
    detachedPinnedTabsByWindow.delete(windowId);
  }

  await treeStateManager.removeWindow(windowId);
  await treeStateManager.syncTreeStateToChromeTabs();
  treeStateManager.notifyStateChanged();
}
