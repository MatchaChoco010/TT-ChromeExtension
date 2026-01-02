/**
 * Settings E2E Tests
 *
 * 設定変更とUI/UXカスタマイゼーションの E2E テスト
 *
 * 設定ページへのアクセスは直接URLまたはポップアップメニューから行う
 *
 * 設定変更とUI/UXカスタマイゼーション
 * - 設定画面はブラウザタブの全幅を利用
 * - フォントサイズ変更
 * - フォントファミリー変更
 * - カスタムCSS設定
 * - 設定の永続化
 *
 * 設定タブの名前表示
 * - 設定ページのタブタイトルに「設定」と表示される
 * - 「新しいタブ」ではなく適切な名前が表示される
 */

import { test, expect } from './fixtures/extension';
import type { Page, Worker } from '@playwright/test';
import { COMMON_SELECTORS, COMMON_TIMEOUTS, FORM_INPUTS } from './test-data/common-constants';
import { waitForCondition } from './utils/polling-utils';

/**
 * 設定ページを新規タブで開くヘルパー関数
 *
 * 設定ページのURLに直接アクセスして開く
 * （ポップアップメニューからもアクセス可能）
 *
 * @param extensionContext - BrowserContext
 * @param extensionId - 拡張機能のID
 * @returns 設定ページのPage
 */
async function openSettingsInNewTab(
  extensionContext: import('@playwright/test').BrowserContext,
  extensionId: string
): Promise<Page> {
  // 設定ページを新規タブで直接開く
  const settingsPage = await extensionContext.newPage();
  await settingsPage.goto(`chrome-extension://${extensionId}/settings.html`);

  // 設定ページが読み込まれるまで待機
  await settingsPage.waitForLoadState('domcontentloaded');
  await settingsPage.waitForSelector('.settings-page-container', { timeout: COMMON_TIMEOUTS.medium });

  return settingsPage;
}

test.describe('設定変更とUI/UXカスタマイゼーション', () => {
  test('サイドパネルに設定ボタンが存在しない', async ({
    sidePanelPage,
  }) => {
    // Arrange: Side Panelが表示されていることを確認
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    // Assert: 設定ボタンがサイドパネルに存在しないことを確認
    const openSettingsButton = sidePanelPage.locator('[data-testid="open-settings-button"]');
    await expect(openSettingsButton).not.toBeVisible();
  });

  test('設定ページが直接URLでアクセスできる', async ({
    extensionContext,
    extensionId,
  }) => {
    // Act: 設定ページを直接URLで開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // Assert: 設定ページが正しいURLで開かれる
    expect(settingsPage.url()).toContain(`chrome-extension://${extensionId}/settings.html`);

    // Assert: 設定ページに設定見出しが表示される
    await expect(settingsPage.getByRole('heading', { name: '設定' })).toBeVisible({
      timeout: COMMON_TIMEOUTS.short,
    });

    // クリーンアップ
    await settingsPage.close();
  });

  test('設定ページがブラウザタブの全幅を利用できるレイアウトで表示される', async ({
    extensionContext,
    extensionId,
  }) => {
    // Act: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // Assert: 設定ページコンテナが全幅レイアウト用のクラスを持つ
    const container = settingsPage.locator('.settings-page-container');
    await expect(container).toBeVisible();
    await expect(container).toHaveClass(/min-h-screen/);

    // クリーンアップ
    await settingsPage.close();
  });

  test('設定ページで現在の設定値が表示される', async ({
    extensionContext,
    extensionId,
  }) => {
    // Act: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // Assert: フォントサイズ入力が存在する
    const fontSizeInput = settingsPage.locator(FORM_INPUTS.fontSize);
    await expect(fontSizeInput).toBeVisible();

    // フォントファミリー入力が存在する
    const fontFamilyInput = settingsPage.locator(FORM_INPUTS.fontFamily);
    await expect(fontFamilyInput).toBeVisible();

    // デフォルト値が設定されている
    await expect(fontSizeInput).toHaveValue('14');

    // クリーンアップ
    await settingsPage.close();
  });

  test('フォントサイズを変更した場合、設定が保存される', async ({
    sidePanelPage,
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    // Arrange: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // Act: フォントサイズを18pxに変更
    const fontSizeInput = settingsPage.locator(FORM_INPUTS.fontSize);
    await fontSizeInput.clear();
    await fontSizeInput.fill('18');

    // 設定がストレージに保存されるまでポーリングで待機
    await waitForCondition(
      async () => {
        const settings = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('user_settings');
          return result.user_settings as { fontSize?: number } | undefined;
        });
        return settings?.fontSize === 18;
      },
      { timeout: 3000, interval: 50, timeoutMessage: 'Font size setting was not saved' }
    );

    // クリーンアップ
    await settingsPage.close();

    // Assert: Side Panelでフォントサイズが反映されていることを確認
    await expect(async () => {
      const currentFontSize = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-size');
      });
      expect(currentFontSize.trim()).toBe('18px');
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });
  });

  test('フォントサイズのプリセットボタン（小・中・大）が機能する', async ({
    extensionContext,
    extensionId,
  }) => {
    // Arrange: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // Act & Assert: 「大」ボタンをクリック
    const largeButton = settingsPage.getByRole('button', { name: '大' });
    await largeButton.click();

    const fontSizeInput = settingsPage.locator(FORM_INPUTS.fontSize);
    await expect(async () => {
      await expect(fontSizeInput).toHaveValue('16');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });

    // Act & Assert: 「小」ボタンをクリック
    const smallButton = settingsPage.getByRole('button', { name: '小' });
    await smallButton.click();
    await expect(async () => {
      await expect(fontSizeInput).toHaveValue('12');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });

    // Act & Assert: 「中」ボタンをクリック
    const mediumButton = settingsPage.getByRole('button', { name: '中' });
    await mediumButton.click();
    await expect(async () => {
      await expect(fontSizeInput).toHaveValue('14');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });

    // クリーンアップ
    await settingsPage.close();
  });

  test('フォントファミリーを変更した場合、設定が保存される', async ({
    sidePanelPage,
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    // Arrange: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // Act: フォントファミリーを変更
    const fontFamilyInput = settingsPage.locator(FORM_INPUTS.fontFamily);
    await fontFamilyInput.clear();
    await fontFamilyInput.fill('Consolas, monospace');

    // 設定がストレージに保存されるまでポーリングで待機
    await waitForCondition(
      async () => {
        const settings = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('user_settings');
          return result.user_settings as { fontFamily?: string } | undefined;
        });
        return settings?.fontFamily?.includes('Consolas') ?? false;
      },
      { timeout: 3000, interval: 50, timeoutMessage: 'Font family setting was not saved' }
    );

    // クリーンアップ
    await settingsPage.close();

    // Assert: Side PanelでCSS変数が更新されることを確認
    await expect(async () => {
      const currentFontFamily = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-family');
      });
      expect(currentFontFamily.trim()).toContain('Consolas');
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });
  });

  test('カスタムCSSを設定した場合、Side Panelに適用される', async ({
    sidePanelPage,
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    // Arrange: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // Act: カスタムCSSを入力
    const customCSSTextarea = settingsPage.locator(FORM_INPUTS.customCSS);
    await expect(customCSSTextarea).toBeVisible();
    await customCSSTextarea.fill('.custom-test-class { color: rgb(255, 0, 0); }');

    // 設定がストレージに保存されるまでポーリングで待機
    await waitForCondition(
      async () => {
        const settings = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('user_settings');
          return result.user_settings as { customCSS?: string } | undefined;
        });
        return settings?.customCSS?.includes('.custom-test-class') ?? false;
      },
      { timeout: 3000, interval: 50, timeoutMessage: 'Custom CSS setting was not saved' }
    );

    // クリーンアップ
    await settingsPage.close();

    // Assert: Side Panelでスタイルシートに追加されることを確認
    await expect(async () => {
      const styleContent = await sidePanelPage.evaluate(() => {
        const style = document.getElementById('vivaldi-tt-theme');
        return style ? style.textContent : '';
      });
      expect(styleContent).toContain('.custom-test-class');
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });
  });

  test('設定を保存した場合、ブラウザを再起動しても設定が保持される（設定の永続化）', async ({
    sidePanelPage,
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    // Arrange: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // Act: フォントサイズを変更
    const fontSizeInput = settingsPage.locator(FORM_INPUTS.fontSize);
    await fontSizeInput.clear();
    await fontSizeInput.fill('20');

    // 設定がストレージに保存されるまでポーリングで待機
    await waitForCondition(
      async () => {
        const settings = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('user_settings');
          return result.user_settings as { fontSize?: number } | undefined;
        });
        return settings?.fontSize === 20;
      },
      { timeout: 3000, interval: 50, timeoutMessage: 'Font size setting was not saved' }
    );

    // 設定ページを閉じる
    await settingsPage.close();

    // Side Panelでフォントサイズが反映されていることを確認
    await expect(async () => {
      const currentFontSize = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-size');
      });
      expect(currentFontSize.trim()).toBe('20px');
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });

    // ページをリロード（ブラウザ再起動のシミュレーション）
    await sidePanelPage.reload();
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector(COMMON_SELECTORS.reactRoot, { timeout: COMMON_TIMEOUTS.medium });

    // Assert: リロード後もフォントサイズが保持されていることを確認
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    await expect(async () => {
      const currentFontSize = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-size');
      });
      expect(currentFontSize.trim()).toBe('20px');
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });
  });

  test('サイドパネル内には設定パネルが表示されない', async ({
    sidePanelPage,
  }) => {
    // Assert: Side Panelに設定パネル（data-testid="settings-panel"）が存在しない
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    // 設定パネルがサイドパネル内に存在しないことを確認
    const settingsPanel = sidePanelPage.locator(COMMON_SELECTORS.settingsPanel);
    await expect(settingsPanel).not.toBeVisible();

    // 設定ボタンはサイドパネルから削除された（ポップアップメニューからアクセス）
    const openSettingsButton = sidePanelPage.locator('[data-testid="open-settings-button"]');
    await expect(openSettingsButton).not.toBeVisible();
  });
});

/**
 * 設定タブの名前表示
 * 設定ページのタブタイトルが適切に表示されることをテスト
 *
 * タイトルを英語「Settings」に統一
 */
test.describe('設定タブの名前表示', () => {
  test('設定ページのタブタイトルが「Settings」である', async ({
    extensionContext,
    extensionId,
  }) => {
    // Arrange & Act: 設定ページを新規タブで開く
    const settingsPage = await extensionContext.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/settings.html`);
    await settingsPage.waitForLoadState('domcontentloaded');

    // Assert: タブタイトルが「Settings」であることを確認
    const title = await settingsPage.title();
    expect(title).toBe('Settings');
    expect(title).not.toBe('新しいタブ');
    expect(title).not.toBe('New Tab');

    // クリーンアップ
    await settingsPage.close();
  });

  test('設定ページのタブタイトルが「新しいタブ」ではない', async ({
    extensionContext,
    extensionId,
  }) => {
    // Arrange & Act: 設定ページを開く
    const settingsPage = await extensionContext.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/settings.html`);
    await settingsPage.waitForLoadState('domcontentloaded');

    // Assert: タブタイトルが「新しいタブ」でないことを確認
    await expect(async () => {
      const title = await settingsPage.title();
      expect(title).not.toBe('新しいタブ');
      expect(title).not.toBe('New Tab');
      expect(title.length).toBeGreaterThan(0);
    }).toPass({ timeout: COMMON_TIMEOUTS.short });

    // クリーンアップ
    await settingsPage.close();
  });
});

/**
 * スナップショット自動保存設定のE2Eテスト
 * スナップショット自動保存設定が保存・反映されることをテスト
 */
test.describe('スナップショット自動保存設定', () => {
  test('スナップショット自動保存のトグルが機能する', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    // Arrange: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // Assert: 初期状態で自動保存が無効（autoSnapshotInterval = 0）
    const autoSnapshotToggle = settingsPage.locator('#autoSnapshotEnabled');
    await expect(autoSnapshotToggle).toBeVisible();
    await expect(autoSnapshotToggle).toHaveAttribute('aria-checked', 'false');

    // Act: 自動保存を有効にする
    await autoSnapshotToggle.click();

    // Assert: トグルが有効になる
    await expect(autoSnapshotToggle).toHaveAttribute('aria-checked', 'true');

    // Assert: 設定がストレージに保存される
    await expect(async () => {
      const settings = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('user_settings');
        return result.user_settings as { autoSnapshotInterval?: number } | undefined;
      });
      expect(settings?.autoSnapshotInterval).toBeGreaterThan(0);
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });

    // クリーンアップ
    await settingsPage.close();
  });

  test('スナップショット自動保存の間隔設定が保存される', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    // Arrange: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // 自動保存を有効にする
    const autoSnapshotToggle = settingsPage.locator('#autoSnapshotEnabled');
    await autoSnapshotToggle.click();
    await expect(autoSnapshotToggle).toHaveAttribute('aria-checked', 'true');

    // Act: 自動保存間隔を30分に変更
    const intervalInput = settingsPage.locator('#autoSnapshotInterval');
    await expect(intervalInput).toBeEnabled();
    await intervalInput.clear();
    await intervalInput.fill('30');

    // Assert: 間隔設定がストレージに保存される
    await expect(async () => {
      const settings = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('user_settings');
        return result.user_settings as { autoSnapshotInterval?: number } | undefined;
      });
      expect(settings?.autoSnapshotInterval).toBe(30);
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });

    // クリーンアップ
    await settingsPage.close();
  });

  test('最大スナップショット数の設定が保存される', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    // Arrange: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // 自動保存を有効にする
    const autoSnapshotToggle = settingsPage.locator('#autoSnapshotEnabled');
    await autoSnapshotToggle.click();
    await expect(autoSnapshotToggle).toHaveAttribute('aria-checked', 'true');

    // Act: 最大スナップショット数を20に変更
    const maxSnapshotsInput = settingsPage.locator('#maxSnapshots');
    await expect(maxSnapshotsInput).toBeEnabled();
    await maxSnapshotsInput.clear();
    await maxSnapshotsInput.fill('20');

    // Assert: 最大スナップショット数がストレージに保存される
    await expect(async () => {
      const settings = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('user_settings');
        return result.user_settings as { maxSnapshots?: number } | undefined;
      });
      expect(settings?.maxSnapshots).toBe(20);
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });

    // クリーンアップ
    await settingsPage.close();
  });

  test('自動保存無効時は間隔と最大数の入力が無効化される', async ({
    extensionContext,
    extensionId,
  }) => {
    // Arrange: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // Assert: 初期状態（自動保存無効）で入力フィールドが無効
    const intervalInput = settingsPage.locator('#autoSnapshotInterval');
    const maxSnapshotsInput = settingsPage.locator('#maxSnapshots');
    await expect(intervalInput).toBeDisabled();
    await expect(maxSnapshotsInput).toBeDisabled();

    // Act: 自動保存を有効にする
    const autoSnapshotToggle = settingsPage.locator('#autoSnapshotEnabled');
    await autoSnapshotToggle.click();

    // Assert: 入力フィールドが有効になる
    await expect(intervalInput).toBeEnabled();
    await expect(maxSnapshotsInput).toBeEnabled();

    // Act: 自動保存を無効にする
    await autoSnapshotToggle.click();

    // Assert: 入力フィールドが再び無効になる
    await expect(intervalInput).toBeDisabled();
    await expect(maxSnapshotsInput).toBeDisabled();

    // クリーンアップ
    await settingsPage.close();
  });

  test('スナップショット自動保存設定がブラウザ再起動後も保持される', async ({
    sidePanelPage,
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    // Arrange: 設定ページを開く
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    // 自動保存を有効にして設定を変更
    const autoSnapshotToggle = settingsPage.locator('#autoSnapshotEnabled');
    await autoSnapshotToggle.click();
    await expect(autoSnapshotToggle).toHaveAttribute('aria-checked', 'true');

    const intervalInput = settingsPage.locator('#autoSnapshotInterval');
    await intervalInput.clear();
    await intervalInput.fill('15');

    const maxSnapshotsInput = settingsPage.locator('#maxSnapshots');
    await maxSnapshotsInput.clear();
    await maxSnapshotsInput.fill('25');

    // 設定がストレージに保存されるまでポーリングで待機
    await waitForCondition(
      async () => {
        const settings = await serviceWorker.evaluate(async () => {
          const result = await chrome.storage.local.get('user_settings');
          return result.user_settings as { autoSnapshotInterval?: number; maxSnapshots?: number } | undefined;
        });
        return settings?.autoSnapshotInterval === 15 && settings?.maxSnapshots === 25;
      },
      { timeout: 3000, interval: 50, timeoutMessage: 'Snapshot settings were not saved' }
    );

    // 設定ページを閉じる
    await settingsPage.close();

    // ページをリロード（ブラウザ再起動のシミュレーション）
    await sidePanelPage.reload();
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector(COMMON_SELECTORS.reactRoot, { timeout: COMMON_TIMEOUTS.medium });
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    // 再度設定ページを開く
    const settingsPageAfterReload = await openSettingsInNewTab(extensionContext, extensionId);

    // Assert: 設定が保持されていることを確認
    const toggleAfterReload = settingsPageAfterReload.locator('#autoSnapshotEnabled');
    await expect(toggleAfterReload).toHaveAttribute('aria-checked', 'true');

    const intervalAfterReload = settingsPageAfterReload.locator('#autoSnapshotInterval');
    await expect(intervalAfterReload).toHaveValue('15');

    const maxSnapshotsAfterReload = settingsPageAfterReload.locator('#maxSnapshots');
    await expect(maxSnapshotsAfterReload).toHaveValue('25');

    // クリーンアップ
    await settingsPageAfterReload.close();
  });
});
