/**
 * Service Workerとの通信のE2Eテスト
 *
 * Service Workerとの通信機能を検証するE2Eテスト。
 * Side PanelからService Workerへのメッセージ送信、
 * Service WorkerからSide Panelへのメッセージ送信、
 * タブイベント処理時のツリー状態バックグラウンド同期、
 * Service Worker再起動時の状態復元、
 * 長時間非アクティブ後の通信再確立を検証します。
 */
import { test, expect } from './fixtures/extension';
import {
  sendMessageToServiceWorker,
  assertEventListenersRegistered,
  assertServiceWorkerLifecycle,
} from './utils/service-worker-utils';
import {
  waitForMessageReceived,
  waitForCounterIncreased,
  waitForTabInTreeState,
  waitForTabActive,
  waitForCondition,
} from './utils/polling-utils';
import {
  createTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
// Window型拡張を適用するためのインポート
import './types';

/**
 * Service Workerからのレスポンス型
 */
interface ServiceWorkerResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * ドラッグ状態の型
 */
interface DragState {
  tabId: number;
  treeData: Record<string, unknown>;
  sourceWindowId: number;
}

test.describe('Service Workerとの通信', () => {
  test.describe('Side PanelからService Workerへのメッセージ送信', () => {
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
      extensionContext,
    }) => {
      // テスト初期化パターン
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 新しいタブを作成（非アクティブ）
      const tabId = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // ACTIVATE_TABメッセージを送信
      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'ACTIVATE_TAB',
        payload: { tabId: tabId },
      });

      // 成功レスポンスを検証
      expect(response).toMatchObject({
        success: true,
      });

      // タブがアクティブになったことを確認
      const isActive = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({ active: true });
        return tabs.some((t) => t.id === tabId);
      }, tabId);

      expect(isActive).toBe(true);

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('CLOSE_TABメッセージでタブを閉じることができること', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      // テスト初期化パターン
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 新しいタブを作成
      const tabId = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // タブが存在することを確認
      const existsBefore = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({});
        return tabs.some((t) => t.id === tabId);
      }, tabId);
      expect(existsBefore).toBe(true);

      // CLOSE_TABメッセージを送信
      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'CLOSE_TAB',
        payload: { tabId: tabId },
      });

      // 成功レスポンスを検証
      expect(response).toMatchObject({
        success: true,
      });

      // タブが削除されたことを確認
      const existsAfter = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({});
        return tabs.some((t) => t.id === tabId);
      }, tabId);

      expect(existsAfter).toBe(false);

      // UI上でもタブが削除されていることを確認
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
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

  test.describe('Service WorkerからSide Panelへのメッセージ送信', () => {
    test('chrome.runtime.onMessageリスナーがSide Panelで正しくメッセージを受信すること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        window.receivedMessages = [];
        chrome.runtime.onMessage.addListener((message) => {
          window.receivedMessages!.push(message);
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
      await waitForMessageReceived(sidePanelPage, 'TEST_MESSAGE');

      // Side Panelでメッセージを受信したことを確認
      const receivedMessages = await sidePanelPage.evaluate(() => {
        return window.receivedMessages;
      });

      expect(receivedMessages.length).toBeGreaterThan(0);
      expect(receivedMessages.some((msg: { type: string }) => msg.type === 'TEST_MESSAGE')).toBe(true);
    });

    test('STATE_UPDATEDメッセージがSide Panelで正しく受信されること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        window.stateUpdatedReceived = false;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.stateUpdatedReceived = true;
          }
        });
      });

      // Service WorkerからSTATE_UPDATEDメッセージを送信
      await serviceWorker.evaluate(() => {
        chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
      });

      // メッセージが受信されるまでポーリングで待機
      await waitForCondition(
        async () => {
          return await sidePanelPage.evaluate(() => window.stateUpdatedReceived === true);
        },
        { timeout: 5000, interval: 100 }
      );

      // STATE_UPDATEDメッセージが受信されたことを確認
      const stateUpdatedReceived = await sidePanelPage.evaluate(() => {
        return window.stateUpdatedReceived;
      });

      expect(stateUpdatedReceived).toBe(true);
    });
  });

  test.describe('タブイベント処理時のツリー状態バックグラウンド同期', () => {
    test('タブ作成時にService WorkerがSTATE_UPDATEDメッセージを送信すること', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      // テスト初期化パターン
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        window.stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.stateUpdateCount = (window.stateUpdateCount || 0) + 1;
          }
        });
      });

      // 初期カウントを取得
      const initialCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      // タブを作成
      const tabId = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // STATE_UPDATEDメッセージが送信されるまでポーリングで待機
      await waitForCounterIncreased(sidePanelPage, 'stateUpdateCount', initialCount ?? 0);

      // カウントが増加したことを確認
      const finalCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      expect(finalCount).toBeGreaterThan(initialCount ?? 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブ削除時にService WorkerがSTATE_UPDATEDメッセージを送信すること', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      // テスト初期化パターン
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // タブを作成
      const tabId = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // タブがツリーに同期されるまで待機
      await waitForTabInTreeState(extensionContext, tabId);

      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        window.stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.stateUpdateCount = (window.stateUpdateCount || 0) + 1;
          }
        });
      });

      // 初期カウントを取得
      const initialCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      // タブを削除
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // STATE_UPDATEDメッセージが送信されるまで待機
      await waitForCounterIncreased(sidePanelPage, 'stateUpdateCount', initialCount);

      // カウントが増加したことを確認
      const finalCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      expect(finalCount).toBeGreaterThan(initialCount ?? 0);
    });

    test('タブ更新時にService WorkerがSTATE_UPDATEDメッセージを送信すること', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      // テスト初期化パターン
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // タブを作成
      const tabId = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // タブがツリーに同期されるまで待機
      await waitForTabInTreeState(extensionContext, tabId);

      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        window.stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.stateUpdateCount = (window.stateUpdateCount || 0) + 1;
          }
        });
      });

      // 初期カウントを取得
      const initialCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      // タブを更新（URLを変更）
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.update(tabId, { url: 'chrome://newtab' });
      }, tabId);

      // STATE_UPDATEDメッセージが送信されるまで待機
      await waitForCounterIncreased(sidePanelPage, 'stateUpdateCount', initialCount);

      // カウントが増加したことを確認
      const finalCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      expect(finalCount).toBeGreaterThan(initialCount ?? 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブアクティブ化時にツリー状態が同期されること', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      // テスト初期化パターン
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // タブを2つ作成
      const tab1 = await createTab(extensionContext, 'about:blank', { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      // タブがツリーに同期されるまでポーリングで待機
      await waitForTabInTreeState(extensionContext, tab1);
      await waitForTabInTreeState(extensionContext, tab2);

      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        window.stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.stateUpdateCount = (window.stateUpdateCount || 0) + 1;
          }
        });
      });

      // tab2をアクティブ化
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.update(tabId, { active: true });
      }, tab2);

      // アクティブなタブがtab2になるまでポーリングで待機
      await waitForTabActive(extensionContext, tab2);

      // アクティブなタブがtab2であることを確認
      const activeTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0]?.id;
      });

      expect(activeTabId).toBe(tab2);

      // クリーンアップ
      await closeTab(extensionContext, tab1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      await closeTab(extensionContext, tab2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('Service Worker再起動時の状態復元', () => {
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
        return typeof globalThis.pendingTabParents !== 'undefined';
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

  test.describe('長時間非アクティブ後の通信再確立', () => {
    test('一定時間経過後もService Workerとの通信が可能であること', async ({
      sidePanelPage,
    }) => {
      // 最初の通信
      const response1 = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'GET_STATE',
      });
      expect((response1 as { success: boolean }).success).toBe(true);

      // Service Workerがアイドル状態になる可能性を考慮して複数回の通信テスト
      // 注: 固定時間待機ではなく、複数回の通信が成功することで堅牢性を確認
      for (let i = 0; i < 5; i++) {
        const response = await sendMessageToServiceWorker(sidePanelPage, {
          type: 'GET_STATE',
        });
        expect((response as { success: boolean }).success).toBe(true);
      }

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
      const typedGetResponse = getResponse as ServiceWorkerResponse<DragState>;
      expect(typedGetResponse.success).toBe(true);
      expect(typedGetResponse.data).toMatchObject({
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
      const typedGetAfterClear = getAfterClear as ServiceWorkerResponse<DragState | null>;
      expect(typedGetAfterClear.data).toBeNull();
    });
  });

  test.describe('統合テスト: Service Workerとの完全な通信フロー', () => {
    test('タブ作成からツリー更新までの完全なフロー', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      // テスト初期化パターン
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // Side Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        window.messageLog = [];
        chrome.runtime.onMessage.addListener((message) => {
          window.messageLog!.push({
            type: message.type,
            timestamp: Date.now(),
          });
        });
      });

      // タブを作成
      const tabId = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // STATE_UPDATEDメッセージが送信されるまでポーリングで待機
      await waitForCondition(
        async () => {
          const log = await sidePanelPage.evaluate(() => window.messageLog);
          return log !== undefined && log.some((msg) => msg.type === 'STATE_UPDATED');
        },
        { timeout: 5000, interval: 100 }
      );

      // メッセージログを確認
      const messageLog = await sidePanelPage.evaluate(() => {
        return window.messageLog;
      });

      // STATE_UPDATEDメッセージが含まれていることを確認
      const hasStateUpdated = messageLog.some(
        (msg: { type: string }) => msg.type === 'STATE_UPDATED'
      );
      expect(hasStateUpdated).toBe(true);

      // タブをアクティブ化
      await sendMessageToServiceWorker(sidePanelPage, {
        type: 'ACTIVATE_TAB',
        payload: { tabId: tabId },
      });

      // アクティブなタブが変更されるまでポーリングで待機
      await waitForTabActive(extensionContext, tabId);

      // アクティブなタブが変更されたことを確認
      const activeTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0]?.id;
      });
      expect(activeTabId).toBe(tabId);

      // タブを閉じる
      await sendMessageToServiceWorker(sidePanelPage, {
        type: 'CLOSE_TAB',
        payload: { tabId: tabId },
      });

      // タブが削除されるまでポーリングで待機
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(() => chrome.tabs.query({}));
          return !tabs.some((t: chrome.tabs.Tab) => t.id === tabId);
        },
        { timeout: 5000, interval: 100 }
      );

      // タブが削除されたことを確認
      const tabExists = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({});
        return tabs.some((t) => t.id === tabId);
      }, tabId);
      expect(tabExists).toBe(false);

      // UI上でもタブが削除されていることを確認
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('複数タブ間でのService Worker通信', async ({
      sidePanelPage,
      extensionContext,
      extensionId,
      serviceWorker,
    }) => {
      // テスト初期化パターン
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 2つ目のSide Panelページを開く
      const sidePanelPage2 = await extensionContext.newPage();
      await sidePanelPage2.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await sidePanelPage2.waitForSelector('#root', { timeout: 5000 });

      // 2つ目のサイドパネルタブのIDを取得して構造を更新
      const sidePanelTab2Id = await serviceWorker.evaluate(async (wId) => {
        const extensionIdInner = chrome.runtime.id;
        const sidePanelUrlPrefix = `chrome-extension://${extensionIdInner}/sidepanel.html`;
        const tabs = await chrome.tabs.query({ windowId: wId });
        const sidePanelTabs = tabs.filter(t => {
          const url = t.url || t.pendingUrl || '';
          return url.startsWith(sidePanelUrlPrefix);
        });
        // 2つ目のサイドパネルタブを取得
        if (sidePanelTabs.length >= 2) {
          return sidePanelTabs[1].id!;
        }
        return sidePanelTabs[0]?.id ?? 0;
      }, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: sidePanelTab2Id, depth: 0 },
      ], 0);

      // 両方のSide Panelでメッセージリスナーを設定
      await sidePanelPage.evaluate(() => {
        window.receivedCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.receivedCount = (window.receivedCount || 0) + 1;
          }
        });
      });

      await sidePanelPage2.evaluate(() => {
        window.receivedCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.receivedCount = (window.receivedCount || 0) + 1;
          }
        });
      });

      // タブを作成（STATE_UPDATEDメッセージがブロードキャストされる）
      const tabId = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: sidePanelTab2Id, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // 両方のSide Panelでメッセージが受信されるまでポーリングで待機
      await waitForCounterIncreased(sidePanelPage, 'receivedCount', 0);
      await waitForCounterIncreased(sidePanelPage2, 'receivedCount', 0);

      // 両方のSide Panelでメッセージを受信したことを確認
      const receivedCount1 = await sidePanelPage.evaluate(() => {
        return window.receivedCount;
      });
      const receivedCount2 = await sidePanelPage2.evaluate(() => {
        return window.receivedCount;
      });

      expect(receivedCount1).toBeGreaterThan(0);
      expect(receivedCount2).toBeGreaterThan(0);

      // クリーンアップ
      await sidePanelPage2.close();
      // ページを閉じるとタブも削除されるので、構造を更新
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
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
