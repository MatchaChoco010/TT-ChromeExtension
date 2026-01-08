import { test } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, clickLinkToOpenTab, activateTab, setupTestLinkPageRoute, getTestLinkPageUrl } from './utils/tab-utils';
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
      await sidePanelPage.waitForTimeout(100);

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId1 = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(extensionContext, 'about:blank');
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

      await waitForTabInTreeState(extensionContext, settingsTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: settingsTabId!, depth: 0 },
      ], 0);

      await closeTab(extensionContext, tabId1);
      await closeTab(extensionContext, tabId2);
      await closeTab(extensionContext, settingsTabId!);
    });

    test('設定が"child"の場合、新しいタブはアクティブタブの子として配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionManual: 'end' });
      await sidePanelPage.waitForTimeout(100);

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await setUserSettings(extensionContext, { newTabPositionManual: 'child' });
      await sidePanelPage.waitForTimeout(100);

      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { active: true });
      }, parentTabId);
      await sidePanelPage.waitForTimeout(100);

      const newTabId = await serviceWorker.evaluate(async () => {
        const tab = await chrome.tabs.create({ url: 'about:blank' });
        return tab.id;
      });

      await waitForTabInTreeState(extensionContext, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: newTabId!, depth: 1 },
      ], 0);

      await closeTab(extensionContext, newTabId!);
      await closeTab(extensionContext, parentTabId);
    });
  });

  test.describe('リンククリックから開かれたタブの位置', () => {
    test('設定が"end"の場合、リンクから開かれたタブはリストの最後に配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setupTestLinkPageRoute(extensionContext);

      await setUserSettings(extensionContext, { newTabPositionManual: 'end', newTabPositionFromLink: 'end' });
      await sidePanelPage.waitForTimeout(100);

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const linkPageUrl = getTestLinkPageUrl('https://example.org/');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes('test-link-page.local'));
        return tab?.id;
      });
      await waitForTabInTreeState(extensionContext, openerTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0 },
      ], 0);

      const anotherTabId = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0 },
        { tabId: anotherTabId, depth: 0 },
      ], 0);

      await activateTab(extensionContext, openerTabId!);

      const linkClickedTabId = await clickLinkToOpenTab(extensionContext, openerPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0 },
        { tabId: anotherTabId, depth: 0 },
        { tabId: linkClickedTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, openerTabId!);
      await closeTab(extensionContext, anotherTabId);
      await closeTab(extensionContext, linkClickedTabId);
    });

    test('設定が"child"の場合、リンクから開かれたタブは親タブの子として配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setupTestLinkPageRoute(extensionContext);

      await setUserSettings(extensionContext, { newTabPositionManual: 'end', newTabPositionFromLink: 'child' });
      await sidePanelPage.waitForTimeout(100);

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const linkPageUrl = getTestLinkPageUrl('https://example.org/');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes('test-link-page.local'));
        return tab?.id;
      });
      await waitForTabInTreeState(extensionContext, openerTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0 },
      ], 0);

      await activateTab(extensionContext, openerTabId!);

      const linkClickedTabId = await clickLinkToOpenTab(extensionContext, openerPage);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0, expanded: true },
        { tabId: linkClickedTabId, depth: 1 },
      ], 0);

      await closeTab(extensionContext, linkClickedTabId);
      await closeTab(extensionContext, openerTabId!);
    });
  });
});
