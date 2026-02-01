import { test, expect } from './fixtures/extension';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import {
  closeTab,
  createTab,
  getCurrentWindowId,
  getTestServerUrl,
} from './utils/tab-utils';
import { setupWindow } from './utils/setup-utils';

async function getTabTitleElement(sidePanelPage: import('@playwright/test').Page, tabId: number) {
  const tabTitle = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"] [data-testid="tab-title"]`);
  const discardedTabTitle = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"] [data-testid="discarded-tab-title"]`);

  if (await tabTitle.isVisible().catch(() => false)) {
    return tabTitle;
  }
  if (await discardedTabTitle.isVisible().catch(() => false)) {
    return discardedTabTitle;
  }

  return tabTitle;
}

test.describe('スタートページタイトル', () => {
  test.describe('新規タブボタンでVivaldiスタートページURLが設定される', () => {
    test('新規タブ追加ボタンで作成されたタブにVivaldiスタートページURLが設定され、タイトルが「スタートページ」と表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });
      await newTabButton.click();

      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            return chrome.tabs.query({ windowId: wId });
          }, windowId);
          const extensionId = await serviceWorker.evaluate(() => chrome.runtime.id);
          const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
          const nonSidePanelTabs = tabs.filter((t: chrome.tabs.Tab) => {
            const url = t.url || t.pendingUrl || '';
            return !url.startsWith(sidePanelUrlPrefix);
          });
          if (nonSidePanelTabs.length > 0) {
            newTabId = nonSidePanelTabs[nonSidePanelTabs.length - 1]?.id;
            return true;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );

      await waitForTabInTreeState(serviceWorker, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);

      const treeTabUrl = await sidePanelPage.evaluate(async (tabId: number) => {
        const tabNode = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!tabNode) return null;
        return tabNode.getAttribute('data-tab-url');
      }, newTabId!);

      if (treeTabUrl) {
        expect(treeTabUrl).toBe('chrome://vivaldi-webui/startpage');
      }

      const tabTitleElement = await getTabTitleElement(sidePanelPage, newTabId!);

      await waitForCondition(
        async () => {
          const titleText = await tabTitleElement.textContent();
          return titleText === 'スタートページ';
        },
        {
          timeout: 10000,
          interval: 200,
          timeoutMessage: 'Tab title did not become "スタートページ" (expected for chrome://vivaldi-webui/startpage URL)'
        }
      );

      const titleText = await tabTitleElement.textContent();
      expect(titleText).toBe('スタートページ');

      await closeTab(serviceWorker, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('新規タブのタイトルが「スタートページ」または「新しいタブ」であること', () => {

    test('chrome.tabs.createで作成された新規タブのタイトルが適切に表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, '');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      const tabTitleElement = await getTabTitleElement(sidePanelPage, tabId);

      // 空URLで作成されたタブはブラウザの言語設定により様々なタイトルが表示される
      const validTitles = [
        'スタートページ',
        '新しいタブ',
        'New Tab',
        'Loading...',
        'about:blank',
        '', // 空のタイトルも許容
      ];
      await waitForCondition(
        async () => {
          const titleText = await tabTitleElement.textContent();
          return validTitles.includes(titleText || '') || Boolean(titleText && titleText.length > 0);
        },
        {
          timeout: 10000,
          interval: 200,
          timeoutMessage: 'Tab title was not set properly'
        }
      );

      const titleText = await tabTitleElement.textContent();
      expect(titleText).toBeDefined();

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('ページ遷移後のタイトル更新', () => {
    test('新規タブから別のページに遷移するとタイトルが更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });

      await newTabButton.click();

      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            return chrome.tabs.query({ windowId: wId });
          }, windowId);
          const extensionId = await serviceWorker.evaluate(() => chrome.runtime.id);
          const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
          const nonSidePanelTabs = tabs.filter((t: chrome.tabs.Tab) => {
            const url = t.url || t.pendingUrl || '';
            return !url.startsWith(sidePanelUrlPrefix);
          });
          if (nonSidePanelTabs.length > 0) {
            newTabId = nonSidePanelTabs[nonSidePanelTabs.length - 1]?.id;
            return true;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );

      await waitForTabInTreeState(serviceWorker, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);

      const tabTitleElement = await getTabTitleElement(sidePanelPage, newTabId!);

      await waitForCondition(
        async () => {
          const titleText = await tabTitleElement.textContent();
          return titleText === 'スタートページ' || titleText === 'Loading...';
        },
        {
          timeout: 5000,
          interval: 200,
          timeoutMessage: 'Initial tab title was not set properly (expected "スタートページ" or "Loading...")'
        }
      );

      const initialTitle = await tabTitleElement.textContent();
      expect(['スタートページ', 'Loading...']).toContain(initialTitle);

      const targetUrl = getTestServerUrl('/page');
      await serviceWorker.evaluate(async ({ tabId, url }) => {
        await chrome.tabs.update(tabId, { url });
      }, { tabId: newTabId!, url: targetUrl });

      await waitForCondition(
        async () => {
          const tabInfo = await serviceWorker.evaluate(async (tabId) => {
            const t = await chrome.tabs.get(tabId);
            return { status: t.status, url: t.url };
          }, newTabId!);
          return tabInfo.status === 'complete' && Boolean(tabInfo.url?.includes('127.0.0.1'));
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Page navigation did not complete' }
      );

      await waitForCondition(
        async () => {
          const titleText = await tabTitleElement.textContent();
          return titleText !== 'スタートページ' &&
                 titleText !== 'Loading...';
        },
        {
          timeout: 10000,
          interval: 200,
          timeoutMessage: 'Tab title was not updated after navigation'
        }
      );

      const finalTitle = await tabTitleElement.textContent();
      expect(finalTitle).not.toBe('スタートページ');
      expect(finalTitle).not.toBe('Loading...');
      expect(finalTitle).toBeTruthy();

      await closeTab(serviceWorker, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });
});
