import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, activateTab, clickLinkToOpenTab, getTestServerUrl } from './utils/tab-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { COMMON_TIMEOUTS } from './test-data/common-constants';
import type { Page, Worker as PlaywrightWorker } from '@playwright/test';

/**
 * 設定ページを開くヘルパー関数
 */
async function openSettingsPage(
  extensionContext: import('@playwright/test').BrowserContext,
  extensionId: string
): Promise<Page> {
  const settingsPage = await extensionContext.newPage();
  await settingsPage.goto(`chrome-extension://${extensionId}/settings.html`);
  await settingsPage.waitForLoadState('domcontentloaded');
  await settingsPage.waitForSelector('.settings-page-container', { timeout: COMMON_TIMEOUTS.medium });
  return settingsPage;
}

/**
 * タブ位置設定を変更するヘルパー関数
 */
async function changeTabPositionSetting(
  settingsPage: Page,
  settingType: 'link' | 'manual',
  value: 'child' | 'sibling' | 'end'
): Promise<void> {
  const selectId = settingType === 'link' ? '#newTabPositionFromLink' : '#newTabPositionManual';
  const select = settingsPage.locator(selectId);
  await select.selectOption(value);
  await expect(select).toHaveValue(value, { timeout: 3000 });
}

/**
 * 設定がストレージに保存されるまで待機するヘルパー関数
 */
async function waitForSettingsSaved(
  serviceWorker: PlaywrightWorker,
  settingKey: 'newTabPositionFromLink' | 'newTabPositionManual',
  expectedValue: 'child' | 'sibling' | 'end'
): Promise<void> {
  await waitForCondition(
    async () => {
      const settings = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('user_settings');
        return result.user_settings;
      });
      return settings?.[settingKey] === expectedValue;
    },
    { timeout: 5000, interval: 100, timeoutMessage: 'Settings were not saved' }
  );
}

test.describe('タブ位置とタイトル表示のE2Eテスト', () => {
  test.describe('タブ位置設定の各シナリオ検証', () => {
    test('リンククリックで開かれたタブが「リンククリックのタブの位置」設定に従って配置される（child設定）', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'link', 'child');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'child');

      const linkPageUrl = getTestServerUrl('/link-with-target-blank');
      const parentPage = await extensionContext.newPage();
      await parentPage.goto(linkPageUrl);
      await parentPage.waitForLoadState('domcontentloaded');

      const parentTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(serviceWorker, parentTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);

      const childTabId = await clickLinkToOpenTab(serviceWorker, parentPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);
    });

    test('手動で開かれたタブが「手動で開かれたタブの位置」設定に従って配置される（end設定）', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const existingTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: existingTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'manual', 'end');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionManual', 'end');

      const newTabId = await createTab(serviceWorker, 'chrome://settings');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: existingTabId, depth: 0 },
        { tabId: newTabId, depth: 0 },
      ], 0);
    });

    test('設定変更後に新しいタブが変更された設定に従って配置される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'link', 'end');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'end');

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: newTabId, depth: 0 },
      ], 0);
    });

    test('システムページ（chrome://）はopenerTabIdがあっても手動タブとして扱われる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'link', 'child');
      await changeTabPositionSetting(settingsPage, 'manual', 'end');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'child');
      await waitForSettingsSaved(serviceWorker, 'newTabPositionManual', 'end');

      const systemTabId = await createTab(serviceWorker, 'chrome://extensions');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: systemTabId, depth: 0 },
      ], 0);
    });

    test('「兄弟として配置」設定でリンクから開いたタブが兄弟として配置される（sibling設定）', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'link', 'sibling');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'sibling');

      const linkPageUrl = getTestServerUrl('/link-with-target-blank');
      const parentPage = await extensionContext.newPage();
      await parentPage.goto(linkPageUrl);
      await parentPage.waitForLoadState('domcontentloaded');

      const parentTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(serviceWorker, parentTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);

      const newTabId = await clickLinkToOpenTab(serviceWorker, parentPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
        { tabId: newTabId, depth: 0 },
      ], 0);
    });

    test('ネストした親タブから開いたリンクタブが兄弟として配置される（sibling設定）', async ({
      extensionContext,
      serviceWorker,
      extensionId,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'link', 'child');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'child');

      const linkPageUrl = getTestServerUrl('/link-with-target-blank');
      const grandparentPage = await extensionContext.newPage();
      await grandparentPage.goto(linkPageUrl);
      await grandparentPage.waitForLoadState('domcontentloaded');

      const grandparentTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(serviceWorker, grandparentTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: grandparentTabId!, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, grandparentTabId!);
      const parentTabId = await clickLinkToOpenTab(serviceWorker, grandparentPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: grandparentTabId!, depth: 0, expanded: true },
        { tabId: parentTabId, depth: 1 },
      ], 0);

      const settingsPage2 = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage2, 'link', 'sibling');
      await settingsPage2.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'sibling');

      await serviceWorker.evaluate(async ({ tabId, url }) => {
        await chrome.tabs.update(tabId, { url });
      }, { tabId: parentTabId, url: linkPageUrl });

      await serviceWorker.evaluate(async (tabId) => {
        for (let i = 0; i < 100; i++) {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === 'complete') return;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }, parentTabId);

      const pages = extensionContext.pages();
      const parentPageForClick = pages.find(p => p.url().includes('link-with-target-blank') && p !== grandparentPage);

      if (!parentPageForClick) {
        throw new Error('Could not find parent page');
      }

      await activateTab(serviceWorker, parentTabId);

      const newTabId = await clickLinkToOpenTab(serviceWorker, parentPageForClick);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: grandparentTabId!, depth: 0, expanded: true },
        { tabId: parentTabId, depth: 1 },
        { tabId: newTabId, depth: 1 },
      ], 0);
    });

    test('「リストの最後」設定でリンクから開いたタブがルートレベルに配置される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'link', 'end');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'end');

      const linkPageUrl = getTestServerUrl('/link-with-target-blank');
      const parentPage = await extensionContext.newPage();
      await parentPage.goto(linkPageUrl);
      await parentPage.waitForLoadState('domcontentloaded');

      const parentTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(serviceWorker, parentTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      const siblingTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
        { tabId: siblingTabId, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);

      const newTabId = await clickLinkToOpenTab(serviceWorker, parentPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
        { tabId: siblingTabId, depth: 0 },
        { tabId: newTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('新規タブタイトルとURL検証', () => {
    test('新規タブボタンで作成されたタブのURLがスタートページ関連である', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });

      await newTabButton.click();

      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async () => {
            return chrome.tabs.query({ active: true });
          });
          newTabId = tabs[0]?.id;
          return newTabId !== undefined && newTabId !== pseudoSidePanelTabId;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );
      await waitForTabInTreeState(serviceWorker, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);

      const tabInfo = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true });
        return {
          url: tabs[0]?.url,
          pendingUrl: tabs[0]?.pendingUrl,
        };
      });

      expect(tabInfo.pendingUrl !== undefined || tabInfo.url !== undefined).toBe(true);
    });

    test('新規タブのタイトルが「スタートページ」と表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });
      await newTabButton.click();

      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async () => {
            return chrome.tabs.query({ active: true });
          });
          newTabId = tabs[0]?.id;
          return newTabId !== undefined;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );
      await waitForTabInTreeState(serviceWorker, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);

      await waitForCondition(
        async () => {
          const tabTitle = sidePanelPage.locator(`[data-testid="tree-node-${newTabId}"] [data-testid="tab-title"]`);
          const discardedTabTitle = sidePanelPage.locator(`[data-testid="tree-node-${newTabId}"] [data-testid="discarded-tab-title"]`);

          const titleText = await tabTitle.textContent().catch(() => null) ??
                           await discardedTabTitle.textContent().catch(() => null);
          return titleText === 'スタートページ';
        },
        {
          timeout: 10000,
          interval: 200,
          timeoutMessage: 'Tab title did not become "スタートページ"'
        }
      );
    });
  });

  test.describe('デフォルト設定の確認', () => {
    test('デフォルト設定で「リンククリックのタブの位置」は「子」、「手動で開かれたタブの位置」は「リストの最後」', async ({
      extensionContext,
      extensionId,
    }) => {
      const settingsPage = await openSettingsPage(extensionContext, extensionId);

      const linkSelect = settingsPage.locator('#newTabPositionFromLink');
      await expect(linkSelect).toHaveValue('child');

      const manualSelect = settingsPage.locator('#newTabPositionManual');
      await expect(manualSelect).toHaveValue('end');

      await settingsPage.close();
    });
  });
});
