import { test, expect } from './fixtures/extension';
import { waitForViewSwitcher, waitForCondition } from './utils/polling-utils';
import { createTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, closeTab } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ビュー切り替え機能', () => {
  test.describe('ビュー一覧とビュー切り替え', () => {
    test('Side Panelを開いた場合、ビュースイッチャーが表示される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const viewSwitcher = sidePanelPage.locator(
        '[data-testid="view-switcher-container"]'
      );
      await expect(viewSwitcher).toBeVisible({ timeout: 5000 });
    });

    test('デフォルトビューが表示され、クリックするとアクティブ状態になる', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });

      await defaultViewButton.click();

      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });
    });

    test('ビューボタンをクリックするとビューが切り替わる', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click();

      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toHaveAttribute('data-active', 'false', { timeout: 5000 });
    });

    test('ビュー間を切り替えた場合、ツリー表示が即座に更新される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const viewSwitcher = sidePanelPage.locator(
        '[data-testid="view-switcher-container"]'
      );
      await expect(viewSwitcher).toBeVisible({ timeout: 5000 });

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click();

      const treeView = sidePanelPage.locator('[data-testid="tab-tree-view"]');
      await expect(treeView).toBeVisible({ timeout: 5000 });

      const emptyMessage = sidePanelPage.locator('text=No tabs in this view');
      await expect(emptyMessage).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('カスタムビュー作成', () => {
    test('新しいビュー追加ボタンをクリックすると、新しいビューが作成される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const viewSwitcher = sidePanelPage.locator(
        '[data-testid="view-switcher-container"]'
      );
      await expect(viewSwitcher).toBeVisible({ timeout: 5000 });

      const viewButtons = sidePanelPage.locator('[aria-label^="Switch to"]');
      const initialCount = await viewButtons.count();

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();

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

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('カスタムビュー編集', () => {
    test('ビュー名や色を変更した場合、UI上の表示が即座に反映される', async ({
      sidePanelPage,
    }) => {
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

      const nameInput = sidePanelPage.locator('#view-name');
      await nameInput.clear();
      await nameInput.fill('My Custom View');

      const colorInput = sidePanelPage.locator('#view-color');
      await colorInput.fill('#ff0000');

      const saveButton = sidePanelPage.locator('button', { hasText: 'Save' });
      await saveButton.click();

      const updatedViewButton = sidePanelPage.locator(
        '[aria-label="Switch to My Custom View view"]'
      );
      await expect(updatedViewButton).toBeVisible({ timeout: 5000 });

      await expect(updatedViewButton).toHaveAttribute('data-color', '#ff0000', { timeout: 5000 });
    });

    test('編集をキャンセルした場合、変更は破棄される', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });
      await defaultViewButton.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await expect(editMenuItem).toBeVisible({ timeout: 5000 });
      await editMenuItem.click();

      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });

      const nameInput = sidePanelPage.locator('#view-name');
      await nameInput.clear();
      await nameInput.fill('Changed Name');

      const cancelButton = sidePanelPage.locator('button', { hasText: 'Cancel' });
      await cancelButton.click();

      await expect(editModal).not.toBeVisible({ timeout: 5000 });

      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('ビュー切り替え動作の修正', () => {
    test('ビューを切り替えた後に新しいタブを開いた場合、現在アクティブなビューにタブを追加する', async ({
      sidePanelPage,
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click();

      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      const emptyMessage = sidePanelPage.locator('text=No tabs in this view');
      await expect(emptyMessage).toBeVisible({ timeout: 5000 });

      const newTabId = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);
    });

    test('ビューを追加した場合、ページをリロードしてもビューが永続化されている', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await sidePanelPage.reload();

      await waitForViewSwitcher(sidePanelPage);

      const persistedViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(persistedViewButton).toBeVisible({ timeout: 5000 });
    });

    test('ビューの切り替え状態が正しく管理され、意図せず消えない', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();
      await addButton.click();

      const viewButtons = sidePanelPage.locator('[aria-label^="Switch to"]');
      await waitForCondition(
        async () => {
          const count = await viewButtons.count();
          return count >= 3;
        },
        { timeout: 5000, timeoutMessage: 'Two new views were not created' }
      );

      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await defaultViewButton.click();
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

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
    test('ビューを削除した場合、デフォルトビューに自動的に切り替わる', async ({
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click();

      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      await newViewButton.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const deleteMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを削除' });
      await expect(deleteMenuItem).toBeVisible({ timeout: 5000 });
      await deleteMenuItem.click();

      await expect(newViewButton).not.toBeVisible({ timeout: 5000 });

      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });
    });

    test('デフォルトビューは削除できない', async ({ sidePanelPage }) => {
      await waitForViewSwitcher(sidePanelPage);

      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });
      await defaultViewButton.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const deleteMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを削除' });
      await expect(deleteMenuItem).toBeDisabled({ timeout: 5000 });
    });
  });
});
