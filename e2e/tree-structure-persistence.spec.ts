import { test, expect } from './fixtures/extension';
import { waitForCondition } from './utils/polling-utils';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId, collapseNode } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';
import './types';

interface TabNode {
  tabId: number;
  isExpanded: boolean;
  groupInfo?: { name: string; color: string };
  children: TabNode[];
}

interface ViewState {
  name: string;
  color: string;
  icon?: string;
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

function findNodeByTabId(nodes: TabNode[], tabId: number): TabNode | null {
  for (const node of nodes) {
    if (node.tabId === tabId) return node;
    const found = findNodeByTabId(node.children, tabId);
    if (found) return found;
  }
  return null;
}

function isChildOf(nodes: TabNode[], childTabId: number, parentTabId: number): boolean {
  const parentNode = findNodeByTabId(nodes, parentTabId);
  if (!parentNode) return false;
  return parentNode.children.some(child => child.tabId === childTabId);
}

test.describe('Tree Structure Persistence', () => {
  test.describe('複数階層の親子関係の永続化', () => {
    test('3階層（親→子→孫）の親子関係がtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const grandchildUrl = getTestServerUrl('/page3');
      const grandchildTabId = await createTab(serviceWorker, grandchildUrl, childTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2 },
      ], 0);

      await waitForCondition(async () => {
        const treeState = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('tree_state');
          return result.tree_state as TreeState | undefined;
        });
        if (!treeState?.windows) return false;
        const windowState = treeState.windows.find(w => w.windowId === windowId);
        if (!windowState) return false;
        const view = windowState.views[windowState.activeViewIndex];
        if (!view) return false;

        const parentNode = findNodeByTabId(view.rootNodes, parentTabId);
        const childNode = findNodeByTabId(view.rootNodes, childTabId);
        const grandchildNode = findNodeByTabId(view.rootNodes, grandchildTabId);

        return !!parentNode && !!childNode && !!grandchildNode;
      }, { timeout: 5000, timeoutMessage: 'tree_state did not contain expected tabs' });

      const treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state as TreeState;
      });

      expect(treeState.windows).toBeDefined();
      const windowState = treeState.windows.find(w => w.windowId === windowId);
      expect(windowState).toBeDefined();

      const view = windowState!.views[windowState!.activeViewIndex];
      expect(view).toBeDefined();

      expect(isChildOf(view.rootNodes, childTabId, parentTabId)).toBe(true);
      expect(isChildOf(view.rootNodes, grandchildTabId, childTabId)).toBe(true);

      await closeTab(serviceWorker, grandchildTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('4階層（親→子→孫→ひ孫）の親子関係がtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const grandchildUrl = getTestServerUrl('/page3');
      const grandchildTabId = await createTab(serviceWorker, grandchildUrl, childTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2 },
      ], 0);

      const greatGrandchildUrl = getTestServerUrl('/page4');
      const greatGrandchildTabId = await createTab(serviceWorker, greatGrandchildUrl, grandchildTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2, expanded: true },
        { tabId: greatGrandchildTabId, depth: 3 },
      ], 0);

      await waitForCondition(async () => {
        const treeState = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('tree_state');
          return result.tree_state as TreeState | undefined;
        });
        if (!treeState?.windows) return false;
        const windowState = treeState.windows.find(w => w.windowId === windowId);
        if (!windowState) return false;
        const view = windowState.views[windowState.activeViewIndex];
        if (!view) return false;

        return !!findNodeByTabId(view.rootNodes, parentTabId) &&
               !!findNodeByTabId(view.rootNodes, childTabId) &&
               !!findNodeByTabId(view.rootNodes, grandchildTabId) &&
               !!findNodeByTabId(view.rootNodes, greatGrandchildTabId);
      }, { timeout: 5000, timeoutMessage: 'tree_state did not contain expected tabs for 4 levels' });

      const treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state as TreeState;
      });

      const windowState = treeState.windows.find(w => w.windowId === windowId);
      const view = windowState!.views[windowState!.activeViewIndex];

      expect(isChildOf(view.rootNodes, childTabId, parentTabId)).toBe(true);
      expect(isChildOf(view.rootNodes, grandchildTabId, childTabId)).toBe(true);
      expect(isChildOf(view.rootNodes, greatGrandchildTabId, grandchildTabId)).toBe(true);

      await closeTab(serviceWorker, greatGrandchildTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2 },
      ], 0);

      await closeTab(serviceWorker, grandchildTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('viewIdが正しくtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(async (wid) => {
        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing treeStateManager
          await globalThis.treeStateManager.createViewWithAutoColor(wid);
          // @ts-expect-error accessing treeStateManager
          globalThis.treeStateManager.notifyStateChanged();
        }
      }, windowId);

      await waitForCondition(async () => {
        const treeState = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('tree_state');
          return result.tree_state as TreeState | undefined;
        });
        if (!treeState?.windows) return false;
        const windowState = treeState.windows.find(w => w.windowId === windowId);
        return windowState && windowState.views.length >= 2;
      }, { timeout: 5000, timeoutMessage: 'new view was not created' });

      const newViewIndex = await serviceWorker.evaluate(async (wid) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState;
        const windowState = treeState.windows.find(w => w.windowId === wid);
        return windowState ? windowState.views.length - 1 : -1;
      }, windowId);

      await serviceWorker.evaluate(async ({ tabId, viewIndex, wid }) => {
        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing treeStateManager
          await globalThis.treeStateManager.moveTabsToViewInternal([tabId], wid, viewIndex);
          // @ts-expect-error accessing treeStateManager
          globalThis.treeStateManager.notifyStateChanged();
        }
      }, { tabId, viewIndex: newViewIndex, wid: windowId });

      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as TreeState | undefined;
          });
          if (!treeState?.windows) return false;
          const windowState = treeState.windows.find(w => w.windowId === windowId);
          if (!windowState) return false;
          const newView = windowState.views[newViewIndex];
          if (!newView) return false;

          return !!findNodeByTabId(newView.rootNodes, tabId);
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'tab was not moved to new view' }
      );

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('isExpandedが正しくtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(serviceWorker, getTestServerUrl('/page2'), parentTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await collapseNode(sidePanelPage, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: false },
      ], 0);

      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as TreeState | undefined;
          });
          if (!treeState?.windows) return false;
          const windowState = treeState.windows.find(w => w.windowId === windowId);
          if (!windowState) return false;
          const view = windowState.views[windowState.activeViewIndex];
          if (!view) return false;

          const parentNode = findNodeByTabId(view.rootNodes, parentTabId);
          return parentNode?.isExpanded === false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'isExpanded was not saved correctly' }
      );

      await closeTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('ツリー構造のrestoreStateAfterRestart復元', () => {
    test('restoreStateAfterRestartでインデックスベースの親子関係復元が機能すること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as TreeState | undefined;
          });
          if (!treeState?.windows) return false;
          const windowState = treeState.windows.find(w => w.windowId === windowId);
          if (!windowState) return false;
          const view = windowState.views[windowState.activeViewIndex];
          if (!view) return false;

          return isChildOf(view.rootNodes, childTabId, parentTabId);
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'parent-child relationship was not saved' }
      );

      await serviceWorker.evaluate(async () => {
        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          globalThis.treeStateManager.initialized = false;
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.restoreStateAfterRestart();
        }
      });

      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as TreeState | undefined;
          });
          if (!treeState?.windows) return false;
          const windowState = treeState.windows.find(w => w.windowId === windowId);
          if (!windowState) return false;
          const view = windowState.views[windowState.activeViewIndex];
          if (!view) return false;

          return isChildOf(view.rootNodes, childTabId, parentTabId);
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Parent-child relationship was not maintained after restoreStateAfterRestart' }
      );

      await closeTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });
});
