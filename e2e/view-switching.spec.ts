/**
 * ビュー切り替え機能のE2Eテスト
 *
 * Task 4.8: ビュー切り替え機能の実装とテスト
 * Requirements: 3.8
 *
 * テスト対象:
 * 1. "All Tabs"/"Current Window"ビューの切り替え
 * 2. カスタムビューの作成、削除、名前・色変更
 */
import { test, expect } from './fixtures/extension';
import { waitForViewSwitcher } from './utils/polling-utils';

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
        '[aria-label="Switch to New View view"]'
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
        '[aria-label="Switch to New View view"]'
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
      let viewButtons = sidePanelPage.locator('[aria-label^="Switch to"]');
      const initialCount = await viewButtons.count();

      // 新しいビュー追加ボタンをクリック
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // ビューの数が増えたことを確認（ポーリング）
      await expect(async () => {
        viewButtons = sidePanelPage.locator('[aria-label^="Switch to"]');
        const newCount = await viewButtons.count();
        expect(newCount).toBe(initialCount + 1);
      }).toPass({ timeout: 5000 });
    });

    test('カスタムビューを作成した場合、新しいビューがビューリストに追加される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビュー追加ボタンをクリック
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビュー "New View" が表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('カスタムビュー編集', () => {
    test('ビュー名や色を変更した場合、UI上の表示が即座に反映される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 編集ボタンが表示されるまで待機
      const editButton = sidePanelPage.locator(
        '[aria-label="Edit view New View"]'
      );
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();

      // 編集フォームが表示される
      const editForm = sidePanelPage.locator('[data-testid="view-edit-form"]');
      await expect(editForm).toBeVisible({ timeout: 5000 });

      // 名前を変更
      const nameInput = sidePanelPage.locator('[aria-label="View Name"]');
      await nameInput.clear();
      await nameInput.fill('My Custom View');

      // 色を変更（カラーピッカーをシミュレート）
      const colorInput = sidePanelPage.locator('[aria-label="View Color"]');
      // fill() を使って値を設定し、input イベントを発火させる
      await colorInput.fill('#ff0000');

      // 保存
      const saveButton = sidePanelPage.locator('[aria-label="Save"]');
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

      // デフォルトビューの編集ボタンをクリック
      const editButton = sidePanelPage.locator(
        '[aria-label="Edit view Default"]'
      );
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();

      // 編集フォームが表示される
      const editForm = sidePanelPage.locator('[data-testid="view-edit-form"]');
      await expect(editForm).toBeVisible({ timeout: 5000 });

      // 名前を変更
      const nameInput = sidePanelPage.locator('[aria-label="View Name"]');
      await nameInput.clear();
      await nameInput.fill('Changed Name');

      // キャンセル
      const cancelButton = sidePanelPage.locator('[aria-label="Cancel"]');
      await cancelButton.click();

      // 編集フォームが閉じるのを待機
      await expect(editForm).not.toBeVisible({ timeout: 5000 });

      // 元の名前のままであることを確認
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('ビュー削除', () => {
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
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();

      // 新しいビューがアクティブになるまで待機
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // 編集モードに入る
      const editButton = sidePanelPage.locator(
        '[aria-label="Edit view New View"]'
      );
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();

      // 削除ボタンが表示されるまで待機してクリック
      const deleteButton = sidePanelPage.locator('[aria-label="Delete view"]');
      await expect(deleteButton).toBeVisible({ timeout: 5000 });
      await deleteButton.click();

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

      // デフォルトビューの編集ボタンをクリック
      const editButton = sidePanelPage.locator(
        '[aria-label="Edit view Default"]'
      );
      await expect(editButton).toBeVisible({ timeout: 5000 });
      await editButton.click();

      // 編集フォームが表示される
      const editForm = sidePanelPage.locator('[data-testid="view-edit-form"]');
      await expect(editForm).toBeVisible({ timeout: 5000 });

      // 削除ボタンが存在しないことを確認（デフォルトビューでは表示されない）
      const deleteButton = sidePanelPage.locator('[aria-label="Delete view"]');
      await expect(deleteButton).not.toBeVisible({ timeout: 3000 });
    });
  });
});
