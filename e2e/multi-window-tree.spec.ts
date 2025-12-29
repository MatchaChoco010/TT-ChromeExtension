/**
 * E2E Tests: Multi-Window Tab Tree Display Separation
 *
 * Requirement 14.1, 14.2, 14.3: Multi-window support
 * - Each window's tab tree should only display tabs from that window
 * - Tab trees should not be shared across all windows
 * - New windows should show their own dedicated tab tree
 *
 * Note: Run with `npm run test:e2e`
 */
import { test, expect } from './fixtures/extension';
import { createWindow, moveTabToWindow, openSidePanelForWindow } from './utils/window-utils';
import { createTab } from './utils/tab-utils';
import { waitForTabInTreeState, waitForSidePanelReady } from './utils/polling-utils';

test.describe('Multi-Window Tab Tree Display Separation', () => {
  test('each window should only display its own tabs in the tab tree', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID
    const originalWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const originalWindowId = originalWindow.id as number;

    // Create tabs in the original window
    const tabId1 = await createTab(extensionContext, 'https://example.com/tab1');
    const tabId2 = await createTab(extensionContext, 'https://example.com/tab2');
    expect(tabId1).toBeGreaterThan(0);
    expect(tabId2).toBeGreaterThan(0);

    // Wait for tabs to appear in tree state
    await waitForTabInTreeState(extensionContext, tabId1);
    await waitForTabInTreeState(extensionContext, tabId2);

    // Open side panel for the original window with windowId parameter
    const originalWindowSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
    await waitForSidePanelReady(originalWindowSidePanel, serviceWorker);

    // Verify tabs are displayed in the original window's side panel
    const treeNode1 = originalWindowSidePanel.locator(`[data-testid="tree-node-${tabId1}"]`);
    const treeNode2 = originalWindowSidePanel.locator(`[data-testid="tree-node-${tabId2}"]`);
    await expect(treeNode1).toBeVisible();
    await expect(treeNode2).toBeVisible();

    // Create a new window
    const newWindowId = await createWindow(extensionContext);
    expect(newWindowId).toBeGreaterThan(0);
    expect(newWindowId).not.toBe(originalWindowId);

    // Create a tab in the new window
    const tabId3 = await serviceWorker.evaluate(async ({ windowId }) => {
      const tab = await chrome.tabs.create({ windowId, url: 'https://example.com/tab3' });
      return tab.id;
    }, { windowId: newWindowId });
    expect(tabId3).toBeGreaterThan(0);

    // Wait for tab3 to be registered in tree state
    await waitForTabInTreeState(extensionContext, tabId3 as number);

    // Open side panel for the new window
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    // In the new window's side panel, tab3 should be visible
    const treeNode3InNewWindow = newWindowSidePanel.locator(`[data-testid="tree-node-${tabId3}"]`);
    await expect(treeNode3InNewWindow).toBeVisible();

    // In the new window's side panel, tabs from original window (tabId1, tabId2) should NOT be visible
    const treeNode1InNewWindow = newWindowSidePanel.locator(`[data-testid="tree-node-${tabId1}"]`);
    const treeNode2InNewWindow = newWindowSidePanel.locator(`[data-testid="tree-node-${tabId2}"]`);
    await expect(treeNode1InNewWindow).not.toBeVisible();
    await expect(treeNode2InNewWindow).not.toBeVisible();

    // Reload original window's side panel to verify it still shows only its tabs
    await originalWindowSidePanel.reload();
    await waitForSidePanelReady(originalWindowSidePanel, serviceWorker);

    // In the original window's side panel, tab3 should NOT be visible
    const treeNode3InOriginal = originalWindowSidePanel.locator(`[data-testid="tree-node-${tabId3}"]`);
    await expect(treeNode3InOriginal).not.toBeVisible();

    // In the original window's side panel, its own tabs should still be visible
    await expect(treeNode1).toBeVisible();
    await expect(treeNode2).toBeVisible();
  });

  test('when tab is moved to another window, it should appear in the destination window tree and disappear from source', async ({
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

    // Open side panel for the original window with windowId parameter
    const originalWindowSidePanel = await openSidePanelForWindow(extensionContext, originalWindowId);
    await waitForSidePanelReady(originalWindowSidePanel, serviceWorker);

    // Verify tab is displayed in original window
    const treeNode = originalWindowSidePanel.locator(`[data-testid="tree-node-${tabId}"]`);
    await expect(treeNode).toBeVisible();

    // Create a new window
    const newWindowId = await createWindow(extensionContext);
    expect(newWindowId).toBeGreaterThan(0);

    // Open side panel for new window
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    // Tab should NOT be visible in new window's tree (before move)
    const treeNodeInNewWindow = newWindowSidePanel.locator(`[data-testid="tree-node-${tabId}"]`);
    await expect(treeNodeInNewWindow).not.toBeVisible();

    // Move tab to new window
    await moveTabToWindow(extensionContext, tabId, newWindowId);

    // Wait for tabInfoMap to update and reload the side panel to get new window ID
    // Tab moves update the windowId in tabInfoMap, but the side panel needs to re-render
    await newWindowSidePanel.reload();
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    // Tab should now be visible in new window's tree
    await expect(treeNodeInNewWindow).toBeVisible({ timeout: 10000 });

    // Reload original window's side panel to reflect the change
    await originalWindowSidePanel.reload();
    await waitForSidePanelReady(originalWindowSidePanel, serviceWorker);

    // Tab should NOT be visible in original window's tree anymore
    await expect(treeNode).not.toBeVisible();
  });

  test('new window should have empty tab tree except for default new tab', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Verify Side Panel is visible
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // Create tabs in original window
    const tabId1 = await createTab(extensionContext, 'https://example.com/tab1');
    const tabId2 = await createTab(extensionContext, 'https://example.com/tab2');

    // Wait for tabs to appear
    await waitForTabInTreeState(extensionContext, tabId1);
    await waitForTabInTreeState(extensionContext, tabId2);

    // Create a new window (Chrome automatically creates a new tab page)
    const newWindowId = await createWindow(extensionContext);
    expect(newWindowId).toBeGreaterThan(0);

    // Open side panel for new window
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    // Original window's tabs should NOT appear in new window's tree
    const treeNode1InNewWindow = newWindowSidePanel.locator(`[data-testid="tree-node-${tabId1}"]`);
    const treeNode2InNewWindow = newWindowSidePanel.locator(`[data-testid="tree-node-${tabId2}"]`);
    await expect(treeNode1InNewWindow).not.toBeVisible();
    await expect(treeNode2InNewWindow).not.toBeVisible();

    // New window should only show its tabs (not tabs from original window)
    // Get tabs in new window - Note: There will be at least one tab (new tab page)
    // and possibly a side panel page as well
    const tabsInNewWindow = await serviceWorker.evaluate(
      ({ windowId }) => {
        return chrome.tabs.query({ windowId });
      },
      { windowId: newWindowId }
    );

    // There should be at least 1 tab (the default new tab)
    expect(tabsInNewWindow.length).toBeGreaterThanOrEqual(1);

    // Any tabs in the new window should be visible in its tree
    // Filter out the extension pages (sidepanel pages don't have normal URLs)
    const normalTabs = tabsInNewWindow.filter(
      (tab: chrome.tabs.Tab) => !tab.url?.startsWith('chrome-extension://')
    );

    if (normalTabs.length > 0) {
      const newTabId = normalTabs[0].id as number;
      const newTabTreeNode = newWindowSidePanel.locator(`[data-testid="tree-node-${newTabId}"]`);
      await expect(newTabTreeNode).toBeVisible();
    }
  });
});
