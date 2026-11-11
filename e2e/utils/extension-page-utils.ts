/**
 * 拡張機能のページ（擬似サイドパネル等）をタブとして開くユーティリティ
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * 拡張機能のページを新しいタブとして開き、そのPageを返す
 *
 * タブは作成時点でURLを持つため、Service WorkerのonCreatedはそのURLで擬似サイドパネル等を判別できる。
 * windowIdを指定した場合は、そのウィンドウにタブを作成する。
 *
 * @param context - ブラウザコンテキスト
 * @param serviceWorker - タブ作成に使うService Worker
 * @param url - 開くページのURL
 * @param windowId - タブを作成するウィンドウのID
 * @returns 開いたページ
 */
export async function openExtensionPageTab(
  context: BrowserContext,
  serviceWorker: Worker,
  url: string,
  windowId?: number
): Promise<Page> {
  const existingPages = new Set(context.pages());

  await serviceWorker.evaluate(
    async ({ url, windowId }) => {
      await chrome.tabs.create({ url, active: true, ...(windowId !== undefined && { windowId }) });
    },
    { url, windowId }
  );

  let openedPage: Page | undefined;
  await expect
    .poll(
      () => {
        openedPage = context.pages().find((page) => !existingPages.has(page) && page.url() === url);
        return openedPage !== undefined;
      },
      { timeout: 10000, intervals: [20], message: `Extension page did not open: ${url}` }
    )
    .toBe(true);

  const page = openedPage!;
  await page.waitForLoadState('domcontentloaded');
  return page;
}
