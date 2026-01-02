/**
 * UX改善機能のE2Eテスト
 *
 * テスト対象:
 * 1. ピン留めタブの閉じるボタン非表示確認
 * 2. ビュースクロール切り替えテスト
 * 3. サブメニュー操作テスト
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import { waitForViewSwitcher } from './utils/polling-utils';

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

      // タブを作成
      const tabId = await createTab(extensionContext, 'https://example.com');

      // タブをピン留め
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      }, tabId);

      // ピン留め状態が更新されるまでポーリングで待機
      await serviceWorker.evaluate(async (tabId: number) => {
        for (let i = 0; i < 50; i++) {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (tab.pinned) {
              return;
            }
          } catch {
            // タブが存在しない場合は無視
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }, tabId);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めタブが表示されることを確認
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTab).toBeVisible();

      // ピン留めタブ内に閉じるボタンが存在しないことを確認
      const closeButton = pinnedTab.locator('[data-testid*="close-button"]');
      await expect(closeButton).not.toBeVisible();

      // ホバーしても閉じるボタンが表示されないことを確認
      await pinnedTab.hover();
      await expect(closeButton).not.toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });

    test('通常タブをピン留めすると閉じるボタンが非表示になる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // タブを作成
      const tabId = await createTab(extensionContext, 'https://example.com');

      // 通常タブとしてツリーに表示されるまで待機
      await expect(async () => {
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        await expect(treeNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // タブをピン留め
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      }, tabId);

      // ピン留めタブセクションに移動されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めタブセクションにあるタブには閉じるボタンがない
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      const closeButtonInPinned = pinnedTab.locator('[data-testid*="close-button"]');
      await expect(closeButtonInPinned).not.toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });
  });

  test.describe('ビュースクロール切り替え', () => {
    test('ビューリスト上でマウスホイールを下にスクロールすると次のビューに切り替わる', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // デフォルトビューがアクティブであることを確認
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // ビュースイッチャーコンテナを取得
      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await expect(viewSwitcher).toBeVisible();

      // マウスホイールイベントを発火（下スクロール）
      await viewSwitcher.dispatchEvent('wheel', { deltaY: 100 });

      // 次のビュー（New View）がアクティブになることを確認
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });
      await expect(defaultViewButton).toHaveAttribute('data-active', 'false', { timeout: 5000 });
    });

    test('ビューリスト上でマウスホイールを上にスクロールすると前のビューに切り替わる', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // ビュースイッチャーコンテナを取得
      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await expect(viewSwitcher).toBeVisible();

      // マウスホイールイベントを発火（上スクロール）
      await viewSwitcher.dispatchEvent('wheel', { deltaY: -100 });

      // 前のビュー（Default）がアクティブになることを確認
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });
      await expect(newViewButton).toHaveAttribute('data-active', 'false', { timeout: 5000 });
    });

    test('最初のビューで上スクロールしても切り替わらない（ループしない）', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // デフォルトビューがアクティブであることを確認
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // ビュースイッチャーコンテナを取得
      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await expect(viewSwitcher).toBeVisible();

      // マウスホイールイベントを発火（上スクロール）
      await viewSwitcher.dispatchEvent('wheel', { deltaY: -100 });

      // デフォルトビューがまだアクティブ（変化なし）
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });
    });

    test('最後のビューで下スクロールしても切り替わらない（ループしない）', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // ビュースイッチャーコンテナを取得
      const viewSwitcher = sidePanelPage.locator('[data-testid="view-switcher-container"]');
      await expect(viewSwitcher).toBeVisible();

      // マウスホイールイベントを発火（下スクロール）
      await viewSwitcher.dispatchEvent('wheel', { deltaY: 100 });

      // New Viewがまだアクティブ（変化なし）
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });
    });
  });

  test.describe('サブメニュー操作 - 別のビューへ移動', () => {
    test('タブのコンテキストメニューで「別のビューへ移動」にホバーするとサブメニューが表示される', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 最初にタブを作成（ビュー追加前）
      // 注意: TreeStateManager.persistState()はviewsを空配列で上書きするため、
      // タブ作成後にビューを追加する順序にすることで、ビューがリセットされるのを回避
      const tabId = await createTab(extensionContext, 'about:blank');

      // タブノードが表示されるまで待機
      await expect(async () => {
        const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        await expect(tabNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 新しいビューを追加（サブメニューを表示するには2つ以上のビューが必要）
      await waitForViewSwitcher(sidePanelPage);
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // ビューの追加が完了するまで少し待機
      await sidePanelPage.waitForTimeout(500);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 要素のバウンディングボックスが安定するまで待機
      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId,
        { timeout: 5000 }
      );

      // 右クリックでコンテキストメニューを開く
      await tabNode.click({ button: 'right' });

      // コンテキストメニューが表示されることを確認
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「別のビューへ移動」項目を探す
      const moveToViewItem = sidePanelPage.locator('text=別のビューへ移動');
      await expect(moveToViewItem).toBeVisible({ timeout: 5000 });

      // 「別のビューへ移動」にホバー
      await moveToViewItem.hover();

      // サブメニューが表示されることを確認
      const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
      await expect(subMenu).toBeVisible({ timeout: 5000 });

      // サブメニュー内に "New View" が表示されていることを確認
      const subMenuItem = subMenu.locator('text=New View');
      await expect(subMenuItem).toBeVisible();

      // クリーンアップ: メニューを閉じてからタブを閉じる
      await sidePanelPage.keyboard.press('Escape');
      await expect(contextMenu).not.toBeVisible({ timeout: 2000 });
      await closeTab(extensionContext, tabId);
    });

    test('サブメニューからビューを選択するとタブがそのビューに移動する', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 最初にタブを作成（ビュー追加前）
      // 注意: TreeStateManager.persistState()はviewsを空配列で上書きするため、
      // タブ作成後にビューを追加する順序にすることで、ビューがリセットされるのを回避
      const tabId = await createTab(extensionContext, 'about:blank');

      // タブノードが表示されるまで待機
      await expect(async () => {
        const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        await expect(tabNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 新しいビューを追加
      await waitForViewSwitcher(sidePanelPage);
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // ビューの追加が完了するまで少し待機
      await sidePanelPage.waitForTimeout(500);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 要素のバウンディングボックスが安定するまで待機
      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId,
        { timeout: 5000 }
      );

      // 右クリックでコンテキストメニューを開く
      await tabNode.click({ button: 'right' });

      // コンテキストメニューが表示されることを確認
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「別のビューへ移動」にホバー
      const moveToViewItem = sidePanelPage.locator('text=別のビューへ移動');
      await moveToViewItem.hover();

      // サブメニューが表示されるまで待機
      const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
      await expect(subMenu).toBeVisible({ timeout: 5000 });

      // サブメニュー内の "New View" をクリック
      const newViewMenuItem = subMenu.locator('text=New View');
      await newViewMenuItem.click();

      // コンテキストメニューが閉じることを確認
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // New Viewに切り替える
      await newViewButton.click();
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // タブがNew Viewに移動していることを確認
      await expect(async () => {
        const tabNodeInNewView = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        await expect(tabNodeInNewView).toBeVisible();
      }).toPass({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });

    test('現在のビューはサブメニューに表示されない', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 最初にタブを作成（ビュー追加前）
      // 注意: TreeStateManager.persistState()はviewsを空配列で上書きするため、
      // タブ作成後にビューを追加する順序にすることで、ビューがリセットされるのを回避
      const tabId = await createTab(extensionContext, 'about:blank');

      // タブノードが表示されるまで待機
      await expect(async () => {
        const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        await expect(tabNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 新しいビューを追加
      await waitForViewSwitcher(sidePanelPage);
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // ビューの追加が完了するまで少し待機
      await sidePanelPage.waitForTimeout(500);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();

      // 右クリックでコンテキストメニューを開く
      await tabNode.click({ button: 'right' });

      // コンテキストメニューが表示されることを確認
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「別のビューへ移動」にホバー
      const moveToViewItem = sidePanelPage.locator('text=別のビューへ移動');
      await moveToViewItem.hover();

      // サブメニューが表示されるまで待機
      const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
      await expect(subMenu).toBeVisible({ timeout: 5000 });

      // サブメニュー内に "Default"（現在のビュー）が表示されていないことを確認
      const defaultMenuItem = subMenu.locator('button:has-text("Default")');
      await expect(defaultMenuItem).not.toBeVisible();

      // クリーンアップ: メニューを閉じてからタブを閉じる
      await sidePanelPage.keyboard.press('Escape');
      await closeTab(extensionContext, tabId);
    });
  });
});
