import { test } from './fixtures/extension';
import { closeTab, getCurrentWindowId, getPseudoSidePanelTabId, clickLinkToOpenTab, clickLinkToNavigate, activateTab, getTestServerUrl } from './utils/tab-utils';
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
      await activateTab(serviceWorker, openerTabId!);

      const newTabId = await clickLinkToOpenTab(serviceWorker, openerPage, '#test-link', 'normal');

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
      await activateTab(serviceWorker, openerTabId!);

      const newTabId = await clickLinkToOpenTab(serviceWorker, openerPage, '#test-link', 'middle');

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
      await activateTab(serviceWorker, openerTabId!);

      const newTabId = await clickLinkToOpenTab(serviceWorker, openerPage, '#test-link', 'ctrl');

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

      const linkPageUrl = getTestServerUrl('/link-without-target');
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

      await clickLinkToNavigate(serviceWorker, openerPage, '#test-link');

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

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const linkPageUrl = getTestServerUrl('/link-without-target');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(serviceWorker, openerTabId!);
      await activateTab(serviceWorker, openerTabId!);

      const newTabId = await clickLinkToOpenTab(serviceWorker, openerPage, '#test-link', 'middle');

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

      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const linkPageUrl = getTestServerUrl('/link-without-target');
      const openerPage = await extensionContext.newPage();
      await openerPage.goto(linkPageUrl);
      await openerPage.waitForLoadState('domcontentloaded');

      const openerTabId = await serviceWorker.evaluate(async (url) => {
        const tabs = await chrome.tabs.query({});
        const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
        return tab?.id;
      }, linkPageUrl);
      await waitForTabInTreeState(serviceWorker, openerTabId!);
      await activateTab(serviceWorker, openerTabId!);

      const newTabId = await clickLinkToOpenTab(serviceWorker, openerPage, '#test-link', 'ctrl');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: openerTabId!, depth: 0, expanded: true },
        { tabId: newTabId, depth: 1 },
      ], 0);
    });
  });
});
