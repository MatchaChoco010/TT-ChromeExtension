import { test } from './fixtures/extension';
import { createWindow, moveTabToWindow, openSidePanelForWindow } from './utils/window-utils';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure, assertWindowExists } from './utils/assertion-utils';
import { waitForTabInTreeState, waitForSidePanelReady } from './utils/polling-utils';

test.describe('Multi-Window Tab Tree Display Separation', () => {
  test('each window should only display its own tabs in the tab tree', async ({
    extensionContext,
    serviceWorker,
    sidePanelPage,
  }) => {
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId1 = await createTab(extensionContext, getTestServerUrl('/tab1'));
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, getTestServerUrl('/tab2'));
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    const newPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);
    const newInitialBrowserTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId3 = await createTab(extensionContext, getTestServerUrl('/tab3'), { windowId: newWindowId });
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
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await newWindowSidePanel.close();
  });

  test('when tab is moved to another window, it should appear in the destination window tree and disappear from source', async ({
    extensionContext,
    serviceWorker,
    sidePanelPage,
  }) => {
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    const newPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);
    const newInitialBrowserTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
    ], 0);

    await moveTabToWindow(extensionContext, tabId, newWindowId);
    await waitForTabInTreeState(extensionContext, tabId);

    await newWindowSidePanel.reload();
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);
    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);

    await assertTabStructure(sidePanelPage, originalWindowId, [
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
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const originalWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, originalWindowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, originalWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId1 = await createTab(extensionContext, getTestServerUrl('/tab1'));
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, getTestServerUrl('/tab2'));
    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);

    const newPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);
    const newInitialBrowserTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newInitialBrowserTabId, depth: 0 },
      { tabId: newPseudoSidePanelTabId, depth: 0 },
    ], 0);

    await newWindowSidePanel.close();
  });
});
