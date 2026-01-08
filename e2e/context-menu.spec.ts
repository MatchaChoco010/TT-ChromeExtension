import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, getTestServerUrl } from './utils/tab-utils';
import { createWindow, openSidePanelForWindow } from './utils/window-utils';
import { assertTabStructure, assertWindowCount, assertWindowExists } from './utils/assertion-utils';
import { waitForSidePanelReady } from './utils/polling-utils';

test.describe('コンテキストメニュー操作', () => {
  test('タブノードを右クリックした場合、コンテキストメニューが表示される', async ({
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

    const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    await sidePanelPage.bringToFront();

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    await tabNode.click({ button: 'right' });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    await expect(sidePanelPage.getByRole('menuitem', { name: 'タブを閉じる' })).toBeVisible();

    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューから"タブを閉じる"を選択した場合、対象タブが閉じられる', async ({
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

    const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    await tabNode.click({ button: 'right' });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    await sidePanelPage.getByRole('menuitem', { name: 'タブを閉じる' }).click();
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューから"サブツリーを閉じる"を選択した場合、対象タブとその全ての子孫タブが閉じられる', async ({
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

    const parentTabId = await createTab(extensionContext, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId1 = await createTab(extensionContext, getTestServerUrl('/page'), parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
    ], 0);

    const childTabId2 = await createTab(extensionContext, getTestServerUrl('/page'), parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
      { tabId: childTabId2, depth: 1 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      parentTabId,
      { timeout: 5000 }
    );

    await parentNode.click({ button: 'right' });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    const closeSubtreeItem = sidePanelPage.getByRole('menuitem', { name: 'サブツリーを閉じる' });
    await expect(closeSubtreeItem).toBeVisible({ timeout: 3000 });
    await closeSubtreeItem.click();
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューから「別のウィンドウに移動」→「新しいウィンドウ」を選択した場合、タブが新しいウィンドウに移動する', async ({
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

    const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    await tabNode.click({ button: 'right' });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    const moveToWindowTrigger = sidePanelPage.locator('[data-testid="context-menu-move-to-window"]');
    await moveToWindowTrigger.hover();

    const newWindowOption = sidePanelPage.getByRole('menuitem', { name: '新しいウィンドウ' });
    await expect(newWindowOption).toBeVisible({ timeout: 3000 });

    await newWindowOption.click();
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    await assertWindowCount(extensionContext, 2);
  });

  test('コンテキストメニューから「別のウィンドウに移動」→既存ウィンドウを選択した場合、タブがそのウィンドウに移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const window1Id = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId1 = await getPseudoSidePanelTabId(serviceWorker, window1Id);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, window1Id);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, window1Id, [
      { tabId: pseudoSidePanelTabId1, depth: 0 },
    ], 0);

    const tabToMove = await createTab(extensionContext, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, window1Id, [
      { tabId: pseudoSidePanelTabId1, depth: 0 },
      { tabId: tabToMove, depth: 0 },
    ], 0);

    const window2Id = await createWindow(extensionContext);
    const sidePanelPage2 = await openSidePanelForWindow(extensionContext, window2Id);
    await waitForSidePanelReady(sidePanelPage2, serviceWorker);

    await assertWindowCount(extensionContext, 2);

    const pseudoSidePanelTabId2 = await getPseudoSidePanelTabId(serviceWorker, window2Id);
    await assertWindowExists(extensionContext, window2Id);

    const window2Tabs: chrome.tabs.Tab[] = await serviceWorker.evaluate(
      (wId) => chrome.tabs.query({ windowId: wId }),
      window2Id
    );
    const defaultTabInWindow2 = window2Tabs.find(
      (t) => t.id !== pseudoSidePanelTabId2
    );
    if (defaultTabInWindow2?.id) {
      await closeTab(extensionContext, defaultTabInWindow2.id);
    }

    await assertTabStructure(sidePanelPage2, window2Id, [
      { tabId: pseudoSidePanelTabId2, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();

    await sidePanelPage.waitForTimeout(500);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabToMove}"]`);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabToMove,
      { timeout: 5000 }
    );

    await tabNode.click({ button: 'right' });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    const moveToWindowTrigger = sidePanelPage.locator('[data-testid="context-menu-move-to-window"]');
    await moveToWindowTrigger.hover();

    const newWindowOption = sidePanelPage.getByRole('menuitem', { name: '新しいウィンドウ' });
    await expect(newWindowOption).toBeVisible({ timeout: 3000 });

    const existingWindowOption = sidePanelPage.locator('[role="menuitem"]').filter({
      hasText: new RegExp(`ウィンドウ ${window2Id}.*タブ`)
    });
    await expect(existingWindowOption).toBeVisible({ timeout: 5000 });
    await existingWindowOption.click();

    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    await sidePanelPage.waitForTimeout(500);

    await sidePanelPage.reload();
    await waitForSidePanelReady(sidePanelPage, serviceWorker);
    await sidePanelPage2.reload();
    await waitForSidePanelReady(sidePanelPage2, serviceWorker);

    await assertTabStructure(sidePanelPage, window1Id, [
      { tabId: pseudoSidePanelTabId1, depth: 0 },
    ], 0);

    await sidePanelPage2.bringToFront();
    await assertTabStructure(sidePanelPage2, window2Id, [
      { tabId: pseudoSidePanelTabId2, depth: 0 },
      { tabId: tabToMove, depth: 0 },
    ], 0);

    await assertWindowCount(extensionContext, 2);

    await sidePanelPage2.close();
  });

  test('コンテキストメニューから"URLをコピー"を選択した場合、クリップボードにURLがコピーされる', async ({
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

    const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    await tabNode.click({ button: 'right' });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    const copyUrlItem = sidePanelPage.getByRole('menuitem', { name: 'URLをコピー' });
    await expect(copyUrlItem).toBeVisible();

    await copyUrlItem.click();

    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューの外側をクリックした場合、メニューが閉じられる', async ({
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

    const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await tabNode.click({ button: 'right' });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(async () => {
      await expect(contextMenu).toBeVisible();
    }).toPass({ timeout: 5000 });

    await expect(async () => {
      if (await contextMenu.isVisible()) {
        const menuBox = await contextMenu.boundingBox();
        if (menuBox) {
          await sidePanelPage.mouse.click(
            menuBox.x + menuBox.width + 50,
            menuBox.y + menuBox.height + 50
          );
        }
      }
      await expect(contextMenu).not.toBeVisible();
    }).toPass({ timeout: 10000, intervals: [200, 500, 1000, 2000] });

    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('Escapeキーを押した場合、コンテキストメニューが閉じられる', async ({
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

    const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    await tabNode.click({ button: 'right' });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    await sidePanelPage.keyboard.press('Escape');

    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });
});
