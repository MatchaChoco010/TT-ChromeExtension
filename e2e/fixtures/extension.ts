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

  if (!fs.existsSync(extensionPath)) {
    errors.push(`Extension directory does not exist: ${extensionPath}`);
    return { valid: false, errors };
  }

  for (const file of requiredFiles) {
    const filePath = path.join(extensionPath, file);
    if (!fs.existsSync(filePath)) {
      errors.push(`Required file missing: ${file}`);
    }
  }

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

  const existingWorkers = context.serviceWorkers();
  if (existingWorkers.length > 0) {
    return existingWorkers[0];
  }

  const pollInterval = 100;
  let pollCount = 0;

  while (Date.now() - startTime < timeout) {
    pollCount++;

    await new Promise(resolve => setTimeout(resolve, pollInterval));

    const workers = context.serviceWorkers();
    if (workers.length > 0) {
      return workers[0];
    }
  }

  const finalWorkers = context.serviceWorkers();
  if (finalWorkers.length > 0) {
    return finalWorkers[0];
  }

  const elapsed = Date.now() - startTime;

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
  const projectRoot = path.join(__dirname, '../..');
  const tmpDir = path.join(projectRoot, '.playwright-tmp');
  const uniqueId = randomUUID();
  const userDataDir = path.join(tmpDir, uniqueId);

  fs.mkdirSync(userDataDir, { recursive: true });

  return userDataDir;
};

/**
 * ユーザーデータディレクトリを削除するヘルパー関数
 */
const removeUserDataDir = (userDataDir: string): void => {
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // 削除失敗は警告のみ（テスト自体は成功）
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
  const validation = validateExtensionBuild(extensionPath);
  if (!validation.valid) {
    throw new Error(`Extension build validation failed:\n${validation.errors.join('\n')}`);
  }

  const userDataDir = createUniqueUserDataDir();

  // Chrome拡張機能はheadlessモードで正式サポートされていないため、
  // --headless=newを使用する（Playwrightのheadlessオプションではなく）
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

  const timeout = 30000;
  await waitForServiceWorker(context, timeout);

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

    const headless = process.env.HEADED !== 'true';

    const { context, userDataDir } = await createExtensionContext(pathToExtension, headless);

    await use(context);

    await context.close();

    removeUserDataDir(userDataDir);
  },

  /**
   * extensionId フィクスチャ
   * Service Worker URLからExtension IDを抽出します
   * 注: extensionContextフィクスチャでService Workerの起動を待機済みなので、
   * ここでは即座に取得できます
   */
  extensionId: async ({ extensionContext }, use) => {
    const workers = extensionContext.serviceWorkers();

    if (workers.length === 0) {
      throw new Error(
        'Service Worker not found. This should not happen as extensionContext waits for it.'
      );
    }

    const serviceWorker = workers[0];

    const extensionId = serviceWorker.url().split('/')[2];

    if (!extensionId || extensionId.length !== 32) {
      throw new Error(
        `Invalid extension ID extracted: ${extensionId}. Service Worker URL: ${serviceWorker.url()}`
      );
    }

    await use(extensionId);
  },

  /**
   * serviceWorker フィクスチャ
   * Service Workerへの参照を提供します
   * 注: extensionContextフィクスチャでService Workerの起動を待機済みなので、
   * ここでは即座に取得できます
   */
  serviceWorker: async ({ extensionContext }, use) => {
    const workers = extensionContext.serviceWorkers();

    if (workers.length === 0) {
      throw new Error(
        'Service Worker not found. This should not happen as extensionContext waits for it.'
      );
    }

    await use(workers[0]);
  },

  /**
   * sidePanelPage フィクスチャ
   * Side Panelページを開いて提供します
   *
   * windowIdパラメータを含めてサイドパネルを開く
   * これにより、サイドパネルは現在のウィンドウのタブのみを表示する
   */
  sidePanelPage: async ({ extensionContext, extensionId, serviceWorker }, use) => {
    const currentWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const windowId = currentWindow.id;

    const page = await extensionContext.newPage();

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);

    await page.waitForLoadState('domcontentloaded');

    try {
      await page.waitForSelector('#root', { timeout: 5000 });
    } catch (error) {
      await page.screenshot({
        path: 'test-results/sidepanel-load-error.png',
      });
      throw new Error(
        `Failed to load Side Panel. Root element not found. Screenshot saved to test-results/sidepanel-load-error.png. Error: ${error}`
      );
    }

    await serviceWorker.evaluate(async () => {
      // tree_stateが初期化されるまで待機
      for (let i = 0; i < 50; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes?: Record<string, unknown> } | undefined;
        if (treeState?.nodes && Object.keys(treeState.nodes).length > 0) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // SYNC_TABSでsyncWithChromeTabsの完了を待機し、handleTabCreatedとのrace conditionを防ぐ
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SYNC_TABS' }, () => {
          resolve();
        });
      });
    });

    // テスト用のユーザー設定を初期化
    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        user_settings: {
          fontSize: 14,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          customCSS: '',
          newTabPosition: 'end',
          newTabPositionManual: 'end',
          newTabPositionFromLink: 'end',
          duplicateTabPosition: 'sibling',
          closeWarningThreshold: 10,
          showUnreadIndicator: true,
          autoSnapshotInterval: 0,
          childTabBehavior: 'promote',
        },
      });
    });

    await page.waitForSelector('[data-testid="side-panel-root"]', { timeout: 5000 });

    await use(page);

    await page.close();
  },
});

/**
 * expectのエクスポート
 * テストファイルでの使用を簡素化します
 */
export { expect } from '@playwright/test';
