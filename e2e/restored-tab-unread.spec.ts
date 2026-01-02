/**
 * 復元タブの未読状態E2Eテスト
 *
 * セッション復元タブの未読除外実装
 * - ブラウザを開き直したときに復元されたタブに未読インジケーターが付かない
 * - ウィンドウが開いた時点で既存タブを復元タブとして記録する
 * - ウィンドウ初期化後にユーザーが新しいタブを開いたときにのみ未読インジケーターを表示する
 */
import { expect } from '@playwright/test';
import { test as extensionTest } from './fixtures/extension';
import { createTab, closeTab, activateTab } from './utils/tab-utils';

extensionTest.describe('復元タブの未読状態', () => {
  extensionTest(
    'ブラウザ起動時に復元されたタブに未読インジケーターが表示されない',
    async ({ extensionContext, sidePanelPage }) => {
      // アクティブなタブを取得（ブラウザ起動時に復元されたタブ）
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // 起動時の既存タブは未読インジケーターが付かないことを確認
      // タブノードが表示されるまで待機
      const tabNodes = sidePanelPage.locator('[data-testid^="tree-node-"]');
      await expect(tabNodes.first()).toBeVisible({ timeout: 10000 });

      // 未読バッジが表示されていないことを確認
      const unreadBadges = sidePanelPage.locator('[data-testid="unread-badge"]');
      await expect(unreadBadges).toHaveCount(0, { timeout: 5000 });
    }
  );

  extensionTest(
    '新しいタブをバックグラウンドで開くと未読インジケーターが表示される',
    async ({ extensionContext, sidePanelPage }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // 初期状態では未読バッジがないことを確認
      const initialUnreadBadges = sidePanelPage.locator('[data-testid="unread-badge"]');
      await expect(initialUnreadBadges).toHaveCount(0, { timeout: 5000 });

      // バックグラウンドで新しいタブを作成
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブノードがDOMに表示されるまで待機
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // 新しいタブには未読バッジが表示されることを確認
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
    }
  );

  extensionTest(
    'アクティブ状態で新しいタブを開くと未読インジケーターが表示されない',
    async ({ extensionContext, sidePanelPage }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // アクティブ状態で新しいタブを作成
      const activeTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: true }
      );

      // タブノードがDOMに表示されるまで待機
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${activeTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // アクティブなタブには未読バッジが表示されないことを確認
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toHaveCount(0, { timeout: 5000 });

      // クリーンアップ
      await closeTab(extensionContext, activeTabId);
    }
  );

  extensionTest(
    'サイドパネルをリロードしても既存タブに未読インジケーターが付かない',
    async ({ extensionContext, sidePanelPage, extensionId, serviceWorker }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // バックグラウンドで新しいタブを作成（未読状態になる）
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブノードがDOMに表示されるまで待機
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // 未読バッジが表示されることを確認
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // タブをアクティブにして既読にする
      await activateTab(extensionContext, bgTabId);

      // 未読バッジが消えることを確認
      await expect(unreadBadge).toHaveCount(0, { timeout: 10000 });

      // サイドパネルをリロード
      const currentWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      const windowId = currentWindow.id;
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // リロード後も既存タブに未読バッジが付かないことを確認
      const reloadedTabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      await expect(reloadedTabNode).toBeVisible({ timeout: 10000 });
      const reloadedUnreadBadge = reloadedTabNode.locator('[data-testid="unread-badge"]');
      await expect(reloadedUnreadBadge).toHaveCount(0, { timeout: 5000 });

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
    }
  );

  extensionTest(
    '未読状態がストレージに正しく永続化される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // バックグラウンドで新しいタブを作成
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブノードがDOMに表示されるまで待機
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // 未読バッジが表示されることを確認
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // ストレージに未読状態が保存されていることを確認
      const unreadTabs = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('unread_tabs');
        return result.unread_tabs as number[] | undefined;
      });
      expect(unreadTabs).toContain(bgTabId);

      // タブをアクティブにして既読にする
      await activateTab(extensionContext, bgTabId);

      // 未読バッジが消えることを確認
      await expect(unreadBadge).toHaveCount(0, { timeout: 10000 });

      // ストレージから未読状態が削除されていることを確認
      const unreadTabsAfter = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('unread_tabs');
        return result.unread_tabs as number[] | undefined;
      });
      expect(unreadTabsAfter || []).not.toContain(bgTabId);

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
    }
  );
});
