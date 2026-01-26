import { test, expect } from './fixtures/extension';
import { createTab, activateTab, clickLinkToOpenTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';
import { COMMON_TIMEOUTS } from './test-data/common-constants';
import type { Page, Worker as PlaywrightWorker } from '@playwright/test';

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

async function changeTabPositionSetting(
  settingsPage: Page,
  settingType: 'link' | 'manual',
  value: 'child' | 'nextSibling' | 'lastSibling' | 'end'
): Promise<void> {
  const selectId = settingType === 'link' ? '#newTabPositionFromLink' : '#newTabPositionManual';
  const select = settingsPage.locator(selectId);
  await select.selectOption(value);
  await expect(select).toHaveValue(value, { timeout: 3000 });
}

async function waitForSettingsSaved(
  serviceWorker: PlaywrightWorker,
  settingKey: 'newTabPositionFromLink' | 'newTabPositionManual',
  expectedValue: 'child' | 'nextSibling' | 'lastSibling' | 'end'
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

test.describe('lastSiblingタブ位置設定のE2Eテスト', () => {
  test.describe('lastSibling設定 - リンククリックタブ', () => {
    test('ルートレベルでリンククリックしたタブが兄弟の最後に配置される', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'link', 'lastSibling');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'lastSibling');

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
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      const siblingTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
        { tabId: siblingTabId, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
        { tabId: siblingTabId, depth: 0 },
      ], 0);

      const newTabId = await clickLinkToOpenTab(serviceWorker, parentPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
        { tabId: siblingTabId, depth: 0 },
        { tabId: newTabId, depth: 0 },
      ], 0);
    });

    test('ネストレベルでリンククリックしたタブが同じ親の子の最後に配置される', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      const childTabId1 = await clickLinkToOpenTab(serviceWorker, parentPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
      ], 0);

      const childTabId2 = await clickLinkToOpenTab(serviceWorker, parentPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
        { tabId: childTabId2, depth: 1 },
      ], 0);

      const settingsPage2 = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage2, 'link', 'lastSibling');
      await settingsPage2.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'lastSibling');

      await serviceWorker.evaluate(async ({ tabId, url }) => {
        await chrome.tabs.update(tabId, { url });
      }, { tabId: childTabId1, url: linkPageUrl });

      await serviceWorker.evaluate(async (tabId) => {
        for (let i = 0; i < 100; i++) {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === 'complete') return;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }, childTabId1);

      const pages = extensionContext.pages();
      const childPageForClick = pages.find(p => p.url().includes('link-with-target-blank') && p !== parentPage);

      if (!childPageForClick) {
        throw new Error('Could not find child page');
      }

      await activateTab(serviceWorker, childTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
        { tabId: childTabId2, depth: 1 },
      ], 0);

      const newTabId = await clickLinkToOpenTab(serviceWorker, childPageForClick);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
        { tabId: childTabId2, depth: 1 },
        { tabId: newTabId, depth: 1 },
      ], 0);
    });
  });

  test.describe('lastSibling設定 - 手動タブ', () => {
    test('ルートレベルで手動で開いたタブが兄弟の最後に配置される', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'manual', 'lastSibling');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionManual', 'lastSibling');

      const firstTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: firstTabId, depth: 0 },
      ], 0);

      const secondTabId = await createTab(serviceWorker, getTestServerUrl('/page?second'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: firstTabId, depth: 0 },
        { tabId: secondTabId, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, firstTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: firstTabId, depth: 0 },
        { tabId: secondTabId, depth: 0 },
      ], 0);

      const thirdTabId = await createTab(serviceWorker, getTestServerUrl('/page?third'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: firstTabId, depth: 0 },
        { tabId: secondTabId, depth: 0 },
        { tabId: thirdTabId, depth: 0 },
      ], 0);
    });

    test('ネストレベルで手動で開いたタブが同じ親の子の最後に配置される', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      const childTabId1 = await clickLinkToOpenTab(serviceWorker, parentPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
      ], 0);

      const childTabId2 = await clickLinkToOpenTab(serviceWorker, parentPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
        { tabId: childTabId2, depth: 1 },
      ], 0);

      const settingsPage2 = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage2, 'manual', 'lastSibling');
      await settingsPage2.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionManual', 'lastSibling');

      await activateTab(serviceWorker, childTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
        { tabId: childTabId2, depth: 1 },
      ], 0);

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page?manual'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
        { tabId: childTabId2, depth: 1 },
        { tabId: newTabId, depth: 1 },
      ], 0);
    });
  });

  test.describe('nextSibling設定 - 追加テスト', () => {
    test('ネストレベルで手動で開いたタブが直後に配置される', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      const childTabId1 = await clickLinkToOpenTab(serviceWorker, parentPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
      ], 0);

      const childTabId2 = await clickLinkToOpenTab(serviceWorker, parentPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
        { tabId: childTabId2, depth: 1 },
      ], 0);

      const settingsPage2 = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage2, 'manual', 'nextSibling');
      await settingsPage2.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionManual', 'nextSibling');

      await activateTab(serviceWorker, childTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
        { tabId: childTabId2, depth: 1 },
      ], 0);

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page?manual'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId1, depth: 1 },
        { tabId: newTabId, depth: 1 },
        { tabId: childTabId2, depth: 1 },
      ], 0);
    });
  });

  test.describe('child設定 - 追加テスト', () => {
    test('ルートレベルで手動で開いたタブが現在のタブの子として配置される', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'manual', 'child');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionManual', 'child');

      await activateTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(serviceWorker, getTestServerUrl('/page?child'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);
    });

    test('ネストレベルで手動で開いたタブが現在のタブの子として配置される', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'manual', 'child');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionManual', 'child');

      await activateTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(serviceWorker, getTestServerUrl('/page?child'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await activateTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const grandchildTabId = await createTab(serviceWorker, getTestServerUrl('/page?grandchild'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2 },
      ], 0);
    });
  });

  test.describe('end設定 - 追加テスト', () => {
    test('ネストレベルでリンククリックしたタブがルートの最後に配置される', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      const childTabId = await clickLinkToOpenTab(serviceWorker, parentPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const settingsPage2 = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage2, 'link', 'end');
      await settingsPage2.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'end');

      await serviceWorker.evaluate(async ({ tabId, url }) => {
        await chrome.tabs.update(tabId, { url });
      }, { tabId: childTabId, url: linkPageUrl });

      await serviceWorker.evaluate(async (tabId) => {
        for (let i = 0; i < 100; i++) {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === 'complete') return;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }, childTabId);

      const pages = extensionContext.pages();
      const childPageForClick = pages.find(p => p.url().includes('link-with-target-blank') && p !== parentPage);

      if (!childPageForClick) {
        throw new Error('Could not find child page');
      }

      await activateTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const newTabId = await clickLinkToOpenTab(serviceWorker, childPageForClick);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
        { tabId: newTabId, depth: 0 },
      ], 0);
    });

    test('ネストレベルで手動で開いたタブがルートの最後に配置される', async ({
      extensionContext,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      const settingsPage = await openSettingsPage(extensionContext, extensionId);
      await changeTabPositionSetting(settingsPage, 'link', 'child');
      await changeTabPositionSetting(settingsPage, 'manual', 'end');
      await settingsPage.close();
      await waitForSettingsSaved(serviceWorker, 'newTabPositionFromLink', 'child');
      await waitForSettingsSaved(serviceWorker, 'newTabPositionManual', 'end');

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
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, parentTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0 },
      ], 0);

      const childTabId = await clickLinkToOpenTab(serviceWorker, parentPage);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await activateTab(serviceWorker, childTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page?manual'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId!, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
        { tabId: newTabId, depth: 0 },
      ], 0);
    });
  });
});
