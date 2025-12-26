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
    async ({ extensionContext, extensionId, sidePanelPage }) => {
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

      // Side Panelを開く
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await sidePanelPage.waitForLoadState('domcontentloaded');

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
    }
  );

  extensionTest(
    '未読タブをアクティブにした場合、未読バッジが消える',
    async ({ extensionContext, extensionId, sidePanelPage }) => {
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

      // Side Panelを開く
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // タブをアクティブ化
      await activateTab(extensionContext, bgTabId);

      // 少し待機して状態更新を待つ
      await sidePanelPage.waitForTimeout(500);

      // 未読バッジが消えることを確認（タブIDに関連するバッジがないこと）
      // タブのデータ属性でノードを特定
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadgeInNode = tabNode.locator('[data-testid="unread-badge"]');

      // バッジが表示されていないことを確認
      await expect(unreadBadgeInNode).toHaveCount(0, { timeout: 5000 });

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
    }
  );

  extensionTest(
    '親タブの子に未読タブがある場合、親タブにも未読インジケータが表示される',
    async ({ extensionContext, extensionId, sidePanelPage }) => {
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

      // Side Panelを開く
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // 子タブに未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, childTabId);

      // 親タブに未読インジケータ（またはカウント）が表示されることを確認
      // 親タブのノードを探す
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
      await expect(parentNode).toBeVisible({ timeout: 5000 });

      // 親タブに未読子タブのインジケータが表示されることを確認
      // 親タブノード内に未読カウントまたはインジケータがあることを確認
      const parentUnreadIndicator = parentNode.locator('[data-testid="unread-child-indicator"], [data-testid="unread-count"]');
      await expect(parentUnreadIndicator.first()).toBeVisible({ timeout: 5000 });

      // クリーンアップ
      await closeTab(extensionContext, childTabId);
      await closeTab(extensionContext, parentTabId);
    }
  );

  extensionTest(
    '複数の未読タブがある場合、未読数がカウントされて表示される',
    async ({ extensionContext, extensionId, sidePanelPage }) => {
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

      // Side Panelを開く
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // 各タブに未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId1);
      await assertUnreadBadge(sidePanelPage, bgTabId2);
      await assertUnreadBadge(sidePanelPage, bgTabId3);

      // 全体の未読カウントが表示されることを確認（ヘッダーやサマリーエリアで）
      // または各未読バッジの数が正しいことを確認
      const allUnreadBadges = sidePanelPage.locator('[data-testid="unread-badge"]');
      const badgeCount = await allUnreadBadges.count();
      expect(badgeCount).toBeGreaterThanOrEqual(3);

      // クリーンアップ
      await closeTab(extensionContext, bgTabId3);
      await closeTab(extensionContext, bgTabId2);
      await closeTab(extensionContext, bgTabId1);
    }
  );
});
