import { test, expect } from './fixtures/extension';
import { waitForViewSwitcher, waitForCondition } from './utils/polling-utils';
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

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);

      const tabViewIndex = await serviceWorker.evaluate(async ({ tabId, windowId }) => {
        interface TabNode {
          tabId: number;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          windowId: number;
          views: ViewState[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { windows: WindowState[] };
        const windowState = treeState.windows.find(w => w.windowId === windowId);
        if (!windowState) return null;

        const findInNodes = (nodes: TabNode[]): boolean => {
          for (const node of nodes) {
            if (node.tabId === tabId) return true;
            if (findInNodes(node.children)) return true;
          }
          return false;
        };

        for (let i = 0; i < windowState.views.length; i++) {
          if (findInNodes(windowState.views[i].rootNodes)) return i;
        }
        return null;
      }, { tabId: newTabId, windowId });

      expect(tabViewIndex).not.toBe(0);
      expect(tabViewIndex).toBe(1);
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
      const { initialBrowserTabId, sidePanelPage } =
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
        { tabId: newTabId, depth: 0 },
      ], 0);

      const tabViewIndex = await serviceWorker.evaluate(async ({ tabId, windowId }) => {
        interface TabNode {
          tabId: number;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          windowId: number;
          views: ViewState[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { windows: WindowState[] };
        const windowState = treeState.windows.find(w => w.windowId === windowId);
        if (!windowState) return null;

        const findInNodes = (nodes: TabNode[]): boolean => {
          for (const node of nodes) {
            if (node.tabId === tabId) return true;
            if (findInNodes(node.children)) return true;
          }
          return false;
        };

        for (let i = 0; i < windowState.views.length; i++) {
          if (findInNodes(windowState.views[i].rootNodes)) return i;
        }
        return null;
      }, { tabId: newTabId, windowId });

      expect(tabViewIndex).toBe(0);
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

      const viewAIndex = await serviceWorker.evaluate(async (winId: number) => {
        interface WindowState {
          windowId: number;
          activeViewIndex: number;
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { windows: WindowState[] };
        const windowState = treeState.windows.find(w => w.windowId === winId);
        return windowState?.activeViewIndex ?? null;
      }, windowId);

      const viewBButton = viewButtons.nth(1);
      await viewBButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
        { viewIdentifier: '#F59E0B' },
      ], 2);

      const viewBIndex = await serviceWorker.evaluate(async (winId: number) => {
        interface WindowState {
          windowId: number;
          activeViewIndex: number;
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { windows: WindowState[] };
        const windowState = treeState.windows.find(w => w.windowId === winId);
        return windowState?.activeViewIndex ?? null;
      }, windowId);

      expect(viewAIndex).not.toBe(viewBIndex);

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 2);

      const tabViewIndex = await serviceWorker.evaluate(async ({ tabId, windowId }) => {
        interface TabNode {
          tabId: number;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          windowId: number;
          views: ViewState[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { windows: WindowState[] };
        const windowState = treeState.windows.find(w => w.windowId === windowId);
        if (!windowState) return null;

        const findInNodes = (nodes: TabNode[]): boolean => {
          for (const node of nodes) {
            if (node.tabId === tabId) return true;
            if (findInNodes(node.children)) return true;
          }
          return false;
        };

        for (let i = 0; i < windowState.views.length; i++) {
          if (findInNodes(windowState.views[i].rootNodes)) return i;
        }
        return null;
      }, { tabId: newTabId, windowId });

      expect(tabViewIndex).toBe(viewBIndex);
      expect(tabViewIndex).not.toBe(viewAIndex);
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

      const currentViewIndex = await serviceWorker.evaluate(async (winId: number) => {
        interface WindowState {
          windowId: number;
          activeViewIndex: number;
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { windows: WindowState[] };
        const windowState = treeState.windows.find(w => w.windowId === winId);
        return windowState?.activeViewIndex ?? null;
      }, windowId);

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });

      await newTabButton.click();

      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabIds = await serviceWorker.evaluate(async (args: { windowId: number; viewIndex: number }) => {
            const treeState = (globalThis as unknown as { treeStateManager?: { toJSON: () => { windows: { windowId: number; views: { rootNodes: { tabId: number }[] }[] }[] } } }).treeStateManager?.toJSON();
            if (!treeState) return [];
            const windowState = treeState.windows.find(w => w.windowId === args.windowId);
            if (!windowState) return [];
            const view = windowState.views[args.viewIndex];
            if (!view) return [];
            return view.rootNodes.map(n => n.tabId);
          }, { windowId, viewIndex: 1 });
          if (tabIds.length === 1) {
            newTabId = tabIds[0];
            return true;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not added to TreeState view' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);

      const tabViewIndex = await serviceWorker.evaluate(async ({ tabId, windowId }) => {
        interface TabNode {
          tabId: number;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          windowId: number;
          views: ViewState[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { windows: WindowState[] };
        const windowState = treeState.windows.find(w => w.windowId === windowId);
        if (!windowState) return null;

        const findInNodes = (nodes: TabNode[]): boolean => {
          for (const node of nodes) {
            if (node.tabId === tabId) return true;
            if (findInNodes(node.children)) return true;
          }
          return false;
        };

        for (let i = 0; i < windowState.views.length; i++) {
          if (findInNodes(windowState.views[i].rootNodes)) return i;
        }
        return null;
      }, { tabId: newTabId, windowId });

      expect(tabViewIndex).toBe(currentViewIndex);
    });
  });
});
