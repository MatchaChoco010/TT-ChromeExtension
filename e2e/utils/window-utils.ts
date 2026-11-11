import type { BrowserContext, Page, Worker } from '@playwright/test';
export type { Page } from '@playwright/test';
import { openExtensionPageTab } from './extension-page-utils';
import type { TabNode, TreeState } from '../../src/types';

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

  if (window?.id === undefined) {
    throw new Error('Failed to create window');
  }
  const windowId = window.id;

  await serviceWorker.evaluate(async (windowId: number) => {
    for (let i = 0; i < 50; i++) {
      const windows = await chrome.windows.getAll();
      const found = windows.find(w => w.id === windowId);
      if (found) {
        return;
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
      const treeState: TreeState = globalThis.treeStateManager.toJSON();

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

  const result = await serviceWorker.evaluate(async (windowId: number) => {
    const sidePanelUrlPrefix = `chrome-extension://${chrome.runtime.id}/sidepanel.html`;
    const collectTabIds = (nodes: TabNode[]): number[] =>
      nodes.flatMap((node) => [node.tabId, ...collectTabIds(node.children)]);

    let chromeTabIds: number[] = [];
    let treeTabIds: number[] = [];
    for (let i = 0; i < 50; i++) {
      const tabs = await chrome.tabs.query({ windowId });
      chromeTabIds = tabs
        .filter((tab) => !(tab.url || tab.pendingUrl || '').startsWith(sidePanelUrlPrefix))
        .map((tab) => tab.id)
        .filter((id): id is number => id !== undefined);

      const treeState: TreeState = globalThis.treeStateManager.toJSON();
      const windowState = treeState.windows.find((w) => w.windowId === windowId);
      treeTabIds = windowState
        ? windowState.views.flatMap((view) => [...view.pinnedTabIds, ...collectTabIds(view.rootNodes)])
        : [];

      const treeTabIdSet = new Set(treeTabIds);
      if (chromeTabIds.length > 0 && chromeTabIds.every((id) => treeTabIdSet.has(id))) {
        return { synced: true, chromeTabIds, treeTabIds };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return { synced: false, chromeTabIds, treeTabIds };
  }, windowId);

  if (!result.synced) {
    throw new Error(
      `Window ${windowId} tree is not synced with Chrome tabs.\n` +
      `  Chrome tabs: [${result.chromeTabIds.join(', ')}]\n` +
      `  Tree tabs:   [${result.treeTabIds.join(', ')}]`
    );
  }
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
  const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`;

  await serviceWorker.evaluate(
    (windowId) => chrome.windows.update(windowId, { focused: true }),
    windowId
  );

  const page = await openExtensionPageTab(context, serviceWorker, sidePanelUrl, windowId);
  await page.waitForSelector('[data-testid="side-panel-root"]', { timeout: 5000 });
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

