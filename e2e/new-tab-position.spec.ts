import { test } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, clickLinkToOpenTab, activateTab, getTestServerUrl } from './utils/tab-utils';
import { waitForTabInTreeState } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setUserSettings } from './utils/settings-utils';

test.describe('新しいタブの位置設定', () => {
  test.describe('手動で開かれたタブの位置', () => {
    test('設定が"end"の場合、新しいタブはリストの最後に配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionManual: 'end' });

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const settingsTabId = await serviceWorker.evaluate(async () => {
        const settingsUrl = chrome.runtime.getURL('settings.html');
        const tab = await chrome.tabs.create({ url: settingsUrl });
        return tab.id;
      });

      await waitForTabInTreeState(serviceWorker, settingsTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: settingsTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await closeTab(serviceWorker, tabId2);
      await closeTab(serviceWorker, settingsTabId!);
    });

    test('設定が"child"の場合、新しいタブはアクティブタブの子として配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionManual: 'end' });

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await setUserSettings(extensionContext, { newTabPositionManual: 'child' });

      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { active: true });
      }, parentTabId);

      const pageUrl = getTestServerUrl('/page');
      const newTabId = await serviceWorker.evaluate(async (url) => {
        const tab = await chrome.tabs.create({ url });
        return tab.id;
      }, pageUrl);

      await waitForTabInTreeState(serviceWorker, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: newTabId!, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, newTabId!);
      await closeTab(serviceWorker, parentTabId);
    });
  });

  test.describe('リンククリックから開かれたタブの位置', () => {
    test('設定が"end"の場合、リンクから開かれたタブはリストの最後に配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionManual: 'end', newTabPositionFromLink: 'end' });

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const linkPageUrl = getTestServerUrl('/link-with-target-blank');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(serviceWorker, openerTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0 },
      ], 0);

      const anotherTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0 },
        { tabId: anotherTabId, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, openerTabId!);

      const linkClickedTabId = await clickLinkToOpenTab(serviceWorker, openerPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0 },
        { tabId: anotherTabId, depth: 0 },
        { tabId: linkClickedTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, openerTabId!);
      await closeTab(serviceWorker, anotherTabId);
      await closeTab(serviceWorker, linkClickedTabId);
    });

    test('設定が"child"の場合、リンクから開かれたタブは親タブの子として配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionManual: 'end', newTabPositionFromLink: 'child' });

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const linkPageUrl = getTestServerUrl('/link-with-target-blank');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(serviceWorker, openerTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, openerTabId!);

      const linkClickedTabId = await clickLinkToOpenTab(serviceWorker, openerPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0, expanded: true },
        { tabId: linkClickedTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, linkClickedTabId);
      await closeTab(serviceWorker, openerTabId!);
    });
  });
});
