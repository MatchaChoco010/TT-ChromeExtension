import { test, expect } from './fixtures/extension';
import {
  createTab,
  closeTab,
  getTestServerUrl,
  getCurrentWindowId,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('タブの休止機能', () => {
  test('コンテキストメニューに「タブを休止」オプションが表示される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
    await treeNode.click({ button: 'right' });

    const discardButton = sidePanelPage.locator('[data-testid="context-menu-discard"]');
    await expect(discardButton).toBeVisible();
    await expect(discardButton).toContainText('タブを休止');

    await closeTab(serviceWorker, tabId);
  });

  test('複数タブ選択時にコンテキストメニューに件数が表示される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const treeNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const treeNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

    await treeNode1.click({ modifiers: ['Control'] });
    await treeNode2.click({ modifiers: ['Control'] });

    await treeNode1.click({ button: 'right' });

    const discardButton = sidePanelPage.locator('[data-testid="context-menu-discard"]');
    await expect(discardButton).toContainText('タブを休止 (2件)');

    await closeTab(serviceWorker, tabId1);
    await closeTab(serviceWorker, tabId2);
  });

});
