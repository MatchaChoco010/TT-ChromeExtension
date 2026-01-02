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
// Window型拡張を適用するためのインポート
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
          // 条件関数内のエラーは無視して続行
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
 * 親子関係がストレージに反映されるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param childTabId - 子タブのID
 * @param parentTabId - 親タブのID
 * @param options - ポーリングオプション
 */
export async function waitForParentChildRelation(
  context: BrowserContext,
  childTabId: number,
  parentTabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 50,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  const found = await serviceWorker.evaluate(
    async ({ parentTabId, childTabId, iterations, interval }) => {
      interface TreeNode {
        parentId: string | null;
      }
      interface LocalTreeState {
        tabToNode: Record<number, string>;
        nodes: Record<string, TreeNode>;
      }
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          const parentNodeId = treeState.tabToNode[parentTabId];
          const childNodeId = treeState.tabToNode[childTabId];
          if (parentNodeId && childNodeId) {
            const childNode = treeState.nodes[childNodeId];
            if (childNode && childNode.parentId === parentNodeId) {
              return true;
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      return false;
    },
    { parentTabId, childTabId, iterations, interval }
  );

  if (!found) {
    throw new Error(`Parent-child relation not established: parent=${parentTabId}, child=${childTabId}`);
  }
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
          // エラーは無視して続行
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
          // エラーは無視して続行
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
          // エラーは無視して続行
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
          // エラーは無視して続行
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
          // 条件関数内のエラーは無視して続行
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

  // Side Panelのルート要素が表示されるまで待機
  await page.waitForSelector('[data-testid="side-panel-root"]', { timeout });

  // ローディングが消えるまで待機
  try {
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 5000 });
  } catch {
    // ローディングが存在しなかった場合は無視
  }

  // Service Workerが準備完了するまでポーリングで待機
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
        // TestGlobals型で定義されたカウンタープロパティにアクセス
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

  // Side Panelのルート要素が表示されるまで待機
  await page.waitForSelector('[data-testid="side-panel-root"]', { timeout });

  // ローディングが消えるまで待機
  try {
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 5000 });
  } catch {
    // ローディングが存在しなかった場合は無視
  }

  // ビュースイッチャーが表示されるまで待機
  await page.waitForSelector('[data-testid="view-switcher-container"]', { timeout });
}

/**
 * タブが親を持たない（ルートレベル）になるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - 待機するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabNoParent(
  context: BrowserContext,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 50,
    timeoutMessage = `Tab ${tabId} still has a parent within timeout`,
  } = options;

  const serviceWorker = await getServiceWorker(context);
  const iterations = Math.ceil(timeout / interval);

  const found = await serviceWorker.evaluate(
    async ({ tabId, iterations, interval }) => {
      interface TreeNode {
        parentId: string | null;
      }
      interface LocalTreeState {
        tabToNode: Record<number, string>;
        nodes: Record<string, TreeNode>;
      }
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          const nodeId = treeState.tabToNode[tabId];
          if (nodeId) {
            const node = treeState.nodes[nodeId];
            if (node && node.parentId === null) {
              return true;
            }
          }
        }
        await new Promise(resolve => setTimeout(resolve, interval));
      }
      return false;
    },
    { tabId, iterations, interval }
  );

  if (!found) {
    throw new Error(timeoutMessage);
  }
}

/**
 * Side Panel UIでタブの親子関係（depth属性）を確認
 *
 * 実際のUI上でタブノードのdata-depth属性を確認する。
 * ストレージの状態ではなく、実際にレンダリングされたDOMを検証する。
 *
 * @param page - Side PanelのPage
 * @param tabId - 確認するタブのID
 * @param expectedDepth - 期待するdepth値
 * @param options - ポーリングオプション
 */
export async function waitForTabDepthInUI(
  page: Page,
  tabId: number,
  expectedDepth: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
    timeoutMessage = `Tab ${tabId} depth in UI did not become ${expectedDepth}`,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const actualDepth = await page.locator(`[data-testid="tree-node-${tabId}"]`).getAttribute('data-depth');
      if (actualDepth === String(expectedDepth)) {
        return;
      }
    } catch {
      // 要素が見つからない場合は続行
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // 最終状態を取得して詳細なエラーメッセージを生成
  const finalDepth = await page.locator(`[data-testid="tree-node-${tabId}"]`).getAttribute('data-depth').catch(() => 'not found');
  throw new Error(`${timeoutMessage}. Actual depth: ${finalDepth}`);
}

/**
 * Side Panel UIでタブが表示されているか確認
 *
 * @param page - Side PanelのPage
 * @param tabId - 確認するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabVisibleInUI(
  page: Page,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
    timeoutMessage = `Tab ${tabId} is not visible in UI`,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    try {
      const isVisible = await page.locator(`[data-testid="tree-node-${tabId}"]`).isVisible();
      if (isVisible) {
        return;
      }
    } catch {
      // 要素が見つからない場合は続行
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(timeoutMessage);
}

/**
 * Side Panel UIで全タブのdepth属性を取得
 *
 * @param page - Side PanelのPage
 * @returns タブIDとdepthのマップ
 */
export async function getAllTabDepthsFromUI(
  page: Page
): Promise<Map<number, number>> {
  const depths = new Map<number, number>();

  const nodes = await page.locator('[data-testid^="tree-node-"]').all();
  for (const node of nodes) {
    const testId = await node.getAttribute('data-testid');
    const depthStr = await node.getAttribute('data-depth');
    if (testId && depthStr) {
      const tabId = parseInt(testId.replace('tree-node-', ''), 10);
      const depth = parseInt(depthStr, 10);
      if (!isNaN(tabId) && !isNaN(depth)) {
        depths.set(tabId, depth);
      }
    }
  }

  return depths;
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
      // 条件関数内のエラーは無視して続行
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error(timeoutMessage);
}
