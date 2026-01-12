import { test, expect } from './fixtures/extension';
import { createWindow } from './utils/window-utils';
import { createTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure, assertWindowClosed, assertWindowExists } from './utils/assertion-utils';
import { setupWindow, createAndSetupWindow } from './utils/setup-utils';

test.describe('chrome.windows API統合', () => {
  test('chrome.windows.create()で新しいウィンドウを作成した場合、新しいウィンドウコンテキストが確立される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const mainWindowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, mainWindowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const newWindowId = await createWindow(extensionContext);

    await assertWindowExists(extensionContext, newWindowId);
  });

  test('chrome.windows.remove()でウィンドウを閉じた場合、ウィンドウ内の全タブがツリーから削除される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const mainWindowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, mainWindowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const {
      windowId: newWindowId,
      initialBrowserTabId: newWindowInitialTabId,
      sidePanelPage: newWindowSidePanel,
      pseudoSidePanelTabId: newWindowPseudoSidePanelTabId,
    } = await createAndSetupWindow(extensionContext, serviceWorker);

    await assertWindowExists(extensionContext, newWindowId);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), { windowId: newWindowId, active: false });
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page2'), { windowId: newWindowId, active: false });
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await newWindowSidePanel.close();

    await serviceWorker.evaluate((wId) => {
      return chrome.windows.remove(wId);
    }, newWindowId);

    await assertWindowClosed(extensionContext, newWindowId);
  });

  test('chrome.windows.update()でウィンドウをフォーカスした場合、フォーカス状態が正しく更新される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const mainWindowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, mainWindowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const newWindowId = await createWindow(extensionContext);

    await assertWindowExists(extensionContext, newWindowId);

    await serviceWorker.evaluate((wId) => {
      return chrome.windows.update(wId, { focused: true });
    }, newWindowId);

    await expect
      .poll(
        async () => {
          const windows = await serviceWorker.evaluate(() => {
            return chrome.windows.getAll();
          });
          const focusedWindow = windows.find((win: chrome.windows.Window) => win.id === newWindowId);
          return focusedWindow?.focused;
        },
        {
          message: 'フォーカス状態が更新されるのを待機',
          timeout: 5000,
        }
      )
      .toBe(true);
  });

  test('chrome.windows.getAll()で全ウィンドウを取得した場合、全ウィンドウのタブが正しく列挙される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const mainWindowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, mainWindowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId1 = await createWindow(extensionContext);
    const windowId2 = await createWindow(extensionContext);

    await assertWindowExists(extensionContext, windowId1);
    await assertWindowExists(extensionContext, windowId2);

    const windows = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll({ populate: true });
    });

    expect(windows.length).toBeGreaterThanOrEqual(3);

    const window1 = windows.find((win: chrome.windows.Window) => win.id === windowId1);
    const window2 = windows.find((win: chrome.windows.Window) => win.id === windowId2);
    expect(window1).toBeDefined();
    expect(window2).toBeDefined();

    expect(Array.isArray(window1?.tabs)).toBe(true);
    expect(Array.isArray(window2?.tabs)).toBe(true);
  });

  test('複数ウィンドウが存在する場合、各ウィンドウのタブツリーが独立して管理される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const {
      windowId: windowId1,
      initialBrowserTabId: initialTabId1,
      sidePanelPage: sidePanel1,
      pseudoSidePanelTabId: pseudoSidePanelTabId1,
    } = await createAndSetupWindow(extensionContext, serviceWorker);

    const {
      windowId: windowId2,
      initialBrowserTabId: initialTabId2,
      sidePanelPage: sidePanel2,
      pseudoSidePanelTabId: pseudoSidePanelTabId2,
    } = await createAndSetupWindow(extensionContext, serviceWorker);

    await assertWindowExists(extensionContext, windowId1);
    await assertWindowExists(extensionContext, windowId2);

    await assertTabStructure(sidePanel1, windowId1, [
      { tabId: initialTabId1, depth: 0 },
      { tabId: pseudoSidePanelTabId1, depth: 0 },
    ], 0);

    await assertTabStructure(sidePanel2, windowId2, [
      { tabId: initialTabId2, depth: 0 },
      { tabId: pseudoSidePanelTabId2, depth: 0 },
    ], 0);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), { windowId: windowId1, active: false });
    await assertTabStructure(sidePanel1, windowId1, [
      { tabId: initialTabId1, depth: 0 },
      { tabId: pseudoSidePanelTabId1, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page2'), { windowId: windowId2, active: false });
    await assertTabStructure(sidePanel2, windowId2, [
      { tabId: initialTabId2, depth: 0 },
      { tabId: pseudoSidePanelTabId2, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await sidePanel1.close();
    await sidePanel2.close();
  });
});
