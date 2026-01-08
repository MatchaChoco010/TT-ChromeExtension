import { test, expect } from './fixtures/extension';
import { createWindow, openSidePanelForWindow } from './utils/window-utils';
import { createTab, getPseudoSidePanelTabId, getInitialBrowserTabId, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure, assertWindowClosed, assertWindowExists } from './utils/assertion-utils';

test.describe('chrome.windows API統合', () => {
  test('chrome.windows.create()で新しいウィンドウを作成した場合、新しいウィンドウコンテキストが確立される', async ({
    sidePanelPage,
    extensionContext,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await createWindow(extensionContext);

    await assertWindowExists(extensionContext, windowId);
  });

  test('chrome.windows.remove()でウィンドウを閉じた場合、ウィンドウ内の全タブがツリーから削除される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await createWindow(extensionContext);

    await assertWindowExists(extensionContext, windowId);

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, windowId);

    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, windowId);

    await assertTabStructure(newWindowSidePanel, windowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId1 = await createTab(extensionContext, getTestServerUrl('/page'), { windowId, active: false });
    await assertTabStructure(newWindowSidePanel, windowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, getTestServerUrl('/page2'), { windowId, active: false });
    await assertTabStructure(newWindowSidePanel, windowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await newWindowSidePanel.close();

    await serviceWorker.evaluate((wId) => {
      return chrome.windows.remove(wId);
    }, windowId);

    await assertWindowClosed(extensionContext, windowId);
  });

  test('chrome.windows.update()でウィンドウをフォーカスした場合、フォーカス状態が正しく更新される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await createWindow(extensionContext);

    await assertWindowExists(extensionContext, windowId);

    await serviceWorker.evaluate((wId) => {
      return chrome.windows.update(wId, { focused: true });
    }, windowId);

    await expect
      .poll(
        async () => {
          const windows = await serviceWorker.evaluate(() => {
            return chrome.windows.getAll();
          });
          const focusedWindow = windows.find((win: chrome.windows.Window) => win.id === windowId);
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
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
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
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId1 = await createWindow(extensionContext);
    const windowId2 = await createWindow(extensionContext);

    await assertWindowExists(extensionContext, windowId1);
    await assertWindowExists(extensionContext, windowId2);

    const sidePanel1 = await openSidePanelForWindow(extensionContext, windowId1);
    const sidePanel2 = await openSidePanelForWindow(extensionContext, windowId2);

    const pseudoSidePanelTabId1 = await getPseudoSidePanelTabId(serviceWorker, windowId1);
    const initialTabId1 = await getInitialBrowserTabId(serviceWorker, windowId1);
    const pseudoSidePanelTabId2 = await getPseudoSidePanelTabId(serviceWorker, windowId2);
    const initialTabId2 = await getInitialBrowserTabId(serviceWorker, windowId2);

    await assertTabStructure(sidePanel1, windowId1, [
      { tabId: initialTabId1, depth: 0 },
      { tabId: pseudoSidePanelTabId1, depth: 0 },
    ], 0);

    await assertTabStructure(sidePanel2, windowId2, [
      { tabId: initialTabId2, depth: 0 },
      { tabId: pseudoSidePanelTabId2, depth: 0 },
    ], 0);

    const tabId1 = await createTab(extensionContext, getTestServerUrl('/page'), { windowId: windowId1, active: false });
    await assertTabStructure(sidePanel1, windowId1, [
      { tabId: initialTabId1, depth: 0 },
      { tabId: pseudoSidePanelTabId1, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, getTestServerUrl('/page2'), { windowId: windowId2, active: false });
    await assertTabStructure(sidePanel2, windowId2, [
      { tabId: initialTabId2, depth: 0 },
      { tabId: pseudoSidePanelTabId2, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await sidePanel1.close();
    await sidePanel2.close();
  });
});
