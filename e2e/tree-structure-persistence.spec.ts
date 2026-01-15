import { test, expect } from './fixtures/extension';
import { waitForCondition } from './utils/polling-utils';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';
import './types';

test.describe('Tree Structure Persistence', () => {
  test.describe('複数階層の親子関係の永続化', () => {
    test('3階層（親→子→孫）の親子関係がtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      await setupWindow(extensionContext, serviceWorker, windowId);

      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });

      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });

      const grandchildUrl = getTestServerUrl('/page3');
      await createTab(serviceWorker, grandchildUrl, childTabId, { active: false });

      await new Promise(resolve => setTimeout(resolve, 500));
      const treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: unknown[] };
        return treeState?.treeStructure;
      });

      expect(treeStructure).toBeDefined();
      expect(Array.isArray(treeStructure)).toBe(true);

      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
        viewId: string;
        isExpanded: boolean;
      }

      const entries = treeStructure as TreeStructureEntry[];

      // 各タブのURLで検索
      const parentEntry = entries.find(e => e.url.includes('/page') && !e.url.includes('/page2') && !e.url.includes('/page3'));
      const childEntry = entries.find(e => e.url.includes('/page2'));
      const grandchildEntry = entries.find(e => e.url.includes('/page3'));

      expect(parentEntry).toBeDefined();
      expect(childEntry).toBeDefined();
      expect(grandchildEntry).toBeDefined();

      expect(parentEntry?.parentIndex).toBeNull();

      const parentIndex = entries.indexOf(parentEntry!);
      expect(childEntry?.parentIndex).toBe(parentIndex);

      const childIndex = entries.indexOf(childEntry!);
      expect(grandchildEntry?.parentIndex).toBe(childIndex);
      await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.id && (tab.url?.includes('/page3') || tab.url?.includes('/page2') || (tab.url?.includes('/page') && !tab.url?.includes('/page2') && !tab.url?.includes('/page3')))) {
            try { await chrome.tabs.remove(tab.id); } catch { /* ignore */ }
          }
        }
      });
    });

    test('4階層（親→子→孫→ひ孫）の親子関係がtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      await setupWindow(extensionContext, serviceWorker, windowId);

      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });

      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });

      const grandchildUrl = getTestServerUrl('/page3');
      const grandchildTabId = await createTab(serviceWorker, grandchildUrl, childTabId, { active: false });

      const greatGrandchildUrl = getTestServerUrl('/page4');
      const greatGrandchildTabId = await createTab(serviceWorker, greatGrandchildUrl, grandchildTabId, { active: false });

      await new Promise(resolve => setTimeout(resolve, 500));
      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
        viewId: string;
        isExpanded: boolean;
      }

      const treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: unknown[] };
        return treeState?.treeStructure;
      }) as TreeStructureEntry[];

      const parentEntry = entries(treeStructure, '/page');
      const childEntry = entries(treeStructure, '/page2');
      const grandchildEntry = entries(treeStructure, '/page3');
      const greatGrandchildEntry = entries(treeStructure, '/page4');
      expect(parentEntry?.parentIndex).toBeNull();

      const parentIdx = treeStructure.indexOf(parentEntry!);
      expect(childEntry?.parentIndex).toBe(parentIdx);

      const childIdx = treeStructure.indexOf(childEntry!);
      expect(grandchildEntry?.parentIndex).toBe(childIdx);

      const grandchildIdx = treeStructure.indexOf(grandchildEntry!);
      expect(greatGrandchildEntry?.parentIndex).toBe(grandchildIdx);

      await closeTab(serviceWorker, greatGrandchildTabId);
      await closeTab(serviceWorker, grandchildTabId);
      await closeTab(serviceWorker, childTabId);
      await closeTab(serviceWorker, parentTabId);

      function entries(structure: TreeStructureEntry[], urlPart: string): TreeStructureEntry | undefined {
        const exactMatch = structure.find(e => {
          const urlPath = new URL(e.url).pathname;
          return urlPath === urlPart;
        });
        if (exactMatch) return exactMatch;
        return structure.find(e => e.url.includes(urlPart));
      }
    });

    test('viewIdが正しくtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      const newViewId = 'test-view-' + Date.now();
      await serviceWorker.evaluate(async ({ viewId }) => {
        interface ViewState {
          info: { id: string; name: string; color: string };
          rootNodeIds: string[];
          nodes: Record<string, unknown>;
        }
        interface TreeStateWithViews {
          views?: Record<string, ViewState>;
          viewOrder?: string[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeStateWithViews;
        if (!treeState.views) {
          treeState.views = {};
        }
        if (!treeState.viewOrder) {
          treeState.viewOrder = [];
        }
        treeState.views[viewId] = {
          info: { id: viewId, name: 'Test View', color: '#ff0000' },
          rootNodeIds: [],
          nodes: {},
        };
        treeState.viewOrder.push(viewId);
        await chrome.storage.local.set({ tree_state: treeState });
      }, { viewId: newViewId });

      await serviceWorker.evaluate(async ({ tabId, viewId }) => {
        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.loadState();
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.moveSubtreeToView(tabId, viewId);
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.refreshTreeStructure();
        }
      }, { tabId, viewId: newViewId });

      await waitForCondition(
        async () => {
          interface TreeStructureEntry {
            url: string;
            viewId: string;
          }
          const treeStructure = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { treeStructure?: unknown[] };
            return treeState?.treeStructure;
          }) as TreeStructureEntry[];

          const tabEntry = treeStructure?.find(e => e.url.includes('/page'));
          return tabEntry?.viewId === newViewId;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'viewId was not saved correctly' }
      );

      await closeTab(serviceWorker, tabId);
    });

    test('isExpandedが正しくtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId: _initialBrowserTabId, sidePanelPage: _sidePanelPage, pseudoSidePanelTabId: _pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      const childTabId = await createTab(serviceWorker, getTestServerUrl('/page2'), parentTabId, { active: false });

      await serviceWorker.evaluate(async ({ tabId }) => {
        interface TreeNode {
          isExpanded: boolean;
        }
        interface ViewState {
          nodes: Record<string, TreeNode>;
        }
        interface TreeState {
          views: Record<string, ViewState>;
          tabToNode: Record<number, { viewId: string; nodeId: string }>;
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState;
        const nodeInfo = treeState.tabToNode[tabId];
        if (nodeInfo) {
          const viewState = treeState.views[nodeInfo.viewId];
          if (viewState && viewState.nodes[nodeInfo.nodeId]) {
            viewState.nodes[nodeInfo.nodeId].isExpanded = false;
            await chrome.storage.local.set({ tree_state: treeState });
          }
        }

        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.loadState();
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.refreshTreeStructure();
        }
      }, { tabId: parentTabId });

      await waitForCondition(
        async () => {
          interface TreeStructureEntry {
            url: string;
            isExpanded: boolean;
          }
          const treeStructure = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { treeStructure?: unknown[] };
            return treeState?.treeStructure;
          }) as TreeStructureEntry[];

          const parentEntry = treeStructure?.find(e => e.url.includes('/page') && !e.url.includes('/page2'));
          return parentEntry?.isExpanded === false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'isExpanded was not saved correctly' }
      );

      await closeTab(serviceWorker, childTabId);
      await closeTab(serviceWorker, parentTabId);
    });
  });

  test.describe('ツリー構造のsyncWithChromeTabs復元', () => {
    test('syncWithChromeTabsでインデックスベースの親子関係復元が機能すること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      await setupWindow(extensionContext, serviceWorker, windowId);

      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });

      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });

      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
      }

      let treeStructure: TreeStructureEntry[] = [];
      let parentIdx = -1;

      await waitForCondition(
        async () => {
          treeStructure = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { treeStructure?: unknown[] };
            return treeState?.treeStructure || [];
          }) as TreeStructureEntry[];

          if (!treeStructure || treeStructure.length < 2) return false;

          const parentEntry = treeStructure.find(e => e.url.includes('/page') && !e.url.includes('/page2'));
          const childEntry = treeStructure.find(e => e.url.includes('/page2'));

          if (!parentEntry || !childEntry) return false;
          if (parentEntry.parentIndex !== null) return false;

          parentIdx = treeStructure.indexOf(parentEntry);
          return childEntry.parentIndex === parentIdx;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'treeStructure with parent-child relationship was not saved' }
      );

      await serviceWorker.evaluate(async () => {
        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          globalThis.treeStateManager.syncCompleted = false;
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.syncWithChromeTabs();
        }
      });

      await waitForCondition(
        async () => {
          const treeStructureAfter = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { treeStructure?: unknown[] };
            return treeState?.treeStructure || [];
          }) as TreeStructureEntry[];

          if (!treeStructureAfter || treeStructureAfter.length < 2) return false;

          const parentEntryAfter = treeStructureAfter.find(e => e.url.includes('/page') && !e.url.includes('/page2'));
          const childEntryAfter = treeStructureAfter.find(e => e.url.includes('/page2'));

          if (!parentEntryAfter || !childEntryAfter) return false;
          if (parentEntryAfter.parentIndex !== null) return false;

          const parentIdxAfter = treeStructureAfter.indexOf(parentEntryAfter);
          return childEntryAfter.parentIndex === parentIdxAfter;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Parent-child relationship was not maintained after syncWithChromeTabs' }
      );

      await closeTab(serviceWorker, childTabId);
      await closeTab(serviceWorker, parentTabId);
    });
  });
});
