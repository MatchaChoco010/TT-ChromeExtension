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
  closeWindow,
} from './window-utils';
import {
  createTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
  getTestServerUrl,
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

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
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

    await newWindowSidePanel.reload({ waitUntil: 'domcontentloaded' });
    await sidePanelPage.reload({ waitUntil: 'domcontentloaded' });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await newWindowSidePanel.close();
    await closeWindow(extensionContext, newWindowId);
  });

  test('クロスウィンドウでタブを別ウィンドウに移動する（moveTabToWindow）', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
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

    await newWindowSidePanel.reload({ waitUntil: 'domcontentloaded' });
    await sidePanelPage.reload({ waitUntil: 'domcontentloaded' });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await newWindowSidePanel.close();
    await closeWindow(extensionContext, newWindowId);
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

    await newWindowSidePanel.close();
    await closeWindow(extensionContext, newWindowId);
  });

  test('複数ウィンドウ間でタブを移動した後、各ウィンドウのツリー状態が正しく同期されることを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const currentWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, currentWindowId);

    const tab1Id = await createTab(serviceWorker, getTestServerUrl('/page1'));
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1Id, depth: 0 },
    ], 0);

    const tab2Id = await createTab(serviceWorker, getTestServerUrl('/page2'));
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

    await newWindowSidePanel.reload({ waitUntil: 'domcontentloaded' });
    await sidePanelPage.reload({ waitUntil: 'domcontentloaded' });

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

    await newWindowSidePanel.close();
    await closeWindow(extensionContext, newWindowId);
  });

  test('子タブを持つ親タブを別ウィンドウに移動した場合、サブツリー全体が一緒に移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const currentWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, currentWindowId);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(
      serviceWorker,
      getTestServerUrl('/child'),
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

    await newWindowSidePanel.reload({ waitUntil: 'domcontentloaded' });
    await sidePanelPage.reload({ waitUntil: 'domcontentloaded' });

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

    await newWindowSidePanel.close();
    await closeWindow(extensionContext, newWindowId);
  });
});
