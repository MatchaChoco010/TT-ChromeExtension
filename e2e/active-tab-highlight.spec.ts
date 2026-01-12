import { test, expect } from './fixtures/extension';
import { createTab, closeTab, pinTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { waitForTabActive } from './utils/polling-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('アクティブタブのハイライト', () => {
  test.describe('通常タブのハイライト', () => {
    test('通常タブがアクティブになった時に該当タブのみがハイライトされる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const treeNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const treeNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await expect(treeNode2).toHaveClass(/bg-gray-600/);
      await expect(treeNode1).not.toHaveClass(/bg-gray-600/);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('通常タブをクリックするとそのタブのみがハイライトされる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const treeNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const treeNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await expect(treeNode1).toHaveClass(/bg-gray-600/);
      await expect(treeNode2).not.toHaveClass(/bg-gray-600/);

      await treeNode2.click({ force: true, noWaitAfter: true });

      await waitForTabActive(serviceWorker, tabId2);

      await expect(async () => {
        await expect(treeNode2).toHaveClass(/bg-gray-600/);
        await expect(treeNode1).not.toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('ピン留めタブのハイライト', () => {
    test('ピン留めタブがアクティブになった時に該当ピン留めタブのみがハイライトされる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const pinnedTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
      await expect(pinnedTab).toHaveClass(/bg-gray-600/);

      await closeTab(serviceWorker, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めタブをクリックするとそのピン留めタブのみがハイライトされる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const pinnedTabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId1, depth: 0 },
      ], 0);

      const pinnedTabId2 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId1, depth: 0 },
        { tabId: pinnedTabId2, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, pinnedTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }], 0);

      await pinTab(serviceWorker, pinnedTabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }, { tabId: pinnedTabId2 }], 0);

      const pinnedTab1 = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId1}"]`);
      const pinnedTab2 = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId2}"]`);
      await expect(pinnedTab1).toHaveClass(/bg-gray-600/);
      await expect(pinnedTab2).not.toHaveClass(/bg-gray-600/);

      await pinnedTab2.click({ force: true, noWaitAfter: true });

      await expect(async () => {
        await expect(pinnedTab2).toHaveClass(/bg-gray-600/);
        await expect(pinnedTab1).not.toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      await closeTab(serviceWorker, pinnedTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId2 }], 0);

      await closeTab(serviceWorker, pinnedTabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('通常タブとピン留めタブ間のハイライト切替', () => {
    test('通常タブからピン留めタブに切り替えると、通常タブのハイライトが解除され、ピン留めタブがハイライトされる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const normalTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);

      const pinnedTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      const normalTab = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId}"]`);
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);

      await expect(normalTab).toHaveClass(/bg-gray-600/);
      await expect(pinnedTab).not.toHaveClass(/bg-gray-600/);

      await pinnedTab.click({ force: true, noWaitAfter: true });

      await expect(async () => {
        await expect(normalTab).not.toHaveClass(/bg-gray-600/);
        await expect(pinnedTab).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      await closeTab(serviceWorker, normalTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      await closeTab(serviceWorker, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めタブから通常タブに切り替えると、ピン留めタブのハイライトが解除され、通常タブがハイライトされる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const pinnedTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      const normalTabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
      const normalTab = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId}"]`);

      await expect(pinnedTab).toHaveClass(/bg-gray-600/);
      await expect(normalTab).not.toHaveClass(/bg-gray-600/);

      await normalTab.click({ force: true, noWaitAfter: true });

      await expect(async () => {
        await expect(pinnedTab).not.toHaveClass(/bg-gray-600/);
        await expect(normalTab).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

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

    test('常に1つのタブのみがハイライト状態であることを確認（連続切替テスト）', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const normalTabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
      ], 0);

      const normalTabId2 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
      ], 0);

      const pinnedTabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
        { tabId: pinnedTabId1, depth: 0 },
      ], 0);

      const pinnedTabId2 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
        { tabId: pinnedTabId1, depth: 0 },
        { tabId: pinnedTabId2, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, pinnedTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
        { tabId: pinnedTabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }], 0);

      await pinTab(serviceWorker, pinnedTabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }, { tabId: pinnedTabId2 }], 0);

      const normalTab1 = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId1}"]`);
      const normalTab2 = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId2}"]`);
      const pinnedTab1 = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId1}"]`);
      const pinnedTab2 = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId2}"]`);

      const countHighlightedTabs = async (): Promise<number> => {
        let count = 0;
        const normalTab1Class = await normalTab1.getAttribute('class') || '';
        const normalTab2Class = await normalTab2.getAttribute('class') || '';
        if (normalTab1Class.includes('bg-gray-600')) count++;
        if (normalTab2Class.includes('bg-gray-600')) count++;
        const pinnedTab1Class = await pinnedTab1.getAttribute('class') || '';
        const pinnedTab2Class = await pinnedTab2.getAttribute('class') || '';
        if (pinnedTab1Class.includes('bg-gray-600')) count++;
        if (pinnedTab2Class.includes('bg-gray-600')) count++;
        return count;
      };

      await expect(async () => {
        expect(await countHighlightedTabs()).toBe(1);
      }).toPass({ timeout: 500 });

      await pinnedTab1.click({ force: true, noWaitAfter: true });
      await expect(async () => {
        expect(await countHighlightedTabs()).toBe(1);
        await expect(pinnedTab1).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 500 });

      await normalTab2.click({ force: true, noWaitAfter: true });
      await expect(async () => {
        expect(await countHighlightedTabs()).toBe(1);
        await expect(normalTab2).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 500 });

      await pinnedTab2.click({ force: true, noWaitAfter: true });
      await expect(async () => {
        expect(await countHighlightedTabs()).toBe(1);
        await expect(pinnedTab2).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 500 });

      await normalTab1.click({ force: true, noWaitAfter: true });
      await expect(async () => {
        expect(await countHighlightedTabs()).toBe(1);
        await expect(normalTab1).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 500 });

      await closeTab(serviceWorker, normalTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }, { tabId: pinnedTabId2 }], 0);

      await closeTab(serviceWorker, normalTabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }, { tabId: pinnedTabId2 }], 0);

      await closeTab(serviceWorker, pinnedTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId2 }], 0);

      await closeTab(serviceWorker, pinnedTabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });
});
