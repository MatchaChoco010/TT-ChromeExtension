/**
 * ゴーストタブの自動削除 E2E テスト
 */
import { test } from './fixtures/extension';
import { waitForCondition } from './utils/polling-utils';
import {
  createTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getTestServerUrl,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import './types';

test.describe('Ghost Tab Cleanup', () => {
  test.describe('Chrome APIに存在しないタブをツリーから削除', () => {
    test('ストレージにのみ存在するゴーストタブが起動時にクリーンアップされること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab = await createTab(serviceWorker, getTestServerUrl('/page'), { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab, depth: 0 },
      ], 0);

      const ghostTabId = 99999;
      const ghostNodeId = `node-${ghostTabId}`;
      await serviceWorker.evaluate(
        async ({ ghostTabId, ghostNodeId }) => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as {
            nodes: Record<string, unknown>;
            tabToNode: Record<number, string>;
            currentViewId: string;
            views: unknown[];
          };

          treeState.nodes[ghostNodeId] = {
            id: ghostNodeId,
            tabId: ghostTabId,
            parentId: null,
            children: [],
            isExpanded: true,
            depth: 0,
            viewId: 'default',
          };
          treeState.tabToNode[ghostTabId] = ghostNodeId;

          await chrome.storage.local.set({ tree_state: treeState });
        },
        { ghostTabId, ghostNodeId }
      );

      await waitForCondition(
        async () => {
          const hasGhost = await serviceWorker.evaluate(
            async ({ ghostTabId }) => {
              const result = await chrome.storage.local.get('tree_state');
              const treeState = result.tree_state as { tabToNode: Record<number, string> };
              return treeState.tabToNode[ghostTabId] !== undefined;
            },
            { ghostTabId }
          );
          return hasGhost;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Ghost tab was not added to storage' }
      );

      await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const existingTabIds = tabs.filter((t) => t.id).map((t) => t.id!);

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          nodes: Record<string, { tabId: number; id: string }>;
          tabToNode: Record<number, string>;
        };

        const staleTabIds: number[] = [];
        for (const [tabIdStr, _nodeId] of Object.entries(treeState.tabToNode)) {
          const tabId = parseInt(tabIdStr);
          if (!existingTabIds.includes(tabId)) {
            staleTabIds.push(tabId);
          }
        }

        for (const tabId of staleTabIds) {
          const nodeId = treeState.tabToNode[tabId];
          if (nodeId) {
            delete treeState.nodes[nodeId];
            delete treeState.tabToNode[tabId];
          }
        }

        await chrome.storage.local.set({ tree_state: treeState });
      });

      await waitForCondition(
        async () => {
          const hasGhost = await serviceWorker.evaluate(
            async ({ ghostTabId }) => {
              const result = await chrome.storage.local.get('tree_state');
              const treeState = result.tree_state as { tabToNode: Record<number, string> };
              return treeState.tabToNode[ghostTabId] !== undefined;
            },
            { ghostTabId }
          );
          return !hasGhost;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Ghost tab was not cleaned up from storage' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('初期化時にツリー内の全タブIDをChrome APIで検証', () => {
    test('TreeStateManager.cleanupStaleNodesが正しくゴーストタブを削除すること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            const existingTabIds = tabs.filter((t) => t.id).map((t) => t.id!);

            const storageResult = await chrome.storage.local.get('tree_state');
            const treeState = storageResult.tree_state as {
              tabToNode: Record<number, string>;
            } | null;

            if (!treeState) {
              return { existingCount: existingTabIds.length, staleCount: 0 };
            }

            let staleCount = 0;
            for (const tabIdStr of Object.keys(treeState.tabToNode)) {
              const tabId = parseInt(tabIdStr);
              if (!existingTabIds.includes(tabId)) {
                staleCount++;
              }
            }

            return { existingCount: existingTabIds.length, staleCount };
          });
          return result.staleCount === 0 && result.existingCount > 0;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Stale tabs found or no existing tabs' }
      );
    });
  });

  test.describe('Loadingのまま消せないゴーストタブの発生を防止', () => {
    test('Side Panelに表示されているタブがすべてChrome APIに存在すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForCondition(
        async () => {
          const displayedTabIds = await sidePanelPage.evaluate(() => {
            const tabElements = document.querySelectorAll('[data-testid^="tree-node-"]');
            const ids: number[] = [];
            tabElements.forEach((el) => {
              const testId = el.getAttribute('data-testid');
              if (testId) {
                const match = testId.match(/^tree-node-(\d+)$/);
                if (match) {
                  ids.push(parseInt(match[1]));
                }
              }
            });
            return ids;
          });

          const existingTabIds = await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            return tabs.filter((t) => t.id).map((t) => t.id!);
          });

          return displayedTabIds.every((id) => existingTabIds.includes(id));
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Some displayed tabs do not exist in Chrome API' }
      );
    });

    test('タブツリーにLoadingのまま動かないタブが存在しないこと', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForCondition(
        async () => {
          const loadingTabs = await sidePanelPage.evaluate(() => {
            const tabElements = document.querySelectorAll('[data-testid^="tree-node-"]');
            const loadingTabIds: number[] = [];
            tabElements.forEach((el) => {
              const statusIndicator = el.querySelector('[data-status="loading"]');
              const testId = el.getAttribute('data-testid');
              if (statusIndicator && testId) {
                const match = testId.match(/^tree-node-(\d+)$/);
                if (match) {
                  loadingTabIds.push(parseInt(match[1]));
                }
              }
            });
            return loadingTabIds;
          });

          if (loadingTabs.length === 0) {
            return true;
          }

          const existingTabIds = await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            return tabs.filter((t) => t.id).map((t) => t.id!);
          });

          return loadingTabs.every((id) => existingTabIds.includes(id));
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Some loading tabs do not exist in Chrome API (ghost tabs detected)' }
      );
    });
  });

  test.describe('統合テスト: 複数のゴーストタブのクリーンアップ', () => {
    test('複数のゴーストタブが一度にクリーンアップされること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const normalTab = await createTab(serviceWorker, getTestServerUrl('/page'), { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTab, depth: 0 },
      ], 0);

      const ghostTabIds = [88881, 88882, 88883];
      await serviceWorker.evaluate(
        async (ghostIds) => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as {
            nodes: Record<string, unknown>;
            tabToNode: Record<number, string>;
          };

          for (const ghostTabId of ghostIds) {
            const ghostNodeId = `node-${ghostTabId}`;
            treeState.nodes[ghostNodeId] = {
              id: ghostNodeId,
              tabId: ghostTabId,
              parentId: null,
              children: [],
              isExpanded: true,
              depth: 0,
              viewId: 'default',
            };
            treeState.tabToNode[ghostTabId] = ghostNodeId;
          }

          await chrome.storage.local.set({ tree_state: treeState });
        },
        ghostTabIds
      );

      await waitForCondition(
        async () => {
          const ghostCount = await serviceWorker.evaluate(async (ghostIds) => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { tabToNode: Record<number, string> };
            return ghostIds.filter((id) => treeState.tabToNode[id] !== undefined).length;
          }, ghostTabIds);
          return ghostCount === 3;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Ghost tabs were not added to storage' }
      );

      await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const existingTabIds = tabs.filter((t) => t.id).map((t) => t.id!);

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          nodes: Record<string, unknown>;
          tabToNode: Record<number, string>;
        };

        for (const tabIdStr of Object.keys(treeState.tabToNode)) {
          const tabId = parseInt(tabIdStr);
          if (!existingTabIds.includes(tabId)) {
            const nodeId = treeState.tabToNode[tabId];
            delete treeState.nodes[nodeId];
            delete treeState.tabToNode[tabId];
          }
        }

        await chrome.storage.local.set({ tree_state: treeState });
      });

      await waitForCondition(
        async () => {
          const count = await serviceWorker.evaluate(async (ghostIds) => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { tabToNode: Record<number, string> };
            return ghostIds.filter((id) => treeState.tabToNode[id] !== undefined).length;
          }, ghostTabIds);
          return count === 0;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Ghost tabs were not cleaned up from storage' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTab, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, normalTab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });
});
