import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, getTestServerUrl } from './utils/tab-utils';
import { waitForTabInTreeState } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('親タブ削除時のサブツリー親子関係維持', () => {
  test('親タブを閉じても子タブ間の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabAId = await createTab(extensionContext, getTestServerUrl('/A'));
    await waitForTabInTreeState(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(extensionContext, getTestServerUrl('/B'), tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(extensionContext, getTestServerUrl('/C'), tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const tabDId = await createTab(extensionContext, getTestServerUrl('/D'), tabBId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
    ], 0);

    await closeTab(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabBId, depth: 0, expanded: true },
      { tabId: tabCId, depth: 1 },
      { tabId: tabDId, depth: 1 },
    ], 0);
  });

  test('3階層のツリーで親を閉じても孫の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabAId = await createTab(extensionContext, getTestServerUrl('/A'));
    await waitForTabInTreeState(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(extensionContext, getTestServerUrl('/B'), tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(extensionContext, getTestServerUrl('/C'), tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const tabDId = await createTab(extensionContext, getTestServerUrl('/D'), tabCId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2, expanded: true },
      { tabId: tabDId, depth: 3 },
    ], 0);

    await closeTab(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabBId, depth: 0, expanded: true },
      { tabId: tabCId, depth: 1, expanded: true },
      { tabId: tabDId, depth: 2 },
    ], 0);
  });

  test('複数の子タブにそれぞれ孫がある場合、親を閉じても全ての親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabAId = await createTab(extensionContext, getTestServerUrl('/A'));
    await waitForTabInTreeState(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(extensionContext, getTestServerUrl('/B'), tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(extensionContext, getTestServerUrl('/C'), tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const tabDId = await createTab(extensionContext, getTestServerUrl('/D'), tabBId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
    ], 0);

    const tabEId = await createTab(extensionContext, getTestServerUrl('/E'), tabAId);
    await waitForTabInTreeState(extensionContext, tabEId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
      { tabId: tabEId, depth: 1 },
    ], 0);

    const tabFId = await createTab(extensionContext, getTestServerUrl('/F'), tabAId);
    await waitForTabInTreeState(extensionContext, tabFId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
      { tabId: tabEId, depth: 1 },
      { tabId: tabFId, depth: 1 },
    ], 0);

    const tabGId = await createTab(extensionContext, getTestServerUrl('/G'), tabFId);
    await waitForTabInTreeState(extensionContext, tabGId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
      { tabId: tabEId, depth: 1 },
      { tabId: tabFId, depth: 1, expanded: true },
      { tabId: tabGId, depth: 2 },
    ], 0);

    await closeTab(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabBId, depth: 0, expanded: true },
      { tabId: tabCId, depth: 1 },
      { tabId: tabDId, depth: 1 },
      { tabId: tabEId, depth: 0 },
      { tabId: tabFId, depth: 0, expanded: true },
      { tabId: tabGId, depth: 1 },
    ], 0);
  });
});
