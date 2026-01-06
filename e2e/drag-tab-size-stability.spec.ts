/**
 * ドラッグ中のタブサイズ安定性のE2Eテスト
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { startDrag, hoverOverTab, dropTab } from './utils/drag-drop-utils';
import type { Page } from '@playwright/test';

/**
 * タブノードのサイズ（幅と高さ）を取得
 */
async function getTabNodeSize(
  page: Page,
  tabId: number
): Promise<{ width: number; height: number }> {
  const node = page.locator(`[data-testid="tree-node-${tabId}"]`).first();
  await node.waitFor({ state: 'visible', timeout: 5000 });
  const box = await node.boundingBox();
  if (!box) {
    throw new Error(`Tab node ${tabId} bounding box not found`);
  }
  return { width: box.width, height: box.height };
}

/**
 * ドラッグ中のタブノード（ドラッグ元）のサイズを取得
 */
async function getDraggedTabSize(
  page: Page,
  tabId: number
): Promise<{ width: number; height: number }> {
  const node = page.locator(`[data-testid="tree-node-${tabId}"]`).first();
  await node.waitFor({ state: 'visible', timeout: 5000 });
  const box = await node.boundingBox();
  if (!box) {
    throw new Error(`Dragged tab node ${tabId} bounding box not found`);
  }
  return { width: box.width, height: box.height };
}

test.describe('ドラッグ中のタブサイズ安定性', () => {
  test.setTimeout(60000);

  test.describe('タブサイズの一貫性', () => {
    test('ドラッグ開始前後でタブのサイズが変化しないこと', async ({
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

      const tab1 = await createTab(extensionContext, 'data:text/html,<h1>Tab1</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(extensionContext, 'data:text/html,<h1>Tab2</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(extensionContext, 'data:text/html,<h1>Tab3</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const sizeBefore = await getTabNodeSize(sidePanelPage, tab3);

      await startDrag(sidePanelPage, tab3);

      const sizeDuring = await getDraggedTabSize(sidePanelPage, tab3);

      expect(Math.abs(sizeDuring.width - sizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(sizeDuring.height - sizeBefore.height)).toBeLessThanOrEqual(2);

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      const sizeAfter = await getTabNodeSize(sidePanelPage, tab3);
      expect(Math.abs(sizeAfter.width - sizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(sizeAfter.height - sizeBefore.height)).toBeLessThanOrEqual(2);
    });

    test('親子関係形成時にドラッグ中のタブサイズが変化しないこと', async ({
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

      const parentTab = await createTab(extensionContext, 'data:text/html,<h1>Parent</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(extensionContext, 'data:text/html,<h1>Child</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const sizeBefore = await getTabNodeSize(sidePanelPage, childTab);

      await startDrag(sidePanelPage, childTab);

      const sizeAfterDragStart = await getDraggedTabSize(sidePanelPage, childTab);
      expect(Math.abs(sizeAfterDragStart.width - sizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(sizeAfterDragStart.height - sizeBefore.height)).toBeLessThanOrEqual(2);

      await hoverOverTab(sidePanelPage, parentTab);

      const sizeAfterHover = await getDraggedTabSize(sidePanelPage, childTab);
      expect(Math.abs(sizeAfterHover.width - sizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(sizeAfterHover.height - sizeBefore.height)).toBeLessThanOrEqual(2);

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);
    });

    test('ホバーターゲットが変化してもドラッグ中のタブサイズが一定であること', async ({
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

      const tab1 = await createTab(extensionContext, 'data:text/html,<h1>Tab1</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(extensionContext, 'data:text/html,<h1>Tab2</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(extensionContext, 'data:text/html,<h1>Tab3</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      const tabToDrag = await createTab(extensionContext, 'data:text/html,<h1>Drag Me</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tabToDrag, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const sizeBefore = await getTabNodeSize(sidePanelPage, tabToDrag);

      await startDrag(sidePanelPage, tabToDrag);

      const targets = [tab1, tab2, tab3];

      for (const target of targets) {
        await hoverOverTab(sidePanelPage, target);

        const sizeAfterHover = await getDraggedTabSize(sidePanelPage, tabToDrag);

        expect(Math.abs(sizeAfterHover.width - sizeBefore.width)).toBeLessThanOrEqual(2);
        expect(Math.abs(sizeAfterHover.height - sizeBefore.height)).toBeLessThanOrEqual(2);
      }

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0, expanded: true },
        { tabId: tabToDrag, depth: 1 },
      ], 0);
    });
  });

  test.describe('ハイライト表示時のサイズ安定性', () => {
    test('ターゲットタブがハイライトされてもサイズが変化しないこと', async ({
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

      const targetTab = await createTab(extensionContext, 'data:text/html,<h1>Target</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: targetTab, depth: 0 },
      ], 0);

      const dragTab = await createTab(extensionContext, 'data:text/html,<h1>Drag</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: targetTab, depth: 0 },
        { tabId: dragTab, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const targetSizeBefore = await getTabNodeSize(sidePanelPage, targetTab);

      await startDrag(sidePanelPage, dragTab);

      await hoverOverTab(sidePanelPage, targetTab);

      const targetSizeAfterHover = await getTabNodeSize(sidePanelPage, targetTab);

      expect(Math.abs(targetSizeAfterHover.width - targetSizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(targetSizeAfterHover.height - targetSizeBefore.height)).toBeLessThanOrEqual(2);

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: targetTab, depth: 0, expanded: true },
        { tabId: dragTab, depth: 1 },
      ], 0);
    });

    test('ハイライトが解除された後もサイズが元に戻ること', async ({
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

      const tab1 = await createTab(extensionContext, 'data:text/html,<h1>Tab1</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(extensionContext, 'data:text/html,<h1>Tab2</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const dragTab = await createTab(extensionContext, 'data:text/html,<h1>Drag</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: dragTab, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tab1SizeBefore = await getTabNodeSize(sidePanelPage, tab1);

      await startDrag(sidePanelPage, dragTab);

      await hoverOverTab(sidePanelPage, tab1);

      const tab1SizeHighlighted = await getTabNodeSize(sidePanelPage, tab1);
      expect(Math.abs(tab1SizeHighlighted.width - tab1SizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(tab1SizeHighlighted.height - tab1SizeBefore.height)).toBeLessThanOrEqual(2);

      await hoverOverTab(sidePanelPage, tab2);

      const tab1SizeAfterUnhighlight = await getTabNodeSize(sidePanelPage, tab1);
      expect(Math.abs(tab1SizeAfterUnhighlight.width - tab1SizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(tab1SizeAfterUnhighlight.height - tab1SizeBefore.height)).toBeLessThanOrEqual(2);

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0, expanded: true },
        { tabId: dragTab, depth: 1 },
      ], 0);
    });
  });
});
