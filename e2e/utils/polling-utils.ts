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
 *
 * 重要: すべての関数は Worker を直接受け取る。
 * context.serviceWorkers()[0] から新しい参照を取得する getServiceWorker() は廃止。
 * これにより、Service Worker が再起動された場合に即座にエラーが発生し、
 * 根本原因が明確になる。
 */
import type { Page, Worker } from '@playwright/test';
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
const DEFAULT_INTERVAL = 16.667;

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
export async function pollInServiceWorker<T>(
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
      const fn = eval(`(${conditionFnStr})`);
      for (let i = 0; i < iterations; i++) {
        if (await fn(args)) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
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
 * @param serviceWorker - Service Worker
 * @param checkFn - tree_stateをチェックする条件関数（Service Workerコンテキストで実行）
 * @param options - ポーリングオプション
 */
export async function waitForTreeStateCondition(
  serviceWorker: Worker,
  checkFnStr: string,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = DEFAULT_INTERVAL,
    timeoutMessage = 'Timeout waiting for tree state condition to be met',
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ checkFnStr, iterations, interval }) => {
      const checkFn = eval(`(${checkFnStr})`) as (
        treeState: unknown
      ) => boolean;
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('tree_state');
        if (checkFn(result.tree_state)) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { checkFnStr, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
}

/**
 * タブがツリーに追加されるまで待機
 *
 * @param serviceWorker - Service Worker
 * @param tabId - 待機するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabInTreeState(
  serviceWorker: Worker,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  // Service Workerの処理が遅れる場合（waitForSyncComplete等）に対応するため、
  // デフォルトタイムアウトを15秒に設定
  const {
    timeout = 15000,
    interval = 50,
    timeoutMessage = `Timeout waiting for tab ${tabId} to be added to tree`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ tabId, iterations, interval }) => {
      // TreeStateManager（メモリ上）がSingle Source of Truthなので、
      // chrome.storage.localではなくメモリ上の状態を直接確認する
      for (let i = 0; i < iterations; i++) {
        const node = globalThis.treeStateManager?.getNodeByTabId?.(tabId);
        if (node) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }

      // タイムアウト時のデバッグ情報を収集
      let tabExists = false;
      let tabInfo: chrome.tabs.Tab | null = null;
      try {
        tabInfo = await chrome.tabs.get(tabId);
        tabExists = true;
      } catch {
        tabExists = false;
      }

      const syncCompleted = globalThis.treeStateManager?.isSyncCompleted?.() ?? 'unknown';

      // メモリ上のツリー状態を確認
      const memoryNode = globalThis.treeStateManager?.getNodeByTabId?.(tabId);
      const hasNodeInMemory = !!memoryNode;

      // メモリ上のtabToNodeから全タブIDを取得
      const treeState = globalThis.treeStateManager?.toJSON?.();
      const registeredTabIds = treeState?.tabToNode
        ? Object.keys(treeState.tabToNode).map(Number)
        : [];

      // 全Chromeタブを取得して比較
      const allChromeTabs = await chrome.tabs.query({});
      const allChromeTabIds = allChromeTabs.map(t => t.id).filter((id): id is number => id !== undefined);

      // タブ作成ログを取得
      const tabCreationLogs = globalThis.getTabCreationLogs?.(tabId) ?? [];
      const recentLogs = globalThis.getTabCreationLogs?.() ?? [];
      const last50Logs = recentLogs.slice(-50);

      return {
        success: false,
        debug: {
          tabId,
          tabExistsInChrome: tabExists,
          tabWindowId: tabInfo?.windowId,
          registeredTabIds,
          allChromeTabIds,
          missingFromTree: allChromeTabIds.filter(id => !registeredTabIds.includes(id)),
          syncCompleted,
          hasNodeInMemory,
          tabCreationLogs: tabCreationLogs.map(l => l.message),
          last50Logs: last50Logs.map(l => `[tabId=${l.tabId}] ${l.message}`),
        },
      };
    },
    { tabId, iterations, interval }
  );

  if (!result.success) {
    const debugInfo = (result as { debug?: unknown }).debug;
    throw new Error(`${timeoutMessage}\n[DEBUG] ${JSON.stringify(debugInfo, null, 2)}`);
  }
}

/**
 * タブがツリーから削除されるまで待機
 *
 * @param serviceWorker - Service Worker
 * @param tabId - 待機するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabRemovedFromTreeState(
  serviceWorker: Worker,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 15000,
    interval = 50,
    timeoutMessage = `Timeout waiting for tab ${tabId} to be removed from tree`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ tabId, iterations, interval }) => {
      // TreeStateManager（メモリ上）がSingle Source of Truthなので、
      // chrome.storage.localではなくメモリ上の状態を直接確認する
      for (let i = 0; i < iterations; i++) {
        const node = globalThis.treeStateManager?.getNodeByTabId?.(tabId);
        if (!node) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
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
 * タブがアクティブになるまで待機
 *
 * @param serviceWorker - Service Worker
 * @param tabId - 待機するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabActive(
  serviceWorker: Worker,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 50,
    timeoutMessage = `Timeout waiting for tab ${tabId} to become active`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ tabId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.active) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
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
 * ウィンドウがChrome内部状態に登録されるまで待機
 *
 * @param serviceWorker - Service Worker
 * @param windowId - 待機するウィンドウのID
 * @param options - ポーリングオプション
 */
export async function waitForWindowRegistered(
  serviceWorker: Worker,
  windowId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
    timeoutMessage = `Timeout waiting for window ${windowId} to be registered`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ windowId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const windows = await chrome.windows.getAll();
        if (windows.find((w) => w.id === windowId)) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { windowId, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
}

/**
 * ウィンドウが閉じられるまで待機
 *
 * @param serviceWorker - Service Worker
 * @param windowId - 待機するウィンドウのID
 * @param options - ポーリングオプション
 */
export async function waitForWindowClosed(
  serviceWorker: Worker,
  windowId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
    timeoutMessage = `Timeout waiting for window ${windowId} to be closed`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ windowId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const windows = await chrome.windows.getAll();
        if (!windows.find((w) => w.id === windowId)) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { windowId, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
}

/**
 * タブが指定ウィンドウに移動するまで待機
 *
 * @param serviceWorker - Service Worker
 * @param tabId - 移動するタブのID
 * @param windowId - 移動先のウィンドウID
 * @param options - ポーリングオプション
 */
export async function waitForTabInWindow(
  serviceWorker: Worker,
  tabId: number,
  windowId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
    timeoutMessage = `Timeout waiting for tab ${tabId} to be in window ${windowId}`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ tabId, windowId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.windowId === windowId) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { tabId, windowId, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
}

/**
 * ウィンドウのタブがストレージに同期されるまで待機
 *
 * @param serviceWorker - Service Worker
 * @param windowId - 待機するウィンドウのID
 * @param options - ポーリングオプション
 */
export async function waitForWindowTreeSync(
  serviceWorker: Worker,
  windowId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
    timeoutMessage = `Timeout waiting for window ${windowId} tabs to sync with tree state`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ windowId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const tabs = await chrome.tabs.query({ windowId });
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as
          | { tabToNode?: Record<number, string> }
          | undefined;

        if (treeState?.tabToNode && tabs.length > 0) {
          const tabToNode = treeState.tabToNode;
          const allTabsSynced = tabs.every(
            (tab: chrome.tabs.Tab) => tab.id && tabToNode[tab.id]
          );
          if (allTabsSynced) {
            return { success: true };
          }
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { windowId, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
}

/**
 * グループがストレージに保存されるまで待機
 *
 * @param serviceWorker - Service Worker
 * @param groupName - 待機するグループの名前
 * @param options - ポーリングオプション
 */
export async function waitForGroupInStorage(
  serviceWorker: Worker,
  groupName: string,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
    timeoutMessage = `Timeout waiting for group "${groupName}" to be saved in storage`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
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
            return { success: true };
          }
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { groupName, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
}

/**
 * グループがストレージから削除されるまで待機
 *
 * @param serviceWorker - Service Worker
 * @param groupId - 削除を待機するグループのID
 * @param options - ポーリングオプション
 */
export async function waitForGroupRemovedFromStorage(
  serviceWorker: Worker,
  groupId: string,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
    timeoutMessage = `Timeout waiting for group "${groupId}" to be removed from storage`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ groupId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('groups');
        const groups = result.groups as Record<string, unknown> | undefined;
        if (!groups || !groups[groupId]) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { groupId, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
}

/**
 * syncWithChromeTabsが完了するまで待機
 *
 * Service WorkerのsyncCompletedフラグがtrueになるまでポーリングで待機する。
 * これはタブ作成イベント（handleTabCreated）が処理されるために必要。
 *
 * @param serviceWorker - Service Worker
 * @param options - ポーリングオプション
 */
export async function waitForSyncCompleted(
  serviceWorker: Worker,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 10000,
    interval = 100,
    timeoutMessage = 'Timeout waiting for syncWithChromeTabs to complete',
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager?.isSyncCompleted?.()) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
}

/**
 * ツリー状態が初期化されるまで待機（ノードが存在するまで）
 *
 * @param serviceWorker - Service Worker
 * @param options - ポーリングオプション
 */
export async function waitForTreeStateInitialized(
  serviceWorker: Worker,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = DEFAULT_TIMEOUT,
    interval = 100,
    timeoutMessage = 'Timeout waiting for tree state to be initialized',
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('tree_state');
        // 新しいTreeState構造: views は Record<string, ViewState>
        const treeState = result.tree_state as
          | { views?: Record<string, unknown> }
          | undefined;
        if (treeState?.views && Object.keys(treeState.views).length > 0) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
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
    timeoutMessage = 'Timeout waiting for page condition to be met',
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await page.evaluate(
    async ({ conditionFnStr, args, iterations, interval }) => {
      const fn = eval(`(${conditionFnStr})`);
      for (let i = 0; i < iterations; i++) {
        if (await fn(args)) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { conditionFnStr, args, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
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
    timeoutMessage = 'Timeout waiting for side panel to be ready',
  } = options;

  await page.waitForSelector('[data-testid="side-panel-root"]', { timeout });

  try {
    await page.waitForSelector('text=Loading', {
      state: 'hidden',
      timeout: 5000,
    });
  } catch {
    // ローディング表示がない場合は無視
  }

  const iterations = Math.ceil(timeout / interval);
  const result = await serviceWorker.evaluate(
    async ({ iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const result = await chrome.storage.local.get('tree_state');
        // 新しいTreeState構造: views は Record<string, ViewState>
        const treeState = result.tree_state as
          | { views?: Record<string, unknown> }
          | undefined;
        if (treeState?.views && Object.keys(treeState.views).length > 0) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
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
    timeoutMessage = `Timeout waiting for message "${messageType}" to be received`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await page.evaluate(
    async ({ messageType, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const messages = window.receivedMessages;
        if (messages && messages.some((msg) => msg.type === messageType)) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { messageType, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
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
    timeoutMessage = `Timeout waiting for counter "${counterName}" to increase from ${initialValue}`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await page.evaluate(
    async ({ counterName, initialValue, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const count =
          counterName === 'stateUpdateCount'
            ? window.stateUpdateCount
            : counterName === 'receivedCount'
              ? window.receivedCount
              : undefined;
        if (count !== undefined && count > initialValue) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
      }
      return { success: false };
    },
    { counterName, initialValue, iterations, interval }
  );

  if (!result.success) {
    throw new Error(timeoutMessage);
  }
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
    await page.waitForSelector('text=Loading', {
      state: 'hidden',
      timeout: 5000,
    });
  } catch {
    // ローディング表示がない場合は無視
  }

  await page.waitForSelector('[data-testid="view-switcher-container"]', {
    timeout,
  });
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
  const result = await serviceWorker.evaluate(
    async ({ id, urlPart, maxWait }) => {
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait) {
        const tab = await chrome.tabs.get(id);
        if (tab.url && tab.url.includes(urlPart)) {
          return { success: true, tab };
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      const finalTab = await chrome.tabs.get(id);
      return { success: false, tab: finalTab };
    },
    { id: tabId, urlPart: expectedUrlPart, maxWait: timeout }
  );

  if (!result.success) {
    throw new Error(
      `waitForTabUrlLoaded: Timeout waiting for tab ${tabId} URL to contain "${expectedUrlPart}". ` +
        `Current URL: "${result.tab.url}", pendingUrl: "${result.tab.pendingUrl}"`
    );
  }
  return result.tab;
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
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete') {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
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
 * タブが休止（discarded）状態になるまで待機
 *
 * @param serviceWorker - Service Worker
 * @param tabId - 待機するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabDiscarded(
  serviceWorker: Worker,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 10000,
    interval = 100,
    timeoutMessage = `Tab ${tabId} was not discarded`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ tabId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.discarded === true) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
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
 * タブが休止状態から復帰するまで待機
 *
 * @param serviceWorker - Service Worker
 * @param tabId - 待機するタブのID
 * @param options - ポーリングオプション
 */
export async function waitForTabNotDiscarded(
  serviceWorker: Worker,
  tabId: number,
  options: PollingOptions = {}
): Promise<void> {
  const {
    timeout = 10000,
    interval = 100,
    timeoutMessage = `Tab ${tabId} was not un-discarded`,
  } = options;

  const iterations = Math.ceil(timeout / interval);

  const result = await serviceWorker.evaluate(
    async ({ tabId, iterations, interval }) => {
      for (let i = 0; i < iterations; i++) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.discarded === false) {
          return { success: true };
        }
        await new Promise((resolve) => setTimeout(resolve, interval));
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
    const result = await conditionFn();
    if (result) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }

  throw new Error(timeoutMessage);
}
