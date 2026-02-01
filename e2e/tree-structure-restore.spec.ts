import { test, expect } from './fixtures/extension';
import { createTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ブラウザ再起動時のツリー構造復元', () => {
  test('ツリー構造がストレージに正しく保存される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));
    await waitForTabInTreeState(serviceWorker, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/child'), parentTabId);
    await waitForTabInTreeState(serviceWorker, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    interface ParentChildResult {
      valid: boolean;
      reason?: string;
      parentFound?: boolean;
      childFound?: boolean;
      childParentTabId?: number | null;
      expectedParentTabId?: number;
    }

    let parentChildResult: ParentChildResult = { valid: false };
    await waitForCondition(async () => {
      parentChildResult = await serviceWorker.evaluate(async ({ parentTabId, childTabId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
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
        if (!treeState?.windows) {
          return { valid: false, reason: 'No tree state' };
        }

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

        let parentResult: { node: TabNode; parent: TabNode | null } | null = null;
        let childResult: { node: TabNode; parent: TabNode | null } | null = null;

        for (const windowState of treeState.windows) {
          for (const viewState of windowState.views) {
            if (!parentResult) parentResult = findNodeWithParent(viewState.rootNodes, parentTabId, null);
            if (!childResult) childResult = findNodeWithParent(viewState.rootNodes, childTabId, null);
          }
        }

        if (!parentResult) {
          return { valid: false, reason: 'Parent not found', parentFound: false };
        }
        if (!childResult) {
          return { valid: false, reason: 'Child not found', childFound: false };
        }

        if (parentResult.parent !== null) {
          return { valid: false, reason: 'Parent should be root' };
        }

        if (childResult.parent?.tabId !== parentTabId) {
          return {
            valid: false,
            reason: 'Child should be child of parent',
            childParentTabId: childResult.parent?.tabId ?? null,
            expectedParentTabId: parentTabId,
          };
        }

        return { valid: true };
      }, { parentTabId, childTabId });
      return parentChildResult.valid;
    }, { timeout: 5000, timeoutMessage: 'Parent-child relationship was not saved correctly' });

    expect(parentChildResult).toEqual({ valid: true });
  });

  test('深い階層のツリーが正しく保存される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    const tabAId = await createTab(serviceWorker, getTestServerUrl('/A'));
    await waitForTabInTreeState(serviceWorker, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(serviceWorker, getTestServerUrl('/B'), tabAId);
    await waitForTabInTreeState(serviceWorker, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(serviceWorker, getTestServerUrl('/C'), tabBId);
    await waitForTabInTreeState(serviceWorker, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const tabDId = await createTab(serviceWorker, getTestServerUrl('/D'), tabCId);
    await waitForTabInTreeState(serviceWorker, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2, expanded: true },
      { tabId: tabDId, depth: 3 },
    ], 0);

    interface DeepHierarchyResult {
      valid: boolean;
      reason?: string;
      tabAParent?: number | null;
      tabBParent?: number | null;
      tabCParent?: number | null;
      tabDParent?: number | null;
    }

    let hierarchyResult: DeepHierarchyResult = { valid: false };
    await waitForCondition(async () => {
      hierarchyResult = await serviceWorker.evaluate(async ({ tabAId, tabBId, tabCId, tabDId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
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
        if (!treeState?.windows) {
          return { valid: false, reason: 'No tree state' };
        }

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

        let resultA: { node: TabNode; parent: TabNode | null } | null = null;
        let resultB: { node: TabNode; parent: TabNode | null } | null = null;
        let resultC: { node: TabNode; parent: TabNode | null } | null = null;
        let resultD: { node: TabNode; parent: TabNode | null } | null = null;

        for (const windowState of treeState.windows) {
          for (const viewState of windowState.views) {
            if (!resultA) resultA = findNodeWithParent(viewState.rootNodes, tabAId, null);
            if (!resultB) resultB = findNodeWithParent(viewState.rootNodes, tabBId, null);
            if (!resultC) resultC = findNodeWithParent(viewState.rootNodes, tabCId, null);
            if (!resultD) resultD = findNodeWithParent(viewState.rootNodes, tabDId, null);
          }
        }

        if (!resultA || !resultB || !resultC || !resultD) {
          return { valid: false, reason: 'Not all tabs found' };
        }

        if (resultA.parent !== null) {
          return { valid: false, reason: 'A should be root', tabAParent: resultA.parent?.tabId };
        }

        if (resultB.parent?.tabId !== tabAId) {
          return { valid: false, reason: 'B should be child of A', tabBParent: resultB.parent?.tabId ?? null };
        }

        if (resultC.parent?.tabId !== tabBId) {
          return { valid: false, reason: 'C should be child of B', tabCParent: resultC.parent?.tabId ?? null };
        }

        if (resultD.parent?.tabId !== tabCId) {
          return { valid: false, reason: 'D should be child of C', tabDParent: resultD.parent?.tabId ?? null };
        }

        return { valid: true };
      }, { tabAId, tabBId, tabCId, tabDId });
      return hierarchyResult.valid;
    }, { timeout: 5000, timeoutMessage: 'Deep hierarchy was not saved correctly' });

    expect(hierarchyResult).toEqual({ valid: true });
  });

  test('loadStateが親子関係を復元する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));
    await waitForTabInTreeState(serviceWorker, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/child'), parentTabId);
    await waitForTabInTreeState(serviceWorker, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    const grandchildTabId = await createTab(serviceWorker, getTestServerUrl('/grandchild'), childTabId);
    await waitForTabInTreeState(serviceWorker, grandchildTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1, expanded: true },
      { tabId: grandchildTabId, depth: 2 },
    ], 0);

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
        return tabCount > 0;
      });
      return Boolean(hasTabsInTree);
    }, { timeout: 5000, timeoutMessage: 'Tree state was not saved to storage' });

    await serviceWorker.evaluate(async () => {
      // @ts-expect-error accessing global treeStateManager
      if (globalThis.treeStateManager) {
        // @ts-expect-error accessing internal windows array
        globalThis.treeStateManager.windows = [];
        // @ts-expect-error accessing global treeStateManager
        await globalThis.treeStateManager.loadState();
      }
    });

    interface RelationsResult {
      valid: boolean;
      reason?: string;
      parentTabId?: number;
      childTabId?: number;
      grandchildTabId?: number;
      actualChildParentTabId?: number | null;
      actualGrandchildParentTabId?: number | null;
    }

    let relationsValid: RelationsResult = { valid: false };
    await waitForCondition(async () => {
      relationsValid = await serviceWorker.evaluate(
        async ({ parentTabId, childTabId, grandchildTabId }) => {
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

          if (!treeState?.windows) {
            return { valid: false, reason: 'No tree state' };
          }

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

          let parentResult: { node: TabNode; parent: TabNode | null } | null = null;
          let childResult: { node: TabNode; parent: TabNode | null } | null = null;
          let grandchildResult: { node: TabNode; parent: TabNode | null } | null = null;

          for (const windowState of treeState.windows) {
            for (const viewState of windowState.views) {
              if (!parentResult) parentResult = findNodeWithParent(viewState.rootNodes, parentTabId, null);
              if (!childResult) childResult = findNodeWithParent(viewState.rootNodes, childTabId, null);
              if (!grandchildResult) grandchildResult = findNodeWithParent(viewState.rootNodes, grandchildTabId, null);
            }
          }

          if (!parentResult || !childResult || !grandchildResult) {
            return {
              valid: false,
              reason: 'Missing nodes',
              parentTabId: parentResult?.node.tabId,
              childTabId: childResult?.node.tabId,
              grandchildTabId: grandchildResult?.node.tabId,
            };
          }

          if (parentResult.parent !== null) {
            return { valid: false, reason: 'Parent should be root' };
          }

          if (childResult.parent?.tabId !== parentTabId) {
            return {
              valid: false,
              reason: 'Child should be child of parent',
              actualChildParentTabId: childResult.parent?.tabId ?? null,
            };
          }

          if (grandchildResult.parent?.tabId !== childTabId) {
            return {
              valid: false,
              reason: 'Grandchild should be child of child',
              actualGrandchildParentTabId: grandchildResult.parent?.tabId ?? null,
            };
          }

          return { valid: true };
        },
        { parentTabId, childTabId, grandchildTabId }
      );
      return relationsValid.valid;
    }, { timeout: 5000, timeoutMessage: 'Tree relations were not restored correctly' });

    expect(relationsValid).toEqual({ valid: true });
  });

  test('D&Dで作成した親子関係が保存され、復元される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    test.setTimeout(120000);

    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/dnd-parent'));
    await waitForTabInTreeState(serviceWorker, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/dnd-child'));
    await waitForTabInTreeState(serviceWorker, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTabId, parentTabId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    interface DndSaveResult {
      valid: boolean;
      reason?: string;
      parentFound?: boolean;
      childFound?: boolean;
      childParentTabId?: number | null;
    }

    let dndSaveResult: DndSaveResult = { valid: false };
    await waitForCondition(async () => {
      dndSaveResult = await serviceWorker.evaluate(async ({ parentTabId, childTabId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
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
        if (!treeState?.windows) {
          return { valid: false, reason: 'No tree state' };
        }

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

        let parentResult: { node: TabNode; parent: TabNode | null } | null = null;
        let childResult: { node: TabNode; parent: TabNode | null } | null = null;

        for (const windowState of treeState.windows) {
          for (const viewState of windowState.views) {
            if (!parentResult) parentResult = findNodeWithParent(viewState.rootNodes, parentTabId, null);
            if (!childResult) childResult = findNodeWithParent(viewState.rootNodes, childTabId, null);
          }
        }

        if (!parentResult) {
          return { valid: false, reason: 'Parent not found', parentFound: false };
        }
        if (!childResult) {
          return { valid: false, reason: 'Child not found', childFound: false };
        }

        if (parentResult.parent !== null) {
          return { valid: false, reason: 'Parent should be root' };
        }

        if (childResult.parent?.tabId !== parentTabId) {
          return {
            valid: false,
            reason: 'Child should be child of parent',
            childParentTabId: childResult.parent?.tabId ?? null,
          };
        }

        return { valid: true };
      }, { parentTabId, childTabId });
      return dndSaveResult.valid;
    }, { timeout: 5000, timeoutMessage: 'D&D parent-child relation was not saved correctly' });

    await serviceWorker.evaluate(async () => {
      // @ts-expect-error accessing global treeStateManager
      if (globalThis.treeStateManager) {
        // @ts-expect-error accessing internal windows array
        globalThis.treeStateManager.windows = [];
        // @ts-expect-error accessing global treeStateManager
        await globalThis.treeStateManager.loadState();
      }
    });

    interface DndRelationsResult {
      valid: boolean;
      reason?: string;
      parentTabId?: number;
      childTabId?: number;
      actualChildParentTabId?: number | null;
    }

    let relationsValid: DndRelationsResult = { valid: false };
    await waitForCondition(async () => {
      relationsValid = await serviceWorker.evaluate(
        async ({ parentTabId, childTabId }) => {
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

          if (!treeState?.windows) {
            return { valid: false, reason: 'No tree state' };
          }

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

          let parentResult: { node: TabNode; parent: TabNode | null } | null = null;
          let childResult: { node: TabNode; parent: TabNode | null } | null = null;

          for (const windowState of treeState.windows) {
            for (const viewState of windowState.views) {
              if (!parentResult) parentResult = findNodeWithParent(viewState.rootNodes, parentTabId, null);
              if (!childResult) childResult = findNodeWithParent(viewState.rootNodes, childTabId, null);
            }
          }

          if (!parentResult || !childResult) {
            return {
              valid: false,
              reason: 'Missing nodes',
              parentTabId: parentResult?.node.tabId,
              childTabId: childResult?.node.tabId,
            };
          }

          if (parentResult.parent !== null) {
            return { valid: false, reason: 'Parent should be root' };
          }

          if (childResult.parent?.tabId !== parentTabId) {
            return {
              valid: false,
              reason: 'Child should be child of parent',
              actualChildParentTabId: childResult.parent?.tabId ?? null,
            };
          }

          return { valid: true };
        },
        { parentTabId, childTabId }
      );
      return relationsValid.valid;
    }, { timeout: 5000, timeoutMessage: 'D&D tree relations were not restored correctly' });

    expect(relationsValid).toEqual({ valid: true });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0, { timeout: 5000 });
  });

  test('タブが正しいビューに復元される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    const tabAId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await waitForTabInTreeState(serviceWorker, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    await waitForCondition(async () => {
      const found = await serviceWorker.evaluate(async ({ tabAId }) => {
        interface TabNode {
          tabId: number;
          children: TabNode[];
        }
        interface TreeState {
          windows: { views: { rootNodes: TabNode[] }[] }[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return false;

        const findNode = (nodes: TabNode[], targetTabId: number): boolean => {
          for (const node of nodes) {
            if (node.tabId === targetTabId) return true;
            if (findNode(node.children, targetTabId)) return true;
          }
          return false;
        };

        for (const windowState of treeState.windows) {
          for (const viewState of windowState.views) {
            if (findNode(viewState.rootNodes, tabAId)) return true;
          }
        }
        return false;
      }, { tabAId });
      return found;
    }, { timeout: 5000, timeoutMessage: 'Tab not in storage' });

    // Move the tab to a second view (viewIndex=1) by manipulating storage directly
    await serviceWorker.evaluate(async ({ tabAId }) => {
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
      interface TreeState {
        windows: WindowState[];
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      if (!treeState?.windows?.[0]) return;

      const windowState = treeState.windows[0];

      // Add a second view if it doesn't exist
      if (windowState.views.length < 2) {
        windowState.views.push({
          name: 'Custom View',
          color: '#10b981',
          rootNodes: [],
        });
      }

      // Find the tab node in the first view
      const findAndRemove = (nodes: TabNode[], targetTabId: number): TabNode | null => {
        for (let i = 0; i < nodes.length; i++) {
          if (nodes[i].tabId === targetTabId) {
            return nodes.splice(i, 1)[0];
          }
          const found = findAndRemove(nodes[i].children, targetTabId);
          if (found) return found;
        }
        return null;
      };

      const tabNode = findAndRemove(windowState.views[0].rootNodes, tabAId);
      if (tabNode) {
        windowState.views[1].rootNodes.push(tabNode);
      }

      await chrome.storage.local.set({ tree_state: treeState });
    }, { tabAId });

    await serviceWorker.evaluate(async () => {
      // @ts-expect-error accessing global treeStateManager
      if (globalThis.treeStateManager) {
        // @ts-expect-error accessing internal windows array
        globalThis.treeStateManager.windows = [];
        // @ts-expect-error accessing global treeStateManager
        await globalThis.treeStateManager.loadState();
      }
    });

    interface ViewIndexResult {
      valid: boolean;
      reason?: string;
      viewIndex?: number;
      expectedViewIndex?: number;
    }

    let viewIndexValid: ViewIndexResult = { valid: false };
    await waitForCondition(async () => {
      viewIndexValid = await serviceWorker.evaluate(
        async ({ tabAId }) => {
          interface TabNode {
            tabId: number;
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }

          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as TreeState | undefined;

          if (!treeState?.windows?.[0]) {
            return { valid: false, reason: 'No tree state' };
          }

          const findNode = (nodes: TabNode[], targetTabId: number): boolean => {
            for (const node of nodes) {
              if (node.tabId === targetTabId) return true;
              if (findNode(node.children, targetTabId)) return true;
            }
            return false;
          };

          const windowState = treeState.windows[0];
          for (let i = 0; i < windowState.views.length; i++) {
            if (findNode(windowState.views[i].rootNodes, tabAId)) {
              // Tab found in viewIndex i - expect it to be in viewIndex 1
              if (i === 1) {
                return { valid: true };
              } else {
                return {
                  valid: false,
                  reason: 'ViewIndex mismatch',
                  viewIndex: i,
                  expectedViewIndex: 1,
                };
              }
            }
          }

          return { valid: false, reason: 'Tab not found in any view' };
        },
        { tabAId }
      );
      return viewIndexValid.valid;
    }, { timeout: 5000, timeoutMessage: 'ViewIndex was not restored correctly' });

    expect(viewIndexValid).toEqual({ valid: true });
  });
});
