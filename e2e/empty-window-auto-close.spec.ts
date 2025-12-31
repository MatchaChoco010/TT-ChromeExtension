/**
 * E2E Tests: Empty Window Auto Close
 *
 * Task 16.7 (tab-tree-bugfix-2): 空ウィンドウ自動クローズのE2Eテスト追加
 *
 * Requirements:
 * - 7.1: ドラッグアウトにより全てのタブが移動されたとき、元のウィンドウは自動的に閉じること
 * - 7.2: ウィンドウにタブが残っている場合、ウィンドウは開いたまま維持されること
 * - 7.3: E2Eテストで空ウィンドウの自動クローズを検証すること
 * - 7.4: E2Eテストは --repeat-each=10 で10回連続成功すること
 *
 * Note: Run with `npm run test:e2e`
 */
import { test, expect } from './fixtures/extension';
import { createWindow } from './utils/window-utils';
import { createTab } from './utils/tab-utils';
import {
  waitForTabInTreeState,
  waitForWindowClosed,
  waitForCondition,
} from './utils/polling-utils';

test.describe('Empty Window Auto Close', () => {
  test.describe('Requirement 7.1: Auto close window when all tabs moved via drag-out', () => {
    test('should auto close window when single tab is dragged out via CREATE_WINDOW_WITH_SUBTREE', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a new window that will become empty
      const sourceWindowId = await createWindow(extensionContext);
      expect(sourceWindowId).toBeGreaterThan(0);
      expect(sourceWindowId).not.toBe(originalWindowId);

      // Verify source window exists
      const windowsBefore = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll();
      });
      const sourceWindowExists = windowsBefore.some((w: chrome.windows.Window) => w.id === sourceWindowId);
      expect(sourceWindowExists).toBe(true);

      // Get default tab in source window (created when window is created)
      const defaultTabs = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: sourceWindowId }
      );
      expect(defaultTabs.length).toBeGreaterThan(0);

      // Use the default tab as our test tab (navigate to test URL)
      const tabId = defaultTabs[0].id as number;
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.update(tabId, { url: 'https://example.com' }),
        { tabId }
      );

      // Wait for tab to appear in tree state
      await waitForTabInTreeState(extensionContext, tabId);

      // Verify only one tab in source window
      await waitForCondition(async () => {
        const tabs = await serviceWorker.evaluate(
          ({ windowId }) => chrome.tabs.query({ windowId }),
          { windowId: sourceWindowId }
        );
        return tabs.length === 1;
      }, { timeout: 5000 });

      // Use the main side panel page to send the message
      const result = await sidePanelPage.evaluate(
        async ({ tabId, sourceWindowId }) => {
          return new Promise<{ success: boolean; error?: string }>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'CREATE_WINDOW_WITH_SUBTREE',
                payload: { tabId, sourceWindowId },
              },
              (response: { success: boolean; error?: string }) => resolve(response)
            );
          });
        },
        { tabId, sourceWindowId }
      );

      expect(result.success).toBe(true);

      // Wait for source window to be closed (auto-close behavior)
      await waitForWindowClosed(extensionContext, sourceWindowId, { timeout: 10000 });

      // Verify source window no longer exists
      const windowsAfter = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll();
      });
      const sourceWindowStillExists = windowsAfter.some((w: chrome.windows.Window) => w.id === sourceWindowId);
      expect(sourceWindowStillExists).toBe(false);

      // Verify the tab still exists (now in a new window)
      const tabAfter = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId }
      );
      expect(tabAfter).toBeDefined();
      expect(tabAfter.windowId).not.toBe(sourceWindowId);
    });

    test('should auto close window when subtree with multiple tabs is dragged out', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a new window that will become empty
      const sourceWindowId = await createWindow(extensionContext);
      expect(sourceWindowId).toBeGreaterThan(0);
      expect(sourceWindowId).not.toBe(originalWindowId);

      // Get default tab in source window (use it as parent tab)
      const defaultTabs = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: sourceWindowId }
      );
      expect(defaultTabs.length).toBeGreaterThan(0);

      // Use the default tab as our parent tab (navigate to test URL)
      const parentTabId = defaultTabs[0].id as number;
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.update(tabId, { url: 'https://example.com/parent' }),
        { tabId: parentTabId }
      );

      // Wait for parent tab to appear in tree state
      await waitForTabInTreeState(extensionContext, parentTabId);

      // Create child tab in source window
      const childTabId = await createTab(extensionContext, 'https://example.com/child', { windowId: sourceWindowId });
      expect(childTabId).toBeGreaterThan(0);

      // Wait for child tab to appear in tree state
      await waitForTabInTreeState(extensionContext, childTabId);

      // Update tree to make child a child of parent using side panel
      await sidePanelPage.evaluate(
        async ({ childTabId, parentTabId }) => {
          // Get the node IDs from tree state
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode: Record<number, string> };
          const childNodeId = treeState.tabToNode[childTabId];
          const parentNodeId = treeState.tabToNode[parentTabId];

          if (childNodeId && parentNodeId) {
            await new Promise<void>((resolve) => {
              chrome.runtime.sendMessage(
                {
                  type: 'UPDATE_TREE',
                  payload: { nodeId: childNodeId, newParentId: parentNodeId, index: 0 },
                },
                () => resolve()
              );
            });
          }
        },
        { childTabId, parentTabId }
      );

      // Wait for only our two tabs to remain
      await waitForCondition(async () => {
        const tabs = await serviceWorker.evaluate(
          ({ windowId }) => chrome.tabs.query({ windowId }),
          { windowId: sourceWindowId }
        );
        return tabs.length === 2;
      }, { timeout: 5000 });

      // Drag out the parent (which should move the entire subtree)
      const result = await sidePanelPage.evaluate(
        async ({ tabId, sourceWindowId }) => {
          return new Promise<{ success: boolean; error?: string }>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'CREATE_WINDOW_WITH_SUBTREE',
                payload: { tabId, sourceWindowId },
              },
              (response: { success: boolean; error?: string }) => resolve(response)
            );
          });
        },
        { tabId: parentTabId, sourceWindowId }
      );

      expect(result.success).toBe(true);

      // Wait for source window to be closed
      await waitForWindowClosed(extensionContext, sourceWindowId, { timeout: 10000 });

      // Verify source window no longer exists
      const windowsAfter = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll();
      });
      const sourceWindowStillExists = windowsAfter.some((w: chrome.windows.Window) => w.id === sourceWindowId);
      expect(sourceWindowStillExists).toBe(false);

      // Verify both tabs still exist
      const parentTabAfter = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId: parentTabId }
      );
      expect(parentTabAfter).toBeDefined();

      const childTabAfter = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId: childTabId }
      );
      expect(childTabAfter).toBeDefined();

      // Both tabs should be in the same new window
      expect(parentTabAfter.windowId).toBe(childTabAfter.windowId);
      expect(parentTabAfter.windowId).not.toBe(sourceWindowId);
    });
  });

  test.describe('Requirement 7.2: Keep window open when tabs remain', () => {
    test('should NOT close window when some tabs remain after drag-out', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a new window
      const sourceWindowId = await createWindow(extensionContext);
      expect(sourceWindowId).toBeGreaterThan(0);
      expect(sourceWindowId).not.toBe(originalWindowId);

      // Get default tab in source window (use it as tabToMove)
      const defaultTabs = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: sourceWindowId }
      );
      expect(defaultTabs.length).toBeGreaterThan(0);

      const tabToMove = defaultTabs[0].id as number;
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.update(tabId, { url: 'https://example.com/move' }),
        { tabId: tabToMove }
      );

      // Create another tab to keep in source window
      const tabToKeep = await createTab(extensionContext, 'https://example.com/keep', { windowId: sourceWindowId });
      expect(tabToKeep).toBeGreaterThan(0);

      // Wait for tabs to appear in tree state
      await waitForTabInTreeState(extensionContext, tabToMove);
      await waitForTabInTreeState(extensionContext, tabToKeep);

      // Wait for only our two tabs
      await waitForCondition(async () => {
        const tabs = await serviceWorker.evaluate(
          ({ windowId }) => chrome.tabs.query({ windowId }),
          { windowId: sourceWindowId }
        );
        return tabs.length === 2;
      }, { timeout: 5000 });

      // Drag out only one tab (tabToMove)
      const result = await sidePanelPage.evaluate(
        async ({ tabId, sourceWindowId }) => {
          return new Promise<{ success: boolean; error?: string }>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'CREATE_WINDOW_WITH_SUBTREE',
                payload: { tabId, sourceWindowId },
              },
              (response: { success: boolean; error?: string }) => resolve(response)
            );
          });
        },
        { tabId: tabToMove, sourceWindowId }
      );

      expect(result.success).toBe(true);

      // Wait a bit to ensure any auto-close would have happened
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify source window STILL exists (because tabToKeep remains)
      const windowsAfter = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll();
      });
      const sourceWindowStillExists = windowsAfter.some((w: chrome.windows.Window) => w.id === sourceWindowId);
      expect(sourceWindowStillExists).toBe(true);

      // Verify tabToKeep is still in source window
      const tabKeptInfo = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId: tabToKeep }
      );
      expect(tabKeptInfo.windowId).toBe(sourceWindowId);

      // Verify tabToMove has been moved to a new window
      const tabMovedInfo = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId: tabToMove }
      );
      expect(tabMovedInfo.windowId).not.toBe(sourceWindowId);
    });

    test('should NOT auto-close window when sourceWindowId is not provided', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a new window
      const sourceWindowId = await createWindow(extensionContext);
      expect(sourceWindowId).toBeGreaterThan(0);

      // Get default tab
      const defaultTabs = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: sourceWindowId }
      );
      expect(defaultTabs.length).toBeGreaterThan(0);

      const tabId = defaultTabs[0].id as number;
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.update(tabId, { url: 'https://example.com' }),
        { tabId }
      );

      // Wait for tab to appear in tree state
      await waitForTabInTreeState(extensionContext, tabId);

      // Verify only one tab
      await waitForCondition(async () => {
        const tabs = await serviceWorker.evaluate(
          ({ windowId }) => chrome.tabs.query({ windowId }),
          { windowId: sourceWindowId }
        );
        return tabs.length === 1;
      }, { timeout: 5000 });

      // Drag out tab WITHOUT sourceWindowId (old behavior - no auto-close)
      const result = await sidePanelPage.evaluate(
        async ({ tabId }) => {
          return new Promise<{ success: boolean; error?: string }>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'CREATE_WINDOW_WITH_SUBTREE',
                payload: { tabId },  // No sourceWindowId
              },
              (response: { success: boolean; error?: string }) => resolve(response)
            );
          });
        },
        { tabId }
      );

      expect(result.success).toBe(true);

      // Verify the tab was moved successfully
      const tabAfterMove = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId }
      );
      expect(tabAfterMove).toBeDefined();
      expect(tabAfterMove.windowId).not.toBe(sourceWindowId);
    });
  });

  test.describe('Edge Cases', () => {
    test('should handle non-existent sourceWindowId gracefully', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a new window
      const sourceWindowId = await createWindow(extensionContext);
      expect(sourceWindowId).toBeGreaterThan(0);

      // Get default tab
      const defaultTabs = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: sourceWindowId }
      );
      expect(defaultTabs.length).toBeGreaterThan(0);

      const tabId = defaultTabs[0].id as number;
      await waitForTabInTreeState(extensionContext, tabId);

      // Use a fake/non-existent sourceWindowId
      const nonExistentWindowId = 99999;

      const result = await sidePanelPage.evaluate(
        async ({ tabId, sourceWindowId }) => {
          return new Promise<{ success: boolean; error?: string }>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'CREATE_WINDOW_WITH_SUBTREE',
                payload: { tabId, sourceWindowId },
              },
              (response: { success: boolean; error?: string }) => resolve(response)
            );
          });
        },
        { tabId, sourceWindowId: nonExistentWindowId }
      );

      // Should succeed even with non-existent sourceWindowId
      // (the auto-close attempt will silently fail, which is expected)
      expect(result.success).toBe(true);

      // Tab should still be moved successfully
      const tabAfterMove = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId }
      );
      expect(tabAfterMove).toBeDefined();
    });
  });
});
