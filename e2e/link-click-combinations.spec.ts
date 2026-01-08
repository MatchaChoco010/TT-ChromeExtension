import { test } from './fixtures/extension';
import { closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, clickLinkToOpenTab, clickLinkToNavigate, activateTab, getTestServerUrl } from './utils/tab-utils';
import { waitForTabInTreeState } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setUserSettings } from './utils/settings-utils';

test.describe('リンククリック組み合わせテスト', () => {
  test.describe('target="_blank"リンクのクリックテスト', () => {
    test('通常クリックで新しいタブが開かれ、子タブとして配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionFromLink: 'child' });
      await sidePanelPage.waitForTimeout(100);

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const linkPageUrl = getTestServerUrl('/link-with-target-blank');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(extensionContext, openerTabId!);
      await activateTab(extensionContext, openerTabId!);

      const newTabId = await clickLinkToOpenTab(extensionContext, openerPage, '#test-link', 'normal');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0, expanded: true },
        { tabId: newTabId, depth: 1 },
      ], 0);
    });

    test('中クリックで新しいタブが開かれ、子タブとして配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionFromLink: 'child' });
      await sidePanelPage.waitForTimeout(100);

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const linkPageUrl = getTestServerUrl('/link-with-target-blank');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(extensionContext, openerTabId!);
      await activateTab(extensionContext, openerTabId!);

      const newTabId = await clickLinkToOpenTab(extensionContext, openerPage, '#test-link', 'middle');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0, expanded: true },
        { tabId: newTabId, depth: 1 },
      ], 0);
    });

    test('Ctrl+クリックで新しいタブが開かれ、子タブとして配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionFromLink: 'child' });
      await sidePanelPage.waitForTimeout(100);

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const linkPageUrl = getTestServerUrl('/link-with-target-blank');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(extensionContext, openerTabId!);
      await activateTab(extensionContext, openerTabId!);

      const newTabId = await clickLinkToOpenTab(extensionContext, openerPage, '#test-link', 'ctrl');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0, expanded: true },
        { tabId: newTabId, depth: 1 },
      ], 0);
    });
  });

  test.describe('通常リンク（target属性なし）のクリックテスト', () => {
    test('通常クリックで現在のタブがナビゲート（新しいタブは開かない）', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const linkPageUrl = getTestServerUrl('/link-without-target');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(extensionContext, openerTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0 },
      ], 0);

      await clickLinkToNavigate(extensionContext, openerPage, '#test-link');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0 },
      ], 0);
    });

    test('中クリックで新しいタブが開かれ、子タブとして配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionFromLink: 'child' });
      await sidePanelPage.waitForTimeout(100);

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const linkPageUrl = getTestServerUrl('/link-without-target');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(extensionContext, openerTabId!);
      await activateTab(extensionContext, openerTabId!);

      const newTabId = await clickLinkToOpenTab(extensionContext, openerPage, '#test-link', 'middle');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0, expanded: true },
        { tabId: newTabId, depth: 1 },
      ], 0);
    });

    test('Ctrl+クリックで新しいタブが開かれ、子タブとして配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await setUserSettings(extensionContext, { newTabPositionFromLink: 'child' });
      await sidePanelPage.waitForTimeout(100);

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const linkPageUrl = getTestServerUrl('/link-without-target');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(extensionContext, openerTabId!);
      await activateTab(extensionContext, openerTabId!);

      const newTabId = await clickLinkToOpenTab(extensionContext, openerPage, '#test-link', 'ctrl');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0, expanded: true },
        { tabId: newTabId, depth: 1 },
      ], 0);
    });
  });
});
