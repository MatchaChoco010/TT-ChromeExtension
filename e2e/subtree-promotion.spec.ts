import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getTestServerUrl } from './utils/tab-utils';
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

    const tabAId = await createTab(serviceWorker, getTestServerUrl('/A'));
    await waitForTabInTreeState(serviceWorker, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(serviceWorker, getTestServerUrl('/B'), tabAId);
    await waitForTabInTreeState(serviceWorker, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(serviceWorker, getTestServerUrl('/C'), tabBId);
    await waitForTabInTreeState(serviceWorker, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const tabDId = await createTab(serviceWorker, getTestServerUrl('/D'), tabBId);
    await waitForTabInTreeState(serviceWorker, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
    ], 0);

    await closeTab(serviceWorker, tabAId);
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

    const tabAId = await createTab(serviceWorker, getTestServerUrl('/A'));
    await waitForTabInTreeState(serviceWorker, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(serviceWorker, getTestServerUrl('/B'), tabAId);
    await waitForTabInTreeState(serviceWorker, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(serviceWorker, getTestServerUrl('/C'), tabBId);
    await waitForTabInTreeState(serviceWorker, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const tabDId = await createTab(serviceWorker, getTestServerUrl('/D'), tabCId);
    await waitForTabInTreeState(serviceWorker, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2, expanded: true },
      { tabId: tabDId, depth: 3 },
    ], 0);

    await closeTab(serviceWorker, tabAId);
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

    const tabAId = await createTab(serviceWorker, getTestServerUrl('/A'));
    await waitForTabInTreeState(serviceWorker, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(serviceWorker, getTestServerUrl('/B'), tabAId);
    await waitForTabInTreeState(serviceWorker, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(serviceWorker, getTestServerUrl('/C'), tabBId);
    await waitForTabInTreeState(serviceWorker, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const tabDId = await createTab(serviceWorker, getTestServerUrl('/D'), tabBId);
    await waitForTabInTreeState(serviceWorker, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
    ], 0);

    const tabEId = await createTab(serviceWorker, getTestServerUrl('/E'), tabAId);
    await waitForTabInTreeState(serviceWorker, tabEId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
      { tabId: tabEId, depth: 1 },
    ], 0);

    const tabFId = await createTab(serviceWorker, getTestServerUrl('/F'), tabAId);
    await waitForTabInTreeState(serviceWorker, tabFId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
      { tabId: tabEId, depth: 1 },
      { tabId: tabFId, depth: 1 },
    ], 0);

    const tabGId = await createTab(serviceWorker, getTestServerUrl('/G'), tabFId);
    await waitForTabInTreeState(serviceWorker, tabGId);
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

    await closeTab(serviceWorker, tabAId);
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
