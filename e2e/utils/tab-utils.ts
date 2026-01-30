/**
 * TabTestUtils
 *
 * タブ操作（作成、削除、アクティブ化、検証）の共通ヘルパー関数
 *
 * 重要: すべての関数は Worker を直接受け取る。
 * context.serviceWorkers()[0] から新しい参照を取得する getServiceWorker() は廃止。
 * これにより、Service Worker が再起動された場合に即座にエラーが発生し、
 * 根本原因が明確になる。
 */
import type { Page, Worker } from '@playwright/test';
import type { TestGlobals } from '../types';
import { waitForTabStatusComplete, waitForTabInTreeState } from './polling-utils';

declare let globalThis: TestGlobals;

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
 * タブを作成し、ツリーに表示されるまで待機
 *
 * @param serviceWorker - Service Worker
 * @param url - タブのURL
 * @param parentTabId - 親タブのID（オプション）
 * @param options - タブ作成オプション
 * @returns 作成されたタブのID
 */
export async function createTab(
  serviceWorker: Worker,
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

  const { active = true, index, windowId: specifiedWindowId } = resolvedOptions;

  // windowIdが未指定の場合、sidePanelTabのwindowIdを自動取得
  // これにより、リセット後にChromeの「現在のウィンドウ」が
  // sidePanelTabのウィンドウと異なる場合でも正しく動作する
  const windowId = specifiedWindowId ?? await serviceWorker.evaluate(async () => {
    const extensionId = chrome.runtime.id;
    const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
    const tabs = await chrome.tabs.query({});
    const sidePanelTab = tabs.find(t => {
      const url = t.url || t.pendingUrl || '';
      return url.startsWith(sidePanelUrlPrefix);
    });
    return sidePanelTab?.windowId;
  });

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

  // まずタブがツリーに追加されるまで待機（parentTabId有無に関わらず必須）
  await waitForTabInTreeState(serviceWorker, tab.id!);

  if (parentTabId !== undefined) {
    // ピン留めタブが親として指定された場合、親子関係は設定されない
    // （ピン留めタブはrootNodesに含まれないため、新しいタブはルートノードとして追加される）
    const isParentPinned = await serviceWorker.evaluate(
      async (parentTabId) => {
        interface ViewState {
          pinnedTabIds: number[];
        }
        interface WindowState {
          windowId: number;
          views: ViewState[];
        }
        interface LocalTreeState {
          windows: WindowState[];
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (treeState?.windows) {
          for (const windowState of treeState.windows) {
            for (const viewState of windowState.views) {
              if (viewState.pinnedTabIds?.includes(parentTabId)) {
                return true;
              }
            }
          }
        }
        return false;
      },
      parentTabId
    );

    // ピン留めタブが親の場合、親子関係の確認はスキップ
    // （新しいタブはルートノードとして追加されているはず）
    if (!isParentPinned) {
      // handleTabCreatedがpendingTabParentsを使用して親子関係を設定する
      // タブがツリーに追加された後、親子関係が正しく設定されるまで待機
      const parentChildSet = await serviceWorker.evaluate(
        async ({ parentTabId, childTabId }) => {
          interface TabNode {
            tabId: number;
            isExpanded: boolean;
            children: TabNode[];
          }
          interface ViewState {
            name: string;
            color: string;
            rootNodes: TabNode[];
          }
          interface WindowState {
            windowId: number;
            views: ViewState[];
            activeViewIndex: number;
            pinnedTabIds: number[];
          }
          interface LocalTreeState {
            windows: WindowState[];
          }

          // 再帰的にタブを検索し、親タブIDも返す
          const findTabWithParent = (
            nodes: TabNode[],
            targetTabId: number,
            parentTabId: number | null = null
          ): { found: boolean; parentTabId: number | null } => {
            for (const node of nodes) {
              if (node.tabId === targetTabId) {
                return { found: true, parentTabId };
              }
              const result = findTabWithParent(node.children, targetTabId, node.tabId);
              if (result.found) {
                return result;
              }
            }
            return { found: false, parentTabId: null };
          };

          for (let i = 0; i < 100; i++) {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as LocalTreeState | undefined;
            if (treeState?.windows) {
              for (const windowState of treeState.windows) {
                for (const viewState of windowState.views) {
                  const childResult = findTabWithParent(viewState.rootNodes, childTabId);
                  if (childResult.found && childResult.parentTabId === parentTabId) {
                    return true;
                  }
                }
              }
            }
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          return false;
        },
        { parentTabId, childTabId: tab.id! }
      );

      if (!parentChildSet) {
        throw new Error(
          `Timeout waiting for parent-child relationship: parentTabId=${parentTabId}, childTabId=${tab.id}`
        );
      }
    }
  }

  return tab.id as number;
}

/**
 * タブを閉じ、ツリーから削除されることを検証
 *
 * @param serviceWorker - Service Worker
 * @param tabId - 閉じるタブのID
 */
export async function closeTab(serviceWorker: Worker, tabId: number): Promise<void> {
  await serviceWorker.evaluate((tabId) => {
    return chrome.tabs.remove(tabId);
  }, tabId);
}

/**
 * タブをアクティブ化し、ツリーでハイライトされることを検証
 *
 * @param serviceWorker - Service Worker
 * @param tabId - アクティブ化するタブのID
 */
export async function activateTab(
  serviceWorker: Worker,
  tabId: number
): Promise<void> {
  await serviceWorker.evaluate((tabId) => {
    return chrome.tabs.update(tabId, { active: true });
  }, tabId);

  const result = await serviceWorker.evaluate(
    async (tabId) => {
      for (let i = 0; i < 100; i++) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.active) {
          return { success: true };
        }
        await new Promise(resolve => setTimeout(resolve, 20));
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
 * @param serviceWorker - Service Worker
 * @param tabId - ピン留めするタブのID
 */
export async function pinTab(serviceWorker: Worker, tabId: number): Promise<void> {
  await serviceWorker.evaluate(async (id) => {
    await chrome.tabs.update(id, { pinned: true });
  }, tabId);

  const result = await serviceWorker.evaluate(
    async (id) => {
      for (let i = 0; i < 100; i++) {
        const tab = await chrome.tabs.get(id);
        if (tab.pinned) {
          return { success: true };
        }
        await new Promise(resolve => setTimeout(resolve, 20));
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
 * @param serviceWorker - Service Worker
 * @param tabId - ピン留め解除するタブのID
 */
export async function unpinTab(serviceWorker: Worker, tabId: number): Promise<void> {
  await serviceWorker.evaluate(async (id) => {
    await chrome.tabs.update(id, { pinned: false });
  }, tabId);

  const result = await serviceWorker.evaluate(
    async (id) => {
      for (let i = 0; i < 100; i++) {
        const tab = await chrome.tabs.get(id);
        if (!tab.pinned) {
          return { success: true };
        }
        await new Promise(resolve => setTimeout(resolve, 20));
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
 * @param serviceWorker - Service Worker
 * @param tabId - 更新するタブのID
 * @param url - 新しいURL
 */
export async function updateTabUrl(serviceWorker: Worker, tabId: number, url: string): Promise<void> {
  await serviceWorker.evaluate(async ({ id, newUrl }) => {
    await chrome.tabs.update(id, { url: newUrl });
  }, { id: tabId, newUrl: url });

  const result = await serviceWorker.evaluate(
    async ({ id, expectedUrl }) => {
      for (let i = 0; i < 200; i++) {
        const tab = await chrome.tabs.get(id);
        if (tab.url?.includes(expectedUrl) || tab.pendingUrl?.includes(expectedUrl)) {
          return { success: true };
        }
        await new Promise(resolve => setTimeout(resolve, 20));
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
 * 現在のウィンドウIDを取得
 *
 * sidePanelTabが存在する場合はそのwindowIdを返す。
 * sidePanelTabが存在しない場合（autoReset直後など）は、
 * 最初に見つかったタブのwindowIdを返す。
 *
 * @param serviceWorker - Service Worker
 * @returns 現在のウィンドウID
 */
export async function getCurrentWindowId(serviceWorker: Worker): Promise<number> {
  return await serviceWorker.evaluate(async () => {
    const extensionId = chrome.runtime.id;
    const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
    const tabs = await chrome.tabs.query({});

    const sidePanelTab = tabs.find(t => {
      const url = t.url || t.pendingUrl || '';
      return url.startsWith(sidePanelUrlPrefix);
    });
    if (sidePanelTab?.windowId) {
      return sidePanelTab.windowId;
    }

    if (tabs.length > 0 && tabs[0].windowId) {
      return tabs[0].windowId;
    }

    throw new Error('Could not determine windowId: no tabs found');
  });
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
 * @param serviceWorker - Service Worker
 * @param page - リンクを含むページ
 * @param selector - クリックするリンクのセレクタ（デフォルト: '#test-link'）
 * @param clickType - クリックの種類（'normal': 通常クリック、'middle': 中クリック、'ctrl': Ctrl+クリック）
 * @returns 新しく開かれたタブのID
 */
export async function clickLinkToOpenTab(
  serviceWorker: Worker,
  page: Page,
  selector: string = '#test-link',
  clickType: ClickType = 'middle'
): Promise<number> {
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
    for (let i = 0; i < 200; i++) {
      const tabs = await chrome.tabs.query({});
      const newTab = tabs.find(t => t.id !== undefined && !previousIds.includes(t.id));
      if (newTab?.id) {
        return newTab.id;
      }
      await new Promise(resolve => setTimeout(resolve, 20));
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
 * @param serviceWorker - Service Worker
 * @param page - リンクを含むページ
 * @param selector - クリックするリンクのセレクタ
 */
export async function clickLinkToNavigate(
  serviceWorker: Worker,
  page: Page,
  selector: string
): Promise<void> {
  const tabId = await serviceWorker.evaluate(async (url) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
    return tab?.id;
  }, page.url());

  await page.click(selector, { noWaitAfter: true });

  if (tabId) {
    await waitForTabStatusComplete(serviceWorker, tabId);
  }
}

/**
 * UIの展開/折りたたみオーバーレイをクリックしてノードを折りたたむ
 *
 * 展開中のタブはホバー時のみオーバーレイが表示されるため、
 * ノードにホバーしてからオーバーレイをクリックする。
 *
 * @param page - サイドパネルページ
 * @param tabId - 折りたたむタブのID
 */
export async function collapseNode(page: Page, tabId: number): Promise<void> {
  const treeNode = page.locator(`[data-testid="tree-node-${tabId}"]`).first();
  await treeNode.hover();
  const collapseOverlay = treeNode.locator('[data-testid="expand-overlay"]').first();
  await collapseOverlay.click();
}

/**
 * UIの展開/折りたたみオーバーレイをクリックしてノードを展開する
 *
 * 折りたたみ中のタブはオーバーレイが常に表示されているため、
 * 直接クリックできる。
 *
 * @param page - サイドパネルページ
 * @param tabId - 展開するタブのID
 */
export async function expandNode(page: Page, tabId: number): Promise<void> {
  const expandOverlay = page.locator(`[data-testid="tree-node-${tabId}"] [data-testid="expand-overlay"]`).first();
  await expandOverlay.click();
}

/**
 * グループ名モーダルを確認する
 *
 * グループ化操作後に表示されるモーダルで、デフォルトの名前を受け入れて保存ボタンをクリックする。
 *
 * @param page - サイドパネルページ
 */
export async function confirmGroupNameModal(page: Page): Promise<void> {
  const modal = page.locator('[data-testid="group-name-modal"]');
  await modal.waitFor({ state: 'visible', timeout: 5000 });
  const saveButton = page.locator('[data-testid="group-name-save-button"]');
  // ボタンが完全にクリック可能になるまで待つ
  await saveButton.waitFor({ state: 'visible', timeout: 3000 });
  await saveButton.click({ noWaitAfter: true });
  await modal.waitFor({ state: 'hidden', timeout: 5000 });
}

/**
 * ページを開いてタブIDを取得
 *
 * extensionContext.newPage()でページを作成し、指定URLに遷移してタブIDを取得する。
 * タブがTreeStateに追加されるまで待機するため、返却後すぐにassertTabStructureを呼べる。
 *
 * @param extensionContext - Playwright BrowserContext
 * @param serviceWorker - Service Worker
 * @param url - 開くURL
 * @returns ページオブジェクトとタブID
 */
export async function openPageAndGetTabId(
  extensionContext: { newPage: () => Promise<Page> },
  serviceWorker: Worker,
  url: string
): Promise<{ page: Page; tabId: number }> {
  const page = await extensionContext.newPage();
  await page.goto(url);
  await page.waitForLoadState('domcontentloaded');

  const tabId = await serviceWorker.evaluate(async (targetUrl) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(targetUrl));
    return tab?.id;
  }, url);

  if (tabId === undefined) {
    throw new Error(`Tab with URL containing "${url}" not found`);
  }

  await waitForTabInTreeState(serviceWorker, tabId);

  return { page, tabId };
}

