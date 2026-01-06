/**
 * 設定タブと内部ページのタイトル表示に関するE2Eテスト
 */

import { test, expect } from './fixtures/extension';
import { COMMON_SELECTORS, COMMON_TIMEOUTS } from './test-data/common-constants';
import {
  waitForTabInTreeState,
  waitForCondition,
} from './utils/polling-utils';
import {
  createTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
  closeTab,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('設定タブのタイトル表示', () => {
  test('設定タブがツリーで「Settings」というタイトルで表示される', async ({
    extensionContext,
    extensionId,
    sidePanelPage,
    serviceWorker,
  }) => {
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    const windowId = await getCurrentWindowId(serviceWorker);

    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    const settingsTabId = await createTab(
      extensionContext,
      `chrome-extension://${extensionId}/settings.html`,
      { active: true, windowId }
    );

    await waitForTabInTreeState(extensionContext, settingsTabId, {
      timeout: COMMON_TIMEOUTS.medium,
      timeoutMessage: `Settings tab ${settingsTabId} was not added to tree`,
    });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: settingsTabId, depth: 0 },
    ], 0);

    await waitForCondition(
      async () => {
        const tabInfo = await serviceWorker.evaluate(async (id) => {
          const tab = await chrome.tabs.get(id);
          return { title: tab.title, status: tab.status };
        }, settingsTabId);
        return tabInfo.status === 'complete' && tabInfo.title === 'Settings';
      },
      {
        timeout: COMMON_TIMEOUTS.long,
        interval: 100,
        timeoutMessage: 'Settings tab did not load with correct title',
      }
    );

    await waitForCondition(
      async () => {
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${settingsTabId}"]`);
        if (!(await treeNode.isVisible())) {
          return false;
        }
        const title = await treeNode.locator('[data-testid="tab-title"], [data-testid="discarded-tab-title"]').textContent();
        return title === 'Settings';
      },
      {
        timeout: COMMON_TIMEOUTS.medium,
        interval: 100,
        timeoutMessage: 'Settings title was not displayed in tree',
      }
    );

    await closeTab(extensionContext, settingsTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
  });

  test('設定タブのHTMLタイトルが「Settings」である', async ({
    extensionContext,
    extensionId,
  }) => {
    const settingsPage = await extensionContext.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/settings.html`);
    await settingsPage.waitForLoadState('domcontentloaded');

    await expect(settingsPage).toHaveTitle('Settings');

    await settingsPage.close();
  });
});

test.describe('内部ページのタイトル表示', () => {
  test('chrome://versionページがツリーでブラウザのタイトルと同じタイトルで表示される', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    const windowId = await getCurrentWindowId(serviceWorker);

    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    const tabId = await createTab(
      extensionContext,
      'chrome://version',
      { active: true, windowId }
    );

    await waitForTabInTreeState(extensionContext, tabId, {
      timeout: COMMON_TIMEOUTS.medium,
      timeoutMessage: `chrome://version tab ${tabId} was not added to tree`,
    });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await waitForCondition(
      async () => {
        const tabInfo = await serviceWorker.evaluate(async (id) => {
          const tab = await chrome.tabs.get(id);
          return { title: tab.title, status: tab.status };
        }, tabId);

        if (tabInfo.status !== 'complete') {
          return false;
        }

        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        if (!(await treeNode.isVisible())) {
          return false;
        }

        const displayedTitle = await treeNode.locator('[data-testid="tab-title"], [data-testid="discarded-tab-title"]').textContent();
        return displayedTitle === tabInfo.title;
      },
      {
        timeout: COMMON_TIMEOUTS.long,
        interval: 100,
        timeoutMessage: 'chrome://version title was not correctly displayed in tree',
      }
    );

    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
  });

  test('chrome://settingsページがツリーでブラウザのタイトルと同じタイトルで表示される', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    const windowId = await getCurrentWindowId(serviceWorker);

    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    const tabId = await createTab(
      extensionContext,
      'chrome://settings',
      { active: true, windowId }
    );

    await waitForTabInTreeState(extensionContext, tabId, {
      timeout: COMMON_TIMEOUTS.medium,
      timeoutMessage: `chrome://settings tab ${tabId} was not added to tree`,
    });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await waitForCondition(
      async () => {
        const tabInfo = await serviceWorker.evaluate(async (id) => {
          const tab = await chrome.tabs.get(id);
          return { title: tab.title, status: tab.status };
        }, tabId);

        if (tabInfo.status !== 'complete') {
          return false;
        }

        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        if (!(await treeNode.isVisible())) {
          return false;
        }

        const displayedTitle = await treeNode.locator('[data-testid="tab-title"], [data-testid="discarded-tab-title"]').textContent();

        if (!displayedTitle || displayedTitle.length === 0) {
          return false;
        }

        return displayedTitle !== 'chrome://settings';
      },
      {
        timeout: COMMON_TIMEOUTS.long,
        interval: 100,
        timeoutMessage: 'chrome://settings title was not correctly displayed in tree',
      }
    );

    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
  });

  test('about:blankページがツリーで適切なタイトルで表示される', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    const windowId = await getCurrentWindowId(serviceWorker);

    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    const tabId = await createTab(
      extensionContext,
      'about:blank',
      { active: true, windowId }
    );

    await waitForTabInTreeState(extensionContext, tabId, {
      timeout: COMMON_TIMEOUTS.medium,
      timeoutMessage: `about:blank tab ${tabId} was not added to tree`,
    });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    await waitForCondition(
      async () => {
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        if (!(await treeNode.isVisible())) {
          return false;
        }
        const displayedTitle = await treeNode.locator('[data-testid="tab-title"], [data-testid="discarded-tab-title"]').textContent();
        return displayedTitle === '新しいタブ';
      },
      {
        timeout: COMMON_TIMEOUTS.medium,
        interval: 100,
        timeoutMessage: 'about:blank title was not displayed as 新しいタブ',
      }
    );

    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
  });
});

test.describe('タイトル表示の安定性テスト', () => {
  test('複数の設定タブを連続で開いても正しくタイトルが表示される', async ({
    extensionContext,
    extensionId,
    sidePanelPage,
    serviceWorker,
  }) => {
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    const windowId = await getCurrentWindowId(serviceWorker);

    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    const tabIds: number[] = [];

    for (let i = 0; i < 3; i++) {
      const tabId = await createTab(
        extensionContext,
        `chrome-extension://${extensionId}/settings.html`,
        { active: true, windowId }
      );
      tabIds.push(tabId);

      await waitForTabInTreeState(extensionContext, tabId, {
        timeout: COMMON_TIMEOUTS.medium,
      });

      const expectedStructure = [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        ...tabIds.map(id => ({ tabId: id, depth: 0 })),
      ];
      await assertTabStructure(sidePanelPage, windowId, expectedStructure, 0);

      await waitForCondition(
        async () => {
          const tabInfo = await serviceWorker.evaluate(async (id) => {
            const tab = await chrome.tabs.get(id);
            return { title: tab.title, status: tab.status };
          }, tabId);
          return tabInfo.status === 'complete' && tabInfo.title === 'Settings';
        },
        {
          timeout: COMMON_TIMEOUTS.medium,
          interval: 100,
        }
      );
    }

    for (const tabId of tabIds) {
      await waitForCondition(
        async () => {
          const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
          if (!(await treeNode.isVisible())) {
            return false;
          }
          const title = await treeNode.locator('[data-testid="tab-title"], [data-testid="discarded-tab-title"]').textContent();
          return title === 'Settings';
        },
        {
          timeout: COMMON_TIMEOUTS.medium,
          interval: 100,
          timeoutMessage: `Tab ${tabId} should display Settings title`,
        }
      );
    }

    for (let i = tabIds.length - 1; i >= 0; i--) {
      await closeTab(extensionContext, tabIds[i]);
      const remainingTabs = tabIds.slice(0, i);
      const expectedStructure = [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        ...remainingTabs.map(id => ({ tabId: id, depth: 0 })),
      ];
      await assertTabStructure(sidePanelPage, windowId, expectedStructure, 0);
    }
  });
});
