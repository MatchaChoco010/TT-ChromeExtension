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
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

// ES Moduleで__dirnameを取得
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * デバッグログのヘルパー関数
 * CI環境やDEBUG=true環境でのみログを出力
 */
const debugLog = (message: string) => {
  if (process.env.CI === 'true' || process.env.DEBUG === 'true') {
    console.log(`[ExtensionFixture] ${new Date().toISOString()} - ${message}`);
  }
};

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
 * 拡張機能のビルド成果物を検証するヘルパー関数
 * 拡張機能のロード前に必要なファイルが存在するか確認
 */
const validateExtensionBuild = (extensionPath: string): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];
  const requiredFiles = [
    'manifest.json',
    'service-worker-loader.js',
    'sidepanel.html',
  ];

  // ディレクトリの存在確認
  if (!fs.existsSync(extensionPath)) {
    errors.push(`Extension directory does not exist: ${extensionPath}`);
    return { valid: false, errors };
  }

  // 必須ファイルの存在確認
  for (const file of requiredFiles) {
    const filePath = path.join(extensionPath, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Required file missing: ${file}`);
    }
  }

  // manifest.jsonの内容検証
  const manifestPath = path.join(extensionPath, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      if (!manifest.background?.service_worker) {
        errors.push('manifest.json is missing background.service_worker');
      }
    } catch (e) {
      errors.push(`Failed to parse manifest.json: ${e}`);
    }
  }

  return { valid: errors.length === 0, errors };
};

/**
 * Service Workerの起動を待機するヘルパー関数
 * extensionContextフィクスチャで使用し、他のフィクスチャは
 * 起動済みのService Workerを利用する
 *
 * 実装方針:
 * 1. まず既存のService Workerをチェック
 * 2. 見つからなければシンプルなポーリングで待機
 *
 * 注: Promise.any + waitForEvent の複雑な実装は
 * ブラウザコンテキストがクローズされた際にエラーが発生するため、
 * シンプルなポーリング方式を採用
 */
const waitForServiceWorker = async (
  context: BrowserContext,
  timeout: number = 60000
): Promise<Worker> => {
  const startTime = Date.now();
  debugLog(`Starting to wait for Service Worker (timeout: ${timeout}ms)`);

  // 1. まず既存のService Workerをチェック
  const existingWorkers = context.serviceWorkers();
  if (existingWorkers.length > 0) {
    debugLog(`Found existing Service Worker immediately: ${existingWorkers[0].url()}`);
    return existingWorkers[0];
  }

  debugLog('No existing Service Worker found, starting polling');

  // 2. シンプルなポーリングで待機
  const pollInterval = 100;
  let pollCount = 0;

  while (Date.now() - startTime < timeout) {
    pollCount++;

    // 短い待機
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    // Service Workerをチェック
    const workers = context.serviceWorkers();
    if (workers.length > 0) {
      const elapsed = Date.now() - startTime;
      debugLog(`Service Worker detected via polling (poll #${pollCount}) in ${elapsed}ms: ${workers[0].url()}`);
      return workers[0];
    }
  }

  // タイムアウト: 最終チェック
  const finalWorkers = context.serviceWorkers();
  if (finalWorkers.length > 0) {
    const elapsed = Date.now() - startTime;
    debugLog(`Service Worker found in final check after ${elapsed}ms: ${finalWorkers[0].url()}`);
    return finalWorkers[0];
  }

  const elapsed = Date.now() - startTime;
  debugLog(`Service Worker startup FAILED after ${elapsed}ms (${pollCount} polls)`);

  throw new Error(
    `Service Worker did not start within ${elapsed}ms (${pollCount} polls). ` +
    `This may indicate the extension failed to load.`
  );
};

/**
 * 一意なユーザーデータディレクトリを作成するヘルパー関数
 *
 * 並列実行時の安定性を確保するため、各テストワーカーごとに
 * 独立したユーザーデータディレクトリを作成する。
 *
 * 注意: launchPersistentContext('') で空文字列を渡すとPlaywrightが
 * 一時ディレクトリを管理するが、並列実行時に競合が発生することがある。
 * 明示的にディレクトリを作成することでこの問題を回避する。
 *
 * リポジトリ内の .playwright-tmp/ ディレクトリを使用することで、
 * サンドボックス環境でも安全に動作する。
 */
const createUniqueUserDataDir = (): string => {
  // リポジトリ内に一時ディレクトリを作成（サンドボックス環境対応）
  const projectRoot = path.join(__dirname, '../..');
  const tmpDir = path.join(projectRoot, '.playwright-tmp');
  const uniqueId = randomUUID();
  const userDataDir = path.join(tmpDir, uniqueId);

  // ディレクトリを作成
  fs.mkdirSync(userDataDir, { recursive: true });
  debugLog(`Created unique user data directory: ${userDataDir}`);

  return userDataDir;
};

/**
 * ユーザーデータディレクトリを削除するヘルパー関数
 */
const removeUserDataDir = (userDataDir: string): void => {
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    debugLog(`Removed user data directory: ${userDataDir}`);
  } catch (error) {
    // 削除失敗は警告のみ（テスト自体は成功）
    debugLog(`Warning: Failed to remove user data directory: ${error}`);
  }
};

/**
 * ブラウザコンテキストを作成し、拡張機能をロードするヘルパー関数
 *
 * 重要: Service Workerの検出はコンテキスト作成と同時に行う必要がある。
 * launchPersistentContext が完了した時点で、Service Workerが既に起動している
 * 可能性があるため、イベントリスナーを後から設定すると見逃すことがある。
 *
 * 解決策: launchPersistentContext の直後に即座に serviceWorkers() を確認し、
 * 存在しない場合のみイベント待機を行う。
 *
 * 並列実行対策: 各テストワーカーに独自のユーザーデータディレクトリを割り当て、
 * ブラウザインスタンス間の競合を完全に防止する。
 */
const createExtensionContext = async (
  extensionPath: string,
  headless: boolean
): Promise<{ context: BrowserContext; userDataDir: string }> => {
  debugLog('Creating browser context');

  // 拡張機能のビルド成果物を検証
  const validation = validateExtensionBuild(extensionPath);
  if (!validation.valid) {
    throw new Error(`Extension build validation failed:\n${validation.errors.join('\n')}`);
  }
  debugLog('Extension build validation passed');

  // 一意なユーザーデータディレクトリを作成（並列実行時の競合を防止）
  const userDataDir = createUniqueUserDataDir();

  // Persistent Contextを作成して拡張機能をロード
  // 重要: Chrome拡張機能はheadlessモードで正式サポートされていないため、
  // --headless=new を使用する（Playwrightのheadlessオプションではなく）
  const context = await chromium.launchPersistentContext(userDataDir, {
    // headlessオプションは使用しない（--headless=new を args で指定）
    headless: false,
    channel: 'chromium',
    args: [
      // Chrome拡張機能をサポートする新しいheadlessモード
      ...(headless ? ['--headless=new'] : []),
      // 拡張機能のロード
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      // 安定性向上のための設定
      '--disable-gpu',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      // Service Worker起動の安定性向上
      '--disable-features=TranslateUI',
      '--disable-component-extensions-with-background-pages',
    ],
  });

  debugLog('Browser context created successfully');

  // Service Workerの起動を待機（30秒タイムアウト）
  const timeout = 30000;
  await waitForServiceWorker(context, timeout);

  debugLog('Service Worker is ready');
  return { context, userDataDir };
};

/**
 * ExtensionFixtureの定義
 */
export const test = base.extend<ExtensionFixtures>({
  /**
   * extensionContext フィクスチャ
   * 拡張機能をロードしたPersistent Contextを作成します
   * Service Workerの起動を待機してから返すことで、
   * 他のフィクスチャのタイムアウトを防ぎます
   *
   * 並列実行対策: 各テストワーカーに独自のユーザーデータディレクトリを
   * 割り当て、テスト終了後にクリーンアップする
   */
  extensionContext: async ({}, use) => {
    const pathToExtension = getExtensionPath();

    // headlessモードの設定
    // デフォルトでheadlessモード、HEADED=trueでheadedモードに切り替え
    const headless = process.env.HEADED !== 'true';

    // ブラウザコンテキストを作成（一意なユーザーデータディレクトリ付き）
    const { context, userDataDir } = await createExtensionContext(pathToExtension, headless);

    // テストで使用
    await use(context);

    // クリーンアップ: コンテキストをクローズ
    debugLog('Closing browser context');
    await context.close();

    // クリーンアップ: ユーザーデータディレクトリを削除
    removeUserDataDir(userDataDir);
  },

  /**
   * extensionId フィクスチャ
   * Service Worker URLからExtension IDを抽出します
   * 注: extensionContextフィクスチャでService Workerの起動を待機済みなので、
   * ここでは即座に取得できます
   */
  extensionId: async ({ extensionContext }, use) => {
    // extensionContextフィクスチャでService Workerは既に起動済み
    const workers = extensionContext.serviceWorkers();

    if (workers.length === 0) {
      throw new Error(
        'Service Worker not found. This should not happen as extensionContext waits for it.'
      );
    }

    const serviceWorker = workers[0];

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
   * 注: extensionContextフィクスチャでService Workerの起動を待機済みなので、
   * ここでは即座に取得できます
   */
  serviceWorker: async ({ extensionContext }, use) => {
    // extensionContextフィクスチャでService Workerは既に起動済み
    const workers = extensionContext.serviceWorkers();

    if (workers.length === 0) {
      throw new Error(
        'Service Worker not found. This should not happen as extensionContext waits for it.'
      );
    }

    // テストで使用
    await use(workers[0]);
  },

  /**
   * sidePanelPage フィクスチャ
   * Side Panelページを開いて提供します
   */
  sidePanelPage: async ({ extensionContext, extensionId, serviceWorker }, use) => {
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

    // ツリー状態がストレージに保存されるまで待機（状態同期の完了を確認）
    await serviceWorker.evaluate(async () => {
      for (let i = 0; i < 50; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes?: Record<string, unknown> } | undefined;
        if (treeState?.nodes && Object.keys(treeState.nodes).length > 0) {
          return; // Tree state is ready
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // タイムアウトしてもエラーにはしない（タブがまだない場合もある）
    });

    // Side Panelのルート要素が安定するまで少し待機
    await page.waitForSelector('[data-testid="side-panel-root"]', { timeout: 5000 });

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
