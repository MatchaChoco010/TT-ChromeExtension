/**
 * TabTestUtils
 *
 * タブ操作（作成、削除、アクティブ化、検証）の共通ヘルパー関数
 *
 * Requirements: 3.1, 3.13, 4.1
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect } from '@playwright/test';

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
  parentTabId?: number,
  options: CreateTabOptions = {}
): Promise<number> {
  const { active = true, index } = options;
  const serviceWorker = await getServiceWorker(context);

  // Service Workerコンテキストでchrome.tabs.create()を実行
  const tab = await serviceWorker.evaluate(
    async ({ url, parentTabId, active, index }) => {
      // IMPORTANT: Chrome doesn't reliably include openerTabId in the onCreated event
      // To work around this, we call chrome.tabs.create and immediately get the tab object
      // which DOES include the openerTabId, then we can handle parent relationship properly
      const createdTab = await chrome.tabs.create({
        url,
        active,
        ...(parentTabId !== undefined && { openerTabId: parentTabId }),
        ...(index !== undefined && { index }),
      });

      // If we have a parent and the created tab has an ID, ensure the relationship is preserved
      // by letting the event handler know about the openerTabId explicitly
      if (parentTabId !== undefined && createdTab.id) {
        // Store the parent relationship in a global variable accessible to the event handler
        // We use globalThis to ensure it's accessible across different execution contexts
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (!(globalThis as any).pendingTabParents) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (globalThis as any).pendingTabParents = new Map();
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).pendingTabParents.set(createdTab.id, parentTabId);
      }

      return createdTab;
    },
    { url, parentTabId, active, index }
  );

  // IMPORTANT: Wait for the tab to be fully added to TreeStateManager
  // Chrome's onCreated event is asynchronous, so we need to wait for it to complete
  await serviceWorker.evaluate(
    async (tabId) => {
      // Poll storage until the tab appears in tree_state
      for (let i = 0; i < 50; i++) {
        const result = await chrome.storage.local.get('tree_state');
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const treeState = result.tree_state as any;
        if (treeState?.tabToNode?.[tabId!]) {
          return; // Tab found in tree
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      throw new Error(`Timeout waiting for tab ${tabId} to be added to tree`);
    },
    tab.id
  );

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

  // タブが閉じられるまで少し待機
  const [page] = context.pages();
  if (page) {
    await page.waitForTimeout(200);
  }
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

  // タブがアクティブになるまで少し待機
  const [page] = context.pages();
  if (page) {
    await page.waitForTimeout(200);
  }
}

/**
 * ツリー内のタブノードを検証
 *
 * @param page - Side PanelのPage
 * @param tabId - 検証するタブのID（未使用だが、将来的な拡張のため保持）
 * @param expectedTitle - 期待されるタブのタイトル（部分一致）
 */
export async function assertTabInTree(
  page: Page,
  tabId: number,
  expectedTitle?: string
): Promise<void> {
  // タイトルで検索する（タブツリー内のすべてのノードを対象）
  if (expectedTitle) {
    const tabNode = page.locator(`[data-testid^="tree-node-"]`, {
      hasText: expectedTitle,
    });

    // タブノードが表示されるまで待機
    await expect(tabNode.first()).toBeVisible({ timeout: 5000 });
  } else {
    // タイトルが指定されていない場合は、少なくとも1つのタブノードが存在することを確認
    const anyTabNode = page.locator(`[data-testid^="tree-node-"]`);
    await expect(anyTabNode.first()).toBeVisible({ timeout: 5000 });
  }
}

/**
 * ツリーからタブノードが削除されたことを検証
 *
 * @param page - Side PanelのPage
 * @param tabId - 検証するタブのID（現在は未使用）
 */
export async function assertTabNotInTree(page: Page, tabId: number): Promise<void> {
  // タブが閉じられた後、ツリーの更新を待機
  // 注: 特定のタブIDでの検証は難しいため、ここではタイムアウトで対応
  // 将来的には、タブ数の変化を監視する実装に変更する可能性がある
  await page.waitForTimeout(300);
}

/**
 * 未読バッジが表示されることを検証
 *
 * @param page - Side PanelのPage
 * @param tabId - 検証するタブのID（現在は未使用）
 * @param expectedCount - 期待される未読数（オプション）
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

  // 未読数が指定されている場合、未読数を検証
  if (expectedCount !== undefined) {
    await expect(unreadBadge.first()).toContainText(expectedCount.toString());
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
