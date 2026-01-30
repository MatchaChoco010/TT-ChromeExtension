import { test, expect } from './fixtures/extension';
import { createTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';
import { waitForCondition } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ツリー状態永続化', () => {
  test.setTimeout(120000);

  test.describe('親子関係の永続化', () => {
    test('親子関係がストレージに正しく保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      const parentIdInStorage = await serviceWorker.evaluate(async ({ childId, parentId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          windowId: number;
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return { found: false, isChildOfParent: false };

        // Recursively search for a node and its parent
        const findNodeWithParent = (
          nodes: TabNode[],
          targetTabId: number,
          parent: TabNode | null
        ): { node: TabNode; parent: TabNode | null } | null => {
          for (const node of nodes) {
            if (node.tabId === targetTabId) {
              return { node, parent };
            }
            const found = findNodeWithParent(node.children, targetTabId, node);
            if (found) return found;
          }
          return null;
        };

        // Search across all windows and views
        for (const windowState of treeState.windows) {
          for (const viewState of windowState.views) {
            const childResult = findNodeWithParent(viewState.rootNodes, childId, null);
            if (childResult) {
              // Check if the parent of the child is the expected parent
              const isChildOfParent = childResult.parent?.tabId === parentId;
              return { found: true, isChildOfParent };
            }
          }
        }
        return { found: false, isChildOfParent: false };
      }, { childId: childTab, parentId: parentTab });

      expect(parentIdInStorage.found).toBe(true);
      expect(parentIdInStorage.isChildOfParent).toBe(true);
    });

    test('サイドパネルリロード後に親子関係が復元されること', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      await waitForCondition(async () => {
        const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
        return (await parentNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Parent tab ${parentTab} not visible after reload` });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);
    });

    test('深いネストの親子関係がストレージに正しく保存・復元されること', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const rootTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: rootTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: rootTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      const grandchildTab = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: rootTab, depth: 0 },
        { tabId: childTab, depth: 0 },
        { tabId: grandchildTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, rootTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: rootTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
        { tabId: grandchildTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, grandchildTab, childTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: rootTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1, expanded: true },
        { tabId: grandchildTab, depth: 2 },
      ], 0);

      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      await waitForCondition(async () => {
        const rootNode = sidePanelPage.locator(`[data-testid="tree-node-${rootTab}"]`);
        return (await rootNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Root tab ${rootTab} not visible after reload` });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: rootTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1, expanded: true },
        { tabId: grandchildTab, depth: 2 },
      ], 0);
    });
  });

  test.describe('折りたたみ状態の永続化', () => {
    test('折りたたみ状態がストレージに正しく保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TabNode {
            tabId: number;
            isExpanded: boolean;
            children: TabNode[];
          }
          interface ViewState {
            rootNodes: TabNode[];
          }
          interface WindowState {
            windowId: number;
            views: ViewState[];
          }
          interface TreeState {
            windows: WindowState[];
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as TreeState | undefined;
          if (!treeState?.windows) return null;

          const findNode = (nodes: TabNode[], targetTabId: number): TabNode | null => {
            for (const node of nodes) {
              if (node.tabId === targetTabId) return node;
              const found = findNode(node.children, targetTabId);
              if (found) return found;
            }
            return null;
          };

          for (const windowState of treeState.windows) {
            for (const viewState of windowState.views) {
              const node = findNode(viewState.rootNodes, parentId);
              if (node) return node.isExpanded;
            }
          }
          return null;
        }, parentTab);
        return isExpandedInStorage === true;
      }, { timeout: 5000, timeoutMessage: 'Expanded state was not saved to storage' });

      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      // 展開中はホバーでオーバーレイが表示されるので、まずホバーする
      await parentNode.hover();
      const expandOverlay = parentNode.locator('[data-testid="expand-overlay"]');
      await expandOverlay.first().click();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: false },
      ], 0);

      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TabNode {
            tabId: number;
            isExpanded: boolean;
            children: TabNode[];
          }
          interface ViewState {
            rootNodes: TabNode[];
          }
          interface WindowState {
            windowId: number;
            views: ViewState[];
          }
          interface TreeState {
            windows: WindowState[];
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as TreeState | undefined;
          if (!treeState?.windows) return null;

          const findNode = (nodes: TabNode[], targetTabId: number): TabNode | null => {
            for (const node of nodes) {
              if (node.tabId === targetTabId) return node;
              const found = findNode(node.children, targetTabId);
              if (found) return found;
            }
            return null;
          };

          for (const windowState of treeState.windows) {
            for (const viewState of windowState.views) {
              const node = findNode(viewState.rootNodes, parentId);
              if (node) return node.isExpanded;
            }
          }
          return null;
        }, parentTab);
        return isExpandedInStorage === false;
      }, { timeout: 5000, timeoutMessage: 'Collapsed state was not saved to storage' });
    });

    test('サイドパネルリロード後に折りたたみ状態が復元されること（折りたたみ状態）', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      const parentNode2 = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      // 展開中はホバーでオーバーレイが表示されるので、まずホバーする
      await parentNode2.hover();
      const expandOverlay2 = parentNode2.locator('[data-testid="expand-overlay"]');
      await expandOverlay2.first().click();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: false },
      ], 0);

      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TabNode {
            tabId: number;
            isExpanded: boolean;
            children: TabNode[];
          }
          interface ViewState {
            rootNodes: TabNode[];
          }
          interface WindowState {
            windowId: number;
            views: ViewState[];
          }
          interface TreeState {
            windows: WindowState[];
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as TreeState | undefined;
          if (!treeState?.windows) return null;

          const findNode = (nodes: TabNode[], targetTabId: number): TabNode | null => {
            for (const node of nodes) {
              if (node.tabId === targetTabId) return node;
              const found = findNode(node.children, targetTabId);
              if (found) return found;
            }
            return null;
          };

          for (const windowState of treeState.windows) {
            for (const viewState of windowState.views) {
              const node = findNode(viewState.rootNodes, parentId);
              if (node) return node.isExpanded;
            }
          }
          return null;
        }, parentTab);
        return isExpandedInStorage === false;
      }, { timeout: 5000, timeoutMessage: 'Collapsed state was not saved to storage' });

      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      await waitForCondition(async () => {
        const pNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
        return (await pNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Parent tab ${parentTab} not visible after reload` });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: false },
      ], 0);
    });

    test('サイドパネルリロード後に折りたたみ状態が復元されること（展開状態）', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TabNode {
            tabId: number;
            isExpanded: boolean;
            children: TabNode[];
          }
          interface ViewState {
            rootNodes: TabNode[];
          }
          interface WindowState {
            windowId: number;
            views: ViewState[];
          }
          interface TreeState {
            windows: WindowState[];
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as TreeState | undefined;
          if (!treeState?.windows) return null;

          const findNode = (nodes: TabNode[], targetTabId: number): TabNode | null => {
            for (const node of nodes) {
              if (node.tabId === targetTabId) return node;
              const found = findNode(node.children, targetTabId);
              if (found) return found;
            }
            return null;
          };

          for (const windowState of treeState.windows) {
            for (const viewState of windowState.views) {
              const node = findNode(viewState.rootNodes, parentId);
              if (node) return node.isExpanded;
            }
          }
          return null;
        }, parentTab);
        return isExpandedInStorage === true;
      }, { timeout: 5000, timeoutMessage: 'Expanded state was not saved to storage' });

      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      await waitForCondition(async () => {
        const pNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
        return (await pNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Parent tab ${parentTab} not visible after reload` });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);
    });
  });

  test.describe('統合テスト', () => {
    test('親子関係と折りたたみ状態の両方がリロード後に復元されること', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parent1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parent1, depth: 0 },
      ], 0);

      const child1 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parent1, depth: 0 },
        { tabId: child1, depth: 0 },
      ], 0);

      const parent2 = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parent1, depth: 0 },
        { tabId: child1, depth: 0 },
        { tabId: parent2, depth: 0 },
      ], 0);

      const child2 = await createTab(serviceWorker, getTestServerUrl('/page4'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parent1, depth: 0 },
        { tabId: child1, depth: 0 },
        { tabId: parent2, depth: 0 },
        { tabId: child2, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child1, parent1, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parent1, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: parent2, depth: 0 },
        { tabId: child2, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child2, parent2, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parent1, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: parent2, depth: 0, expanded: true },
        { tabId: child2, depth: 1 },
      ], 0);

      const parent2Node = sidePanelPage.locator(`[data-testid="tree-node-${parent2}"]`).first();
      // 展開中はホバーでオーバーレイが表示されるので、まずホバーする
      await parent2Node.hover();
      const expandOverlay3 = parent2Node.locator('[data-testid="expand-overlay"]');
      await expandOverlay3.first().click();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parent1, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: parent2, depth: 0, expanded: false },
      ], 0);

      await waitForCondition(async () => {
        const states = await serviceWorker.evaluate(async ({ parent1Id, parent2Id }) => {
          interface TabNode {
            tabId: number;
            isExpanded: boolean;
            children: TabNode[];
          }
          interface ViewState {
            rootNodes: TabNode[];
          }
          interface WindowState {
            windowId: number;
            views: ViewState[];
          }
          interface TreeState {
            windows: WindowState[];
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as TreeState | undefined;
          if (!treeState?.windows) return null;

          const findNode = (nodes: TabNode[], targetTabId: number): TabNode | null => {
            for (const node of nodes) {
              if (node.tabId === targetTabId) return node;
              const found = findNode(node.children, targetTabId);
              if (found) return found;
            }
            return null;
          };

          let parent1Node: TabNode | null = null;
          let parent2Node: TabNode | null = null;

          for (const windowState of treeState.windows) {
            for (const viewState of windowState.views) {
              if (!parent1Node) parent1Node = findNode(viewState.rootNodes, parent1Id);
              if (!parent2Node) parent2Node = findNode(viewState.rootNodes, parent2Id);
            }
          }

          if (!parent1Node || !parent2Node) return null;
          return {
            parent1Expanded: parent1Node.isExpanded,
            parent2Expanded: parent2Node.isExpanded,
          };
        }, { parent1Id: parent1, parent2Id: parent2 });
        return states?.parent1Expanded === true && states?.parent2Expanded === false;
      }, { timeout: 5000, timeoutMessage: 'Expand states were not saved to storage' });

      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      await waitForCondition(async () => {
        const p1Node = sidePanelPage.locator(`[data-testid="tree-node-${parent1}"]`);
        const p2Node = sidePanelPage.locator(`[data-testid="tree-node-${parent2}"]`);
        return (await p1Node.count()) > 0 && (await p2Node.count()) > 0;
      }, { timeout: 10000, timeoutMessage: 'Parent tabs not visible after reload' });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parent1, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: parent2, depth: 0, expanded: false },
      ], 0);

      const parent2NodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parent2}"]`).first();
      // 折りたたみ中はオーバーレイが常に表示されているので、直接クリックできる
      const expandOverlay2After = parent2NodeAfter.locator('[data-testid="expand-overlay"]');
      await expandOverlay2After.first().click();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parent1, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: parent2, depth: 0, expanded: true },
        { tabId: child2, depth: 1 },
      ], 0);
    });

    test('複数回の折りたたみ操作後もストレージが正しく更新されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      const parentNode3 = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();

      const getExpandedFromStorage = async () => {
        return await serviceWorker.evaluate(async (parentId) => {
          interface TabNode {
            tabId: number;
            isExpanded: boolean;
            children: TabNode[];
          }
          interface ViewState {
            rootNodes: TabNode[];
          }
          interface WindowState {
            windowId: number;
            views: ViewState[];
          }
          interface TreeState {
            windows: WindowState[];
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as TreeState | undefined;
          if (!treeState?.windows) return null;

          const findNode = (nodes: TabNode[], targetTabId: number): TabNode | null => {
            for (const node of nodes) {
              if (node.tabId === targetTabId) return node;
              const found = findNode(node.children, targetTabId);
              if (found) return found;
            }
            return null;
          };

          for (const windowState of treeState.windows) {
            for (const viewState of windowState.views) {
              const node = findNode(viewState.rootNodes, parentId);
              if (node) return node.isExpanded;
            }
          }
          return null;
        }, parentTab);
      };

      await waitForCondition(async () => (await getExpandedFromStorage()) === true, {
        timeout: 3000,
        timeoutMessage: 'Expanded state (true) was not saved to storage',
      });

      // 展開中はホバーでオーバーレイが表示されるので、まずホバーする
      await parentNode3.hover();
      const expandOverlay4 = parentNode3.locator('[data-testid="expand-overlay"]');
      await expandOverlay4.first().click();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: false },
      ], 0);
      await waitForCondition(async () => (await getExpandedFromStorage()) === false, {
        timeout: 3000,
        timeoutMessage: 'Collapsed state (false) was not saved to storage',
      });

      // 折りたたみ中はオーバーレイが常に表示されているので、直接クリックできる
      await expandOverlay4.first().click();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);
      await waitForCondition(async () => (await getExpandedFromStorage()) === true, {
        timeout: 3000,
        timeoutMessage: 'Expanded state (true) was not saved to storage after toggle',
      });
    });
  });
});
