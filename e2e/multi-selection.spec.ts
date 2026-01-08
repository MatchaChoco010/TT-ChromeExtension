import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('複数選択機能', () => {
  test('Shift+クリックで範囲選択ができる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const tabId3 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    await tabNode1.click();

    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
    await tabNode3.click({ modifiers: ['Shift'] });

    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    await closeTab(extensionContext, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(extensionContext, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(extensionContext, tabId3);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('Ctrl+クリックで追加選択/選択解除ができる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const tabId3 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);

    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    await tabNode2.click({ modifiers: ['Control'] });
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).not.toHaveClass(/bg-gray-500/);

    await tabNode3.click({ modifiers: ['Control'] });
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    await tabNode2.click({ modifiers: ['Control'] });
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).not.toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    await closeTab(extensionContext, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(extensionContext, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(extensionContext, tabId3);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('複数選択時にコンテキストメニューで選択タブ数が表示される', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    await tabNode2.click({ modifiers: ['Control'] });
    await expect(tabNode2).toHaveClass(/bg-gray-500/);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId2,
      { timeout: 5000 }
    );

    await tabNode2.click({ button: 'right' });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const closeMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブを閉じる.*2件/ });
    await expect(closeMenuItem).toBeVisible();

    await sidePanelPage.keyboard.press('Escape');
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    await closeTab(extensionContext, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await closeTab(extensionContext, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('複数選択時のコンテキストメニューから選択タブを一括で閉じることができる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const tabId3 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    await tabNode2.click({ modifiers: ['Control'] });
    await expect(tabNode2).toHaveClass(/bg-gray-500/);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId2,
      { timeout: 5000 }
    );

    await tabNode2.click({ button: 'right' });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const closeMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブを閉じる/ });
    await closeMenuItem.click();

    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    // クリーンアップ
    await closeTab(extensionContext, tabId3);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('複数選択時のコンテキストメニューでグループ化オプションが表示される', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    await tabNode2.click({ modifiers: ['Control'] });
    await expect(tabNode2).toHaveClass(/bg-gray-500/);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId2,
      { timeout: 5000 }
    );

    await tabNode2.click({ button: 'right' });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
    await expect(groupMenuItem).toBeVisible();

    await sidePanelPage.keyboard.press('Escape');
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    await closeTab(extensionContext, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await closeTab(extensionContext, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('通常クリックで既存の選択がクリアされる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const tabId3 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);

    await tabNode1.click();
    await tabNode2.click({ modifiers: ['Control'] });
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);

    await tabNode3.click();

    await expect(tabNode1).not.toHaveClass(/bg-gray-500/);
    await expect(tabNode2).not.toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    await closeTab(extensionContext, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(extensionContext, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(extensionContext, tabId3);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });
});
