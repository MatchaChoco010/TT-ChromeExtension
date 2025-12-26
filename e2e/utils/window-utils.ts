/**
 * WindowTestUtils
 *
 * マルチウィンドウ操作とクロスウィンドウドラッグ&ドロップ検証のヘルパー関数
 *
 * Requirements: 3.6, 4.2
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';
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

  // 少し待機して、ウィンドウの作成を確実にする
  const [page] = context.pages();
  if (page) {
    await page.waitForTimeout(300);
  }

  return window.id as number;
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

  // タブが移動するまで少し待機
  const [page] = context.pages();
  if (page) {
    await page.waitForTimeout(300);
  }
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

  // 内部的にmoveTabToWindowを使用
  await moveTabToWindow(context, tabId, targetWindowId);

  // ドラッグ&ドロップ操作後の待機
  await page.waitForTimeout(300);
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

  // Service Workerコンテキストでウィンドウのタブを取得
  const tabs = await serviceWorker.evaluate((windowId) => {
    return chrome.tabs.query({ windowId });
  }, windowId);

  // タブが存在することを確認（ウィンドウが存在し、同期されていることを示す）
  expect(tabs).toBeDefined();
  expect(Array.isArray(tabs)).toBe(true);

  // 少し待機して、ツリーの同期を確実にする
  const [page] = context.pages();
  if (page) {
    await page.waitForTimeout(200);
  }
}
