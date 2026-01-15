import { test, expect } from './fixtures/extension';
import { createTab, closeTab, activateTab, getCurrentWindowId, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForTabRemovedFromTreeState, waitForTabUrlLoaded } from './utils/polling-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('タブライフサイクルとツリー構造の基本操作', () => {
  test('新しいタブを作成した場合、タブが正常に作成される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

    const createdTab = await waitForTabUrlLoaded(serviceWorker, tabId, '127.0.0.1');
    expect(createdTab.url || createdTab.pendingUrl || '').toContain('127.0.0.1');
  });

  test('親タブから新しいタブを開いた場合、親子関係が正しく確立される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage, initialBrowserTabId, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(
      serviceWorker,
      getTestServerUrl('/page'),
      parentTabId
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);
  });

  test('タブを閉じた場合、タブが正常に削除される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage, initialBrowserTabId, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tabId);
    await waitForTabRemovedFromTreeState(serviceWorker, tabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('子タブを持つ親タブを閉じた場合、親タブが正常に削除される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage, initialBrowserTabId, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId1 = await createTab(
      serviceWorker,
      getTestServerUrl('/page'),
      parentTabId
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
    ], 0);

    const childTabId2 = await createTab(
      serviceWorker,
      getTestServerUrl('/page'),
      parentTabId
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
      { tabId: childTabId2, depth: 1 },
    ], 0);

    await closeTab(serviceWorker, parentTabId);
    await waitForTabRemovedFromTreeState(serviceWorker, parentTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: childTabId1, depth: 0 },
      { tabId: childTabId2, depth: 0 },
    ], 0);
  });

  test('タブのタイトルまたはURLが変更された場合、変更が反映される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage, initialBrowserTabId, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

    const pageUrl = getTestServerUrl('/page');
    const tabBefore = await waitForTabUrlLoaded(serviceWorker, tabId, '127.0.0.1', 10000);
    expect(tabBefore.url || tabBefore.pendingUrl || '').toContain('127.0.0.1');

    await serviceWorker.evaluate(
      ({ tabId, url }) => {
        return chrome.tabs.update(tabId, { url });
      },
      { tabId, url: pageUrl }
    );

    const tabAfter = await waitForTabUrlLoaded(serviceWorker, tabId, '127.0.0.1', 10000);

    expect(tabAfter).toBeDefined();
    expect(tabAfter.id).toBe(tabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);
  });

  test('タブがアクティブ化された場合、アクティブ状態が正しく設定される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage, initialBrowserTabId, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, {
      active: false,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, {
      active: false,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await activateTab(serviceWorker, tabId1);

    const tabs1 = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });
    const activeTab1 = tabs1.find((tab: chrome.tabs.Tab) => tab.id === tabId1);
    expect(activeTab1?.active).toBe(true);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await activateTab(serviceWorker, tabId2);

    const tabs2 = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });
    const activeTab2 = tabs2.find((tab: chrome.tabs.Tab) => tab.id === tabId2);
    expect(activeTab2?.active).toBe(true);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);
  });
});
