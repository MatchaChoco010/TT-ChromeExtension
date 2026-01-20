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
import { getTestServerUrl } from './utils/tab-utils';

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

    const parentPage = await context.newPage();
    await parentPage.goto(getTestServerUrl('/parent'));
    await parentPage.waitForLoadState('domcontentloaded');

    const parentTabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, getTestServerUrl('/parent'));

    expect(parentTabId).toBeDefined();

    await waitForCondition(async () => {
      const hasTab = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode?: Record<number, { viewId: string; nodeId: string }>;
        } | undefined;
        return treeState?.tabToNode && tabId in treeState.tabToNode;
      }, parentTabId);
      return hasTab;
    }, { timeout: 5000, timeoutMessage: 'Tab not added to tree' });

    const childPage = await context.newPage();
    await childPage.goto(getTestServerUrl('/child'));
    await childPage.waitForLoadState('domcontentloaded');

    const childTabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, getTestServerUrl('/child'));

    expect(childTabId).toBeDefined();

    await waitForCondition(async () => {
      const hasTab = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode?: Record<number, { viewId: string; nodeId: string }>;
        } | undefined;
        return treeState?.tabToNode && tabId in treeState.tabToNode;
      }, childTabId);
      return hasTab;
    }, { timeout: 5000, timeoutMessage: 'Child tab not added to tree' });

    const parentItem = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
    const childItem = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);

    if (await parentItem.isVisible() && await childItem.isVisible()) {
      await childItem.dragTo(parentItem);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // 定期的なpersistState（15秒間隔）を待つ
    await waitForCondition(async () => {
      const hasTreeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: unknown[] } | undefined;
        return treeState?.treeStructure && treeState.treeStructure.length >= 2;
      });
      return hasTreeStructure;
    }, { timeout: 20000, timeoutMessage: 'treeStructure not saved' });

    const headless = process.env.HEADED !== 'true';
    const newBrowserResult = await restartBrowser(context, userDataDir, headless);
    browserResult = newBrowserResult;

    const { serviceWorker: newServiceWorker, sidePanelPage: newSidePanelPage } = newBrowserResult;

    const newSidePanelRoot = newSidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(newSidePanelRoot).toBeVisible({ timeout: 10000 });

    await waitForCondition(async () => {
      const hasParentUrl = await newServiceWorker.evaluate(async (url) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: { url: string }[] } | undefined;
        return treeState?.treeStructure?.some(entry => entry.url === url);
      }, getTestServerUrl('/parent'));
      return hasParentUrl;
    }, { timeout: 10000, timeoutMessage: 'Parent tab not restored after browser restart' });

    // Assert
    const tabsExist = await newServiceWorker.evaluate(async ({ parentUrl, childUrl }) => {
      interface ViewState {
        nodes: Record<string, { tabId: number }>;
      }
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as {
        treeStructure?: { url: string }[];
        views?: Record<string, ViewState>;
      } | undefined;

      const hasParent = treeState?.treeStructure?.some(e => e.url === parentUrl);
      const hasChild = treeState?.treeStructure?.some(e => e.url === childUrl);

      let nodesCount = 0;
      if (treeState?.views) {
        for (const viewState of Object.values(treeState.views)) {
          nodesCount += Object.keys(viewState.nodes || {}).length;
        }
      }

      return { hasParent, hasChild, nodesCount };
    }, { parentUrl: getTestServerUrl('/parent'), childUrl: getTestServerUrl('/child') });

    expect(tabsExist.hasParent).toBe(true);
    expect(tabsExist.hasChild).toBe(true);
    expect(tabsExist.nodesCount).toBeGreaterThan(0);
  });

  test('ブラウザ再起動後にviewIdが正しく復元される', async () => {
    test.setTimeout(120000);

    const { context, serviceWorker, sidePanelPage } = browserResult;

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible({ timeout: 10000 });

    const addViewButton = sidePanelPage.locator('[aria-label="Add new view"]');
    await expect(addViewButton).toBeVisible({ timeout: 5000 });
    await addViewButton.click();
    await new Promise(resolve => setTimeout(resolve, 500));

    await waitForCondition(async () => {
      const viewCount = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { viewOrder?: string[] } | undefined;
        return treeState?.viewOrder?.length ?? 0;
      });
      return viewCount >= 2;
    }, { timeout: 5000, timeoutMessage: 'New view not created' });

    const testPage = await context.newPage();
    await testPage.goto(getTestServerUrl('/view-test-page'));
    await testPage.waitForLoadState('domcontentloaded');

    const testTabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url });
      return tabs[0]?.id;
    }, getTestServerUrl('/view-test-page'));

    expect(testTabId).toBeDefined();

    await waitForCondition(async () => {
      const hasTab = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode?: Record<number, { viewId: string; nodeId: string }>;
        } | undefined;
        return treeState?.tabToNode && tabId in treeState.tabToNode;
      }, testTabId);
      return hasTab;
    }, { timeout: 5000, timeoutMessage: 'Tab not added to tree' });

    const tabItem = sidePanelPage.locator(`[data-testid="tree-node-${testTabId}"]`);
    await expect(tabItem).toBeVisible({ timeout: 5000 });

    await tabItem.click({ button: 'right' });
    await new Promise(resolve => setTimeout(resolve, 300));

    const moveToViewOption = sidePanelPage.locator('text=別のビューへ移動');
    if (await moveToViewOption.isVisible({ timeout: 2000 })) {
      await moveToViewOption.hover();
      await new Promise(resolve => setTimeout(resolve, 500));

      const viewButtons = sidePanelPage.locator('[data-testid="view-switcher-container"] button').filter({
        hasNot: sidePanelPage.locator('[aria-label="Add new view"]')
      });

      const secondViewButton = viewButtons.nth(1);
      const viewTitle = await secondViewButton.getAttribute('title');

      if (viewTitle) {
        const viewMenuItem = sidePanelPage.locator(`text=${viewTitle}`).last();
        if (await viewMenuItem.isVisible({ timeout: 2000 })) {
          await viewMenuItem.click();
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }
    }

    await waitForCondition(async () => {
      const viewId = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode?: Record<number, { viewId: string; nodeId: string }>;
        } | undefined;

        if (!treeState?.tabToNode) return null;
        return treeState.tabToNode[tabId]?.viewId;
      }, testTabId);
      return viewId !== 'default' && viewId !== null;
    }, { timeout: 10000, timeoutMessage: 'ViewId not updated from default' });

    const currentViewId = await serviceWorker.evaluate(async (tabId) => {
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as {
        tabToNode?: Record<number, { viewId: string; nodeId: string }>;
      } | undefined;

      if (!treeState?.tabToNode) return null;
      return treeState.tabToNode[tabId]?.viewId;
    }, testTabId);

    expect(currentViewId).not.toBe('default');
    expect(currentViewId).toBeDefined();

    // 定期的なpersistState（15秒間隔）を待つ
    const testUrl = getTestServerUrl('/view-test-page');
    await waitForCondition(async () => {
      const treeStructureViewId = await serviceWorker.evaluate(async (url) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          treeStructure?: { url: string; viewId: string }[];
        } | undefined;

        const entry = treeState?.treeStructure?.find(e => e.url === url);
        return entry?.viewId;
      }, testUrl);
      return treeStructureViewId === currentViewId;
    }, { timeout: 20000, timeoutMessage: 'treeStructure viewId not updated' });

    const headless = process.env.HEADED !== 'true';
    const newBrowserResult = await restartBrowser(context, userDataDir, headless);
    browserResult = newBrowserResult;

    const { serviceWorker: newServiceWorker, sidePanelPage: newSidePanelPage } = newBrowserResult;

    const newSidePanelRoot = newSidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(newSidePanelRoot).toBeVisible({ timeout: 10000 });

    await waitForCondition(async () => {
      interface ViewState {
        nodes: Record<string, unknown>;
      }
      const nodesExist = await newServiceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          views?: Record<string, ViewState>;
        } | undefined;

        if (!treeState?.views) return false;

        for (const viewState of Object.values(treeState.views)) {
          if (viewState.nodes && Object.keys(viewState.nodes).length > 0) {
            return true;
          }
        }
        return false;
      });
      return nodesExist;
    }, { timeout: 10000, timeoutMessage: 'Nodes not restored after browser restart' });

    // 再起動後はtabIdが変わるため、URLでタブを検索してviewIdを確認
    const restoredViewId = await newServiceWorker.evaluate(async ({ url, expectedViewId }) => {
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as {
        tabToNode?: Record<number, { viewId: string; nodeId: string }>;
      } | undefined;

      if (!treeState?.tabToNode) return null;

      const tabs = await chrome.tabs.query({ url });
      if (tabs.length === 0) return null;

      const tabId = tabs[0].id;
      if (!tabId) return null;

      const nodeInfo = treeState.tabToNode[tabId];

      return {
        actual: nodeInfo?.viewId,
        expected: expectedViewId,
        match: nodeInfo?.viewId === expectedViewId,
      };
    }, { url: testUrl, expectedViewId: currentViewId });

    expect(restoredViewId).not.toBeNull();
    expect(restoredViewId?.match).toBe(true);
  });
});
