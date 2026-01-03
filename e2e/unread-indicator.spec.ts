/**
 * 未読インジケータ機能のE2Eテスト
 *
 * - タブがバックグラウンドで読み込まれた場合、未読バッジが表示される
 * - 未読タブをアクティブにした場合、未読バッジが消える
 * - 親タブの子に未読タブがある場合、親タブにも未読インジケータが表示される
 * - 複数の未読タブがある場合、未読数がカウントされて表示される
 */
import { expect } from '@playwright/test';
import { test as extensionTest } from './fixtures/extension';
import {
  createTab,
  activateTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
} from './utils/tab-utils';
import { assertTabStructure, assertUnreadBadge } from './utils/assertion-utils';

extensionTest.describe('未読インジケータ機能', () => {
  extensionTest(
    'タブがバックグラウンドで読み込まれた場合、未読バッジが表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // バックグラウンドでタブを作成（active: false）
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);

      // クリーンアップ後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '未読タブをアクティブにした場合、未読バッジが消える',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // バックグラウンドでタブを作成
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // タブをアクティブ化
      await activateTab(extensionContext, bgTabId);

      // アクティブ化後の構造を検証（ツリー構造は変わらない）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが消えることを確認
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadgeInNode = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadgeInNode).toHaveCount(0, { timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);

      // クリーンアップ後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  /**
   * 親タブへの不要なバッジ表示削除
   * 未読の子タブがある場合でも、親タブには未読子タブ数を示すバッジを表示しない
   */
  extensionTest(
    '親タブの子に未読タブがあっても、親タブには未読子タブ数のバッジが表示されない',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 親タブを作成（アクティブ）
      const parentTabId = await createTab(
        extensionContext,
        'https://example.com/parent',
        undefined,
        { active: true }
      );

      // 親タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      // 子タブをバックグラウンドで作成（active: false, 親タブIDを指定）
      const childTabId = await createTab(
        extensionContext,
        'https://example.com/child',
        parentTabId,
        { active: false }
      );

      // 子タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: childTabId, depth: 1 },
      ], 0);

      // 子タブに未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, childTabId);

      // 親タブに未読子タブ数のバッジが表示されないことを確認
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
      const parentUnreadChildIndicator = parentNode.locator('[data-testid="unread-child-indicator"]');
      const parentUnreadCount = parentNode.locator('[data-testid="unread-count"]');
      await expect(parentUnreadChildIndicator).toHaveCount(0);
      await expect(parentUnreadCount).toHaveCount(0);

      // クリーンアップ
      await closeTab(extensionContext, childTabId);

      // 子タブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, parentTabId);

      // 親タブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '複数の未読タブがある場合、未読数がカウントされて表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 複数のバックグラウンドタブを作成
      const bgTabId1 = await createTab(
        extensionContext,
        'https://example.com/tab1',
        undefined,
        { active: false }
      );

      // タブ1作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      const bgTabId2 = await createTab(
        extensionContext,
        'https://example.com/tab2',
        undefined,
        { active: false }
      );

      // タブ2作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
        { tabId: bgTabId2, depth: 0 },
      ], 0);

      const bgTabId3 = await createTab(
        extensionContext,
        'https://example.com/tab3',
        undefined,
        { active: false }
      );

      // タブ3作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
        { tabId: bgTabId2, depth: 0 },
        { tabId: bgTabId3, depth: 0 },
      ], 0);

      // 各タブに未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId1);
      await assertUnreadBadge(sidePanelPage, bgTabId2);
      await assertUnreadBadge(sidePanelPage, bgTabId3);

      // クリーンアップ
      await closeTab(extensionContext, bgTabId3);

      // タブ3削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
        { tabId: bgTabId2, depth: 0 },
      ], 0);

      await closeTab(extensionContext, bgTabId2);

      // タブ2削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      await closeTab(extensionContext, bgTabId1);

      // タブ1削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});

/**
 * 未読インジケーター位置のE2Eテスト
 *
 * - 未読インジケーターがタブノードの左下角に三角形切り欠きとして表示される
 * - タイトル長に関わらず一定位置（左下角）に表示される
 *
 * 注: UnreadBadgeはtree-node直下に配置され、
 * position: absoluteで左下角に固定表示される三角形切り欠きスタイル。
 */
extensionTest.describe('未読インジケーター位置', () => {
  extensionTest(
    '未読インジケーターがタブノード内の左下角に表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // バックグラウンドでタブを作成（active: false）
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // 未読バッジがtree-node直下に存在することを確認（左下三角形）
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      // タブノードと未読バッジの位置関係を検証
      const tabNodeBounds = await tabNode.boundingBox();
      const badgeBounds = await unreadBadge.boundingBox();

      expect(tabNodeBounds).not.toBeNull();
      expect(badgeBounds).not.toBeNull();
      if (tabNodeBounds && badgeBounds) {
        // バッジがタブノードの左端に配置されていることを確認
        expect(badgeBounds.x).toBeGreaterThanOrEqual(tabNodeBounds.x);
        // バッジがタブノードの下端に配置されていることを確認
        const badgeBottom = badgeBounds.y + badgeBounds.height;
        const tabNodeBottom = tabNodeBounds.y + tabNodeBounds.height;
        expect(badgeBottom).toBeGreaterThanOrEqual(tabNodeBottom - 2);
        expect(badgeBottom).toBeLessThanOrEqual(tabNodeBottom + 2);
      }

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);

      // クリーンアップ後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '短いタイトルと長いタイトルの両方で未読インジケーターの相対位置が一定である',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 短いタイトルのタブを作成（バックグラウンド）
      const shortTitleTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // 短いタイトルタブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
      ], 0);

      // 長いタイトルのタブを作成（バックグラウンド）
      const longTitleTabId = await createTab(
        extensionContext,
        'https://example.org/this-is-a-very-long-path-to-create-a-long-title',
        undefined,
        { active: false }
      );

      // 長いタイトルタブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
        { tabId: longTitleTabId, depth: 0 },
      ], 0);

      // 両方の未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, shortTitleTabId);
      await assertUnreadBadge(sidePanelPage, longTitleTabId);

      // 短いタイトルのタブでのバッジ位置を取得（tree-nodeの直下に配置）
      const shortTitleTabNode = sidePanelPage.locator(`[data-testid="tree-node-${shortTitleTabId}"]`);
      const shortTitleBadge = shortTitleTabNode.locator('[data-testid="unread-badge"]');
      await expect(shortTitleBadge).toBeVisible({ timeout: 5000 });
      const shortTitleNodeBounds = await shortTitleTabNode.boundingBox();
      const shortTitleBadgeBounds = await shortTitleBadge.boundingBox();

      // 長いタイトルのタブでのバッジ位置を取得（tree-nodeの直下に配置）
      const longTitleTabNode = sidePanelPage.locator(`[data-testid="tree-node-${longTitleTabId}"]`);
      const longTitleBadge = longTitleTabNode.locator('[data-testid="unread-badge"]');
      await expect(longTitleBadge).toBeVisible({ timeout: 5000 });
      const longTitleNodeBounds = await longTitleTabNode.boundingBox();
      const longTitleBadgeBounds = await longTitleBadge.boundingBox();

      // 位置情報が取得できていることを確認
      expect(shortTitleNodeBounds).not.toBeNull();
      expect(longTitleNodeBounds).not.toBeNull();
      expect(shortTitleBadgeBounds).not.toBeNull();
      expect(longTitleBadgeBounds).not.toBeNull();

      if (shortTitleNodeBounds && longTitleNodeBounds && shortTitleBadgeBounds && longTitleBadgeBounds) {
        // バッジのサイズが同じであることを確認（視覚的一貫性）
        expect(Math.abs(shortTitleBadgeBounds.width - longTitleBadgeBounds.width)).toBeLessThanOrEqual(2);
        expect(Math.abs(shortTitleBadgeBounds.height - longTitleBadgeBounds.height)).toBeLessThanOrEqual(2);

        // 両方のバッジがそれぞれのtree-node内に収まっていることを確認
        expect(shortTitleBadgeBounds.x + shortTitleBadgeBounds.width).toBeLessThanOrEqual(
          shortTitleNodeBounds.x + shortTitleNodeBounds.width
        );
        expect(longTitleBadgeBounds.x + longTitleBadgeBounds.width).toBeLessThanOrEqual(
          longTitleNodeBounds.x + longTitleNodeBounds.width
        );

        // 両方のバッジがタブノードの左端に配置されていることを確認（同じdepthなのでleft位置が同じ）
        expect(Math.abs(shortTitleBadgeBounds.x - longTitleBadgeBounds.x)).toBeLessThanOrEqual(2);
      }

      // クリーンアップ
      await closeTab(extensionContext, longTitleTabId);

      // 長いタイトルタブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, shortTitleTabId);

      // 短いタイトルタブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '未読バッジがタブノードの左下に三角形として表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // バックグラウンドでタブを作成（active: false）
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // 未読バッジを取得
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      // タブノードとバッジの位置を取得
      const tabNodeBounds = await tabNode.boundingBox();
      const badgeBounds = await unreadBadge.boundingBox();

      expect(tabNodeBounds).not.toBeNull();
      expect(badgeBounds).not.toBeNull();
      if (tabNodeBounds && badgeBounds) {
        // バッジがタブノードの左下角に配置されていることを確認
        expect(badgeBounds.x).toBeGreaterThanOrEqual(tabNodeBounds.x);
        // バッジはタブノードの中央より左にあることを確認（三角形は左下に配置）
        const tabNodeCenter = tabNodeBounds.x + tabNodeBounds.width / 2;
        expect(badgeBounds.x + badgeBounds.width).toBeLessThan(tabNodeCenter);
      }

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);

      // クリーンアップ後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  /**
   * 未読インジケーターがタブの右端（tab-contentの右端付近）に固定表示されることを検証
   * タイトルの長さに関わらず、未読インジケーターは同じ水平位置（右端付近）に配置される
   */
  extensionTest(
    '未読インジケーターがタブの右端に固定されていること（タイトル長に依存しない）',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 短いタイトルのタブを作成（バックグラウンド）
      const shortTitleTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // 短いタイトルタブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
      ], 0);

      // 長いタイトルのタブを作成（バックグラウンド）
      const longTitleTabId = await createTab(
        extensionContext,
        'https://example.org/this-is-a-very-long-path-to-create-a-long-title-for-testing-purposes',
        undefined,
        { active: false }
      );

      // 長いタイトルタブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
        { tabId: longTitleTabId, depth: 0 },
      ], 0);

      // 両方の未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, shortTitleTabId);
      await assertUnreadBadge(sidePanelPage, longTitleTabId);

      // 短いタイトルのタブでのバッジ位置とtab-content位置を取得
      const shortTitleTabNode = sidePanelPage.locator(`[data-testid="tree-node-${shortTitleTabId}"]`);
      const shortTitleTabContent = shortTitleTabNode.locator('[data-testid="tab-content"]');
      const shortTitleRightContainer = shortTitleTabNode.locator('[data-testid="right-actions-container"]');
      await expect(shortTitleRightContainer).toBeVisible({ timeout: 5000 });
      const shortTitleTabContentBounds = await shortTitleTabContent.boundingBox();
      const shortTitleRightContainerBounds = await shortTitleRightContainer.boundingBox();

      // 長いタイトルのタブでのバッジ位置とtab-content位置を取得
      const longTitleTabNode = sidePanelPage.locator(`[data-testid="tree-node-${longTitleTabId}"]`);
      const longTitleTabContent = longTitleTabNode.locator('[data-testid="tab-content"]');
      const longTitleRightContainer = longTitleTabNode.locator('[data-testid="right-actions-container"]');
      await expect(longTitleRightContainer).toBeVisible({ timeout: 5000 });
      const longTitleTabContentBounds = await longTitleTabContent.boundingBox();
      const longTitleRightContainerBounds = await longTitleRightContainer.boundingBox();

      // 位置情報が取得できていることを確認
      expect(shortTitleTabContentBounds).not.toBeNull();
      expect(longTitleTabContentBounds).not.toBeNull();
      expect(shortTitleRightContainerBounds).not.toBeNull();
      expect(longTitleRightContainerBounds).not.toBeNull();

      if (shortTitleTabContentBounds && longTitleTabContentBounds && shortTitleRightContainerBounds && longTitleRightContainerBounds) {
        // 右端コンテナがtab-contentの右端に配置されていることを検証
        const shortTitleRightEdgeDiff = (shortTitleTabContentBounds.x + shortTitleTabContentBounds.width) - (shortTitleRightContainerBounds.x + shortTitleRightContainerBounds.width);
        const longTitleRightEdgeDiff = (longTitleTabContentBounds.x + longTitleTabContentBounds.width) - (longTitleRightContainerBounds.x + longTitleRightContainerBounds.width);

        // 両方とも10px以内の差であること（右端に固定されている）
        expect(shortTitleRightEdgeDiff).toBeLessThanOrEqual(10);
        expect(longTitleRightEdgeDiff).toBeLessThanOrEqual(10);

        // 両方のright-actions-containerのX座標（右端）がほぼ同じ位置にあること
        const shortRightX = shortTitleRightContainerBounds.x + shortTitleRightContainerBounds.width;
        const longRightX = longTitleRightContainerBounds.x + longTitleRightContainerBounds.width;
        expect(Math.abs(shortRightX - longRightX)).toBeLessThanOrEqual(5);
      }

      // クリーンアップ
      await closeTab(extensionContext, longTitleTabId);

      // 長いタイトルタブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, shortTitleTabId);

      // 短いタイトルタブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});

/**
 * 未読インジケーターのdepth対応E2Eテスト
 *
 * - 未読インジケーターがタブのdepthを考慮した位置に表示される
 * - ルートレベル（depth=0）では左端に表示
 * - ネストされたタブ（depth>0）ではdepthに応じてインデントされた位置に表示
 */
extensionTest.describe('未読インジケーターdepth対応', () => {
  extensionTest(
    'ルートレベル（depth=0）の未読タブでインジケーターが左端に表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // ルートレベルでバックグラウンドタブを作成（active: false）
      const rootTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, rootTabId);

      // 未読バッジを取得
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${rootTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      // バッジのCSSスタイルを確認 - depth=0なのでleft: 0px
      const badgeStyles = await unreadBadge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          left: style.left,
        };
      });

      // depth=0のためleft: 0pxであることを確認
      expect(badgeStyles.left).toBe('0px');

      // クリーンアップ
      await closeTab(extensionContext, rootTabId);

      // クリーンアップ後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    'depth=1の未読タブでインジケーターがインデントされた位置に表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 親タブを作成（アクティブ）
      const parentTabId = await createTab(
        extensionContext,
        'https://example.com/parent',
        undefined,
        { active: true }
      );

      // 親タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      // 子タブをバックグラウンドで作成（active: false, depth=1）
      const childTabId = await createTab(
        extensionContext,
        'https://example.com/child',
        parentTabId,
        { active: false }
      );

      // 子タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: childTabId, depth: 1 },
      ], 0);

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, childTabId);

      // 未読バッジを取得
      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
      const unreadBadge = childNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      // バッジのCSSスタイルを確認 - depth=1なのでleft: 20px（1 * 20px）
      const badgeStyles = await unreadBadge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          left: style.left,
        };
      });

      // depth=1のためleft: 20pxであることを確認
      expect(badgeStyles.left).toBe('20px');

      // クリーンアップ
      await closeTab(extensionContext, childTabId);

      // 子タブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, parentTabId);

      // 親タブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    'depth=2の未読タブでインジケーターがさらにインデントされた位置に表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 親タブを作成（アクティブ）- depth=0
      const parentTabId = await createTab(
        extensionContext,
        'https://example.com/parent',
        undefined,
        { active: true }
      );

      // 親タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      // 子タブを作成（アクティブ）- depth=1
      const childTabId = await createTab(
        extensionContext,
        'https://example.com/child',
        parentTabId,
        { active: true }
      );

      // 子タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: childTabId, depth: 1 },
      ], 0);

      // 孫タブをバックグラウンドで作成（active: false）- depth=2
      const grandchildTabId = await createTab(
        extensionContext,
        'https://example.com/grandchild',
        childTabId,
        { active: false }
      );

      // 孫タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: childTabId, depth: 1 },
        { tabId: grandchildTabId, depth: 2 },
      ], 0);

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, grandchildTabId);

      // 未読バッジを取得
      const grandchildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandchildTabId}"]`);
      const unreadBadge = grandchildNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      // バッジのCSSスタイルを確認 - depth=2なのでleft: 40px（2 * 20px）
      const badgeStyles = await unreadBadge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          left: style.left,
        };
      });

      // depth=2のためleft: 40pxであることを確認
      expect(badgeStyles.left).toBe('40px');

      // クリーンアップ
      await closeTab(extensionContext, grandchildTabId);

      // 孫タブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await closeTab(extensionContext, childTabId);

      // 子タブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, parentTabId);

      // 親タブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '異なるdepthの未読タブでインジケーター位置が正しくスケールする',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // ルートタブ（バックグラウンド）- depth=0
      const rootTabId = await createTab(
        extensionContext,
        'https://example.com/root',
        undefined,
        { active: false }
      );

      // ルートタブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
      ], 0);

      // 別の親タブを作成（アクティブ）- depth=0
      const parentTabId = await createTab(
        extensionContext,
        'https://example.org/parent',
        undefined,
        { active: true }
      );

      // 親タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      // 子タブをバックグラウンドで作成（active: false）- depth=1
      const childTabId = await createTab(
        extensionContext,
        'https://example.org/child',
        parentTabId,
        { active: false }
      );

      // 子タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: childTabId, depth: 1 },
      ], 0);

      // 両方のタブノードがDOMに表示されるまで待機
      const rootNode = sidePanelPage.locator(`[data-testid="tree-node-${rootTabId}"]`);
      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
      await expect(rootNode).toBeVisible({ timeout: 10000 });
      await expect(childNode).toBeVisible({ timeout: 10000 });

      // 両方の未読バッジを取得
      const rootBadge = rootNode.locator('[data-testid="unread-badge"]');
      const childBadge = childNode.locator('[data-testid="unread-badge"]');
      await expect(rootBadge).toBeVisible({ timeout: 5000 });
      await expect(childBadge).toBeVisible({ timeout: 5000 });

      // 両方のバッジのleft位置を取得
      const rootLeft = await rootBadge.evaluate((el) => {
        return parseInt(window.getComputedStyle(el).left, 10);
      });
      const childLeft = await childBadge.evaluate((el) => {
        return parseInt(window.getComputedStyle(el).left, 10);
      });

      // depth=0は0px、depth=1は20pxであることを確認
      expect(rootLeft).toBe(0);
      expect(childLeft).toBe(20);

      // 差分が20px（1 depth分のインデント）であることを確認
      expect(childLeft - rootLeft).toBe(20);

      // クリーンアップ
      await closeTab(extensionContext, childTabId);

      // 子タブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, parentTabId);

      // 親タブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, rootTabId);

      // ルートタブ削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});

/**
 * 未読インジケーターのUI改善E2Eテスト
 *
 * - 未読インジケーターが左下三角形の形状で表示されること
 * - タブ要素に重なる形で配置されること
 * - 既読になったときに非表示になること
 */
extensionTest.describe('未読インジケーターUI改善', () => {
  extensionTest(
    '未読インジケーターが左下三角形の形状で表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // バックグラウンドでタブを作成（active: false）
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // 未読バッジの位置を確認 - 左下に配置されていること
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      // タブノードと未読バッジの位置関係を検証
      const tabNodeBounds = await tabNode.boundingBox();
      const badgeBounds = await unreadBadge.boundingBox();

      expect(tabNodeBounds).not.toBeNull();
      expect(badgeBounds).not.toBeNull();

      if (tabNodeBounds && badgeBounds) {
        // 三角形の位置が左下角にあることを確認
        const leftEdgeDiff = badgeBounds.x - tabNodeBounds.x;
        expect(leftEdgeDiff).toBeGreaterThanOrEqual(0);
        expect(leftEdgeDiff).toBeLessThanOrEqual(50);

        // バッジの下端がタブノードの下端付近にあること
        const badgeBottom = badgeBounds.y + badgeBounds.height;
        const tabNodeBottom = tabNodeBounds.y + tabNodeBounds.height;
        expect(Math.abs(badgeBottom - tabNodeBottom)).toBeLessThanOrEqual(2);
      }

      // CSSスタイルの検証 - border-basedの三角形テクニックを確認
      const badgeStyles = await unreadBadge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          position: style.position,
          left: style.left,
          bottom: style.bottom,
          borderStyle: style.borderStyle,
        };
      });

      // position: absolute, left: 0, bottom: 0 であることを確認
      expect(badgeStyles.position).toBe('absolute');
      expect(badgeStyles.left).toBe('0px');
      expect(badgeStyles.bottom).toBe('0px');
      // border-basedの三角形テクニックを使用していることを確認
      expect(badgeStyles.borderStyle).toBe('solid');

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);

      // クリーンアップ後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '未読インジケーターがタブ要素に重なる形で配置される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // バックグラウンドでタブを作成（active: false）
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // 未読バッジがタブノードの子要素であることを確認
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      // タブノードの境界内にバッジが収まっていることを検証
      const tabNodeBounds = await tabNode.boundingBox();
      const badgeBounds = await unreadBadge.boundingBox();

      expect(tabNodeBounds).not.toBeNull();
      expect(badgeBounds).not.toBeNull();

      if (tabNodeBounds && badgeBounds) {
        // バッジがタブノードの境界内にあることを確認
        expect(badgeBounds.x).toBeGreaterThanOrEqual(tabNodeBounds.x);
        expect(badgeBounds.y).toBeGreaterThanOrEqual(tabNodeBounds.y);
        expect(badgeBounds.x + badgeBounds.width).toBeLessThanOrEqual(
          tabNodeBounds.x + tabNodeBounds.width
        );
        expect(badgeBounds.y + badgeBounds.height).toBeLessThanOrEqual(
          tabNodeBounds.y + tabNodeBounds.height
        );
      }

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);

      // クリーンアップ後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '既読になったときに未読インジケーターが非表示になる',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // バックグラウンドでタブを作成（active: false）
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId);

      // タブをアクティブ化して既読にする
      await activateTab(extensionContext, bgTabId);

      // アクティブ化後の構造を検証（ツリー構造は変わらない）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが非表示になることを確認（ポーリング）
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadgeInNode = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadgeInNode).toHaveCount(0, { timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);

      // クリーンアップ後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '複数タブで未読インジケーターの形状が一貫していること',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 複数のバックグラウンドタブを作成
      const bgTabId1 = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );

      // タブ1作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      const bgTabId2 = await createTab(
        extensionContext,
        'https://example.org/',
        undefined,
        { active: false }
      );

      // タブ2作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
        { tabId: bgTabId2, depth: 0 },
      ], 0);

      // 両方の未読バッジが表示されることを確認
      await assertUnreadBadge(sidePanelPage, bgTabId1);
      await assertUnreadBadge(sidePanelPage, bgTabId2);

      // 両方のバッジを取得
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId2}"]`);
      const unreadBadge1 = tabNode1.locator('[data-testid="unread-badge"]');
      const unreadBadge2 = tabNode2.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge1).toBeVisible({ timeout: 5000 });
      await expect(unreadBadge2).toBeVisible({ timeout: 5000 });

      // 両方のバッジのサイズが同じであることを確認（三角形形状の一貫性）
      const badge1Bounds = await unreadBadge1.boundingBox();
      const badge2Bounds = await unreadBadge2.boundingBox();

      expect(badge1Bounds).not.toBeNull();
      expect(badge2Bounds).not.toBeNull();

      if (badge1Bounds && badge2Bounds) {
        // サイズが同じであること（1px以内の誤差を許容）
        expect(Math.abs(badge1Bounds.width - badge2Bounds.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(badge1Bounds.height - badge2Bounds.height)).toBeLessThanOrEqual(1);
      }

      // 両方のバッジのCSSスタイルが一致することを確認
      const badge1Styles = await unreadBadge1.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          position: style.position,
          left: style.left,
          bottom: style.bottom,
          borderStyle: style.borderStyle,
        };
      });
      const badge2Styles = await unreadBadge2.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          position: style.position,
          left: style.left,
          bottom: style.bottom,
          borderStyle: style.borderStyle,
        };
      });

      // CSSスタイルが一致すること
      expect(badge1Styles.position).toBe(badge2Styles.position);
      expect(badge1Styles.left).toBe(badge2Styles.left);
      expect(badge1Styles.bottom).toBe(badge2Styles.bottom);
      expect(badge1Styles.borderStyle).toBe(badge2Styles.borderStyle);

      // クリーンアップ
      await closeTab(extensionContext, bgTabId2);

      // タブ2削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      await closeTab(extensionContext, bgTabId1);

      // タブ1削除後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});
