import { test } from './fixtures/extension';
import { createTab, closeTab, clickLinkToOpenTab, activateTab, getTestServerUrl, getCurrentWindowId, openPageAndGetTabId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setUserSettings } from './utils/settings-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('新しいタブの位置設定', () => {
  test.describe('手動で開かれたタブの位置', () => {
    test('設定が"end"の場合、新しいタブはリストの最後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionManual: 'end' });

      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const settingsUrl = await serviceWorker.evaluate(() => chrome.runtime.getURL('settings.html'));
      const settingsTabId = await createTab(serviceWorker, settingsUrl);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: settingsTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: settingsTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: settingsTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, settingsTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('設定が"child"の場合、新しいタブはアクティブタブの子として配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionManual: 'end' });

      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await setUserSettings(extensionContext, { newTabPositionManual: 'child' });

      await activateTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: newTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, newTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('リンククリックから開かれたタブの位置', () => {
    test('設定が"end"の場合、リンクから開かれたタブはリストの最後に配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionManual: 'end', newTabPositionFromLink: 'end' });

      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const { page: openerPage, tabId: openerTabId } = await openPageAndGetTabId(
        extensionContext,
        serviceWorker,
        getTestServerUrl('/link-with-target-blank')
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: openerTabId, depth: 0 },
      ], 0);

      const anotherTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: openerTabId, depth: 0 },
        { tabId: anotherTabId, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, openerTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: openerTabId, depth: 0 },
        { tabId: anotherTabId, depth: 0 },
      ], 0);

      const linkClickedTabId = await clickLinkToOpenTab(serviceWorker, openerPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: openerTabId, depth: 0 },
        { tabId: anotherTabId, depth: 0 },
        { tabId: linkClickedTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, openerTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: anotherTabId, depth: 0 },
        { tabId: linkClickedTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, anotherTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: linkClickedTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, linkClickedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('設定が"child"の場合、リンクから開かれたタブは親タブの子として配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionManual: 'end', newTabPositionFromLink: 'child' });

      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const { page: openerPage, tabId: openerTabId } = await openPageAndGetTabId(
        extensionContext,
        serviceWorker,
        getTestServerUrl('/link-with-target-blank')
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: openerTabId, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, openerTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: openerTabId, depth: 0 },
      ], 0);

      const linkClickedTabId = await clickLinkToOpenTab(serviceWorker, openerPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: openerTabId, depth: 0, expanded: true },
        { tabId: linkClickedTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, linkClickedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: openerTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, openerTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });
});
