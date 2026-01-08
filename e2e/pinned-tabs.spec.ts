import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, pinTab, unpinTab, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { waitForTabActive } from './utils/polling-utils';

test.describe('ピン留めタブセクション', () => {
  test.describe('基本的な表示', () => {
    test('ピン留めタブが上部セクションに横並びで表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
      await expect(section).toBeVisible();
      await expect(section).toHaveClass(/flex/);

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTab).toBeVisible();

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('複数のピン留めタブが横並びで表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId1 = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await pinTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      const pinnedTab1 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId1}"]`);
      const pinnedTab2 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId2}"]`);
      await expect(pinnedTab1).toBeVisible();
      await expect(pinnedTab2).toBeVisible();

      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めを解除するとセクションから削除される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      await unpinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).not.toBeVisible();
      }).toPass({ timeout: 10000 });

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('クリック操作', () => {
    test('ピン留めタブをクリックするとタブがアクティブ化する', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const pinnedTabId = await createTab(extensionContext, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
      ], 0);

      const normalTabId = await createTab(extensionContext, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      const initialActiveTab = await serviceWorker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id;
      });
      expect(initialActiveTab).toBe(normalTabId);

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
      await pinnedTab.click();

      await waitForTabActive(extensionContext, pinnedTabId);

      const newActiveTab = await serviceWorker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id;
      });
      expect(newActiveTab).toBe(pinnedTabId);

      await closeTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await closeTab(extensionContext, normalTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('区切り線の表示', () => {
    test('ピン留めタブと通常タブの間に区切り線が表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      const separator = sidePanelPage.locator('[data-testid="pinned-tabs-separator"]');
      await expect(separator).toBeVisible();

      await expect(separator).toHaveClass(/border-b/);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めタブが0件の場合は区切り線も非表示になる', async ({
      extensionContext,
      sidePanelPage,
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
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
      await expect(section).not.toBeVisible();

      const separator = sidePanelPage.locator('[data-testid="pinned-tabs-separator"]');
      await expect(separator).not.toBeVisible();

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ピン留めタブとツリービューの統合', () => {
    test('ピン留めタブはピン留めセクションにのみ表示され、ツリービューには表示されない', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTab).toBeVisible();

      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNode).not.toBeVisible();

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('コンテキストメニュー - ピン留め解除', () => {
    test('ピン留めタブを右クリックするとコンテキストメニューが表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await pinnedTab.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible();

      const unpinMenuItem = sidePanelPage.locator('[role="menuitem"]').filter({ hasText: 'ピン留めを解除' });
      await expect(unpinMenuItem).toBeVisible();

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('コンテキストメニューから「ピン留めを解除」を選択するとピン留めが解除される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await pinnedTab.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible();

      const unpinMenuItem = sidePanelPage.locator('[role="menuitem"]').filter({ hasText: 'ピン留めを解除' });
      await unpinMenuItem.click();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await expect(async () => {
        const pinnedTabAfter = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTabAfter).not.toBeVisible();
      }).toPass({ timeout: 10000 });

      const isPinned = await serviceWorker.evaluate(async (tabId: number) => {
        const tab = await chrome.tabs.get(tabId);
        return tab.pinned;
      }, tabId);
      expect(isPinned).toBe(false);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });
});
