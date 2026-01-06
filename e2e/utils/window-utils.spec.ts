/**
 * WindowTestUtils Test
 *
 * WindowTestUtilsの機能をテストします。
 * このテストは、ユーティリティ関数が正しく動作することを確認するためのものです。
 */
import { test, expect } from '../fixtures/extension';
import {
  createWindow,
  moveTabToWindow,
  assertWindowTreeSync,
  openSidePanelForWindow,
} from './window-utils';
import {
  createTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
} from './tab-utils';
import { assertTabStructure, assertWindowExists } from './assertion-utils';

test.describe('WindowTestUtils', () => {
  test('createWindowは新しいウィンドウを作成する', async ({ extensionContext }) => {
    const windowId = await createWindow(extensionContext);

    await assertWindowExists(extensionContext, windowId);
  });

  test('moveTabToWindowはタブを別ウィンドウに移動する', async ({
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

    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);

    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    await moveTabToWindow(extensionContext, tabId, newWindowId);

    await newWindowSidePanel.reload();
    await sidePanelPage.reload();

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);
  });

  test('クロスウィンドウでタブを別ウィンドウに移動する（moveTabToWindow）', async ({
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

    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);

    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    await moveTabToWindow(extensionContext, tabId, newWindowId);

    await newWindowSidePanel.reload();
    await sidePanelPage.reload();

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);
  });

  test('assertWindowTreeSyncは各ウィンドウのツリー状態が正しく同期されることを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);

    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    await expect(
      assertWindowTreeSync(extensionContext, newWindowId)
    ).resolves.not.toThrow();
  });

  test('複数ウィンドウ間でタブを移動した後、各ウィンドウのツリー状態が正しく同期されることを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const currentWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, currentWindowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, currentWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tab1Id = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1Id, depth: 0 },
    ], 0);

    const tab2Id = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1Id, depth: 0 },
      { tabId: tab2Id, depth: 0 },
    ], 0);

    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);

    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    await moveTabToWindow(extensionContext, tab1Id, newWindowId);

    await newWindowSidePanel.reload();
    await sidePanelPage.reload();

    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab2Id, depth: 0 },
    ], 0);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tab1Id, depth: 0 },
    ], 0);

    await assertWindowTreeSync(extensionContext, currentWindowId);
    await assertWindowTreeSync(extensionContext, newWindowId);
  });

  test('子タブを持つ親タブを別ウィンドウに移動した場合、サブツリー全体が一緒に移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const currentWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, currentWindowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, currentWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(
      extensionContext,
      'about:blank',
      parentTabId
    );
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);

    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    await moveTabToWindow(extensionContext, parentTabId, newWindowId);

    await newWindowSidePanel.reload();
    await sidePanelPage.reload();

    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    await assertWindowTreeSync(extensionContext, newWindowId);
  });
});
