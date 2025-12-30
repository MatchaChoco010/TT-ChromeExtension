/**
 * ドラッグ中のタブサイズ安定性のE2Eテスト
 *
 * Task 4.1: ドラッグ中タブサイズ固定のCSS修正
 *
 * このテストスイートでは、ドラッグ中のタブサイズの安定性を検証します。
 * - 親子関係形成時にタブサイズが変化しないこと (4.1)
 * - ドラッグ操作中のタブノードサイズを一定に維持 (4.2)
 * - ホバーターゲット変化時もサイズを固定 (4.3)
 *
 * Requirements: 4.1, 4.2, 4.3
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
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
 * opacity: 0.5で半透明になっているが、サイズは取得可能
 */
async function getDraggedTabSize(
  page: Page,
  tabId: number
): Promise<{ width: number; height: number }> {
  // ドラッグ中のタブは同じdata-testidを持つが、親要素にtransformが適用されている
  const node = page.locator(`[data-testid="tree-node-${tabId}"]`).first();
  await node.waitFor({ state: 'visible', timeout: 5000 });
  const box = await node.boundingBox();
  if (!box) {
    throw new Error(`Dragged tab node ${tabId} bounding box not found`);
  }
  return { width: box.width, height: box.height };
}

test.describe('ドラッグ中のタブサイズ安定性', () => {
  // タイムアウトを60秒に設定
  test.setTimeout(60000);

  test.describe('タブサイズの一貫性', () => {
    test('ドラッグ開始前後でタブのサイズが変化しないこと', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'data:text/html,<h1>Tab1</h1>');
      const tab2 = await createTab(extensionContext, 'data:text/html,<h1>Tab2</h1>');
      const tab3 = await createTab(extensionContext, 'data:text/html,<h1>Tab3</h1>');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1);
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // ドラッグ前のタブサイズを記録
      const sizeBefore = await getTabNodeSize(sidePanelPage, tab3);

      // tab3をドラッグ開始
      await startDrag(sidePanelPage, tab3);

      // ドラッグ中のタブサイズを確認
      const sizeDuring = await getDraggedTabSize(sidePanelPage, tab3);

      // サイズが変化していないことを確認（許容誤差2px以内）
      expect(Math.abs(sizeDuring.width - sizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(sizeDuring.height - sizeBefore.height)).toBeLessThanOrEqual(2);

      // ドロップを実行
      await dropTab(sidePanelPage);

      // ドロップ後のサイズも確認
      const sizeAfter = await getTabNodeSize(sidePanelPage, tab3);
      expect(Math.abs(sizeAfter.width - sizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(sizeAfter.height - sizeBefore.height)).toBeLessThanOrEqual(2);
    });

    test('親子関係形成時にドラッグ中のタブサイズが変化しないこと', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // 準備: 2つのタブを作成（親候補と子候補）
      const parentTab = await createTab(extensionContext, 'data:text/html,<h1>Parent</h1>');
      const childTab = await createTab(extensionContext, 'data:text/html,<h1>Child</h1>');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab);
      await assertTabInTree(sidePanelPage, childTab);

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // ドラッグ前のタブサイズを記録
      const sizeBefore = await getTabNodeSize(sidePanelPage, childTab);

      // childTabをドラッグ開始
      await startDrag(sidePanelPage, childTab);

      // ドラッグ直後のサイズを確認
      const sizeAfterDragStart = await getDraggedTabSize(sidePanelPage, childTab);
      expect(Math.abs(sizeAfterDragStart.width - sizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(sizeAfterDragStart.height - sizeBefore.height)).toBeLessThanOrEqual(2);

      // parentTabの上にホバー（親子関係形成のトリガー）
      await hoverOverTab(sidePanelPage, parentTab);

      // ホバー後も親候補へのホバー中、ドラッグ中のタブサイズは変化しない
      const sizeAfterHover = await getDraggedTabSize(sidePanelPage, childTab);
      expect(Math.abs(sizeAfterHover.width - sizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(sizeAfterHover.height - sizeBefore.height)).toBeLessThanOrEqual(2);

      // ドロップを実行
      await dropTab(sidePanelPage);
    });

    test('ホバーターゲットが変化してもドラッグ中のタブサイズが一定であること', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // 準備: 4つのタブを作成
      const tab1 = await createTab(extensionContext, 'data:text/html,<h1>Tab1</h1>');
      const tab2 = await createTab(extensionContext, 'data:text/html,<h1>Tab2</h1>');
      const tab3 = await createTab(extensionContext, 'data:text/html,<h1>Tab3</h1>');
      const tabToDrag = await createTab(extensionContext, 'data:text/html,<h1>Drag Me</h1>');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1);
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);
      await assertTabInTree(sidePanelPage, tabToDrag);

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // ドラッグ前のタブサイズを記録
      const sizeBefore = await getTabNodeSize(sidePanelPage, tabToDrag);

      // tabToDragをドラッグ開始
      await startDrag(sidePanelPage, tabToDrag);

      // 複数のターゲットにホバーしてサイズの変化を確認
      const targets = [tab1, tab2, tab3];

      for (const target of targets) {
        // ターゲットにホバー
        await hoverOverTab(sidePanelPage, target);

        // ホバー後のサイズを確認
        const sizeAfterHover = await getDraggedTabSize(sidePanelPage, tabToDrag);

        // サイズが変化していないことを確認（許容誤差2px以内）
        expect(Math.abs(sizeAfterHover.width - sizeBefore.width)).toBeLessThanOrEqual(2);
        expect(Math.abs(sizeAfterHover.height - sizeBefore.height)).toBeLessThanOrEqual(2);
      }

      // ドロップを実行
      await dropTab(sidePanelPage);
    });
  });

  test.describe('ハイライト表示時のサイズ安定性', () => {
    test('ターゲットタブがハイライトされてもサイズが変化しないこと', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // 準備: 2つのタブを作成
      const targetTab = await createTab(extensionContext, 'data:text/html,<h1>Target</h1>');
      const dragTab = await createTab(extensionContext, 'data:text/html,<h1>Drag</h1>');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, targetTab);
      await assertTabInTree(sidePanelPage, dragTab);

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // ハイライト前のターゲットタブのサイズを記録
      const targetSizeBefore = await getTabNodeSize(sidePanelPage, targetTab);

      // dragTabをドラッグ開始
      await startDrag(sidePanelPage, dragTab);

      // targetTabの上にホバー（ハイライト表示がトリガーされる）
      await hoverOverTab(sidePanelPage, targetTab);

      // ハイライト表示中のターゲットタブのサイズを確認
      // ボーダーが追加されてもbox-sizingによりサイズは変化しないはず
      const targetSizeAfterHover = await getTabNodeSize(sidePanelPage, targetTab);

      // サイズが変化していないことを確認（許容誤差2px以内）
      expect(Math.abs(targetSizeAfterHover.width - targetSizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(targetSizeAfterHover.height - targetSizeBefore.height)).toBeLessThanOrEqual(2);

      // ドロップを実行
      await dropTab(sidePanelPage);
    });

    test('ハイライトが解除された後もサイズが元に戻ること', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'data:text/html,<h1>Tab1</h1>');
      const tab2 = await createTab(extensionContext, 'data:text/html,<h1>Tab2</h1>');
      const dragTab = await createTab(extensionContext, 'data:text/html,<h1>Drag</h1>');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1);
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, dragTab);

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // ハイライト前のtab1のサイズを記録
      const tab1SizeBefore = await getTabNodeSize(sidePanelPage, tab1);

      // dragTabをドラッグ開始
      await startDrag(sidePanelPage, dragTab);

      // tab1の上にホバー（ハイライト表示）
      await hoverOverTab(sidePanelPage, tab1);

      // ハイライト中のサイズを確認
      const tab1SizeHighlighted = await getTabNodeSize(sidePanelPage, tab1);
      expect(Math.abs(tab1SizeHighlighted.width - tab1SizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(tab1SizeHighlighted.height - tab1SizeBefore.height)).toBeLessThanOrEqual(2);

      // tab2の上に移動（tab1のハイライトが解除される）
      await hoverOverTab(sidePanelPage, tab2);

      // ハイライト解除後のtab1のサイズを確認
      const tab1SizeAfterUnhighlight = await getTabNodeSize(sidePanelPage, tab1);
      expect(Math.abs(tab1SizeAfterUnhighlight.width - tab1SizeBefore.width)).toBeLessThanOrEqual(2);
      expect(Math.abs(tab1SizeAfterUnhighlight.height - tab1SizeBefore.height)).toBeLessThanOrEqual(2);

      // ドロップを実行
      await dropTab(sidePanelPage);
    });
  });
});
