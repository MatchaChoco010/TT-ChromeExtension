import { test, expect } from './fixtures/extension';
import { createTab, closeTab, pinTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure, assertViewStructure } from './utils/assertion-utils';
import { waitForViewSwitcher, waitForCondition } from './utils/polling-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('UX改善機能', () => {
  test.describe('ピン留めタブの閉じるボタン非表示', () => {
    test('ピン留めタブには閉じるボタンが表示されない', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      const closeButton = pinnedTab.locator('[data-testid*="close-button"]');
      await expect(closeButton).not.toBeVisible();

      // ホバーしても閉じるボタンが表示されないことを確認（機能テスト固有の検証）
      await pinnedTab.hover();
      await expect(closeButton).not.toBeVisible();

      // クリーンアップ
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('通常タブをピン留めすると閉じるボタンが非表示になる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      const closeButtonInPinned = pinnedTab.locator('[data-testid*="close-button"]');
      await expect(closeButtonInPinned).not.toBeVisible();

      // クリーンアップ
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ビュースクロール切り替え', () => {
    test('ビューリスト上でマウスホイールを下にスクロールすると次のビューに切り替わる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証（デフォルトビューがアクティブ）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await viewSwitcher.dispatchEvent('wheel', { deltaY: 100 });

      // 次のビュー（View）がアクティブになることを確認
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);
    });

    test('ビューリスト上でマウスホイールを上にスクロールすると前のビューに切り替わる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証（デフォルトビューがアクティブ）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await newViewButton.click();
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await viewSwitcher.dispatchEvent('wheel', { deltaY: -100 });

      // 前のビュー（Default）がアクティブになることを確認
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);
    });

    test('最初のビューで上スクロールしても切り替わらない（ループしない）', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証（デフォルトビューがアクティブ）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await viewSwitcher.dispatchEvent('wheel', { deltaY: -100 });

      // デフォルトビューがまだアクティブ（変化なし）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);
    });

    test('最後のビューで下スクロールしても切り替わらない（ループしない）', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビュー追加後の構造を検証（デフォルトビューがアクティブ）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await newViewButton.click();
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

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
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

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

      await tabNode.click({ button: 'right' });

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
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('サブメニューからビューを選択するとタブがそのビューに移動する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      await waitForCondition(async () => {
        const box = await tabNode.boundingBox();
        return box !== null && box.width > 0 && box.height > 0;
      }, { timeout: 5000 });

      await tabNode.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const moveToViewItem = sidePanelPage.locator('text=別のビューへ移動');
      await moveToViewItem.hover();

      const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
      await expect(subMenu).toBeVisible({ timeout: 5000 });

      const newViewMenuItem = subMenu.locator('text=View');
      await newViewMenuItem.click();

      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await newViewButton.click();
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabId, depth: 0 },
      ], 1);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [], 1);
    });

    test('現在のビューはサブメニューに表示されない', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();

      await tabNode.click({ button: 'right' });

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
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });
});
