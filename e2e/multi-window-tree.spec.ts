/**
 * E2E Tests: Multi-Window Tab Tree Display Separation
 *
 * Multi-window support:
 * - Each window's tab tree should only display tabs from that window
 * - Tab trees should not be shared across all windows
 * - New windows should show their own dedicated tab tree
 *
 * Note: Run with `npm run test:e2e`
 */
import { test } from './fixtures/extension';
import { createWindow, moveTabToWindow, openSidePanelForWindow } from './utils/window-utils';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure, assertWindowExists } from './utils/assertion-utils';
import { waitForTabInTreeState, waitForSidePanelReady } from './utils/polling-utils';

test.describe('Multi-Window Tab Tree Display Separation', () => {
  test('each window should only display its own tabs in the tab tree', async ({
    extensionContext,
    serviceWorker,
    sidePanelPage,
  }) => {
    // Initialize test state
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Create tabs in the original window
    const tabId1 = await createTab(extensionContext, 'https://example.com/tab1');
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'https://example.com/tab2');
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    // Create a new window
    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    // Open side panel for new window
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    // Get new window's tabs
    const newPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);
    const newInitialBrowserTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Create a tab in the new window
    const tabId3 = await createTab(extensionContext, 'https://example.com/tab3', { windowId: newWindowId });
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    // Reload side panel to reflect new tab
    await newWindowSidePanel.reload();
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    // Verify new window state (includes the new tab)
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    // Reload original window's side panel to verify it still shows only its tabs
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    // Verify original window state (unchanged)
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);
  });

  test('when tab is moved to another window, it should appear in the destination window tree and disappear from source', async ({
    extensionContext,
    serviceWorker,
    sidePanelPage,
  }) => {
    // Initialize test state
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Create a tab in the original window
    const tabId = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // Create a new window
    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    // Open side panel for new window
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    // Get new window's tabs
    const newPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);
    const newInitialBrowserTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Move tab to new window
    await moveTabToWindow(extensionContext, tabId, newWindowId);
    await waitForTabInTreeState(extensionContext, tabId);

    // Reload side panels to reflect the change
    await newWindowSidePanel.reload();
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    // Verify original window state (tab removed)
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Verify new window state (tab added)
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);
  });

  test('new window should have empty tab tree except for default new tab', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Initialize test state
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Create tabs in original window
    const tabId1 = await createTab(extensionContext, 'https://example.com/tab1');
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'https://example.com/tab2');
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    // Create a new window (Chrome automatically creates a new tab page)
    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    // Open side panel for new window
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    // Get new window's tabs
    const newPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);
    const newInitialBrowserTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);

    // New window should only show its tabs (default new tab + pseudo side panel)
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
    ], 0);
  });
});
