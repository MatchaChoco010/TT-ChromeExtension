/**
 * Chrome拡張機能をPlaywrightでロードするためのカスタムフィクスチャ
 */
import { test as base, chromium, type BrowserContext } from '@playwright/test';
import type { Worker } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { resetExtensionState } from '../utils/reset-utils';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * テストに公開するフィクスチャ
 */
export interface ExtensionFixtures {
  extensionContext: BrowserContext;
  extensionId: string;
  serviceWorker: Worker;
  downloadDir: string;
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

const createDownloadDir = (userDataDir: string): string => {
  const downloadDir = path.join(userDataDir, 'downloads');
  fs.mkdirSync(downloadDir, { recursive: true });
  return downloadDir;
};

const createExtensionContext = async (
  extensionPath: string,
  headless: boolean
): Promise<{ context: BrowserContext; userDataDir: string; downloadDir: string }> => {
  const validation = validateExtensionBuild(extensionPath);
  if (!validation.valid) {
    throw new Error(`Extension build validation failed:\n${validation.errors.join('\n')}`);
  }

  const userDataDir = createUniqueUserDataDir();
  const downloadDir = createDownloadDir(userDataDir);

  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chromium',
    acceptDownloads: true,
    downloadsPath: downloadDir,
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
      '--disable-features=TranslateUI,TabDiscarding,IntensiveWakeUpThrottling',
      '--disable-component-extensions-with-background-pages',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-hang-monitor',
    ],
  });

  const timeout = 30000;
  await waitForServiceWorker(context, timeout);

  // デバッグ: コンテキストのクローズを追跡
  const contextCreateStack = new Error('[Context Create Stack]');
  context.on('close', () => {
    console.log(`[DEBUG] BrowserContext was closed at ${new Date().toISOString()}!`);
    console.log(`[DEBUG] Context create stack: ${contextCreateStack.stack}`);
  });

  // デバッグ: ページの作成/クローズを追跡
  context.on('page', (page) => {
    console.log(`[DEBUG] Page created: ${page.url()}`);
    page.on('close', () => {
      console.log(`[DEBUG] Page closed: ${page.url()}`);
    });
  });

  return { context, userDataDir, downloadDir };
};

// 自動リセットフィクスチャ（テストスコープ）
interface TestFixtures {
  autoReset: void;
}

// ワーカーごとの前回テストを追跡
const workerLastTest = new Map<number, string>();

// コンテキストごとのダウンロードディレクトリを追跡
const contextDownloadDirs = new Map<BrowserContext, string>();

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
  autoReset: [async ({ extensionContext, serviceWorker }, use, testInfo) => {
    const workerId = testInfo.parallelIndex;
    const testTitle = `${testInfo.file}:${testInfo.line} - ${testInfo.title}`;
    const prevTest = workerLastTest.get(workerId);

    try {
      const workerAlive = await isWorkerAlive(serviceWorker, 3000);

      if (!workerAlive) {
        throw new Error(
          'Fixture validation failed: Worker-scoped serviceWorker fixture is stale or unresponsive. ' +
          'The Service Worker may have been restarted by Chrome.'
        );
      }

      await resetExtensionState(serviceWorker, extensionContext);
      workerLastTest.set(workerId, testTitle);
      await use();
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
    const { context, userDataDir, downloadDir } = await createExtensionContext(pathToExtension, headless);

    // ダウンロードディレクトリをコンテキストに紐付け
    contextDownloadDirs.set(context, downloadDir);

    await use(context);

    contextDownloadDirs.delete(context);
    await context.close();
    removeUserDataDir(userDataDir);
  }, { scope: 'worker' }],

  downloadDir: [async ({ extensionContext }, use) => {
    const downloadDir = contextDownloadDirs.get(extensionContext);
    if (!downloadDir) {
      throw new Error('Download directory not found for extension context');
    }
    await use(downloadDir);
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

  serviceWorker: [async ({ extensionContext }, use) => {
    const workers = extensionContext.serviceWorkers();

    if (workers.length === 0) {
      throw new Error(
        'Service Worker not found. This should not happen as extensionContext waits for it.'
      );
    }

    const worker = workers[0];

    await use(worker);
  }, { scope: 'worker' }],
});

export { expect } from '@playwright/test';
