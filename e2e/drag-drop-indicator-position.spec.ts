import { test, expect } from './fixtures/extension';
import { createTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { startDrag, dropTab, moveTabToParent } from './utils/drag-drop-utils';
import { waitForCondition } from './utils/polling-utils';
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

async function getDropIndicatorBoundingBox(
  page: Page
): Promise<{ x: number; y: number; width: number; height: number } | null> {
  const indicator = page.locator('[data-testid="drop-indicator"]');
  const isVisible = await indicator.isVisible().catch(() => false);
  if (!isVisible) {
    return null;
  }
  const box = await indicator.boundingBox();
  return box;
}

async function waitForDropIndicatorVisible(
  page: Page,
  timeout: number = 5000
): Promise<void> {
  await waitForCondition(
    async () => {
      const indicator = page.locator('[data-testid="drop-indicator"]');
      return await indicator.isVisible().catch(() => false);
    },
    { timeout, interval: 100, timeoutMessage: 'Drop indicator did not become visible' }
  );
}

test.describe('ドラッグ&ドロップ - プレースホルダー位置精度', () => {
  test.setTimeout(120000);

  test.describe('サブツリーをドラッグ中のプレースホルダー位置', () => {
    test('サブツリーを持つタブをドラッグ中に、サブツリーの上の隙間にホバーするとプレースホルダーが正しい位置に表示されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // 準備: 親タブとサブツリーを持つタブを作成
      // タブX -> 親タブ（サブツリーなし）
      // タブA -> 親タブ（サブツリーあり）
      //   タブB -> タブAの子
      //     タブC -> タブBの子
      // タブY -> 親タブ（サブツリーなし）

      const tabX = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabX, depth: 0 },
      ], 0);

      const tabA = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabX, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabX, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(serviceWorker, getTestServerUrl('/page4'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabX, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      const tabY = await createTab(serviceWorker, getTestServerUrl('/page5'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabX, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabY, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabB, tabA, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabX, depth: 0 },
        { tabId: tabA, depth: 0, expanded: true },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 0 },
        { tabId: tabY, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabC, tabB, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabX, depth: 0 },
        { tabId: tabA, depth: 0, expanded: true },
        { tabId: tabB, depth: 1, expanded: true },
        { tabId: tabC, depth: 2 },
        { tabId: tabY, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await startDrag(sidePanelPage, tabA);

      const tabXBox = await getTabNodeBoundingBox(sidePanelPage, tabX);

      // タブXの下端付近（タブXとタブAの間の隙間）にマウスを移動
      const gapY = tabXBox.y + tabXBox.height * 0.85;
      await sidePanelPage.mouse.move(tabXBox.x + tabXBox.width / 2, gapY, { steps: 10 });

      await waitForDropIndicatorVisible(sidePanelPage);

      const indicatorBox = await getDropIndicatorBoundingBox(sidePanelPage);
      expect(indicatorBox).not.toBeNull();

      if (indicatorBox) {
        // タブYの位置を取得して、プレースホルダーがサブツリーの中央ではなく
        // タブXの近くに表示されていることを確認
        const tabYBox = await getTabNodeBoundingBox(sidePanelPage, tabY);

        // プレースホルダーのY座標がタブXの下端付近にあること
        // （タブYの上端よりもタブXの下端に近いこと）
        const distanceFromTabX = Math.abs(indicatorBox.y - tabXBox.y - tabXBox.height);
        const distanceFromTabY = Math.abs(indicatorBox.y - tabYBox.y);

        expect(distanceFromTabX).toBeLessThan(distanceFromTabY);
      }

      await dropTab(sidePanelPage);

      // ドロップ後のタブ構造を検証（元の位置に戻る or 変更がなかったことを確認）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabX, depth: 0 },
        { tabId: tabA, depth: 0, expanded: true },
        { tabId: tabB, depth: 1, expanded: true },
        { tabId: tabC, depth: 2 },
        { tabId: tabY, depth: 0 },
      ], 0);
    });
  });

  test.describe('ドラッグ中のタブの隣接位置へのドロップ', () => {
    test('タブBをドラッグ中にタブAとタブBの間にホバーするとプレースホルダーがタブAとタブBの間に表示されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // 準備: 3つのタブを作成
      // タブA
      // タブB <- ドラッグするタブ
      // タブC

      const tabA = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await startDrag(sidePanelPage, tabB);

      const tabABox = await getTabNodeBoundingBox(sidePanelPage, tabA);
      const tabBBox = await getTabNodeBoundingBox(sidePanelPage, tabB);

      // タブAの下端付近（タブAとタブBの間の隙間）にマウスを移動
      const gapY = tabABox.y + tabABox.height * 0.85;
      await sidePanelPage.mouse.move(tabABox.x + tabABox.width / 2, gapY, { steps: 10 });

      await waitForDropIndicatorVisible(sidePanelPage);

      const indicatorBox = await getDropIndicatorBoundingBox(sidePanelPage);
      expect(indicatorBox).not.toBeNull();

      if (indicatorBox) {
        // プレースホルダーのY座標がタブAの下端とタブBの上端の間にあること
        // （タブBの中央ではなく、タブAとタブBの間にあること）
        const expectedY = (tabABox.y + tabABox.height + tabBBox.y) / 2;
        const tolerance = tabABox.height;

        // プレースホルダーがタブAとタブBの間（期待される位置の近く）にあること
        expect(Math.abs(indicatorBox.y - expectedY)).toBeLessThanOrEqual(tolerance);

        // プレースホルダーがタブBの中央（y + height/2）付近にないことを確認
        const tabBCenterY = tabBBox.y + tabBBox.height / 2;
        const distanceFromCenter = Math.abs(indicatorBox.y - tabBCenterY);

        // タブBの中央からの距離がタブの高さの25%以上離れていること
        expect(distanceFromCenter).toBeGreaterThan(tabBBox.height * 0.25);
      }

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);
    });

    test('タブBをドラッグ中にタブBとタブCの間にホバーするとプレースホルダーがタブBとタブCの間に表示されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // 準備: 3つのタブを作成
      // タブA
      // タブB <- ドラッグするタブ
      // タブC

      const tabA = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await startDrag(sidePanelPage, tabB);

      const tabBBox = await getTabNodeBoundingBox(sidePanelPage, tabB);
      const tabCBox = await getTabNodeBoundingBox(sidePanelPage, tabC);

      // タブCの上端付近（タブBとタブCの間の隙間）にマウスを移動
      const gapY = tabCBox.y + tabCBox.height * 0.15;
      await sidePanelPage.mouse.move(tabCBox.x + tabCBox.width / 2, gapY, { steps: 10 });

      await waitForDropIndicatorVisible(sidePanelPage);

      const indicatorBox = await getDropIndicatorBoundingBox(sidePanelPage);
      expect(indicatorBox).not.toBeNull();

      if (indicatorBox) {
        // プレースホルダーのY座標がタブBの下端とタブCの上端の間にあること
        const expectedY = (tabBBox.y + tabBBox.height + tabCBox.y) / 2;
        const tolerance = tabBBox.height;

        // プレースホルダーがタブBとタブCの間（期待される位置の近く）にあること
        expect(Math.abs(indicatorBox.y - expectedY)).toBeLessThanOrEqual(tolerance);

        // プレースホルダーがタブBの中央（y + height/2）付近にないことを確認
        const tabBCenterY = tabBBox.y + tabBBox.height / 2;
        const distanceFromCenter = Math.abs(indicatorBox.y - tabBCenterY);

        // タブBの中央からの距離がタブの高さの25%以上離れていること
        expect(distanceFromCenter).toBeGreaterThan(tabBBox.height * 0.25);
      }

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);
    });
  });

  test.describe('複数の隙間を連続でホバーした場合のプレースホルダー位置', () => {
    test('ドラッグ中に複数の隙間をホバーするとプレースホルダーが正しく追従すること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // 準備: 4つのタブを作成

      const tab1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      const tab4 = await createTab(serviceWorker, getTestServerUrl('/page4'));
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

      const tab1Box = await getTabNodeBoundingBox(sidePanelPage, tab1);
      const tab2Box = await getTabNodeBoundingBox(sidePanelPage, tab2);
      const gap1Y = (tab1Box.y + tab1Box.height + tab2Box.y) / 2;
      await sidePanelPage.mouse.move(tab1Box.x + tab1Box.width / 2, gap1Y, { steps: 10 });

      await waitForDropIndicatorVisible(sidePanelPage);

      const firstIndicatorBox = await getDropIndicatorBoundingBox(sidePanelPage);
      expect(firstIndicatorBox).not.toBeNull();

      const tab3Box = await getTabNodeBoundingBox(sidePanelPage, tab3);
      const gap2Y = (tab2Box.y + tab2Box.height + tab3Box.y) / 2;
      await sidePanelPage.mouse.move(tab2Box.x + tab2Box.width / 2, gap2Y, { steps: 10 });

      await waitForCondition(
        async () => {
          const currentBox = await getDropIndicatorBoundingBox(sidePanelPage);
          if (!currentBox || !firstIndicatorBox) return false;
          return Math.abs(currentBox.y - firstIndicatorBox.y) >= 1;
        },
        { timeout: 3000, interval: 50, timeoutMessage: 'Drop indicator position did not change' }
      );

      const secondIndicatorBox = await getDropIndicatorBoundingBox(sidePanelPage);
      expect(secondIndicatorBox).not.toBeNull();

      if (firstIndicatorBox && secondIndicatorBox) {
        expect(secondIndicatorBox.y).toBeGreaterThan(firstIndicatorBox.y);
      }

      await dropTab(sidePanelPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab4, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);
    });
  });
});
