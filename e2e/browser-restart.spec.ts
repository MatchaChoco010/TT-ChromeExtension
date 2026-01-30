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
  confirmGroupNameModal,
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

  test('ブラウザ再起動後にグループタブが増殖しない', async () => {
    test.setTimeout(120000);

    const { context, serviceWorker, sidePanelPage } = browserResult;

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible({ timeout: 10000 });

    const windowId = await getCurrentWindowId(serviceWorker);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [], 0);

    // テスト用タブを作成
    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page?id=tab1'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page?id=tab2'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    // タブをグループ化
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

    await tabNode1.click({ force: true, noWaitAfter: true });
    await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

    await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });
    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
    await groupMenuItem.click({ force: true, noWaitAfter: true });
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // グループ名入力モーダルを確認して確定
    const modal = sidePanelPage.locator('[data-testid="group-name-modal"]');
    await expect(modal).toBeVisible({ timeout: 5000 });
    const confirmButton = modal.getByRole('button', { name: '作成' });
    await confirmButton.click({ force: true });
    await expect(modal).not.toBeVisible({ timeout: 3000 });

    // グループタブが作成されるまで待機
    let groupTabId: number | undefined;
    await waitForCondition(
      async () => {
        interface TabNode {
          tabId: number;
          groupInfo?: { name: string };
          children: TabNode[];
        }
        interface TreeState {
          windows: { views: { rootNodes: TabNode[] }[] }[];
        }
        const treeState = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('tree_state');
          return result.tree_state;
        }) as TreeState | undefined;
        if (!treeState?.windows) return false;

        const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
          for (const node of nodes) {
            if (node.groupInfo !== undefined && node.tabId > 0) return node;
            const found = findGroupNode(node.children);
            if (found) return found;
          }
          return undefined;
        };

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const groupNode = findGroupNode(view.rootNodes);
            if (groupNode) {
              groupTabId = groupNode.tabId;
              return true;
            }
          }
        }
        return false;
      },
      { timeout: 10000, timeoutMessage: 'Group parent node was not created' }
    );

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: groupTabId!, depth: 0, expanded: true },
      { tabId: tabId1, depth: 1 },
      { tabId: tabId2, depth: 1 },
    ], 0);

    // 再起動前のグループタブ数をカウント
    const groupCountBefore = await serviceWorker.evaluate(async () => {
      interface TabNode {
        tabId: number;
        groupInfo?: { name: string };
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      if (!treeState?.windows) return 0;

      let count = 0;
      const countGroupNodes = (nodes: TabNode[]): void => {
        for (const node of nodes) {
          if (node.groupInfo !== undefined) count++;
          countGroupNodes(node.children);
        }
      };

      for (const window of treeState.windows) {
        for (const view of window.views) {
          countGroupNodes(view.rootNodes);
        }
      }
      return count;
    });

    expect(groupCountBefore).toBe(1);

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

    // 再起動後のグループタブ数をカウント
    await waitForCondition(async () => {
      const count = await newServiceWorker.evaluate(async () => {
        interface TabNode {
          tabId: number;
          groupInfo?: { name: string };
          children: TabNode[];
        }
        interface TreeState {
          windows: { views: { rootNodes: TabNode[] }[] }[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return 0;

        let count = 0;
        const countGroupNodes = (nodes: TabNode[]): void => {
          for (const node of nodes) {
            if (node.groupInfo !== undefined) count++;
            countGroupNodes(node.children);
          }
        };

        for (const window of treeState.windows) {
          for (const view of window.views) {
            countGroupNodes(view.rootNodes);
          }
        }
        return count;
      });
      return count > 0;
    }, { timeout: 10000, timeoutMessage: 'Group nodes not restored after browser restart' });

    const groupCountAfter = await newServiceWorker.evaluate(async () => {
      interface TabNode {
        tabId: number;
        groupInfo?: { name: string };
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      if (!treeState?.windows) return 0;

      let count = 0;
      const countGroupNodes = (nodes: TabNode[]): void => {
        for (const node of nodes) {
          if (node.groupInfo !== undefined) count++;
          countGroupNodes(node.children);
        }
      };

      for (const window of treeState.windows) {
        for (const view of window.views) {
          countGroupNodes(view.rootNodes);
        }
      }
      return count;
    });

    // グループタブが増殖していないことを確認
    expect(groupCountAfter).toBe(groupCountBefore);
  });

  test('複数ビューでブラウザ再起動後にグループタブが増殖しない', async () => {
    test.setTimeout(120000);

    const { context, serviceWorker, sidePanelPage } = browserResult;

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible({ timeout: 10000 });

    const windowId = await getCurrentWindowId(serviceWorker);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);

    // 1. グループ化するためのタブを作成
    const tab1 = await createTab(serviceWorker, getTestServerUrl('/page?id=tab1'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const tab2 = await createTab(serviceWorker, getTestServerUrl('/page?id=tab2'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    // 2. 複数タブを選択してグループ化
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`);
    await tabNode1.click({ force: true, noWaitAfter: true });
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tab2}"]`);
    await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });
    await expect(tabNode2).toHaveClass(/bg-gray-500/);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tab2,
      { timeout: 5000 }
    );

    await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
    await expect(groupMenuItem).toBeVisible();
    await groupMenuItem.click({ force: true, noWaitAfter: true });

    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // グループ名モーダルを確認して保存
    await confirmGroupNameModal(sidePanelPage);

    // グループタブが作成されるまで待つ
    await waitForCondition(
      async () => {
        interface TabNode {
          tabId: number;
          groupInfo?: { name: string };
          children: TabNode[];
        }
        interface TreeState {
          windows: { views: { rootNodes: TabNode[] }[] }[];
        }
        const treeState = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('tree_state');
          return result.tree_state;
        }) as TreeState | undefined;
        if (!treeState?.windows) return false;

        const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
          for (const node of nodes) {
            if (node.groupInfo !== undefined && node.tabId > 0) return node;
            const found = findGroupNode(node.children);
            if (found) return found;
          }
          return undefined;
        };

        for (const window of treeState.windows) {
          for (const view of window.views) {
            if (findGroupNode(view.rootNodes)) return true;
          }
        }
        return false;
      },
      { timeout: 10000, timeoutMessage: 'Group tab was not created' }
    );

    // グループタブのIDを取得
    const groupTabId = await serviceWorker.evaluate(async () => {
      interface TabNode {
        tabId: number;
        groupInfo?: { name: string };
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      if (!treeState?.windows) return null;

      const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
        for (const node of nodes) {
          if (node.groupInfo !== undefined && node.tabId > 0) return node;
          const found = findGroupNode(node.children);
          if (found) return found;
        }
        return undefined;
      };

      for (const window of treeState.windows) {
        for (const view of window.views) {
          const groupNode = findGroupNode(view.rootNodes);
          if (groupNode) return groupNode.tabId;
        }
      }
      return null;
    });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: groupTabId!, depth: 0, expanded: true },
      { tabId: tab1, depth: 1 },
      { tabId: tab2, depth: 1 },
    ], 0);

    // 3. 新しいビューを作成
    const addViewButton = sidePanelPage.locator('[aria-label="Add new view"]');
    await expect(addViewButton).toBeVisible({ timeout: 5000 });
    await addViewButton.click();
    const viewButton = sidePanelPage.locator('[aria-label="Switch to View view"]');
    await expect(viewButton).toBeVisible({ timeout: 5000 });

    // 4. グループをビュー1に移動（コンテキストメニュー経由）
    const groupNode = sidePanelPage.locator(`[data-testid="tree-node-${groupTabId}"]`);
    await groupNode.click({ button: 'right', force: true, noWaitAfter: true });
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const moveToViewOption = sidePanelPage.locator('text=別のビューへ移動');
    await expect(moveToViewOption).toBeVisible({ timeout: 2000 });
    await moveToViewOption.hover();

    const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
    await expect(subMenu).toBeVisible({ timeout: 2000 });

    const viewMenuItem = subMenu.locator('button', { hasText: 'View' });
    await viewMenuItem.click();
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // Defaultビューにはグループがなくなる
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    // Viewビューに切り替え
    await viewButton.click();
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: groupTabId!, depth: 0, expanded: true },
      { tabId: tab1, depth: 1 },
      { tabId: tab2, depth: 1 },
    ], 1);

    // 5. 再起動前のグループタブ数をカウント
    const groupCountBefore = await serviceWorker.evaluate(async () => {
      interface TabNode {
        tabId: number;
        groupInfo?: { name: string };
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      if (!treeState?.windows) return 0;

      let count = 0;
      const countGroupNodes = (nodes: TabNode[]): void => {
        for (const node of nodes) {
          if (node.groupInfo !== undefined) count++;
          countGroupNodes(node.children);
        }
      };

      for (const window of treeState.windows) {
        for (const view of window.views) {
          countGroupNodes(view.rootNodes);
        }
      }
      return count;
    });

    expect(groupCountBefore).toBe(1);

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

    // 再起動後のグループタブ数をカウント
    await waitForCondition(async () => {
      const count = await newServiceWorker.evaluate(async () => {
        interface TabNode {
          tabId: number;
          groupInfo?: { name: string };
          children: TabNode[];
        }
        interface TreeState {
          windows: { views: { rootNodes: TabNode[] }[] }[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return 0;

        let count = 0;
        const countGroupNodes = (nodes: TabNode[]): void => {
          for (const node of nodes) {
            if (node.groupInfo !== undefined) count++;
            countGroupNodes(node.children);
          }
        };

        for (const window of treeState.windows) {
          for (const view of window.views) {
            countGroupNodes(view.rootNodes);
          }
        }
        return count;
      });
      return count >= groupCountBefore;
    }, { timeout: 30000, timeoutMessage: 'Group count did not stabilize' });

    const groupCountAfter = await newServiceWorker.evaluate(async () => {
      interface TabNode {
        tabId: number;
        groupInfo?: { name: string };
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      if (!treeState?.windows) return 0;

      let count = 0;
      const countGroupNodes = (nodes: TabNode[]): void => {
        for (const node of nodes) {
          if (node.groupInfo !== undefined) count++;
          countGroupNodes(node.children);
        }
      };

      for (const window of treeState.windows) {
        for (const view of window.views) {
          countGroupNodes(view.rootNodes);
        }
      }
      return count;
    });

    // グループタブが増殖していないことを確認（1回目の再起動後）
    expect(groupCountAfter).toBe(groupCountBefore);

    // ======== 2回目のChrome再起動 ========
    console.log('=== 2回目のChrome再起動開始 ===');
    const secondBrowserResult = await restartBrowser(browserResult.context, userDataDir, headless);
    browserResult = secondBrowserResult;

    const { serviceWorker: secondServiceWorker, sidePanelPage: secondSidePanelPage } = secondBrowserResult;

    const secondSidePanelRoot = secondSidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(secondSidePanelRoot).toBeVisible({ timeout: 10000 });

    // 2回目の再起動後のグループタブ数をカウント
    await waitForCondition(async () => {
      const count = await secondServiceWorker.evaluate(async () => {
        interface TabNode {
          tabId: number;
          groupInfo?: { name: string };
          children: TabNode[];
        }
        interface TreeState {
          windows: { views: { rootNodes: TabNode[] }[] }[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return 0;

        let count = 0;
        const countGroupNodes = (nodes: TabNode[]): void => {
          for (const node of nodes) {
            if (node.groupInfo !== undefined) count++;
            countGroupNodes(node.children);
          }
        };

        for (const window of treeState.windows) {
          for (const view of window.views) {
            countGroupNodes(view.rootNodes);
          }
        }
        return count;
      });
      return count >= groupCountBefore;
    }, { timeout: 30000, timeoutMessage: 'Group count did not stabilize (2nd restart)' });

    const groupCountAfter2 = await secondServiceWorker.evaluate(async () => {
      interface TabNode {
        tabId: number;
        groupInfo?: { name: string };
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      if (!treeState?.windows) return 0;

      let count = 0;
      const countGroupNodes = (nodes: TabNode[]): void => {
        for (const node of nodes) {
          if (node.groupInfo !== undefined) count++;
          countGroupNodes(node.children);
        }
      };

      for (const window of treeState.windows) {
        for (const view of window.views) {
          countGroupNodes(view.rootNodes);
        }
      }
      return count;
    });

    console.log(`グループタブ数: 初期=${groupCountBefore}, 1回目再起動後=${groupCountAfter}, 2回目再起動後=${groupCountAfter2}`);

    // 2回目の再起動後もグループタブが増殖していないことを確認
    expect(groupCountAfter2).toBe(groupCountBefore);
  });
});
