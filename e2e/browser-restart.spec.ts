/**
 * ブラウザ再起動時の状態復元テスト
 *
 * このテストファイルでは、実際にブラウザを再起動して状態が正しく復元されることを確認する。
 * 内部APIを直接呼び出すのではなく、ユーザーの実際の操作（ブラウザを閉じて再起動）を模倣する。
 */
import { test, expect } from '@playwright/test';
import {
  createInitialContext,
  restartBrowser,
  createTestUserDataDir,
  removeTestUserDataDir,
  type BrowserRestartResult,
} from './utils/browser-restart-utils';
import { waitForCondition } from './utils/polling-utils';
import {
  closeTab,
  createTab,
  getCurrentWindowId,
  getInitialBrowserTabId,
  getTestServerUrl,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ブラウザ再起動時の状態復元', () => {
  let userDataDir: string;
  let browserResult: BrowserRestartResult;

  test.beforeEach(async () => {
    userDataDir = createTestUserDataDir();
    const headless = process.env.HEADED !== 'true';
    browserResult = await createInitialContext(userDataDir, headless);
  });

  test.afterEach(async () => {
    if (browserResult?.context) {
      await browserResult.context.close();
    }
    if (userDataDir) {
      removeTestUserDataDir(userDataDir);
    }
  });

  test('ブラウザ再起動後にツリー構造が復元される', async () => {
    test.setTimeout(60000);

    const { context, serviceWorker, sidePanelPage } = browserResult;

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible({ timeout: 10000 });

    const windowId = await getCurrentWindowId(serviceWorker);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [], 0);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/child'), parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // 永続化を待つ
    await waitForCondition(async () => {
      const hasTabsInTree = await serviceWorker.evaluate(async () => {
        interface TabNode {
          tabId: number;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return false;

        let tabCount = 0;
        const countTabs = (nodes: TabNode[]): void => {
          for (const node of nodes) {
            tabCount++;
            countTabs(node.children);
          }
        };

        for (const windowState of treeState.windows) {
          for (const viewState of windowState.views) {
            countTabs(viewState.rootNodes);
          }
        }
        return tabCount >= 2;
      });
      return hasTabsInTree;
    }, { timeout: 20000, timeoutMessage: 'Tree state not saved' });

    const headless = process.env.HEADED !== 'true';
    const newBrowserResult = await restartBrowser(context, userDataDir, headless);
    browserResult = newBrowserResult;

    const { serviceWorker: newServiceWorker, sidePanelPage: newSidePanelPage } = newBrowserResult;

    const newSidePanelRoot = newSidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(newSidePanelRoot).toBeVisible({ timeout: 10000 });

    await waitForCondition(async () => {
      const hasTabsRestored = await newServiceWorker.evaluate(async () => {
        interface TabNode {
          tabId: number;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return false;

        let tabCount = 0;
        const countTabs = (nodes: TabNode[]): void => {
          for (const node of nodes) {
            tabCount++;
            countTabs(node.children);
          }
        };

        for (const windowState of treeState.windows) {
          for (const viewState of windowState.views) {
            countTabs(viewState.rootNodes);
          }
        }
        return tabCount > 0;
      });
      return hasTabsRestored;
    }, { timeout: 10000, timeoutMessage: 'Tabs not restored after browser restart' });

    // 再起動後の初期化
    const newWindowId = await getCurrentWindowId(newServiceWorker);

    // URLから新しいタブIDを取得
    const newParentTabId = await newServiceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, getTestServerUrl('/parent'));

    const newChildTabId = await newServiceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, getTestServerUrl('/child'));

    expect(newParentTabId).toBeDefined();
    expect(newChildTabId).toBeDefined();

    // assertTabStructureで全体構造を検証
    await assertTabStructure(newSidePanelPage, newWindowId, [
      { tabId: newParentTabId!, depth: 0, expanded: true },
      { tabId: newChildTabId!, depth: 1 },
    ], 0);
  });

  test('ブラウザ再起動後にviewIdが正しく復元される', async () => {
    test.setTimeout(120000);

    const { context, serviceWorker, sidePanelPage } = browserResult;

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible({ timeout: 10000 });

    const windowId = await getCurrentWindowId(serviceWorker);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [], 0);

    // ビュー1を追加
    const addViewButton = sidePanelPage.locator('[aria-label="Add new view"]');
    await expect(addViewButton).toBeVisible({ timeout: 5000 });
    await addViewButton.click();
    const view1Button = sidePanelPage.locator('[aria-label="Switch to View view"]');
    await expect(view1Button).toBeVisible({ timeout: 5000 });

    // テストタブを作成（ビュー0）
    const testTabId = await createTab(serviceWorker, getTestServerUrl('/view-test-page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: testTabId, depth: 0 },
    ], 0);

    // タブをビュー1に移動
    const tabItem = sidePanelPage.locator(`[data-testid="tree-node-${testTabId}"]`);
    await tabItem.click({ button: 'right' });

    const moveToViewOption = sidePanelPage.locator('text=別のビューへ移動');
    await expect(moveToViewOption).toBeVisible({ timeout: 2000 });
    await moveToViewOption.hover();

    const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
    await expect(subMenu).toBeVisible({ timeout: 2000 });

    const viewMenuItem = subMenu.locator('button', { hasText: 'View' });
    await viewMenuItem.click();

    // タブがビュー0から消えたことを確認
    await assertTabStructure(sidePanelPage, windowId, [], 0);

    // ビュー1に切り替えてタブを確認
    await view1Button.click();
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: testTabId, depth: 0 },
    ], 1);

    // 永続化を待つ
    const testUrl = getTestServerUrl('/view-test-page');
    await waitForCondition(async () => {
      const tabViewIndex = await serviceWorker.evaluate(async ({ tabId }) => {
        interface TabNode {
          tabId: number;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return null;

        const findTabInTree = (nodes: TabNode[], targetTabId: number): boolean => {
          for (const node of nodes) {
            if (node.tabId === targetTabId) return true;
            if (findTabInTree(node.children, targetTabId)) return true;
          }
          return false;
        };

        for (const windowState of treeState.windows) {
          for (let i = 0; i < windowState.views.length; i++) {
            if (findTabInTree(windowState.views[i].rootNodes, tabId)) return i;
          }
        }
        return null;
      }, { tabId: testTabId });
      return tabViewIndex === 1;
    }, { timeout: 20000, timeoutMessage: 'Tab viewIndex not persisted correctly' });

    const headless = process.env.HEADED !== 'true';
    const newBrowserResult = await restartBrowser(context, userDataDir, headless);
    browserResult = newBrowserResult;

    const { serviceWorker: newServiceWorker, sidePanelPage: newSidePanelPage } = newBrowserResult;

    const newSidePanelRoot = newSidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(newSidePanelRoot).toBeVisible({ timeout: 10000 });

    await waitForCondition(async () => {
      const nodesExist = await newServiceWorker.evaluate(async () => {
        interface TabNode {
          tabId: number;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return false;

        for (const windowState of treeState.windows) {
          for (const viewState of windowState.views) {
            if (viewState.rootNodes.length > 0) return true;
          }
        }
        return false;
      });
      return nodesExist;
    }, { timeout: 10000, timeoutMessage: 'Nodes not restored after browser restart' });

    // 再起動後の初期化
    const newWindowId = await getCurrentWindowId(newServiceWorker);

    // 再起動後、URLから新しいタブIDを取得
    const newTestTabId = await newServiceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, testUrl);

    expect(newTestTabId).toBeDefined();

    // ビュー1に切り替えてタブが表示されることを確認
    const newView1Button = newSidePanelPage.locator('[aria-label="Switch to View view"]');
    await newView1Button.click();

    await assertTabStructure(
      newSidePanelPage,
      newWindowId,
      [
        { tabId: newTestTabId!, depth: 0 },
      ],
      1
    );
  });

  test('ブラウザ再起動後に複数ビューのタブが正しく復元される', async () => {
    test.setTimeout(120000);

    const { context, serviceWorker, sidePanelPage } = browserResult;

    const windowId = await getCurrentWindowId(serviceWorker);

    // 初期タブを閉じる（handleTabCreatedが呼ばれる前に作成されたタブはTreeStateに入っていない）
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [], 0);

    // タブAを作成（ビュー0）
    const tabA = await createTab(serviceWorker, getTestServerUrl('/page-a'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: tabA, depth: 0 },
    ], 0);

    // タブBを作成（ビュー0）
    const tabB = await createTab(serviceWorker, getTestServerUrl('/page-b'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
    ], 0);

    // ビュー1を追加
    const addViewButton = sidePanelPage.locator('[aria-label="Add new view"]');
    await addViewButton.click();
    const view1Button = sidePanelPage.locator('[aria-label="Switch to View view"]');
    await expect(view1Button).toBeVisible({ timeout: 5000 });

    // タブCを作成（まだビュー0にいる）
    const tabC = await createTab(serviceWorker, getTestServerUrl('/page-c'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
    ], 0);

    // タブCをビュー1に移動
    const tabCItem = sidePanelPage.locator(`[data-testid="tree-node-${tabC}"]`);
    await tabCItem.click({ button: 'right' });
    const moveToViewOption = sidePanelPage.locator('text=別のビューへ移動');
    await moveToViewOption.hover();
    const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
    await expect(subMenu).toBeVisible({ timeout: 5000 });
    const viewMenuItem = subMenu.locator('button', { hasText: 'View' });
    await viewMenuItem.click();

    // タブCがビュー0から消えたことを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
    ], 0);

    // ビュー1に切り替えてタブCを確認
    await view1Button.click();
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: tabC, depth: 0 },
    ], 1);

    // ビュー0に戻る
    const defaultViewButton = sidePanelPage.locator('[aria-label="Switch to Default view"]');
    await defaultViewButton.click();
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
    ], 0);

    // 永続化を待つ
    await waitForCondition(async () => {
      const persisted = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state !== undefined;
      });
      return persisted;
    }, { timeout: 20000, timeoutMessage: 'Tree state not persisted' });

    // ======== Chrome再起動 ========
    const headless = process.env.HEADED !== 'true';
    const newBrowserResult = await restartBrowser(context, userDataDir, headless);
    browserResult = newBrowserResult;

    const { serviceWorker: newServiceWorker, sidePanelPage: newSidePanelPage } = newBrowserResult;

    const newSidePanelRoot = newSidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(newSidePanelRoot).toBeVisible({ timeout: 10000 });

    // 再起動後の初期化
    const newWindowId = await getCurrentWindowId(newServiceWorker);

    // 再起動後、URLから新しいタブIDを取得
    const newTabA = await newServiceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, getTestServerUrl('/page-a'));

    const newTabB = await newServiceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, getTestServerUrl('/page-b'));

    const newTabC = await newServiceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, getTestServerUrl('/page-c'));

    // ビュー0でタブA, Bが表示されることを確認（タブCはビュー1に残っているべき）
    await assertTabStructure(
      newSidePanelPage,
      newWindowId,
      [
        { tabId: newTabA!, depth: 0 },
        { tabId: newTabB!, depth: 0 },
      ],
      0
    );

    // ビュー1に切り替えてタブCが表示されることを確認
    const newView1Button = newSidePanelPage.locator('[aria-label="Switch to View view"]');
    await newView1Button.click();

    await assertTabStructure(
      newSidePanelPage,
      newWindowId,
      [
        { tabId: newTabC!, depth: 0 },
      ],
      1
    );
  });
});
