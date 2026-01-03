/**
 * TabTestUtils Test
 *
 * TabTestUtilsの機能をテストします。
 * このテストは、ユーティリティ関数が正しく動作することを確認するためのものです。
 */
import { test, expect } from '../fixtures/extension';
import {
  createTab,
  closeTab,
  activateTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
} from './tab-utils';
import { assertTabStructure, assertUnreadBadge } from './assertion-utils';

test.describe('TabTestUtils', () => {
  test('createTabは新しいタブを作成し、ツリーに表示されるまで待機する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 新しいタブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');

    // タブIDが有効であることを確認
    expect(tabId).toBeGreaterThan(0);

    // ツリーに新しいタブが表示されることを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);
  });

  test('createTabは親タブを指定して子タブを作成できる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    // 子タブを作成
    const childTabId = await createTab(
      extensionContext,
      'https://example.com/child',
      parentTabId
    );

    // 両方のタブがツリーに表示されることを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0);
  });

  test('closeTabはタブを閉じ、ツリーから削除されることを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 新しいタブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');

    // タブがツリーに表示されることを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // タブを閉じる
    await closeTab(extensionContext, tabId);

    // タブがツリーから削除されることを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('activateTabはタブをアクティブ化し、ツリーでハイライトされることを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 2つのタブを作成
    const tabId1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'https://example.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    // タブ2をアクティブ化
    await activateTab(extensionContext, tabId2);

    // 特定のタブ（tabId2）がハイライトされることを確認
    // ポーリングでUI更新を待機
    // ダークテーマ対応により、アクティブタブのハイライトクラスはbg-gray-600に変更
    const activeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"].bg-gray-600`);
    await expect(activeNode).toBeVisible({ timeout: 10000 });
  });

  test('assertTabStructureはツリー内のタブ構造を検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 新しいタブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');

    // assertTabStructureが正常に完了することを確認（例外が発生しない）
    await expect(
      assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0)
    ).resolves.not.toThrow();
  });

  test('assertTabStructureはツリーからタブノードが削除されたことを検証できる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 新しいタブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // タブを閉じる
    await closeTab(extensionContext, tabId);

    // assertTabStructureでタブが削除されたことを確認
    await expect(
      assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0)
    ).resolves.not.toThrow();
  });

  test('assertUnreadBadgeは未読バッジが表示されることを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // バックグラウンドで新しいタブを作成（未読状態）
    const tabId = await createTab(extensionContext, 'https://example.com', undefined, {
      active: false,
    });

    // タブがツリーに表示されるまで待機
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // 未読バッジが表示されることを確認
    // 注: 現在の実装ではドット表示のみで、数字表示はサポートされていないため、
    // expectedCountは渡さずにバッジの存在のみを確認する
    await assertUnreadBadge(sidePanelPage, tabId);
  });

  test('assertUnreadBadgeはタブをアクティブ化すると未読バッジが消えることを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // バックグラウンドで新しいタブを作成（未読状態）
    const tabId = await createTab(extensionContext, 'https://example.com', undefined, {
      active: false,
    });

    // タブがツリーに表示されるまで待機
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // 未読バッジが表示されることを確認
    await assertUnreadBadge(sidePanelPage, tabId);

    // タブをアクティブ化
    await activateTab(extensionContext, tabId);

    // タブノード内の未読バッジが消えることを確認
    // 特定のタブノード内のバッジを対象にする
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
    const unreadBadge = tabNode.locator(`[data-testid="unread-badge"]`);
    // タブがアクティブ化されると未読バッジは消えるため、要素が存在しないか非表示になる
    // UI更新を待つためにポーリングで確認（タイムアウト延長）
    await expect(unreadBadge).not.toBeVisible({ timeout: 10000 });
  });
});
