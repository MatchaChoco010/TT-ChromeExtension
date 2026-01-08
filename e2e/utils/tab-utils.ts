/**
 * TabTestUtils
 *
 * タブ操作（作成、削除、アクティブ化、検証）の共通ヘルパー関数
 */
import type { BrowserContext, Page, Worker } from '@playwright/test';
import type { TestGlobals } from '../types';
import { waitForTabStatusComplete } from './polling-utils';

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

  const tab = await serviceWorker.evaluate(
    async ({ url, parentTabId, active, index, windowId }) => {
      // Note: chrome.tabs.createで作成直後のタブオブジェクトにはopenerTabIdが含まれるが、
      // onCreatedイベントでは含まれないことがあるため、親子関係を別途設定する
      const createdTab = await chrome.tabs.create({
        url,
        active,
        ...(parentTabId !== undefined && { openerTabId: parentTabId }),
        ...(index !== undefined && { index }),
        ...(windowId !== undefined && { windowId }),
      });

      if (parentTabId !== undefined && createdTab.id) {
        if (!globalThis.pendingTabParents) {
          globalThis.pendingTabParents = new Map();
        }
        globalThis.pendingTabParents.set(createdTab.id, parentTabId);
      }

      return createdTab;
    },
    { url, parentTabId, active, index, windowId }
  );

  await serviceWorker.evaluate(
    async (tabId) => {
      for (let i = 0; i < 40; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
        if (treeState?.tabToNode?.[tabId!]) {
          return;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error(`Timeout waiting for tab ${tabId} to be added to tree`);
    },
    tab.id
  );

  if (parentTabId !== undefined) {
    await serviceWorker.evaluate(
      async ({ tabId, parentTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
          isExpanded?: boolean;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
          expandedNodes?: string[];
        }

        await new Promise(resolve => setTimeout(resolve, 100));

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState) return;

        const childNodeId = treeState.tabToNode[tabId];
        const parentNodeId = treeState.tabToNode[parentTabId];

        if (childNodeId && parentNodeId && treeState.nodes[childNodeId] && treeState.nodes[parentNodeId]) {
          treeState.nodes[childNodeId].parentId = parentNodeId;
          const parentDepth = treeState.nodes[parentNodeId].depth || 0;
          treeState.nodes[childNodeId].depth = parentDepth + 1;

          // 子タブ作成時に親ノードを展開（handleTabCreatedの動作を模倣）
          treeState.nodes[parentNodeId].isExpanded = true;
          if (!treeState.expandedNodes) {
            treeState.expandedNodes = [];
          }
          if (!treeState.expandedNodes.includes(parentNodeId)) {
            treeState.expandedNodes.push(parentNodeId);
          }

          await chrome.storage.local.set({ tree_state: treeState });

          // ストレージからtreeStateManagerを再読み込みしてメモリ内状態を同期し、
          // syncWithChromeTabsを呼び出してtreeStructureを再構築する
          // @ts-expect-error accessing global treeStateManager
          if (globalThis.treeStateManager) {
            // @ts-expect-error accessing global treeStateManager
            await globalThis.treeStateManager.loadState();
            // @ts-expect-error accessing global treeStateManager
            await globalThis.treeStateManager.syncWithChromeTabs();
          }

          try {
            await chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
          } catch {
            // リスナーが存在しない場合のエラーは無視
          }
        }
      },
      { tabId: tab.id, parentTabId }
    );

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
                return;
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

  await serviceWorker.evaluate((tabId) => {
    return chrome.tabs.remove(tabId);
  }, tabId);

  const result = await serviceWorker.evaluate(
    async (tabId) => {
      for (let i = 0; i < 50; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
        if (!treeState?.tabToNode?.[tabId]) {
          return { success: true };
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { success: false };
    },
    tabId
  );

  if (!result.success) {
    throw new Error(`Timeout waiting for tab ${tabId} to be removed from tree`);
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

  await serviceWorker.evaluate((tabId) => {
    return chrome.tabs.update(tabId, { active: true });
  }, tabId);

  const result = await serviceWorker.evaluate(
    async (tabId) => {
      for (let i = 0; i < 50; i++) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.active) {
          return { success: true };
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { success: false };
    },
    tabId
  );

  if (!result.success) {
    throw new Error(`Timeout waiting for tab ${tabId} to become active`);
  }
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

  const result = await serviceWorker.evaluate(
    async (id) => {
      for (let i = 0; i < 50; i++) {
        const tab = await chrome.tabs.get(id);
        if (tab.pinned) {
          return { success: true };
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { success: false };
    },
    tabId
  );

  if (!result.success) {
    throw new Error(`Timeout waiting for tab ${tabId} to be pinned`);
  }
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

  const result = await serviceWorker.evaluate(
    async (id) => {
      for (let i = 0; i < 50; i++) {
        const tab = await chrome.tabs.get(id);
        if (!tab.pinned) {
          return { success: true };
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { success: false };
    },
    tabId
  );

  if (!result.success) {
    throw new Error(`Timeout waiting for tab ${tabId} to be unpinned`);
  }
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

  const result = await serviceWorker.evaluate(
    async ({ id, expectedUrl }) => {
      for (let i = 0; i < 100; i++) {
        const tab = await chrome.tabs.get(id);
        if (tab.url?.includes(expectedUrl) || tab.pendingUrl?.includes(expectedUrl)) {
          return { success: true };
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      return { success: false };
    },
    { id: tabId, expectedUrl: url }
  );

  if (!result.success) {
    throw new Error(`Timeout waiting for tab ${tabId} URL to contain "${url}"`);
  }
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

  await serviceWorker.evaluate(async () => {
    try {
      await chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
    } catch {
      // リスナーが存在しない場合のエラーは無視
    }
  });

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


/**
 * テストサーバーのURLを生成
 *
 * PlaywrightのwebServer設定で起動されたHTTPサーバーのURLを返す。
 * 動的ポートは環境変数TEST_SERVER_PORTから取得される。
 *
 * @param path - ページのパス（例: '/page', '/link-with-target-blank'）
 * @returns テストサーバーのURL
 */
export function getTestServerUrl(path: string): string {
  const port = process.env.TEST_SERVER_PORT;
  if (!port) {
    throw new Error('TEST_SERVER_PORT is not set. Make sure webServer is configured in playwright.config.ts');
  }
  return `http://127.0.0.1:${port}${path}`;
}

/**
 * クリックの種類
 */
export type ClickType = 'normal' | 'middle' | 'ctrl';

/**
 * リンククリックで新しいタブを開く
 *
 * 実際のユーザー操作をシミュレートして新しいタブを開く。
 * これにより chrome.webNavigation.onCreatedNavigationTarget が発火し、
 * リンククリックとして正しく検出される。
 *
 * 注意: assertTabStructureで検証するためにはタブIDが必要だが、
 * リンククリックではタブ作成後にしかIDを知ることができない。
 * そのため、この関数内で新しいタブのIDをポーリングで取得して返す。
 * これは「状態の検証」ではなく「必要な情報の取得」である。
 * タブ構造の検証は呼び出し元でassertTabStructureを使用すること。
 *
 * @param context - ブラウザコンテキスト
 * @param page - リンクを含むページ
 * @param selector - クリックするリンクのセレクタ（デフォルト: '#test-link'）
 * @param clickType - クリックの種類（'normal': 通常クリック、'middle': 中クリック、'ctrl': Ctrl+クリック）
 * @returns 新しく開かれたタブのID
 */
export async function clickLinkToOpenTab(
  context: BrowserContext,
  page: Page,
  selector: string = '#test-link',
  clickType: ClickType = 'middle'
): Promise<number> {
  const serviceWorker = await getServiceWorker(context);

  const tabIdsBefore = await serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.map(t => t.id).filter((id): id is number => id !== undefined);
  });

  // noWaitAfter: trueは必須。target="_blank"リンクや中クリック・Ctrl+クリックで
  // 新しいタブを開く場合、ナビゲーションは新しいタブで発生するため、
  // Playwrightのデフォルトのナビゲーション待機が正しく完了しない。
  // この状態がcontext.close()時に遅延を引き起こす可能性がある。
  // 詳細は docs/steering/tech.md を参照。
  switch (clickType) {
    case 'normal':
      await page.click(selector, { noWaitAfter: true });
      break;
    case 'middle':
      await page.click(selector, { button: 'middle', noWaitAfter: true });
      break;
    case 'ctrl':
      await page.click(selector, { modifiers: ['Control'], noWaitAfter: true });
      break;
  }

  const newTabId = await serviceWorker.evaluate(async (previousIds) => {
    for (let i = 0; i < 100; i++) {
      const tabs = await chrome.tabs.query({});
      const newTab = tabs.find(t => t.id !== undefined && !previousIds.includes(t.id));
      if (newTab?.id) {
        return newTab.id;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Timeout waiting for new tab to be created');
  }, tabIdsBefore);

  return newTabId;
}

/**
 * リンククリックで現在のタブをナビゲート
 *
 * 通常クリック（target属性なしのリンク）で現在のタブのURLを変更する。
 * この場合、新しいタブは作成されない。
 *
 * @param context - ブラウザコンテキスト
 * @param page - リンクを含むページ
 * @param selector - クリックするリンクのセレクタ
 */
export async function clickLinkToNavigate(
  context: BrowserContext,
  page: Page,
  selector: string
): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  const tabId = await serviceWorker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
    return tab?.id;
  }, page.url());

  // noWaitAfter: trueを追加して遅延が解消されるか検証
  await page.click(selector, { noWaitAfter: true });

  if (tabId) {
    await waitForTabStatusComplete(serviceWorker, tabId);
  }
}

