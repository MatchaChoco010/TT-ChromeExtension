/**
 * ServiceWorkerUtils
 *
 * Service Workerとの通信、イベント監視、ライフサイクル検証の共通ヘルパー関数
 */
import type { BrowserContext, CDPSession, Page, Worker } from '@playwright/test';

export interface MessageOptions {
  /**
   * タイムアウト時間（ミリ秒）
   * デフォルト: 5000ms
   */
  timeout?: number;
}

/**
 * Service Workerにメッセージを送信（Page contextから）
 *
 * Note: Chrome拡張機能では、Service Workerから自分自身にメッセージを送ることはできません。
 * そのため、このヘルパー関数はPageオブジェクト（例: Side Panel）を受け取り、
 * そのページから chrome.runtime.sendMessage() を使用してService Workerにメッセージを送信します。
 *
 * @param page - メッセージ送信元のページ（Side Panelなど、chrome.runtimeへのアクセス権を持つページ）
 * @param message - 送信するメッセージ
 * @param options - オプション
 * @returns レスポンス
 */
export async function sendMessageToServiceWorker(
  page: Page,
  message: Record<string, unknown>,
  options: MessageOptions = {}
): Promise<unknown> {
  const { timeout = 5000 } = options;

  if (!message) {
    throw new Error('Invalid message: message cannot be null or undefined');
  }

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Message timeout')), timeout);
  });

  const messagePromise = page.evaluate(
    (msg) => {
      return new Promise((resolve, reject) => {
        try {
          chrome.runtime.sendMessage(msg, (response) => {
            if (chrome.runtime.lastError) {
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              resolve(response);
            }
          });
        } catch (error) {
          reject(error);
        }
      });
    },
    message
  );

  return Promise.race([messagePromise, timeoutPromise]);
}

/**
 * Service Workerからのメッセージを待機
 *
 * @param worker - Service Worker
 * @param expectedType - 期待されるメッセージタイプ
 * @param options - オプション
 * @returns 受信したメッセージ
 */
export async function waitForMessageFromServiceWorker(
  worker: Worker,
  expectedType: string,
  options: MessageOptions = {}
): Promise<Record<string, unknown>> {
  const { timeout = 5000 } = options;

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Wait for message timeout')), timeout);
  });

  const messagePromise = worker.evaluate(
    (type) => {
      return new Promise<Record<string, unknown>>((resolve) => {
        const listener = (message: Record<string, unknown>) => {
          if (message.type === type) {
            chrome.runtime.onMessage.removeListener(listener);
            resolve(message);
          }
        };
        chrome.runtime.onMessage.addListener(listener);
      });
    },
    expectedType
  );

  return Promise.race([messagePromise, timeoutPromise]);
}

export async function assertEventListenersRegistered(
  worker: Worker
): Promise<void> {
  const hasListeners = await worker.evaluate(() => {
    return {
      onCreated: chrome.tabs.onCreated.hasListeners(),
      onRemoved: chrome.tabs.onRemoved.hasListeners(),
      onUpdated: chrome.tabs.onUpdated.hasListeners(),
      onActivated: chrome.tabs.onActivated.hasListeners(),
    };
  });

  const allRegistered = Object.values(hasListeners).every((registered) => registered);

  if (!allRegistered) {
    throw new Error(
      `Event listeners not fully registered: ${JSON.stringify(hasListeners)}`
    );
  }
}

export async function assertServiceWorkerLifecycle(
  context: BrowserContext
): Promise<void> {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker', { timeout: 10000 });
  }

  const workerUrl = serviceWorker.url();
  if (!workerUrl.includes('chrome-extension://') || !workerUrl.includes('service-worker')) {
    throw new Error(`Invalid Service Worker URL: ${workerUrl}`);
  }

  const isActive = await serviceWorker.evaluate(() => {
    return typeof chrome !== 'undefined' && chrome.runtime !== undefined;
  });

  if (!isActive) {
    throw new Error('Service Worker is not active or chrome runtime is not available');
  }
}

interface ServiceWorkerVersionsPayload {
  versions: { versionId: string; scriptURL: string; runningStatus: string }[];
}

type ServiceWorkerRunningStatus = 'stopped' | 'starting' | 'running' | 'stopping';

/**
 * CDPのServiceWorkerドメインで、指定スクリプトのService Workerの実行状態を監視する
 */
class ServiceWorkerStatusWatcher {
  private latest: { versionId: string; runningStatus: ServiceWorkerRunningStatus } | null = null;
  private waiters: (() => void)[] = [];

  private constructor(
    private readonly cdpSession: CDPSession,
    scriptURL: string
  ) {
    cdpSession.on('ServiceWorker.workerVersionUpdated', (event: ServiceWorkerVersionsPayload) => {
      const version = event.versions.find((v) => v.scriptURL === scriptURL);
      if (!version) return;
      this.latest = {
        versionId: version.versionId,
        runningStatus: version.runningStatus as ServiceWorkerRunningStatus,
      };
      const waiters = this.waiters;
      this.waiters = [];
      waiters.forEach((notify) => notify());
    });
  }

  static async start(
    context: BrowserContext,
    extensionPage: Page,
    scriptURL: string
  ): Promise<ServiceWorkerStatusWatcher> {
    const cdpSession = await context.newCDPSession(extensionPage);
    const watcher = new ServiceWorkerStatusWatcher(cdpSession, scriptURL);
    await cdpSession.send('ServiceWorker.enable');
    return watcher;
  }

  async waitForStatus(
    runningStatus: ServiceWorkerRunningStatus
  ): Promise<{ versionId: string; runningStatus: ServiceWorkerRunningStatus }> {
    while (this.latest?.runningStatus !== runningStatus) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    return this.latest;
  }

  async waitForAnyStatus(): Promise<{ versionId: string; runningStatus: ServiceWorkerRunningStatus }> {
    while (this.latest === null) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    return this.latest;
  }

  async stopWorker(versionId: string): Promise<void> {
    await this.cdpSession.send('ServiceWorker.stopWorker', { versionId });
  }

  async dispose(): Promise<void> {
    await this.cdpSession.detach();
  }
}

/**
 * 拡張機能のService Workerを停止し、停止の完了を待つ
 * 停止したService Workerは、次に拡張機能へ届くイベント（タブ操作やメッセージ）で再起動する。
 * 停止前に取得したWorkerオブジェクトは停止後に使えなくなり、Playwrightは再起動後のService Workerを公開しない。
 * 再起動後の操作は拡張機能のページ経由で行うこと。
 *
 * @param context - 対象のブラウザコンテキスト
 * @param extensionPage - 拡張機能のページ（Side Panelなど）。CDPセッションの接続先として使う
 * @param serviceWorker - 停止するService Worker
 */
export async function stopServiceWorker(
  context: BrowserContext,
  extensionPage: Page,
  serviceWorker: Worker
): Promise<void> {
  const watcher = await ServiceWorkerStatusWatcher.start(context, extensionPage, serviceWorker.url());
  try {
    const { versionId } = await watcher.waitForStatus('running');
    await watcher.stopWorker(versionId);
    await watcher.waitForStatus('stopped');
  } finally {
    await watcher.dispose();
  }
}

/**
 * 停止中のService Workerを起こす操作を実行し、Service Workerが起動するまで待つ
 *
 * @param context - 対象のブラウザコンテキスト
 * @param extensionPage - 拡張機能のページ（Side Panelなど）。CDPセッションの接続先として使う
 * @param serviceWorkerUrl - Service WorkerのスクリプトURL
 * @param wakeUpAction - Service Workerを起こす操作（タブを閉じる、タブを開くなど）
 * @throws wakeUpActionの実行前にService Workerが既に起動していた場合
 */
export async function restartServiceWorkerBy(
  context: BrowserContext,
  extensionPage: Page,
  serviceWorkerUrl: string,
  wakeUpAction: () => Promise<void>
): Promise<void> {
  const watcher = await ServiceWorkerStatusWatcher.start(context, extensionPage, serviceWorkerUrl);
  try {
    const { runningStatus } = await watcher.waitForAnyStatus();
    if (runningStatus !== 'stopped') {
      throw new Error(`Service Worker is already ${runningStatus} before the wake-up action`);
    }
    await wakeUpAction();
    await watcher.waitForStatus('running');
  } finally {
    await watcher.dispose();
  }
}
