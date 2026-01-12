import { test } from './fixtures/extension';
import { createTab, getCurrentWindowId } from './utils/tab-utils';
import { startDrag, hoverOverTab, dropTab } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';
import type { Page } from '@playwright/test';

async function getTabNodeBoundingBox(
  page: Page,
  tabId: number
): Promise<{ x: number; y: number; width: number; height: number }> {
  const node = page.locator(`[data-testid="tree-node-${tabId}"]`).first();
  await node.waitFor({ state: 'visible', timeout: 5000 });
  const box = await node.boundingBox();
  if (!box) {
    throw new Error(`Tab node ${tabId} bounding box not found`);
  }
  return box;
}

test.describe('ドラッグ&ドロップ改善', () => {
  test.setTimeout(60000);

  test.describe('隙間ドロップのインジケーター表示', () => {
    test('タブとタブの間にドラッグすると、ドロップインジケーターが表示されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tab1 = await createTab(serviceWorker, 'data:text/html,<h1>Tab1</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, 'data:text/html,<h1>Tab2</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(serviceWorker, 'data:text/html,<h1>Tab3</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await startDrag(sidePanelPage, tab3);

      const tab1Box = await getTabNodeBoundingBox(sidePanelPage, tab1);
      const tab2Box = await getTabNodeBoundingBox(sidePanelPage, tab2);

      const gapY = (tab1Box.y + tab1Box.height + tab2Box.y) / 2;
      await sidePanelPage.mouse.move(tab1Box.x + tab1Box.width / 2, gapY, { steps: 3 });

      const dropIndicator = sidePanelPage.locator('[data-testid="drop-indicator"]');
      await dropIndicator.waitFor({ state: 'visible', timeout: 3000 });

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });

    test('タブの上にホバーするとタブがハイライト表示されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tab1 = await createTab(serviceWorker, 'data:text/html,<h1>Tab1</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, 'data:text/html,<h1>Tab2</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await startDrag(sidePanelPage, tab2);

      await hoverOverTab(sidePanelPage, tab1);

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0, expanded: true },
        { tabId: tab2, depth: 1 },
      ], 0);
    });
  });

  test.describe('ドラッグ中のタブ位置固定', () => {
    test('ドラッグ中に他のタブの表示位置が変更されないこと', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tab1 = await createTab(serviceWorker, 'data:text/html,<h1>Tab1</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, 'data:text/html,<h1>Tab2</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(serviceWorker, 'data:text/html,<h1>Tab3</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      const tab4 = await createTab(serviceWorker, 'data:text/html,<h1>Tab4</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab4, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await startDrag(sidePanelPage, tab4);

      await hoverOverTab(sidePanelPage, tab1);

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0, expanded: true },
        { tabId: tab4, depth: 1 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);
    });

    test('ドロップ時にのみツリー構造が再構築されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tab1 = await createTab(serviceWorker, 'data:text/html,<h1>Tab1</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, 'data:text/html,<h1>Tab2</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(serviceWorker, 'data:text/html,<h1>Tab3</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const _stateBeforeDrag = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return JSON.stringify(result.tree_state);
      });

      await startDrag(sidePanelPage, tab3);
      await hoverOverTab(sidePanelPage, tab1);

      const _stateDuringDrag = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return JSON.stringify(result.tree_state);
      });

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0, expanded: true },
        { tabId: tab3, depth: 1 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });
  });

  test.describe('ドラッグ中の横スクロール防止', () => {
    test('ドラッグ中にoverflow-x: hiddenが適用されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tab1 = await createTab(serviceWorker, 'data:text/html,<h1>Tab1</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, 'data:text/html,<h1>Tab2</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await startDrag(sidePanelPage, tab2);

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });

    test('ドラッグ中にマウスを左右に動かしてもビューが横スクロールしないこと', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tab1 = await createTab(serviceWorker, 'data:text/html,<h1>Tab1</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, 'data:text/html,<h1>Tab2</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await startDrag(sidePanelPage, tab2);

      const tab2Box = await getTabNodeBoundingBox(sidePanelPage, tab2);
      await sidePanelPage.mouse.move(tab2Box.x - 100, tab2Box.y, { steps: 5 });
      await sidePanelPage.mouse.move(tab2Box.x + 200, tab2Box.y, { steps: 5 });

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });

    test('ドラッグ終了後に通常のスクロール動作が復元されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tab1 = await createTab(serviceWorker, 'data:text/html,<h1>Tab1</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, 'data:text/html,<h1>Tab2</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await startDrag(sidePanelPage, tab2);
      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });
  });

  test.describe('depthの視覚的フィードバック', () => {
    test('子タブをドラッグして隙間にホバーするとインジケーターがdepthに応じてインデントされること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTab = await createTab(serviceWorker, 'data:text/html,<h1>Parent</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, 'data:text/html,<h1>Child</h1>', parentTab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      const siblingTab = await createTab(serviceWorker, 'data:text/html,<h1>Sibling</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
        { tabId: siblingTab, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await startDrag(sidePanelPage, siblingTab);

      const parentBox = await getTabNodeBoundingBox(sidePanelPage, parentTab);
      const childBox = await getTabNodeBoundingBox(sidePanelPage, childTab);

      const gapY = (parentBox.y + parentBox.height + childBox.y) / 2;
      await sidePanelPage.mouse.move(parentBox.x + parentBox.width / 2, gapY, { steps: 3 });

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: siblingTab, depth: 1 },
        { tabId: childTab, depth: 1 },
      ], 0);
    });
  });
});
