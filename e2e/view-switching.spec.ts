/**
 * ビュー切り替え機能のE2Eテスト
 *
 * テスト対象:
 * 1. "All Tabs"/"Current Window"ビューの切り替え
 * 2. カスタムビューの作成、削除、名前・色変更
 */
import { test, expect } from './fixtures/extension';
import { waitForViewSwitcher, waitForCondition } from './utils/polling-utils';
import { createTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, closeTab } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ビュー切り替え機能', () => {
  test.describe('ビュー一覧とビュー切り替え', () => {
    test('Side Panelを開いた場合、ビュースイッチャーが表示される', async ({
      sidePanelPage,
    }) => {
      // ビュースイッチャーが表示されるまで待機
      await waitForViewSwitcher(sidePanelPage);

      // ビュースイッチャーが表示されることを検証
      const viewSwitcher = sidePanelPage.locator(
        '[data-testid="view-switcher-container"]'
      );
      await expect(viewSwitcher).toBeVisible({ timeout: 5000 });
    });

    test('デフォルトビューが表示され、クリックするとアクティブ状態になる', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // デフォルトビュー(Default)のボタンが存在する
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });

      // デフォルトビューをクリック
      await defaultViewButton.click();

      // アクティブ状態になるまで待機
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });
    });

    test('ビューボタンをクリックするとビューが切り替わる', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが追加されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューをクリック
      await newViewButton.click();

      // 新しいビューがアクティブになる
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // デフォルトビューは非アクティブになる
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toHaveAttribute('data-active', 'false', { timeout: 5000 });
    });

    test('ビュー間を切り替えた場合、ツリー表示が即座に更新される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // ビュースイッチャーが表示されていることを確認
      const viewSwitcher = sidePanelPage.locator(
        '[data-testid="view-switcher-container"]'
      );
      await expect(viewSwitcher).toBeVisible({ timeout: 5000 });

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューをクリック
      await newViewButton.click();

      // ツリービューが存在することを確認
      const treeView = sidePanelPage.locator('[data-testid="tab-tree-view"]');
      await expect(treeView).toBeVisible({ timeout: 5000 });

      // "No tabs in this view"メッセージが表示される（新しい空のビュー）
      const emptyMessage = sidePanelPage.locator('text=No tabs in this view');
      await expect(emptyMessage).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('カスタムビュー作成', () => {
    test('新しいビュー追加ボタンをクリックすると、新しいビューが作成される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // ビューの数を確認
      const viewSwitcher = sidePanelPage.locator(
        '[data-testid="view-switcher-container"]'
      );
      await expect(viewSwitcher).toBeVisible({ timeout: 5000 });

      // 初期状態ではデフォルトビューのみ
      const viewButtons = sidePanelPage.locator('[aria-label^="Switch to"]');
      const initialCount = await viewButtons.count();

      // 新しいビュー追加ボタンをクリック
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビューの数が増えたことを確認（ポーリング）
      await waitForCondition(
        async () => {
          const currentViewButtons = sidePanelPage.locator('[aria-label^="Switch to"]');
          const newCount = await currentViewButtons.count();
          return newCount === initialCount + 1;
        },
        { timeout: 5000, timeoutMessage: 'View count did not increase after adding a new view' }
      );
    });

    test('カスタムビューを作成した場合、新しいビューがビューリストに追加される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビュー追加ボタンをクリック
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビュー "View" が表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('カスタムビュー編集', () => {
    // ビュー編集は右クリックコンテキストメニュー経由で行うようになりました
    test('ビュー名や色を変更した場合、UI上の表示が即座に反映される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 右クリックしてコンテキストメニューを開く
      await newViewButton.click({ button: 'right' });

      // コンテキストメニューが表示される
      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「ビューを編集」をクリック
      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await expect(editMenuItem).toBeVisible({ timeout: 5000 });
      await editMenuItem.click();

      // 編集モーダルが表示される
      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      // 名前を変更
      const nameInput = sidePanelPage.locator('#view-name');
      await nameInput.clear();
      await nameInput.fill('My Custom View');

      // 色を変更（カラーピッカーをシミュレート）
      const colorInput = sidePanelPage.locator('#view-color');
      // fill() を使って値を設定し、input イベントを発火させる
      await colorInput.fill('#ff0000');

      // 保存
      const saveButton = sidePanelPage.locator('button', { hasText: 'Save' });
      await saveButton.click();

      // 名前が変更されたことを確認（ボタンが表示されるまで待機）
      const updatedViewButton = sidePanelPage.locator(
        '[aria-label="Switch to My Custom View view"]'
      );
      await expect(updatedViewButton).toBeVisible({ timeout: 5000 });

      // 色が変更されたことを確認（data-color属性）
      await expect(updatedViewButton).toHaveAttribute('data-color', '#ff0000', { timeout: 5000 });
    });

    test('編集をキャンセルした場合、変更は破棄される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // デフォルトビューを右クリックしてコンテキストメニューを開く
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });
      await defaultViewButton.click({ button: 'right' });

      // コンテキストメニューが表示される
      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「ビューを編集」をクリック
      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await expect(editMenuItem).toBeVisible({ timeout: 5000 });
      await editMenuItem.click();

      // 編集モーダルが表示される
      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      // 名前を変更
      const nameInput = sidePanelPage.locator('#view-name');
      await nameInput.clear();
      await nameInput.fill('Changed Name');

      // キャンセル
      const cancelButton = sidePanelPage.locator('button', { hasText: 'Cancel' });
      await cancelButton.click();

      // 編集モーダルが閉じるのを待機
      await expect(editModal).not.toBeVisible({ timeout: 5000 });

      // 元の名前のままであることを確認
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('ビュー切り替え動作の修正', () => {
    test('ビューを切り替えた後に新しいタブを開いた場合、現在アクティブなビューにタブを追加する', async ({
      sidePanelPage,
      extensionContext,
      serviceWorker,
    }) => {
      // Initialize test state
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();

      // 新しいビューがアクティブになるまで待機
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // 新しいビューには「No tabs in this view」が表示されるはず
      const emptyMessage = sidePanelPage.locator('text=No tabs in this view');
      await expect(emptyMessage).toBeVisible({ timeout: 5000 });

      // 新しいタブを開く（createTabユーティリティを使用）
      const newTabId = await createTab(extensionContext, 'about:blank');
      // activeViewIndex=1: 新しいビュー（View）がアクティブ
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);
    });

    test('ビューを追加した場合、ページをリロードしてもビューが永続化されている', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // サイドパネルをリロード
      await sidePanelPage.reload();

      // ビュースイッチャーが再表示されるまで待機
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューが永続化されていることを確認
      const persistedViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(persistedViewButton).toBeVisible({ timeout: 5000 });
    });

    test('ビューの切り替え状態が正しく管理され、意図せず消えない', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 複数のビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();
      await addButton.click();

      // 2つ目のビューボタンが表示されるまで待機（2つ目のビューは "View" ではなく "View" となる）
      const viewButtons = sidePanelPage.locator('[aria-label^="Switch to"]');
      await waitForCondition(
        async () => {
          const count = await viewButtons.count();
          return count >= 3; // Default + 2 new views
        },
        { timeout: 5000, timeoutMessage: 'Two new views were not created' }
      );

      // ビュー間を何度か切り替え
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await defaultViewButton.click();
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // すべてのビューがまだ存在していることを確認
      await waitForCondition(
        async () => {
          const count = await viewButtons.count();
          return count >= 3;
        },
        { timeout: 5000, timeoutMessage: 'Views disappeared after switching' }
      );
    });
  });

  test.describe('ビュー削除', () => {
    // ビュー削除は右クリックコンテキストメニュー経由で行うようになりました
    test('ビューを削除した場合、デフォルトビューに自動的に切り替わる', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();

      // 新しいビューがアクティブになるまで待機
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // 右クリックしてコンテキストメニューを開く
      await newViewButton.click({ button: 'right' });

      // コンテキストメニューが表示される
      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「ビューを削除」をクリック
      const deleteMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを削除' });
      await expect(deleteMenuItem).toBeVisible({ timeout: 5000 });
      await deleteMenuItem.click();

      // 新しいビューが削除されたことを確認
      await expect(newViewButton).not.toBeVisible({ timeout: 5000 });

      // デフォルトビューがアクティブになる
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });
    });

    test('デフォルトビューは削除できない', async ({ sidePanelPage }) => {
      await waitForViewSwitcher(sidePanelPage);

      // デフォルトビューを右クリックしてコンテキストメニューを開く
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });
      await defaultViewButton.click({ button: 'right' });

      // コンテキストメニューが表示される
      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「ビューを削除」が無効化されていることを確認（最後のビュー）
      const deleteMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを削除' });
      await expect(deleteMenuItem).toBeDisabled({ timeout: 5000 });
    });
  });
});
