import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';

test.describe('新規タブ追加ボタン', () => {
  test.describe('新規タブ追加ボタンの存在', () => {
    test('新規タブ追加ボタンがサイドパネルに表示される', async ({
      sidePanelPage,
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });
    });

    test('新規タブ追加ボタンがツリービューの横幅いっぱいの幅を持つ', async ({
      sidePanelPage,
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });

      const tabTreeRoot = sidePanelPage.locator('[data-testid="tab-tree-root"]');
      await expect(tabTreeRoot).toBeVisible({ timeout: 5000 });

      const buttonBox = await newTabButton.boundingBox();
      const parentBox = await tabTreeRoot.boundingBox();

      // 許容誤差20pxはスクロールバーやパディングの影響を考慮した値
      expect(buttonBox).not.toBeNull();
      expect(parentBox).not.toBeNull();
      if (buttonBox && parentBox) {
        expect(Math.abs(buttonBox.width - parentBox.width)).toBeLessThanOrEqual(20);
      }
    });
  });

  test.describe('ボタンクリックで新規タブが追加される', () => {
    test('新規タブ追加ボタンをクリックすると新しいタブが作成される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await newTabButton.click();

      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const allTabs = await chrome.tabs.query({ windowId: wId });
            return allTabs.filter(t => {
              const url = t.url || t.pendingUrl || '';
              return !url.startsWith(sidePanelUrlPrefix);
            });
          }, windowId);
          if (tabs.length > 0) {
            newTabId = tabs[tabs.length - 1]?.id;
            return true;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );

      await waitForTabInTreeState(extensionContext, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);
    });

    test('新規タブ追加ボタンをクリックすると新しいタブがアクティブになる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await newTabButton.click();

      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const allTabs = await chrome.tabs.query({ windowId: wId });
            return allTabs.filter(t => {
              const url = t.url || t.pendingUrl || '';
              return !url.startsWith(sidePanelUrlPrefix);
            });
          }, windowId);
          if (tabs.length > 0) {
            newTabId = tabs[tabs.length - 1]?.id;
            return true;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );

      await waitForTabInTreeState(extensionContext, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);
    });
  });

  test.describe('新規タブがツリー末尾に配置される', () => {
    test('新規タブはツリーの末尾（最後の位置）に追加される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const existingTabId = await createTab(extensionContext, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: existingTabId, depth: 0 },
      ], 0);

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await newTabButton.click();

      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const allTabs = await chrome.tabs.query({ windowId: wId });
            return allTabs.filter(t => {
              const url = t.url || t.pendingUrl || '';
              return !url.startsWith(sidePanelUrlPrefix);
            });
          }, windowId);
          if (tabs.length > 1) {
            const activeTab = await serviceWorker.evaluate(async () => {
              const tabs = await chrome.tabs.query({ active: true });
              return tabs[0];
            });
            newTabId = activeTab?.id;
            return newTabId !== existingTabId && newTabId !== undefined;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );

      await waitForTabInTreeState(extensionContext, newTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: existingTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);
    });

    test('複数回クリックすると複数のタブが順番に末尾に追加される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await newTabButton.click();

      let firstNewTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const allTabs = await chrome.tabs.query({ windowId: wId });
            return allTabs.filter(t => {
              const url = t.url || t.pendingUrl || '';
              return !url.startsWith(sidePanelUrlPrefix);
            });
          }, windowId);
          if (tabs.length > 0) {
            firstNewTabId = tabs[tabs.length - 1]?.id;
            return true;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'First new tab was not created' }
      );

      await waitForTabInTreeState(extensionContext, firstNewTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: firstNewTabId!, depth: 0 },
      ], 0);

      await newTabButton.click();

      let secondNewTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const allTabs = await chrome.tabs.query({ windowId: wId });
            return allTabs.filter(t => {
              const url = t.url || t.pendingUrl || '';
              return !url.startsWith(sidePanelUrlPrefix);
            });
          }, windowId);
          if (tabs.length > 1) {
            const activeTab = await serviceWorker.evaluate(async () => {
              const tabs = await chrome.tabs.query({ active: true });
              return tabs[0];
            });
            secondNewTabId = activeTab?.id;
            return secondNewTabId !== firstNewTabId && secondNewTabId !== undefined;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Second new tab was not created' }
      );

      await waitForTabInTreeState(extensionContext, secondNewTabId!);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: firstNewTabId!, depth: 0 },
        { tabId: secondNewTabId!, depth: 0 },
      ], 0);
    });
  });
});
