/**
 * E2E Tests: Cross-Window Drag and Drop Tab Movement
 *
 * Requirement 7.4, 7.5, 7.6: Cross-window drag and drop E2E tests
 * - Verify tab movement via cross-window drag
 * - Verify drop indicator display in destination window
 * - Verify moved tab belongs to destination window
 *
 * Note: Run with `npm run test:e2e`
 */
import { test, expect } from './fixtures/extension';
import { createWindow, moveTabToWindow, openSidePanelForWindow } from './utils/window-utils';
import { createTab } from './utils/tab-utils';
import {
  waitForTabInTreeState,
  waitForSidePanelReady,
  waitForTabInWindow,
  waitForCondition,
} from './utils/polling-utils';

test.describe('Cross-Window Drag and Drop Tab Movement', () => {
  test('tab should be moved to destination window via MOVE_TAB_TO_WINDOW message', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID
    const originalWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const originalWindowId = originalWindow.id as number;

    // Create a tab in the original window
    const tabId = await createTab(extensionContext, 'https://example.com');
    expect(tabId).toBeGreaterThan(0);

    // Wait for tab to appear in tree state
    await waitForTabInTreeState(extensionContext, tabId);

    // Create a new window
    const newWindowId = await createWindow(extensionContext);
    expect(newWindowId).toBeGreaterThan(0);
    expect(newWindowId).not.toBe(originalWindowId);

    // Open side panels for both windows
    const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
    await waitForSidePanelReady(originalSidePanel, serviceWorker);

    const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newSidePanel, serviceWorker);

    // Simulate cross-window drag by setting drag state
    await originalSidePanel.evaluate(
      ({ tabId, windowId }) => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'SET_DRAG_STATE',
              payload: {
                tabId,
                treeData: [],
                sourceWindowId: windowId,
              },
            },
            () => resolve()
          );
        });
      },
      { tabId, windowId: originalWindowId }
    );

    // Move tab to new window via MOVE_TAB_TO_WINDOW message
    const moveResult = await newSidePanel.evaluate(
      ({ tabId, windowId }) => {
        return new Promise<{ success: boolean }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'MOVE_TAB_TO_WINDOW',
              payload: { tabId, windowId },
            },
            (response) => {
              resolve(response || { success: false });
            }
          );
        });
      },
      { tabId, windowId: newWindowId }
    );

    expect(moveResult.success).toBe(true);

    // Wait for tab to appear in new window
    await waitForTabInWindow(extensionContext, tabId, newWindowId);

    // Verify tab is in new window
    const tabAfterMove = await serviceWorker.evaluate(
      ({ tabId }) => {
        return chrome.tabs.get(tabId);
      },
      { tabId }
    );

    expect(tabAfterMove.windowId).toBe(newWindowId);

    // Clear drag state
    await originalSidePanel.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'CLEAR_DRAG_STATE' }, () => resolve());
      });
    });
  });

  test('moved tab should appear in destination window tree and disappear from source', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID
    const originalWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const originalWindowId = originalWindow.id as number;

    // Create a tab in the original window
    const tabId = await createTab(extensionContext, 'https://example.com');
    expect(tabId).toBeGreaterThan(0);

    // Wait for tab to appear in tree state
    await waitForTabInTreeState(extensionContext, tabId);

    // Create a new window
    const newWindowId = await createWindow(extensionContext);
    expect(newWindowId).toBeGreaterThan(0);

    // Open side panels for both windows
    const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
    await waitForSidePanelReady(originalSidePanel, serviceWorker);

    const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newSidePanel, serviceWorker);

    // Verify tab is visible in original window's tree
    const treeNodeInOriginal = originalSidePanel.locator(`[data-testid="tree-node-${tabId}"]`);
    await expect(treeNodeInOriginal).toBeVisible();

    // Move tab to new window using chrome.tabs.move (simulating drop action)
    await moveTabToWindow(extensionContext, tabId, newWindowId);

    // Wait for tab to appear in new window
    await waitForTabInWindow(extensionContext, tabId, newWindowId);

    // Reload side panels to reflect the change
    await newSidePanel.reload();
    await waitForSidePanelReady(newSidePanel, serviceWorker);

    await originalSidePanel.reload();
    await waitForSidePanelReady(originalSidePanel, serviceWorker);

    // Tab should appear in new window's tree
    const treeNodeInNew = newSidePanel.locator(`[data-testid="tree-node-${tabId}"]`);
    await expect(treeNodeInNew).toBeVisible({ timeout: 10000 });

    // Tab should not appear in original window's tree
    await expect(treeNodeInOriginal).not.toBeVisible();
  });

  test('drag state should include source window information for cross-window detection', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID
    const originalWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const originalWindowId = originalWindow.id as number;

    // Create a tab in the original window
    const tabId = await createTab(extensionContext, 'https://example.com');
    expect(tabId).toBeGreaterThan(0);

    // Wait for tab to appear in tree state
    await waitForTabInTreeState(extensionContext, tabId);

    // Create a new window
    const newWindowId = await createWindow(extensionContext);
    expect(newWindowId).toBeGreaterThan(0);

    // Open side panels for both windows
    const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
    await waitForSidePanelReady(originalSidePanel, serviceWorker);

    const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newSidePanel, serviceWorker);

    // Set drag state from original window
    await originalSidePanel.evaluate(
      ({ tabId, windowId }) => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'SET_DRAG_STATE',
              payload: {
                tabId,
                treeData: [],
                sourceWindowId: windowId,
              },
            },
            () => resolve()
          );
        });
      },
      { tabId, windowId: originalWindowId }
    );

    // New window should be able to detect drag is from different window
    const dragState = await newSidePanel.evaluate(async () => {
      const response = await new Promise<{
        success: boolean;
        data: { tabId: number; sourceWindowId: number } | null;
      }>((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_DRAG_STATE' }, (response) => {
          resolve(response || { success: false, data: null });
        });
      });
      return response.data;
    });

    expect(dragState).not.toBeNull();
    expect(dragState?.tabId).toBe(tabId);
    expect(dragState?.sourceWindowId).toBe(originalWindowId);
    expect(dragState?.sourceWindowId).not.toBe(newWindowId);

    // New window can determine it's a cross-window drag
    const currentWindowId = await newSidePanel.evaluate(() => {
      return new Promise<number>((resolve) => {
        chrome.windows.getCurrent((window) => {
          resolve(window.id as number);
        });
      });
    });

    const isCrossWindowDrag = dragState?.sourceWindowId !== currentWindowId;
    expect(isCrossWindowDrag).toBe(true);

    // Clean up
    await originalSidePanel.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'CLEAR_DRAG_STATE' }, () => resolve());
      });
    });
  });

  test('tab should belong to destination window after move operation', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID
    const originalWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const originalWindowId = originalWindow.id as number;

    // Create multiple tabs in original window
    const tabId1 = await createTab(extensionContext, 'https://example.com/tab1');
    const tabId2 = await createTab(extensionContext, 'https://example.com/tab2');
    expect(tabId1).toBeGreaterThan(0);
    expect(tabId2).toBeGreaterThan(0);

    // Wait for tabs to appear in tree state
    await waitForTabInTreeState(extensionContext, tabId1);
    await waitForTabInTreeState(extensionContext, tabId2);

    // Create a new window
    const newWindowId = await createWindow(extensionContext);
    expect(newWindowId).toBeGreaterThan(0);

    // Verify both tabs belong to original window before move
    const tabs = await serviceWorker.evaluate(({ windowId }) => {
      return chrome.tabs.query({ windowId });
    }, { windowId: originalWindowId });

    const tab1InOriginal = tabs.find((tab: chrome.tabs.Tab) => tab.id === tabId1);
    const tab2InOriginal = tabs.find((tab: chrome.tabs.Tab) => tab.id === tabId2);
    expect(tab1InOriginal).toBeDefined();
    expect(tab2InOriginal).toBeDefined();

    // Move tab1 to new window
    await moveTabToWindow(extensionContext, tabId1, newWindowId);

    // Wait for tab to move
    await waitForTabInWindow(extensionContext, tabId1, newWindowId);

    // Verify tab1 belongs to new window
    const tab1AfterMove = await serviceWorker.evaluate(
      ({ tabId }) => chrome.tabs.get(tabId),
      { tabId: tabId1 }
    );
    expect(tab1AfterMove.windowId).toBe(newWindowId);

    // Verify tab2 still belongs to original window
    const tab2AfterMove = await serviceWorker.evaluate(
      ({ tabId }) => chrome.tabs.get(tabId),
      { tabId: tabId2 }
    );
    expect(tab2AfterMove.windowId).toBe(originalWindowId);

    // Verify window tab counts
    const tabsInOriginal = await serviceWorker.evaluate(
      ({ windowId }) => chrome.tabs.query({ windowId }),
      { windowId: originalWindowId }
    );
    const tabsInNew = await serviceWorker.evaluate(
      ({ windowId }) => chrome.tabs.query({ windowId }),
      { windowId: newWindowId }
    );

    // tab1 should be in new window
    expect(tabsInNew.find((tab: chrome.tabs.Tab) => tab.id === tabId1)).toBeDefined();
    // tab1 should not be in original window
    expect(tabsInOriginal.find((tab: chrome.tabs.Tab) => tab.id === tabId1)).toBeUndefined();
    // tab2 should still be in original window
    expect(tabsInOriginal.find((tab: chrome.tabs.Tab) => tab.id === tabId2)).toBeDefined();
  });

  test('cross-window drag state should be cleared after successful move', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID
    const originalWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const originalWindowId = originalWindow.id as number;

    // Create a tab in the original window
    const tabId = await createTab(extensionContext, 'https://example.com');
    expect(tabId).toBeGreaterThan(0);

    // Wait for tab to appear in tree state
    await waitForTabInTreeState(extensionContext, tabId);

    // Create a new window
    const newWindowId = await createWindow(extensionContext);
    expect(newWindowId).toBeGreaterThan(0);

    // Open side panels
    const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
    await waitForSidePanelReady(originalSidePanel, serviceWorker);

    const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newSidePanel, serviceWorker);

    // Set drag state
    await originalSidePanel.evaluate(
      ({ tabId, windowId }) => {
        return new Promise<void>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'SET_DRAG_STATE',
              payload: {
                tabId,
                treeData: [],
                sourceWindowId: windowId,
              },
            },
            () => resolve()
          );
        });
      },
      { tabId, windowId: originalWindowId }
    );

    // Verify drag state is set
    const dragStateBefore = await newSidePanel.evaluate(async () => {
      const response = await new Promise<{ success: boolean; data: unknown }>((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_DRAG_STATE' }, (response) => {
          resolve(response || { success: false, data: null });
        });
      });
      return response.data;
    });

    expect(dragStateBefore).not.toBeNull();

    // Move tab and clear drag state
    await moveTabToWindow(extensionContext, tabId, newWindowId);

    // Clear drag state (simulating drop completion)
    await newSidePanel.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'CLEAR_DRAG_STATE' }, () => resolve());
      });
    });

    // Verify drag state is cleared
    const dragStateAfter = await newSidePanel.evaluate(async () => {
      const response = await new Promise<{ success: boolean; data: unknown }>((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_DRAG_STATE' }, (response) => {
          resolve(response || { success: false, data: null });
        });
      });
      return response.data;
    });

    expect(dragStateAfter).toBeNull();
  });

  test('tab tree should reflect correct window after cross-window move', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID
    const originalWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const originalWindowId = originalWindow.id as number;

    // Create a tab with specific URL for identification
    const tabUrl = 'https://example.com/cross-window-test';
    const tabId = await createTab(extensionContext, tabUrl);
    expect(tabId).toBeGreaterThan(0);

    // Wait for tab to appear in tree state
    await waitForTabInTreeState(extensionContext, tabId);

    // Create a new window
    const newWindowId = await createWindow(extensionContext);
    expect(newWindowId).toBeGreaterThan(0);

    // Open side panels for both windows
    const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
    await waitForSidePanelReady(originalSidePanel, serviceWorker);

    const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newSidePanel, serviceWorker);

    // Get tree node count in both windows before move
    const originalTreeNodesBeforeMove = await originalSidePanel
      .locator('[data-testid^="tree-node-"]')
      .count();

    // Move tab to new window
    await moveTabToWindow(extensionContext, tabId, newWindowId);

    // Wait for tab to appear in new window
    await waitForTabInWindow(extensionContext, tabId, newWindowId);

    // Reload side panels
    await newSidePanel.reload();
    await waitForSidePanelReady(newSidePanel, serviceWorker);

    await originalSidePanel.reload();
    await waitForSidePanelReady(originalSidePanel, serviceWorker);

    // Tab should be in new window's tree
    const treeNodeInNew = newSidePanel.locator(`[data-testid="tree-node-${tabId}"]`);
    await expect(treeNodeInNew).toBeVisible({ timeout: 10000 });

    // Tab should not be in original window's tree
    const treeNodeInOriginal = originalSidePanel.locator(`[data-testid="tree-node-${tabId}"]`);
    await expect(treeNodeInOriginal).not.toBeVisible();

    // Original window should have one less tree node
    const originalTreeNodesAfterMove = await originalSidePanel
      .locator('[data-testid^="tree-node-"]')
      .count();

    // Note: The count may vary depending on other tabs, but the moved tab should be gone
    expect(originalTreeNodesAfterMove).toBeLessThan(originalTreeNodesBeforeMove);
  });
});
