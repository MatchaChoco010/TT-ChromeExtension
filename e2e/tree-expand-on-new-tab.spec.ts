import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('新規タブ作成時のツリー展開', () => {
  test('折りたたまれた親タブから子タブを開くと、親タブが自動展開される', async ({
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

    const parentTabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId1 = await createTab(
      extensionContext,
      'about:blank',
      parentTabId
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
    ], 0);

    await serviceWorker.evaluate(async (parentTabId) => {
      const manager = (globalThis as { treeStateManager?: { toggleExpand: (nodeId: string) => Promise<void>; getNodeByTabId: (tabId: number) => { id: string } | null } }).treeStateManager;
      if (manager) {
        const node = manager.getNodeByTabId(parentTabId);
        if (node) {
          await manager.toggleExpand(node.id);
        }
      }
    }, parentTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: false },
    ], 0);

    const childTabId2 = await createTab(
      extensionContext,
      'about:blank',
      parentTabId
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
      { tabId: childTabId2, depth: 1 },
    ], 0);

    await closeTab(extensionContext, childTabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
    ], 0);

    await closeTab(extensionContext, childTabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    await closeTab(extensionContext, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('既に展開されている親タブから子タブを開いても展開状態が維持される', async ({
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

    const parentTabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(
      extensionContext,
      'about:blank',
      parentTabId
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    await closeTab(extensionContext, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    await closeTab(extensionContext, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });
});
