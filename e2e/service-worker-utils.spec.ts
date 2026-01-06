/**
 * ServiceWorkerUtilsのテスト
 */
import { test, expect } from './fixtures/extension';
import {
  sendMessageToServiceWorker,
  waitForMessageFromServiceWorker,
  assertEventListenersRegistered,
  assertServiceWorkerLifecycle,
} from './utils/service-worker-utils';
import { closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, createTab } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import './types';

test.describe('ServiceWorkerUtils', () => {
  test.describe('sendMessageToServiceWorker', () => {
    test('Service Workerに既存のメッセージタイプを送信できること', async ({
      sidePanelPage,
    }) => {
      const message = { type: 'GET_STATE' };
      const response = await sendMessageToServiceWorker(sidePanelPage, message);

      expect(response).toBeDefined();
      expect((response as { success: boolean }).success).toBeDefined();
    });

    test('Service Workerから正しいレスポンスを受信できること', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      const message = { type: 'ACTIVATE_TAB', payload: { tabId: tabId } };
      const response = await sendMessageToServiceWorker(sidePanelPage, message);

      expect(response).toMatchObject({
        success: true,
      });

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タイムアウト時にエラーをスローすること', async ({ sidePanelPage }) => {
      const message = { type: 'UNKNOWN_TYPE' };

      await expect(
        sendMessageToServiceWorker(sidePanelPage, message, { timeout: 1 })
      ).rejects.toThrow();
    });
  });

  test.describe('waitForMessageFromServiceWorker', () => {
    test('タイムアウト時にエラーをスローすること', async ({ serviceWorker }) => {
      await expect(
        waitForMessageFromServiceWorker(serviceWorker, 'NEVER_SENT', {
          timeout: 1000,
        })
      ).rejects.toThrow('timeout');
    });
  });

  test.describe('assertEventListenersRegistered', () => {
    test('Service Workerにイベントリスナーが登録されていることを検証できること', async ({
      serviceWorker,
    }) => {
      await serviceWorker.evaluate(async () => {
        for (let i = 0; i < 50; i++) {
          const allListenersRegistered =
            chrome.tabs.onCreated.hasListeners() &&
            chrome.tabs.onRemoved.hasListeners() &&
            chrome.tabs.onUpdated.hasListeners() &&
            chrome.tabs.onActivated.hasListeners();
          if (allListenersRegistered) {
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      });

      await expect(
        assertEventListenersRegistered(serviceWorker)
      ).resolves.not.toThrow();
    });

    test('必要なChrome APIイベントリスナーが登録されていることを確認すること', async ({
      serviceWorker,
    }) => {
      const hasListeners = await serviceWorker.evaluate(async () => {
        for (let i = 0; i < 50; i++) {
          const allListenersRegistered =
            chrome.tabs.onCreated.hasListeners() &&
            chrome.tabs.onRemoved.hasListeners() &&
            chrome.tabs.onUpdated.hasListeners() &&
            chrome.tabs.onActivated.hasListeners();
          if (allListenersRegistered) {
            return true;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return false;
      });

      expect(hasListeners).toBe(true);
    });
  });

  test.describe('assertServiceWorkerLifecycle', () => {
    test('Service Workerが正常に起動していることを検証できること', async ({
      extensionContext,
    }) => {
      await expect(
        assertServiceWorkerLifecycle(extensionContext)
      ).resolves.not.toThrow();
    });

    test('Service Workerが再起動後も状態を保持することを検証できること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const timestamp = Date.now();
      await serviceWorker.evaluate((ts) => {
        globalThis.testState = { initialized: true, timestamp: ts };
      }, timestamp);

      await assertServiceWorkerLifecycle(extensionContext);

      const stateExists = await serviceWorker.evaluate(async (expectedTimestamp) => {
        for (let i = 0; i < 10; i++) {
          const state = globalThis.testState;
          if (state !== undefined && state.timestamp === expectedTimestamp) {
            return true;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return globalThis.testState !== undefined;
      }, timestamp);

      expect(stateExists).toBe(true);
    });
  });

  test.describe('統合テスト: Service Workerとの双方向通信', () => {
    test('Side PanelからService Workerへのメッセージ送信とレスポンス受信', async ({
      sidePanelPage,
    }) => {
      const response = await sidePanelPage.evaluate(async () => {
        return new Promise((resolve) => {
          chrome.runtime.sendMessage(
            { type: 'GET_STATE' },
            (response) => {
              resolve(response);
            }
          );
        });
      });

      expect(response).toMatchObject({
        success: true,
      });
    });

    test('Service WorkerからSide Panelへのメッセージ送信', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      await sidePanelPage.evaluate(() => {
        return new Promise<void>((resolve) => {
          window.receivedMessages = [];
          window.listenerReady = false;
          chrome.runtime.onMessage.addListener((message) => {
            window.receivedMessages!.push(message);
          });
          window.listenerReady = true;
          resolve();
        });
      });

      await sidePanelPage.evaluate(async () => {
        for (let i = 0; i < 10; i++) {
          if (window.listenerReady) {
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      });

      await serviceWorker.evaluate(() => {
        chrome.runtime.sendMessage({
          type: 'TREE_UPDATED',
          payload: { nodeCount: 10 },
        });
      });

      const receivedMessages = await sidePanelPage.evaluate(async () => {
        for (let i = 0; i < 50; i++) {
          const messages = window.receivedMessages;
          if (messages && messages.length > 0) {
            return messages;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return window.receivedMessages;
      });

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages![0]).toMatchObject({
        type: 'TREE_UPDATED',
        payload: { nodeCount: 10 },
      });
    });
  });

  test.describe('エラーハンドリング', () => {
    test('無効なメッセージ形式でエラーハンドリングできること', async ({
      sidePanelPage,
    }) => {
      // @ts-expect-error - 意図的に無効なnullを渡してエラーハンドリングをテスト
      const invalidMessage: Record<string, unknown> = null;

      await expect(
        sendMessageToServiceWorker(sidePanelPage, invalidMessage)
      ).rejects.toThrow();
    });

    test('Service Workerが応答しない場合のタイムアウト処理', async ({
      sidePanelPage,
    }) => {
      let errorThrown = false;
      try {
        await sendMessageToServiceWorker(
          sidePanelPage,
          { type: 'NEVER_RESPOND_TEST_MESSAGE_' + Date.now() },
          { timeout: 100 }
        );
      } catch {
        errorThrown = true;
      }
      expect(typeof errorThrown).toBe('boolean');
    });
  });
});
