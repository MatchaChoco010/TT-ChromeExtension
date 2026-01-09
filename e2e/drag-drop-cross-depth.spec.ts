import { test, expect } from './fixtures/extension';
import { createTab, getCurrentWindowId, getPseudoSidePanelTabId, getTestServerUrl } from './utils/tab-utils';
import { reorderTabs, moveTabToParent } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ドラッグ&ドロップによる異なる深さ間の移動', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);

  test('異なる深さのノード間のギャップにサブツリーをドロップした場合、下のノードの親の子として配置されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const tabA = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
    ], 0);

    const tabB = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
    ], 0);

    const tabC = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
    ], 0);

    const tabD = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
    ], 0);

    const tabE = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
    ], 0);

    const tabF = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
      { tabId: tabF, depth: 0 },
    ], 0);

    const tabG = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
      { tabId: tabF, depth: 0 },
      { tabId: tabG, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, tabB, tabA, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
      { tabId: tabF, depth: 0 },
      { tabId: tabG, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, tabC, tabB, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1, expanded: true },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
      { tabId: tabF, depth: 0 },
      { tabId: tabG, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, tabD, tabB, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1, expanded: true },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 2 },
      { tabId: tabE, depth: 0 },
      { tabId: tabF, depth: 0 },
      { tabId: tabG, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, tabE, tabA, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1, expanded: true },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 2 },
      { tabId: tabE, depth: 1 },
      { tabId: tabF, depth: 0 },
      { tabId: tabG, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, tabF, tabA, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1, expanded: true },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 2 },
      { tabId: tabE, depth: 1 },
      { tabId: tabF, depth: 1 },
      { tabId: tabG, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, tabG, tabF, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1, expanded: true },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 2 },
      { tabId: tabE, depth: 1 },
      { tabId: tabF, depth: 1, expanded: true },
      { tabId: tabG, depth: 2 },
    ], 0);

    await reorderTabs(sidePanelPage, tabF, tabE, 'before');

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1, expanded: true },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 2 },
      { tabId: tabF, depth: 1, expanded: true },
      { tabId: tabG, depth: 2 },
      { tabId: tabE, depth: 1 },
    ], 0);
  });

  test('サブツリーを別の親の子ノード間のギャップにドロップした場合、その親の子として配置されサブツリー構造が維持されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const root1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
    ], 0);

    const child1A = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 0 },
    ], 0);

    const child1B = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 0 },
      { tabId: child1B, depth: 0 },
    ], 0);

    const root2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 0 },
      { tabId: child1B, depth: 0 },
      { tabId: root2, depth: 0 },
    ], 0);

    const child2A = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 0 },
      { tabId: child1B, depth: 0 },
      { tabId: root2, depth: 0 },
      { tabId: child2A, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1A, root1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0, expanded: true },
      { tabId: child1A, depth: 1 },
      { tabId: child1B, depth: 0 },
      { tabId: root2, depth: 0 },
      { tabId: child2A, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1B, root1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0, expanded: true },
      { tabId: child1A, depth: 1 },
      { tabId: child1B, depth: 1 },
      { tabId: root2, depth: 0 },
      { tabId: child2A, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2A, root2, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0, expanded: true },
      { tabId: child1A, depth: 1 },
      { tabId: child1B, depth: 1 },
      { tabId: root2, depth: 0, expanded: true },
      { tabId: child2A, depth: 1 },
    ], 0);

    await reorderTabs(sidePanelPage, root2, child1B, 'before');

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0, expanded: true },
      { tabId: child1A, depth: 1 },
      { tabId: root2, depth: 1, expanded: true },
      { tabId: child2A, depth: 2 },
      { tabId: child1B, depth: 1 },
    ], 0);
  });
});
