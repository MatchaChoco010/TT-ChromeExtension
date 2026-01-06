/**
 * SidePanelUtils Test
 *
 * SidePanelUtilsの機能をテストします。
 * このテストは、ユーティリティ関数が正しく動作することを確認するためのものです。
 */
import { test, expect } from '../fixtures/extension';
import {
  openSidePanel,
  assertTreeVisible,
  assertRealTimeUpdate,
  assertSmoothScrolling,
} from './side-panel-utils';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './tab-utils';
import { assertTabStructure } from './assertion-utils';

test.describe('SidePanelUtils', () => {
  test('openSidePanelはSide Panelを開く', async ({ extensionContext, extensionId }) => {
    const page = await openSidePanel(extensionContext, extensionId);

    expect(page).toBeDefined();
    expect(page.url()).toContain('sidepanel.html');

    await page.close();
  });

  test('assertTreeVisibleはツリーが表示されることを検証する', async ({
    sidePanelPage,
  }) => {
    await assertTreeVisible(sidePanelPage);
  });

  test('assertRealTimeUpdateは別タブでのタブ作成をSide Panelで検証する', async ({
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

    let createdTabId: number | null = null;
    const action = async () => {
      createdTabId = await createTab(extensionContext, 'https://example.com');
    };

    await assertRealTimeUpdate(sidePanelPage, action);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: createdTabId!, depth: 0 },
    ], 0);
  });

  test('assertRealTimeUpdateはタブ削除もSide Panelで検証する', async ({
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

    const tabId = await createTab(extensionContext, 'https://example.com');

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const action = async () => {
      await closeTab(extensionContext, tabId);
    };

    await assertRealTimeUpdate(sidePanelPage, action);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('assertSmoothScrollingは大量タブ時のスクロール動作を検証する', async ({
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

    const tabCount = 10;
    const createdTabs: number[] = [];
    for (let i = 0; i < tabCount; i++) {
      const tabId = await createTab(extensionContext, `https://example.com/page${i}`);
      createdTabs.push(tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        ...createdTabs.map(id => ({ tabId: id, depth: 0 })),
      ], 0);
    }

    await assertSmoothScrolling(sidePanelPage, tabCount);
  });

  test('assertSmoothScrollingは少数のタブでも動作する', async ({
    sidePanelPage,
  }) => {
    await assertSmoothScrolling(sidePanelPage, 3);
  });
});
