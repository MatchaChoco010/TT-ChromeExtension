import { test, expect } from '../fixtures/extension';
import {
  openSidePanel,
  assertTreeVisible,
  assertRealTimeUpdate,
  assertSmoothScrolling,
} from './side-panel-utils';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './tab-utils';
import { assertTabStructure } from './assertion-utils';
import { setupWindow } from './setup-utils';

test.describe('SidePanelUtils', () => {
  test('openSidePanelはSide Panelを開く', async ({ extensionContext, extensionId }) => {
    const page = await openSidePanel(extensionContext, extensionId);

    expect(page).toBeDefined();
    expect(page.url()).toContain('sidepanel.html');

    await page.close();
  });

  test('assertTreeVisibleはツリーが表示されることを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTreeVisible(sidePanelPage);
  });

  test('assertRealTimeUpdateは別タブでのタブ作成をSide Panelで検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    let createdTabId: number | null = null;
    const action = async () => {
      createdTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    };

    await assertRealTimeUpdate(sidePanelPage, action);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: createdTabId!, depth: 0 },
    ], 0);
  });

  test('assertRealTimeUpdateはタブ削除もSide Panelで検証する', async ({
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

    const action = async () => {
      await closeTab(serviceWorker, tabId);
    };

    await assertRealTimeUpdate(sidePanelPage, action);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('assertSmoothScrollingは大量タブ時のスクロール動作を検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabCount = 10;
    const createdTabs: number[] = [];
    for (let i = 0; i < tabCount; i++) {
      const tabId = await createTab(serviceWorker, getTestServerUrl(`/page${i}`));
      createdTabs.push(tabId);
    }

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ...createdTabs.map(id => ({ tabId: id, depth: 0 })),
    ], 0);

    await assertSmoothScrolling(sidePanelPage, tabCount);
  });

  test('assertSmoothScrollingは少数のタブでも動作する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    await assertSmoothScrolling(sidePanelPage, 3);
  });
});
