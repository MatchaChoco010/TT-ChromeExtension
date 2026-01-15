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
      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await expect(editMenuItem).toBeVisible({ timeout: 5000 });
      await editMenuItem.click();

      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      const iconSelectButton = sidePanelPage.locator('[data-testid="icon-select-button"]');
      await expect(iconSelectButton).toBeVisible({ timeout: 5000 });
      await iconSelectButton.click();

      const iconPicker = sidePanelPage.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible({ timeout: 5000 });

      const iconGrid = sidePanelPage.locator('[data-testid="icon-grid"]');
      await expect(iconGrid).toBeVisible({ timeout: 5000 });

      const briefcaseIcon = sidePanelPage.locator('[data-testid="icon-button-briefcase"]');
      await expect(briefcaseIcon).toBeVisible({ timeout: 5000 });
      await briefcaseIcon.click();

      await expect(iconPicker).not.toBeVisible({ timeout: 5000 });

      const customIconPreview = sidePanelPage.locator('[data-testid="custom-icon-preview"]');
      await expect(customIconPreview).toBeVisible({ timeout: 5000 });

      const cancelButton = sidePanelPage.locator('button', { hasText: 'Cancel' });
      await cancelButton.click();

      await expect(editModal).not.toBeVisible({ timeout: 5000 });

      const viewCustomIcon = sidePanelPage.locator('[data-testid="view-custom-icon"]');
      await expect(viewCustomIcon.first()).toBeVisible({ timeout: 5000 });
    }
  );

  extensionTest(
    'アイコン選択後にツリービューパネル上のビューアイコンが即座に更新される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      const colorCircle = newViewButton.locator('[data-testid="view-color-circle"]');

      await newViewButton.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await editMenuItem.click();

      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      const iconSelectButton = sidePanelPage.locator('[data-testid="icon-select-button"]');
      await iconSelectButton.click();

      const iconPicker = sidePanelPage.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible({ timeout: 5000 });

      const starIcon = sidePanelPage.locator('[data-testid="icon-button-star"]');
      const generalTab = sidePanelPage.locator('button[role="tab"]', { hasText: 'General' });
      await generalTab.click();

      await expect(starIcon).toBeVisible({ timeout: 5000 });
      await starIcon.click();

      await expect(iconPicker).not.toBeVisible({ timeout: 5000 });

      const updatedViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(updatedViewButton).toBeVisible({ timeout: 5000 });

      const viewCustomIcon = updatedViewButton.locator('[data-testid="view-custom-icon"]');
      await expect(viewCustomIcon).toBeVisible({ timeout: 5000 });

      await expect(colorCircle).toBeHidden({ timeout: 5000 });

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
      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click({ button: 'right' });

      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await expect(editMenuItem).toBeVisible({ timeout: 5000 });
      await editMenuItem.click();

      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      const iconSelectButton = sidePanelPage.locator('[data-testid="icon-select-button"]');
      await iconSelectButton.click();

      const iconPicker = sidePanelPage.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible({ timeout: 5000 });

      const selectButton = iconPicker.locator('button', { hasText: 'Select' });
      await expect(selectButton).toBeVisible({ timeout: 5000 });

      const generalTab = sidePanelPage.locator('button[role="tab"]', { hasText: 'General' });
      await generalTab.click();
      const homeIcon = sidePanelPage.locator('[data-testid="icon-button-home"]');
      await expect(homeIcon).toBeVisible({ timeout: 5000 });

      await homeIcon.click();

      await expect(iconPicker).not.toBeVisible({ timeout: 5000 });

      await expect(editModal).toBeVisible({ timeout: 5000 });

      const cancelButton = sidePanelPage.locator('button', { hasText: 'Cancel' });
      await cancelButton.click();
    }
  );

  extensionTest(
    '複数回アイコンを変更しても正しく反映される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click({ button: 'right' });
      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await editMenuItem.click();

      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      let iconSelectButton = sidePanelPage.locator('[data-testid="icon-select-button"]');
      await iconSelectButton.click();
      let iconPicker = sidePanelPage.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible({ timeout: 5000 });

      const briefcaseIcon = sidePanelPage.locator('[data-testid="icon-button-briefcase"]');
      await expect(briefcaseIcon).toBeVisible({ timeout: 5000 });
      await briefcaseIcon.click();

      await expect(iconPicker).not.toBeVisible({ timeout: 5000 });

      let viewCustomIcon = newViewButton.locator('[data-testid="view-custom-icon"]');
      await expect(viewCustomIcon).toBeVisible({ timeout: 5000 });

      iconSelectButton = sidePanelPage.locator('[data-testid="icon-select-button"]');
      await iconSelectButton.click();
      iconPicker = sidePanelPage.locator('[data-testid="icon-picker"]');
      await expect(iconPicker).toBeVisible({ timeout: 5000 });

      const devTab = sidePanelPage.locator('button[role="tab"]', { hasText: 'Dev' });
      await devTab.click();

      const codeIcon = sidePanelPage.locator('[data-testid="icon-button-code"]');
      await expect(codeIcon).toBeVisible({ timeout: 5000 });
      await codeIcon.click();

      await expect(iconPicker).not.toBeVisible({ timeout: 5000 });

      viewCustomIcon = newViewButton.locator('[data-testid="view-custom-icon"]');
      await expect(viewCustomIcon).toBeVisible({ timeout: 5000 });

      const cancelButton = sidePanelPage.locator('button', { hasText: 'Cancel' });
      await cancelButton.click();
      await expect(editModal).not.toBeVisible({ timeout: 5000 });

      viewCustomIcon = newViewButton.locator('[data-testid="view-custom-icon"]');
      await expect(viewCustomIcon).toBeVisible({ timeout: 5000 });
    }
  );
});
