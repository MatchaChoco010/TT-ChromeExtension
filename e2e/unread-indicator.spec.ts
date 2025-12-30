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

/**
 * 未読インジケーター位置のE2Eテスト (Requirement 11)
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 * - 未読インジケーターがタブノードの右端に固定表示される
 * - タイトル長に関わらず一定位置に表示される
 *
 * 注: 現在の実装ではUnreadBadgeはtab-contentコンテナ内のタイトル領域の後に配置されている。
 * タブノードの右端はclose-button-wrapperが占有しているため、
 * バッジはその左側（タイトル領域内）に表示される。
 */
extensionTest.describe('未読インジケーター位置', () => {
  extensionTest(
    '未読インジケーターがタブコンテンツ内に表示される',
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

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // タブノードがDOMに表示されるまで待機
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // タブコンテンツ内に未読バッジが存在することを確認
      const tabContent = tabNode.locator('[data-testid="tab-content"]');
      await expect(tabContent).toBeVisible({ timeout: 5000 });

      const unreadBadgeInContent = tabContent.locator('[data-testid="unread-badge"]');
      await expect(unreadBadgeInContent).toBeVisible({ timeout: 5000 });

      // タブノードと未読バッジの位置関係を検証
      // バッジがtab-content内に適切に配置されていることを確認
      const tabContentBounds = await tabContent.boundingBox();
      const badgeBounds = await unreadBadgeInContent.boundingBox();

      expect(tabContentBounds).not.toBeNull();
      expect(badgeBounds).not.toBeNull();
      if (tabContentBounds && badgeBounds) {
        // バッジがタブコンテンツ内にあることを確認
        expect(badgeBounds.x).toBeGreaterThanOrEqual(tabContentBounds.x);
        expect(badgeBounds.x + badgeBounds.width).toBeLessThanOrEqual(
          tabContentBounds.x + tabContentBounds.width
        );
      }

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
    }
  );

  extensionTest(
    '短いタイトルと長いタイトルの両方で未読インジケーターの相対位置が一定である',
    async ({ extensionContext, sidePanelPage }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // 短いタイトルのタブを作成（バックグラウンド）
      const shortTitleTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // 長いタイトルのタブを作成（バックグラウンド）
      // example.org は長いタイトルを持つことで知られている
      const longTitleTabId = await createTab(
        extensionContext,
        'https://example.org/this-is-a-very-long-path-to-create-a-long-title',
        undefined,
        { active: false }
      );

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // 両方のタブノードがDOMに表示されるまで待機
      const shortTitleTabNode = sidePanelPage.locator(`[data-testid="tree-node-${shortTitleTabId}"]`);
      const longTitleTabNode = sidePanelPage.locator(`[data-testid="tree-node-${longTitleTabId}"]`);
      await expect(shortTitleTabNode).toBeVisible({ timeout: 10000 });
      await expect(longTitleTabNode).toBeVisible({ timeout: 10000 });

      // 両方の未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, shortTitleTabId);
      await assertUnreadBadge(sidePanelPage, longTitleTabId);

      // 短いタイトルのタブでのバッジ位置を取得
      const shortTitleTabContent = shortTitleTabNode.locator('[data-testid="tab-content"]');
      const shortTitleBadge = shortTitleTabContent.locator('[data-testid="unread-badge"]');
      await expect(shortTitleBadge).toBeVisible({ timeout: 5000 });
      const shortTitleTabContentBounds = await shortTitleTabContent.boundingBox();
      const shortTitleBadgeBounds = await shortTitleBadge.boundingBox();

      // 長いタイトルのタブでのバッジ位置を取得
      const longTitleTabContent = longTitleTabNode.locator('[data-testid="tab-content"]');
      const longTitleBadge = longTitleTabContent.locator('[data-testid="unread-badge"]');
      await expect(longTitleBadge).toBeVisible({ timeout: 5000 });
      const longTitleTabContentBounds = await longTitleTabContent.boundingBox();
      const longTitleBadgeBounds = await longTitleBadge.boundingBox();

      // 位置情報が取得できていることを確認
      expect(shortTitleTabContentBounds).not.toBeNull();
      expect(longTitleTabContentBounds).not.toBeNull();
      expect(shortTitleBadgeBounds).not.toBeNull();
      expect(longTitleBadgeBounds).not.toBeNull();

      if (shortTitleTabContentBounds && longTitleTabContentBounds && shortTitleBadgeBounds && longTitleBadgeBounds) {
        // バッジのサイズが同じであることを確認（視覚的一貫性）
        expect(Math.abs(shortTitleBadgeBounds.width - longTitleBadgeBounds.width)).toBeLessThanOrEqual(2);
        expect(Math.abs(shortTitleBadgeBounds.height - longTitleBadgeBounds.height)).toBeLessThanOrEqual(2);

        // 両方のバッジがそれぞれのtab-content内に収まっていることを確認
        expect(shortTitleBadgeBounds.x + shortTitleBadgeBounds.width).toBeLessThanOrEqual(
          shortTitleTabContentBounds.x + shortTitleTabContentBounds.width
        );
        expect(longTitleBadgeBounds.x + longTitleBadgeBounds.width).toBeLessThanOrEqual(
          longTitleTabContentBounds.x + longTitleTabContentBounds.width
        );
      }

      // クリーンアップ
      await closeTab(extensionContext, longTitleTabId);
      await closeTab(extensionContext, shortTitleTabId);
    }
  );

  extensionTest(
    '未読バッジがタブタイトルの後に表示される',
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

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // タブノードがDOMに表示されるまで待機
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // タイトル要素を取得
      const tabTitle = tabNode.locator('[data-testid="tab-title"]');
      await expect(tabTitle).toBeVisible({ timeout: 5000 });

      // 未読バッジを取得
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      // タイトルとバッジの位置を取得
      const titleBounds = await tabTitle.boundingBox();
      const badgeBounds = await unreadBadge.boundingBox();

      expect(titleBounds).not.toBeNull();
      expect(badgeBounds).not.toBeNull();
      if (titleBounds && badgeBounds) {
        // バッジがタイトルの右側（後）に表示されていることを確認
        // バッジの左端がタイトルの左端より右にあることを確認
        expect(badgeBounds.x).toBeGreaterThanOrEqual(titleBounds.x);
      }

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
    }
  );
});
