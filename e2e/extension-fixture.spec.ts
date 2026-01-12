/**
 * ExtensionFixtureのテスト
 */
import { test, expect } from './fixtures/extension';
import { waitForCondition } from './utils/polling-utils';
import { getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { setupWindow } from './utils/setup-utils';

test.describe.serial('ExtensionFixture', () => {
  test('拡張機能がロードされ、Extension IDが取得できること', async ({
    extensionId,
  }) => {
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });

  test('Service Workerが起動完了していること', async ({
    serviceWorker,
    extensionId,
  }) => {
    const workerUrl = serviceWorker.url();
    expect(workerUrl).toContain(`chrome-extension://${extensionId}/`);
    expect(workerUrl).toContain('service-worker');

    await waitForCondition(
      async () => {
        const result = await serviceWorker.evaluate(() => {
          return typeof chrome !== 'undefined' && chrome.runtime !== undefined;
        });
        return result;
      },
      { timeout: 5000, interval: 100, timeoutMessage: 'chrome API was not initialized' }
    );
  });

  test('Side Panelページが正しく開けること', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
    const fullUrl = sidePanelPage.url();
    const baseUrl = `chrome-extension://${extensionId}/sidepanel.html`;
    expect(fullUrl).toContain(baseUrl);

    // chrome-extension:// スキームはURL APIで origin が null になるため、クエリパラメータを直接パースする
    const queryString = fullUrl.split('?')[1] || '';
    const params = new URLSearchParams(queryString);
    expect(params.has('windowId')).toBe(true);
    const urlWindowId = params.get('windowId');
    expect(urlWindowId).toBeTruthy();
    expect(Number(urlWindowId)).toBeGreaterThan(0);

    await waitForCondition(
      async () => {
        const readyState = await sidePanelPage.evaluate(() => document.readyState);
        return readyState === 'complete';
      },
      { timeout: 5000, interval: 100, timeoutMessage: 'Page did not reach complete state' }
    );

    const rootElement = sidePanelPage.locator('#root');
    await expect(rootElement).toBeVisible();
  });

  test('ブラウザコンテキストが正しく設定されていること', async ({
    extensionContext,
  }) => {
    expect(extensionContext).toBeDefined();

    await waitForCondition(
      async () => {
        const serviceWorkers = extensionContext.serviceWorkers();
        return serviceWorkers.length > 0;
      },
      { timeout: 5000, interval: 100, timeoutMessage: 'Service worker was not found' }
    );

    const pages = extensionContext.pages();
    expect(pages.length).toBeGreaterThan(0);
  });

  test('複数のテストで独立したコンテキストが提供されること', async ({
    extensionContext,
  }) => {
    const pages = extensionContext.pages();

    const newPage = await extensionContext.newPage();
    await newPage.goto(getTestServerUrl('/page'));

    await newPage.waitForLoadState('domcontentloaded');

    const newPages = extensionContext.pages();
    expect(newPages.length).toBe(pages.length + 1);

    await newPage.close();
  });

  test('拡張機能のmanifestが正しく読み込まれていること', async ({
    serviceWorker,
  }) => {
    let manifestName = '';
    await waitForCondition(
      async () => {
        try {
          manifestName = await serviceWorker.evaluate(() => {
            return chrome.runtime.getManifest().name;
          });
          return manifestName.length > 0;
        } catch {
          return false;
        }
      },
      { timeout: 5000, interval: 100, timeoutMessage: 'Manifest name was not retrieved' }
    );
  });
});
