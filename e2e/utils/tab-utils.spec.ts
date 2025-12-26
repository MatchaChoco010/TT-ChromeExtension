/**
 * TabTestUtils Test
 *
 * TabTestUtilsの機能をテストします。
 * このテストは、ユーティリティ関数が正しく動作することを確認するためのものです。
 *
 * Requirements: 3.1, 3.13, 4.1
 */
import { test, expect } from '../fixtures/extension';
import {
  createTab,
  closeTab,
  activateTab,
  assertTabInTree,
  assertTabNotInTree,
  assertUnreadBadge,
} from './tab-utils';

test.describe('TabTestUtils', () => {
  test('createTabは新しいタブを作成し、ツリーに表示されるまで待機する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // 新しいタブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');

    // タブIDが有効であることを確認
    expect(tabId).toBeGreaterThan(0);

    // ツリーに新しいタブが表示されることを確認
    await assertTabInTree(sidePanelPage, tabId, 'Example Domain');
  });

  test('createTabは親タブを指定して子タブを作成できる', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com');

    // 子タブを作成
    const childTabId = await createTab(
      extensionContext,
      'https://example.com/child',
      parentTabId
    );

    // 両方のタブがツリーに表示されることを確認
    await assertTabInTree(sidePanelPage, parentTabId, 'Example Domain');
    await assertTabInTree(sidePanelPage, childTabId, 'Example Domain');
  });

  test('closeTabはタブを閉じ、ツリーから削除されることを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // 新しいタブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');

    // タブがツリーに表示されることを確認
    await assertTabInTree(sidePanelPage, tabId, 'Example Domain');

    // タブを閉じる
    await closeTab(extensionContext, tabId);

    // タブがツリーから削除されることを確認
    await assertTabNotInTree(sidePanelPage, tabId);
  });

  test('activateTabはタブをアクティブ化し、ツリーでハイライトされることを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // 2つのタブを作成
    const tabId1 = await createTab(extensionContext, 'https://example.com');
    const tabId2 = await createTab(extensionContext, 'https://example.org');

    // タブ2をアクティブ化
    await activateTab(extensionContext, tabId2);

    // アクティブなタブがハイライトされることを確認（bg-blue-100クラスを持つノードを検索）
    const activeNode = sidePanelPage.locator('[data-testid^="tree-node-"].bg-blue-100');
    await expect(activeNode).toBeVisible({ timeout: 5000 });
  });

  test('assertTabInTreeはツリー内のタブノードを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // 新しいタブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');

    // assertTabInTreeが正常に完了することを確認（例外が発生しない）
    await expect(
      assertTabInTree(sidePanelPage, tabId, 'Example Domain')
    ).resolves.not.toThrow();
  });

  test('assertTabNotInTreeはツリーからタブノードが削除されたことを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // 新しいタブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');

    // タブを閉じる
    await closeTab(extensionContext, tabId);

    // assertTabNotInTreeが正常に完了することを確認
    await expect(
      assertTabNotInTree(sidePanelPage, tabId)
    ).resolves.not.toThrow();
  });

  test('assertUnreadBadgeは未読バッジが表示されることを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // バックグラウンドで新しいタブを作成（未読状態）
    const tabId = await createTab(extensionContext, 'https://example.com', undefined, {
      active: false,
    });

    // 未読バッジが表示されることを確認
    await assertUnreadBadge(sidePanelPage, tabId, 1);
  });

  test('assertUnreadBadgeはタブをアクティブ化すると未読バッジが消えることを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // バックグラウンドで新しいタブを作成（未読状態）
    const tabId = await createTab(extensionContext, 'https://example.com', undefined, {
      active: false,
    });

    // 未読バッジが表示されることを確認
    await assertUnreadBadge(sidePanelPage, tabId);

    // タブをアクティブ化
    await activateTab(extensionContext, tabId);

    // 未読バッジが消えることを確認（要素が存在しないか、非表示になる）
    const unreadBadge = sidePanelPage.locator(`[data-testid="unread-badge"]`);
    // タブがアクティブ化されると未読バッジは消えるため、要素が存在しないか非表示になる
    const badgeCount = await unreadBadge.count();
    expect(badgeCount).toBe(0);
  });
});
