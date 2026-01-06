/**
 * DragDropUtils Tests
 *
 * ドラッグ&ドロップ操作のシミュレーションとドロップ位置検証のテスト
 */
import { test } from '../fixtures/extension';
import * as dragDropUtils from './drag-drop-utils';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './tab-utils';
import { assertTabStructure } from './assertion-utils';

test.describe('DragDropUtils', () => {

  test.describe('startDrag', () => {
    test('タブノードをドラッグ開始できる', async ({
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

      await dragDropUtils.startDrag(sidePanelPage, tabId);

      await dragDropUtils.dropTab(sidePanelPage);
    });
  });

  test.describe('hoverOverTab', () => {
    test('別のタブノード上にホバーできる', async ({
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

      const tab1Id = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(extensionContext, 'https://www.example.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await dragDropUtils.startDrag(sidePanelPage, tab1Id);

      await dragDropUtils.hoverOverTab(sidePanelPage, tab2Id);

      await dragDropUtils.dropTab(sidePanelPage);
    });
  });

  test.describe('dropTab', () => {
    test('ドロップを実行できる', async ({ extensionContext, sidePanelPage, serviceWorker }) => {
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

      await dragDropUtils.startDrag(sidePanelPage, tabId);

      await dragDropUtils.dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('reorderTabs', () => {
    test('同階層のタブを並び替えできる（before）', async ({
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

      const tab1Id = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(extensionContext, 'https://www.example.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await dragDropUtils.reorderTabs(sidePanelPage, tab2Id, tab1Id, 'before');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab2Id, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);
    });

    test('同階層のタブを並び替えできる（after）', async ({
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

      const tab1Id = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(extensionContext, 'https://www.example.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await dragDropUtils.reorderTabs(sidePanelPage, tab1Id, tab2Id, 'after');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab2Id, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);
    });
  });

  test.describe('moveTabToParent', () => {
    test('タブを別のタブの子にできる', async ({
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

      const parentTabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(extensionContext, 'https://www.example.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: childTabId, depth: 0 },
      ], 0);

      await dragDropUtils.moveTabToParent(sidePanelPage, childTabId, parentTabId, serviceWorker);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);
    });
  });

  test.describe('assertDropIndicator', () => {
    test('ドロップインジケータの表示を検証できる', async ({
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

      const tab1Id = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(extensionContext, 'https://www.example.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await dragDropUtils.startDrag(sidePanelPage, tab1Id);
      await dragDropUtils.hoverOverTab(sidePanelPage, tab2Id);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await dragDropUtils.dropTab(sidePanelPage);
    });
  });

  test.describe('assertAutoExpand', () => {
    test('ホバー自動展開を検証できる', async ({
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

      const parentTabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(extensionContext, 'https://www.example.org', parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const dragTabId = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
        { tabId: dragTabId, depth: 0 },
      ], 0);
    });
  });
});
