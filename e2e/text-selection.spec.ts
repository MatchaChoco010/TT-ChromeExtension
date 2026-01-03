/**
 * Text Selection E2E Tests
 *
 * テキスト選択禁止機能の E2E テスト
 *
 * - ツリービュー内の全てのテキスト要素がユーザー選択不可（user-select: none）に設定されていること
 * - Shift+クリックでの複数タブ選択時にテキスト選択が発生しないこと
 */

import { test, expect } from './fixtures/extension';
import {
  createTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('テキスト選択禁止機能', () => {
  test('Shift+クリックでの複数タブ選択時にテキストが選択されない', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Arrange: 複数のタブを作成
    const tabId1 = await createTab(extensionContext, 'https://example.com/page1');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'https://example.com/page2');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    const tabId3 = await createTab(extensionContext, 'https://example.com/page3');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // Act: 最初のタブをクリック
    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    await tabNode1.click();

    // Shift+クリックで3番目のタブを選択（範囲選択）
    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
    await tabNode3.click({ modifiers: ['Shift'] });

    // Assert: テキストが選択されていないことを確認
    const selectedText = await sidePanelPage.evaluate(() => {
      const selection = window.getSelection();
      return selection ? selection.toString() : '';
    });
    expect(selectedText).toBe('');

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(extensionContext, tabId2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await closeTab(extensionContext, tabId3);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('ツリービュー内のテキストがドラッグ選択できない', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // タブノード要素のbounding boxを取得
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
    const boundingBox = await tabNode.boundingBox();
    expect(boundingBox).not.toBeNull();

    if (boundingBox) {
      // Act: タブノード上でテキスト選択のドラッグ操作を試みる
      // 左端から右端へドラッグ
      const startX = boundingBox.x + 10;
      const startY = boundingBox.y + boundingBox.height / 2;
      const endX = boundingBox.x + boundingBox.width - 10;
      const endY = startY;

      await sidePanelPage.mouse.move(startX, startY);
      await sidePanelPage.mouse.down();
      await sidePanelPage.mouse.move(endX, endY);
      await sidePanelPage.mouse.up();

      // Assert: テキストが選択されていないことを確認
      const selectedText = await sidePanelPage.evaluate(() => {
        const selection = window.getSelection();
        return selection ? selection.toString() : '';
      });
      expect(selectedText).toBe('');
    }

    // クリーンアップ
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('ツリービュー全体に select-none クラスが適用されている', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Arrange: タブを作成してツリービューを表示
    const tabId = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // Act & Assert: ツリービュー全体に select-none クラスが適用されていることを確認
    const treeView = sidePanelPage.locator('[data-testid="tab-tree-view"]');
    await expect(treeView).toHaveClass(/select-none/);

    // クリーンアップ
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('タブノードに select-none クラスが適用されている', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // Act & Assert: タブノードに select-none クラスが適用されていることを確認
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
    await expect(tabNode).toHaveClass(/select-none/);

    // クリーンアップ
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('user-select CSSプロパティがnoneに設定されている', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // Act & Assert: タブノードの computed style で user-select が none になっていることを確認
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
    const userSelect = await tabNode.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return computedStyle.userSelect;
    });
    expect(userSelect).toBe('none');

    // ツリービュー全体も確認
    const treeView = sidePanelPage.locator('[data-testid="tab-tree-view"]');
    const treeViewUserSelect = await treeView.evaluate((el) => {
      const computedStyle = window.getComputedStyle(el);
      return computedStyle.userSelect;
    });
    expect(treeViewUserSelect).toBe('none');

    // クリーンアップ
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });
});
