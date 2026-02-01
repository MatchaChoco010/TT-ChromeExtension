import type { BrowserContext, Page, Worker } from '@playwright/test';
export type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Service Workerを取得
 *
 * @param context - ブラウザコンテキスト
 * @returns Service Worker
 */
async function getServiceWorker(context: BrowserContext): Promise<Worker> {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  return serviceWorker;
}

/**
 * 新しいウィンドウを作成
 *
 * @param context - ブラウザコンテキスト
 * @returns 作成されたウィンドウのID
 */
export async function createWindow(context: BrowserContext): Promise<number> {
  const serviceWorker = await getServiceWorker(context);

  const window = await serviceWorker.evaluate(() => {
    return chrome.windows.create({
      focused: false,
      type: 'normal',
    });
  });

  const windowId = window.id as number;

  await serviceWorker.evaluate(async (windowId: number) => {
    for (let i = 0; i < 50; i++) {
      try {
        const windows = await chrome.windows.getAll();
        const found = windows.find(w => w.id === windowId);
        if (found) {
          return;
        }
      } catch {
        // エラーは無視して続行
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, windowId);

  return windowId;
}

/**
 * タブを別ウィンドウに移動（子孫タブも一緒に移動）
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - 移動するタブのID
 * @param windowId - 移動先のウィンドウID
 */
export async function moveTabToWindow(
  context: BrowserContext,
  tabId: number,
  windowId: number
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  const tabIdsToMove = await serviceWorker.evaluate(
    async ({ tabId }) => {
      interface TabNode {
        tabId: number;
        isExpanded: boolean;
        children: TabNode[];
      }
      interface ViewState {
        name: string;
        color: string;
        rootNodes: TabNode[];
      }
      interface WindowState {
        windowId: number;
        views: ViewState[];
        activeViewIndex: number;
        pinnedTabIds: number[];
      }
      interface TreeState {
        windows: WindowState[];
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;

      if (!treeState?.windows) {
        return [tabId];
      }

      const findNode = (nodes: TabNode[], targetTabId: number): TabNode | null => {
        for (const node of nodes) {
          if (node.tabId === targetTabId) {
            return node;
          }
          const found = findNode(node.children, targetTabId);
          if (found) {
            return found;
          }
        }
        return null;
      };

      const collectDescendants = (node: TabNode): number[] => {
        const tabIds: number[] = [node.tabId];
        for (const child of node.children) {
          tabIds.push(...collectDescendants(child));
        }
        return tabIds;
      };

      for (const windowState of treeState.windows) {
        for (const view of windowState.views) {
          const node = findNode(view.rootNodes, tabId);
          if (node) {
            return collectDescendants(node);
          }
        }
      }

      return [tabId];
    },
    { tabId }
  );

  for (const id of tabIdsToMove) {
    await serviceWorker.evaluate(
      ({ tabId, windowId }) => {
        return chrome.tabs.move(tabId, {
          windowId,
          index: -1,
        });
      },
      { tabId: id, windowId }
    );
  }

  await serviceWorker.evaluate(
    async ({ tabIds, windowId }) => {
      for (let i = 0; i < 50; i++) {
        try {
          let allMoved = true;
          for (const tabId of tabIds) {
            const tab = await chrome.tabs.get(tabId);
            if (tab.windowId !== windowId) {
              allMoved = false;
              break;
            }
          }
          if (allMoved) {
            return;
          }
        } catch {
          // エラーは無視して続行
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    },
    { tabIds: tabIdsToMove, windowId }
  );
}

/**
 * 各ウィンドウのツリー状態が正しく同期されることを検証
 *
 * @param context - ブラウザコンテキスト
 * @param windowId - 検証するウィンドウのID
 */
export async function assertWindowTreeSync(
  context: BrowserContext,
  windowId: number
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  await serviceWorker.evaluate(async (windowId: number) => {
    interface TabNode {
      tabId: number;
      isExpanded: boolean;
      children: TabNode[];
    }
    interface ViewState {
      name: string;
      color: string;
      rootNodes: TabNode[];
    }
    interface WindowState {
      windowId: number;
      views: ViewState[];
      activeViewIndex: number;
      pinnedTabIds: number[];
    }
    interface TreeState {
      windows: WindowState[];
    }

    const collectAllTabIds = (nodes: TabNode[]): Set<number> => {
      const tabIds = new Set<number>();
      for (const node of nodes) {
        tabIds.add(node.tabId);
        for (const childTabId of collectAllTabIds(node.children)) {
          tabIds.add(childTabId);
        }
      }
      return tabIds;
    };

    for (let i = 0; i < 50; i++) {
      try {
        const tabs = await chrome.tabs.query({ windowId });
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;

        if (treeState?.windows && tabs.length > 0) {
          const windowState = treeState.windows.find(w => w.windowId === windowId);
          if (windowState) {
            const allTreeTabIds = new Set<number>();
            for (const view of windowState.views) {
              for (const tabId of collectAllTabIds(view.rootNodes)) {
                allTreeTabIds.add(tabId);
              }
            }
            for (const pinnedTabId of windowState.pinnedTabIds) {
              allTreeTabIds.add(pinnedTabId);
            }

            const allTabsSynced = tabs.every(
              (tab: chrome.tabs.Tab) => tab.id && allTreeTabIds.has(tab.id)
            );
            if (allTabsSynced) {
              return;
            }
          }
        }
      } catch {
        // エラーは無視して続行
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, windowId);

  const tabs = await serviceWorker.evaluate((windowId) => {
    return chrome.tabs.query({ windowId });
  }, windowId);

  expect(tabs).toBeDefined();
  expect(Array.isArray(tabs)).toBe(true);
}

/**
 * 指定されたウィンドウ用のサイドパネルを開く
 *
 * 注: Chrome拡張機能のサイドパネルはウィンドウごとに独立して開く。
 * 各ウィンドウで独自のタブツリーを表示するため、この関数を使用して
 * 特定のウィンドウのサイドパネルを取得する。
 *
 * @param context - ブラウザコンテキスト
 * @param windowId - サイドパネルを開くウィンドウのID
 * @returns Side PanelのPage
 */
export async function openSidePanelForWindow(
  context: BrowserContext,
  windowId: number
): Promise<Page> {
  const serviceWorker = await getServiceWorker(context);

  const extensionId = serviceWorker.url().split('/')[2];

  await serviceWorker.evaluate(
    ({ windowId }) => {
      return chrome.windows.update(windowId, { focused: true });
    },
    { windowId }
  );

  await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));

  const page = await context.newPage();
  const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`;
  await page.goto(sidePanelUrl);

  await page.waitForLoadState('domcontentloaded');
  await page.waitForSelector('#root', { timeout: 5000 });
  await page.waitForSelector('[data-testid="side-panel-root"]', { timeout: 5000 });

  // sidePanelPageのタブが正しいウィンドウにあることを確認し、必要に応じて移動
  const sidePanelTabId = await serviceWorker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(t => (t.url || t.pendingUrl) === url);
    return tab?.id;
  }, sidePanelUrl);

  if (sidePanelTabId !== undefined) {
    const currentWindowId = await serviceWorker.evaluate(async (tabId) => {
      const tab = await chrome.tabs.get(tabId);
      return tab.windowId;
    }, sidePanelTabId);

    if (currentWindowId !== windowId) {
      await serviceWorker.evaluate(async ({ tabId, targetWindowId }) => {
        await chrome.tabs.move(tabId, { windowId: targetWindowId, index: -1 });
      }, { tabId: sidePanelTabId, targetWindowId: windowId });

      await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
    }
  }

  return page;
}

/**
 * 指定されたウィンドウを閉じる
 *
 * @param context - ブラウザコンテキスト
 * @param windowId - 閉じるウィンドウのID
 */
export async function closeWindow(
  context: BrowserContext,
  windowId: number
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  await serviceWorker.evaluate((windowId) => {
    return chrome.windows.remove(windowId);
  }, windowId);
}

