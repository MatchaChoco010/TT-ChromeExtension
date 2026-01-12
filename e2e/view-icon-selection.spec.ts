import { expect } from '@playwright/test';
import { test as extensionTest } from './fixtures/extension';
import { waitForViewSwitcher } from './utils/polling-utils';
import { getCurrentWindowId } from './utils/tab-utils';
import { setupWindow } from './utils/setup-utils';

extensionTest.describe('ビューアイコン選択即時反映', () => {
  extensionTest(
    'プリセットからアイコンを選択すると即座に反映される（Selectボタン不要）',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      // ビュースイッチャーが表示されるまで待機
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

      // アイコン選択ボタンをクリック
      const iconSelectButton = sidePanelPage.locator('[data-testid="icon-select-button"]');
      await expect(iconSelectButton).toBeVisible({ timeout: 5000 });
      await iconSelectButton.click();

      // IconPickerが表示される
      const iconPicker = sidePanelPage.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible({ timeout: 5000 });

      // アイコングリッドが表示される
      const iconGrid = sidePanelPage.locator('[data-testid="icon-grid"]');
      await expect(iconGrid).toBeVisible({ timeout: 5000 });

      // プリセットアイコン（briefcase）を選択
      const briefcaseIcon = sidePanelPage.locator('[data-testid="icon-button-briefcase"]');
      await expect(briefcaseIcon).toBeVisible({ timeout: 5000 });
      await briefcaseIcon.click();

      // IconPickerが閉じる（即座にonSelectが呼ばれるため）
      await expect(iconPicker).not.toBeVisible({ timeout: 5000 });

      // モーダル内のアイコンプレビューが更新されている
      const customIconPreview = sidePanelPage.locator('[data-testid="custom-icon-preview"]');
      await expect(customIconPreview).toBeVisible({ timeout: 5000 });

      // モーダルを閉じる（Save不要、既に反映済み）
      const cancelButton = sidePanelPage.locator('button', { hasText: 'Cancel' });
      await cancelButton.click();

      // 編集モーダルが閉じる
      await expect(editModal).not.toBeVisible({ timeout: 5000 });

      // ビューボタン上にカスタムアイコンが表示されている（即時反映を確認）
      // view-custom-iconというdata-testidがビューボタン内に存在することを確認
      const viewCustomIcon = sidePanelPage.locator('[data-testid="view-custom-icon"]');
      await expect(viewCustomIcon.first()).toBeVisible({ timeout: 5000 });
    }
  );

  extensionTest(
    'アイコン選択後にツリービューパネル上のビューアイコンが即座に更新される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      // ビュースイッチャーが表示されるまで待機
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

      // 最初はカラーサークルが表示されている（アイコン未設定）
      const colorCircle = newViewButton.locator('[data-testid="view-color-circle"]');
      // カラーサークルは表示されている（hiddenでない）か、またはカスタムアイコンがない状態
      // 初期状態ではアイコンは未設定

      // 右クリックしてコンテキストメニューを開く
      await newViewButton.click({ button: 'right' });

      // コンテキストメニューが表示される
      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「ビューを編集」をクリック
      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await editMenuItem.click();

      // 編集モーダルが表示される
      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      // アイコン選択ボタンをクリック
      const iconSelectButton = sidePanelPage.locator('[data-testid="icon-select-button"]');
      await iconSelectButton.click();

      // IconPickerが表示される
      const iconPicker = sidePanelPage.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible({ timeout: 5000 });

      // プリセットアイコン（star）を選択
      const starIcon = sidePanelPage.locator('[data-testid="icon-button-star"]');
      // starは「General」カテゴリにあるので、カテゴリを切り替える
      const generalTab = sidePanelPage.locator('button[role="tab"]', { hasText: 'General' });
      await generalTab.click();

      await expect(starIcon).toBeVisible({ timeout: 5000 });
      await starIcon.click();

      // IconPickerが閉じる（即座にonSelectが呼ばれるため）
      await expect(iconPicker).not.toBeVisible({ timeout: 5000 });

      // ViewSwitcher内のビューボタンにカスタムアイコンが表示されることを確認
      // ビューボタン自体を再取得（aria-labelは変わらない）
      const updatedViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(updatedViewButton).toBeVisible({ timeout: 5000 });

      // ビューボタン内にカスタムアイコンが表示されている
      const viewCustomIcon = updatedViewButton.locator('[data-testid="view-custom-icon"]');
      await expect(viewCustomIcon).toBeVisible({ timeout: 5000 });

      // カラーサークルはhiddenになっている（アイコンが設定されたため）
      // CSSクラスでhiddenが追加されているはず
      await expect(colorCircle).toBeHidden({ timeout: 5000 });

      // モーダルをキャンセルして閉じる
      const cancelButton = sidePanelPage.locator('button', { hasText: 'Cancel' });
      await cancelButton.click();
      await expect(editModal).not.toBeVisible({ timeout: 5000 });
    }
  );

  extensionTest(
    'アイコン選択時にIconPickerが即座に閉じる（Selectボタン不要）',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      // ビュースイッチャーが表示されるまで待機
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

      // コンテキストメニューから「ビューを編集」をクリック
      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await expect(editMenuItem).toBeVisible({ timeout: 5000 });
      await editMenuItem.click();

      // 編集モーダルが表示される
      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      // アイコン選択ボタンをクリック
      const iconSelectButton = sidePanelPage.locator('[data-testid="icon-select-button"]');
      await iconSelectButton.click();

      // IconPickerが表示される
      const iconPicker = sidePanelPage.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible({ timeout: 5000 });

      // Selectボタンが存在することを確認（使わなくても存在はする）
      const selectButton = iconPicker.locator('button', { hasText: 'Select' });
      await expect(selectButton).toBeVisible({ timeout: 5000 });

      // プリセットアイコン（home）を選択 - Generalカテゴリに切り替え
      const generalTab = sidePanelPage.locator('button[role="tab"]', { hasText: 'General' });
      await generalTab.click();
      const homeIcon = sidePanelPage.locator('[data-testid="icon-button-home"]');
      await expect(homeIcon).toBeVisible({ timeout: 5000 });

      // アイコンをクリック（Selectボタンは押さない）
      await homeIcon.click();

      // IconPickerが即座に閉じることを検証（Selectボタン不要）
      await expect(iconPicker).not.toBeVisible({ timeout: 5000 });

      // 編集モーダルはまだ開いている
      await expect(editModal).toBeVisible({ timeout: 5000 });

      // モーダルを閉じる
      const cancelButton = sidePanelPage.locator('button', { hasText: 'Cancel' });
      await cancelButton.click();
    }
  );

  extensionTest(
    '複数回アイコンを変更しても正しく反映される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      // ビュースイッチャーが表示されるまで待機
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 右クリックして編集モーダルを開く
      await newViewButton.click({ button: 'right' });
      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await editMenuItem.click();

      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      // 1回目: briefcaseアイコンを選択
      let iconSelectButton = sidePanelPage.locator('[data-testid="icon-select-button"]');
      await iconSelectButton.click();
      let iconPicker = sidePanelPage.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible({ timeout: 5000 });

      const briefcaseIcon = sidePanelPage.locator('[data-testid="icon-button-briefcase"]');
      await expect(briefcaseIcon).toBeVisible({ timeout: 5000 });
      await briefcaseIcon.click();

      await expect(iconPicker).not.toBeVisible({ timeout: 5000 });

      // ビューボタンにbriefcaseアイコンが反映されていることを確認
      let viewCustomIcon = newViewButton.locator('[data-testid="view-custom-icon"]');
      await expect(viewCustomIcon).toBeVisible({ timeout: 5000 });

      // 2回目: codeアイコン（Devカテゴリ）を選択
      iconSelectButton = sidePanelPage.locator('[data-testid="icon-select-button"]');
      await iconSelectButton.click();
      iconPicker = sidePanelPage.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible({ timeout: 5000 });

      // Devカテゴリに切り替え
      const devTab = sidePanelPage.locator('button[role="tab"]', { hasText: 'Dev' });
      await devTab.click();

      const codeIcon = sidePanelPage.locator('[data-testid="icon-button-code"]');
      await expect(codeIcon).toBeVisible({ timeout: 5000 });
      await codeIcon.click();

      await expect(iconPicker).not.toBeVisible({ timeout: 5000 });

      // ビューボタンにアイコンが反映されていることを確認（異なるアイコンでも正しく表示）
      viewCustomIcon = newViewButton.locator('[data-testid="view-custom-icon"]');
      await expect(viewCustomIcon).toBeVisible({ timeout: 5000 });

      // モーダルを閉じる
      const cancelButton = sidePanelPage.locator('button', { hasText: 'Cancel' });
      await cancelButton.click();
      await expect(editModal).not.toBeVisible({ timeout: 5000 });

      // ビューボタン上のアイコンがまだ表示されていることを確認
      viewCustomIcon = newViewButton.locator('[data-testid="view-custom-icon"]');
      await expect(viewCustomIcon).toBeVisible({ timeout: 5000 });
    }
  );
});
