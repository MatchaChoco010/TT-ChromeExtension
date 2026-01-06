import { test, expect } from './fixtures/extension';
import { createTab, closeTab, pinTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure, assertViewStructure } from './utils/assertion-utils';
import { waitForViewSwitcher, waitForCondition } from './utils/polling-utils';

test.describe('UX改善機能', () => {
  test.describe('ピン留めタブの閉じるボタン非表示', () => {
    test('ピン留めタブには閉じるボタンが表示されない', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブを作成
      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      // ピン留めタブ内に閉じるボタンが存在しないことを確認（機能テスト固有の検証）
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      const closeButton = pinnedTab.locator('[data-testid*="close-button"]');
      await expect(closeButton).not.toBeVisible();

      // ホバーしても閉じるボタンが表示されないことを確認（機能テスト固有の検証）
      await pinnedTab.hover();
      await expect(closeButton).not.toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('通常タブをピン留めすると閉じるボタンが非表示になる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブを作成
      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      // ピン留めタブセクションにあるタブには閉じるボタンがないことを確認（機能テスト固有の検証）
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      const closeButtonInPinned = pinnedTab.locator('[data-testid*="close-button"]');
      await expect(closeButtonInPinned).not.toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ビュースクロール切り替え', () => {
    test('ビューリスト上でマウスホイールを下にスクロールすると次のビューに切り替わる', async ({
      serviceWorker,
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const windowId = await getCurrentWindowId(serviceWorker);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証（デフォルトビューがアクティブ）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      // ビュースイッチャーコンテナを取得してマウスホイールイベントを発火（下スクロール）
      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await viewSwitcher.dispatchEvent('wheel', { deltaY: 100 });

      // 次のビュー（View）がアクティブになることを確認
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);
    });

    test('ビューリスト上でマウスホイールを上にスクロールすると前のビューに切り替わる', async ({
      serviceWorker,
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const windowId = await getCurrentWindowId(serviceWorker);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証（デフォルトビューがアクティブ）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      // 新しいビューに切り替え
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await newViewButton.click();
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      // ビュースイッチャーコンテナを取得してマウスホイールイベントを発火（上スクロール）
      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await viewSwitcher.dispatchEvent('wheel', { deltaY: -100 });

      // 前のビュー（Default）がアクティブになることを確認
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);
    });

    test('最初のビューで上スクロールしても切り替わらない（ループしない）', async ({
      serviceWorker,
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const windowId = await getCurrentWindowId(serviceWorker);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証（デフォルトビューがアクティブ）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      // ビュースイッチャーコンテナを取得してマウスホイールイベントを発火（上スクロール）
      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await viewSwitcher.dispatchEvent('wheel', { deltaY: -100 });

      // デフォルトビューがまだアクティブ（変化なし）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);
    });

    test('最後のビューで下スクロールしても切り替わらない（ループしない）', async ({
      serviceWorker,
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const windowId = await getCurrentWindowId(serviceWorker);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証（デフォルトビューがアクティブ）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      // 新しいビューに切り替え
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await newViewButton.click();
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      // ビュースイッチャーコンテナを取得してマウスホイールイベントを発火（下スクロール）
      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await viewSwitcher.dispatchEvent('wheel', { deltaY: 100 });

      // Viewがまだアクティブ（変化なし）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);
    });
  });

  test.describe('サブメニュー操作 - 別のビューへ移動', () => {
    test('タブのコンテキストメニューで「別のビューへ移動」にホバーするとサブメニューが表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 最初にタブを作成（ビュー追加前）
      const tabId = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // 新しいビューを追加（サブメニューを表示するには2つ以上のビューが必要）
      await waitForViewSwitcher(sidePanelPage);
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 要素のバウンディングボックスが安定するまで待機
      await waitForCondition(async () => {
        const box = await tabNode.boundingBox();
        return box !== null && box.width > 0 && box.height > 0;
      }, { timeout: 5000 });

      // 右クリックでコンテキストメニューを開く
      await tabNode.click({ button: 'right' });

      // コンテキストメニュー操作（機能テスト固有の検証）
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const moveToViewItem = sidePanelPage.locator('text=別のビューへ移動');
      await expect(moveToViewItem).toBeVisible({ timeout: 5000 });
      await moveToViewItem.hover();

      // サブメニューが表示され、Viewが存在することを確認（機能テスト固有の検証）
      const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
      await expect(subMenu).toBeVisible({ timeout: 5000 });
      const subMenuItem = subMenu.locator('text=View');
      await expect(subMenuItem).toBeVisible();

      // クリーンアップ: メニューを閉じてからタブを閉じる
      await sidePanelPage.keyboard.press('Escape');
      await expect(contextMenu).not.toBeVisible({ timeout: 2000 });
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('サブメニューからビューを選択するとタブがそのビューに移動する', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 最初にタブを作成（ビュー追加前）
      const tabId = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // 新しいビューを追加
      await waitForViewSwitcher(sidePanelPage);
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 要素のバウンディングボックスが安定するまで待機
      await waitForCondition(async () => {
        const box = await tabNode.boundingBox();
        return box !== null && box.width > 0 && box.height > 0;
      }, { timeout: 5000 });

      // 右クリックでコンテキストメニューを開く
      await tabNode.click({ button: 'right' });

      // コンテキストメニュー操作（機能テスト固有の検証）
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const moveToViewItem = sidePanelPage.locator('text=別のビューへ移動');
      await moveToViewItem.hover();

      const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
      await expect(subMenu).toBeVisible({ timeout: 5000 });

      // サブメニュー内の "View" をクリック
      const newViewMenuItem = subMenu.locator('text=View');
      await newViewMenuItem.click();

      // コンテキストメニューが閉じることを確認（機能テスト固有の検証）
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Viewに切り替え、タブがViewに移動していることを確認
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await newViewButton.click();
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      // タブがViewに移動していることを確認
      // 注意: pseudoSidePanelTabIdはオリジナルビュー（index 0）に残り、
      // tabIdのみがView（index 1）に移動する
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabId, depth: 0 },
      ], 1);

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [], 1);
    });

    test('現在のビューはサブメニューに表示されない', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 最初にタブを作成（ビュー追加前）
      const tabId = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // 新しいビューを追加
      await waitForViewSwitcher(sidePanelPage);
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();

      // 右クリックでコンテキストメニューを開く
      await tabNode.click({ button: 'right' });

      // コンテキストメニュー操作（機能テスト固有の検証）
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const moveToViewItem = sidePanelPage.locator('text=別のビューへ移動');
      await moveToViewItem.hover();

      const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
      await expect(subMenu).toBeVisible({ timeout: 5000 });

      // サブメニュー内に "Default"（現在のビュー）が表示されていないことを確認（機能テスト固有の検証）
      const defaultMenuItem = subMenu.locator('button:has-text("Default")');
      await expect(defaultMenuItem).not.toBeVisible();

      // クリーンアップ: メニューを閉じてからタブを閉じる
      await sidePanelPage.keyboard.press('Escape');
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });
});
