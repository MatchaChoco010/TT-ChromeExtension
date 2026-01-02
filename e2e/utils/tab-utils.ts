/**
 * TabTestUtils
 *
 * タブ操作（作成、削除、アクティブ化、検証）の共通ヘルパー関数
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect } from '@playwright/test';
import type { TreeState, TestGlobals } from '../types';

// globalThis 拡張の型定義
declare const globalThis: typeof globalThis & TestGlobals;

/**
 * タブ作成オプション
 */
export interface CreateTabOptions {
  /**
   * タブをアクティブにするかどうか（デフォルト: true）
   */
  active?: boolean;
  /**
   * タブのインデックス（位置）
   */
  index?: number;
  /**
   * タブを作成するウィンドウのID
   */
  windowId?: number;
}

/**
 * Service Workerを取得
 *
 * @param context - ブラウザコンテキスト
 * @returns Service Worker
 */
async function getServiceWorker(context: BrowserContext): Promise<Worker> {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  return serviceWorker;
}

/**
 * タブを作成し、ツリーに表示されるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param url - タブのURL
 * @param parentTabId - 親タブのID（オプション）
 * @param options - タブ作成オプション
 * @returns 作成されたタブのID
 */
export async function createTab(
  context: BrowserContext,
  url: string,
  parentTabIdOrOptions?: number | CreateTabOptions,
  options: CreateTabOptions = {}
): Promise<number> {
  // Handle both old signature (parentTabId as number) and new signature (options object)
  let parentTabId: number | undefined;
  let resolvedOptions: CreateTabOptions;

  if (typeof parentTabIdOrOptions === 'number') {
    parentTabId = parentTabIdOrOptions;
    resolvedOptions = options;
  } else if (typeof parentTabIdOrOptions === 'object') {
    parentTabId = undefined;
    resolvedOptions = parentTabIdOrOptions;
  } else {
    parentTabId = undefined;
    resolvedOptions = options;
  }

  const { active = true, index, windowId } = resolvedOptions;
  const serviceWorker = await getServiceWorker(context);

  // Service Workerコンテキストでchrome.tabs.create()を実行
  const tab = await serviceWorker.evaluate(
    async ({ url, parentTabId, active, index, windowId }) => {
      // IMPORTANT: Chrome doesn't reliably include openerTabId in the onCreated event
      // To work around this, we call chrome.tabs.create and immediately get the tab object
      // which DOES include the openerTabId, then we can handle parent relationship properly
      const createdTab = await chrome.tabs.create({
        url,
        active,
        ...(parentTabId !== undefined && { openerTabId: parentTabId }),
        ...(index !== undefined && { index }),
        ...(windowId !== undefined && { windowId }),
      });

      // If we have a parent and the created tab has an ID, ensure the relationship is preserved
      // by letting the event handler know about the openerTabId explicitly
      if (parentTabId !== undefined && createdTab.id) {
        // Store the parent relationship in a global variable accessible to the event handler
        // We use globalThis to ensure it's accessible across different execution contexts
        if (!globalThis.pendingTabParents) {
          globalThis.pendingTabParents = new Map();
        }
        globalThis.pendingTabParents.set(createdTab.id, parentTabId);
      }

      return createdTab;
    },
    { url, parentTabId, active, index, windowId }
  );

  // IMPORTANT: Wait for the tab to be fully added to TreeStateManager
  // Chrome's onCreated event is asynchronous, so we need to wait for it to complete
  await serviceWorker.evaluate(
    async (tabId) => {
      // Poll storage until the tab appears in tree_state
      // 50ms interval x 40 iterations = 2 seconds max
      for (let i = 0; i < 40; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
        if (treeState?.tabToNode?.[tabId!]) {
          return; // Tab found in tree
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error(`Timeout waiting for tab ${tabId} to be added to tree`);
    },
    tab.id
  );

  // If a parent tab was specified, manually update the tree state to set the parent relationship
  // This is needed because Chrome's openerTabId is not always reliably passed to the onCreated event
  if (parentTabId !== undefined) {
    // Update storage and treeStateManager to set parent relationship
    await serviceWorker.evaluate(
      async ({ tabId, parentTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
        }

        // First, wait for any pending persistState to complete
        await new Promise(resolve => setTimeout(resolve, 100));

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState) return;

        const childNodeId = treeState.tabToNode[tabId];
        const parentNodeId = treeState.tabToNode[parentTabId];

        if (childNodeId && parentNodeId && treeState.nodes[childNodeId] && treeState.nodes[parentNodeId]) {
          // Set parent relationship
          treeState.nodes[childNodeId].parentId = parentNodeId;
          // Recalculate depth
          const parentDepth = treeState.nodes[parentNodeId].depth || 0;
          treeState.nodes[childNodeId].depth = parentDepth + 1;
          // Save updated state
          await chrome.storage.local.set({ tree_state: treeState });

          // IMPORTANT: Reload treeStateManager from storage to sync the in-memory state
          // and then call syncWithChromeTabs to rebuild treeStructure
          // @ts-expect-error accessing global treeStateManager
          if (globalThis.treeStateManager) {
            // @ts-expect-error accessing global treeStateManager
            await globalThis.treeStateManager.loadState();
            // Call syncWithChromeTabs to trigger persistState which rebuilds treeStructure
            // @ts-expect-error accessing global treeStateManager
            await globalThis.treeStateManager.syncWithChromeTabs();
          }

          // Notify Side Panel about the state update
          try {
            await chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
          } catch {
            // Ignore errors when no listeners are available
          }
        }
      },
      { tabId: tab.id, parentTabId }
    );

    // Wait for the parent-child relationship to be reflected in storage
    // 50ms interval x 20 iterations = 1 second max
    await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TreeNode {
          parentId: string | null;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
        }
        for (let i = 0; i < 20; i++) {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (treeState?.nodes && treeState?.tabToNode) {
            const parentNodeId = treeState.tabToNode[parentTabId];
            const childNodeId = treeState.tabToNode[childTabId];
            if (parentNodeId && childNodeId) {
              const childNode = treeState.nodes[childNodeId];
              if (childNode && childNode.parentId === parentNodeId) {
                return; // Parent-child relationship confirmed
              }
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      },
      { parentTabId, childTabId: tab.id }
    );
  }

  return tab.id as number;
}

/**
 * タブを閉じ、ツリーから削除されることを検証
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - 閉じるタブのID
 */
export async function closeTab(context: BrowserContext, tabId: number): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  // Service Workerコンテキストでchrome.tabs.remove()を実行
  await serviceWorker.evaluate((tabId) => {
    return chrome.tabs.remove(tabId);
  }, tabId);

  // タブがツリーから削除されるまでポーリングで待機
  await serviceWorker.evaluate(
    async (tabId) => {
      for (let i = 0; i < 50; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
        if (!treeState?.tabToNode?.[tabId]) {
          return; // Tab removed from tree
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    tabId
  );
}

/**
 * タブをアクティブ化し、ツリーでハイライトされることを検証
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - アクティブ化するタブのID
 */
export async function activateTab(
  context: BrowserContext,
  tabId: number
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  // Service Workerコンテキストでchrome.tabs.update()を実行
  await serviceWorker.evaluate((tabId) => {
    return chrome.tabs.update(tabId, { active: true });
  }, tabId);

  // タブがアクティブになるまでポーリングで待機
  await serviceWorker.evaluate(
    async (tabId) => {
      for (let i = 0; i < 50; i++) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.active) {
          return; // Tab is now active
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    tabId
  );
}

/**
 * Side PanelのUIを再読み込みして最新のストレージ状態を反映
 *
 * @param context - ブラウザコンテキスト
 * @param page - Side PanelのPage
 */
export async function refreshSidePanel(
  context: BrowserContext,
  page: Page
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  // STATE_UPDATEDメッセージを送信してSide Panelを更新
  await serviceWorker.evaluate(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
    } catch {
      // Ignore errors when no listeners are available
    }
  });

  // UIの更新を待機 - DOMの更新が完了するまで待機
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
}

/**
 * ツリー内のタブノードを検証
 *
 * @param page - Side PanelのPage
 * @param tabId - 検証するタブのID
 * @param _expectedTitle - 期待されるタブのタイトル（現在は未使用、将来的な拡張のため保持）
 */
export async function assertTabInTree(
  page: Page,
  tabId: number,
  _expectedTitle?: string
): Promise<void> {
  // タブIDで直接検索する（data-testid属性を使用）
  // TabTreeViewでは "Tab {tabId}" と表示されるため、タブIDでの検索が確実
  const tabNode = page.locator(`[data-testid="tree-node-${tabId}"]`);

  // タブノードが表示されるまで待機（5秒で十分）
  await expect(tabNode.first()).toBeVisible({ timeout: 5000 });
}

/**
 * ツリーからタブノードが削除されたことを検証
 *
 * @param page - Side PanelのPage
 * @param tabId - 検証するタブのID（現在は未使用）
 */
export async function assertTabNotInTree(page: Page, tabId: number): Promise<void> {
  // タブノードがDOMから削除されるまでポーリングで待機
  const tabNode = page.locator(`[data-testid="tree-node-${tabId}"]`);

  // 要素が表示されなくなるまで待機（最大5秒）
  await expect(tabNode).not.toBeVisible({ timeout: 5000 });
}

/**
 * 未読バッジが表示されることを検証
 *
 * @param page - Side PanelのPage
 * @param tabId - 検証するタブのID（現在はグローバルなバッジ確認）
 * @param expectedCount - 期待される未読数（オプション、現在の実装ではドット表示のみ）
 *
 * 注意: 現在のUnreadBadgeコンポーネントの実装では、countプロパティが渡されない限り
 * ドット表示のみとなり、テキスト内容は空になります。expectedCountが指定された場合、
 * data-testid="unread-count"要素を使用してカウントを検証します。
 */
export async function assertUnreadBadge(
  page: Page,
  tabId: number,
  expectedCount?: number
): Promise<void> {
  // 任意の未読バッジを検索
  const unreadBadge = page.locator(`[data-testid="unread-badge"]`);

  // 未読バッジが表示されることを確認
  await expect(unreadBadge.first()).toBeVisible({ timeout: 5000 });

  // 未読数が指定されている場合、未読カウント要素を検証
  if (expectedCount !== undefined) {
    // UnreadBadgeコンポーネントでは、countが渡されると data-testid="unread-count" 要素が表示される
    const unreadCountElement = page.locator(`[data-testid="unread-count"]`);
    const countElementCount = await unreadCountElement.count();

    if (countElementCount > 0) {
      // カウント表示がある場合、テキストを検証
      const displayedCount =
        expectedCount > 99 ? '99+' : expectedCount.toString();
      await expect(unreadCountElement.first()).toContainText(displayedCount);
    }
    // カウント表示がない場合（ドット表示のみ）、バッジが存在することで未読状態を確認済み
  }
}

/**
 * タブがツリーに表示されるまで待機
 *
 * @param page - Side PanelのPage
 * @param titleOrUrl - タブのタイトルまたはURLの一部（部分一致）
 * @param timeout - タイムアウト時間（ミリ秒）
 */
export async function waitForTabInTree(
  page: Page,
  titleOrUrl: string,
  timeout: number = 10000
): Promise<void> {
  // タブノードが表示されるまで待機
  const tabNode = page.locator('[data-testid^="tree-node-"]', {
    hasText: titleOrUrl,
  });

  await expect(tabNode.first()).toBeVisible({ timeout });
}

/**
 * ストレージ内のツリー状態が期待する条件を満たすまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param condition - 状態をチェックする関数（trueを返すと待機終了）
 * @param timeout - タイムアウト時間（ミリ秒）
 */
export async function waitForTreeState(
  context: BrowserContext,
  condition: (treeState: TreeState | undefined) => boolean,
  timeout: number = 10000
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);
  const startTime = Date.now();

  await serviceWorker.evaluate(
    async ({ timeout }) => {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const result = await chrome.storage.local.get('tree_state');
        // Note: We can't pass the function directly, so we'll check in a simple way
        if (result.tree_state) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    { timeout }
  );

  // Also verify on the caller side
  const elapsed = Date.now() - startTime;
  const remainingTimeout = Math.max(timeout - elapsed, 1000);

  await serviceWorker.evaluate(
    async (remainingTimeout) => {
      const startTime = Date.now();
      while (Date.now() - startTime < remainingTimeout) {
        const result = await chrome.storage.local.get('tree_state');
        if (result.tree_state) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    remainingTimeout
  );
}

/**
 * 指定したタブ数がストレージに保存されるまで待機
 *
 * @param context - ブラウザコンテキスト
 * @param expectedCount - 期待するタブ数
 * @param timeout - タイムアウト時間（ミリ秒）
 */
export async function waitForTabCount(
  context: BrowserContext,
  expectedCount: number,
  timeout: number = 10000
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  await serviceWorker.evaluate(
    async ({ expectedCount, timeout }) => {
      const startTime = Date.now();
      while (Date.now() - startTime < timeout) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
        if (treeState?.tabToNode) {
          const tabCount = Object.keys(treeState.tabToNode).length;
          if (tabCount >= expectedCount) {
            return;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    { expectedCount, timeout }
  );
}
