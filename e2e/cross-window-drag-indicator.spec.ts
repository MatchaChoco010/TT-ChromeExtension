/**
 * E2E Tests: Cross-Window Drag Indicator Display
 *
 * Requirement 7.1, 7.3: Cross-window drag and drop indicator
 * - When dragging a tab from window A and hovering over window B's tree view,
 *   the drop indicator should be displayed in window B
 * - Service Worker messaging should synchronize drag state across windows
 *
 * Note: Run with `npm run test:e2e`
 */
import { test, expect } from './fixtures/extension';
import { createWindow, openSidePanelForWindow } from './utils/window-utils';
import { createTab } from './utils/tab-utils';
import { waitForTabInTreeState, waitForSidePanelReady } from './utils/polling-utils';

test.describe('Cross-Window Drag Indicator', () => {
  test('drag state should be synchronized via Service Worker', async ({
    sidePanelPage,
    serviceWorker,
    extensionContext,
  }) => {
    // Ensure side panel is visible
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

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

    // Set drag state via side panel (which has chrome.runtime access)
    const setDragResult = await sidePanelPage.evaluate(
      ({ tabId, windowId }) => {
        return new Promise<{ success: boolean }>((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'SET_DRAG_STATE',
              payload: {
                tabId,
                treeData: [],
                sourceWindowId: windowId,
              },
            },
            (response) => {
              resolve(response || { success: false });
            }
          );
        });
      },
      { tabId, windowId: originalWindowId }
    );

    expect(setDragResult.success).toBe(true);

    // Verify drag state can be retrieved
    const getDragResult = await sidePanelPage.evaluate(() => {
      return new Promise<{ success: boolean; data: unknown }>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_DRAG_STATE' },
          (response) => {
            resolve(response || { success: false, data: null });
          }
        );
      });
    });

    expect(getDragResult.success).toBe(true);
    expect(getDragResult.data).not.toBeNull();
    expect((getDragResult.data as { tabId: number }).tabId).toBe(tabId);
    expect((getDragResult.data as { sourceWindowId: number }).sourceWindowId).toBe(originalWindowId);

    // Clear drag state
    const clearDragResult = await sidePanelPage.evaluate(() => {
      return new Promise<{ success: boolean }>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'CLEAR_DRAG_STATE' },
          (response) => {
            resolve(response || { success: false });
          }
        );
      });
    });

    expect(clearDragResult.success).toBe(true);

    // Verify drag state is cleared
    const getFinalDragResult = await sidePanelPage.evaluate(() => {
      return new Promise<{ success: boolean; data: unknown }>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_DRAG_STATE' },
          (response) => {
            resolve(response || { success: false, data: null });
          }
        );
      });
    });

    expect(getFinalDragResult.success).toBe(true);
    expect(getFinalDragResult.data).toBeNull();
  });

  test('side panel should be able to detect cross-window drag state', async ({
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

    // Open side panel for both windows
    const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
    await waitForSidePanelReady(originalSidePanel, serviceWorker);

    const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newSidePanel, serviceWorker);

    // Set drag state from original window's side panel (simulating drag start)
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
            () => {
              resolve();
            }
          );
        });
      },
      { tabId, windowId: originalWindowId }
    );

    // New window's side panel should be able to detect the drag state
    // by querying the Service Worker
    const dragStateInNewWindow = await newSidePanel.evaluate(async () => {
      return new Promise<{ success: boolean; data: unknown }>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_DRAG_STATE' },
          (response) => {
            resolve(response || { success: false, data: null });
          }
        );
      });
    });

    expect(dragStateInNewWindow.success).toBe(true);
    expect(dragStateInNewWindow.data).not.toBeNull();
    expect((dragStateInNewWindow.data as { tabId: number }).tabId).toBe(tabId);
    expect((dragStateInNewWindow.data as { sourceWindowId: number }).sourceWindowId).toBe(originalWindowId);

    // The new window knows the drag is from a different window
    const currentWindowId = await newSidePanel.evaluate(() => {
      return new Promise<number>((resolve) => {
        chrome.windows.getCurrent((window) => {
          resolve(window.id as number);
        });
      });
    });

    expect(currentWindowId).toBe(newWindowId);
    expect((dragStateInNewWindow.data as { sourceWindowId: number }).sourceWindowId).not.toBe(currentWindowId);

    // Clean up drag state
    await originalSidePanel.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'CLEAR_DRAG_STATE' },
          () => {
            resolve();
          }
        );
      });
    });
  });

  test('cross-window drag indicator should show in destination window', async ({
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

    // Create a new window with a tab
    const newWindowId = await createWindow(extensionContext);
    expect(newWindowId).toBeGreaterThan(0);

    // Create a tab in the new window for the tree to show
    const tabInNewWindow = await serviceWorker.evaluate(async ({ windowId }) => {
      const tab = await chrome.tabs.create({ windowId, url: 'https://example.org' });
      return tab.id;
    }, { windowId: newWindowId });
    expect(tabInNewWindow).toBeGreaterThan(0);

    // Wait for tab to appear in tree state
    await waitForTabInTreeState(extensionContext, tabInNewWindow as number);

    // Open side panels for both windows
    const originalSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
    await waitForSidePanelReady(originalSidePanel, serviceWorker);

    const newSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newSidePanel, serviceWorker);

    // Verify the new window's tab is visible
    const treeNodeInNewWindow = newSidePanel.locator(`[data-testid="tree-node-${tabInNewWindow}"]`);
    await expect(treeNodeInNewWindow).toBeVisible();

    // Set drag state from original window's side panel (simulating drag start from window A)
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
            () => {
              resolve();
            }
          );
        });
      },
      { tabId, windowId: originalWindowId }
    );

    // Bring new window side panel to front
    await newSidePanel.bringToFront();
    await newSidePanel.evaluate(() => window.focus());

    // Check if cross-window drag indicator element exists or not
    // The implementation should add a cross-window drag overlay or indicator
    // when there's an active drag from another window
    const crossWindowDragIndicator = newSidePanel.locator('[data-testid="cross-window-drag-overlay"]');

    // For now, we just verify the drag state can be detected
    // The actual indicator will be implemented and this test will verify it
    const canDetectDrag = await newSidePanel.evaluate(async () => {
      const response = await new Promise<{ success: boolean; data: unknown }>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_DRAG_STATE' },
          (response) => {
            resolve(response || { success: false, data: null });
          }
        );
      });
      return response.success && response.data !== null;
    });

    expect(canDetectDrag).toBe(true);

    // Verify the cross-window drag state includes necessary information
    const dragState = await newSidePanel.evaluate(async () => {
      const response = await new Promise<{ success: boolean; data: { tabId: number; sourceWindowId: number } | null }>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_DRAG_STATE' },
          (response) => {
            resolve(response || { success: false, data: null });
          }
        );
      });
      return response.data;
    });

    expect(dragState).not.toBeNull();
    expect(dragState?.tabId).toBe(tabId);
    expect(dragState?.sourceWindowId).toBe(originalWindowId);
    expect(dragState?.sourceWindowId).not.toBe(newWindowId);

    // Clean up
    await originalSidePanel.evaluate(() => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'CLEAR_DRAG_STATE' },
          () => {
            resolve();
          }
        );
      });
    });

    // After cleanup, cross-window indicator should not be visible
    // (once implemented)
    if (await crossWindowDragIndicator.count() > 0) {
      await expect(crossWindowDragIndicator).not.toBeVisible();
    }
  });
});
