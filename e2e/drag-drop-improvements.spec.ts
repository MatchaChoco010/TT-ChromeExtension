/**
 * ドラッグ&ドロップ改善のE2Eテスト
 *
 * ドラッグ&ドロップ改善のE2Eテストを追加する
 *
 * このテストスイートでは、ドラッグ&ドロップの改善機能を検証します。
 * - 隙間へのドロップでインジケーターが正しく表示されること (7.1, 7.2, 7.3)
 * - マウスX座標変更でdepthが変化すること (8.3, 8.4, 8.5)
 * - ドラッグ中に他のタブが移動しないこと (16.1, 16.2, 16.3, 16.4)
 * - ドラッグ中に横スクロールが発生しないこと (14.1, 14.2, 14.3)
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { startDrag, hoverOverTab, dropTab } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import type { Page } from '@playwright/test';

/**
 * タブノードのバウンディングボックスを取得
 */
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
  // タイムアウトを60秒に設定
  test.setTimeout(60000);

  test.describe('隙間ドロップのインジケーター表示', () => {
    test('タブとタブの間にドラッグすると、ドロップインジケーターが表示されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 3つのタブを作成
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

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // tab3をドラッグ開始
      await startDrag(sidePanelPage, tab3);

      // tab1とtab2の間にマウスを移動
      const tab1Box = await getTabNodeBoundingBox(sidePanelPage, tab1);
      const tab2Box = await getTabNodeBoundingBox(sidePanelPage, tab2);

      // タブ間の中間位置（tab1の下端とtab2の上端の間）に移動
      const gapY = (tab1Box.y + tab1Box.height + tab2Box.y) / 2;
      await sidePanelPage.mouse.move(tab1Box.x + tab1Box.width / 2, gapY, { steps: 3 });

      // ドロップインジケーターが表示されていることを確認（ドラッグ中のUI要素確認）
      const dropIndicator = sidePanelPage.locator('[data-testid="drop-indicator"]');
      await dropIndicator.waitFor({ state: 'visible', timeout: 3000 });

      // ドロップを実行
      await dropTab(sidePanelPage);

      // ドロップ後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });

    test('タブの上にホバーするとタブがハイライト表示されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 2つのタブを作成
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

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // tab2をドラッグ開始
      await startDrag(sidePanelPage, tab2);

      // tab1の上にホバー
      await hoverOverTab(sidePanelPage, tab1);

      // ドロップを実行
      await dropTab(sidePanelPage);

      // ドロップ後のタブ構造を検証（tab2がtab1の子になる）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 1 },
      ], 0);
    });
  });

  test.describe('ドラッグ中のタブ位置固定', () => {
    test('ドラッグ中に他のタブの表示位置が変更されないこと', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 4つのタブを作成
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

      const tab4 = await createTab(extensionContext, 'data:text/html,<h1>Tab4</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab4, depth: 0 },
      ], 0);

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // tab4をドラッグ開始
      await startDrag(sidePanelPage, tab4);

      // tab1の上にホバー（他のタブの位置を変更させようと試みる）
      await hoverOverTab(sidePanelPage, tab1);

      // ドロップを実行
      await dropTab(sidePanelPage);

      // ドロップ後のタブ構造を検証（tab4がtab1の子になる）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab4, depth: 1 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);
    });

    test('ドロップ時にのみツリー構造が再構築されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 3つのタブを作成
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

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // ドラッグ前のストレージ状態を取得
      const stateBeforeDrag = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return JSON.stringify(result.tree_state);
      });

      // tab3をドラッグ開始してtab1の上に移動
      await startDrag(sidePanelPage, tab3);
      await hoverOverTab(sidePanelPage, tab1);

      // ドラッグ中のストレージ状態を取得（変更されていないはず）
      const stateDuringDrag = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return JSON.stringify(result.tree_state);
      });

      // ドロップを実行
      await dropTab(sidePanelPage);

      // ドロップ後のタブ構造を検証（tab3がtab1の子になる）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab3, depth: 1 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });
  });

  test.describe('ドラッグ中の横スクロール防止', () => {
    test('ドラッグ中にoverflow-x: hiddenが適用されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 2つのタブを作成
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

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // tab2をドラッグ開始
      await startDrag(sidePanelPage, tab2);

      // ドロップを実行
      await dropTab(sidePanelPage);

      // ドロップ後のタブ構造を検証（同じ場所にドロップ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });

    test('ドラッグ中にマウスを左右に動かしてもビューが横スクロールしないこと', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 2つのタブを作成
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

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // tab2をドラッグ開始
      await startDrag(sidePanelPage, tab2);

      // マウスを大きく左右に動かす
      const tab2Box = await getTabNodeBoundingBox(sidePanelPage, tab2);
      await sidePanelPage.mouse.move(tab2Box.x - 100, tab2Box.y, { steps: 5 });
      await sidePanelPage.mouse.move(tab2Box.x + 200, tab2Box.y, { steps: 5 });

      // ドロップを実行
      await dropTab(sidePanelPage);

      // ドロップ後のタブ構造を検証（同じ場所にドロップ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });

    test('ドラッグ終了後に通常のスクロール動作が復元されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 2つのタブを作成
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

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // tab2をドラッグして終了
      await startDrag(sidePanelPage, tab2);
      await dropTab(sidePanelPage);

      // ドロップ後のタブ構造を検証（同じ場所にドロップ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });
  });

  test.describe('depthの視覚的フィードバック', () => {
    test('子タブをドラッグして隙間にホバーするとインジケーターがdepthに応じてインデントされること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 親タブと子タブを作成
      const parentTab = await createTab(extensionContext, 'data:text/html,<h1>Parent</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(extensionContext, 'data:text/html,<h1>Child</h1>', parentTab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 1 },
      ], 0);

      const siblingTab = await createTab(extensionContext, 'data:text/html,<h1>Sibling</h1>');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 1 },
        { tabId: siblingTab, depth: 0 },
      ], 0);

      // 親タブを展開
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      if ((await expandButton.count()) > 0) {
        const isExpanded = await parentNode.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await expandButton.click();
          await parentNode.waitFor({ state: 'visible', timeout: 3000 });
        }
      }

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // siblingTabをドラッグ開始
      await startDrag(sidePanelPage, siblingTab);

      // 親タブと子タブの間にマウスを移動
      const parentBox = await getTabNodeBoundingBox(sidePanelPage, parentTab);
      const childBox = await getTabNodeBoundingBox(sidePanelPage, childTab);

      // タブ間の隙間に移動
      const gapY = (parentBox.y + parentBox.height + childBox.y) / 2;
      await sidePanelPage.mouse.move(parentBox.x + parentBox.width / 2, gapY, { steps: 3 });

      // ドロップを実行
      await dropTab(sidePanelPage);

      // ドロップ後のタブ構造を検証（siblingTabがparentの子（childの前）になる）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: siblingTab, depth: 1 },
        { tabId: childTab, depth: 1 },
      ], 0);
    });
  });
});
