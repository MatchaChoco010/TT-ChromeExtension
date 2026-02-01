/**
 * ServiceWorkerUtils
 *
 * Service Workerとの通信、イベント監視、ライフサイクル検証の共通ヘルパー関数
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';

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
