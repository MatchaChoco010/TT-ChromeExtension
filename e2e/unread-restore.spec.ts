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

      // Side Panelが初期化されてツリービューが表示されるまで待機
      await sidePanelPage.waitForSelector('[data-testid="tab-tree-view"]', { timeout: 10000 });

      // initialBrowserTabIdを使用して検証
      // タブノードがDOMに表示されるまで待機
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${initialBrowserTabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // 初期タブに未読バッジが表示されていないことを確認
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

      // 起動完了後に作成されたバックグラウンドタブには未読バッジが表示されること
      // 起動完了後のタブは通常の未読判定ルールに従う
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // クリーンアップ
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

      // 未読バッジが表示されることを確認
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 10000 });

      // タブをアクティブ化
      await activateTab(serviceWorker, bgTabId);
      // activateTabはアクティブタブを変更するだけなのでツリー構造は変わらない
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      // 未読バッジが消えることを確認
      await expect(unreadBadge).toHaveCount(0, { timeout: 10000 });

      // クリーンアップ
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

      // 両方のタブに未読バッジが表示されることを確認
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId2}"]`);
      const unreadBadge1 = tabNode1.locator('[data-testid="unread-badge"]');
      const unreadBadge2 = tabNode2.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge1).toBeVisible({ timeout: 10000 });
      await expect(unreadBadge2).toBeVisible({ timeout: 10000 });

      // クリーンアップ
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

      // アクティブなタブには未読バッジが表示されないこと
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${activeTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toHaveCount(0);

      // クリーンアップ
      await closeTab(serviceWorker, activeTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});
