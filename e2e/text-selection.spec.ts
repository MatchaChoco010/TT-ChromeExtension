/**
 * Text Selection E2E Tests
 *
 * テキスト選択禁止機能の E2E テスト
 *
 * Requirements: 4.1, 4.2
 * - ツリービュー内の全てのテキスト要素がユーザー選択不可（user-select: none）に設定されていること
 * - Shift+クリックでの複数タブ選択時にテキスト選択が発生しないこと
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';

test.describe('テキスト選択禁止機能', () => {
  test('Shift+クリックでの複数タブ選択時にテキストが選択されない', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: 複数のタブを作成
    const tabId1 = await createTab(extensionContext, 'https://example.com/page1');
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`)).toBeVisible({ timeout: 10000 });

    const tabId2 = await createTab(extensionContext, 'https://example.com/page2');
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`)).toBeVisible({ timeout: 10000 });

    const tabId3 = await createTab(extensionContext, 'https://example.com/page3');
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`)).toBeVisible({ timeout: 10000 });

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
    await closeTab(extensionContext, tabId2);
    await closeTab(extensionContext, tabId3);
  });

  test('ツリービュー内のテキストがドラッグ選択できない', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

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
  });

  test('ツリービュー全体に select-none クラスが適用されている', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: タブを作成してツリービューを表示
    const tabId = await createTab(extensionContext, 'https://example.com');
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

    // Act & Assert: ツリービュー全体に select-none クラスが適用されていることを確認
    const treeView = sidePanelPage.locator('[data-testid="tab-tree-view"]');
    await expect(treeView).toHaveClass(/select-none/);

    // クリーンアップ
    await closeTab(extensionContext, tabId);
  });

  test('タブノードに select-none クラスが適用されている', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

    // Act & Assert: タブノードに select-none クラスが適用されていることを確認
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
    await expect(tabNode).toHaveClass(/select-none/);

    // クリーンアップ
    await closeTab(extensionContext, tabId);
  });

  test('user-select CSSプロパティがnoneに設定されている', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

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
  });
});
