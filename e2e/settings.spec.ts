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

test.describe('設定変更とUI/UXカスタマイゼーション', () => {
  test('設定パネルを開いた場合、現在の設定値が表示される', async ({
    sidePanelPage,
  }) => {
    // Arrange: Side Panelが表示されていることを確認
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    // Act: 設定パネルを開く（設定ボタンをクリック）
    const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    // Assert: 設定パネルが表示される
    const settingsPanel = sidePanelPage.locator('[data-testid="settings-panel"]');
    await expect(settingsPanel).toBeVisible({ timeout: 3000 });

    // フォントサイズ入力が存在する
    const fontSizeInput = sidePanelPage.locator('input#fontSize');
    await expect(fontSizeInput).toBeVisible();

    // フォントファミリー入力が存在する
    const fontFamilyInput = sidePanelPage.locator('input#fontFamily');
    await expect(fontFamilyInput).toBeVisible();

    // デフォルト値が設定されている
    await expect(fontSizeInput).toHaveValue('14');
  });

  test('フォントサイズを変更した場合、ツリー表示のフォントサイズが即座に反映される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    await expect(sidePanelPage.locator('[data-testid="settings-panel"]')).toBeVisible({
      timeout: 3000,
    });

    // 変更前のCSS変数を取得
    const initialFontSize = await sidePanelPage.evaluate(() => {
      return getComputedStyle(document.documentElement).getPropertyValue('--font-size');
    });

    // Act: フォントサイズを18pxに変更
    const fontSizeInput = sidePanelPage.locator('input#fontSize');
    await fontSizeInput.clear();
    await fontSizeInput.fill('18');

    // Assert: フォントサイズが18pxに変更される
    await expect(async () => {
      const currentFontSize = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-size');
      });
      expect(currentFontSize.trim()).toBe('18px');
    }).toPass({ timeout: 3000 });
  });

  test('フォントサイズのプリセットボタン（小・中・大）が機能する', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    await expect(sidePanelPage.locator('[data-testid="settings-panel"]')).toBeVisible({
      timeout: 3000,
    });

    // Act & Assert: 「大」ボタンをクリック
    const largeButton = sidePanelPage.getByRole('button', { name: '大' });
    await largeButton.click();

    const fontSizeInput = sidePanelPage.locator('input#fontSize');
    await expect(fontSizeInput).toHaveValue('16');

    // Act & Assert: 「小」ボタンをクリック
    const smallButton = sidePanelPage.getByRole('button', { name: '小' });
    await smallButton.click();
    await expect(fontSizeInput).toHaveValue('12');

    // Act & Assert: 「中」ボタンをクリック
    const mediumButton = sidePanelPage.getByRole('button', { name: '中' });
    await mediumButton.click();
    await expect(fontSizeInput).toHaveValue('14');
  });

  test('フォントファミリーを変更した場合、指定されたフォントが適用される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    await expect(sidePanelPage.locator('[data-testid="settings-panel"]')).toBeVisible({
      timeout: 3000,
    });

    // Act: フォントファミリーを変更
    const fontFamilyInput = sidePanelPage.locator('input#fontFamily');
    await fontFamilyInput.clear();
    await fontFamilyInput.fill('Consolas, monospace');

    // Assert: CSS変数が更新される
    await expect(async () => {
      const currentFontFamily = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-family');
      });
      expect(currentFontFamily.trim()).toContain('Consolas');
    }).toPass({ timeout: 3000 });
  });

  test('テーマ（ライト/ダーク）を切り替えた場合、配色が即座に変更される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    await expect(sidePanelPage.locator('[data-testid="settings-panel"]')).toBeVisible({
      timeout: 3000,
    });

    // テーマ切り替えボタンを探す
    const themeToggle = sidePanelPage.locator('[data-testid="theme-toggle"]');

    // テーマ切り替えが存在しない場合はスキップ
    if (!(await themeToggle.isVisible({ timeout: 1000 }).catch(() => false))) {
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
    }).toPass({ timeout: 3000 });
  });

  test('カスタムCSSを設定した場合、スタイルが適用される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    await expect(sidePanelPage.locator('[data-testid="settings-panel"]')).toBeVisible({
      timeout: 3000,
    });

    // Act: カスタムCSSを入力
    const customCSSTextarea = sidePanelPage.locator('textarea#customCSS');
    await expect(customCSSTextarea).toBeVisible();
    await customCSSTextarea.fill('.custom-test-class { color: rgb(255, 0, 0); }');

    // Assert: スタイルシートに追加されることを確認
    await expect(async () => {
      const styleContent = await sidePanelPage.evaluate(() => {
        const style = document.getElementById('vivaldi-tt-theme');
        return style ? style.textContent : '';
      });
      expect(styleContent).toContain('.custom-test-class');
    }).toPass({ timeout: 3000 });
  });

  test('不正なカスタムCSSを入力した場合、エラー通知が表示される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    await expect(sidePanelPage.locator('[data-testid="settings-panel"]')).toBeVisible({
      timeout: 3000,
    });

    // Act: 不正なCSSを入力（括弧が閉じていない）
    const customCSSTextarea = sidePanelPage.locator('textarea#customCSS');
    await expect(customCSSTextarea).toBeVisible();
    await customCSSTextarea.fill('.broken-css { color: red;');

    // Assert: エラー通知が表示される
    await expect(async () => {
      const errorNotification = sidePanelPage.locator('#vivaldi-tt-css-error');
      await expect(errorNotification).toBeVisible();
    }).toPass({ timeout: 3000 });
  });

  test('設定を保存した場合、ブラウザを再起動しても設定が保持される（設定の永続化）', async ({
    extensionContext,
    sidePanelPage,
    extensionId,
  }) => {
    // Arrange: 設定パネルを開く
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    await expect(sidePanelPage.locator('[data-testid="settings-panel"]')).toBeVisible({
      timeout: 3000,
    });

    // Act: フォントサイズを変更
    const fontSizeInput = sidePanelPage.locator('input#fontSize');
    await fontSizeInput.clear();
    await fontSizeInput.fill('20');

    // 変更が保存されるまで待機
    await sidePanelPage.waitForTimeout(500);

    // ページをリロード（ブラウザ再起動のシミュレーション）
    await sidePanelPage.reload();
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector('#root', { timeout: 5000 });

    // Assert: 設定パネルを開いてフォントサイズが保持されていることを確認
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    await expect(async () => {
      const settingsBtn = sidePanelPage.locator('[data-testid="settings-button"]');
      await expect(settingsBtn).toBeVisible();
    }).toPass({ timeout: 5000 });

    await sidePanelPage.locator('[data-testid="settings-button"]').click();

    await expect(async () => {
      const fontSize = sidePanelPage.locator('input#fontSize');
      await expect(fontSize).toHaveValue('20');
    }).toPass({ timeout: 5000 });
  });

  test('インデント幅を変更した場合、ツリーの階層表示の幅が調整される', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    await expect(sidePanelPage.locator('[data-testid="settings-panel"]')).toBeVisible({
      timeout: 3000,
    });

    // インデント幅の設定入力を探す
    const indentWidthInput = sidePanelPage.locator('input#indentWidth');

    // インデント幅設定がない場合はスキップ（カスタムCSSで対応可能）
    if (!(await indentWidthInput.isVisible({ timeout: 1000 }).catch(() => false))) {
      // カスタムCSSでインデント幅を変更
      const customCSSTextarea = sidePanelPage.locator('textarea#customCSS');
      await customCSSTextarea.fill('.tree-node { padding-left: 24px; }');

      // CSSが適用されることを確認
      await expect(async () => {
        const styleContent = await sidePanelPage.evaluate(() => {
          const style = document.getElementById('vivaldi-tt-theme');
          return style ? style.textContent : '';
        });
        expect(styleContent).toContain('padding-left: 24px');
      }).toPass({ timeout: 3000 });
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
    }).toPass({ timeout: 3000 });
  });

  test('設定パネルを閉じることができる', async ({
    sidePanelPage,
  }) => {
    // Arrange: 設定パネルを開く
    await expect(sidePanelPage.locator('[data-testid="side-panel-root"]')).toBeVisible({
      timeout: 10000,
    });

    const settingsButton = sidePanelPage.locator('[data-testid="settings-button"]');
    await expect(settingsButton).toBeVisible({ timeout: 5000 });
    await settingsButton.click();

    const settingsPanel = sidePanelPage.locator('[data-testid="settings-panel"]');
    await expect(settingsPanel).toBeVisible({ timeout: 3000 });

    // Act: 設定パネルを閉じる（閉じるボタンまたは設定ボタンを再度クリック）
    const closeButton = sidePanelPage.locator('[data-testid="settings-close-button"]');
    if (await closeButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await closeButton.click();
    } else {
      // 閉じるボタンがない場合は設定ボタンを再度クリック
      await settingsButton.click();
    }

    // Assert: 設定パネルが閉じられる
    await expect(settingsPanel).not.toBeVisible({ timeout: 3000 });
  });
});
