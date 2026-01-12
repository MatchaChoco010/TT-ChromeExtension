import { test, expect } from './fixtures/extension';
import { createTab, closeTab, pinTab, unpinTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { waitForTabActive } from './utils/polling-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ピン留めタブセクション', () => {
  test.describe('基本的な表示', () => {
    test('ピン留めタブが上部セクションに横並びで表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
      await expect(section).toBeVisible();
      await expect(section).toHaveClass(/flex/);

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTab).toBeVisible();

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('複数のピン留めタブが横並びで表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      const pinnedTab1 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId1}"]`);
      const pinnedTab2 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId2}"]`);
      await expect(pinnedTab1).toBeVisible();
      await expect(pinnedTab2).toBeVisible();

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めを解除するとセクションから削除される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      await unpinTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabId, depth: 0 },
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).not.toBeVisible();
      }).toPass({ timeout: 10000 });

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('クリック操作', () => {
    test('ピン留めタブをクリックするとタブがアクティブ化する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const pinnedTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
      ], 0);

      const normalTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(serviceWorker, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await waitForTabActive(serviceWorker, pinnedTabId);

      const newActiveTab = await serviceWorker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id;
      });
      expect(newActiveTab).toBe(pinnedTabId);

      await closeTab(serviceWorker, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await closeTab(serviceWorker, normalTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('区切り線の表示', () => {
    test('ピン留めタブと通常タブの間に区切り線が表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めタブが0件の場合は区切り線も非表示になる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
      await expect(section).not.toBeVisible();

      const separator = sidePanelPage.locator('[data-testid="pinned-tabs-separator"]');
      await expect(separator).not.toBeVisible();

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ピン留めタブとツリービューの統合', () => {
    test('ピン留めタブはピン留めセクションにのみ表示され、ツリービューには表示されない', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('コンテキストメニュー - ピン留め解除', () => {
    test('ピン留めタブを右クリックするとコンテキストメニューが表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTab).toBeVisible({ timeout: 5000 });
      await pinnedTab.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible();

      const unpinMenuItem = sidePanelPage.locator('[role="menuitem"]').filter({ hasText: 'ピン留めを解除' });
      await expect(unpinMenuItem).toBeVisible();

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('コンテキストメニューから「ピン留めを解除」を選択するとピン留めが解除される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTab).toBeVisible();
      await pinnedTab.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible();

      const unpinMenuItem = sidePanelPage.locator('[role="menuitem"]').filter({ hasText: 'ピン留めを解除' });
      await unpinMenuItem.click();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabId, depth: 0 },
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const pinnedTabAfter = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTabAfter).not.toBeVisible();

      const isPinned = await serviceWorker.evaluate(async (tabId: number) => {
        const tab = await chrome.tabs.get(tabId);
        return tab.pinned;
      }, tabId);
      expect(isPinned).toBe(false);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });
});
