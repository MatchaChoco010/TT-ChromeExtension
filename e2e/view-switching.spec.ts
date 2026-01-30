import { test, expect } from './fixtures/extension';
import { waitForViewSwitcher, waitForCondition } from './utils/polling-utils';
import { createTab, getTestServerUrl, getCurrentWindowId, activateTab, closeTab } from './utils/tab-utils';
import { assertTabStructure, assertActiveTab, assertActiveTabIsOneOf } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ビュー切り替え機能', () => {
  test.describe('ビュー一覧とビュー切り替え', () => {
    test('Side Panelを開いた場合、ビュースイッチャーが表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      await waitForViewSwitcher(sidePanelPage);

      const viewSwitcher = sidePanelPage.locator(
        '[data-testid="view-switcher-container"]'
      );
      await expect(viewSwitcher).toBeVisible({ timeout: 5000 });
    });

    test('デフォルトビューが表示され、クリックするとアクティブ状態になる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      await waitForViewSwitcher(sidePanelPage);

      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });

      await defaultViewButton.click();

      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });
    });

    test('ビューボタンをクリックするとビューが切り替わる', async ({
      extensionContext,
      serviceWorker,
    }) => {
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

      await newViewButton.click();

      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toHaveAttribute('data-active', 'false', { timeout: 5000 });
    });

    test('ビュー間を切り替えた場合、ツリー表示が即座に更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
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
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
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
      extensionContext,
      serviceWorker,
    }) => {
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
    });
  });

  test.describe('カスタムビュー編集', () => {
    test('ビュー名や色を変更した場合、UI上の表示が即座に反映される', async ({
      extensionContext,
      serviceWorker,
    }) => {
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
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
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
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

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

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);
    });

    test('ビューを追加した場合、ページをリロードしてもビューが永続化されている', async ({
      extensionContext,
      serviceWorker,
    }) => {
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

      await sidePanelPage.reload();

      await waitForViewSwitcher(sidePanelPage);

      const persistedViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(persistedViewButton).toBeVisible({ timeout: 5000 });
    });

    test('ビューの切り替え状態が正しく管理され、意図せず消えない', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
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
      extensionContext,
      serviceWorker,
    }) => {
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

    test('デフォルトビューは削除できない', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
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

    test('ビュー削除時にタブが一つ前のビューに移動する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage, initialBrowserTabId } = await setupWindow(extensionContext, serviceWorker, windowId);
      await waitForViewSwitcher(sidePanelPage);

      // ビュー1を作成（名前を変更して一意にする）
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      const view1Button = sidePanelPage.locator('[aria-label="Switch to View view"]');
      await expect(view1Button).toBeVisible({ timeout: 5000 });

      // ビュー1の名前を「View1」に変更
      await view1Button.click({ button: 'right' });
      const editContextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(editContextMenu).toBeVisible({ timeout: 5000 });
      const editMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを編集' });
      await editMenuItem.click();
      const editModal = sidePanelPage.locator('[data-testid="view-edit-modal"]');
      await expect(editModal).toBeVisible({ timeout: 5000 });
      const nameInput = sidePanelPage.locator('#view-name');
      await nameInput.clear();
      await nameInput.fill('View1');
      const saveButton = sidePanelPage.locator('button', { hasText: 'Save' });
      await saveButton.click();
      await expect(editModal).not.toBeVisible({ timeout: 5000 });

      const view1ButtonRenamed = sidePanelPage.locator('[aria-label="Switch to View1 view"]');
      await expect(view1ButtonRenamed).toBeVisible({ timeout: 5000 });

      // ビュー2を作成
      await addButton.click();

      const view2Button = sidePanelPage.locator('[aria-label="Switch to View view"]');
      await expect(view2Button).toBeVisible({ timeout: 5000 });

      // ビュー2に切り替えてタブを作成
      await view2Button.click();
      await expect(view2Button).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      const tabInView2 = await createTab(serviceWorker, getTestServerUrl('/page?id=view2tab'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabInView2, depth: 0 },
      ], 2);

      // ビュー2を削除
      await view2Button.click({ button: 'right' });
      const contextMenu = sidePanelPage.locator('[data-testid="view-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const deleteMenuItem = sidePanelPage.locator('button', { hasText: 'ビューを削除' });
      await deleteMenuItem.click();

      // ビュー1がアクティブになる
      await expect(view1ButtonRenamed).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // タブがビュー1に移動していることを確認
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabInView2, depth: 0 },
      ], 1);

      // デフォルトビューには移動していないことを確認
      const defaultViewButton = sidePanelPage.locator('[aria-label="Switch to Default view"]');
      await defaultViewButton.click();
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      // クリーンアップ
      await closeTab(serviceWorker, tabInView2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('ビューごとのアクティブタブ管理', () => {
    test('ビュー切り替え時に、現在のビューのタブがアクティブになる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage, initialBrowserTabId } = await setupWindow(extensionContext, serviceWorker, windowId);
      await waitForViewSwitcher(sidePanelPage);

      const tabA = await createTab(serviceWorker, getTestServerUrl('/page?id=tabA'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(serviceWorker, getTestServerUrl('/page?id=tabB'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, tabA);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);
      await assertActiveTab(extensionContext, tabA, windowId);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible();
      await addButton.click({ force: true });

      const newViewButton = sidePanelPage.locator('[aria-label="Switch to View view"]');
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      await newViewButton.click({ force: true });
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      const tabC = await createTab(serviceWorker, getTestServerUrl('/page?id=tabC'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabC, depth: 0 },
      ], 1);
      await assertActiveTab(extensionContext, tabC, windowId);

      const defaultViewButton = sidePanelPage.locator('[aria-label="Switch to Default view"]');
      await expect(defaultViewButton).toBeVisible();
      await defaultViewButton.click({ force: true });
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      await assertActiveTabIsOneOf(extensionContext, [tabA, tabB], windowId);
    });

    test('各ビューで最後にアクティブだったタブを記憶する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage, initialBrowserTabId } = await setupWindow(extensionContext, serviceWorker, windowId);
      await waitForViewSwitcher(sidePanelPage);

      const tabA = await createTab(serviceWorker, getTestServerUrl('/page?id=tabA'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(serviceWorker, getTestServerUrl('/page?id=tabB'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, tabB);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);
      await assertActiveTab(extensionContext, tabB, windowId);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible();
      await addButton.click({ force: true });
      const workViewButton = sidePanelPage.locator('[aria-label="Switch to View view"]');
      await expect(workViewButton).toBeVisible({ timeout: 5000 });

      await workViewButton.click({ force: true });
      await expect(workViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      const tabC = await createTab(serviceWorker, getTestServerUrl('/page?id=tabC'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabC, depth: 0 },
      ], 1);

      const tabD = await createTab(serviceWorker, getTestServerUrl('/page?id=tabD'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
      ], 1);

      await activateTab(serviceWorker, tabD);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
      ], 1);
      await assertActiveTab(extensionContext, tabD, windowId);

      const defaultViewButton = sidePanelPage.locator('[aria-label="Switch to Default view"]');
      await expect(defaultViewButton).toBeVisible();
      await defaultViewButton.click({ force: true });
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      await assertActiveTab(extensionContext, tabB, windowId);

      await workViewButton.click({ force: true });
      await expect(workViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      await assertActiveTab(extensionContext, tabD, windowId);
    });

    test('空のビューに切り替えた場合、アクティブタブは変更しない', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage, initialBrowserTabId } = await setupWindow(extensionContext, serviceWorker, windowId);
      await waitForViewSwitcher(sidePanelPage);

      const tabA = await createTab(serviceWorker, getTestServerUrl('/page?id=tabA'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, tabA);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);
      await assertActiveTab(extensionContext, tabA, windowId);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await addButton.click();
      const emptyViewButton = sidePanelPage.locator('[aria-label="Switch to View view"]');
      await expect(emptyViewButton).toBeVisible({ timeout: 5000 });

      await emptyViewButton.click();
      await expect(emptyViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      await assertActiveTab(extensionContext, tabA, windowId);
    });
  });

  test.describe('タブのビュー間移動', () => {
    test('親タブを別ビューに移動すると、サブツリー全体が移動する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage, initialBrowserTabId } = await setupWindow(extensionContext, serviceWorker, windowId);
      await waitForViewSwitcher(sidePanelPage);

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page?id=parent'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page?id=child'), parentTab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible();
      await addButton.click({ force: true });
      const personalViewButton = sidePanelPage.locator('[aria-label="Switch to View view"]');
      await expect(personalViewButton).toBeVisible({ timeout: 5000 });

      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
      await expect(parentNode).toBeVisible();
      await parentNode.click({ button: 'right', force: true });

      const contextMenu = sidePanelPage.locator('[data-testid="tab-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const moveToViewMenuItem = sidePanelPage.locator('text=別のビューへ移動');
      await expect(moveToViewMenuItem).toBeVisible();
      const box = await moveToViewMenuItem.boundingBox();
      if (box) {
        await sidePanelPage.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      }

      const viewSubMenu = sidePanelPage.locator('[data-testid="submenu"]');
      await expect(viewSubMenu).toBeVisible({ timeout: 5000 });

      const viewOption = viewSubMenu.locator('button', { hasText: 'View' });
      await expect(viewOption).toBeVisible();
      await viewOption.click({ force: true });

      await waitForCondition(
        async () => {
          const treeNodes = sidePanelPage.locator('[data-testid^="tree-node-"]');
          const count = await treeNodes.count();
          return count === 0;
        },
        { timeout: 5000, timeoutMessage: 'Tabs did not move to the new view' }
      );

      await personalViewButton.click({ force: true });
      await expect(personalViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 1);
    });

    test('子タブだけを別ビューに移動すると、親子関係が切れる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage, initialBrowserTabId } = await setupWindow(extensionContext, serviceWorker, windowId);
      await waitForViewSwitcher(sidePanelPage);

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page?id=parent'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page?id=child'), parentTab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible();
      await addButton.click({ force: true });
      const personalViewButton = sidePanelPage.locator('[aria-label="Switch to View view"]');
      await expect(personalViewButton).toBeVisible({ timeout: 5000 });

      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`);
      await expect(childNode).toBeVisible();
      await childNode.click({ button: 'right', force: true });

      const contextMenu = sidePanelPage.locator('[data-testid="tab-context-menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const moveToViewMenuItem = sidePanelPage.locator('text=別のビューへ移動');
      await expect(moveToViewMenuItem).toBeVisible();
      const box2 = await moveToViewMenuItem.boundingBox();
      if (box2) {
        await sidePanelPage.mouse.move(box2.x + box2.width / 2, box2.y + box2.height / 2);
      }

      const viewSubMenu = sidePanelPage.locator('[data-testid="submenu"]');
      await expect(viewSubMenu).toBeVisible({ timeout: 5000 });

      const viewOption = viewSubMenu.locator('button', { hasText: 'View' });
      await expect(viewOption).toBeVisible();
      await viewOption.click({ force: true });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: parentTab, depth: 0 },
      ], 0);

      await personalViewButton.click({ force: true });
      await expect(personalViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: childTab, depth: 0 },
      ], 1);
    });
  });
});
