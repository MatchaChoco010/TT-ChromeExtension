/**
 * Cross-Window Drag & Drop Tests
 *
 * This test suite verifies:
 * 1. Moving tabs between windows updates tree state correctly
 * 2. Parent tabs move independently (Chrome API behavior)
 * 3. Tab movement between multiple windows maintains correct sync
 * 4. Tabs can be moved back to original window
 * 5. Closing windows maintains correct tree state
 *
 * Note: Run with `npm run test:e2e` (headless mode)
 */
import { test } from './fixtures/extension';
import { createWindow, moveTabToWindow, openSidePanelForWindow } from './utils/window-utils';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure, assertWindowClosed, assertWindowExists } from './utils/assertion-utils';
import { waitForSidePanelReady, waitForTabInTreeState } from './utils/polling-utils';

test.describe('Cross-Window Drag & Drop', () => {
  test('Moving tab to another window removes it from source and adds to destination tree', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID and initialize
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Create a tab
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

    // Get new window's pseudo side panel tab and initial browser tab
    const newPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);
    const newInitialBrowserTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);

    // Verify new window initial state
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: newInitialBrowserTabId, depth: 0 },
    ], 0);

    // Move tab to the new window
    await moveTabToWindow(extensionContext, tabId, newWindowId);
    await waitForTabInTreeState(extensionContext, tabId);

    // Reload side panels to reflect changes
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
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);
  });

  test('Moving parent tab to another window moves only the parent (Chrome API behavior)', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID and initialize
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Create parent tab
    const parentTabId = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    // Create child tabs (opened from parent tab)
    const childTabId1 = await createTab(extensionContext, 'https://example.com/child1', parentTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId1, depth: 1 },
    ], 0);

    const childTabId2 = await createTab(extensionContext, 'https://example.com/child2', parentTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId1, depth: 1 },
      { tabId: childTabId2, depth: 1 },
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
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: newInitialBrowserTabId, depth: 0 },
    ], 0);

    // Move parent tab to the new window
    await moveTabToWindow(extensionContext, parentTabId, newWindowId);
    await waitForTabInTreeState(extensionContext, parentTabId);

    // Reload side panels
    await newWindowSidePanel.reload();
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    // Verify original window state (parent moved, children remain but now at depth 0)
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: childTabId1, depth: 0 },
      { tabId: childTabId2, depth: 0 },
    ], 0);

    // Verify new window state (parent added)
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);
  });

  test('Tab movement between multiple windows maintains correct sync', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID and initialize
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Create multiple tabs
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

    const tabId3 = await createTab(extensionContext, 'https://example.com/tab3');
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    // Create two new windows
    const newWindowId1 = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId1);

    const newWindowId2 = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId2);

    // Open side panels for new windows
    const newWindowSidePanel1 = await openSidePanelForWindow(extensionContext, newWindowId1);
    await waitForSidePanelReady(newWindowSidePanel1, serviceWorker);
    const newPseudo1 = await getPseudoSidePanelTabId(serviceWorker, newWindowId1);
    const newInitial1 = await getInitialBrowserTabId(serviceWorker, newWindowId1);
    await assertTabStructure(newWindowSidePanel1, newWindowId1, [
      { tabId: newPseudo1, depth: 0 },
      { tabId: newInitial1, depth: 0 },
    ], 0);

    const newWindowSidePanel2 = await openSidePanelForWindow(extensionContext, newWindowId2);
    await waitForSidePanelReady(newWindowSidePanel2, serviceWorker);
    const newPseudo2 = await getPseudoSidePanelTabId(serviceWorker, newWindowId2);
    const newInitial2 = await getInitialBrowserTabId(serviceWorker, newWindowId2);
    await assertTabStructure(newWindowSidePanel2, newWindowId2, [
      { tabId: newPseudo2, depth: 0 },
      { tabId: newInitial2, depth: 0 },
    ], 0);

    // Move tab1 to window1
    await moveTabToWindow(extensionContext, tabId1, newWindowId1);
    await waitForTabInTreeState(extensionContext, tabId1);

    // Reload and verify
    await newWindowSidePanel1.reload();
    await waitForSidePanelReady(newWindowSidePanel1, serviceWorker);
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await assertTabStructure(newWindowSidePanel1, newWindowId1, [
      { tabId: newPseudo1, depth: 0 },
      { tabId: newInitial1, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    // Move tab2 to window2
    await moveTabToWindow(extensionContext, tabId2, newWindowId2);
    await waitForTabInTreeState(extensionContext, tabId2);

    // Reload and verify
    await newWindowSidePanel2.reload();
    await waitForSidePanelReady(newWindowSidePanel2, serviceWorker);
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await assertTabStructure(newWindowSidePanel2, newWindowId2, [
      { tabId: newPseudo2, depth: 0 },
      { tabId: newInitial2, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);
  });

  test('Tab can be moved back to original window', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID and initialize
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Create a tab
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
    const newPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);
    const newInitialBrowserTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: newInitialBrowserTabId, depth: 0 },
    ], 0);

    // Move tab to the new window
    await moveTabToWindow(extensionContext, tabId, newWindowId);
    await waitForTabInTreeState(extensionContext, tabId);

    // Reload and verify
    await newWindowSidePanel.reload();
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // Move tab back to original window
    await moveTabToWindow(extensionContext, tabId, originalWindowId);
    await waitForTabInTreeState(extensionContext, tabId);

    // Reload and verify
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);
    await newWindowSidePanel.reload();
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: newInitialBrowserTabId, depth: 0 },
    ], 0);
  });

  test('Closing window maintains correct tree state in remaining window', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Get original window ID and initialize
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Create a tab
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
    const newPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);
    const newInitialBrowserTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: newInitialBrowserTabId, depth: 0 },
    ], 0);

    // Move tab to the new window
    await moveTabToWindow(extensionContext, tabId, newWindowId);
    await waitForTabInTreeState(extensionContext, tabId);

    // Reload and verify
    await newWindowSidePanel.reload();
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // Close the new window
    await serviceWorker.evaluate(({ windowId }) => {
      return chrome.windows.remove(windowId);
    }, { windowId: newWindowId });

    // Verify window is closed
    await assertWindowClosed(extensionContext, newWindowId);

    // Verify original window still exists and has correct state
    await assertWindowExists(extensionContext, originalWindowId);
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });
});
