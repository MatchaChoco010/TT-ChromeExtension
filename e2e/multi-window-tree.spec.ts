import { test } from './fixtures/extension';
import { moveTabToWindow } from './utils/window-utils';
import { createTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure, assertWindowExists } from './utils/assertion-utils';
import { waitForTabInTreeState, waitForSidePanelReady } from './utils/polling-utils';
import { setupWindow, createAndSetupWindow } from './utils/setup-utils';

test.describe('Multi-Window Tab Tree Display Separation', () => {
  test('each window should only display its own tabs in the tab tree', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, originalWindowId);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/tab1'));
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/tab2'));
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const { windowId: newWindowId, initialBrowserTabId: newInitialBrowserTabId, sidePanelPage: newWindowSidePanel, pseudoSidePanelTabId: newPseudoSidePanelTabId } =
      await createAndSetupWindow(extensionContext, serviceWorker);
    await assertWindowExists(extensionContext, newWindowId);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/tab3'), { windowId: newWindowId });
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await newWindowSidePanel.reload();
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await newWindowSidePanel.close();
  });

  test('when tab is moved to another window, it should appear in the destination window tree and disappear from source', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, originalWindowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    const { windowId: newWindowId, initialBrowserTabId: newInitialBrowserTabId, sidePanelPage: newWindowSidePanel, pseudoSidePanelTabId: newPseudoSidePanelTabId } =
      await createAndSetupWindow(extensionContext, serviceWorker);
    await assertWindowExists(extensionContext, newWindowId);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
    ], 0);

    await moveTabToWindow(extensionContext, tabId, newWindowId);
    await waitForTabInTreeState(serviceWorker, tabId);

    await newWindowSidePanel.reload();
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await newWindowSidePanel.close();
  });

  test('new window should have empty tab tree except for default new tab', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, originalWindowId);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/tab1'));
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/tab2'));
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const { windowId: newWindowId, initialBrowserTabId: newInitialBrowserTabId, sidePanelPage: newWindowSidePanel, pseudoSidePanelTabId: newPseudoSidePanelTabId } =
      await createAndSetupWindow(extensionContext, serviceWorker);
    await assertWindowExists(extensionContext, newWindowId);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
    ], 0);

    await newWindowSidePanel.close();
  });
});
