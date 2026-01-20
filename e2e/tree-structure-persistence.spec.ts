import { test, expect } from './fixtures/extension';
import { waitForCondition } from './utils/polling-utils';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId, collapseNode } from './utils/tab-utils';
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
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const grandchildUrl = getTestServerUrl('/page3');
      const grandchildTabId = await createTab(serviceWorker, grandchildUrl, childTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2 },
      ], 0);

      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
        viewId: string;
        isExpanded: boolean;
      }

      await waitForCondition(async () => {
        const structure = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { treeStructure?: Array<{ url: string }> };
          return treeState?.treeStructure;
        });
        if (!structure || !Array.isArray(structure)) return false;
        const hasParent = structure.some(e => e.url && e.url.includes('/page') && !e.url.includes('/page2') && !e.url.includes('/page3'));
        const hasChild = structure.some(e => e.url && e.url.includes('/page2'));
        const hasGrandchild = structure.some(e => e.url && e.url.includes('/page3'));
        return hasParent && hasChild && hasGrandchild;
      }, { timeout: 5000, timeoutMessage: 'treeStructure did not contain expected URLs' });

      const treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: unknown[] };
        return treeState?.treeStructure;
      }) as TreeStructureEntry[];

      expect(treeStructure).toBeDefined();
      expect(Array.isArray(treeStructure)).toBe(true);

      const parentEntry = treeStructure.find(e => e.url.includes('/page') && !e.url.includes('/page2') && !e.url.includes('/page3'));
      const childEntry = treeStructure.find(e => e.url.includes('/page2'));
      const grandchildEntry = treeStructure.find(e => e.url.includes('/page3'));

      expect(parentEntry).toBeDefined();
      expect(childEntry).toBeDefined();
      expect(grandchildEntry).toBeDefined();

      expect(parentEntry?.parentIndex).toBeNull();

      const parentIndex = treeStructure.indexOf(parentEntry!);
      expect(childEntry?.parentIndex).toBe(parentIndex);

      const childIndex = treeStructure.indexOf(childEntry!);
      expect(grandchildEntry?.parentIndex).toBe(childIndex);

      await closeTab(serviceWorker, grandchildTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('4階層（親→子→孫→ひ孫）の親子関係がtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const grandchildUrl = getTestServerUrl('/page3');
      const grandchildTabId = await createTab(serviceWorker, grandchildUrl, childTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2 },
      ], 0);

      const greatGrandchildUrl = getTestServerUrl('/page4');
      const greatGrandchildTabId = await createTab(serviceWorker, greatGrandchildUrl, grandchildTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2, expanded: true },
        { tabId: greatGrandchildTabId, depth: 3 },
      ], 0);

      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
        viewId: string;
        isExpanded: boolean;
      }

      await waitForCondition(async () => {
        const structure = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { treeStructure?: Array<{ url: string }> };
          return treeState?.treeStructure;
        });
        if (!structure || !Array.isArray(structure)) return false;
        const hasParent = structure.some(e => e.url && e.url.includes('/page') && !e.url.includes('/page2') && !e.url.includes('/page3') && !e.url.includes('/page4'));
        const hasChild = structure.some(e => e.url && e.url.includes('/page2'));
        const hasGrandchild = structure.some(e => e.url && e.url.includes('/page3'));
        const hasGreatGrandchild = structure.some(e => e.url && e.url.includes('/page4'));
        return hasParent && hasChild && hasGrandchild && hasGreatGrandchild;
      }, { timeout: 5000, timeoutMessage: 'treeStructure did not contain expected URLs for 4 levels' });

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
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2 },
      ], 0);

      await closeTab(serviceWorker, grandchildTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      function entries(structure: TreeStructureEntry[], urlPart: string): TreeStructureEntry | undefined {
        const exactMatch = structure.find(e => {
          if (!e.url) return false;
          try {
            const urlPath = new URL(e.url).pathname;
            return urlPath === urlPart;
          } catch {
            return false;
          }
        });
        if (exactMatch) return exactMatch;
        return structure.find(e => e.url && e.url.includes(urlPart));
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

      await serviceWorker.evaluate(async () => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage({ type: 'CREATE_VIEW' }, () => resolve());
        });
      });

      const newViewId = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { viewOrder?: string[] };
        const viewOrder = treeState?.viewOrder || [];
        return viewOrder[viewOrder.length - 1];
      }) as string;

      await serviceWorker.evaluate(async ({ tabId, viewId }) => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage({
            type: 'MOVE_TABS_TO_VIEW',
            payload: { targetViewId: viewId, tabIds: [tabId] },
          }, () => resolve());
        });
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
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('isExpandedが正しくtreeStructureに保存されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(serviceWorker, getTestServerUrl('/page2'), parentTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await collapseNode(sidePanelPage, parentTabId);

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
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('ツリー構造のsyncWithChromeTabs復元', () => {
    test('syncWithChromeTabsでインデックスベースの親子関係復元が機能すること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentUrl = getTestServerUrl('/page');
      const parentTabId = await createTab(serviceWorker, parentUrl, undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childUrl = getTestServerUrl('/page2');
      const childTabId = await createTab(serviceWorker, childUrl, parentTabId, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

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
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });
});
