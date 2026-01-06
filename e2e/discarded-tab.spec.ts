import { test, expect } from './fixtures/extension';
import { createTab, closeTab, activateTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { waitForCondition, waitForTabStatusComplete } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('休止タブの視覚的区別', () => {
  test('休止状態のタブはグレーアウト表示される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId = await createTab(extensionContext, 'https://example.com', undefined, {
      active: false,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    await waitForTabStatusComplete(serviceWorker, tabId);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    const discardedTitleBefore = tabNode.locator('[data-testid="discarded-tab-title"]');
    await expect(discardedTitleBefore).toHaveCount(0);

    let actuallyDiscarded = false;
    try {
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.discard(tabId);
      }, tabId);

      try {
        await waitForCondition(
          async () => {
            const tab = await serviceWorker.evaluate((tabId) => chrome.tabs.get(tabId), tabId);
            return tab.discarded === true;
          },
          { timeout: 3000, interval: 100, timeoutMessage: 'Tab was not discarded' }
        );
        actuallyDiscarded = true;
      } catch {
        actuallyDiscarded = false;
      }
    } catch {
      actuallyDiscarded = false;
    }

    if (!actuallyDiscarded) {
      test.skip(true, 'chrome.tabs.discard() did not work in this environment');
      return;
    }

    await waitForCondition(
      async () => {
        const hasDiscardedStyle = await sidePanelPage.evaluate((tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const title = node.querySelector('[data-testid="discarded-tab-title"]');
          return title !== null;
        }, tabId);
        return hasDiscardedStyle;
      },
      { timeout: 10000, interval: 100, timeoutMessage: 'Discarded tab style was not applied' }
    );

    const discardedTitleAfter = tabNode.locator('[data-testid="discarded-tab-title"]');
    await expect(discardedTitleAfter).toBeVisible();

    await expect(discardedTitleAfter).toHaveClass(/text-gray-400/);
  });

  test('休止タブをアクティブ化するとグレーアウトが解除される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId = await createTab(extensionContext, 'https://example.com', undefined, {
      active: false,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    await waitForTabStatusComplete(serviceWorker, tabId);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    let actuallyDiscarded = false;
    try {
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.discard(tabId);
      }, tabId);

      try {
        await waitForCondition(
          async () => {
            const tab = await serviceWorker.evaluate((tabId) => chrome.tabs.get(tabId), tabId);
            return tab.discarded === true;
          },
          { timeout: 3000, interval: 100, timeoutMessage: 'Tab was not discarded' }
        );
        actuallyDiscarded = true;
      } catch {
        actuallyDiscarded = false;
      }
    } catch {
      actuallyDiscarded = false;
    }

    if (!actuallyDiscarded) {
      test.skip(true, 'chrome.tabs.discard() did not work in this environment');
      return;
    }

    await waitForCondition(
      async () => {
        const hasDiscardedStyle = await sidePanelPage.evaluate((tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const title = node.querySelector('[data-testid="discarded-tab-title"]');
          return title !== null;
        }, tabId);
        return hasDiscardedStyle;
      },
      { timeout: 10000, interval: 100, timeoutMessage: 'Discarded tab style was not applied' }
    );

    const discardedTitle = tabNode.locator('[data-testid="discarded-tab-title"]');
    await expect(discardedTitle).toBeVisible();

    await activateTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    await waitForCondition(
      async () => {
        const tab = await serviceWorker.evaluate(async (tabId) => {
          return chrome.tabs.get(tabId);
        }, tabId);
        return tab.discarded === false;
      },
      { timeout: 10000, interval: 100, timeoutMessage: 'Tab was not un-discarded after activation' }
    );

    await waitForCondition(
      async () => {
        const hasDiscardedStyle = await sidePanelPage.evaluate((tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const title = node.querySelector('[data-testid="discarded-tab-title"]');
          return title === null;
        }, tabId);
        return hasDiscardedStyle;
      },
      { timeout: 10000, interval: 100, timeoutMessage: 'Discarded tab style was not removed after activation' }
    );

    const discardedTitleAfterActivation = tabNode.locator('[data-testid="discarded-tab-title"]');
    await expect(discardedTitleAfterActivation).toHaveCount(0);
  });
});
