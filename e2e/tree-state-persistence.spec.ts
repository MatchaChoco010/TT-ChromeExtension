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
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      const parentIdInStorage = await serviceWorker.evaluate(async ({ childId, parentId }) => {
        interface TreeNode {
          id: string;
          tabId: number;
          parentId: string | null;
        }
        interface ViewState {
          nodes: Record<string, TreeNode>;
        }
        interface LocalTreeState {
          tabToNode: Record<number, { viewId: string; nodeId: string }>;
          views: Record<string, ViewState>;
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.views || !treeState?.tabToNode) return { found: false, parentNodeId: null };

        const childNodeInfo = treeState.tabToNode[childId];
        const parentNodeInfo = treeState.tabToNode[parentId];
        if (!childNodeInfo || !parentNodeInfo) return { found: false, parentNodeId: null };

        const viewState = treeState.views[childNodeInfo.viewId];
        if (!viewState) return { found: false, parentNodeId: null };
        const childNode = viewState.nodes[childNodeInfo.nodeId];
        return { found: true, parentNodeId: childNode?.parentId, expectedParentNodeId: parentNodeInfo.nodeId };
      }, { childId: childTab, parentId: parentTab });

      expect(parentIdInStorage.found).toBe(true);
      expect(parentIdInStorage.parentNodeId).toBe(parentIdInStorage.expectedParentNodeId);
    });

    test('サイドパネルリロード後に親子関係が復元されること', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, pseudoSidePanelTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
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
      { tabId: pseudoSidePanelTabId, depth: 0 },
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
      const { initialBrowserTabId, pseudoSidePanelTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const rootTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      const grandchildTab = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTab, depth: 0 },
        { tabId: childTab, depth: 0 },
        { tabId: grandchildTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, rootTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
        { tabId: grandchildTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, grandchildTab, childTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
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
      { tabId: pseudoSidePanelTabId, depth: 0 },
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
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface ViewState {
            nodes: Record<string, TreeNode>;
          }
          interface LocalTreeState {
            tabToNode: Record<number, { viewId: string; nodeId: string }>;
            views: Record<string, ViewState>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.views || !treeState?.tabToNode) return null;

          const nodeInfo = treeState.tabToNode[parentId];
          if (!nodeInfo) return null;

          const viewState = treeState.views[nodeInfo.viewId];
          if (!viewState) return null;
          const node = viewState.nodes[nodeInfo.nodeId];
          return node?.isExpanded ?? null;
        }, parentTab);
        return isExpandedInStorage === true;
      }, { timeout: 5000, timeoutMessage: 'Expanded state was not saved to storage' });

      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expandButton.first().click();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: false },
      ], 0);

      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface ViewState {
            nodes: Record<string, TreeNode>;
          }
          interface LocalTreeState {
            tabToNode: Record<number, { viewId: string; nodeId: string }>;
            views: Record<string, ViewState>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.views || !treeState?.tabToNode) return null;

          const nodeInfo = treeState.tabToNode[parentId];
          if (!nodeInfo) return null;

          const viewState = treeState.views[nodeInfo.viewId];
          if (!viewState) return null;
          const node = viewState.nodes[nodeInfo.nodeId];
          return node?.isExpanded ?? null;
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
      const { initialBrowserTabId, pseudoSidePanelTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expandButton.first().click();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: false },
      ], 0);

      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface ViewState {
            nodes: Record<string, TreeNode>;
          }
          interface LocalTreeState {
            tabToNode: Record<number, { viewId: string; nodeId: string }>;
            views: Record<string, ViewState>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.views || !treeState?.tabToNode) return null;

          const nodeInfo = treeState.tabToNode[parentId];
          if (!nodeInfo) return null;

          const viewState = treeState.views[nodeInfo.viewId];
          if (!viewState) return null;
          const node = viewState.nodes[nodeInfo.nodeId];
          return node?.isExpanded ?? null;
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
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: false },
      ], 0);
    });

    test('サイドパネルリロード後に折りたたみ状態が復元されること（展開状態）', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, pseudoSidePanelTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface ViewState {
            nodes: Record<string, TreeNode>;
          }
          interface LocalTreeState {
            tabToNode: Record<number, { viewId: string; nodeId: string }>;
            views: Record<string, ViewState>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.views || !treeState?.tabToNode) return null;

          const nodeInfo = treeState.tabToNode[parentId];
          if (!nodeInfo) return null;

          const viewState = treeState.views[nodeInfo.viewId];
          if (!viewState) return null;
          const node = viewState.nodes[nodeInfo.nodeId];
          return node?.isExpanded ?? null;
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
      { tabId: pseudoSidePanelTabId, depth: 0 },
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
      const { initialBrowserTabId, pseudoSidePanelTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parent1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parent1, depth: 0 },
      ], 0);

      const child1 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parent1, depth: 0 },
        { tabId: child1, depth: 0 },
      ], 0);

      const parent2 = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parent1, depth: 0 },
        { tabId: child1, depth: 0 },
        { tabId: parent2, depth: 0 },
      ], 0);

      const child2 = await createTab(serviceWorker, getTestServerUrl('/page4'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parent1, depth: 0 },
        { tabId: child1, depth: 0 },
        { tabId: parent2, depth: 0 },
        { tabId: child2, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child1, parent1, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parent1, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: parent2, depth: 0 },
        { tabId: child2, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child2, parent2, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parent1, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: parent2, depth: 0, expanded: true },
        { tabId: child2, depth: 1 },
      ], 0);

      const parent2Node = sidePanelPage.locator(`[data-testid="tree-node-${parent2}"]`).first();
      const expandButton2 = parent2Node.locator('[data-testid="expand-button"]');
      await expandButton2.first().click();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parent1, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: parent2, depth: 0, expanded: false },
      ], 0);

      await waitForCondition(async () => {
        const states = await serviceWorker.evaluate(async ({ parent1Id, parent2Id }) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface ViewState {
            nodes: Record<string, TreeNode>;
          }
          interface LocalTreeState {
            tabToNode: Record<number, { viewId: string; nodeId: string }>;
            views: Record<string, ViewState>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.views || !treeState?.tabToNode) return null;

          const node1Info = treeState.tabToNode[parent1Id];
          const node2Info = treeState.tabToNode[parent2Id];
          if (!node1Info || !node2Info) return null;

          const viewState1 = treeState.views[node1Info.viewId];
          const viewState2 = treeState.views[node2Info.viewId];
          if (!viewState1 || !viewState2) return null;

          const node1 = viewState1.nodes[node1Info.nodeId];
          const node2 = viewState2.nodes[node2Info.nodeId];
          return {
            parent1Expanded: node1?.isExpanded,
            parent2Expanded: node2?.isExpanded,
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
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parent1, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: parent2, depth: 0, expanded: false },
      ], 0);

      const parent2NodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parent2}"]`).first();
      const expandButton2After = parent2NodeAfter.locator('[data-testid="expand-button"]');
      await expandButton2After.first().click();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
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
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');

      const getExpandedFromStorage = async () => {
        return await serviceWorker.evaluate(async (parentId) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface ViewState {
            nodes: Record<string, TreeNode>;
          }
          interface LocalTreeState {
            tabToNode: Record<number, { viewId: string; nodeId: string }>;
            views: Record<string, ViewState>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.views || !treeState?.tabToNode) return null;

          const nodeInfo = treeState.tabToNode[parentId];
          if (!nodeInfo) return null;

          const viewState = treeState.views[nodeInfo.viewId];
          if (!viewState) return null;
          const node = viewState.nodes[nodeInfo.nodeId];
          return node?.isExpanded ?? null;
        }, parentTab);
      };

      await waitForCondition(async () => (await getExpandedFromStorage()) === true, {
        timeout: 3000,
        timeoutMessage: 'Expanded state (true) was not saved to storage',
      });

      await expandButton.first().click();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: false },
      ], 0);
      await waitForCondition(async () => (await getExpandedFromStorage()) === false, {
        timeout: 3000,
        timeoutMessage: 'Collapsed state (false) was not saved to storage',
      });

      await expandButton.first().click();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
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
