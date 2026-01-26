/**
 * ブラウザ再起動をテストするためのユーティリティ
 *
 * Playwrightでは、launchPersistentContextを使用している場合、
 * 同じuserDataDirでコンテキストを再作成することで、
 * chrome.storage.localのデータを保持したままブラウザを再起動できる。
 */
import { chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getExtensionPath = () => {
  return path.join(__dirname, '../../dist');
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

  while (Date.now() - startTime < timeout) {
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

  throw new Error(`Service Worker did not start within ${timeout}ms`);
};

export interface BrowserRestartResult {
  context: BrowserContext;
  serviceWorker: Worker;
  sidePanelPage: Page;
  extensionId: string;
}

/**
 * ブラウザを再起動する
 *
 * 現在のコンテキストを閉じ、同じuserDataDirで新しいコンテキストを作成する。
 * これにより、chrome.storage.localのデータは保持されたまま、
 * Service Workerが再起動され、restoreStateAfterRestartが自動的に呼ばれる。
 *
 * @param currentContext - 現在のブラウザコンテキスト
 * @param userDataDir - ユーザーデータディレクトリ（ストレージを保持するため必須）
 * @param headless - ヘッドレスモードで起動するかどうか
 * @returns 新しいコンテキスト、Service Worker、サイドパネルページ
 */
export async function restartBrowser(
  currentContext: BrowserContext,
  userDataDir: string,
  headless: boolean = true
): Promise<BrowserRestartResult> {
  const extensionPath = getExtensionPath();

  await currentContext.close();

  // 少し待機（ストレージの書き込みが完了するのを待つ）
  await new Promise(resolve => setTimeout(resolve, 500));

  const newContext = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    channel: 'chromium',
    args: [
      ...(headless ? ['--headless=new'] : []),
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--restore-last-session',
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

  const serviceWorker = await waitForServiceWorker(newContext, 30000);

  const extensionId = serviceWorker.url().split('/')[2];

  // Service Workerが完全に初期化されるのを待つ
  await new Promise(resolve => setTimeout(resolve, 1000));

  const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
  const sidePanelPage = await newContext.newPage();
  await sidePanelPage.goto(sidePanelUrl);
  await sidePanelPage.waitForLoadState('domcontentloaded');

  return {
    context: newContext,
    serviceWorker,
    sidePanelPage,
    extensionId,
  };
}

/**
 * ブラウザ再起動テスト用のuserDataDirを作成する
 *
 * @returns ユニークなuserDataDirのパス
 */
export function createTestUserDataDir(): string {
  const projectRoot = path.join(__dirname, '../..');
  const tmpDir = path.join(projectRoot, '.playwright-tmp');
  const uniqueId = `restart-test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const userDataDir = path.join(tmpDir, uniqueId);

  fs.mkdirSync(userDataDir, { recursive: true });

  return userDataDir;
}

/**
 * テスト用のuserDataDirを削除する
 *
 * @param userDataDir - 削除するディレクトリ
 */
export function removeTestUserDataDir(userDataDir: string): void {
  try {
    fs.rmSync(userDataDir, { recursive: true, force: true });
  } catch {
    // 削除失敗は警告のみ
  }
}

/**
 * ブラウザ再起動テスト用の初期コンテキストを作成する
 *
 * @param userDataDir - ユーザーデータディレクトリ
 * @param headless - ヘッドレスモードで起動するかどうか
 * @returns コンテキスト、Service Worker、サイドパネルページ
 */
export async function createInitialContext(
  userDataDir: string,
  headless: boolean = true
): Promise<BrowserRestartResult> {
  const extensionPath = getExtensionPath();

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

  const serviceWorker = await waitForServiceWorker(context, 30000);
  const extensionId = serviceWorker.url().split('/')[2];

  // Service Workerが完全に初期化されるのを待つ
  await new Promise(resolve => setTimeout(resolve, 1000));

  const sidePanelUrl = `chrome-extension://${extensionId}/sidepanel.html`;
  const sidePanelPage = await context.newPage();
  await sidePanelPage.goto(sidePanelUrl);
  await sidePanelPage.waitForLoadState('domcontentloaded');

  return {
    context,
    serviceWorker,
    sidePanelPage,
    extensionId,
  };
}
