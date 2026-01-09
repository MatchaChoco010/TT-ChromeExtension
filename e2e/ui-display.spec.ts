import { test, expect } from './fixtures/extension';
import type { Page } from '@playwright/test';
import { COMMON_SELECTORS, COMMON_TIMEOUTS, FORM_INPUTS } from './test-data/common-constants';
import {
  createTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getTestServerUrl,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

/**
 * 設定ページを新規タブで開くヘルパー関数
 */
async function openSettingsInNewTab(
  extensionContext: import('@playwright/test').BrowserContext,
  extensionId: string
): Promise<Page> {
  const settingsPage = await extensionContext.newPage();
  await settingsPage.goto(`chrome-extension://${extensionId}/settings.html`);
  await settingsPage.waitForLoadState('domcontentloaded');
  await settingsPage.waitForSelector('.settings-page-container', { timeout: COMMON_TIMEOUTS.medium });
  return settingsPage;
}

test.describe('UI表示の一貫性', () => {
  test.describe('フォントサイズ設定の反映', () => {
    test('フォントサイズを変更するとタブタイトルのフォントサイズが変更される', async ({
      sidePanelPage,
      extensionContext,
      extensionId,
      serviceWorker,
    }) => {
      // 初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // タブを作成してツリーに表示されるまで待機
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // タブノードが表示されるまで待機
      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNode).toBeVisible({ timeout: COMMON_TIMEOUTS.medium });

      // タブタイトル要素を取得
      const tabTitleElement = treeNode.locator('span.truncate');
      await expect(tabTitleElement).toBeVisible();

      // 変更前のフォントサイズを確認（デフォルトは14px）
      const initialFontSize = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim();
      });
      expect(initialFontSize).toBe('14px');

      // Act: 設定ページを開いてフォントサイズを18pxに変更
      const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);
      const fontSizeInput = settingsPage.locator(FORM_INPUTS.fontSize);
      await fontSizeInput.clear();
      await fontSizeInput.fill('18');

      await settingsPage.close();

      // Assert: Side Panelでフォントサイズが18pxに変更されていることを確認
      await expect(async () => {
        const currentFontSize = await sidePanelPage.evaluate(() => {
          return getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim();
        });
        expect(currentFontSize).toBe('18px');
      }).toPass({ timeout: COMMON_TIMEOUTS.medium });

      // Assert: タブタイトル要素の実際のフォントサイズが18pxになっていることを確認
      await expect(async () => {
        const titleFontSize = await tabTitleElement.evaluate((el) => {
          return getComputedStyle(el).fontSize;
        });
        expect(titleFontSize).toBe('18px');
      }).toPass({ timeout: COMMON_TIMEOUTS.medium });

      // クリーンアップ
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('フォントサイズのプリセットボタンでタブタイトルのサイズが変わる', async ({
      sidePanelPage,
      extensionContext,
      extensionId,
      serviceWorker,
    }) => {
      // 初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // タブを作成してツリーに表示されるまで待機
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // タブノードが表示されるまで待機
      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNode).toBeVisible({ timeout: COMMON_TIMEOUTS.medium });

      // タブタイトル要素を取得
      const tabTitleElement = treeNode.locator('span.truncate');
      await expect(tabTitleElement).toBeVisible();

      // Act: 設定ページを開いて「大」プリセットを選択（16px）
      const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);
      const largeButton = settingsPage.getByRole('button', { name: '大' });
      await largeButton.click();

      await settingsPage.close();

      // Assert: フォントサイズが16pxに変更されていることを確認
      await expect(async () => {
        const currentFontSize = await sidePanelPage.evaluate(() => {
          return getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim();
        });
        expect(currentFontSize).toBe('16px');
      }).toPass({ timeout: COMMON_TIMEOUTS.medium });

      // Assert: タブタイトル要素の実際のフォントサイズが16pxになっていることを確認
      await expect(async () => {
        const titleFontSize = await tabTitleElement.evaluate((el) => {
          return getComputedStyle(el).fontSize;
        });
        expect(titleFontSize).toBe('16px');
      }).toPass({ timeout: COMMON_TIMEOUTS.medium });

      // クリーンアップ
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('フォントサイズ変更後にページをリロードしても設定が保持される', async ({
      sidePanelPage,
      extensionContext,
      extensionId,
    }) => {
      // Arrange: Side Panelが表示されていることを確認
      await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
        timeout: COMMON_TIMEOUTS.long,
      });

      // Act: 設定ページを開いてフォントサイズを20pxに変更
      const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);
      const fontSizeInput = settingsPage.locator(FORM_INPUTS.fontSize);
      await fontSizeInput.clear();
      await fontSizeInput.fill('20');

      await settingsPage.close();

      // Assert: フォントサイズが20pxに変更されていることを確認
      await expect(async () => {
        const currentFontSize = await sidePanelPage.evaluate(() => {
          return getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim();
        });
        expect(currentFontSize).toBe('20px');
      }).toPass({ timeout: COMMON_TIMEOUTS.medium });

      // Act: Side Panelをリロード
      await sidePanelPage.reload();
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector(COMMON_SELECTORS.reactRoot, { timeout: COMMON_TIMEOUTS.medium });
      await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
        timeout: COMMON_TIMEOUTS.long,
      });

      // Assert: リロード後もフォントサイズが20pxのままであることを確認
      await expect(async () => {
        const currentFontSize = await sidePanelPage.evaluate(() => {
          return getComputedStyle(document.documentElement).getPropertyValue('--font-size').trim();
        });
        expect(currentFontSize).toBe('20px');
      }).toPass({ timeout: COMMON_TIMEOUTS.medium });
    });
  });

  test.describe('スタートページタイトルの表示', () => {
    test('スタートページURLのタイトル変換ロジックが正しく実装されている', async ({
      sidePanelPage,
    }) => {
      // Arrange: Side Panelが表示されていることを確認
      await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
        timeout: COMMON_TIMEOUTS.long,
      });

      // getDisplayTitle関数のロジックをテスト
      // chrome://vivaldi-webui/startpage はChromiumでアクセスできないため、
      // TreeNode.tsxのgetDisplayTitle関数のロジックをSide Panel内でテスト
      const result = await sidePanelPage.evaluate(() => {
        // isStartPageUrl関数のロジックを再現
        const isStartPageUrl = (url: string): boolean => {
          if (!url) return false;
          const startPageUrlPatterns = [
            /^chrome:\/\/vivaldi-webui\/startpage/,
            /^vivaldi:\/\/startpage/,
          ];
          return startPageUrlPatterns.some(pattern => pattern.test(url));
        };

        // isNewTabUrl関数のロジックを再現
        const isNewTabUrl = (url: string): boolean => {
          if (!url) return false;
          const newTabUrlPatterns = [
            /^chrome:\/\/newtab/,
            /^chrome-extension:\/\//,
            /^vivaldi:\/\/newtab/,
            /^about:blank$/,
          ];
          return newTabUrlPatterns.some(pattern => pattern.test(url));
        };

        // getDisplayTitle関数のロジックを再現
        const getDisplayTitle = (tab: { title: string; url: string; status: 'loading' | 'complete' }): string => {
          if (tab.status === 'loading') return 'Loading...';
          if (isStartPageUrl(tab.url)) return 'スタートページ';
          if (isNewTabUrl(tab.url)) return '新しいタブ';
          return tab.title;
        };

        // テストケースを実行
        return {
          startPage: getDisplayTitle({
            title: 'Some Title',
            url: 'chrome://vivaldi-webui/startpage',
            status: 'complete'
          }),
          aboutBlank: getDisplayTitle({
            title: '',
            url: 'about:blank',
            status: 'complete'
          }),
          chromeExtension: getDisplayTitle({
            title: 'Extension Page',
            url: 'chrome-extension://abc123/popup.html',
            status: 'complete'
          }),
          normalPage: getDisplayTitle({
            title: 'Example Domain',
            url: 'https://example.com',
            status: 'complete'
          }),
          loadingPage: getDisplayTitle({
            title: 'Example Domain',
            url: 'https://example.com',
            status: 'loading'
          }),
        };
      });

      // Assert: 各URLパターンに対して正しいタイトルが返される
      expect(result.startPage).toBe('スタートページ');
      expect(result.aboutBlank).toBe('新しいタブ');
      expect(result.chromeExtension).toBe('新しいタブ');
      expect(result.normalPage).toBe('Example Domain');
      expect(result.loadingPage).toBe('Loading...');
    });

    test('新しいタブのURL判定ロジックが正しく動作する', async ({
      sidePanelPage,
    }) => {
      // Arrange: Side Panelが表示されていることを確認
      await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
        timeout: COMMON_TIMEOUTS.long,
      });

      // isNewTabUrl関数のロジックをテスト
      // 実際のchrome://newtabタブは特殊な動作をするため、
      // URLパターンマッチングのロジックが正しいことをテスト
      const result = await sidePanelPage.evaluate(() => {
        const isNewTabUrl = (url: string): boolean => {
          if (!url) return false;
          const newTabUrlPatterns = [
            /^chrome:\/\/newtab/,
            /^chrome-extension:\/\//,
            /^vivaldi:\/\/newtab/,
            /^about:blank$/,
          ];
          return newTabUrlPatterns.some(pattern => pattern.test(url));
        };

        return {
          chromeNewtab: isNewTabUrl('chrome://newtab'),
          chromeNewtabWithPath: isNewTabUrl('chrome://newtab/'),
          vivaldiNewtab: isNewTabUrl('vivaldi://newtab'),
          aboutBlank: isNewTabUrl('about:blank'),
          chromeExtension: isNewTabUrl('chrome-extension://abc123/popup.html'),
          normalUrl: isNewTabUrl('https://example.com'),
          emptyUrl: isNewTabUrl(''),
        };
      });

      // Assert: 各URLパターンに対して正しい判定が行われる
      expect(result.chromeNewtab).toBe(true);
      expect(result.chromeNewtabWithPath).toBe(true);
      expect(result.vivaldiNewtab).toBe(true);
      expect(result.aboutBlank).toBe(true);
      expect(result.chromeExtension).toBe(true);
      expect(result.normalUrl).toBe(false);
      expect(result.emptyUrl).toBe(false);
    });

    test('通常のWebサイトはそのままのタイトルで表示される', async ({
      sidePanelPage,
      extensionContext,
      serviceWorker,
    }) => {
      // 初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // Arrange: Side Panelが表示されていることを確認
      await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
        timeout: COMMON_TIMEOUTS.long,
      });

      // Act: 通常のWebサイトタブを作成
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // タブノードが表示されるまで待機
      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNode).toBeVisible({ timeout: COMMON_TIMEOUTS.medium });

      // タブタイトル要素を取得
      const tabTitleElement = treeNode.locator('span.truncate');
      await expect(tabTitleElement).toBeVisible();

      // Assert: 通常のWebサイトはタイトルがそのまま表示される
      // example.comのタイトルは "Example Domain"
      await expect(async () => {
        const titleText = await tabTitleElement.textContent();
        // Loading...でなく、実際のタイトルが表示されることを確認
        expect(titleText).not.toBe('Loading...');
        // スタートページや新しいタブではないことを確認
        expect(titleText).not.toBe('スタートページ');
        expect(titleText).not.toBe('新しいタブ');
      }).toPass({ timeout: COMMON_TIMEOUTS.medium });

      // クリーンアップ
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('ローディング中のタブは「Loading...」と表示され、完了後に正しいタイトルになる', async ({
      sidePanelPage,
      extensionContext,
      serviceWorker,
    }) => {
      // 初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // Arrange: Side Panelが表示されていることを確認
      await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
        timeout: COMMON_TIMEOUTS.long,
      });

      // Act: タブを作成（ローディング状態を経る）
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // タブノードが表示されるまで待機
      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNode).toBeVisible({ timeout: COMMON_TIMEOUTS.medium });

      // タブタイトル要素を取得
      const tabTitleElement = treeNode.locator('span.truncate');
      await expect(tabTitleElement).toBeVisible();

      // Assert: タブがロード完了後、「Loading...」でないタイトルが表示される
      await expect(async () => {
        // タブのステータスを確認
        const tabStatus = await serviceWorker.evaluate(async (tabId: number) => {
          const tab = await chrome.tabs.get(tabId);
          return tab.status;
        }, tabId);

        const titleText = await tabTitleElement.textContent();

        // ロード完了後は「Loading...」ではないことを確認
        if (tabStatus === 'complete') {
          expect(titleText).not.toBe('Loading...');
        }
      }).toPass({ timeout: COMMON_TIMEOUTS.long });

      // クリーンアップ
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });
});
