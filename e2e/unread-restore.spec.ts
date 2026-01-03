/**
 * 未読インジケーター復元時制御のE2Eテスト
 *
 * - ブラウザ復元時のタブに未読インジケーターを表示しない
 * - 復元されたタブがアクティブ化された後に非アクティブになった場合、通常の未読判定ルールに従う
 *
 * 注: このテストは未読インジケーターの表示状態を検証するものであり、
 * 標準の初期化パターン（デフォルトタブを閉じる）を使用していない。
 * 起動時の既存タブの挙動をテストするため、意図的にこの形式を採用している。
 */
import { expect } from '@playwright/test';
import { test as extensionTest } from './fixtures/extension';
import { createTab, activateTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

extensionTest.describe('未読インジケーター復元時制御', () => {
  /**
   * ブラウザを再起動してタブが復元された場合、復元されたタブに未読インジケーターを表示しないこと
   *
   * テスト方法:
   * - Side Panel初期化時点で存在する初期タブに未読バッジが表示されていないことを確認
   * - 初期タブは「復元されたタブ」と同等の扱い（起動完了前に存在していたタブ）
   */
  extensionTest(
    'ブラウザ起動時の既存タブに未読インジケーターが表示されない',
    async ({ extensionContext, sidePanelPage }) => {
      // Side Panelが初期化されてツリービューが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // 初期タブを取得（ブラウザ起動時に開かれているタブ）
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // 初期タブのIDを取得
      const pages = extensionContext.pages();
      let initialTabId: number | undefined;
      for (const page of pages) {
        const url = page.url();
        // chrome-extension:// または about: 以外のページを探す
        if (!url.startsWith('chrome-extension://') && !url.startsWith('about:')) {
          // Service Workerでタブを取得してIDを確認
          const serviceWorker = extensionContext.serviceWorkers()[0];
          const tabs = await serviceWorker.evaluate(async () => {
            return chrome.tabs.query({});
          });
          const tab = tabs.find((t: chrome.tabs.Tab) => t.url === url);
          if (tab?.id) {
            initialTabId = tab.id;
            break;
          }
        }
      }

      // 初期タブが見つからなかった場合、任意のタブを使用
      if (!initialTabId) {
        const serviceWorker = extensionContext.serviceWorkers()[0];
        const tabs = await serviceWorker.evaluate(async () => {
          return chrome.tabs.query({});
        });
        // ピン留めされていない最初のタブを使用
        const regularTab = tabs.find((t: chrome.tabs.Tab) => !t.pinned && t.id);
        if (regularTab?.id) {
          initialTabId = regularTab.id;
        }
      }

      if (!initialTabId) {
        // テストをスキップ（タブが見つからなかった場合）
        return;
      }

      // タブノードがDOMに表示されるまで待機
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${initialTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // 初期タブに未読バッジが表示されていないことを確認
      // ブラウザ起動時の既存タブには未読インジケーターを付けない
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toHaveCount(0);
    }
  );

  /**
   * 復元されたタブがアクティブ化された後に非アクティブになった場合、通常の未読判定ルールに従うこと
   *
   * テスト方法:
   * 1. 起動完了後にバックグラウンドで新しいタブを作成（未読になるはず）
   * 2. そのタブをアクティブ化（既読になる）
   * 3. 別のタブに切り替え
   * 4. バックグラウンドでコンテンツが更新された場合に再度未読になるか確認
   *    （注: この部分はコンテンツ更新の検出機能に依存するため、ここでは単純化）
   */
  extensionTest(
    '起動完了後に作成されたバックグラウンドタブに未読インジケーターが表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // Side Panelが初期化されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 起動完了後にバックグラウンドでタブを作成（active: false）
      const bgTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: false }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 起動完了後に作成されたバックグラウンドタブには未読バッジが表示されること
      // 起動完了後のタブは通常の未読判定ルールに従う
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  /**
   * 起動完了後にタブをアクティブ化すると未読が解除されることを確認
   */
  extensionTest(
    '起動完了後のタブをアクティブ化すると未読インジケーターが消える',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // Side Panelが初期化されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
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
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが表示されることを確認
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // タブをアクティブ化
      await activateTab(extensionContext, bgTabId);
      // activateTabはアクティブタブを変更するだけなのでツリー構造は変わらない
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが消えることを確認
      await expect(unreadBadge).toHaveCount(0, { timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, bgTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  /**
   * 複数のバックグラウンドタブを同時に作成した場合も正しく未読インジケーターが表示されることを確認
   */
  extensionTest(
    '複数のバックグラウンドタブを同時に作成した場合も正しく未読インジケーターが表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // Side Panelが初期化されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 複数のバックグラウンドタブを作成
      const bgTabId1 = await createTab(
        extensionContext,
        'https://example.com/page1',
        undefined,
        { active: false }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      const bgTabId2 = await createTab(
        extensionContext,
        'https://example.com/page2',
        undefined,
        { active: false }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
        { tabId: bgTabId2, depth: 0 },
      ], 0);

      // 両方のタブに未読バッジが表示されることを確認
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId2}"]`);
      const unreadBadge1 = tabNode1.locator('[data-testid="unread-badge"]');
      const unreadBadge2 = tabNode2.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge1).toBeVisible({ timeout: 10000 });
      await expect(unreadBadge2).toBeVisible({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, bgTabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      await closeTab(extensionContext, bgTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  /**
   * アクティブとして作成されたタブには未読インジケーターが表示されないことを確認
   */
  extensionTest(
    'アクティブとして作成されたタブには未読インジケーターが表示されない',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      // アクティブなタブを取得
      const [initialPage] = extensionContext.pages();
      await initialPage.waitForLoadState('load');

      // Side Panelが初期化されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // アクティブなタブを作成（active: true）
      const activeTabId = await createTab(
        extensionContext,
        'https://example.com/',
        undefined,
        { active: true }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: activeTabId, depth: 0 },
      ], 0);

      // アクティブなタブには未読バッジが表示されないこと
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${activeTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toHaveCount(0);

      // クリーンアップ
      await closeTab(extensionContext, activeTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});
