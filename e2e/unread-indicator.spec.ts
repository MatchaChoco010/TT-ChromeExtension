import { expect } from '@playwright/test';
import { test as extensionTest } from './fixtures/extension';
import {
  createTab,
  activateTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
  getTestServerUrl,
} from './utils/tab-utils';
import { assertTabStructure, assertUnreadBadge } from './utils/assertion-utils';

extensionTest.describe('未読インジケータ機能', () => {
  extensionTest(
    'タブがバックグラウンドで読み込まれた場合、未読バッジが表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, bgTabId);

      await closeTab(extensionContext, bgTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '未読タブをアクティブにした場合、未読バッジが消える',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, bgTabId);

      await activateTab(extensionContext, bgTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadgeInNode = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadgeInNode).toHaveCount(0, { timeout: 10000 });

      await closeTab(extensionContext, bgTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '親タブの子に未読タブがあっても、親タブには未読子タブ数のバッジが表示されない',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: true }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        parentTabId,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, childTabId);

      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
      const parentUnreadChildIndicator = parentNode.locator('[data-testid="unread-child-indicator"]');
      const parentUnreadCount = parentNode.locator('[data-testid="unread-count"]');
      await expect(parentUnreadChildIndicator).toHaveCount(0);
      await expect(parentUnreadCount).toHaveCount(0);

      await closeTab(extensionContext, childTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, parentTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '複数の未読タブがある場合、未読数がカウントされて表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId1 = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      const bgTabId2 = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
        { tabId: bgTabId2, depth: 0 },
      ], 0);

      const bgTabId3 = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
        { tabId: bgTabId2, depth: 0 },
        { tabId: bgTabId3, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, bgTabId1);
      await assertUnreadBadge(sidePanelPage, bgTabId2);
      await assertUnreadBadge(sidePanelPage, bgTabId3);

      await closeTab(extensionContext, bgTabId3);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
        { tabId: bgTabId2, depth: 0 },
      ], 0);

      await closeTab(extensionContext, bgTabId2);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      await closeTab(extensionContext, bgTabId1);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});

extensionTest.describe('未読インジケーター位置', () => {
  extensionTest(
    '未読インジケーターがタブノード内の左下角に表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, bgTabId);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      const tabNodeBounds = await tabNode.boundingBox();
      const badgeBounds = await unreadBadge.boundingBox();

      expect(tabNodeBounds).not.toBeNull();
      expect(badgeBounds).not.toBeNull();
      if (tabNodeBounds && badgeBounds) {
        expect(badgeBounds.x).toBeGreaterThanOrEqual(tabNodeBounds.x);
        const badgeBottom = badgeBounds.y + badgeBounds.height;
        const tabNodeBottom = tabNodeBounds.y + tabNodeBounds.height;
        expect(badgeBottom).toBeGreaterThanOrEqual(tabNodeBottom - 2);
        expect(badgeBottom).toBeLessThanOrEqual(tabNodeBottom + 2);
      }

      await closeTab(extensionContext, bgTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '短いタイトルと長いタイトルの両方で未読インジケーターの相対位置が一定である',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const shortTitleTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
      ], 0);

      const longTitleTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
        { tabId: longTitleTabId, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, shortTitleTabId);
      await assertUnreadBadge(sidePanelPage, longTitleTabId);

      const shortTitleTabNode = sidePanelPage.locator(`[data-testid="tree-node-${shortTitleTabId}"]`);
      const shortTitleBadge = shortTitleTabNode.locator('[data-testid="unread-badge"]');
      await expect(shortTitleBadge).toBeVisible({ timeout: 5000 });
      const shortTitleNodeBounds = await shortTitleTabNode.boundingBox();
      const shortTitleBadgeBounds = await shortTitleBadge.boundingBox();

      const longTitleTabNode = sidePanelPage.locator(`[data-testid="tree-node-${longTitleTabId}"]`);
      const longTitleBadge = longTitleTabNode.locator('[data-testid="unread-badge"]');
      await expect(longTitleBadge).toBeVisible({ timeout: 5000 });
      const longTitleNodeBounds = await longTitleTabNode.boundingBox();
      const longTitleBadgeBounds = await longTitleBadge.boundingBox();

      expect(shortTitleNodeBounds).not.toBeNull();
      expect(longTitleNodeBounds).not.toBeNull();
      expect(shortTitleBadgeBounds).not.toBeNull();
      expect(longTitleBadgeBounds).not.toBeNull();

      if (shortTitleNodeBounds && longTitleNodeBounds && shortTitleBadgeBounds && longTitleBadgeBounds) {
        expect(Math.abs(shortTitleBadgeBounds.width - longTitleBadgeBounds.width)).toBeLessThanOrEqual(2);
        expect(Math.abs(shortTitleBadgeBounds.height - longTitleBadgeBounds.height)).toBeLessThanOrEqual(2);

        expect(shortTitleBadgeBounds.x + shortTitleBadgeBounds.width).toBeLessThanOrEqual(
          shortTitleNodeBounds.x + shortTitleNodeBounds.width
        );
        expect(longTitleBadgeBounds.x + longTitleBadgeBounds.width).toBeLessThanOrEqual(
          longTitleNodeBounds.x + longTitleNodeBounds.width
        );

        expect(Math.abs(shortTitleBadgeBounds.x - longTitleBadgeBounds.x)).toBeLessThanOrEqual(2);
      }

      await closeTab(extensionContext, longTitleTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, shortTitleTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '未読バッジがタブノードの左下に三角形として表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, bgTabId);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      const tabNodeBounds = await tabNode.boundingBox();
      const badgeBounds = await unreadBadge.boundingBox();

      expect(tabNodeBounds).not.toBeNull();
      expect(badgeBounds).not.toBeNull();
      if (tabNodeBounds && badgeBounds) {
        expect(badgeBounds.x).toBeGreaterThanOrEqual(tabNodeBounds.x);
        const tabNodeCenter = tabNodeBounds.x + tabNodeBounds.width / 2;
        expect(badgeBounds.x + badgeBounds.width).toBeLessThan(tabNodeCenter);
      }

      await closeTab(extensionContext, bgTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '未読インジケーターがタブの右端に固定されていること（タイトル長に依存しない）',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const shortTitleTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
      ], 0);

      const longTitleTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
        { tabId: longTitleTabId, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, shortTitleTabId);
      await assertUnreadBadge(sidePanelPage, longTitleTabId);

      const shortTitleTabNode = sidePanelPage.locator(`[data-testid="tree-node-${shortTitleTabId}"]`);
      const shortTitleTabContent = shortTitleTabNode.locator('[data-testid="tab-content"]');
      const shortTitleRightContainer = shortTitleTabNode.locator('[data-testid="right-actions-container"]');
      await expect(shortTitleRightContainer).toBeVisible({ timeout: 5000 });
      const shortTitleTabContentBounds = await shortTitleTabContent.boundingBox();
      const shortTitleRightContainerBounds = await shortTitleRightContainer.boundingBox();

      const longTitleTabNode = sidePanelPage.locator(`[data-testid="tree-node-${longTitleTabId}"]`);
      const longTitleTabContent = longTitleTabNode.locator('[data-testid="tab-content"]');
      const longTitleRightContainer = longTitleTabNode.locator('[data-testid="right-actions-container"]');
      await expect(longTitleRightContainer).toBeVisible({ timeout: 5000 });
      const longTitleTabContentBounds = await longTitleTabContent.boundingBox();
      const longTitleRightContainerBounds = await longTitleRightContainer.boundingBox();

      expect(shortTitleTabContentBounds).not.toBeNull();
      expect(longTitleTabContentBounds).not.toBeNull();
      expect(shortTitleRightContainerBounds).not.toBeNull();
      expect(longTitleRightContainerBounds).not.toBeNull();

      if (shortTitleTabContentBounds && longTitleTabContentBounds && shortTitleRightContainerBounds && longTitleRightContainerBounds) {
        const shortTitleRightEdgeDiff = (shortTitleTabContentBounds.x + shortTitleTabContentBounds.width) - (shortTitleRightContainerBounds.x + shortTitleRightContainerBounds.width);
        const longTitleRightEdgeDiff = (longTitleTabContentBounds.x + longTitleTabContentBounds.width) - (longTitleRightContainerBounds.x + longTitleRightContainerBounds.width);

        expect(shortTitleRightEdgeDiff).toBeLessThanOrEqual(10);
        expect(longTitleRightEdgeDiff).toBeLessThanOrEqual(10);

        const shortRightX = shortTitleRightContainerBounds.x + shortTitleRightContainerBounds.width;
        const longRightX = longTitleRightContainerBounds.x + longTitleRightContainerBounds.width;
        expect(Math.abs(shortRightX - longRightX)).toBeLessThanOrEqual(5);
      }

      await closeTab(extensionContext, longTitleTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: shortTitleTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, shortTitleTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});

extensionTest.describe('未読インジケーターdepth対応', () => {
  extensionTest(
    'ルートレベル（depth=0）の未読タブでインジケーターが左端に表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const rootTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, rootTabId);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${rootTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      const badgeStyles = await unreadBadge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          left: style.left,
        };
      });

      expect(badgeStyles.left).toBe('0px');

      await closeTab(extensionContext, rootTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    'depth=1の未読タブでインジケーターがインデントされた位置に表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: true }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        parentTabId,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, childTabId);

      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
      const unreadBadge = childNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      const badgeStyles = await unreadBadge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          left: style.left,
        };
      });

      expect(badgeStyles.left).toBe('20px');

      await closeTab(extensionContext, childTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, parentTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    'depth=2の未読タブでインジケーターがさらにインデントされた位置に表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: true }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        parentTabId,
        { active: true }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const grandchildTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        childTabId,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1, expanded: true },
        { tabId: grandchildTabId, depth: 2 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, grandchildTabId);

      const grandchildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandchildTabId}"]`);
      const unreadBadge = grandchildNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      const badgeStyles = await unreadBadge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          left: style.left,
        };
      });

      expect(badgeStyles.left).toBe('40px');

      await closeTab(extensionContext, grandchildTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await closeTab(extensionContext, childTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, parentTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '異なるdepthの未読タブでインジケーター位置が正しくスケールする',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const rootTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: true }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        parentTabId,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const rootNode = sidePanelPage.locator(`[data-testid="tree-node-${rootTabId}"]`);
      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
      await expect(rootNode).toBeVisible({ timeout: 10000 });
      await expect(childNode).toBeVisible({ timeout: 10000 });

      const rootBadge = rootNode.locator('[data-testid="unread-badge"]');
      const childBadge = childNode.locator('[data-testid="unread-badge"]');
      await expect(rootBadge).toBeVisible({ timeout: 5000 });
      await expect(childBadge).toBeVisible({ timeout: 5000 });

      const rootLeft = await rootBadge.evaluate((el) => {
        return parseInt(window.getComputedStyle(el).left, 10);
      });
      const childLeft = await childBadge.evaluate((el) => {
        return parseInt(window.getComputedStyle(el).left, 10);
      });

      expect(rootLeft).toBe(0);
      expect(childLeft).toBe(20);

      expect(childLeft - rootLeft).toBe(20);

      await closeTab(extensionContext, childTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, parentTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: rootTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, rootTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});

extensionTest.describe('未読インジケーターUI改善', () => {
  extensionTest(
    '未読インジケーターが左下三角形の形状で表示される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, bgTabId);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      const tabNodeBounds = await tabNode.boundingBox();
      const badgeBounds = await unreadBadge.boundingBox();

      expect(tabNodeBounds).not.toBeNull();
      expect(badgeBounds).not.toBeNull();

      if (tabNodeBounds && badgeBounds) {
        const leftEdgeDiff = badgeBounds.x - tabNodeBounds.x;
        expect(leftEdgeDiff).toBeGreaterThanOrEqual(0);
        expect(leftEdgeDiff).toBeLessThanOrEqual(50);

        const badgeBottom = badgeBounds.y + badgeBounds.height;
        const tabNodeBottom = tabNodeBounds.y + tabNodeBounds.height;
        expect(Math.abs(badgeBottom - tabNodeBottom)).toBeLessThanOrEqual(2);
      }

      const badgeStyles = await unreadBadge.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          position: style.position,
          left: style.left,
          bottom: style.bottom,
          borderStyle: style.borderStyle,
        };
      });

      expect(badgeStyles.position).toBe('absolute');
      expect(badgeStyles.left).toBe('0px');
      expect(badgeStyles.bottom).toBe('0px');
      expect(badgeStyles.borderStyle).toBe('solid');

      await closeTab(extensionContext, bgTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '未読インジケーターがタブ要素に重なる形で配置される',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, bgTabId);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadge = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge).toBeVisible({ timeout: 5000 });

      const tabNodeBounds = await tabNode.boundingBox();
      const badgeBounds = await unreadBadge.boundingBox();

      expect(tabNodeBounds).not.toBeNull();
      expect(badgeBounds).not.toBeNull();

      if (tabNodeBounds && badgeBounds) {
        expect(badgeBounds.x).toBeGreaterThanOrEqual(tabNodeBounds.x);
        expect(badgeBounds.y).toBeGreaterThanOrEqual(tabNodeBounds.y);
        expect(badgeBounds.x + badgeBounds.width).toBeLessThanOrEqual(
          tabNodeBounds.x + tabNodeBounds.width
        );
        expect(badgeBounds.y + badgeBounds.height).toBeLessThanOrEqual(
          tabNodeBounds.y + tabNodeBounds.height
        );
      }

      await closeTab(extensionContext, bgTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '既読になったときに未読インジケーターが非表示になる',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, bgTabId);

      await activateTab(extensionContext, bgTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId, depth: 0 },
      ], 0);

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId}"]`);
      const unreadBadgeInNode = tabNode.locator('[data-testid="unread-badge"]');
      await expect(unreadBadgeInNode).toHaveCount(0, { timeout: 10000 });

      await closeTab(extensionContext, bgTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );

  extensionTest(
    '複数タブで未読インジケーターの形状が一貫していること',
    async ({ extensionContext, sidePanelPage, serviceWorker }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const bgTabId1 = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      const bgTabId2 = await createTab(
        extensionContext,
        getTestServerUrl('/page'),
        undefined,
        { active: false }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
        { tabId: bgTabId2, depth: 0 },
      ], 0);

      await assertUnreadBadge(sidePanelPage, bgTabId1);
      await assertUnreadBadge(sidePanelPage, bgTabId2);

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${bgTabId2}"]`);
      const unreadBadge1 = tabNode1.locator('[data-testid="unread-badge"]');
      const unreadBadge2 = tabNode2.locator('[data-testid="unread-badge"]');
      await expect(unreadBadge1).toBeVisible({ timeout: 5000 });
      await expect(unreadBadge2).toBeVisible({ timeout: 5000 });

      const badge1Bounds = await unreadBadge1.boundingBox();
      const badge2Bounds = await unreadBadge2.boundingBox();

      expect(badge1Bounds).not.toBeNull();
      expect(badge2Bounds).not.toBeNull();

      if (badge1Bounds && badge2Bounds) {
        expect(Math.abs(badge1Bounds.width - badge2Bounds.width)).toBeLessThanOrEqual(1);
        expect(Math.abs(badge1Bounds.height - badge2Bounds.height)).toBeLessThanOrEqual(1);
      }

      const badge1Styles = await unreadBadge1.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          position: style.position,
          left: style.left,
          bottom: style.bottom,
          borderStyle: style.borderStyle,
        };
      });
      const badge2Styles = await unreadBadge2.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          position: style.position,
          left: style.left,
          bottom: style.bottom,
          borderStyle: style.borderStyle,
        };
      });

      expect(badge1Styles.position).toBe(badge2Styles.position);
      expect(badge1Styles.left).toBe(badge2Styles.left);
      expect(badge1Styles.bottom).toBe(badge2Styles.bottom);
      expect(badge1Styles.borderStyle).toBe(badge2Styles.borderStyle);

      await closeTab(extensionContext, bgTabId2);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: bgTabId1, depth: 0 },
      ], 0);

      await closeTab(extensionContext, bgTabId1);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    }
  );
});
