/**
 * Chrome拡張機能をPlaywrightでロードするためのカスタムフィクスチャ
 */
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import type { Page, Worker } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { resetExtensionState } from '../utils/reset-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ExtensionFixtures {
  extensionContext: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  sidePanelPage: Page;
}

const getExtensionPath = () => {
  return path.join(__dirname, '../../dist');
};

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

const createUniqueUserDataDir = (): string => {
  const projectRoot = path.join(__dirname, '../..');
  const tmpDir = path.join(projectRoot, '.playwright-tmp');
  const uniqueId = randomUUID();
  const userDataDir = path.join(tmpDir, uniqueId);

  fs.mkdirSync(userDataDir, { recursive: true });

  return userDataDir;
};

const removeUserDataDir = (userDataDir: string): void => {
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // 削除失敗は警告のみ（テスト自体は成功）
  }
};

const createExtensionContext = async (
  extensionPath: string,
  headless: boolean
): Promise<{ context: BrowserContext; userDataDir: string }> => {
  const validation = validateExtensionBuild(extensionPath);
  if (!validation.valid) {
    throw new Error(`Extension build validation failed:\n${validation.errors.join('\n')}`);
  }

  const userDataDir = createUniqueUserDataDir();

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chromium',
    args: [
      ...(headless ? ['--headless=new'] : []),
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--disable-gpu',
      '--no-sandbox',
      '--disable-background-networking',
      '--disable-default-apps',
      '--disable-sync',
      '--disable-translate',
      '--metrics-recording-only',
      '--mute-audio',
      '--no-first-run',
      '--disable-features=TranslateUI',
      '--disable-component-extensions-with-background-pages',
    ],
  });

  const timeout = 30000;
  await waitForServiceWorker(context, timeout);

  return { context, userDataDir };
};

// 自動リセットフィクスチャ（テストスコープ）
interface TestFixtures {
  autoReset: void;
}

// ワーカーごとの前回テストを追跡
const workerLastTest = new Map<number, string>();

/**
 * Service Workerが応答可能か確認する
 * シンプルな計算を実行して応答性をテストする
 * Chrome APIは使用しない（ハングする可能性があるため）
 */
const isWorkerAlive = async (worker: Worker, timeout: number = 2000): Promise<boolean> => {
  try {
    const result = await Promise.race([
      worker.evaluate(() => {
        return 1 + 1 === 2;
      }),
      new Promise<false>((resolve) => setTimeout(() => resolve(false), timeout)),
    ]);
    return result === true;
  } catch {
    return false;
  }
};

export const test = base.extend<TestFixtures, ExtensionFixtures>({
  // 自動リセットフィクスチャ: 各テスト前に状態をリセット
  autoReset: [async ({ extensionContext, sidePanelPage, serviceWorker }, use, testInfo) => {
    const workerId = testInfo.parallelIndex;
    const testTitle = `${testInfo.file}:${testInfo.line} - ${testInfo.title}`;
    const prevTest = workerLastTest.get(workerId);

    try {
      // テスト開始時にワーカー番号を出力
      console.error(`\n[WORKER #${workerId}] TEST START: ${testInfo.title} (${testInfo.file}:${testInfo.line})`);

      // テスト実行前にワーカースコープのフィクスチャが有効か検証
      if (sidePanelPage.isClosed()) {
        throw new Error(
          'Fixture validation failed: sidePanelPage is closed. ' +
          'The browser context may have become corrupted.'
        );
      }

      const workerAlive = await isWorkerAlive(serviceWorker, 3000);
      console.error(`[WORKER #${workerId}] isWorkerAlive: ${workerAlive}`);

      // Service Workerの参照が有効かも確認
      const currentWorkers = extensionContext.serviceWorkers();
      console.error(`[WORKER #${workerId}] Current serviceWorkers count: ${currentWorkers.length}`);
      if (currentWorkers.length > 0) {
        console.error(`[WORKER #${workerId}] Current SW URL: ${currentWorkers[0].url()}`);
        const isSameWorker = currentWorkers[0] === serviceWorker;
        console.error(`[WORKER #${workerId}] Is same worker reference: ${isSameWorker}`);
      }

      if (!workerAlive) {
        throw new Error(
          'Fixture validation failed: Worker-scoped serviceWorker fixture is stale or unresponsive. ' +
          'The Service Worker may have been restarted by Chrome.'
        );
      }

      await resetExtensionState(serviceWorker, extensionContext, sidePanelPage);
      workerLastTest.set(workerId, testTitle);
      const testStartTime = Date.now();
      await use();
      const testEndTime = Date.now();
      console.error(`[WORKER #${workerId}] TEST END at ${new Date().toISOString()} (duration: ${testEndTime - testStartTime}ms)`);
    } catch (error) {
      const lastError = error instanceof Error ? error : new Error(String(error));
      console.error('\n=== RESET FAILED ===');
      console.error(`Worker #${workerId}`);
      console.error(`Current test: ${testTitle}`);
      console.error(`Previous test on this worker: ${prevTest || 'None (first test)'}`);
      console.error(`Error: ${lastError.message}`);
      console.error('====================\n');
      throw lastError;
    }
  }, { auto: true }],

  extensionContext: [async ({}, use) => {
    const pathToExtension = getExtensionPath();
    const headless = process.env.HEADED !== 'true';
    const { context, userDataDir } = await createExtensionContext(pathToExtension, headless);

    await use(context);

    await context.close();
    removeUserDataDir(userDataDir);
  }, { scope: 'worker' }],

  extensionId: [async ({ extensionContext }, use) => {
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
  }, { scope: 'worker' }],

  serviceWorker: [async ({ extensionContext }, use, workerInfo) => {
    const workers = extensionContext.serviceWorkers();

    if (workers.length === 0) {
      throw new Error(
        'Service Worker not found. This should not happen as extensionContext waits for it.'
      );
    }

    const worker = workers[0];
    const workerIndex = workerInfo.parallelIndex;

    worker.on('close', () => {
      console.error(`\n[WORKER #${workerIndex}] Service Worker CLOSED at ${new Date().toISOString()}`);
    });

    extensionContext.on('serviceworker', (newWorker) => {
      console.error(`\n[WORKER #${workerIndex}] NEW Service Worker created at ${new Date().toISOString()}`);
      console.error(`[WORKER #${workerIndex}] URL: ${newWorker.url()}`);
      console.error(`[WORKER #${workerIndex}] This may indicate the Service Worker was restarted.`);
    });

    await use(worker);
  }, { scope: 'worker' }],

  sidePanelPage: [async ({ extensionContext, extensionId, serviceWorker }, use) => {
    const currentWindow = await serviceWorker.evaluate(() => chrome.windows.getCurrent());
    const page = await extensionContext.newPage();

    await page.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${currentWindow.id}`);
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
      for (let i = 0; i < 50; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes?: Record<string, unknown> } | undefined;
        if (treeState?.nodes && Object.keys(treeState.nodes).length > 0) {
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    await serviceWorker.evaluate(async () => {
      await new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SYNC_TABS' }, () => {
          resolve();
        });
      });
    });

    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        user_settings: {
          fontSize: 14,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          customCSS: '',
          newTabPosition: 'end',
          newTabPositionManual: 'end',
          newTabPositionFromLink: 'child',
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
  }, { scope: 'worker' }],
});

// Note: beforeEach is replaced by autoReset auto-fixture above

export { expect } from '@playwright/test';
