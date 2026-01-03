/**
 * ExtensionFixtureのテスト
 *
 * ExtensionFixtureが正しく拡張機能をロードし、
 * Service Workerの起動を待機し、Extension IDを抽出できることを検証します。
 */
import { test, expect } from './fixtures/extension';
import { waitForCondition } from './utils/polling-utils';

// リソース競合を避けるため直列実行
test.describe.serial('ExtensionFixture', () => {
  test('拡張機能がロードされ、Extension IDが取得できること', async ({
    extensionId,
  }) => {
    // Extension IDが正しい形式であることを検証
    expect(extensionId).toMatch(/^[a-z]{32}$/);
  });

  test('Service Workerが起動完了していること', async ({
    serviceWorker,
    extensionId,
  }) => {
    // Service WorkerのURLが正しいことを検証
    const workerUrl = serviceWorker.url();
    expect(workerUrl).toContain(`chrome-extension://${extensionId}/`);
    expect(workerUrl).toContain('service-worker');

    // Service Workerが評価可能な状態であることをポーリングで検証
    // chrome APIが完全に初期化されるまで待機
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
    sidePanelPage,
    extensionId,
  }) => {
    // Side PanelのURLが正しいことを検証
    // URLのベース部分とパスを検証し、windowIdクエリパラメータを許容する
    const fullUrl = sidePanelPage.url();
    const baseUrl = `chrome-extension://${extensionId}/sidepanel.html`;
    expect(fullUrl).toContain(baseUrl);

    // windowIdパラメータが存在することを検証（複数ウィンドウ対応の確認）
    // chrome-extension:// スキームはURL APIで origin が null になるため、
    // クエリパラメータを直接パースする
    const queryString = fullUrl.split('?')[1] || '';
    const params = new URLSearchParams(queryString);
    expect(params.has('windowId')).toBe(true);
    const windowId = params.get('windowId');
    expect(windowId).toBeTruthy();
    expect(Number(windowId)).toBeGreaterThan(0);

    // ページがロード完了するまでポーリングで待機
    await waitForCondition(
      async () => {
        const readyState = await sidePanelPage.evaluate(() => document.readyState);
        return readyState === 'complete';
      },
      { timeout: 5000, interval: 100, timeoutMessage: 'Page did not reach complete state' }
    );

    // Reactのルート要素が存在することを検証
    const rootElement = sidePanelPage.locator('#root');
    await expect(rootElement).toBeVisible();
  });

  test('ブラウザコンテキストが正しく設定されていること', async ({
    extensionContext,
  }) => {
    // コンテキストが存在することを検証
    expect(extensionContext).toBeDefined();

    // Service Workerが存在することをポーリングで検証
    await waitForCondition(
      async () => {
        const serviceWorkers = extensionContext.serviceWorkers();
        return serviceWorkers.length > 0;
      },
      { timeout: 5000, interval: 100, timeoutMessage: 'Service worker was not found' }
    );

    // 少なくとも1つのページが存在することを検証（Side Panel）
    const pages = extensionContext.pages();
    expect(pages.length).toBeGreaterThan(0);
  });

  test('複数のテストで独立したコンテキストが提供されること', async ({
    extensionContext,
  }) => {
    // 各テストで新しいコンテキストが作成されることを検証するため、
    // コンテキストのページ数を確認
    const pages = extensionContext.pages();

    // 新しいページを作成
    const newPage = await extensionContext.newPage();
    await newPage.goto('about:blank');

    // ページのロード完了を待機
    await newPage.waitForLoadState('domcontentloaded');

    // ページ数が増加したことを検証
    const newPages = extensionContext.pages();
    expect(newPages.length).toBe(pages.length + 1);

    // クリーンアップ
    await newPage.close();
  });

  test('拡張機能のmanifestが正しく読み込まれていること', async ({
    serviceWorker,
  }) => {
    // Service Workerからmanifest情報を取得
    // chrome.runtime APIが利用可能になるまでポーリング
    let manifestName = '';
    await waitForCondition(
      async () => {
        try {
          manifestName = await serviceWorker.evaluate(() => {
            return chrome.runtime.getManifest().name;
          });
          return manifestName.length > 0;
        } catch {
          // chrome.runtime APIがまだ利用できない場合は待機
          return false;
        }
      },
      { timeout: 5000, interval: 100, timeoutMessage: 'Manifest name was not retrieved' }
    );
  });
});
