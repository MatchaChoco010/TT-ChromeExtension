import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('複数選択機能', () => {
  test('Shift+クリックで範囲選択ができる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await closeTab(serviceWorker, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabId3);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
  });

  test('Ctrl+クリックで追加選択/選択解除ができる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await closeTab(serviceWorker, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabId3);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
  });

  test('複数選択時にコンテキストメニューで選択タブを閉じるメニューが表示される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    const closeMenuItem = sidePanelPage.getByRole('menuitem', { name: '選択されたタブを閉じる' });
    await expect(closeMenuItem).toBeVisible();

    await sidePanelPage.keyboard.press('Escape');
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    await closeTab(serviceWorker, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
  });

  test('複数選択時のコンテキストメニューから選択タブを一括で閉じることができる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    const closeMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブを閉じる/ });
    await closeMenuItem.click({ force: true, noWaitAfter: true });

    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabId3);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
  });

  test('折りたたまれた親タブと別のタブを複数選択して閉じるとサブツリーも閉じられる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
    ], 0);

    const childTabId2 = await createTab(serviceWorker, getTestServerUrl('/page'), parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
      { tabId: childTabId2, depth: 1 },
    ], 0);

    const anotherTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
      { tabId: childTabId2, depth: 1 },
      { tabId: anotherTabId, depth: 0 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expandButton.click();
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: false },
      { tabId: anotherTabId, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await parentNode.click();
    const anotherNode = sidePanelPage.locator(`[data-testid="tree-node-${anotherTabId}"]`);
    await anotherNode.click({ modifiers: ['Control'] });

    await parentNode.click({ button: 'right', force: true, noWaitAfter: true });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    const closeItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブを閉じる/ });
    await expect(closeItem).toBeVisible({ timeout: 3000 });
    await closeItem.click({ force: true, noWaitAfter: true });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
  });

  test('複数選択時のコンテキストメニューでグループ化オプションが表示される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await closeTab(serviceWorker, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
  });

  test('通常クリックで既存の選択がクリアされる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await closeTab(serviceWorker, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabId3);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
  });

  test('階層を跨いでShift+クリックで範囲選択ができる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab1 = await createTab(serviceWorker, getTestServerUrl('/page'), parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab1, depth: 1 },
    ], 0);

    const childTab2 = await createTab(serviceWorker, getTestServerUrl('/page'), parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab1, depth: 1 },
      { tabId: childTab2, depth: 1 },
    ], 0);

    const otherTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab1, depth: 1 },
      { tabId: childTab2, depth: 1 },
      { tabId: otherTab, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const childNode1 = sidePanelPage.locator(`[data-testid="tree-node-${childTab1}"]`);
    await childNode1.click();
    await expect(childNode1).toHaveClass(/bg-gray-500/);

    const otherNode = sidePanelPage.locator(`[data-testid="tree-node-${otherTab}"]`);
    await otherNode.click({ modifiers: ['Shift'] });

    const childNode2 = sidePanelPage.locator(`[data-testid="tree-node-${childTab2}"]`);
    await expect(childNode1).toHaveClass(/bg-gray-500/);
    await expect(childNode2).toHaveClass(/bg-gray-500/);
    await expect(otherNode).toHaveClass(/bg-gray-500/);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
    await expect(parentNode).not.toHaveClass(/bg-gray-500/);

    await closeTab(serviceWorker, childTab1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab2, depth: 1 },
      { tabId: otherTab, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, childTab2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: otherTab, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: otherTab, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, otherTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
  });

  test('折りたたまれたサブツリーでShift+クリックすると非表示の子タブは選択されない', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabA = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
    ], 0);

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, getTestServerUrl('/page'), parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    const tabC = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: tabC, depth: 0 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expandButton.click();
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: false },
      { tabId: tabC, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNodeA = sidePanelPage.locator(`[data-testid="tree-node-${tabA}"]`);
    await tabNodeA.click();
    await expect(tabNodeA).toHaveClass(/bg-gray-500/);

    const tabNodeC = sidePanelPage.locator(`[data-testid="tree-node-${tabC}"]`);
    await tabNodeC.click({ modifiers: ['Shift'] });

    await expect(tabNodeA).toHaveClass(/bg-gray-500/);
    await expect(parentNode).toHaveClass(/bg-gray-500/);
    await expect(tabNodeC).toHaveClass(/bg-gray-500/);

    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`);
    await expect(childNode).not.toBeVisible();

    await closeTab(serviceWorker, tabA);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: false },
      { tabId: tabC, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, childTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: tabC, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabC, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabC);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
  });

  test('深いネストでShift+クリックすると表示順序で範囲選択される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabA = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
    ], 0);

    const tabB = await createTab(serviceWorker, getTestServerUrl('/page'), tabA);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1 },
    ], 0);

    const tabC = await createTab(serviceWorker, getTestServerUrl('/page'), tabB);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1, expanded: true },
      { tabId: tabC, depth: 2 },
    ], 0);

    const tabD = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1, expanded: true },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNodeB = sidePanelPage.locator(`[data-testid="tree-node-${tabB}"]`);
    await tabNodeB.click();
    await expect(tabNodeB).toHaveClass(/bg-gray-500/);

    const tabNodeD = sidePanelPage.locator(`[data-testid="tree-node-${tabD}"]`);
    await tabNodeD.click({ modifiers: ['Shift'] });

    const tabNodeA = sidePanelPage.locator(`[data-testid="tree-node-${tabA}"]`);
    const tabNodeC = sidePanelPage.locator(`[data-testid="tree-node-${tabC}"]`);
    await expect(tabNodeA).not.toHaveClass(/bg-gray-500/);
    await expect(tabNodeB).toHaveClass(/bg-gray-500/);
    await expect(tabNodeC).toHaveClass(/bg-gray-500/);
    await expect(tabNodeD).toHaveClass(/bg-gray-500/);

    await closeTab(serviceWorker, tabC);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0, expanded: true },
      { tabId: tabB, depth: 1 },
      { tabId: tabD, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabB);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabD, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabA);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabD, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabD);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
  });
});
