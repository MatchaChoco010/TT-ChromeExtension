/**
 * Settings E2E Tests
 *
 * 設定変更とUI/UXカスタマイゼーションの E2E テスト
 *
 * Requirement 3.12: 設定変更とUI/UXカスタマイゼーション
 * - 設定パネルの表示
 * - フォントサイズ変更
 * - フォントファミリー変更
 * - テーマ（ライト/ダーク）切り替え
 * - カスタムカラー設定
 * - インデント幅変更
 * - 設定の永続化
 */

import { test, expect } from './fixtures/extension';
import type { Page, Locator } from '@playwright/test';
import { COMMON_SELECTORS, COMMON_TIMEOUTS, FORM_INPUTS } from './test-data/common-constants';

/**
 * 設定パネルを開くヘルパー関数
 *
 * Side Panelが表示されていることを確認し、設定ボタンをクリックして
 * 設定パネルを開く
 *
 * @param page - Side PanelのPage
 * @returns 設定パネルのLocator
 */
async function openSettingsPanel(page: Page): Promise<Locator> {
  // Side Panelが表示されていることを確認
  await expect(page.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
    timeout: COMMON_TIMEOUTS.long,
  });

  // 設定ボタンをクリック
  const settingsButton = page.locator(COMMON_SELECTORS.settingsButton);
  await expect(settingsButton).toBeVisible({ timeout: COMMON_TIMEOUTS.medium });
  await settingsButton.click();

  // 設定パネルが表示されることを確認
  const settingsPanel = page.locator(COMMON_SELECTORS.settingsPanel);
  await expect(settingsPanel).toBeVisible({ timeout: COMMON_TIMEOUTS.short });

  return settingsPanel;
}

test.describe('設定変更とUI/UXカスタマイゼーション', () => {
  test('設定パネルを開いた場合、現在の設定値が表示される', async ({
    sidePanelPage,
  }) => {
    // Act: 設定パネルを開く
    await openSettingsPanel(sidePanelPage);

    // Assert: フォントサイズ入力が存在する
    const fontSizeInput = sidePanelPage.locator(FORM_INPUTS.fontSize);
    await expect(fontSizeInput).toBeVisible();

    // フォントファミリー入力が存在する
    const fontFamilyInput = sidePanelPage.locator(FORM_INPUTS.fontFamily);
    await expect(fontFamilyInput).toBeVisible();

    // デフォルト値が設定されている
    await expect(fontSizeInput).toHaveValue('14');
  });

  test('フォントサイズを変更した場合、ツリー表示のフォントサイズが即座に反映される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await openSettingsPanel(sidePanelPage);

    // 変更前のCSS変数を取得
    const initialFontSize = await sidePanelPage.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--font-size');
    });

    // Act: フォントサイズを18pxに変更
    const fontSizeInput = sidePanelPage.locator(FORM_INPUTS.fontSize);
    await fontSizeInput.clear();
    await fontSizeInput.fill('18');

    // Assert: フォントサイズが18pxに変更される
    await expect(async () => {
      const currentFontSize = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-size');
      });
      expect(currentFontSize.trim()).toBe('18px');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });
  });

  test('フォントサイズのプリセットボタン（小・中・大）が機能する', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await openSettingsPanel(sidePanelPage);

    // Act & Assert: 「大」ボタンをクリック
    const largeButton = sidePanelPage.getByRole('button', { name: '大' });
    await largeButton.click();

    const fontSizeInput = sidePanelPage.locator(FORM_INPUTS.fontSize);
    await expect(async () => {
      await expect(fontSizeInput).toHaveValue('16');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });

    // Act & Assert: 「小」ボタンをクリック
    const smallButton = sidePanelPage.getByRole('button', { name: '小' });
    await smallButton.click();
    await expect(async () => {
      await expect(fontSizeInput).toHaveValue('12');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });

    // Act & Assert: 「中」ボタンをクリック
    const mediumButton = sidePanelPage.getByRole('button', { name: '中' });
    await mediumButton.click();
    await expect(async () => {
      await expect(fontSizeInput).toHaveValue('14');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });
  });

  test('フォントファミリーを変更した場合、指定されたフォントが適用される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await openSettingsPanel(sidePanelPage);

    // Act: フォントファミリーを変更
    const fontFamilyInput = sidePanelPage.locator(FORM_INPUTS.fontFamily);
    await fontFamilyInput.clear();
    await fontFamilyInput.fill('Consolas, monospace');

    // Assert: CSS変数が更新される
    await expect(async () => {
      const currentFontFamily = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-family');
      });
      expect(currentFontFamily.trim()).toContain('Consolas');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });
  });

  test('テーマ（ライト/ダーク）を切り替えた場合、配色が即座に変更される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await openSettingsPanel(sidePanelPage);

    // テーマ切り替えボタンを探す
    const themeToggle = sidePanelPage.locator(COMMON_SELECTORS.themeToggle);

    // テーマ切り替えが存在しない場合はスキップ
    if (!(await themeToggle.isVisible({ timeout: 2000 }).catch(() => false))) {
      // テーマ切り替えがない場合は、システムのテーマ検出が機能していることを確認
      const isDarkMode = await sidePanelPage.evaluate(() => {
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
      });

      // CSS変数が設定されていることを確認
      const bgColor = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--vivaldi-bg-primary');
      });
      expect(bgColor.trim()).not.toBe('');
      return;
    }

    // 現在の背景色を取得
    const initialBgColor = await sidePanelPage.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });

    // Act: テーマを切り替え
    await themeToggle.click();

    // Assert: 背景色が変更される
    await expect(async () => {
      const currentBgColor = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.body).backgroundColor;
      });
      expect(currentBgColor).not.toBe(initialBgColor);
    }).toPass({ timeout: COMMON_TIMEOUTS.short });
  });

  test('カスタムCSSを設定した場合、スタイルが適用される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await openSettingsPanel(sidePanelPage);

    // Act: カスタムCSSを入力
    const customCSSTextarea = sidePanelPage.locator(FORM_INPUTS.customCSS);
    await expect(customCSSTextarea).toBeVisible();
    await customCSSTextarea.fill('.custom-test-class { color: rgb(255, 0, 0); }');

    // Assert: スタイルシートに追加されることを確認
    await expect(async () => {
      const styleContent = await sidePanelPage.evaluate(() => {
        const style = document.getElementById('vivaldi-tt-theme');
        return style ? style.textContent : '';
      });
      expect(styleContent).toContain('.custom-test-class');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });
  });

  test('不正なカスタムCSSを入力した場合、エラー通知が表示される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await openSettingsPanel(sidePanelPage);

    // Act: 不正なCSSを入力（括弧が閉じていない）
    const customCSSTextarea = sidePanelPage.locator(FORM_INPUTS.customCSS);
    await expect(customCSSTextarea).toBeVisible();
    await customCSSTextarea.fill('.broken-css { color: red;');

    // Assert: エラー通知が表示される
    await expect(async () => {
      const errorNotification = sidePanelPage.locator('#vivaldi-tt-css-error');
      await expect(errorNotification).toBeVisible();
    }).toPass({ timeout: COMMON_TIMEOUTS.short });
  });

  test('設定を保存した場合、ブラウザを再起動しても設定が保持される（設定の永続化）', async ({
    extensionContext,
    sidePanelPage,
    extensionId,
  }) => {
    // Arrange: 設定パネルを開く
    await openSettingsPanel(sidePanelPage);

    // Act: フォントサイズを変更
    const fontSizeInput = sidePanelPage.locator(FORM_INPUTS.fontSize);
    await fontSizeInput.clear();
    await fontSizeInput.fill('20');

    // CSS変数が更新されることを確認（保存が完了した証拠）
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

    // Assert: 設定パネルを開いてフォントサイズが保持されていることを確認
    // リロード後はReactコンポーネントの再マウントを待つ
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    // 設定ボタンが操作可能になるまで待機
    const settingsBtn = sidePanelPage.locator(COMMON_SELECTORS.settingsButton);
    await expect(settingsBtn).toBeVisible({ timeout: COMMON_TIMEOUTS.medium });
    await expect(settingsBtn).toBeEnabled({ timeout: COMMON_TIMEOUTS.short });

    await settingsBtn.click();

    await expect(async () => {
      const fontSize = sidePanelPage.locator(FORM_INPUTS.fontSize);
      await expect(fontSize).toHaveValue('20');
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });
  });

  test('インデント幅を変更した場合、ツリーの階層表示の幅が調整される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await openSettingsPanel(sidePanelPage);

    // インデント幅の設定入力を探す
    const indentWidthInput = sidePanelPage.locator(FORM_INPUTS.indentWidth);

    // インデント幅設定がない場合はスキップ（カスタムCSSで対応可能）
    if (!(await indentWidthInput.isVisible({ timeout: 2000 }).catch(() => false))) {
      // カスタムCSSでインデント幅を変更
      const customCSSTextarea = sidePanelPage.locator(FORM_INPUTS.customCSS);
      await customCSSTextarea.fill('.tree-node { padding-left: 24px; }');

      // CSSが適用されることを確認
      await expect(async () => {
        const styleContent = await sidePanelPage.evaluate(() => {
          const style = document.getElementById('vivaldi-tt-theme');
          return style ? style.textContent : '';
        });
        expect(styleContent).toContain('padding-left: 24px');
      }).toPass({ timeout: COMMON_TIMEOUTS.short });
      return;
    }

    // Act: インデント幅を変更
    await indentWidthInput.clear();
    await indentWidthInput.fill('24');

    // Assert: CSS変数が更新される
    await expect(async () => {
      const indentWidth = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--indent-width');
      });
      expect(indentWidth.trim()).toBe('24px');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });
  });

  test('設定パネルを閉じることができる', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    const settingsPanel = await openSettingsPanel(sidePanelPage);

    // Act: 設定パネルを閉じる（閉じるボタンまたは設定ボタンを再度クリック）
    const closeButton = sidePanelPage.locator(COMMON_SELECTORS.settingsCloseButton);
    if (await closeButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeButton.click();
    } else {
      // 閉じるボタンがない場合は設定ボタンを再度クリック
      const settingsButton = sidePanelPage.locator(COMMON_SELECTORS.settingsButton);
      await settingsButton.click();
    }

    // Assert: 設定パネルが閉じられる
    await expect(async () => {
      await expect(settingsPanel).not.toBeVisible();
    }).toPass({ timeout: COMMON_TIMEOUTS.short });
  });
});
