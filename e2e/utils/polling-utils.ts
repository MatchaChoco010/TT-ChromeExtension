/**
 * PollingUtils
 *
 * ポーリング待機の共通ユーティリティ関数
 * 条件式が満たされるまでポーリングで待機するパターンを共通化
 *
 * @description
 * E2Eテストでは、非同期の状態変更を待機する必要があることが多い。
 * このモジュールでは、ポーリングで条件をチェックし、条件が満たされるか
 * タイムアウトするまで待機する共通関数を提供する。
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect } from '@playwright/test';
import '../types';

/**
 * ポーリング待機のオプション
 */
export interface PollingOptions {
  /** タイムアウト時間（ミリ秒） - デフォルト: 5000ms */
  timeout?: number;
  /** ポーリング間隔（ミリ秒） - デフォルト: 100ms */
  interval?: number;
  /** タイムアウト時のエラーメッセージ */
  timeoutMessage?: string;
}

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_INTERVAL = 100;

/**
 * Service Workerを取得するヘルパー関数
 */
async function getServiceWorker(context: BrowserContext): Promise<Worker> {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  return serviceWorker;
}

/**
 * Service Workerコンテキストでポーリング待機を行う
 *
 * Service Worker内で条件関数を実行し、条件が満たされるまでポーリングで待機する。
 * 条件関数は Service Worker コンテキストで実行されるため、chrome API にアクセス可能。
 *
 * @param serviceWorker - Service Worker
 * @param conditionFn - 条件関数（trueを返すと待機終了）。Service Workerコンテキストで実行される。
 * @param args - 条件関数に渡す引数
 * @param options - ポーリングオプション
 *
 * @example
 * // タブがツリーに追加されるまで待機
 * await pollInServiceWorker(
 *   serviceWorker,
 *   async (tabId) => {
 *     const result = await chrome.storage.local.get('tree_state');
 *     const treeState = result.tree_state;
 *     return !!treeState?.tabToNode?.[tabId];
 *   },
 *   tabId,
 *   { timeout: 5000, timeoutMessage: `Tab ${tabId} was not added to tree` }
 * );
 */
export async function pollInServiceWorker<T, R>(
  serviceWorker: Worker,
  conditionFn: (args: T) => Promise<boolean> | boolean,
  args: T,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = DEFAULT_INTERVAL,
    timeoutMessage,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ conditionFnStr, args, iterations, interval }) => {
      // eslint-disable-next-line no-eval
      const fn = eval(`(${conditionFnStr})`);
      for (let i = 0; i < iterations; i++) {
        try {
          if (await fn(args)) {
            return { success: true };
          }
        } catch {
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    {
      conditionFnStr: conditionFn.toString(),
      args,
      iterations,
      interval,
    }
  );

  if (!result.success && timeoutMessage) {
    throw new Error(timeoutMessage);
  }
}

/**
 * ストレージ内のツリー状態が条件を満たすまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param checkFn - tree_stateをチェックする条件関数（Service Workerコンテキストで実行）
 * @param options - ポーリングオプション
 */
export async function waitForTreeStateCondition(
  context: BrowserContext,
  checkFnStr: string,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = DEFAULT_INTERVAL,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  await serviceWorker.evaluate(
    async ({ checkFnStr, iterations, interval }) => {
      // eslint-disable-next-line no-eval
      const checkFn = eval(`(${checkFnStr})`) as (treeState: unknown) => boolean;
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('tree_state');
        if (checkFn(result.tree_state)) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { checkFnStr, iterations, interval }
  );
}

/**
 * タブがツリーに追加されるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - 待機するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabInTreeState(
  context: BrowserContext,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 50,
    timeoutMessage = `Timeout waiting for tab ${tabId} to be added to tree`,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ tabId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
        if (treeState?.tabToNode?.[tabId]) {
          return { success: true };
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { tabId, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
}

/**
 * タブがツリーから削除されるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - 待機するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabRemovedFromTreeState(
  context: BrowserContext,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 50,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  await serviceWorker.evaluate(
    async ({ tabId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
        if (!treeState?.tabToNode?.[tabId]) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { tabId, iterations, interval }
  );
}

/**
 * タブがアクティブになるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - 待機するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabActive(
  context: BrowserContext,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 50,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  await serviceWorker.evaluate(
    async ({ tabId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.active) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { tabId, iterations, interval }
  );
}

/**
 * ウィンドウがChrome内部状態に登録されるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param windowId - 待機するウィンドウのID
 * @param options - ポーリングオプション
 */
export async function waitForWindowRegistered(
  context: BrowserContext,
  windowId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  await serviceWorker.evaluate(
    async ({ windowId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        try {
          const windows = await chrome.windows.getAll();
          if (windows.find(w => w.id === windowId)) {
            return;
          }
        } catch {
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { windowId, iterations, interval }
  );
}

/**
 * ウィンドウが閉じられるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param windowId - 待機するウィンドウのID
 * @param options - ポーリングオプション
 */
export async function waitForWindowClosed(
  context: BrowserContext,
  windowId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  await serviceWorker.evaluate(
    async ({ windowId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        try {
          const windows = await chrome.windows.getAll();
          if (!windows.find(w => w.id === windowId)) {
            return;
          }
        } catch {
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { windowId, iterations, interval }
  );
}

/**
 * タブが指定ウィンドウに移動するまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - 移動するタブのID
 * @param windowId - 移動先のウィンドウID
 * @param options - ポーリングオプション
 */
export async function waitForTabInWindow(
  context: BrowserContext,
  tabId: number,
  windowId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  await serviceWorker.evaluate(
    async ({ tabId, windowId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.windowId === windowId) {
            return;
          }
        } catch {
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { tabId, windowId, iterations, interval }
  );
}

/**
 * ウィンドウのタブがストレージに同期されるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param windowId - 待機するウィンドウのID
 * @param options - ポーリングオプション
 */
export async function waitForWindowTreeSync(
  context: BrowserContext,
  windowId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  await serviceWorker.evaluate(
    async ({ windowId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        try {
          const tabs = await chrome.tabs.query({ windowId });
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;

          if (treeState?.tabToNode && tabs.length > 0) {
            const allTabsSynced = tabs.every(
              (tab: chrome.tabs.Tab) => tab.id && treeState.tabToNode[tab.id]
            );
            if (allTabsSynced) {
              return;
            }
          }
        } catch {
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { windowId, iterations, interval }
  );
}

/**
 * グループがストレージに保存されるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param groupName - 待機するグループの名前
 * @param options - ポーリングオプション
 */
export async function waitForGroupInStorage(
  context: BrowserContext,
  groupName: string,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  await serviceWorker.evaluate(
    async ({ groupName, iterations, interval }) => {
      interface GroupInfo {
        name: string;
      }
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('groups');
        const groups = result.groups as Record<string, GroupInfo> | undefined;
        if (groups) {
          const hasGroup = Object.values(groups).some(
            (group: GroupInfo) => group.name === groupName
          );
          if (hasGroup) {
            return;
          }
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { groupName, iterations, interval }
  );
}

/**
 * グループがストレージから削除されるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param groupId - 削除を待機するグループのID
 * @param options - ポーリングオプション
 */
export async function waitForGroupRemovedFromStorage(
  context: BrowserContext,
  groupId: string,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  await serviceWorker.evaluate(
    async ({ groupId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('groups');
        const groups = result.groups as Record<string, unknown> | undefined;
        if (!groups || !groups[groupId]) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { groupId, iterations, interval }
  );
}

/**
 * ツリー状態が初期化されるまで待機（ノードが存在するまで）
 *
 * @param context - ブラウザコンテキスト
 * @param options - ポーリングオプション
 */
export async function waitForTreeStateInitialized(
  context: BrowserContext,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  await serviceWorker.evaluate(
    async ({ iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes?: Record<string, unknown> } | undefined;
        if (treeState?.nodes && Object.keys(treeState.nodes).length > 0) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { iterations, interval }
  );
}

/**
 * Pageコンテキストでポーリング待機を行う
 *
 * @param page - Page
 * @param conditionFn - 条件関数（trueを返すと待機終了）。Pageコンテキストで実行される。
 * @param args - 条件関数に渡す引数
 * @param options - ポーリングオプション
 */
export async function pollInPage<T>(
  page: Page,
  conditionFnStr: string,
  args: T,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = DEFAULT_INTERVAL,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  await page.evaluate(
    async ({ conditionFnStr, args, iterations, interval }) => {
      // eslint-disable-next-line no-eval
      const fn = eval(`(${conditionFnStr})`);
      for (let i = 0; i < iterations; i++) {
        try {
          if (await fn(args)) {
            return;
          }
        } catch {
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { conditionFnStr, args, iterations, interval }
  );
}

/**
 * Side Panelが準備完了するまで待機
 *
 * Side Panelのルート要素が表示され、ローディングが完了し、
 * ツリー状態がストレージに保存されるまで待機する共通関数。
 *
 * @param page - Side PanelのPage
 * @param serviceWorker - Service Worker
 * @param options - ポーリングオプション
 */
export async function waitForSidePanelReady(
  page: Page,
  serviceWorker: Worker,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 10000,
    interval = 100,
  } = options;

  await page.waitForSelector('[data-testid="side-panel-root"]', { timeout });

  try {
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 5000 });
  } catch {
  }

  const iterations = Math.ceil(timeout / interval);
  await serviceWorker.evaluate(
    async ({ iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes?: Record<string, unknown> } | undefined;
        if (treeState?.nodes) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { iterations, interval }
  );
}

/**
 * メッセージが受信されるまでポーリングで待機（Pageコンテキスト用）
 *
 * @param page - Page
 * @param messageType - 待機するメッセージのタイプ
 * @param options - ポーリングオプション
 */
export async function waitForMessageReceived(
  page: Page,
  messageType: string,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  await page.evaluate(
    async ({ messageType, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const messages = window.receivedMessages;
        if (messages && messages.some((msg) => msg.type === messageType)) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { messageType, iterations, interval }
  );
}

/**
 * カウンターが初期値より増加するまで待機（Pageコンテキスト用）
 *
 * @param page - Page
 * @param counterName - window上のカウンター変数名
 * @param initialValue - 初期値
 * @param options - ポーリングオプション
 */
export async function waitForCounterIncreased(
  page: Page,
  counterName: string,
  initialValue: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  await page.evaluate(
    async ({ counterName, initialValue, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const count = counterName === 'stateUpdateCount' ? window.stateUpdateCount :
                      counterName === 'receivedCount' ? window.receivedCount :
                      undefined;
        if (count !== undefined && count > initialValue) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
    },
    { counterName, initialValue, iterations, interval }
  );
}

/**
 * ビュースイッチャーが表示されるまで待機
 *
 * Side Panelのルート要素が表示され、ローディングが完了し、
 * ビュースイッチャーコンテナが表示されるまで待機する。
 *
 * @param page - Side PanelのPage
 * @param options - 待機オプション（timeout: タイムアウト時間、デフォルト10000ms）
 */
export async function waitForViewSwitcher(
  page: Page,
  options: { timeout?: number } = {}
): Promise<void> {
  const { timeout = 10000 } = options;

  await page.waitForSelector('[data-testid="side-panel-root"]', { timeout });

  try {
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 5000 });
  } catch {
  }

  await page.waitForSelector('[data-testid="view-switcher-container"]', { timeout });
}

/**
 * タブのURLがロードされるまで待機
 *
 * タブ作成後、URLが設定されるまで待機する。
 * タブのロードは非同期で行われるため、URLの検証前に呼び出す。
 *
 * @param serviceWorker - Service Worker
 * @param tabId - タブID
 * @param expectedUrlPart - URLに含まれるべき文字列
 * @param timeout - タイムアウト（ミリ秒、デフォルト: 10000）
 * @returns ロード完了後のタブ情報
 */
export async function waitForTabUrlLoaded(
  serviceWorker: Worker,
  tabId: number,
  expectedUrlPart: string,
  timeout: number = 10000
): Promise<chrome.tabs.Tab> {
  return await serviceWorker.evaluate(async ({ id, urlPart, maxWait }) => {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      const tab = await chrome.tabs.get(id);
      if (tab.url && tab.url.includes(urlPart)) {
        return tab;
      }
      if (tab.pendingUrl && tab.pendingUrl.includes(urlPart)) {
        return tab;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return chrome.tabs.get(id);
  }, { id: tabId, urlPart: expectedUrlPart, maxWait: timeout });
}

/**
 * タブの読み込みが完了するまで待機
 *
 * @param serviceWorker - Service Worker
 * @param tabId - 待機するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabStatusComplete(
  serviceWorker: Worker,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 10000,
    interval = 100,
    timeoutMessage = `Tab ${tabId} did not complete loading`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ tabId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === 'complete') {
            return { success: true };
          }
        } catch {
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { tabId, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
}

/**
 * 汎用的な条件待機関数
 *
 * 指定された条件関数がtrueを返すまでポーリングで待機する。
 * 条件関数はブラウザ外（Node.js）で実行されるため、
 * Service WorkerやPageの評価結果を条件として使用できる。
 *
 * @param conditionFn - 条件関数（Promise<boolean>またはboolean）
 * @param options - ポーリングオプション
 *
 * @example
 * await waitForCondition(
 *   async () => {
 *     const result = await serviceWorker.evaluate(...);
 *     return result === expectedValue;
 *   },
 *   { timeout: 5000, interval: 100 }
 * );
 */
export async function waitForCondition(
  conditionFn: () => Promise<boolean> | boolean,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = DEFAULT_INTERVAL,
    timeoutMessage = 'Condition was not met within timeout',
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const result = await conditionFn();
      if (result) {
        return;
      }
    } catch {
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(timeoutMessage);
}
