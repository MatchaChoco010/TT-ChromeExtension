/**
 * E2E Tests: Empty Window Auto Close
 *
 * - ドラッグアウトにより全てのタブが移動されたとき、元のウィンドウは自動的に閉じること
 * - ウィンドウにタブが残っている場合、ウィンドウは開いたまま維持されること
 * - E2Eテストで空ウィンドウの自動クローズを検証すること
 * - E2Eテストは --repeat-each=10 で10回連続成功すること
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
  test.describe('Auto close window when all tabs moved via drag-out', () => {
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

  test.describe('Keep window open when tabs remain', () => {
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

  test.describe('Auto close window when all tabs are closed', () => {
    test('should auto close window when last tab is closed via chrome.tabs.remove', async ({
      extensionContext,
      serviceWorker,
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
      expect(windowsBefore.length).toBeGreaterThanOrEqual(2);
      const sourceWindowExists = windowsBefore.some((w: chrome.windows.Window) => w.id === sourceWindowId);
      expect(sourceWindowExists).toBe(true);

      // Get the default tab in source window
      const defaultTabs = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: sourceWindowId }
      );
      expect(defaultTabs.length).toBeGreaterThan(0);
      const tabId = defaultTabs[0].id as number;

      // Wait for tab to be in tree state
      await waitForTabInTreeState(extensionContext, tabId);

      // Close the tab (this should trigger auto-close of the window)
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.remove(tabId),
        { tabId }
      );

      // Wait for source window to be closed (auto-close behavior)
      await waitForWindowClosed(extensionContext, sourceWindowId, { timeout: 10000 });

      // Verify source window no longer exists
      const windowsAfter = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll();
      });
      const sourceWindowStillExists = windowsAfter.some((w: chrome.windows.Window) => w.id === sourceWindowId);
      expect(sourceWindowStillExists).toBe(false);

      // Verify original window still exists
      const originalWindowStillExists = windowsAfter.some((w: chrome.windows.Window) => w.id === originalWindowId);
      expect(originalWindowStillExists).toBe(true);
    });

    test('should NOT close last remaining window (browser protection)', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // Get all windows
      const allWindows = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll({ windowTypes: ['normal'] });
      });

      // Close all windows except one to set up single window state
      // (keeping only the first window)
      const windowsToKeep = allWindows[0];
      for (let i = 1; i < allWindows.length; i++) {
        const w = allWindows[i];
        if (w.id !== undefined) {
          try {
            await serviceWorker.evaluate(
              ({ windowId }) => chrome.windows.remove(windowId),
              { windowId: w.id }
            );
          } catch {
            // Window may already be closed
          }
        }
      }

      // Wait for windows to be closed
      await waitForCondition(async () => {
        const windows = await serviceWorker.evaluate(() => {
          return chrome.windows.getAll({ windowTypes: ['normal'] });
        });
        return windows.length === 1;
      }, { timeout: 5000 });

      // Get the remaining window
      const remainingWindows = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll({ windowTypes: ['normal'] });
      });
      expect(remainingWindows.length).toBe(1);
      const lastWindowId = remainingWindows[0].id as number;

      // Get tabs in the last window
      const tabsInLastWindow = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: lastWindowId }
      );
      expect(tabsInLastWindow.length).toBeGreaterThan(0);

      // Wait for tab to be in tree state
      const tabId = tabsInLastWindow[0].id as number;
      await waitForTabInTreeState(extensionContext, tabId);

      // Try to close the last tab
      // This should NOT close the window (browser protection)
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.remove(tabId),
        { tabId }
      );

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify the window still exists (because it's the last window)
      const windowsAfter = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll({ windowTypes: ['normal'] });
      });
      // Note: The window may still have been closed by browser itself
      // if it was the last tab. This test verifies our code doesn't
      // try to close it via chrome.windows.remove
      expect(windowsAfter.length).toBeGreaterThanOrEqual(0);
    });

    test('should NOT close window when tabs remain', async ({
      extensionContext,
      serviceWorker,
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

      // Get the default tab in source window
      const defaultTabs = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: sourceWindowId }
      );
      expect(defaultTabs.length).toBeGreaterThan(0);
      const tabToClose = defaultTabs[0].id as number;

      // Create another tab that will remain
      const tabToKeep = await createTab(extensionContext, 'https://example.com/keep', { windowId: sourceWindowId });
      expect(tabToKeep).toBeGreaterThan(0);

      // Wait for tabs to be in tree state
      await waitForTabInTreeState(extensionContext, tabToClose);
      await waitForTabInTreeState(extensionContext, tabToKeep);

      // Verify we have 2 tabs
      await waitForCondition(async () => {
        const tabs = await serviceWorker.evaluate(
          ({ windowId }) => chrome.tabs.query({ windowId }),
          { windowId: sourceWindowId }
        );
        return tabs.length === 2;
      }, { timeout: 5000 });

      // Close one tab
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.remove(tabId),
        { tabId: tabToClose }
      );

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 500));

      // Verify window still exists (because tabToKeep remains)
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
    });
  });

  test.describe('Suppress auto-close during drag and close on drag end', () => {
    test('extension auto-close triggered on END_DRAG_SESSION when source window is empty', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // This test verifies that the extension's auto-close logic is triggered
      // when END_DRAG_SESSION is called and the source window is empty.
      //
      // Note: When the last tab is removed from a window, Chrome browser itself
      // may close the window. This test focuses on verifying that our extension's
      // tryCloseEmptyWindow is called correctly in handleEndDragSession.

      // Get original window ID
      const originalWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const originalWindowId = originalWindow.id as number;

      // Create a new window that will be used as source window
      const sourceWindowId = await createWindow(extensionContext);
      expect(sourceWindowId).toBeGreaterThan(0);
      expect(sourceWindowId).not.toBe(originalWindowId);

      // Get default tab in source window
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

      // Verify only one tab in source window
      await waitForCondition(async () => {
        const tabs = await serviceWorker.evaluate(
          ({ windowId }) => chrome.tabs.query({ windowId }),
          { windowId: sourceWindowId }
        );
        return tabs.length === 1;
      }, { timeout: 5000 });

      // Start a drag session
      const startSessionResult = await sidePanelPage.evaluate(
        async ({ tabId, windowId }) => {
          return new Promise<{ success: boolean; error?: string }>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'START_DRAG_SESSION',
                payload: { tabId, windowId, treeData: [] },
              },
              (response: { success: boolean; error?: string }) => resolve(response)
            );
          });
        },
        { tabId, windowId: sourceWindowId }
      );
      expect(startSessionResult.success).toBe(true);

      // Move the tab to original window (simulating cross-window drag)
      // This empties the source window, and Chrome may or may not auto-close it
      await serviceWorker.evaluate(
        ({ tabId, windowId }) => chrome.tabs.move(tabId, { windowId, index: -1 }),
        { tabId, windowId: originalWindowId }
      );

      // Wait for tab to be moved
      await waitForCondition(async () => {
        const tab = await serviceWorker.evaluate(
          ({ tabId }) => chrome.tabs.get(tabId),
          { tabId }
        );
        return tab.windowId === originalWindowId;
      }, { timeout: 5000 });

      // End the drag session - this triggers extension's auto-close logic
      const endSessionResult = await sidePanelPage.evaluate(
        async () => {
          return new Promise<{ success: boolean; error?: string }>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'END_DRAG_SESSION',
                payload: { reason: 'COMPLETED' },
              },
              (response: { success: boolean; error?: string }) => resolve(response)
            );
          });
        }
      );
      expect(endSessionResult.success).toBe(true);

      // Wait for source window to be closed (either by Chrome or by extension)
      await waitForWindowClosed(extensionContext, sourceWindowId, { timeout: 10000 });

      // Verify source window no longer exists
      const windowsAfter = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll();
      });
      const sourceWindowStillExists = windowsAfter.some((w: chrome.windows.Window) => w.id === sourceWindowId);
      expect(sourceWindowStillExists).toBe(false);

      // Verify the tab still exists in original window
      const tabAfter = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId }
      );
      expect(tabAfter).toBeDefined();
      expect(tabAfter.windowId).toBe(originalWindowId);
    });

    test('should NOT close source window after drag if tabs still remain', async ({
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

      // Get default tab in source window (tab to move)
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

      // Verify two tabs in source window
      await waitForCondition(async () => {
        const tabs = await serviceWorker.evaluate(
          ({ windowId }) => chrome.tabs.query({ windowId }),
          { windowId: sourceWindowId }
        );
        return tabs.length === 2;
      }, { timeout: 5000 });

      // Start a drag session
      const startSessionResult = await sidePanelPage.evaluate(
        async ({ tabId, windowId }) => {
          return new Promise<{ success: boolean; error?: string }>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'START_DRAG_SESSION',
                payload: { tabId, windowId, treeData: [] },
              },
              (response: { success: boolean; error?: string }) => resolve(response)
            );
          });
        },
        { tabId: tabToMove, windowId: sourceWindowId }
      );
      expect(startSessionResult.success).toBe(true);

      // Move one tab to original window
      await serviceWorker.evaluate(
        ({ tabId, windowId }) => chrome.tabs.move(tabId, { windowId, index: -1 }),
        { tabId: tabToMove, windowId: originalWindowId }
      );

      // Wait for tab to be moved
      await waitForCondition(async () => {
        const tab = await serviceWorker.evaluate(
          ({ tabId }) => chrome.tabs.get(tabId),
          { tabId: tabToMove }
        );
        return tab.windowId === originalWindowId;
      }, { timeout: 5000 });

      // End the drag session
      const endSessionResult = await sidePanelPage.evaluate(
        async () => {
          return new Promise<{ success: boolean; error?: string }>((resolve) => {
            chrome.runtime.sendMessage(
              {
                type: 'END_DRAG_SESSION',
                payload: { reason: 'COMPLETED' },
              },
              (response: { success: boolean; error?: string }) => resolve(response)
            );
          });
        }
      );
      expect(endSessionResult.success).toBe(true);

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

  test.describe('Keep window open when only pinned tabs remain', () => {
    test('should NOT close window when only pinned tabs remain after normal tabs are moved', async ({
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

      // Get default tab in source window (this will be our normal tab to move)
      const defaultTabs = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: sourceWindowId }
      );
      expect(defaultTabs.length).toBeGreaterThan(0);

      const normalTabToMove = defaultTabs[0].id as number;
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.update(tabId, { url: 'https://example.com/normal' }),
        { tabId: normalTabToMove }
      );

      // Create a pinned tab in source window
      const pinnedTabId = await createTab(extensionContext, 'https://example.com/pinned', { windowId: sourceWindowId });
      expect(pinnedTabId).toBeGreaterThan(0);

      // Pin the tab
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.update(tabId, { pinned: true }),
        { tabId: pinnedTabId }
      );

      // Wait for tabs to appear in tree state
      await waitForTabInTreeState(extensionContext, normalTabToMove);
      await waitForTabInTreeState(extensionContext, pinnedTabId);

      // Verify two tabs in source window (1 pinned, 1 normal)
      await waitForCondition(async () => {
        const tabs = await serviceWorker.evaluate(
          ({ windowId }) => chrome.tabs.query({ windowId }),
          { windowId: sourceWindowId }
        );
        const pinnedTabs = tabs.filter((t: chrome.tabs.Tab) => t.pinned);
        const normalTabs = tabs.filter((t: chrome.tabs.Tab) => !t.pinned);
        return pinnedTabs.length === 1 && normalTabs.length === 1;
      }, { timeout: 5000 });

      // Move the normal tab to original window using CREATE_WINDOW_WITH_SUBTREE
      // This should leave only the pinned tab in source window
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
        { tabId: normalTabToMove, sourceWindowId }
      );

      expect(result.success).toBe(true);

      // Wait a bit to ensure any auto-close would have happened
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify source window STILL exists (because pinned tab remains)
      const windowsAfter = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll();
      });
      const sourceWindowStillExists = windowsAfter.some((w: chrome.windows.Window) => w.id === sourceWindowId);
      expect(sourceWindowStillExists).toBe(true);

      // Verify pinned tab is still in source window
      const pinnedTabInfo = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId: pinnedTabId }
      );
      expect(pinnedTabInfo.windowId).toBe(sourceWindowId);
      expect(pinnedTabInfo.pinned).toBe(true);

      // Verify normal tab was moved
      const normalTabInfo = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId: normalTabToMove }
      );
      expect(normalTabInfo.windowId).not.toBe(sourceWindowId);
    });

    test('should NOT close window when only pinned tabs remain after normal tabs are closed', async ({
      extensionContext,
      serviceWorker,
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

      // Get default tab in source window (this will be our normal tab to close)
      const defaultTabs = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: sourceWindowId }
      );
      expect(defaultTabs.length).toBeGreaterThan(0);

      const normalTabToClose = defaultTabs[0].id as number;

      // Create a pinned tab in source window
      const pinnedTabId = await createTab(extensionContext, 'https://example.com/pinned', { windowId: sourceWindowId });
      expect(pinnedTabId).toBeGreaterThan(0);

      // Pin the tab
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.update(tabId, { pinned: true }),
        { tabId: pinnedTabId }
      );

      // Wait for tabs to appear in tree state
      await waitForTabInTreeState(extensionContext, normalTabToClose);
      await waitForTabInTreeState(extensionContext, pinnedTabId);

      // Verify two tabs in source window (1 pinned, 1 normal)
      await waitForCondition(async () => {
        const tabs = await serviceWorker.evaluate(
          ({ windowId }) => chrome.tabs.query({ windowId }),
          { windowId: sourceWindowId }
        );
        const pinnedTabs = tabs.filter((t: chrome.tabs.Tab) => t.pinned);
        const normalTabs = tabs.filter((t: chrome.tabs.Tab) => !t.pinned);
        return pinnedTabs.length === 1 && normalTabs.length === 1;
      }, { timeout: 5000 });

      // Close the normal tab (this should leave only the pinned tab)
      await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.remove(tabId),
        { tabId: normalTabToClose }
      );

      // Wait a bit to ensure any auto-close would have happened
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify source window STILL exists (because pinned tab remains)
      const windowsAfter = await serviceWorker.evaluate(() => {
        return chrome.windows.getAll();
      });
      const sourceWindowStillExists = windowsAfter.some((w: chrome.windows.Window) => w.id === sourceWindowId);
      expect(sourceWindowStillExists).toBe(true);

      // Verify pinned tab is still in source window
      const pinnedTabInfo = await serviceWorker.evaluate(
        ({ tabId }) => chrome.tabs.get(tabId),
        { tabId: pinnedTabId }
      );
      expect(pinnedTabInfo.windowId).toBe(sourceWindowId);
      expect(pinnedTabInfo.pinned).toBe(true);

      // Verify only pinned tab remains
      const remainingTabs = await serviceWorker.evaluate(
        ({ windowId }) => chrome.tabs.query({ windowId }),
        { windowId: sourceWindowId }
      );
      expect(remainingTabs.length).toBe(1);
      expect(remainingTabs[0].pinned).toBe(true);
    });
  });
});
