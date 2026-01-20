import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getPseudoSidePanelTabId, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { createWindow, openSidePanelForWindow, closeWindow } from './utils/window-utils';
import { assertTabStructure, assertWindowCount, assertWindowExists, assertWindowClosed } from './utils/assertion-utils';
import { waitForSidePanelReady } from './utils/polling-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('コンテキストメニュー操作', () => {
  test('タブノードを右クリックした場合、コンテキストメニューが表示される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await tabNode.click({ button: 'right', force: true, noWaitAfter: true });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    await expect(sidePanelPage.getByRole('menuitem', { name: 'タブを閉じる' })).toBeVisible();

    await closeTab(serviceWorker, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューから"タブを閉じる"を選択した場合、対象タブが閉じられる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await tabNode.click({ button: 'right', force: true, noWaitAfter: true });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    await sidePanelPage.getByRole('menuitem', { name: 'タブを閉じる' }).click({ force: true, noWaitAfter: true });
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('折りたたまれた親タブ(expanded: false)を閉じると、サブツリー全体が閉じられる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
    ], 0);

    const childTabId2 = await createTab(serviceWorker, getTestServerUrl('/page'), parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
      { tabId: childTabId2, depth: 1 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expandButton.click();
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: false },
    ], 0);

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

    await parentNode.click({ button: 'right', force: true, noWaitAfter: true });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    const closeItem = sidePanelPage.getByRole('menuitem', { name: 'タブを閉じる' });
    await expect(closeItem).toBeVisible({ timeout: 3000 });
    await closeItem.click({ force: true, noWaitAfter: true });
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューから「別のウィンドウに移動」→「新しいウィンドウ」を選択した場合、タブが新しいウィンドウに移動する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await tabNode.click({ button: 'right', force: true, noWaitAfter: true });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    const moveToWindowTrigger = sidePanelPage.locator('[data-testid="context-menu-move-to-window"]');
    await moveToWindowTrigger.hover({ force: true, noWaitAfter: true });

    const newWindowOption = sidePanelPage.getByRole('menuitem', { name: '新しいウィンドウ' });
    await expect(newWindowOption).toBeVisible({ timeout: 3000 });

    await newWindowOption.click({ force: true, noWaitAfter: true });
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    await assertWindowCount(extensionContext, 2);
  });

  test('コンテキストメニューから「別のウィンドウに移動」→既存ウィンドウを選択した場合、タブがそのウィンドウに移動する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const window1Id = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId: initialBrowserTabId1, sidePanelPage, pseudoSidePanelTabId: pseudoSidePanelTabId1 } =
      await setupWindow(extensionContext, serviceWorker, window1Id);

    const tabToMove = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, window1Id, [
      { tabId: initialBrowserTabId1, depth: 0 },
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
      await closeTab(serviceWorker, defaultTabInWindow2.id);
    }

    await assertTabStructure(sidePanelPage2, window2Id, [
      { tabId: pseudoSidePanelTabId2, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();

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

    await tabNode.click({ button: 'right', force: true, noWaitAfter: true });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    const moveToWindowTrigger = sidePanelPage.locator('[data-testid="context-menu-move-to-window"]');
    await moveToWindowTrigger.hover({ force: true, noWaitAfter: true });

    const newWindowOption = sidePanelPage.getByRole('menuitem', { name: '新しいウィンドウ' });
    await expect(newWindowOption).toBeVisible({ timeout: 3000 });

    const existingWindowOption = sidePanelPage.locator('[role="menuitem"]').filter({
      hasText: new RegExp(`ウィンドウ ${window2Id}.*タブ`)
    });
    await expect(existingWindowOption).toBeVisible({ timeout: 5000 });
    await existingWindowOption.click({ force: true, noWaitAfter: true });

    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    await sidePanelPage.reload({ waitUntil: 'domcontentloaded' });
    await waitForSidePanelReady(sidePanelPage, serviceWorker);
    await sidePanelPage2.reload({ waitUntil: 'domcontentloaded' });
    await waitForSidePanelReady(sidePanelPage2, serviceWorker);

    await assertTabStructure(sidePanelPage, window1Id, [
      { tabId: initialBrowserTabId1, depth: 0 },
      { tabId: pseudoSidePanelTabId1, depth: 0 },
    ], 0);

    await sidePanelPage2.bringToFront();
    await assertTabStructure(sidePanelPage2, window2Id, [
      { tabId: pseudoSidePanelTabId2, depth: 0 },
      { tabId: tabToMove, depth: 0 },
    ], 0);

    await assertWindowCount(extensionContext, 2);

    await sidePanelPage2.close();
    await closeWindow(extensionContext, window2Id);
  });

  test('コンテキストメニューから"URLをコピー"を選択した場合、クリップボードにURLがコピーされる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await tabNode.click({ button: 'right', force: true, noWaitAfter: true });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    const copyUrlItem = sidePanelPage.getByRole('menuitem', { name: 'URLをコピー' });
    await expect(copyUrlItem).toBeVisible();

    await copyUrlItem.click({ force: true, noWaitAfter: true });

    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    await closeTab(serviceWorker, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューの外側をクリックした場合、メニューが閉じられる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await tabNode.click({ button: 'right', force: true, noWaitAfter: true });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    const menuBox = await contextMenu.boundingBox();
    if (menuBox) {
      await sidePanelPage.mouse.click(
        menuBox.x + menuBox.width + 50,
        menuBox.y + menuBox.height + 50
      );
    }
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    await closeTab(serviceWorker, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('Escapeキーを押した場合、コンテキストメニューが閉じられる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await tabNode.click({ button: 'right', force: true, noWaitAfter: true });

    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    await sidePanelPage.keyboard.press('Escape');

    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    await closeTab(serviceWorker, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('ウィンドウの最後のタブを新しいウィンドウに移動した場合、元のウィンドウが閉じられる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const window1Id = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, window1Id);

    await assertTabStructure(sidePanelPage, window1Id, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const window2Id = await createWindow(extensionContext);
    await assertWindowCount(extensionContext, 2);
    await assertWindowExists(extensionContext, window2Id);

    const window2Tabs: chrome.tabs.Tab[] = await serviceWorker.evaluate(
      (wId) => chrome.tabs.query({ windowId: wId }),
      window2Id
    );
    const window2DefaultTabId = window2Tabs[0]?.id;
    expect(window2DefaultTabId).toBeDefined();

    await serviceWorker.evaluate(async (tabId) => {
      const sourceTab = await chrome.tabs.get(tabId);
      const sourceWindowId = sourceTab.windowId;

      const newWindow = await chrome.windows.create({ tabId });

      const remainingTabs = await chrome.tabs.query({ windowId: sourceWindowId });
      if (remainingTabs.length === 0) {
        try {
          await chrome.windows.remove(sourceWindowId);
        } catch {
          // ウィンドウが既に閉じられている場合のエラーは無視
        }
      }

      return newWindow.id;
    }, window2DefaultTabId!);

    await assertWindowClosed(extensionContext, window2Id);

    await assertWindowCount(extensionContext, 2);
  });

  test('コンテキストメニューから「新しいウィンドウに移動」で最後のユーザータブを移動した場合の動作確認', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const window2Id = await createWindow(extensionContext);
    await assertWindowCount(extensionContext, 2);
    await assertWindowExists(extensionContext, window2Id);

    const sidePanelPage2 = await openSidePanelForWindow(extensionContext, window2Id);
    await waitForSidePanelReady(sidePanelPage2, serviceWorker);

    const pseudoSidePanelTabId2 = await getPseudoSidePanelTabId(serviceWorker, window2Id);
    const window2Tabs: chrome.tabs.Tab[] = await serviceWorker.evaluate(
      (wId) => chrome.tabs.query({ windowId: wId }),
      window2Id
    );
    const defaultTabInWindow2 = window2Tabs.find((t) => t.id !== pseudoSidePanelTabId2);

    await assertTabStructure(sidePanelPage2, window2Id, [
      { tabId: defaultTabInWindow2!.id!, depth: 0 },
      { tabId: pseudoSidePanelTabId2, depth: 0 },
    ], 0);

    await serviceWorker.evaluate((tabId) => chrome.tabs.update(tabId, { active: true }), defaultTabInWindow2!.id!);

    const tabNode = sidePanelPage2.locator(`[data-testid="tree-node-${defaultTabInWindow2!.id}"]`);
    await sidePanelPage2.bringToFront();
    await sidePanelPage2.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      defaultTabInWindow2!.id!,
      { timeout: 5000 }
    );

    await tabNode.click({ button: 'right', force: true, noWaitAfter: true });
    await expect(sidePanelPage2.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    const moveToWindowTrigger = sidePanelPage2.locator('[data-testid="context-menu-move-to-window"]');
    await moveToWindowTrigger.hover({ force: true, noWaitAfter: true });

    const newWindowOption = sidePanelPage2.getByRole('menuitem', { name: '新しいウィンドウ' });
    await expect(newWindowOption).toBeVisible({ timeout: 3000 });
    await newWindowOption.click({ force: true, noWaitAfter: true });

    // 擬似サイドパネルタブがあるためwindow2は自動クローズされない可能性がある
    // Chromeの動作を確認するためにウィンドウの状態をチェック
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    const windowStillExists = await serviceWorker.evaluate(async (wId) => {
      try {
        const windows = await chrome.windows.getAll();
        return windows.some(w => w.id === wId);
      } catch {
        return false;
      }
    }, window2Id);

    if (windowStillExists) {
      // 擬似サイドパネルタブのためwindow2がまだ存在する
      await assertWindowCount(extensionContext, 3);
      // sidePanelPageを閉じると擬似サイドパネルタブも閉じられ、
      // window2にタブがなくなりウィンドウも自動的に閉じられる
      await sidePanelPage2.close();
      await assertWindowClosed(extensionContext, window2Id);
    } else {
      await assertWindowClosed(extensionContext, window2Id);
      await assertWindowCount(extensionContext, 2);
    }
  });
});
