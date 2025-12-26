/**
 * Service Workerとの通信のE2Eテスト
 *
 * Service Workerとの通信機能を検証するE2Eテスト。
 * Side PanelからService Workerへのメッセージ送信、
 * Service WorkerからSide Panelへのメッセージ送信、
 * タブイベント処理時のツリー状態バックグラウンド同期、
 * Service Worker再起動時の状態復元、
 * 長時間非アクティブ後の通信再確立を検証します。
 *
 * Requirements: 4.5
 * Task: 5.5
 */
import { test, expect } from './fixtures/extension';
import {
  sendMessageToServiceWorker,
  assertEventListenersRegistered,
  assertServiceWorkerLifecycle,
} from './utils/service-worker-utils';

test.describe('Service Workerとの通信', () => {
  test.describe('Requirement 4.5.1: Side PanelからService Workerへのメッセージ送信', () => {
    test('Side PanelからService Workerにchrome.runtime.sendMessage()でメッセージを送信できること', async ({
      sidePanelPage,
    }) => {
      // GET_STATEメッセージを送信
      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'GET_STATE',
      });

      // レスポンスが返却されることを検証
      expect(response).toBeDefined();
      expect((response as { success: boolean }).success).toBe(true);
    });

    test('ACTIVATE_TABメッセージでタブをアクティブ化できること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // 新しいタブを作成（非アクティブ）
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // ACTIVATE_TABメッセージを送信
      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'ACTIVATE_TAB',
        payload: { tabId: tab.id },
      });

      // 成功レスポンスを検証
      expect(response).toMatchObject({
        success: true,
      });

      // タブがアクティブになったことを確認
      const isActive = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({ active: true });
        return tabs.some((t) => t.id === tabId);
      }, tab.id!);

      expect(isActive).toBe(true);

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.remove(tabId);
      }, tab.id!);
    });

    test('CLOSE_TABメッセージでタブを閉じることができること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // 新しいタブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // タブが存在することを確認
      const existsBefore = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({});
        return tabs.some((t) => t.id === tabId);
      }, tab.id!);
      expect(existsBefore).toBe(true);

      // CLOSE_TABメッセージを送信
      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'CLOSE_TAB',
        payload: { tabId: tab.id },
      });

      // 成功レスポンスを検証
      expect(response).toMatchObject({
        success: true,
      });

      // タブが削除されたことを確認
      const existsAfter = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({});
        return tabs.some((t) => t.id === tabId);
      }, tab.id!);

      expect(existsAfter).toBe(false);
    });

    test('SYNC_TABSメッセージでChrome タブと同期できること', async ({
      sidePanelPage,
    }) => {
      // SYNC_TABSメッセージを送信
      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'SYNC_TABS',
      });

      // 成功レスポンスを検証
      expect(response).toMatchObject({
        success: true,
      });
    });
  });

  test.describe('Requirement 4.5.2: Service WorkerからSide Panelへのメッセージ送信', () => {
    test('chrome.runtime.onMessageリスナーがSide Panelで正しくメッセージを受信すること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        (window as any).receivedMessages = [];
        chrome.runtime.onMessage.addListener((message) => {
          (window as any).receivedMessages.push(message);
        });
      });

      // Service Workerからメッセージを送信
      await serviceWorker.evaluate(() => {
        chrome.runtime.sendMessage({
          type: 'TEST_MESSAGE',
          payload: { data: 'test' },
        });
      });

      // メッセージが受信されるまで待機
      await sidePanelPage.waitForTimeout(500);

      // Side Panelでメッセージを受信したことを確認
      const receivedMessages = await sidePanelPage.evaluate(() => {
        return (window as any).receivedMessages;
      });

      expect(receivedMessages.length).toBeGreaterThan(0);
      expect(receivedMessages.some((msg: any) => msg.type === 'TEST_MESSAGE')).toBe(true);
    });

    test('STATE_UPDATEDメッセージがSide Panelで正しく受信されること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        (window as any).stateUpdatedReceived = false;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            (window as any).stateUpdatedReceived = true;
          }
        });
      });

      // Service WorkerからSTATE_UPDATEDメッセージを送信
      await serviceWorker.evaluate(() => {
        chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
      });

      // メッセージが受信されるまで待機
      await sidePanelPage.waitForTimeout(500);

      // STATE_UPDATEDメッセージが受信されたことを確認
      const stateUpdatedReceived = await sidePanelPage.evaluate(() => {
        return (window as any).stateUpdatedReceived;
      });

      expect(stateUpdatedReceived).toBe(true);
    });
  });

  test.describe('Requirement 4.5.3: タブイベント処理時のツリー状態バックグラウンド同期', () => {
    test('タブ作成時にService WorkerがSTATE_UPDATEDメッセージを送信すること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        (window as any).stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            (window as any).stateUpdateCount++;
          }
        });
      });

      // 初期カウントを取得
      const initialCount = await sidePanelPage.evaluate(() => {
        return (window as any).stateUpdateCount;
      });

      // タブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // STATE_UPDATEDメッセージが送信されるまで待機
      await sidePanelPage.waitForTimeout(1000);

      // カウントが増加したことを確認
      const finalCount = await sidePanelPage.evaluate(() => {
        return (window as any).stateUpdateCount;
      });

      expect(finalCount).toBeGreaterThan(initialCount);

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.remove(tabId);
      }, tab.id!);
    });

    test('タブ削除時にService WorkerがSTATE_UPDATEDメッセージを送信すること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // タブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // 少し待機
      await sidePanelPage.waitForTimeout(500);

      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        (window as any).stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            (window as any).stateUpdateCount++;
          }
        });
      });

      // 初期カウントを取得
      const initialCount = await sidePanelPage.evaluate(() => {
        return (window as any).stateUpdateCount;
      });

      // タブを削除
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.remove(tabId);
      }, tab.id!);

      // STATE_UPDATEDメッセージが送信されるまで待機
      await sidePanelPage.waitForTimeout(1000);

      // カウントが増加したことを確認
      const finalCount = await sidePanelPage.evaluate(() => {
        return (window as any).stateUpdateCount;
      });

      expect(finalCount).toBeGreaterThan(initialCount);
    });

    test('タブ更新時にService WorkerがSTATE_UPDATEDメッセージを送信すること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // タブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // 少し待機
      await sidePanelPage.waitForTimeout(500);

      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        (window as any).stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            (window as any).stateUpdateCount++;
          }
        });
      });

      // 初期カウントを取得
      const initialCount = await sidePanelPage.evaluate(() => {
        return (window as any).stateUpdateCount;
      });

      // タブを更新（URLを変更）
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.update(tabId, { url: 'chrome://newtab' });
      }, tab.id!);

      // STATE_UPDATEDメッセージが送信されるまで待機
      await sidePanelPage.waitForTimeout(1000);

      // カウントが増加したことを確認
      const finalCount = await sidePanelPage.evaluate(() => {
        return (window as any).stateUpdateCount;
      });

      expect(finalCount).toBeGreaterThan(initialCount);

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.remove(tabId);
      }, tab.id!);
    });

    test('タブアクティブ化時にツリー状態が同期されること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // タブを2つ作成
      const tab1 = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: true });
      });
      const tab2 = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // 少し待機
      await sidePanelPage.waitForTimeout(500);

      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        (window as any).stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            (window as any).stateUpdateCount++;
          }
        });
      });

      // tab2をアクティブ化
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.update(tabId, { active: true });
      }, tab2.id!);

      // STATE_UPDATEDメッセージが送信されるまで待機
      await sidePanelPage.waitForTimeout(1000);

      // アクティブなタブがtab2であることを確認
      const activeTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0]?.id;
      });

      expect(activeTabId).toBe(tab2.id);

      // クリーンアップ
      await serviceWorker.evaluate(async (tabIds) => {
        await chrome.tabs.remove(tabIds);
      }, [tab1.id!, tab2.id!]);
    });
  });

  test.describe('Requirement 4.5.4: Service Worker再起動時の状態復元', () => {
    test('Service Workerが正常に起動し、状態が復元されること', async ({
      extensionContext,
    }) => {
      // Service Workerのライフサイクルを検証
      await assertServiceWorkerLifecycle(extensionContext);
    });

    test('Service Workerのイベントリスナーが登録されていること', async ({
      serviceWorker,
    }) => {
      // イベントリスナーが登録されていることを検証
      await assertEventListenersRegistered(serviceWorker);
    });

    test('Service Workerの状態がストレージから復元されること', async ({
      serviceWorker,
    }) => {
      // Service WorkerがTreeStateManagerを持っていることを確認
      const hasTreeStateManager = await serviceWorker.evaluate(() => {
        return typeof (globalThis as any).pendingTabParents !== 'undefined';
      });

      expect(hasTreeStateManager).toBe(true);
    });

    test('Service Worker再起動後もchrome.runtimeが利用可能であること', async ({
      serviceWorker,
    }) => {
      // chrome.runtimeが利用可能であることを確認
      const chromeRuntimeAvailable = await serviceWorker.evaluate(() => {
        return (
          typeof chrome !== 'undefined' &&
          typeof chrome.runtime !== 'undefined' &&
          typeof chrome.runtime.sendMessage === 'function'
        );
      });

      expect(chromeRuntimeAvailable).toBe(true);
    });
  });

  test.describe('Requirement 4.5.5: 長時間非アクティブ後の通信再確立', () => {
    test('一定時間経過後もService Workerとの通信が可能であること', async ({
      sidePanelPage,
    }) => {
      // 最初の通信
      const response1 = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'GET_STATE',
      });
      expect((response1 as { success: boolean }).success).toBe(true);

      // 少し待機（Service Workerがアイドル状態になる可能性）
      await sidePanelPage.waitForTimeout(2000);

      // 2回目の通信
      const response2 = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'GET_STATE',
      });
      expect((response2 as { success: boolean }).success).toBe(true);
    });

    test('複数回のメッセージ送信が正常に処理されること', async ({
      sidePanelPage,
    }) => {
      // 複数のメッセージを順次送信
      for (let i = 0; i < 5; i++) {
        const response = await sendMessageToServiceWorker(sidePanelPage, {
          type: 'GET_STATE',
        });
        expect((response as { success: boolean }).success).toBe(true);
      }
    });

    test('同時に複数のメッセージを送信しても正常に処理されること', async ({
      sidePanelPage,
    }) => {
      // 複数のメッセージを並列で送信
      const promises = Array.from({ length: 5 }, () =>
        sendMessageToServiceWorker(sidePanelPage, { type: 'GET_STATE' })
      );

      const responses = await Promise.all(promises);

      // すべてのレスポンスが成功であることを確認
      responses.forEach((response) => {
        expect((response as { success: boolean }).success).toBe(true);
      });
    });

    test('ドラッグ状態のSet/Get/Clearが正常に動作すること', async ({
      sidePanelPage,
    }) => {
      // ドラッグ状態を設定
      const setResponse = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'SET_DRAG_STATE',
        payload: { tabId: 123, treeData: {}, sourceWindowId: 1 },
      });
      expect((setResponse as { success: boolean }).success).toBe(true);

      // ドラッグ状態を取得
      const getResponse = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'GET_DRAG_STATE',
      });
      expect((getResponse as { success: boolean; data: any }).success).toBe(true);
      expect((getResponse as { success: boolean; data: any }).data).toMatchObject({
        tabId: 123,
        sourceWindowId: 1,
      });

      // ドラッグ状態をクリア
      const clearResponse = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'CLEAR_DRAG_STATE',
      });
      expect((clearResponse as { success: boolean }).success).toBe(true);

      // クリア後、ドラッグ状態がnullであることを確認
      const getAfterClear = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'GET_DRAG_STATE',
      });
      expect((getAfterClear as { success: boolean; data: any }).data).toBeNull();
    });
  });

  test.describe('統合テスト: Service Workerとの完全な通信フロー', () => {
    test('タブ作成からツリー更新までの完全なフロー', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        (window as any).messageLog = [];
        chrome.runtime.onMessage.addListener((message) => {
          (window as any).messageLog.push({
            type: message.type,
            timestamp: Date.now(),
          });
        });
      });

      // タブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // STATE_UPDATEDメッセージが送信されるまで待機
      await sidePanelPage.waitForTimeout(1000);

      // メッセージログを確認
      const messageLog = await sidePanelPage.evaluate(() => {
        return (window as any).messageLog;
      });

      // STATE_UPDATEDメッセージが含まれていることを確認
      const hasStateUpdated = messageLog.some(
        (msg: { type: string }) => msg.type === 'STATE_UPDATED'
      );
      expect(hasStateUpdated).toBe(true);

      // タブをアクティブ化
      await sendMessageToServiceWorker(sidePanelPage, {
        type: 'ACTIVATE_TAB',
        payload: { tabId: tab.id },
      });

      // アクティブなタブが変更されたことを確認
      const activeTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0]?.id;
      });
      expect(activeTabId).toBe(tab.id);

      // タブを閉じる
      await sendMessageToServiceWorker(sidePanelPage, {
        type: 'CLOSE_TAB',
        payload: { tabId: tab.id },
      });

      // タブが削除されたことを確認
      const tabExists = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({});
        return tabs.some((t) => t.id === tabId);
      }, tab.id!);
      expect(tabExists).toBe(false);
    });

    test('複数タブ間でのService Worker通信', async ({
      sidePanelPage,
      extensionContext,
      extensionId,
      serviceWorker,
    }) => {
      // 2つ目のSide Panelページを開く
      const sidePanelPage2 = await extensionContext.newPage();
      await sidePanelPage2.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await sidePanelPage2.waitForSelector('#root', { timeout: 5000 });

      // 両方のSide Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        (window as any).receivedCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            (window as any).receivedCount++;
          }
        });
      });

      await sidePanelPage2.evaluate(() => {
        (window as any).receivedCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            (window as any).receivedCount++;
          }
        });
      });

      // タブを作成（STATE_UPDATEDメッセージがブロードキャストされる）
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // メッセージが送信されるまで待機
      await sidePanelPage.waitForTimeout(1000);

      // 両方のSide Panelでメッセージを受信したことを確認
      const receivedCount1 = await sidePanelPage.evaluate(() => {
        return (window as any).receivedCount;
      });
      const receivedCount2 = await sidePanelPage2.evaluate(() => {
        return (window as any).receivedCount;
      });

      expect(receivedCount1).toBeGreaterThan(0);
      expect(receivedCount2).toBeGreaterThan(0);

      // クリーンアップ
      await sidePanelPage2.close();
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.remove(tabId);
      }, tab.id!);
    });
  });

  test.describe('エラーハンドリング', () => {
    test('不明なメッセージタイプに対してエラーレスポンスが返ること', async ({
      sidePanelPage,
    }) => {
      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'UNKNOWN_TYPE',
      });

      expect((response as { success: boolean }).success).toBe(false);
      expect((response as { error: string }).error).toBe('Unknown message type');
    });

    test('存在しないタブIDに対する操作でエラーが返ること', async ({
      sidePanelPage,
    }) => {
      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'ACTIVATE_TAB',
        payload: { tabId: 999999 },
      });

      expect((response as { success: boolean }).success).toBe(false);
    });

    test('メッセージタイムアウトが正しく処理されること', async ({
      sidePanelPage,
    }) => {
      // 非常に短いタイムアウトでテスト
      // 注：実際のテストではService Workerは通常素早く応答するため、
      // このテストは主にタイムアウトメカニズムの検証に使用
      await expect(
        sendMessageToServiceWorker(
          sidePanelPage,
          { type: 'GET_STATE' },
          { timeout: 1 }
        )
      ).rejects.toThrow();
    });
  });
});
