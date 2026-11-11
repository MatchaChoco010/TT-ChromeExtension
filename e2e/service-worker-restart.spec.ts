/**
 * 同一ブラウザセッション内でのService Worker再起動時の状態復元テスト
 *
 * Service Workerはアイドル状態が続くと停止し、次のタブイベントやメッセージで再起動する。
 * 停止中に発生したタブ操作がService Workerを起こした場合でも、ツリーとタブの対応が保たれることを確認する。
 */
import { test, expect, type Page } from '@playwright/test';
import {
  createInitialContext,
  createTestUserDataDir,
  removeTestUserDataDir,
  type BrowserRestartResult,
} from './utils/browser-restart-utils';
import { waitForInitialized } from './utils/polling-utils';
import {
  createTab,
  getCurrentWindowId,
  getInitialBrowserTabId,
  getTestServerUrl,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { restartServiceWorkerBy, stopServiceWorker } from './utils/service-worker-utils';

test.describe('Service Worker再起動時の状態復元', () => {
  let userDataDir: string;
  let browserResult: BrowserRestartResult;

  test.beforeEach(async () => {
    userDataDir = createTestUserDataDir();
    const headless = process.env.HEADED !== 'true';
    browserResult = await createInitialContext(userDataDir, headless);
  });

  test.afterEach(async () => {
    if (browserResult?.context) {
      await browserResult.context.close();
    }
    if (userDataDir) {
      removeTestUserDataDir(userDataDir);
    }
  });

  const findPageByUrl = (pages: Page[], url: string): Page => {
    const page = pages.find((p) => p.url() === url);
    if (!page) {
      throw new Error(`Page not found: ${url}`);
    }
    return page;
  };

  /**
   * 再起動後のService WorkerにはPlaywrightのWorkerでアクセスできないため、拡張機能のページからタブを閉じる
   */
  const closeTabFromExtensionPage = async (extensionPage: Page, tabId: number): Promise<void> => {
    await extensionPage.evaluate((tabId) => chrome.tabs.remove(tabId), tabId);
  };

  test('Service Worker停止中にタブを閉じても、再起動後に残りのタブとツリーの対応が保たれる', async () => {
    test.setTimeout(60000);

    const { context, serviceWorker, sidePanelPage } = browserResult;
    await waitForInitialized(serviceWorker);

    const windowId = await getCurrentWindowId(serviceWorker);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-parent'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-child'), parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    const closedUrl = getTestServerUrl('/sw-restart-closed');
    const closedTabId = await createTab(serviceWorker, closedUrl);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: closedTabId, depth: 0 },
    ], 0);

    const closedChildTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-closed-child'), closedTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: closedTabId, depth: 0, expanded: true },
      { tabId: closedChildTabId, depth: 1 },
    ], 0);

    const tailTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-tail'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: closedTabId, depth: 0, expanded: true },
      { tabId: closedChildTabId, depth: 1 },
      { tabId: tailTabId, depth: 0 },
    ], 0);

    const serviceWorkerUrl = serviceWorker.url();
    await stopServiceWorker(context, sidePanelPage, serviceWorker);
    await restartServiceWorkerBy(context, sidePanelPage, serviceWorkerUrl, async () => {
      await findPageByUrl(context.pages(), closedUrl).close();
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: closedChildTabId, depth: 0 },
      { tabId: tailTabId, depth: 0 },
    ], 0);

    await closeTabFromExtensionPage(sidePanelPage, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: closedChildTabId, depth: 0 },
      { tabId: tailTabId, depth: 0 },
    ], 0);
  });

  test('Service Worker停止中に既存タブの間へタブを開いても、再起動後に既存タブとツリーの対応が保たれ、新しいタブが追加される', async () => {
    test.setTimeout(60000);

    const { context, serviceWorker, sidePanelPage } = browserResult;
    await waitForInitialized(serviceWorker);

    const windowId = await getCurrentWindowId(serviceWorker);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-parent'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-child'), parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    const siblingTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-sibling'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: siblingTabId, depth: 0 },
    ], 0);

    const serviceWorkerUrl = serviceWorker.url();
    const openedUrl = getTestServerUrl('/sw-restart-opened');
    await stopServiceWorker(context, sidePanelPage, serviceWorker);
    let openedTabId: number | undefined;
    await restartServiceWorkerBy(context, sidePanelPage, serviceWorkerUrl, async () => {
      openedTabId = await sidePanelPage.evaluate(async ({ url, parentTabId }) => {
        const parentTab = await chrome.tabs.get(parentTabId);
        const openedTab = await chrome.tabs.create({ url, index: parentTab.index, active: false });
        return openedTab.id;
      }, { url: openedUrl, parentTabId });
    });
    expect(openedTabId).toBeDefined();

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: siblingTabId, depth: 0 },
      { tabId: openedTabId!, depth: 0 },
    ], 0);

    await closeTabFromExtensionPage(sidePanelPage, siblingTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: openedTabId!, depth: 0 },
    ], 0);
  });

  test('Service Worker停止中にChrome側でタブを移動しても、再起動後にツリーとタブの対応が保たれ、タブの並びがツリーに戻る', async () => {
    test.setTimeout(60000);

    const { context, serviceWorker, sidePanelPage } = browserResult;
    await waitForInitialized(serviceWorker);

    const windowId = await getCurrentWindowId(serviceWorker);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-parent'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-child'), parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    const siblingTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-sibling'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: siblingTabId, depth: 0 },
    ], 0);

    const movedTabId = await createTab(serviceWorker, getTestServerUrl('/sw-restart-moved'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: siblingTabId, depth: 0 },
      { tabId: movedTabId, depth: 0 },
    ], 0);

    const serviceWorkerUrl = serviceWorker.url();
    await stopServiceWorker(context, sidePanelPage, serviceWorker);
    await restartServiceWorkerBy(context, sidePanelPage, serviceWorkerUrl, async () => {
      await sidePanelPage.evaluate(async ({ movedTabId, parentTabId }) => {
        const parentTab = await chrome.tabs.get(parentTabId);
        await chrome.tabs.move(movedTabId, { index: parentTab.index });
      }, { movedTabId, parentTabId });
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: siblingTabId, depth: 0 },
      { tabId: movedTabId, depth: 0 },
    ], 0);

    await expect.poll(async () => {
      return sidePanelPage.evaluate(async (windowId) => {
        const sidePanelUrlPrefix = `chrome-extension://${chrome.runtime.id}/sidepanel.html`;
        const tabs = await chrome.tabs.query({ windowId });
        return tabs
          .filter((t) => !(t.url || t.pendingUrl || '').startsWith(sidePanelUrlPrefix))
          .sort((a, b) => a.index - b.index)
          .map((t) => t.id);
      }, windowId);
    }, { timeout: 10000 }).toEqual([initialBrowserTabId, parentTabId, childTabId, siblingTabId, movedTabId]);

    await closeTabFromExtensionPage(sidePanelPage, siblingTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: movedTabId, depth: 0 },
    ], 0);
  });
});
