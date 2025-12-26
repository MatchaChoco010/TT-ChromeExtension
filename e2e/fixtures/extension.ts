/**
 * ExtensionFixture
 *
 * Chrome拡張機能をPlaywrightでロードするためのカスタムフィクスチャ。
 * Service Workerの起動を待機し、Extension IDを抽出して、
 * テストコンテキストに提供します。
 *
 * @see https://playwright.dev/docs/chrome-extensions
 */
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import type { Page, Worker } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

// ES Moduleで__dirnameを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ExtensionFixturesのインターフェース
 */
export interface ExtensionFixtures {
  /**
   * 拡張機能がロードされたブラウザコンテキスト
   * Persistent Contextとして作成され、テスト終了後に自動的にクローズされます
   */
  extensionContext: BrowserContext;

  /**
   * 拡張機能のID
   * chrome-extension://<extensionId>/... の形式で使用されます
   */
  extensionId: string;

  /**
   * Service Workerへの参照
   * Manifest v3のバックグラウンドスクリプトです
   */
  serviceWorker: Worker;

  /**
   * Side PanelのPage
   * chrome-extension://<extensionId>/sidepanel.html として開かれます
   */
  sidePanelPage: Page;
}

/**
 * 拡張機能のビルドディレクトリへのパス
 */
const getExtensionPath = () => {
  return path.join(__dirname, '../../dist');
};

/**
 * ExtensionFixtureの定義
 */
export const test = base.extend<ExtensionFixtures>({
  /**
   * extensionContext フィクスチャ
   * 拡張機能をロードしたPersistent Contextを作成します
   */
  extensionContext: async ({}, use) => {
    const pathToExtension = getExtensionPath();

    // headlessモードの設定
    // デフォルトでheadlessモード、HEADED=trueでheadedモードに切り替え
    // Requirements: 1.4, 1.5, 6.1, 8.5, 8.6
    const headless = process.env.HEADED !== 'true';

    // Persistent Contextを作成して拡張機能をロード
    const context = await chromium.launchPersistentContext('', {
      headless,
      channel: 'chromium',
      args: [
        headless ? '--headless=new' : '',
        `--disable-extensions-except=${pathToExtension}`,
        `--load-extension=${pathToExtension}`,
        // 拡張機能のエラーを表示
        '--enable-logging=stderr',
        '--v=1',
      ].filter(Boolean),
    });

    // テストで使用
    await use(context);

    // クリーンアップ: コンテキストをクローズ
    await context.close();
  },

  /**
   * extensionId フィクスチャ
   * Service Worker URLからExtension IDを抽出します
   */
  extensionId: async ({ extensionContext }, use) => {
    // 既存のService Workerを取得、または待機
    let [serviceWorker] = extensionContext.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await extensionContext.waitForEvent('serviceworker', {
        timeout: 10000, // 10秒タイムアウト
      });
    }

    // Service Worker URLからExtension IDを抽出
    // URL形式: chrome-extension://<extensionId>/service-worker.js
    const extensionId = serviceWorker.url().split('/')[2];

    if (!extensionId || extensionId.length !== 32) {
      throw new Error(
        `Invalid extension ID extracted: ${extensionId}. Service Worker URL: ${serviceWorker.url()}`
      );
    }

    // テストで使用
    await use(extensionId);
  },

  /**
   * serviceWorker フィクスチャ
   * Service Workerへの参照を提供します
   */
  serviceWorker: async ({ extensionContext }, use) => {
    // 既存のService Workerを取得、または待機
    let [serviceWorker] = extensionContext.serviceWorkers();
    if (!serviceWorker) {
      serviceWorker = await extensionContext.waitForEvent('serviceworker', {
        timeout: 10000, // 10秒タイムアウト
      });
    }

    // テストで使用
    await use(serviceWorker);
  },

  /**
   * sidePanelPage フィクスチャ
   * Side Panelページを開いて提供します
   */
  sidePanelPage: async ({ extensionContext, extensionId }, use) => {
    // 新しいページを作成
    const page = await extensionContext.newPage();

    // Side PanelのURLに移動
    await page.goto(`chrome-extension://${extensionId}/sidepanel.html`);

    // DOMContentLoadedイベントを待機
    await page.waitForLoadState('domcontentloaded');

    // Reactのルート要素が表示されるまで待機
    try {
      await page.waitForSelector('#root', { timeout: 5000 });
    } catch (error) {
      // エラー時にスクリーンショットを保存してデバッグを支援
      await page.screenshot({
        path: 'test-results/sidepanel-load-error.png',
      });
      throw new Error(
        `Failed to load Side Panel. Root element not found. Screenshot saved to test-results/sidepanel-load-error.png. Error: ${error}`
      );
    }

    // テストで使用
    await use(page);

    // クリーンアップ: ページをクローズ
    await page.close();
  },
});

/**
 * expectのエクスポート
 * テストファイルでの使用を簡素化します
 */
export { expect } from '@playwright/test';
