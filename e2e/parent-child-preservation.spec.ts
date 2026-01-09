import { test, expect } from './fixtures/extension';
import { createTab, getCurrentWindowId, getPseudoSidePanelTabId, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('新規タブ作成時の親子関係維持', () => {
  test('既存の親子関係がある状態で新しいタブを開いても、既存の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/child'), parentTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    const newTabId = await createTab(serviceWorker, getTestServerUrl('/new'));

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });

  test('複数のタブが親子関係にある状態で新しいタブを開いても、他のタブの親子関係を解消しない', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const parent1TabId = await createTab(serviceWorker, getTestServerUrl('/parent1'));

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
    ], 0);

    const child1TabId = await createTab(serviceWorker, getTestServerUrl('/child1'), parent1TabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
    ], 0);

    const parent2TabId = await createTab(serviceWorker, getTestServerUrl('/parent2'));

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0 },
    ], 0);

    const child2TabId = await createTab(serviceWorker, getTestServerUrl('/child2'), parent2TabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);

    const newTabId = await createTab(serviceWorker, getTestServerUrl('/new2'));

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });

  test('孫タブまである親子関係が、新しいタブ作成後も維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/child'), parentTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    const grandchildTabId = await createTab(serviceWorker, getTestServerUrl('/grandchild'), childTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1, expanded: true },
      { tabId: grandchildTabId, depth: 2 },
    ], 0);

    const newTabId = await createTab(serviceWorker, getTestServerUrl('/new'));

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1, expanded: true },
      { tabId: grandchildTabId, depth: 2 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });
});
