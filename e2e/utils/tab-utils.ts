/**
 * TabTestUtils
 *
 * タブ操作（作成、削除、アクティブ化、検証）の共通ヘルパー関数
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';
import type { TestGlobals } from '../types';

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
 * タブをピン留めする
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - ピン留めするタブのID
 */
export async function pinTab(context: BrowserContext, tabId: number): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  await serviceWorker.evaluate(async (id) => {
    await chrome.tabs.update(id, { pinned: true });
  }, tabId);

  // ピン留め状態が反映されるまでポーリングで待機
  await serviceWorker.evaluate(
    async (id) => {
      for (let i = 0; i < 50; i++) {
        const tab = await chrome.tabs.get(id);
        if (tab.pinned) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    tabId
  );
}

/**
 * タブのピン留めを解除する
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - ピン留め解除するタブのID
 */
export async function unpinTab(context: BrowserContext, tabId: number): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  await serviceWorker.evaluate(async (id) => {
    await chrome.tabs.update(id, { pinned: false });
  }, tabId);

  // ピン留め解除が反映されるまでポーリングで待機
  await serviceWorker.evaluate(
    async (id) => {
      for (let i = 0; i < 50; i++) {
        const tab = await chrome.tabs.get(id);
        if (!tab.pinned) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    tabId
  );
}

/**
 * タブのURLを更新する
 *
 * @param context - ブラウザコンテキスト
 * @param tabId - 更新するタブのID
 * @param url - 新しいURL
 */
export async function updateTabUrl(context: BrowserContext, tabId: number, url: string): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  await serviceWorker.evaluate(async ({ id, newUrl }) => {
    await chrome.tabs.update(id, { url: newUrl });
  }, { id: tabId, newUrl: url });

  // URL更新が反映されるまでポーリングで待機
  await serviceWorker.evaluate(
    async ({ id, expectedUrl }) => {
      for (let i = 0; i < 100; i++) {
        const tab = await chrome.tabs.get(id);
        if (tab.url?.includes(expectedUrl) || tab.pendingUrl?.includes(expectedUrl)) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    },
    { id: tabId, expectedUrl: url }
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
 * 現在のウィンドウIDを取得
 *
 * @param serviceWorker - Service Worker
 * @returns 現在のウィンドウID
 */
export async function getCurrentWindowId(serviceWorker: Worker): Promise<number> {
  const currentWindow = await serviceWorker.evaluate(() => chrome.windows.getCurrent());
  return currentWindow.id!;
}

/**
 * 擬似サイドパネルタブのIDを取得
 *
 * Playwrightでは本物のChrome拡張機能サイドパネル（chrome.sidePanel API）を
 * 直接テストできないため、sidepanel.htmlを通常のタブとして開いてテストしている。
 * この「擬似サイドパネルタブ」はテスト環境でのみ存在し、ツリービューの検証に使用される。
 *
 * 本物のサイドパネルはchrome.tabs.queryに含まれないが、
 * 擬似サイドパネルタブは通常のタブとして存在するため、
 * テストではこのタブを考慮する必要がある。
 *
 * @param serviceWorker - Service Worker
 * @param windowId - ウィンドウID
 * @returns 擬似サイドパネルタブのID
 * @throws 擬似サイドパネルタブが見つからない場合
 */
export async function getPseudoSidePanelTabId(serviceWorker: Worker, windowId: number): Promise<number> {
  return await serviceWorker.evaluate(async (wId) => {
    const extensionId = chrome.runtime.id;
    const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;

    const tabs = await chrome.tabs.query({ windowId: wId });
    const sidePanelTab = tabs.find(t => {
      const url = t.url || t.pendingUrl || '';
      return url.startsWith(sidePanelUrlPrefix);
    });

    if (!sidePanelTab || !sidePanelTab.id) {
      throw new Error('Pseudo side panel tab not found');
    }

    return sidePanelTab.id;
  }, windowId);
}

/**
 * ブラウザ起動時のデフォルトタブIDを取得（擬似サイドパネルタブとピン留めタブを除く）
 *
 * ブラウザ起動時に自動的に作成される1つのタブ（新しいタブページやabout:blankなど）を取得する。
 * このタブはテストに不要なため、テスト開始時に閉じることができる。
 *
 * @param serviceWorker - Service Worker
 * @param windowId - ウィンドウID
 * @returns ブラウザデフォルトタブのID
 * @throws ブラウザデフォルトタブが見つからない、または複数見つかった場合
 */
export async function getInitialBrowserTabId(serviceWorker: Worker, windowId: number): Promise<number> {
  return await serviceWorker.evaluate(async (wId) => {
    const extensionId = chrome.runtime.id;
    const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;

    const tabs = await chrome.tabs.query({ windowId: wId });
    const browserTabs = tabs
      .filter(t => !t.pinned)
      .filter(t => {
        const url = t.url || t.pendingUrl || '';
        // 擬似サイドパネルタブは除外
        return !url.startsWith(sidePanelUrlPrefix);
      });

    if (browserTabs.length === 0) {
      throw new Error('Initial browser tab not found');
    }

    if (browserTabs.length > 1) {
      throw new Error(`Expected 1 initial browser tab, but found ${browserTabs.length}`);
    }

    const browserTab = browserTabs[0];
    if (!browserTab.id) {
      throw new Error('Initial browser tab has no ID');
    }

    return browserTab.id;
  }, windowId);
}


