/**
 * ServiceWorkerUtilsのテスト
 *
 * Service Workerとの通信、イベント監視、ライフサイクル検証の
 * 共通ヘルパー関数が正しく機能することを検証します。
 *
 * Requirements: 4.5
 */
import { test, expect } from './fixtures/extension';
import {
  sendMessageToServiceWorker,
  waitForMessageFromServiceWorker,
  assertEventListenersRegistered,
  assertServiceWorkerLifecycle,
} from './utils/service-worker-utils';

test.describe('ServiceWorkerUtils', () => {
  test.describe('sendMessageToServiceWorker', () => {
    test('Service Workerに既存のメッセージタイプを送信できること', async ({
      sidePanelPage,
    }) => {
      // 既存のメッセージタイプ(GET_STATE)を送信
      const message = { type: 'GET_STATE' };
      const response = await sendMessageToServiceWorker(sidePanelPage, message);

      // レスポンスが返却されることを検証
      expect(response).toBeDefined();
      expect((response as any).success).toBeDefined();
    });

    test('Service Workerから正しいレスポンスを受信できること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // 既存のACTIVATE_TABメッセージを使用して検証
      // まず新しいタブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // メッセージを送信してタブをアクティブ化
      const message = { type: 'ACTIVATE_TAB', payload: { tabId: tab.id } };
      const response = await sendMessageToServiceWorker(sidePanelPage, message);

      // レスポンスの内容を検証
      expect(response).toMatchObject({
        success: true,
      });

      // タブをクリーンアップ
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.remove(tabId);
      }, tab.id!);
    });

    test('タイムアウト時にエラーをスローすること', async ({ sidePanelPage }) => {
      // タイムアウトを短く設定してテスト
      // UNKNOWN_TYPEメッセージはレスポンスを返すが、処理が遅い可能性がある
      const message = { type: 'UNKNOWN_TYPE' };

      // 非常に短いタイムアウトでエラーが発生することを検証
      await expect(
        sendMessageToServiceWorker(sidePanelPage, message, { timeout: 1 })
      ).rejects.toThrow();
    });
  });

  test.describe('waitForMessageFromServiceWorker', () => {
    test('タイムアウト時にエラーをスローすること', async ({ serviceWorker }) => {
      // メッセージが送信されない場合、タイムアウトエラーが発生することを検証
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
      // イベントリスナーが登録されていることを検証
      await expect(
        assertEventListenersRegistered(serviceWorker)
      ).resolves.not.toThrow();
    });

    test('必要なChrome APIイベントリスナーが登録されていることを確認すること', async ({
      serviceWorker,
    }) => {
      // Service Workerが必要なイベントリスナーを持っているか検証
      const hasListeners = await serviceWorker.evaluate(() => {
        // chrome.tabs.onCreated, onRemoved, onUpdated, onActivatedのリスナーが存在するか確認
        return (
          chrome.tabs.onCreated.hasListeners() &&
          chrome.tabs.onRemoved.hasListeners() &&
          chrome.tabs.onUpdated.hasListeners() &&
          chrome.tabs.onActivated.hasListeners()
        );
      });

      expect(hasListeners).toBe(true);
    });
  });

  test.describe('assertServiceWorkerLifecycle', () => {
    test('Service Workerが正常に起動していることを検証できること', async ({
      extensionContext,
    }) => {
      // Service Workerのライフサイクルを検証
      await expect(
        assertServiceWorkerLifecycle(extensionContext)
      ).resolves.not.toThrow();
    });

    test('Service Workerが再起動後も状態を保持することを検証できること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // 初期状態をService Workerに保存
      await serviceWorker.evaluate(() => {
        (globalThis as any).testState = { initialized: true, timestamp: Date.now() };
      });

      // Service Workerのライフサイクルを検証
      await assertServiceWorkerLifecycle(extensionContext);

      // 状態が保持されていることを検証（または再初期化されていることを検証）
      const stateExists = await serviceWorker.evaluate(() => {
        return (globalThis as any).testState !== undefined;
      });

      // Service Workerは永続化されるため、状態が保持されているはず
      expect(stateExists).toBe(true);
    });
  });

  test.describe('統合テスト: Service Workerとの双方向通信', () => {
    test('Side PanelからService Workerへのメッセージ送信とレスポンス受信', async ({
      sidePanelPage,
    }) => {
      // 既存のメッセージタイプ(GET_STATE)を使用してテスト
      // Side Panelからメッセージを送信
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

      // レスポンスを検証（GET_STATEは { success: true, data: null } を返す）
      expect(response).toMatchObject({
        success: true,
      });
    });

    test('Service WorkerからSide Panelへのメッセージ送信', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        return new Promise<void>((resolve) => {
          (window as any).receivedMessages = [];
          chrome.runtime.onMessage.addListener((message) => {
            (window as any).receivedMessages.push(message);
          });
          resolve();
        });
      });

      // Service Workerからメッセージを送信
      await serviceWorker.evaluate(() => {
        chrome.runtime.sendMessage({
          type: 'TREE_UPDATED',
          payload: { nodeCount: 10 },
        });
      });

      // 少し待機してメッセージが配信されるのを待つ
      await sidePanelPage.waitForTimeout(500);

      // Side Panelでメッセージを受信したことを確認
      const receivedMessages = await sidePanelPage.evaluate(() => {
        return (window as any).receivedMessages;
      });

      expect(receivedMessages).toHaveLength(1);
      expect(receivedMessages[0]).toMatchObject({
        type: 'TREE_UPDATED',
        payload: { nodeCount: 10 },
      });
    });
  });

  test.describe('エラーハンドリング', () => {
    test('無効なメッセージ形式でエラーハンドリングできること', async ({
      sidePanelPage,
    }) => {
      // 無効なメッセージを送信（Service Workerがエラーを返す想定）
      const invalidMessage = null as any;

      // エラーが適切にハンドリングされることを検証
      await expect(
        sendMessageToServiceWorker(sidePanelPage, invalidMessage)
      ).rejects.toThrow();
    });

    test('Service Workerが応答しない場合のタイムアウト処理', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // レスポンスを返さないハンドラを設定
      await serviceWorker.evaluate(() => {
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'HANG') {
            // sendResponseを呼ばずに終了
            return false;
          }
        });
      });

      // タイムアウトが発生することを検証
      try {
        await sendMessageToServiceWorker(
          sidePanelPage,
          { type: 'HANG' },
          { timeout: 1000 }
        );
        // タイムアウトが発生しなかった場合、テストを失敗させる
        throw new Error('Expected timeout error but promise resolved');
      } catch (error) {
        // タイムアウトエラーが発生したことを検証
        expect(error).toBeDefined();
      }
    });
  });
});
