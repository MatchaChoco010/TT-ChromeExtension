import { test, expect } from './fixtures/extension';
import type { Page } from '@playwright/test';
import { COMMON_SELECTORS, COMMON_TIMEOUTS, FORM_INPUTS } from './test-data/common-constants';
import { waitForCondition } from './utils/polling-utils';
import { getCurrentWindowId } from './utils/tab-utils';
import { setupWindow } from './utils/setup-utils';

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

test.describe('設定変更とUI/UXカスタマイゼーション', () => {
  test('サイドパネルに設定ボタンが存在しない', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // Arrange
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    // Assert
    const openSettingsButton = sidePanelPage.locator('[data-testid="open-settings-button"]');
    await expect(openSettingsButton).not.toBeVisible();
  });

  test('設定ページが直接URLでアクセスできる', async ({
    extensionContext,
    extensionId,
  }) => {
    // Act
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    expect(settingsPage.url()).toContain(`chrome-extension://${extensionId}/settings.html`);

    await expect(settingsPage.getByRole('heading', { name: '設定' })).toBeVisible({
      timeout: COMMON_TIMEOUTS.short,
    });

    await settingsPage.close();
  });

  test('設定ページがブラウザタブの全幅を利用できるレイアウトで表示される', async ({
    extensionContext,
    extensionId,
  }) => {
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const container = settingsPage.locator('.settings-page-container');
    await expect(container).toBeVisible();
    await expect(container).toHaveClass(/min-h-screen/);

    await settingsPage.close();
  });

  test('設定ページで現在の設定値が表示される', async ({
    extensionContext,
    extensionId,
  }) => {
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const fontSizeInput = settingsPage.locator(FORM_INPUTS.fontSize);
    await expect(fontSizeInput).toBeVisible();

    const fontFamilyInput = settingsPage.locator(FORM_INPUTS.fontFamily);
    await expect(fontFamilyInput).toBeVisible();

    await expect(fontSizeInput).toHaveValue('14');

    await settingsPage.close();
  });

  test('フォントサイズを変更した場合、設定が保存される', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const fontSizeInput = settingsPage.locator(FORM_INPUTS.fontSize);
    await fontSizeInput.clear();
    await fontSizeInput.fill('18');

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

    await settingsPage.close();

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
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const largeButton = settingsPage.getByRole('button', { name: '大' });
    await largeButton.click();

    const fontSizeInput = settingsPage.locator(FORM_INPUTS.fontSize);
    await expect(async () => {
      await expect(fontSizeInput).toHaveValue('16');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });

    const smallButton = settingsPage.getByRole('button', { name: '小' });
    await smallButton.click();
    await expect(async () => {
      await expect(fontSizeInput).toHaveValue('12');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });

    const mediumButton = settingsPage.getByRole('button', { name: '中' });
    await mediumButton.click();
    await expect(async () => {
      await expect(fontSizeInput).toHaveValue('14');
    }).toPass({ timeout: COMMON_TIMEOUTS.short });

    await settingsPage.close();
  });

  test('フォントファミリーを変更した場合、設定が保存される', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const fontFamilyInput = settingsPage.locator(FORM_INPUTS.fontFamily);
    await fontFamilyInput.clear();
    await fontFamilyInput.fill('Consolas, monospace');

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

    await settingsPage.close();

    await expect(async () => {
      const currentFontFamily = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-family');
      });
      expect(currentFontFamily.trim()).toContain('Consolas');
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });
  });

  test('カスタムCSSを設定した場合、Side Panelに適用される', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const customCSSTextarea = settingsPage.locator(FORM_INPUTS.customCSS);
    await expect(customCSSTextarea).toBeVisible();
    await customCSSTextarea.fill('.custom-test-class { color: rgb(255, 0, 0); }');

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

    await settingsPage.close();

    await expect(async () => {
      const styleContent = await sidePanelPage.evaluate(() => {
        const style = document.getElementById('vivaldi-tt-theme');
        return style ? style.textContent : '';
      });
      expect(styleContent).toContain('.custom-test-class');
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });
  });

  test('設定を保存した場合、ブラウザを再起動しても設定が保持される（設定の永続化）', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const fontSizeInput = settingsPage.locator(FORM_INPUTS.fontSize);
    await fontSizeInput.clear();
    await fontSizeInput.fill('20');

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

    await settingsPage.close();

    await expect(async () => {
      const currentFontSize = await sidePanelPage.evaluate(() => {
        return getComputedStyle(document.documentElement).getPropertyValue('--font-size');
      });
      expect(currentFontSize.trim()).toBe('20px');
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });

    await sidePanelPage.reload();
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector(COMMON_SELECTORS.reactRoot, { timeout: COMMON_TIMEOUTS.medium });

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
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    const settingsPanel = sidePanelPage.locator(COMMON_SELECTORS.settingsPanel);
    await expect(settingsPanel).not.toBeVisible();

    const openSettingsButton = sidePanelPage.locator('[data-testid="open-settings-button"]');
    await expect(openSettingsButton).not.toBeVisible();
  });
});

test.describe('設定タブの名前表示', () => {
  test('設定ページのタブタイトルが「Settings」である', async ({
    extensionContext,
    extensionId,
  }) => {
    const settingsPage = await extensionContext.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/settings.html`);
    await settingsPage.waitForLoadState('domcontentloaded');

    const title = await settingsPage.title();
    expect(title).toBe('Settings');
    expect(title).not.toBe('新しいタブ');
    expect(title).not.toBe('New Tab');

    await settingsPage.close();
  });

  test('設定ページのタブタイトルが「新しいタブ」ではない', async ({
    extensionContext,
    extensionId,
  }) => {
    const settingsPage = await extensionContext.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/settings.html`);
    await settingsPage.waitForLoadState('domcontentloaded');

    await expect(async () => {
      const title = await settingsPage.title();
      expect(title).not.toBe('新しいタブ');
      expect(title).not.toBe('New Tab');
      expect(title.length).toBeGreaterThan(0);
    }).toPass({ timeout: COMMON_TIMEOUTS.short });

    await settingsPage.close();
  });
});

test.describe('スナップショット自動保存設定', () => {
  test('スナップショット自動保存のトグルが機能する', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const autoSnapshotToggle = settingsPage.locator('#autoSnapshotEnabled');
    await expect(autoSnapshotToggle).toBeVisible();
    await expect(autoSnapshotToggle).toHaveAttribute('aria-checked', 'false');

    await autoSnapshotToggle.click();

    await expect(autoSnapshotToggle).toHaveAttribute('aria-checked', 'true');

    await expect(async () => {
      const settings = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('user_settings');
        return result.user_settings as { autoSnapshotInterval?: number } | undefined;
      });
      expect(settings?.autoSnapshotInterval).toBeGreaterThan(0);
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });

    await settingsPage.close();
  });

  test('スナップショット自動保存の間隔設定が保存される', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const autoSnapshotToggle = settingsPage.locator('#autoSnapshotEnabled');
    await autoSnapshotToggle.click();
    await expect(autoSnapshotToggle).toHaveAttribute('aria-checked', 'true');

    const intervalInput = settingsPage.locator('#autoSnapshotInterval');
    await expect(intervalInput).toBeEnabled();
    await intervalInput.clear();
    await intervalInput.fill('30');

    await expect(async () => {
      const settings = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('user_settings');
        return result.user_settings as { autoSnapshotInterval?: number } | undefined;
      });
      expect(settings?.autoSnapshotInterval).toBe(30);
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });

    await settingsPage.close();
  });

  test('最大スナップショット数の設定が保存される', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const autoSnapshotToggle = settingsPage.locator('#autoSnapshotEnabled');
    await autoSnapshotToggle.click();
    await expect(autoSnapshotToggle).toHaveAttribute('aria-checked', 'true');

    const maxSnapshotsInput = settingsPage.locator('#maxSnapshots');
    await expect(maxSnapshotsInput).toBeEnabled();
    await maxSnapshotsInput.clear();
    await maxSnapshotsInput.fill('20');

    await expect(async () => {
      const settings = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('user_settings');
        return result.user_settings as { maxSnapshots?: number } | undefined;
      });
      expect(settings?.maxSnapshots).toBe(20);
    }).toPass({ timeout: COMMON_TIMEOUTS.medium });

    await settingsPage.close();
  });

  test('自動保存無効時は間隔と最大数の入力が無効化される', async ({
    extensionContext,
    extensionId,
  }) => {
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const intervalInput = settingsPage.locator('#autoSnapshotInterval');
    const maxSnapshotsInput = settingsPage.locator('#maxSnapshots');
    await expect(intervalInput).toBeDisabled();
    await expect(maxSnapshotsInput).toBeDisabled();

    const autoSnapshotToggle = settingsPage.locator('#autoSnapshotEnabled');
    await autoSnapshotToggle.click();

    await expect(intervalInput).toBeEnabled();
    await expect(maxSnapshotsInput).toBeEnabled();

    await autoSnapshotToggle.click();

    await expect(intervalInput).toBeDisabled();
    await expect(maxSnapshotsInput).toBeDisabled();

    await settingsPage.close();
  });

  test('スナップショット自動保存設定がブラウザ再起動後も保持される', async ({
    extensionContext,
    extensionId,
    serviceWorker,
  }) => {
    // Arrange
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
    const settingsPage = await openSettingsInNewTab(extensionContext, extensionId);

    const autoSnapshotToggle = settingsPage.locator('#autoSnapshotEnabled');
    await autoSnapshotToggle.click();
    await expect(autoSnapshotToggle).toHaveAttribute('aria-checked', 'true');

    const intervalInput = settingsPage.locator('#autoSnapshotInterval');
    await intervalInput.clear();
    await intervalInput.fill('15');

    const maxSnapshotsInput = settingsPage.locator('#maxSnapshots');
    await maxSnapshotsInput.clear();
    await maxSnapshotsInput.fill('25');

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

    await settingsPage.close();

    await sidePanelPage.reload();
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await sidePanelPage.waitForSelector(COMMON_SELECTORS.reactRoot, { timeout: COMMON_TIMEOUTS.medium });
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    const settingsPageAfterReload = await openSettingsInNewTab(extensionContext, extensionId);

    const toggleAfterReload = settingsPageAfterReload.locator('#autoSnapshotEnabled');
    await expect(toggleAfterReload).toHaveAttribute('aria-checked', 'true');

    const intervalAfterReload = settingsPageAfterReload.locator('#autoSnapshotInterval');
    await expect(intervalAfterReload).toHaveValue('15');

    const maxSnapshotsAfterReload = settingsPageAfterReload.locator('#maxSnapshots');
    await expect(maxSnapshotsAfterReload).toHaveValue('25');

    await settingsPageAfterReload.close();
  });
});
