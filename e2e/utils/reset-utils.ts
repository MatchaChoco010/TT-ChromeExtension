import type { BrowserContext, Worker } from '@playwright/test';
import { waitForWindowClosed } from './polling-utils';

/**
 * Service Worker evaluateをタイムアウト付きで実行する
 *
 * 任意の引数を渡せる必要があるため、anyを使用する
 */
async function evaluateWithTimeout<T>(
  serviceWorker: Worker,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fn: (() => Promise<T>) | ((arg: any) => Promise<T>),
  timeoutMs: number,
  stepName: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  arg?: any
): Promise<T> {
  const evaluatePromise = arg !== undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ? serviceWorker.evaluate(fn as (arg: any) => Promise<T>, arg)
    : serviceWorker.evaluate(fn as () => Promise<T>);

  const result = await Promise.race([
    evaluatePromise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Step "${stepName}" timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
  return result as T;
}

/**
 * テスト間で拡張機能の状態をリセットする
 *
 * sidePanelPageは作成せず、クリーンアップ処理のみを行う。
 * リセット後の状態: 1ウィンドウ、initialTabのみ（sidePanelTabなし）
 *
 * 各テストはsetupWindow()を呼び出してsidePanelPageを作成する。
 */
export async function resetExtensionState(
  serviceWorker: Worker,
  _extensionContext: BrowserContext
): Promise<void> {
  // Step 1: 前のテストからのリセット準備（ハンドラー待機）
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const g = globalThis as unknown as { prepareForReset: () => Promise<void> };
      await g.prepareForReset();
    },
    10000,
    'prepareForReset'
  );

  // Step 2: ストレージをクリア
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      await chrome.storage.local.clear();

      if (chrome.storage.session) {
        await chrome.storage.session.clear();
      }
    },
    10000,
    'clearStorage'
  );

  // Step 3: メモリ上の状態をクリア
  // prepareForSyncReset()を使用して同期待機中のウェイターを解決し、
  // 同期フラグを適切にリセットする
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      // TreeStateManagerの新構造に対応
      // views: Map<string, ViewState>（内部はMap）、viewOrder: string[]
      const treeStateManager = (globalThis as unknown as { treeStateManager?: {
        tabToNode: Map<unknown, unknown>;
        views: Map<string, unknown>;
        viewOrder: string[];
        currentViewId: string;
        prepareForSyncReset: () => void;
      } }).treeStateManager;
      if (treeStateManager) {
        treeStateManager.tabToNode.clear();
        treeStateManager.views.clear();
        treeStateManager.viewOrder = [];
        treeStateManager.currentViewId = 'default';
        treeStateManager.prepareForSyncReset();
      }

      const g = globalThis as unknown as { pendingTabParents?: Map<unknown, unknown>; pendingDuplicateSources?: Map<unknown, unknown>; pendingGroupTabIds?: Map<unknown, unknown>; pendingLinkClicks?: Map<unknown, unknown>; clearTabCreationLogs?: () => void };
      g.pendingTabParents?.clear();
      g.pendingDuplicateSources?.clear();
      g.pendingGroupTabIds?.clear();
      g.pendingLinkClicks?.clear();
      g.clearTabCreationLogs?.();
    },
    10000,
    'clearMemoryState'
  );

  // Step 4: 新しいクリーンなウィンドウを作成
  // 前のテストの状態が残らないよう、完全に新しいウィンドウを作成する
  const newWindowId = await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const newWindow = await chrome.windows.create({ focused: true });
      return newWindow.id!;
    },
    10000,
    'createCleanWindow'
  );

  // Step 5: 新しいウィンドウ以外のすべてのウィンドウを閉じる
  const windowsToClose = await evaluateWithTimeout(
    serviceWorker,
    async (keepWindowId: number) => {
      const windows = await chrome.windows.getAll();
      const closeIds: number[] = [];
      for (const window of windows) {
        if (window.id !== keepWindowId) {
          closeIds.push(window.id!);
          try {
            await chrome.windows.remove(window.id!);
          } catch {
            // ウィンドウが既に閉じられている場合は正常動作
          }
        }
      }
      return closeIds;
    },
    10000,
    'closeOtherWindows',
    newWindowId
  );

  // 閉じたウィンドウが実際に閉じられたことを確認
  for (const windowId of windowsToClose) {
    await waitForWindowClosed(serviceWorker, windowId, { timeout: 5000 });
  }

  // Step 6: タブ・ウィンドウ削除のハンドラー完了を待機
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const g = globalThis as unknown as { prepareForReset: () => Promise<void> };
      await g.prepareForReset();
    },
    10000,
    'prepareForReset2'
  );

  // Step 7: デフォルト設定を書き込む
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      await chrome.storage.local.set({
        user_settings: {
          fontSize: 14,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          customCSS: '',
          newTabPosition: 'end',
          newTabPositionManual: 'end',
          newTabPositionFromLink: 'child',
          duplicateTabPosition: 'sibling',
          closeWarningThreshold: 10,
          showUnreadIndicator: true,
          autoSnapshotInterval: 0,
          childTabBehavior: 'promote',
        },
      });
    },
    10000,
    'setDefaultSettings'
  );

  // Step 8: tree_stateにデフォルトのviewsを明示的に設定
  // 新しいTreeState構造: views は Record<string, ViewState>
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const defaultViewInfo = {
        id: 'default',
        name: 'Default',
        color: '#3B82F6',
      };
      await chrome.storage.local.set({
        tree_state: {
          views: {
            'default': {
              info: defaultViewInfo,
              rootNodeIds: [],
              nodes: {},
            },
          },
          viewOrder: ['default'],
          currentViewId: 'default',
          tabToNode: {},
          treeStructure: [],
        },
      });
    },
    10000,
    'setDefaultTreeState'
  );

  // Step 9: Chromeタブと同期
  // prepareForSyncReset()を使用して同期状態を適切にリセットする:
  // 1. 前のテストからの古いウェイターを解決（タイムアウト防止）
  // 2. syncCompletedResolversをクリア
  // 3. syncCompleted/syncInProgressをfalseにリセット
  // これにより、次のsyncWithChromeTabsが確実に実行される
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const treeStateManager = (globalThis as unknown as { treeStateManager?: { prepareForSyncReset: () => void; syncWithChromeTabs: () => Promise<void> } }).treeStateManager;
      if (treeStateManager) {
        treeStateManager.prepareForSyncReset();
        await treeStateManager.syncWithChromeTabs();
      }
    },
    10000,
    'syncWithChromeTabs'
  );

  // Step 10: syncCompletedがtrueであることを検証
  // syncWithChromeTabsが正常に完了していれば、syncCompleted = trueになる
  // これがfalseの場合、handleTabCreatedがwaitForSyncCompleteでブロックされる
  const syncStatus = await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const treeStateManager = (globalThis as unknown as { treeStateManager?: { isSyncCompleted: () => boolean; isSyncInProgress: () => boolean } }).treeStateManager;
      return {
        syncCompleted: treeStateManager?.isSyncCompleted() ?? false,
        syncInProgress: treeStateManager?.isSyncInProgress() ?? false,
      };
    },
    5000,
    'verifySyncCompleted'
  );

  if (!syncStatus.syncCompleted) {
    throw new Error(
      `Reset failed: syncCompleted is false after syncWithChromeTabs. ` +
      `syncInProgress: ${syncStatus.syncInProgress}. ` +
      `This will cause handleTabCreated to timeout waiting for sync.`
    );
  }

  // Step 11: リセット後の状態を検証（新しいウィンドウのタブのみ存在すること）
  const remainingTabCount = await serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.length;
  });

  if (remainingTabCount !== 1) {
    throw new Error(
      `Reset failed: Expected 1 tab after reset, but found ${remainingTabCount} tabs`
    );
  }
}
