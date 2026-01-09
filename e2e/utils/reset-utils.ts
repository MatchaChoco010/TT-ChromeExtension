import type { BrowserContext, Page, Worker } from '@playwright/test';

/**
 * Service Worker evaluateをタイムアウト付きで実行する
 *
 * 任意の引数を渡せる必要があるため、anyを使用する
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
 * 前のテストの非同期イベントハンドラーが完了してからリセット処理を開始する
 */
export async function resetExtensionState(
  serviceWorker: Worker,
  _extensionContext: BrowserContext,
  sidePanelPage: Page
): Promise<void> {
  // Step 0: コンテキストの有効性チェック
  if (sidePanelPage.isClosed()) {
    throw new Error(
      'Reset aborted: sidePanelPage is already closed. ' +
      'The browser context may have been corrupted by a previous test.'
    );
  }

  // Step 1: 前のテストからのリセット準備（ハンドラー待機 + IndexedDB接続クローズ）
  // prepareForReset()は以下を行う:
  // - 非同期イベントハンドラーの完了待機
  // - IndexedDBのキャッシュ接続を閉じる（deleteDatabase()のブロックを防ぐ）
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const g = globalThis as unknown as { prepareForReset: () => Promise<void> };
      await g.prepareForReset();
    },
    10000,
    'prepareForReset'
  );

  // Step 2: sidePanelTabのIDを取得
  const sidePanelTabId = await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const extensionId = chrome.runtime.id;
      const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
      const tabs = await chrome.tabs.query({});
      const sidePanelTab = tabs.find(tab => {
        const url = tab.url || tab.pendingUrl || '';
        return url.startsWith(sidePanelUrlPrefix);
      });
      if (!sidePanelTab?.id) {
        throw new Error('Side panel tab not found');
      }
      return sidePanelTab.id;
    },
    10000,
    'getSidePanelTabId'
  );

  // Step 3: ストレージをクリア
  // 注: IndexedDB接続はStep 1のprepareForReset()で既に閉じられている
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      await chrome.storage.local.clear();

      if (chrome.storage.session) {
        await chrome.storage.session.clear();
      }

      // IndexedDBを削除（短いタイムアウト付き）
      // 接続はprepareForReset()で閉じられているため、ブロックされない
      await new Promise<void>((resolve) => {
        const deleteRequest = indexedDB.deleteDatabase('vivaldi-tt-snapshots');
        const timeoutId = setTimeout(() => {
          // 5秒でブロックされたままなら諦めて続行
          resolve();
        }, 5000);
        deleteRequest.onsuccess = () => {
          clearTimeout(timeoutId);
          resolve();
        };
        deleteRequest.onerror = () => {
          clearTimeout(timeoutId);
          resolve();
        };
        deleteRequest.onblocked = () => {
          // ブロックされた場合はタイムアウトを待つ
        };
      });
    },
    15000,
    'clearStorage'
  );

  // Step 4: メモリ上の状態をクリア
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const treeStateManager = (globalThis as unknown as { treeStateManager?: { nodes: Map<unknown, unknown>; tabToNode: Map<unknown, unknown>; views: Map<string, unknown[]>; expandedNodes: Set<unknown>; currentViewId: string } }).treeStateManager;
      if (treeStateManager) {
        treeStateManager.nodes.clear();
        treeStateManager.tabToNode.clear();
        treeStateManager.views.clear();
        treeStateManager.expandedNodes.clear();
        treeStateManager.views.set('default', []);
        treeStateManager.currentViewId = 'default';
      }

      // pending系Mapのクリア
      const g = globalThis as unknown as { pendingTabParents?: Map<unknown, unknown>; pendingDuplicateSources?: Map<unknown, unknown>; pendingGroupTabIds?: Map<unknown, unknown>; pendingLinkClicks?: Map<unknown, unknown> };
      g.pendingTabParents?.clear();
      g.pendingDuplicateSources?.clear();
      g.pendingGroupTabIds?.clear();
      g.pendingLinkClicks?.clear();
    },
    10000,
    'clearMemoryState'
  );

  // Step 5: 新しいウィンドウを作成
  const newWindowId = await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const newWindow = await chrome.windows.create({ focused: true });
      return newWindow.id!;
    },
    10000,
    'createWindow'
  );

  // Step 6: sidePanelTabを新しいウィンドウに移動
  await evaluateWithTimeout(
    serviceWorker,
    async (params: { tabId: number; windowId: number }) => {
      await chrome.tabs.move(params.tabId, { windowId: params.windowId, index: 0 });
    },
    10000,
    'moveTabToNewWindow',
    { tabId: sidePanelTabId, windowId: newWindowId }
  );

  // Step 7: 新しいウィンドウ以外のウィンドウをすべて閉じる
  await evaluateWithTimeout(
    serviceWorker,
    async (keepWindowId: number) => {
      const windows = await chrome.windows.getAll();
      for (const window of windows) {
        if (window.id !== keepWindowId) {
          try {
            await chrome.windows.remove(window.id!);
          } catch {
            // ウィンドウが既に閉じられている場合は正常動作
          }
        }
      }
    },
    10000,
    'closeOtherWindows',
    newWindowId
  );

  // Step 8: sidePanelTab以外のタブを閉じる
  await evaluateWithTimeout(
    serviceWorker,
    async (keepTabId: number) => {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.id !== keepTabId) {
          try {
            await chrome.tabs.remove(tab.id!);
          } catch {
            // タブが既に閉じられている場合は正常動作
          }
        }
      }
    },
    10000,
    'closeOtherTabs',
    sidePanelTabId
  );

  // Step 9: タブ・ウィンドウ削除のハンドラー完了を待機
  // prepareForReset()を再度呼び出して、削除操作のハンドラー完了を待機
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const g = globalThis as unknown as { prepareForReset: () => Promise<void> };
      await g.prepareForReset();
    },
    10000,
    'prepareForReset2'
  );

  // Step 10: デフォルト設定を書き込む
  // 本番コードのデフォルト値と一致させる必要がある
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

  // Step 11: tree_stateにデフォルトのviewsを明示的に設定
  // 色は TreeStateProvider.tsx の getDefaultViews() と一致させる（#3B82F6）
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const defaultView = {
        id: 'default',
        name: 'Default',
        color: '#3B82F6',
      };
      await chrome.storage.local.set({
        tree_state: {
          views: [defaultView],
          currentViewId: 'default',
          nodes: {},
          tabToNode: {},
          treeStructure: [],
        },
      });
    },
    10000,
    'setDefaultTreeState'
  );

  // Step 12: Chromeタブと同期
  await evaluateWithTimeout(
    serviceWorker,
    async () => {
      const treeStateManager = (globalThis as unknown as { treeStateManager?: { syncWithChromeTabs: () => Promise<void> } }).treeStateManager;
      if (treeStateManager) {
        await treeStateManager.syncWithChromeTabs();
      }
    },
    10000,
    'syncWithChromeTabs'
  );

  // Step 13: タブレベルの状態をクリアするためにabout:blankにナビゲート
  await sidePanelPage.goto('about:blank');
  await sidePanelPage.waitForLoadState('domcontentloaded');

  // Step 14: 新しいウィンドウのsidepanel URLにナビゲート（Reactを完全に新規マウント）
  const extensionId = await serviceWorker.evaluate(() => chrome.runtime.id);
  await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${newWindowId}`);
  await sidePanelPage.waitForLoadState('domcontentloaded');

  // Step 15: sidePanelのルート要素が表示されるまで待機
  await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 5000 });

  // Step 16: ツリー状態が初期化されるまでポーリングで待機
  await serviceWorker.evaluate(async () => {
    for (let i = 0; i < 50; i++) {
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as { nodes?: Record<string, unknown> } | undefined;
      if (treeState?.nodes && Object.keys(treeState.nodes).length > 0) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  });

  // Step 17: UIに同期を通知
  await serviceWorker.evaluate(async () => {
    await new Promise<void>((resolve) => {
      chrome.runtime.sendMessage({ type: 'SYNC_TABS' }, () => resolve());
    });
  });

  // Step 18: リセット後の状態を検証（sidePanelタブのみ存在すること）
  const remainingTabCount = await serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.length;
  });

  if (remainingTabCount !== 1) {
    throw new Error(
      `Reset failed: Expected 1 tab after reset, but found ${remainingTabCount} tabs`
    );
  }

  // Step 19: UIが正しい状態になるまでポーリングで待機（tree-node要素が1つになるまで）
  const startTime = Date.now();
  const timeout = 5000;
  while (Date.now() - startTime < timeout) {
    const treeNodeCount = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();
    if (treeNodeCount === 1) {
      break;
    }
    await sidePanelPage.waitForTimeout(50);
  }

  // 最終確認
  const finalTreeNodeCount = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();
  if (finalTreeNodeCount !== 1) {
    throw new Error(
      `Reset failed: Expected 1 tree node in UI after reset, but found ${finalTreeNodeCount} tree nodes`
    );
  }
}
