/**
 * 未読インジケータ機能のE2Eテスト
 *
 * Requirements: 3.13
 * - タブがバックグラウンドで読み込まれた場合、未読バッジが表示される
 * - 未読タブをアクティブにした場合、未読バッジが消える
 * - 親タブの子に未読タブがある場合、親タブにも未読インジケータが表示される
 * - 複数の未読タブがある場合、未読数がカウントされて表示される
 */
import { expect } from '@playwright/test';
import { test as extensionTest } from './fixtures/extension';
import { createTab, activateTab, assertUnreadBadge, closeTab } from './utils/tab-utils';

extensionTest.describe('未読インジケータ機能', () => {
  extensionTest(
    'タブがバックグラウンドで読み込まれた場合、未読バッジが表示される',
    async ({ extensionContext, sidePanelPage }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // バックグラウンドでタブを作成（active: false）
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // ツリーが表示されるまで待機（フィクスチャがSide Panelのナビゲーションを完了済み）
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // タブノードがDOMに表示されるまで待機
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
    }
  );

  extensionTest(
    '未読タブをアクティブにした場合、未読バッジが消える',
    async ({ extensionContext, sidePanelPage }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // バックグラウンドでタブを作成
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // ツリーが表示されるまで待機（フィクスチャがSide Panelのナビゲーションを完了済み）
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // タブノードがDOMに表示されるまで待機
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // タブをアクティブ化
      await activateTab(extensionContext, bgTabId);

      // 未読バッジが消えることを確認（タブIDに関連するバッジがないこと）
      const unreadBadgeInNode = tabNode.locator('[data-testid="unread-badge"]');

      // バッジが表示されなくなるまでポーリング（UIの更新を待つ）
      await expect(unreadBadgeInNode).toHaveCount(0, { timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
    }
  );

  extensionTest(
    '親タブの子に未読タブがある場合、親タブにも未読インジケータが表示される',
    async ({ extensionContext, sidePanelPage }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // 親タブを作成（アクティブ）
      const parentTabId = await createTab(
        extensionContext,
        'https://example.com/parent',
        undefined,
        { active: true }
      );

      // 子タブをバックグラウンドで作成（active: false, 親タブIDを指定）
      const childTabId = await createTab(
        extensionContext,
        'https://example.com/child',
        parentTabId,
        { active: false }
      );

      // ツリーが表示されるまで待機（フィクスチャがSide Panelのナビゲーションを完了済み）
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // 親タブに未読インジケータ（またはカウント）が表示されることを確認
      // 親タブのノードを探す
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
      await expect(parentNode).toBeVisible({ timeout: 10000 });

      // 子タブノードがDOMに表示されるまで待機
      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
      await expect(childNode).toBeVisible({ timeout: 10000 });

      // 子タブに未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, childTabId);

      // 親タブに未読子タブのインジケータが表示されることを確認
      // 親タブノード内に未読カウントまたはインジケータがあることを確認
      const parentUnreadIndicator = parentNode.locator('[data-testid="unread-child-indicator"], [data-testid="unread-count"]');
      await expect(parentUnreadIndicator.first()).toBeVisible({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, childTabId);
      await closeTab(extensionContext, parentTabId);
    }
  );

  extensionTest(
    '複数の未読タブがある場合、未読数がカウントされて表示される',
    async ({ extensionContext, sidePanelPage }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // 複数のバックグラウンドタブを作成
      const bgTabId1 = await createTab(
        extensionContext,
        'https://example.com/tab1',
        undefined,
        { active: false }
      );
      const bgTabId2 = await createTab(
        extensionContext,
        'https://example.com/tab2',
        undefined,
        { active: false }
      );
      const bgTabId3 = await createTab(
        extensionContext,
        'https://example.com/tab3',
        undefined,
        { active: false }
      );

      // ツリーが表示されるまで待機（フィクスチャがSide Panelのナビゲーションを完了済み）
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // 各タブノードがDOMに表示されるまで待機
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId2}"]`);
      const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId3}"]`);
      await expect(tabNode1).toBeVisible({ timeout: 10000 });
      await expect(tabNode2).toBeVisible({ timeout: 10000 });
      await expect(tabNode3).toBeVisible({ timeout: 10000 });

      // 各タブに未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId1);
      await assertUnreadBadge(sidePanelPage, bgTabId2);
      await assertUnreadBadge(sidePanelPage, bgTabId3);

      // 全体の未読カウントが表示されることを確認（ヘッダーやサマリーエリアで）
      // または各未読バッジの数が正しいことを確認
      // Playwrightのexpectでポーリングして待機
      const allUnreadBadges = sidePanelPage.locator('[data-testid="unread-badge"]');
      await expect(allUnreadBadges).toHaveCount(3, { timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, bgTabId3);
      await closeTab(extensionContext, bgTabId2);
      await closeTab(extensionContext, bgTabId1);
    }
  );
});
