/**
 * Service Workerとの通信のE2Eテスト
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
  getTestServerUrl,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
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
      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'GET_STATE',
      });

      expect(response).toBeDefined();
      expect((response as { success: boolean }).success).toBe(true);
    });

    test('ACTIVATE_TABメッセージでタブをアクティブ化できること', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'ACTIVATE_TAB',
        payload: { tabId: tabId },
      });

      expect(response).toMatchObject({
        success: true,
      });

      const isActive = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({ active: true });
        return tabs.some((t) => t.id === tabId);
      }, tabId);

      expect(isActive).toBe(true);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('CLOSE_TABメッセージでタブを閉じることができること', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      const existsBefore = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({});
        return tabs.some((t) => t.id === tabId);
      }, tabId);
      expect(existsBefore).toBe(true);

      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'CLOSE_TAB',
        payload: { tabId: tabId },
      });

      expect(response).toMatchObject({
        success: true,
      });

      const existsAfter = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({});
        return tabs.some((t) => t.id === tabId);
      }, tabId);

      expect(existsAfter).toBe(false);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('SYNC_TABSメッセージでChrome タブと同期できること', async ({
      sidePanelPage,
    }) => {
      const response = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'SYNC_TABS',
      });

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
      await sidePanelPage.evaluate(() => {
        window.receivedMessages = [];
        chrome.runtime.onMessage.addListener((message) => {
          window.receivedMessages!.push(message);
        });
      });

      await serviceWorker.evaluate(() => {
        chrome.runtime.sendMessage({
          type: 'TEST_MESSAGE',
          payload: { data: 'test' },
        });
      });

      await waitForMessageReceived(sidePanelPage, 'TEST_MESSAGE');

      const receivedMessages = await sidePanelPage.evaluate(() => {
        return window.receivedMessages;
      });

      expect(receivedMessages!.length).toBeGreaterThan(0);
      expect(receivedMessages!.some((msg: { type: string }) => msg.type === 'TEST_MESSAGE')).toBe(true);
    });

    test('STATE_UPDATEDメッセージがSide Panelで正しく受信されること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      await sidePanelPage.evaluate(() => {
        window.stateUpdatedReceived = false;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.stateUpdatedReceived = true;
          }
        });
      });

      await serviceWorker.evaluate(() => {
        chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
      });

      await waitForCondition(
        async () => {
          return await sidePanelPage.evaluate(() => window.stateUpdatedReceived === true);
        },
        { timeout: 5000, interval: 100 }
      );

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
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await sidePanelPage.evaluate(() => {
        window.stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.stateUpdateCount = (window.stateUpdateCount || 0) + 1;
          }
        });
      });

      const initialCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await waitForCounterIncreased(sidePanelPage, 'stateUpdateCount', initialCount ?? 0);

      const finalCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      expect(finalCount).toBeGreaterThan(initialCount ?? 0);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブ削除時にService WorkerがSTATE_UPDATEDメッセージを送信すること', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(serviceWorker, tabId);

      await sidePanelPage.evaluate(() => {
        window.stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.stateUpdateCount = (window.stateUpdateCount || 0) + 1;
          }
        });
      });

      const initialCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForCounterIncreased(sidePanelPage, 'stateUpdateCount', initialCount ?? 0);

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
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(serviceWorker, tabId);

      await sidePanelPage.evaluate(() => {
        window.stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.stateUpdateCount = (window.stateUpdateCount || 0) + 1;
          }
        });
      });

      const initialCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.update(tabId, { url: 'chrome://newtab' });
      }, tabId);

      await waitForCounterIncreased(sidePanelPage, 'stateUpdateCount', initialCount ?? 0);

      const finalCount = await sidePanelPage.evaluate(() => {
        return window.stateUpdateCount;
      });

      expect(finalCount).toBeGreaterThan(initialCount ?? 0);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブアクティブ化時にツリー状態が同期されること', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const tab1 = await createTab(serviceWorker, getTestServerUrl('/page'), { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, getTestServerUrl('/page'), { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      await waitForTabInTreeState(serviceWorker, tab1);
      await waitForTabInTreeState(serviceWorker, tab2);

      await sidePanelPage.evaluate(() => {
        window.stateUpdateCount = 0;
        chrome.runtime.onMessage.addListener((message) => {
          if (message.type === 'STATE_UPDATED') {
            window.stateUpdateCount = (window.stateUpdateCount || 0) + 1;
          }
        });
      });

      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.update(tabId, { active: true });
      }, tab2);

      await waitForTabActive(serviceWorker, tab2);

      const activeTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0]?.id;
      });

      expect(activeTabId).toBe(tab2);

      await closeTab(serviceWorker, tab1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tab2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('Service Worker再起動時の状態復元', () => {
    test('Service Workerが正常に起動し、状態が復元されること', async ({
      extensionContext,
    }) => {
      await assertServiceWorkerLifecycle(extensionContext);
    });

    test('Service Workerのイベントリスナーが登録されていること', async ({
      serviceWorker,
    }) => {
      await assertEventListenersRegistered(serviceWorker);
    });

    test('Service Workerの状態がストレージから復元されること', async ({
      serviceWorker,
    }) => {
      const hasTreeStateManager = await serviceWorker.evaluate(() => {
        return typeof globalThis.pendingTabParents !== 'undefined';
      });

      expect(hasTreeStateManager).toBe(true);
    });

    test('Service Worker再起動後もchrome.runtimeが利用可能であること', async ({
      serviceWorker,
    }) => {
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
      const response1 = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'GET_STATE',
      });
      expect((response1 as { success: boolean }).success).toBe(true);

      for (let i = 0; i < 5; i++) {
        const response = await sendMessageToServiceWorker(sidePanelPage, {
          type: 'GET_STATE',
        });
        expect((response as { success: boolean }).success).toBe(true);
      }

      const response2 = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'GET_STATE',
      });
      expect((response2 as { success: boolean }).success).toBe(true);
    });

    test('複数回のメッセージ送信が正常に処理されること', async ({
      sidePanelPage,
    }) => {
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
      const promises = Array.from({ length: 5 }, () =>
        sendMessageToServiceWorker(sidePanelPage, { type: 'GET_STATE' })
      );

      const responses = await Promise.all(promises);

      responses.forEach((response) => {
        expect((response as { success: boolean }).success).toBe(true);
      });
    });

    test('ドラッグ状態のSet/Get/Clearが正常に動作すること', async ({
      sidePanelPage,
    }) => {
      const setResponse = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'SET_DRAG_STATE',
        payload: { tabId: 123, treeData: {}, sourceWindowId: 1 },
      });
      expect((setResponse as { success: boolean }).success).toBe(true);

      const getResponse = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'GET_DRAG_STATE',
      });
      const typedGetResponse = getResponse as ServiceWorkerResponse<DragState>;
      expect(typedGetResponse.success).toBe(true);
      expect(typedGetResponse.data).toMatchObject({
        tabId: 123,
        sourceWindowId: 1,
      });

      const clearResponse = await sendMessageToServiceWorker(sidePanelPage, {
        type: 'CLEAR_DRAG_STATE',
      });
      expect((clearResponse as { success: boolean }).success).toBe(true);

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
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await sidePanelPage.evaluate(() => {
        window.messageLog = [];
        chrome.runtime.onMessage.addListener((message) => {
          window.messageLog!.push({
            type: message.type,
            timestamp: Date.now(),
          });
        });
      });

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await waitForCondition(
        async () => {
          const log = await sidePanelPage.evaluate(() => window.messageLog);
          return log !== undefined && log.some((msg) => msg.type === 'STATE_UPDATED');
        },
        { timeout: 5000, interval: 100 }
      );

      const messageLog = await sidePanelPage.evaluate(() => {
        return window.messageLog;
      });

      const hasStateUpdated = messageLog!.some(
        (msg: { type: string }) => msg.type === 'STATE_UPDATED'
      );
      expect(hasStateUpdated).toBe(true);

      await sendMessageToServiceWorker(sidePanelPage, {
        type: 'ACTIVATE_TAB',
        payload: { tabId: tabId },
      });

      await waitForTabActive(serviceWorker, tabId);

      const activeTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0]?.id;
      });
      expect(activeTabId).toBe(tabId);

      await sendMessageToServiceWorker(sidePanelPage, {
        type: 'CLOSE_TAB',
        payload: { tabId: tabId },
      });

      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(() => chrome.tabs.query({}));
          return !tabs.some((t: chrome.tabs.Tab) => t.id === tabId);
        },
        { timeout: 5000, interval: 100 }
      );

      const tabExists = await serviceWorker.evaluate(async (tabId) => {
        const tabs = await chrome.tabs.query({});
        return tabs.some((t) => t.id === tabId);
      }, tabId);
      expect(tabExists).toBe(false);

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
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelPage2 = await extensionContext.newPage();
      await sidePanelPage2.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await sidePanelPage2.waitForSelector('#root', { timeout: 5000 });

      const sidePanelTab2Id = await serviceWorker.evaluate(async (wId) => {
        const extensionIdInner = chrome.runtime.id;
        const sidePanelUrlPrefix = `chrome-extension://${extensionIdInner}/sidepanel.html`;
        const tabs = await chrome.tabs.query({ windowId: wId });
        const sidePanelTabs = tabs.filter(t => {
          const url = t.url || t.pendingUrl || '';
          return url.startsWith(sidePanelUrlPrefix);
        });
        if (sidePanelTabs.length >= 2) {
          return sidePanelTabs[1].id!;
        }
        return sidePanelTabs[0]?.id ?? 0;
      }, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: sidePanelTab2Id, depth: 0 },
      ], 0);

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

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: sidePanelTab2Id, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await waitForCounterIncreased(sidePanelPage, 'receivedCount', 0);
      await waitForCounterIncreased(sidePanelPage2, 'receivedCount', 0);

      const receivedCount1 = await sidePanelPage.evaluate(() => {
        return window.receivedCount;
      });
      const receivedCount2 = await sidePanelPage2.evaluate(() => {
        return window.receivedCount;
      });

      expect(receivedCount1).toBeGreaterThan(0);
      expect(receivedCount2).toBeGreaterThan(0);

      await sidePanelPage2.close();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);
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
      expect((response as { error: string }).error).toBe('Unknown message type: UNKNOWN_TYPE');
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
