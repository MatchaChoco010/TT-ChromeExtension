import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getPseudoSidePanelTabId, getCurrentWindowId, getInitialBrowserTabId } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ブラウザ再起動時のツリー構造復元', () => {
  test('treeStructureがストレージに正しく保存される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await waitForTabInTreeState(extensionContext, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);
    await waitForTabInTreeState(extensionContext, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    interface TreeStructureEntry {
      url: string;
      parentIndex: number | null;
      index: number;
      viewId: string;
      isExpanded: boolean;
    }
    interface TreeState {
      treeStructure?: TreeStructureEntry[];
    }

    let treeStructure: TreeStructureEntry[] | undefined;
    await waitForCondition(async () => {
      treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: { url: string; parentIndex: number | null; index: number; viewId: string; isExpanded: boolean; }[] } | undefined;
        return treeState?.treeStructure;
      });
      return treeStructure !== undefined && treeStructure.length >= 2;
    }, { timeout: 5000, timeoutMessage: 'treeStructure was not saved to storage' });

    const parentEntry = treeStructure!.find(e => e.url === 'https://example.com/parent');
    const childEntry = treeStructure!.find(e => e.url === 'https://example.com/child');

    expect(parentEntry).toBeDefined();
    expect(childEntry).toBeDefined();
    expect(parentEntry!.parentIndex).toBeNull();
    expect(childEntry!.parentIndex).not.toBeNull();

    const parentIndex = treeStructure!.findIndex(e => e.url === 'https://example.com/parent');
    expect(childEntry!.parentIndex).toBe(parentIndex);
  });

  test('深い階層のツリーがtreeStructureに正しく保存される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await waitForTabInTreeState(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(extensionContext, 'https://example.com/B', tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(extensionContext, 'https://example.com/C', tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const tabDId = await createTab(extensionContext, 'https://example.com/D', tabCId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2, expanded: true },
      { tabId: tabDId, depth: 3 },
    ], 0);

    interface TreeStructureEntry {
      url: string;
      parentIndex: number | null;
      index: number;
      viewId: string;
      isExpanded: boolean;
    }

    let treeStructure: TreeStructureEntry[] | undefined;
    await waitForCondition(async () => {
      treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: { url: string; parentIndex: number | null; index: number; viewId: string; isExpanded: boolean; }[] } | undefined;
        return treeState?.treeStructure;
      });
      if (!treeStructure) return false;
      const hasA = treeStructure.some(e => e.url === 'https://example.com/A');
      const hasB = treeStructure.some(e => e.url === 'https://example.com/B');
      const hasC = treeStructure.some(e => e.url === 'https://example.com/C');
      const hasD = treeStructure.some(e => e.url === 'https://example.com/D');
      return hasA && hasB && hasC && hasD;
    }, { timeout: 5000, timeoutMessage: 'treeStructure was not saved to storage with all tabs' });

    const entryA = treeStructure!.find(e => e.url === 'https://example.com/A');
    const entryB = treeStructure!.find(e => e.url === 'https://example.com/B');
    const entryC = treeStructure!.find(e => e.url === 'https://example.com/C');
    const entryD = treeStructure!.find(e => e.url === 'https://example.com/D');

    const indexA = treeStructure!.findIndex(e => e.url === 'https://example.com/A');
    const indexB = treeStructure!.findIndex(e => e.url === 'https://example.com/B');
    const indexC = treeStructure!.findIndex(e => e.url === 'https://example.com/C');

    expect(entryA!.parentIndex).toBeNull();
    expect(entryB!.parentIndex).toBe(indexA);
    expect(entryC!.parentIndex).toBe(indexB);
    expect(entryD!.parentIndex).toBe(indexC);
  });

  test('syncWithChromeTabsがtreeStructureから親子関係を復元する', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await waitForTabInTreeState(extensionContext, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);
    await waitForTabInTreeState(extensionContext, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    const grandchildTabId = await createTab(extensionContext, 'https://example.com/grandchild', childTabId);
    await waitForTabInTreeState(extensionContext, grandchildTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1, expanded: true },
      { tabId: grandchildTabId, depth: 2 },
    ], 0);

    await waitForCondition(async () => {
      const hasTreeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: unknown[] } | undefined;
        return treeState?.treeStructure && treeState.treeStructure.length > 0;
      });
      return hasTreeStructure;
    }, { timeout: 5000, timeoutMessage: 'treeStructure was not saved to storage' });

    await serviceWorker.evaluate(async () => {
      interface TreeState {
        views?: unknown[];
        currentViewId?: string;
        nodes?: Record<string, unknown>;
        tabToNode?: Record<number, string>;
        treeStructure?: unknown[];
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;

      if (treeState) {
        // タブIDが変わった状態をシミュレート: nodesとtabToNodeをクリア
        const clearedState = {
          ...treeState,
          nodes: {},
          tabToNode: {},
        };
        await chrome.storage.local.set({ tree_state: clearedState });

        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.loadState();
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.syncWithChromeTabs();
        }
      }
    });

    interface RelationsResult {
      valid: boolean;
      reason?: string;
      parentNodeId?: string;
      childNodeId?: string;
      grandchildNodeId?: string;
      childParentId?: string | null;
      grandchildParentId?: string | null;
      expectedParentId?: string;
    }

    let relationsValid: RelationsResult = { valid: false };
    await waitForCondition(async () => {
      relationsValid = await serviceWorker.evaluate(
        async ({ parentTabId, childTabId, grandchildTabId }) => {
          interface TreeNode {
            parentId: string | null;
            depth: number;
          }
          interface LocalTreeState {
            tabToNode: Record<number, string>;
            nodes: Record<string, TreeNode>;
          }

          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;

          if (!treeState?.nodes || !treeState?.tabToNode) {
            return { valid: false, reason: 'No tree state' };
          }

          const parentNodeId = treeState.tabToNode[parentTabId];
          const childNodeId = treeState.tabToNode[childTabId];
          const grandchildNodeId = treeState.tabToNode[grandchildTabId];

          if (!parentNodeId || !childNodeId || !grandchildNodeId) {
            return {
              valid: false,
              reason: 'Missing node IDs',
              parentNodeId,
              childNodeId,
              grandchildNodeId,
            };
          }

          const parentNode = treeState.nodes[parentNodeId];
          const childNode = treeState.nodes[childNodeId];
          const grandchildNode = treeState.nodes[grandchildNodeId];

          if (parentNode.parentId !== null) {
            return { valid: false, reason: 'Parent should be root' };
          }
          if (childNode.parentId !== parentNodeId) {
            return {
              valid: false,
              reason: 'Child should be child of parent',
              childParentId: childNode.parentId,
              expectedParentId: parentNodeId,
            };
          }
          if (grandchildNode.parentId !== childNodeId) {
            return {
              valid: false,
              reason: 'Grandchild should be child of child',
              grandchildParentId: grandchildNode.parentId,
              expectedParentId: childNodeId,
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

  test('D&Dで作成した親子関係がtreeStructureに保存され、復元される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    test.setTimeout(120000);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTabId = await createTab(extensionContext, 'https://example.com/dnd-parent');
    await waitForTabInTreeState(extensionContext, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(extensionContext, 'https://example.com/dnd-child');
    await waitForTabInTreeState(extensionContext, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTabId, parentTabId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    interface TreeStructureEntry {
      url: string;
      parentIndex: number | null;
      index: number;
      viewId: string;
      isExpanded: boolean;
    }

    let treeStructure: TreeStructureEntry[] | undefined;
    let parentEntry: TreeStructureEntry | undefined;
    let childEntry: TreeStructureEntry | undefined;

    await waitForCondition(async () => {
      treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: { url: string; parentIndex: number | null; index: number; viewId: string; isExpanded: boolean; }[] } | undefined;
        return treeState?.treeStructure;
      });
      if (!treeStructure) return false;

      parentEntry = treeStructure.find(e => e.url === 'https://example.com/dnd-parent');
      childEntry = treeStructure.find(e => e.url === 'https://example.com/dnd-child');

      if (!parentEntry || !childEntry) return false;
      if (parentEntry.parentIndex !== null) return false;
      if (childEntry.parentIndex === null) return false;

      const parentIndex = treeStructure.findIndex(e => e.url === 'https://example.com/dnd-parent');
      return childEntry.parentIndex === parentIndex;
    }, { timeout: 5000, timeoutMessage: 'D&D parent-child relation was not saved to treeStructure' });

    await serviceWorker.evaluate(async () => {
      interface TreeState {
        views?: unknown[];
        currentViewId?: string;
        nodes?: Record<string, unknown>;
        tabToNode?: Record<number, string>;
        treeStructure?: unknown[];
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;

      if (treeState) {
        const clearedState = {
          ...treeState,
          nodes: {},
          tabToNode: {},
        };
        await chrome.storage.local.set({ tree_state: clearedState });

        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.loadState();
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.syncWithChromeTabs();
        }
      }
    });

    interface DndRelationsResult {
      valid: boolean;
      reason?: string;
      parentNodeId?: string;
      childNodeId?: string;
      childParentId?: string | null;
      expectedParentId?: string;
    }

    let relationsValid: DndRelationsResult = { valid: false };
    await waitForCondition(async () => {
      relationsValid = await serviceWorker.evaluate(
        async ({ parentTabId, childTabId }) => {
          interface TreeNode {
            parentId: string | null;
            depth: number;
          }
          interface LocalTreeState {
            tabToNode: Record<number, string>;
            nodes: Record<string, TreeNode>;
          }

          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;

          if (!treeState?.nodes || !treeState?.tabToNode) {
            return { valid: false, reason: 'No tree state' };
          }

          const parentNodeId = treeState.tabToNode[parentTabId];
          const childNodeId = treeState.tabToNode[childTabId];

          if (!parentNodeId || !childNodeId) {
            return {
              valid: false,
              reason: 'Missing node IDs',
              parentNodeId,
              childNodeId,
            };
          }

          const parentNode = treeState.nodes[parentNodeId];
          const childNode = treeState.nodes[childNodeId];

          if (!parentNode || !childNode) {
            return { valid: false, reason: 'Missing nodes' };
          }

          if (parentNode.parentId !== null) {
            return { valid: false, reason: 'Parent should be root' };
          }
          if (childNode.parentId !== parentNodeId) {
            return {
              valid: false,
              reason: 'Child should be child of parent',
              childParentId: childNode.parentId,
              expectedParentId: parentNodeId,
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
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0, { timeout: 5000 });
  });

  test('treeStructureからviewIdが正しく復元される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabAId = await createTab(extensionContext, 'about:blank');
    await waitForTabInTreeState(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    interface TreeStructureEntry {
      url: string;
      parentIndex: number | null;
      index: number;
      viewId: string;
      isExpanded: boolean;
    }

    await waitForCondition(async () => {
      const ts = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: TreeStructureEntry[] } | undefined;
        return treeState?.treeStructure;
      });
      return ts !== undefined && ts.length >= 2;
    }, { timeout: 5000, timeoutMessage: 'Tab not in treeStructure' });

    await serviceWorker.evaluate(async ({ tabAId }) => {
      const result = await chrome.storage.local.get('tree_state');
      interface StoredTreeState {
        views?: Array<{ id: string; name: string; color: string }>;
        currentViewId?: string;
        nodes?: Record<string, { tabId: number; viewId: string }>;
        tabToNode?: Record<number, string>;
        treeStructure?: Array<{
          url: string;
          parentIndex: number | null;
          index: number;
          viewId: string;
          isExpanded: boolean;
        }>;
      }
      const treeState = result.tree_state as StoredTreeState | undefined;
      if (!treeState?.treeStructure || !treeState?.tabToNode) return;

      const newViews = [
        { id: 'default', name: 'Default', color: '#3b82f6' },
        { id: 'custom-view', name: 'Custom View', color: '#10b981' },
      ];

      const nodeId = treeState.tabToNode[tabAId];
      const tabIndex = nodeId
        ? Object.entries(treeState.nodes || {}).find(([id]) => id === nodeId)?.[1]
        : null;

      const updatedTreeStructure = treeState.treeStructure.map((entry, idx) => {
        if (idx === 1) {
          return { ...entry, viewId: 'custom-view' };
        }
        return entry;
      });

      const updatedState = {
        ...treeState,
        views: newViews,
        treeStructure: updatedTreeStructure,
      };
      await chrome.storage.local.set({ tree_state: updatedState });
    }, { tabAId });

    await serviceWorker.evaluate(async () => {
      interface StoredTreeState {
        views?: unknown[];
        currentViewId?: string;
        nodes?: Record<string, unknown>;
        tabToNode?: Record<number, string>;
        treeStructure?: unknown[];
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as StoredTreeState | undefined;

      if (treeState) {
        const clearedState = {
          ...treeState,
          nodes: {},
          tabToNode: {},
        };
        await chrome.storage.local.set({ tree_state: clearedState });

        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.loadState();
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.syncWithChromeTabs();
        }
      }
    });

    interface ViewIdResult {
      valid: boolean;
      reason?: string;
      viewId?: string;
      expectedViewId?: string;
    }

    let viewIdValid: ViewIdResult = { valid: false };
    await waitForCondition(async () => {
      viewIdValid = await serviceWorker.evaluate(
        async ({ tabAId }) => {
          interface TreeNode {
            viewId: string;
          }
          interface LocalTreeState {
            tabToNode: Record<number, string>;
            nodes: Record<string, TreeNode>;
          }

          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;

          if (!treeState?.nodes || !treeState?.tabToNode) {
            return { valid: false, reason: 'No tree state' };
          }

          const nodeId = treeState.tabToNode[tabAId];
          if (!nodeId) {
            return { valid: false, reason: 'Node not found for tabAId' };
          }

          const node = treeState.nodes[nodeId];
          if (!node) {
            return { valid: false, reason: 'Node object not found' };
          }

          if (node.viewId !== 'custom-view') {
            return {
              valid: false,
              reason: 'ViewId mismatch',
              viewId: node.viewId,
              expectedViewId: 'custom-view',
            };
          }

          return { valid: true };
        },
        { tabAId }
      );
      return viewIdValid.valid;
    }, { timeout: 5000, timeoutMessage: 'ViewId was not restored correctly' });

    expect(viewIdValid).toEqual({ valid: true });
  });
});
