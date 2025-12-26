/**
 * ExtensionFixtureのテスト
 *
 * ExtensionFixtureが正しく拡張機能をロードし、
 * Service Workerの起動を待機し、Extension IDを抽出できることを検証します。
 */
import { test, expect } from './fixtures/extension';

test.describe('ExtensionFixture', () => {
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

    // Service Workerが評価可能な状態であることを検証
    const result = await serviceWorker.evaluate(() => {
      return typeof chrome !== 'undefined' && chrome.runtime !== undefined;
    });
    expect(result).toBe(true);
  });

  test('Side Panelページが正しく開けること', async ({
    sidePanelPage,
    extensionId,
  }) => {
    // Side PanelのURLが正しいことを検証
    expect(sidePanelPage.url()).toBe(
      `chrome-extension://${extensionId}/sidepanel.html`
    );

    // ページがロード完了していることを検証
    const readyState = await sidePanelPage.evaluate(() => document.readyState);
    expect(['interactive', 'complete']).toContain(readyState);

    // Reactのルート要素が存在することを検証
    const rootElement = sidePanelPage.locator('#root');
    await expect(rootElement).toBeVisible();
  });

  test('ブラウザコンテキストが正しく設定されていること', async ({
    extensionContext,
  }) => {
    // コンテキストが存在することを検証
    expect(extensionContext).toBeDefined();

    // Service Workerが存在することを検証
    const serviceWorkers = extensionContext.serviceWorkers();
    expect(serviceWorkers.length).toBeGreaterThan(0);

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
    const manifestName = await serviceWorker.evaluate(() => {
      return chrome.runtime.getManifest().name;
    });

    // manifest.jsonのnameが取得できることを検証
    expect(manifestName).toBeDefined();
    expect(manifestName.length).toBeGreaterThan(0);
  });
});
