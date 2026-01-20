import { test } from './fixtures/extension';
import { createTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { dragOutside, startDrag, moveTo, dropTab } from './utils/drag-drop-utils';
import { assertTabStructure, assertWindowExists, assertWindowCount } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ツリービュー外へのドラッグ&ドロップ', () => {
  // マウス操作は各ステップで時間がかかるため、タイムアウトを延長
  test.setTimeout(120000);

  test('タブをサイドパネル外にドロップした際に新しいウィンドウが作成されること', async ({
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
      { tabId: tabId, depth: 0 },
    ], 0);

    const originalWindowId = windowId;

    await dragOutside(sidePanelPage, tabId, 'right');

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    await assertWindowCount(extensionContext, 2);

    const windowsAfter = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    const newWindow = windowsAfter.find((win: chrome.windows.Window) => win.id !== originalWindowId);
    const newWindowId = newWindow!.id as number;

    await assertWindowExists(extensionContext, newWindowId);
  });

  test('ドロップしたタブが新しいウィンドウに正確に移動されること', async ({
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
      { tabId: tabId, depth: 0 },
    ], 0);

    const originalWindowId = windowId;

    await dragOutside(sidePanelPage, tabId, 'right');

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    await assertWindowCount(extensionContext, 2);

    const windowsAfter = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    const newWindow = windowsAfter.find((win: chrome.windows.Window) => win.id !== originalWindowId);
    const newWindowId = newWindow!.id as number;

    await assertWindowExists(extensionContext, newWindowId);
  });

  test('サイドパネル内の空白領域（タブツリー下部）へのドラッグでは新規ウィンドウを作成しないこと', async ({
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
      { tabId: tabId, depth: 0 },
    ], 0);

    const originalWindowId = windowId;

    const sidePanelContainer = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await sidePanelContainer.waitFor({ state: 'visible' });
    const sidePanelBox = await sidePanelContainer.boundingBox();

    await startDrag(sidePanelPage, tabId);

    // サイドパネルの底から20px上の位置を使用（サイドパネル内であることを保証）
    const insideSidePanelX = sidePanelBox!.x + sidePanelBox!.width / 2;
    const insideSidePanelY = sidePanelBox!.y + sidePanelBox!.height - 20;
    await moveTo(sidePanelPage, insideSidePanelX, insideSidePanelY);

    await dropTab(sidePanelPage);

    await assertTabStructure(sidePanelPage, originalWindowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await assertWindowCount(extensionContext, 1);

    await assertWindowExists(extensionContext, originalWindowId);
  });
});
