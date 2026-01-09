/**
 * 注: このテストは未読インジケーターの表示状態を検証するものであり、
 * 一部のテストでは標準の初期化パターン（デフォルトタブを閉じる）を使用していない。
 * 起動時の既存タブの挙動をテストするため、意図的にこの形式を採用している。
 */
import { expect } from '@playwright/test';
import { test as extensionTest } from './fixtures/extension';
import { createTab, closeTab, activateTab, getCurrentWindowId, getPseudoSidePanelTabId, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

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
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);


      // 初期状態では未読バッジがないことを確認
      const initialUnreadBadges = sidePanelPage.locator('[data-testid="unread-badge"]');
      await expect(initialUnreadBadges).toHaveCount(0, { timeout: 5000 });

      // バックグラウンドで新しいタブを作成
      const bgTabId = await createTab(
      serviceWorker,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 新しいタブには未読バッジが表示されることを確認
      // assertTabStructureでタブの存在は検証済み
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // クリーンアップ
      await closeTab(serviceWorker, bgTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    'アクティブ状態で新しいタブを開くと未読インジケーターが表示されない',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // ツリーが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);


      // アクティブ状態で新しいタブを作成
      const activeTabId = await createTab(
      serviceWorker,
        getTestServerUrl('/page'),
        undefined,
        { active: true }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: activeTabId, depth: 0 },
      ], 0);

      // アクティブなタブには未読バッジが表示されないことを確認
      // assertTabStructureでタブの存在は検証済み
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${activeTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toHaveCount(0, { timeout: 5000 });

      // クリーンアップ
      await closeTab(serviceWorker, activeTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
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

      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);


      // バックグラウンドで新しいタブを作成（未読状態になる）
      const bgTabId = await createTab(
      serviceWorker,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      // assertTabStructureでタブの存在は検証済み
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // タブをアクティブにして既読にする
      await activateTab(serviceWorker, bgTabId);
      // activateTabはアクティブタブを変更するだけなのでツリー構造は変わらない
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが消えることを確認
      await expect(unreadBadge).toHaveCount(0, { timeout: 10000 });

      // サイドパネルをリロード
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // リロード後のツリー構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // リロード後も既存タブに未読バッジが付かないことを確認
      // assertTabStructureでタブの存在は検証済み
      const reloadedTabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const reloadedUnreadBadge = reloadedTabNode.locator('[data-testid="unread-badge"]');
      await expect(reloadedUnreadBadge).toHaveCount(0, { timeout: 5000 });

      // クリーンアップ
      await closeTab(serviceWorker, bgTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
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

      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);


      // バックグラウンドで新しいタブを作成
      const bgTabId = await createTab(
      serviceWorker,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      // assertTabStructureでタブの存在は検証済み
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // ストレージに未読状態が保存されていることを確認（永続化テスト固有の検証）
      const unreadTabs = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('unread_tabs');
        return result.unread_tabs as number[] | undefined;
      });
      expect(unreadTabs).toContain(bgTabId);

      // タブをアクティブにして既読にする
      await activateTab(serviceWorker, bgTabId);
      // activateTabはアクティブタブを変更するだけなのでツリー構造は変わらない
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが消えることを確認
      await expect(unreadBadge).toHaveCount(0, { timeout: 10000 });

      // ストレージから未読状態が削除されていることを確認（永続化テスト固有の検証）
      const unreadTabsAfter = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('unread_tabs');
        return result.unread_tabs as number[] | undefined;
      });
      expect(unreadTabsAfter || []).not.toContain(bgTabId);

      // クリーンアップ
      await closeTab(serviceWorker, bgTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});
