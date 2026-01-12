/**
 * TabTestUtils Test
 *
 * TabTestUtilsの機能をテストします。
 * このテストは、ユーティリティ関数が正しく動作することを確認するためのものです。
 */
import { test, expect } from '../fixtures/extension';
import {
  createTab,
  closeTab,
  activateTab,
  getTestServerUrl,
  getCurrentWindowId,
} from './tab-utils';
import { assertTabStructure, assertUnreadBadge } from './assertion-utils';
import { setupWindow } from './setup-utils';

test.describe('TabTestUtils', () => {
  test('createTabは新しいタブを作成し、ツリーに表示されるまで待機する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

    expect(tabId).toBeGreaterThan(0);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);
  });

  test('createTabは親タブを指定して子タブを作成できる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(
      serviceWorker,
      getTestServerUrl('/child'),
      parentTabId
    );

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);
  });

  test('closeTabはタブを閉じ、ツリーから削除されることを検証する', async ({
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

    await closeTab(serviceWorker, tabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('activateTabはタブをアクティブ化し、ツリーでハイライトされることを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    await activateTab(serviceWorker, tabId2);

    const activeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"].bg-gray-600`);
    await expect(activeNode).toBeVisible({ timeout: 10000 });
  });

  test('assertTabStructureはツリー内のタブ構造を検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

    await expect(
      assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0)
    ).resolves.not.toThrow();
  });

  test('assertTabStructureはツリーからタブノードが削除されたことを検証できる', async ({
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

    await closeTab(serviceWorker, tabId);

    await expect(
      assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0)
    ).resolves.not.toThrow();
  });

  test('assertUnreadBadgeは未読バッジが表示されることを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, {
      active: false,
    });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await assertUnreadBadge(sidePanelPage, tabId);
  });

  test('assertUnreadBadgeはタブをアクティブ化すると未読バッジが消えることを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, {
      active: false,
    });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await assertUnreadBadge(sidePanelPage, tabId);

    await activateTab(serviceWorker, tabId);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
    const unreadBadge = tabNode.locator(`[data-testid="unread-badge"]`);
    await expect(unreadBadge).not.toBeVisible({ timeout: 10000 });
  });
});
