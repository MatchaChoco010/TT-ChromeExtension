import { test, expect } from './fixtures/extension';
import { waitForViewSwitcher, waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import { assertTabStructure, assertViewStructure } from './utils/assertion-utils';
import {
  createTab,
  getTestServerUrl,
  getCurrentWindowId,
} from './utils/tab-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ビューへの新規タブ追加', () => {
  test.describe('ビューを開いている状態で新しいタブをそのビューに追加', () => {
    test('カスタムビューを開いている状態で新しいタブを開いた場合、そのビューに追加される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });

      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      const emptyMessage = sidePanelPage.locator('text=No tabs in this view');
      await expect(emptyMessage).toBeVisible({ timeout: 5000 });

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      // pseudoSidePanelTabIdはデフォルトビュー(index 0)に残り、新しいタブだけがカスタムビュー(index 1)に追加される
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);

      const tabViewId = await serviceWorker.evaluate(async (tabId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode: Record<number, { viewId: string; nodeId: string }>;
        };
        const nodeInfo = treeState.tabToNode[tabId];
        if (nodeInfo) {
          return nodeInfo.viewId;
        }
        return null;
      }, newTabId);

      expect(tabViewId).not.toBe('default');
      expect(tabViewId).toMatch(/^view_/);
    });
  });

  test.describe('新規タブ追加後もViewSwitcherが現在のビューを維持（ビューが閉じずに維持される）', () => {
    test('新しいタブを開いた後もビュースイッチャーは同じビューを表示し続ける', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });

      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      // pseudoSidePanelTabIdはデフォルトビュー(index 0)に残り、新しいタブだけがカスタムビュー(index 1)に追加される
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);
    });

    test('複数のタブを追加してもビュースイッチャーは同じビューを維持する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });

      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      // pseudoSidePanelTabIdはデフォルトビュー(index 0)に残るため、新しいビュー(index 1)には含まれない
      const tab1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab1, depth: 0 },
      ], 1);

      const tab2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 1);

      const tab3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 1);

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);
    });
  });

  test.describe('デフォルトビュー以外のビューでも新規タブが現在ビューに属する', () => {
    test('デフォルトビューで新しいタブを開いた場合、デフォルトビューに追加される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });

      await defaultViewButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
      ], 0);

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: newTabId, depth: 0 },
      ], 0);

      const tabViewId = await serviceWorker.evaluate(async (tabId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode: Record<number, { viewId: string; nodeId: string }>;
        };
        const nodeInfo = treeState.tabToNode[tabId];
        if (nodeInfo) {
          return nodeInfo.viewId;
        }
        return null;
      }, newTabId);

      expect(tabViewId).toBe('default');
    });

    test('カスタムビューAからカスタムビューBに切り替えた後、新しいタブはビューBに追加される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });

      await addButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      await addButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
        { viewIdentifier: '#F59E0B' },
      ], 0);

      const viewButtons = sidePanelPage.locator('[aria-label^="Switch to View"]');
      const viewAButton = viewButtons.first();
      await viewAButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
        { viewIdentifier: '#F59E0B' },
      ], 1);

      const viewAId = await serviceWorker.evaluate(async (winId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          currentViewByWindowId?: Record<number, string>;
          currentViewId: string;
        };
        return treeState.currentViewByWindowId?.[winId] ?? treeState.currentViewId;
      }, windowId);

      const viewBButton = viewButtons.nth(1);
      await viewBButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
        { viewIdentifier: '#F59E0B' },
      ], 2);

      const viewBId = await serviceWorker.evaluate(async (winId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          currentViewByWindowId?: Record<number, string>;
          currentViewId: string;
        };
        return treeState.currentViewByWindowId?.[winId] ?? treeState.currentViewId;
      }, windowId);

      expect(viewAId).not.toBe(viewBId);

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      // pseudoSidePanelTabIdはデフォルトビュー(index 0)に残るため、ビューB(index 2)には含まれない
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 2);

      const tabViewId = await serviceWorker.evaluate(async (tabId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode: Record<number, { viewId: string; nodeId: string }>;
        };
        const nodeInfo = treeState.tabToNode[tabId];
        if (nodeInfo) {
          return nodeInfo.viewId;
        }
        return null;
      }, newTabId);

      expect(tabViewId).toBe(viewBId);
      expect(tabViewId).not.toBe(viewAId);
    });
  });

  test.describe('E2Eテスト検証', () => {
    test('NewTabButtonを使用してカスタムビューに新規タブを追加できる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });

      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      const currentViewId = await serviceWorker.evaluate(async (winId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          currentViewByWindowId?: Record<number, string>;
          currentViewId: string;
        };
        return treeState.currentViewByWindowId?.[winId] ?? treeState.currentViewId;
      }, windowId);

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });

      const initialTabCount = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.length;
      });

      await newTabButton.click();

      await waitForCondition(
        async () => {
          const currentTabCount = await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            return tabs.length;
          });
          return currentTabCount > initialTabCount;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );

      const newTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true });
        return tabs[0]?.id;
      });

      if (!newTabId) {
        throw new Error('New tab ID is undefined');
      }

      await waitForTabInTreeState(serviceWorker, newTabId);

      // pseudoSidePanelTabIdはデフォルトビュー(index 0)に残るため、カスタムビュー(index 1)には含まれない
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);

      const tabViewId = await serviceWorker.evaluate(async (tabId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode: Record<number, { viewId: string; nodeId: string }>;
        };
        const nodeInfo = treeState.tabToNode[tabId];
        if (nodeInfo) {
          return nodeInfo.viewId;
        }
        return null;
      }, newTabId);

      expect(tabViewId).toBe(currentViewId);
    });
  });
});
