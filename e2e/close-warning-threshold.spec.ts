import { test, expect } from './fixtures/extension';
import {
  createTab,
  closeTab,
  getTestServerUrl,
  getCurrentWindowId,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

async function setCloseWarningThreshold(serviceWorker: import('@playwright/test').Worker, threshold: number): Promise<void> {
  await serviceWorker.evaluate(async (threshold) => {
    const result = await chrome.storage.local.get('user_settings');
    const settings = result.user_settings || {};
    settings.closeWarningThreshold = threshold;
    await chrome.storage.local.set({ user_settings: settings });
  }, threshold);

  await serviceWorker.evaluate(async (threshold) => {
    for (let i = 0; i < 50; i++) {
      const result = await chrome.storage.local.get('user_settings');
      if (result.user_settings?.closeWarningThreshold === threshold) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    throw new Error(`Timeout waiting for closeWarningThreshold to be ${threshold}`);
  }, threshold);
}

test.describe('閉じる警告閾値', () => {
  test.describe('コンテキストメニューからのタブを閉じる', () => {
    test('複数タブ選択時に閾値以上のタブを閉じようとすると警告ダイアログが表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await setCloseWarningThreshold(serviceWorker, 3);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page?tab1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page?tab2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page?tab3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      const treeNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const treeNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      const treeNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);

      await treeNode1.click({ modifiers: ['Control'] });
      await treeNode2.click({ modifiers: ['Control'] });
      await treeNode3.click({ modifiers: ['Control'] });

      await treeNode1.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[data-testid="tab-context-menu"]');
      await expect(contextMenu).toBeVisible();

      const closeButton = sidePanelPage.getByRole('menuitem', { name: /選択されたタブを閉じる/ });
      await expect(closeButton).toBeVisible();

      await closeButton.click();

      const confirmDialog = sidePanelPage.locator('[data-testid="confirm-dialog"]');
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });

      const cancelButton = sidePanelPage.getByRole('button', { name: 'キャンセル' });
      await cancelButton.click();

      await expect(confirmDialog).not.toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await closeTab(serviceWorker, tabId2);
      await closeTab(serviceWorker, tabId3);
    });

    test('複数タブ選択時に閾値未満のタブを閉じる場合は警告ダイアログなしで閉じられる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await setCloseWarningThreshold(serviceWorker, 3);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page?tab1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page?tab2'));
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

      const contextMenu = sidePanelPage.locator('[data-testid="tab-context-menu"]');
      await expect(contextMenu).toBeVisible();

      const closeButton = sidePanelPage.getByRole('menuitem', { name: /選択されたタブを閉じる/ });
      await closeButton.click();

      const confirmDialog = sidePanelPage.locator('[data-testid="confirm-dialog"]');
      await expect(confirmDialog).not.toBeVisible({ timeout: 1000 });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('警告閾値が0の場合は警告ダイアログが表示されない', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await setCloseWarningThreshold(serviceWorker, 0);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page?tab1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page?tab2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page?tab3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      const tabId4 = await createTab(serviceWorker, getTestServerUrl('/page?tab4'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);

      const tabId5 = await createTab(serviceWorker, getTestServerUrl('/page?tab5'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
        { tabId: tabId5, depth: 0 },
      ], 0);

      const treeNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const treeNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      const treeNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
      const treeNode4 = sidePanelPage.locator(`[data-testid="tree-node-${tabId4}"]`);
      const treeNode5 = sidePanelPage.locator(`[data-testid="tree-node-${tabId5}"]`);

      await treeNode1.click({ modifiers: ['Control'] });
      await treeNode2.click({ modifiers: ['Control'] });
      await treeNode3.click({ modifiers: ['Control'] });
      await treeNode4.click({ modifiers: ['Control'] });
      await treeNode5.click({ modifiers: ['Control'] });

      await treeNode1.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[data-testid="tab-context-menu"]');
      await expect(contextMenu).toBeVisible();

      const closeButton = sidePanelPage.getByRole('menuitem', { name: /選択されたタブを閉じる/ });
      await closeButton.click();

      const confirmDialog = sidePanelPage.locator('[data-testid="confirm-dialog"]');
      await expect(confirmDialog).not.toBeVisible({ timeout: 1000 });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });
});
