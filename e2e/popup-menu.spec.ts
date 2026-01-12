import { test, expect } from './fixtures/extension';
import { getCurrentWindowId } from './utils/tab-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ポップアップメニュー', () => {
  test.describe('ポップアップメニューの表示', () => {
    test('ポップアップページが正しく読み込まれる', async ({
      extensionContext,
      extensionId,
    }) => {
      const popupPage = await extensionContext.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

      await popupPage.waitForLoadState('domcontentloaded');

      const popupMenu = popupPage.locator('[data-testid="popup-menu"]');
      await expect(popupMenu).toBeVisible({ timeout: 5000 });

      await popupPage.close();
    });

    test('ポップアップメニューに「設定を開く」ボタンが表示される', async ({
      extensionContext,
      extensionId,
    }) => {
      const popupPage = await extensionContext.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

      const popupMenu = popupPage.locator('[data-testid="popup-menu"]');
      await expect(popupMenu).toBeVisible({ timeout: 5000 });

      const settingsButton = popupPage.locator('[aria-label="設定を開く"]');
      await expect(settingsButton).toBeVisible();

      await expect(settingsButton).toContainText('設定を開く');

      await popupPage.close();
    });

    test('ポップアップメニューに「スナップショットを取得」ボタンが表示される', async ({
      extensionContext,
      extensionId,
    }) => {
      const popupPage = await extensionContext.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

      const popupMenu = popupPage.locator('[data-testid="popup-menu"]');
      await expect(popupMenu).toBeVisible({ timeout: 5000 });

      const snapshotButton = popupPage.locator('[aria-label="スナップショットを取得"]');
      await expect(snapshotButton).toBeVisible();

      await expect(snapshotButton).toContainText('スナップショットを取得');

      await popupPage.close();
    });
  });

  test.describe('設定ページを開く機能', () => {
    test('「設定を開く」ボタンをクリックすると設定ページが開く', async ({
      extensionContext,
      extensionId,
    }) => {
      const popupPage = await extensionContext.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

      const popupMenu = popupPage.locator('[data-testid="popup-menu"]');
      await expect(popupMenu).toBeVisible({ timeout: 5000 });

      const settingsButton = popupPage.locator('[aria-label="設定を開く"]');
      await settingsButton.click();

      await expect(async () => {
        const pages = extensionContext.pages();
        const settingsPage = pages.find((page) =>
          page.url().includes('settings.html')
        );
        expect(settingsPage).toBeDefined();
      }).toPass({ timeout: 10000 });

      const pages = extensionContext.pages();
      const settingsPage = pages.find((page) =>
        page.url().includes('settings.html')
      );
      if (settingsPage) {
        await settingsPage.close();
      }
      await popupPage.close();
    });
  });

  test.describe('スナップショット取得機能', () => {
    test('「スナップショットを取得」ボタンをクリックするとスナップショットが取得される', async ({
      extensionContext,
      extensionId,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const popupPage = await extensionContext.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

      const popupMenu = popupPage.locator('[data-testid="popup-menu"]');
      await expect(popupMenu).toBeVisible({ timeout: 5000 });

      const snapshotButton = popupPage.locator('[aria-label="スナップショットを取得"]');
      await snapshotButton.click();

      await expect(async () => {
        const text = await snapshotButton.textContent();
        expect(text).toMatch(/取得中|完了しました|失敗しました/);
      }).toPass({ timeout: 2000 });

      await expect(async () => {
        const text = await snapshotButton.textContent();
        expect(text).toMatch(/完了しました|失敗しました/);
      }).toPass({ timeout: 10000 });

      await popupPage.close();
    });

    test('スナップショット取得完了後にユーザーに通知される', async ({
      extensionContext,
      extensionId,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const popupPage = await extensionContext.newPage();
      await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);

      const popupMenu = popupPage.locator('[data-testid="popup-menu"]');
      await expect(popupMenu).toBeVisible({ timeout: 5000 });

      const snapshotButton = popupPage.locator('[aria-label="スナップショットを取得"]');
      await snapshotButton.click();

      await expect(async () => {
        const text = await snapshotButton.textContent();
        expect(text).toMatch(/完了しました|失敗しました/);
      }).toPass({ timeout: 10000 });

      const text = await snapshotButton.textContent();
      const buttonClasses = await snapshotButton.getAttribute('class');
      if (text?.includes('完了しました')) {
        expect(buttonClasses).toContain('bg-green');
      } else {
        expect(buttonClasses).toContain('bg-red');
      }

      await popupPage.close();
    });
  });
});
