import { expect } from '@playwright/test';
import { test as extensionTest } from './fixtures/extension';
import { createTab, activateTab, closeTab, getCurrentWindowId, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

extensionTest.describe('未読インジケーター復元時制御', () => {
  extensionTest(
    'ブラウザ起動時の既存タブに未読インジケーターが表示されない',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${initialBrowserTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // ブラウザ起動時の既存タブには未読インジケーターを付けない
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toHaveCount(0);
    }
  );

  extensionTest(
    '起動完了後に作成されたバックグラウンドタブに未読インジケーターが表示される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId = await createTab(
      serviceWorker,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 起動完了後のタブは通常の未読判定ルールに従う
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      await closeTab(serviceWorker, bgTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '起動完了後のタブをアクティブ化すると未読インジケーターが消える',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId = await createTab(
      serviceWorker,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // activateTabはアクティブタブを変更するだけなのでツリー構造は変わらない
      await activateTab(serviceWorker, bgTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      await expect(unreadBadge).toHaveCount(0, { timeout: 10000 });

      await closeTab(serviceWorker, bgTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '複数のバックグラウンドタブを同時に作成した場合も正しく未読インジケーターが表示される',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId1 = await createTab(
      serviceWorker,
        getTestServerUrl('/page1'),
        undefined,
        { active: false }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      const bgTabId2 = await createTab(
      serviceWorker,
        getTestServerUrl('/page2'),
        undefined,
        { active: false }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
        { tabId: bgTabId2, depth: 0 },
      ], 0);

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId2}"]`);
      const unreadBadge1 = tabNode1.locator('[data-testid="unread-badge"]');
      const unreadBadge2 = tabNode2.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge1).toBeVisible({ timeout: 10000 });
      await expect(unreadBadge2).toBeVisible({ timeout: 10000 });

      await closeTab(serviceWorker, bgTabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, bgTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    'アクティブとして作成されたタブには未読インジケーターが表示されない',
    async ({ extensionContext, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const activeTabId = await createTab(
      serviceWorker,
        getTestServerUrl('/page'),
        undefined,
        { active: true }
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: activeTabId, depth: 0 },
      ], 0);

      // アクティブなタブには未読インジケーターを付けない
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${activeTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toHaveCount(0);

      await closeTab(serviceWorker, activeTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});
