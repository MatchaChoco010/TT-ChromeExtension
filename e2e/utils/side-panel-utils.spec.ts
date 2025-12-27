/**
 * SidePanelUtils Test
 *
 * SidePanelUtilsの機能をテストします。
 * このテストは、ユーティリティ関数が正しく動作することを確認するためのものです。
 *
 * Requirements: 3.7
 */
import { test, expect } from '../fixtures/extension';
import {
  openSidePanel,
  assertTreeVisible,
  assertRealTimeUpdate,
  assertSmoothScrolling,
} from './side-panel-utils';
import { createTab, closeTab } from './tab-utils';

test.describe('SidePanelUtils', () => {
  test('openSidePanelはSide Panelを開く', async ({ extensionContext, extensionId }) => {
    // Side Panelを開く
    const page = await openSidePanel(extensionContext, extensionId);

    // ページが正しく開かれたことを確認
    expect(page).toBeDefined();
    expect(page.url()).toContain('sidepanel.html');

    // クリーンアップ
    await page.close();
  });

  test('assertTreeVisibleはツリーが表示されることを検証する', async ({
    sidePanelPage,
  }) => {
    // ツリーが表示されることを確認（例外が発生しない）
    await assertTreeVisible(sidePanelPage);
  });

  test('assertRealTimeUpdateは別タブでのタブ作成をSide Panelで検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // 初期のツリーノード数を取得
    const initialNodes = sidePanelPage.locator('[data-testid^="tree-node-"]');
    const initialCount = await initialNodes.count();

    // 新しいタブを作成するアクション
    const action = async () => {
      await createTab(extensionContext, 'https://example.com');
    };

    // リアルタイム更新を検証（例外が発生しない）
    await assertRealTimeUpdate(sidePanelPage, action);

    // 作成したタブがUIに反映されるまでポーリングで待機
    await expect(async () => {
      const currentNodes = sidePanelPage.locator('[data-testid^="tree-node-"]');
      const currentCount = await currentNodes.count();
      expect(currentCount).toBeGreaterThan(initialCount);
    }).toPass({ timeout: 10000 });
  });

  test('assertRealTimeUpdateはタブ削除もSide Panelで検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // 事前にタブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');

    // タブがUIに反映されるまでポーリングで待機
    await expect(async () => {
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(tabNode).toBeVisible();
    }).toPass({ timeout: 10000 });

    // タブを削除するアクション
    const action = async () => {
      await closeTab(extensionContext, tabId);
    };

    // リアルタイム更新を検証（例外が発生しない）
    await assertRealTimeUpdate(sidePanelPage, action);

    // タブがUIから削除されるまでポーリングで待機
    await expect(async () => {
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(tabNode).not.toBeVisible();
    }).toPass({ timeout: 10000 });
  });

  test('assertSmoothScrollingは大量タブ時のスクロール動作を検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // 複数のタブを作成（10個）
    const tabCount = 10;
    for (let i = 0; i < tabCount; i++) {
      await createTab(extensionContext, `https://example.com/page${i}`);
    }

    // すべてのタブがUIに反映されるまでポーリングで待機
    await expect(async () => {
      const treeNodes = sidePanelPage.locator('[data-testid^="tree-node-"]');
      const count = await treeNodes.count();
      // 作成したタブ + 初期タブ（sidePanelPageのタブ）が存在することを確認
      expect(count).toBeGreaterThanOrEqual(tabCount);
    }).toPass({ timeout: 10000 });

    // スムーズなスクロールを検証（例外が発生しない）
    await assertSmoothScrolling(sidePanelPage, tabCount);
  });

  test('assertSmoothScrollingは少数のタブでも動作する', async ({
    sidePanelPage,
  }) => {
    // 少数のタブでもスムーズスクロール検証が動作することを確認
    await assertSmoothScrolling(sidePanelPage, 3);
  });
});
