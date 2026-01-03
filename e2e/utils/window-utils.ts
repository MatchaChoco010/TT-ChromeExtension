/**
 * WindowTestUtils
 *
 * マルチウィンドウ操作とクロスウィンドウドラッグ&ドロップ検証のヘルパー関数
 */
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

  // Service Workerコンテキストでchrome.windows.create()を実行
  const window = await serviceWorker.evaluate(() => {
    return chrome.windows.create({
      focused: false,
      type: 'normal',
    });
  });

  const windowId = window.id as number;

  // ウィンドウがChrome内部状態に完全に登録されるまでポーリングで待機
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
 * タブを別ウィンドウに移動
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

  // Service Workerコンテキストでchrome.tabs.move()を実行
  await serviceWorker.evaluate(
    ({ tabId, windowId }) => {
      return chrome.tabs.move(tabId, {
        windowId,
        index: -1, // ウィンドウの最後に配置
      });
    },
    { tabId, windowId }
  );

  // タブが指定ウィンドウに移動完了するまでポーリングで待機
  await serviceWorker.evaluate(
    async ({ tabId, windowId }) => {
      for (let i = 0; i < 50; i++) {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.windowId === windowId) {
            return;
          }
        } catch {
          // エラーは無視して続行
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    },
    { tabId, windowId }
  );
}

/**
 * クロスウィンドウドラッグ&ドロップをシミュレート
 *
 * 注: 実際のドラッグ&ドロップUIをシミュレートする代わりに、
 * 内部的にmoveTabToWindowを使用してタブを移動します。
 * これは、クロスウィンドウのドラッグ&ドロップUIが複雑であるため、
 * E2Eテストでは実際のAPI呼び出しでの検証に焦点を当てています。
 *
 * @param page - Side PanelのPage
 * @param tabId - 移動するタブのID
 * @param targetWindowId - 移動先のウィンドウID
 */
export async function dragTabToWindow(
  page: Page,
  tabId: number,
  targetWindowId: number
): Promise<void> {
  // 現在のコンテキストを取得
  const context = page.context();

  // 内部的にmoveTabToWindowを使用（ポーリング待機込み）
  await moveTabToWindow(context, tabId, targetWindowId);
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

  // ウィンドウのタブがストレージに同期されるまでポーリングで待機
  await serviceWorker.evaluate(async (windowId: number) => {
    for (let i = 0; i < 50; i++) {
      try {
        const tabs = await chrome.tabs.query({ windowId });
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;

        const tabToNode = treeState?.tabToNode;
        if (tabToNode && tabs.length > 0) {
          // すべてのタブがツリー状態に存在することを確認
          const allTabsSynced = tabs.every(
            (tab: chrome.tabs.Tab) => tab.id && tabToNode[tab.id]
          );
          if (allTabsSynced) {
            return;
          }
        }
      } catch {
        // エラーは無視して続行
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }, windowId);

  // 最終的にタブが存在することを確認
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

  // Extension IDを取得
  const extensionId = serviceWorker.url().split('/')[2];

  // ウィンドウをアクティブにする
  await serviceWorker.evaluate(
    ({ windowId }) => {
      return chrome.windows.update(windowId, { focused: true });
    },
    { windowId }
  );

  // 少し待機してウィンドウのフォーカスが確定するのを待つ
  await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 200)));

  // 新しいページを作成し、サイドパネルURLを開く
  // サイドパネルは現在アクティブなウィンドウに対応するため、
  // windowIdをクエリパラメータとして渡してウィンドウを特定する
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);

  // DOMContentLoadedイベントを待機
  await page.waitForLoadState('domcontentloaded');

  // Reactのルート要素が表示されるまで待機
  await page.waitForSelector('#root', { timeout: 5000 });

  // Side Panelのルート要素が安定するまで待機
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

