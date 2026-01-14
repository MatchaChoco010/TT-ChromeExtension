import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getTestServerUrl } from './utils/tab-utils';
import { waitForCondition } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('タブグループ化機能', () => {
  test.describe('複数タブのグループ化', () => {
    test('複数タブを選択してグループ化した際にグループ親タブが作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

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

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ force: true, noWaitAfter: true });
      await expect(tabNode1).toHaveClass(/bg-gray-500/);

      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });
      await expect(tabNode2).toHaveClass(/bg-gray-500/);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
      await expect(groupMenuItem).toBeVisible();
      await groupMenuItem.click({ force: true, noWaitAfter: true });

      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number }> }>;
            } | undefined;
          });
          if (!treeState?.views) return false;
          for (const view of Object.values(treeState.views)) {
            if (Object.values(view.nodes).some(
              (node) => node.id.startsWith('group-') && node.tabId > 0
            )) return true;
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created' }
      );

      const groupTabId = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          views?: Record<string, { nodes: Record<string, { id: string; tabId: number }> }>;
        } | undefined;
        if (!treeState?.views) return null;
        for (const view of Object.values(treeState.views)) {
          const groupNode = Object.values(view.nodes).find(
            (node) => node.id.startsWith('group-') && node.tabId > 0
          );
          if (groupNode) return groupNode.tabId;
        }
        return null;
      });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
      ], 0);
    });
  });

  test.describe('複数タブ選択によるグループ化の追加テスト', () => {
    test('複数タブを新しいグループにグループ化できる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

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

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      await tabNode1.click({ force: true, noWaitAfter: true });
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
      await expect(groupMenuItem).toBeVisible();

      await groupMenuItem.click({ force: true, noWaitAfter: true });

      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number }> }>;
            } | undefined;
          });
          if (!treeState?.views) return false;
          for (const view of Object.values(treeState.views)) {
            const groupNode = Object.values(view.nodes).find(
              (node) => node.id.startsWith('group-') && node.tabId > 0
            );
            if (groupNode) {
              groupTabId = groupNode.tabId;
              return true;
            }
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created from multiple tabs' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number; parentId: string | null; groupId?: string }> }>;
              tabToNode?: Record<number, { viewId: string; nodeId: string }>;
            } | undefined;
          });
          if (!treeState?.views || !treeState?.tabToNode) return false;

          const tabNodeInfo = treeState.tabToNode[tabId1];
          if (!tabNodeInfo) return false;

          const viewState = treeState.views[tabNodeInfo.viewId];
          const tabNodeState = viewState?.nodes[tabNodeInfo.nodeId];
          if (!tabNodeState) return false;

          return (tabNodeState.parentId !== null && tabNodeState.parentId.startsWith('group-')) ||
                 (tabNodeState.groupId !== undefined && tabNodeState.groupId.startsWith('group-'));
        },
        { timeout: 10000, timeoutMessage: 'Tab was not added as child of group' }
      );

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
      ], 0);
    });

    test('複数タブのグループ化時にデフォルト名「新しいグループ」が設定される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
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

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      await tabNode1.click({ force: true, noWaitAfter: true });
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

      // Act
      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
      await groupMenuItem.click({ force: true, noWaitAfter: true });
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert
      await waitForCondition(
        async () => {
          const groups = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('groups');
            return result.groups as Record<string, { id: string; name: string }> | undefined;
          });
          if (!groups) return false;
          return Object.values(groups).some((group) => group.name === '新しいグループ');
        },
        { timeout: 10000, timeoutMessage: 'Group with default name "新しいグループ" was not created' }
      );

      const groupTabId = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          views?: Record<string, { nodes: Record<string, { id: string; tabId: number }> }>;
        } | undefined;
        if (!treeState?.views) return null;
        for (const view of Object.values(treeState.views)) {
          const groupNode = Object.values(view.nodes).find(
            (node) => node.id.startsWith('group-') && node.tabId > 0
          );
          if (groupNode) return groupNode.tabId;
        }
        return null;
      });

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, groupTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('実タブグループ化機能', () => {
    test('グループ化するとchrome-extension://スキームのグループタブが作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
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

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      await tabNode1.click({ force: true, noWaitAfter: true });
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

      // Act
      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
      await expect(groupMenuItem).toBeVisible();
      await groupMenuItem.click({ force: true, noWaitAfter: true });
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async () => {
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number }> }>;
            } | undefined;
            if (!treeState?.views) return { found: false };

            let groupNode: { id: string; tabId: number } | undefined;
            for (const view of Object.values(treeState.views)) {
              groupNode = Object.values(view.nodes).find(
                (node) => node.id.startsWith('group-') && node.tabId > 0
              );
              if (groupNode) break;
            }
            if (!groupNode) return { found: false };

            try {
              const tab = await chrome.tabs.get(groupNode.tabId);
              const urlMatch = tab.url?.startsWith('chrome-extension://') && tab.url?.includes('group.html');
              return { found: true, groupTabId: groupNode.tabId, urlMatch };
            } catch {
              return { found: false };
            }
          });
          if (result.found && result.groupTabId) {
            groupTabId = result.groupTabId;
            return result.urlMatch === true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Group tab was not created with chrome-extension:// URL' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

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

    test('グループ化後にグループ親タブが実際のブラウザタブとして存在する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
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

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      await tabNode1.click({ force: true, noWaitAfter: true });
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

      // Act
      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });
      await sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ }).click({ force: true, noWaitAfter: true });
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number }> }>;
            } | undefined;
          });
          if (!treeState?.views) return false;

          for (const view of Object.values(treeState.views)) {
            const groupNode = Object.values(view.nodes).find(
              (node) => node.id.startsWith('group-') && node.tabId > 0
            );
            if (groupNode) {
              groupTabId = groupNode.tabId;
              return true;
            }
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Group node with real tab ID was not found' }
      );

      const tabExists = await serviceWorker.evaluate(async (tabId) => {
        try {
          const tab = await chrome.tabs.get(tabId);
          return tab !== null && tab !== undefined;
        } catch {
          return false;
        }
      }, groupTabId!);

      expect(tabExists).toBe(true);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

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

    test('グループ化後にタブがグループタブの子として配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
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

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      await tabNode1.click({ force: true, noWaitAfter: true });
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

      // Act
      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });
      await sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ }).click({ force: true, noWaitAfter: true });
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async (targetTabId) => {
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number; parentId: string | null }> }>;
              tabToNode?: Record<number, { viewId: string; nodeId: string }>;
            } | undefined;
            if (!treeState?.views || !treeState?.tabToNode) {
              return { found: false };
            }

            let groupNode: { id: string; tabId: number } | undefined;
            let groupViewId: string | undefined;
            for (const [viewId, view] of Object.entries(treeState.views)) {
              groupNode = Object.values(view.nodes).find(
                (node) => node.id.startsWith('group-') && node.tabId > 0
              );
              if (groupNode) {
                groupViewId = viewId;
                break;
              }
            }
            if (!groupNode || !groupViewId) return { found: false };

            const tabNodeInfo = treeState.tabToNode[targetTabId];
            if (!tabNodeInfo) return { found: false, reason: 'tabNodeInfo not found' };

            const viewState = treeState.views[tabNodeInfo.viewId];
            const tabNodeState = viewState?.nodes[tabNodeInfo.nodeId];
            if (!tabNodeState) return { found: false, reason: 'tabNodeState not found' };

            const isChild = tabNodeState.parentId === groupNode.id;
            return { found: true, groupTabId: groupNode.tabId, isChild };
          }, tabId1);

          if (result.found && result.groupTabId) {
            groupTabId = result.groupTabId;
            return result.isChild === true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Parent-child relationship was not established correctly' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

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

    test('複数タブをグループ化すると実タブのグループ親が作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
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

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      await tabNode1.click({ force: true, noWaitAfter: true });
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

      // Act
      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
      await expect(groupMenuItem).toBeVisible();
      await groupMenuItem.click({ force: true, noWaitAfter: true });
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number }> }>;
            } | undefined;
          });
          if (!treeState?.views) return false;

          for (const view of Object.values(treeState.views)) {
            const groupNode = Object.values(view.nodes).find(
              (node) => node.id.startsWith('group-') && node.tabId > 0
            );
            if (groupNode) {
              groupTabId = groupNode.tabId;
              return true;
            }
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Real tab group parent was not created for multiple tabs' }
      );

      await waitForCondition(
        async () => {
          const url = await serviceWorker.evaluate(async (tabId) => {
            const tab = await chrome.tabs.get(tabId);
            return tab.url || tab.pendingUrl || '';
          }, groupTabId!);
          return url.includes('/group.html');
        },
        { timeout: 5000, timeoutMessage: 'Group tab URL was not set to group.html' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

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

    test('グループ化後にグループノードがストレージに正しく保存される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

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

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      await tabNode1.click({ force: true, noWaitAfter: true });
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });
      await sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ }).click({ force: true, noWaitAfter: true });
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async () => {
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number; groupId?: string }> }>
            } | undefined;
            if (!treeState?.views) return { found: false };

            for (const view of Object.values(treeState.views)) {
              const groupNode = Object.values(view.nodes).find(
                (node) => node.id.startsWith('group-') && node.tabId > 0
              );
              if (groupNode) {
                return {
                  found: true,
                  groupTabId: groupNode.tabId,
                  hasGroupId: !!groupNode.groupId
                };
              }
            }
            return { found: false };
          });
          if (result.found && result.groupTabId) {
            groupTabId = result.groupTabId;
            return result.hasGroupId === true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Group node was not saved correctly to storage' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

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

  test.describe('タブグループ化 追加検証', () => {
    test('単一タブを選択してグループ化するとグループ親タブが作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId,
        { timeout: 5000 }
      );

      // Act
      await tabNode.click({ button: 'right', force: true, noWaitAfter: true });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // Assert
      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: 'タブをグループ化' });
      await expect(groupMenuItem).toBeVisible();
      await expect(groupMenuItem).not.toBeDisabled();

      await groupMenuItem.click({ force: true, noWaitAfter: true });

      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number }> }>;
            } | undefined;
          });
          if (!treeState?.views) return false;
          for (const view of Object.values(treeState.views)) {
            if (Object.values(view.nodes).some(
              (node) => node.id.startsWith('group-') && node.tabId > 0
            )) return true;
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created' }
      );

      const groupTabId = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          views?: Record<string, { nodes: Record<string, { id: string; tabId: number }> }>;
        } | undefined;
        if (!treeState?.views) return null;
        for (const view of Object.values(treeState.views)) {
          const groupNode = Object.values(view.nodes).find(
            (node) => node.id.startsWith('group-') && node.tabId > 0
          );
          if (groupNode) return groupNode.tabId;
        }
        return null;
      });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
      ], 0);
    });

    test('グループ化後にグループタブは展開状態である', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
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

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ force: true, noWaitAfter: true });
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });
      await sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ }).click({ force: true, noWaitAfter: true });
      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async () => {
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number; isExpanded: boolean }> }>
            } | undefined;
            if (!treeState?.views) return { found: false };

            for (const view of Object.values(treeState.views)) {
              const groupNode = Object.values(view.nodes).find(
                (node) => node.id.startsWith('group-') && node.tabId > 0
              );
              if (groupNode) {
                return {
                  found: true,
                  groupTabId: groupNode.tabId,
                  isExpanded: groupNode.isExpanded
                };
              }
            }
            return { found: false };
          });
          if (result.found && result.groupTabId) {
            groupTabId = result.groupTabId;
            return result.isExpanded === true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Group node is not expanded after creation' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

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

    test('グループ化後に子タブの元の順序が維持される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

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

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ force: true, noWaitAfter: true });
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });
      const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
      await tabNode3.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId3,
        { timeout: 5000 }
      );

      await tabNode3.click({ button: 'right', force: true, noWaitAfter: true });
      await waitForCondition(
        async () => await sidePanelPage.locator('[role="menu"]').isVisible(),
        { timeout: 5000, timeoutMessage: 'Menu not visible' }
      );
      await sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ }).click({ force: true, noWaitAfter: true });
      await waitForCondition(
        async () => !(await sidePanelPage.locator('[role="menu"]').isVisible()),
        { timeout: 3000, timeoutMessage: 'Menu still visible' }
      );

      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async (tabIds) => {
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number; parentId: string | null; children?: string[] }> }>;
              tabToNode?: Record<number, { viewId: string; nodeId: string }>;
            } | undefined;
            if (!treeState?.views || !treeState?.tabToNode) return { found: false };

            let groupNode: { id: string; tabId: number } | undefined;
            let groupViewId: string | undefined;
            for (const [viewId, view] of Object.entries(treeState.views)) {
              groupNode = Object.values(view.nodes).find(
                (node) => node.id.startsWith('group-') && node.tabId > 0
              );
              if (groupNode) {
                groupViewId = viewId;
                break;
              }
            }
            if (!groupNode || !groupViewId) return { found: false };

            const viewState = treeState.views[groupViewId];
            const childrenParentIds = tabIds.map(tabId => {
              const nodeInfo = treeState.tabToNode![tabId];
              if (!nodeInfo) return null;
              const node = viewState?.nodes[nodeInfo.nodeId];
              return node?.parentId;
            });

            const allAreChildren = childrenParentIds.every(parentId => parentId === groupNode!.id);
            if (!allAreChildren) return { found: false };

            const tabs = await chrome.tabs.query({ windowId: chrome.windows.WINDOW_ID_CURRENT });
            const tabOrder = tabIds.map(tabId => tabs.findIndex(t => t.id === tabId));

            const isOrderMaintained = tabOrder[0] < tabOrder[1] && tabOrder[1] < tabOrder[2];

            return {
              found: true,
              groupTabId: groupNode.tabId,
              isOrderMaintained
            };
          }, [tabId1, tabId2, tabId3]);

          if (result.found && result.groupTabId) {
            groupTabId = result.groupTabId;
            return result.isOrderMaintained === true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Child tab order was not maintained after grouping' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
        { tabId: tabId3, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
          { tabId: tabId3, depth: 0 },
        ], 0);
      }

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('グループタブが生成され子タブが正しく配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
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

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ force: true, noWaitAfter: true });
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });
      await sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ }).click({ force: true, noWaitAfter: true });
      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async (tabIds) => {
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as {
              views?: Record<string, { nodes: Record<string, { id: string; tabId: number; parentId: string | null }> }>;
              tabToNode?: Record<number, { viewId: string; nodeId: string }>;
            } | undefined;
            if (!treeState?.views || !treeState?.tabToNode) return { found: false };

            let groupNode: { id: string; tabId: number } | undefined;
            let groupViewId: string | undefined;
            for (const [viewId, view] of Object.entries(treeState.views)) {
              groupNode = Object.values(view.nodes).find(
                (node) => node.id.startsWith('group-') && node.tabId > 0
              );
              if (groupNode) {
                groupViewId = viewId;
                break;
              }
            }
            if (!groupNode || !groupViewId) return { found: false };

            const viewState = treeState.views[groupViewId];
            const tab1NodeInfo = treeState.tabToNode[tabIds[0]];
            const tab2NodeInfo = treeState.tabToNode[tabIds[1]];
            if (!tab1NodeInfo || !tab2NodeInfo) return { found: false };

            const tab1Node = viewState?.nodes[tab1NodeInfo.nodeId];
            const tab2Node = viewState?.nodes[tab2NodeInfo.nodeId];
            if (!tab1Node || !tab2Node) return { found: false };

            const isTab1Child = tab1Node.parentId === groupNode.id;
            const isTab2Child = tab2Node.parentId === groupNode.id;

            return {
              found: true,
              groupTabId: groupNode.tabId,
              isTab1Child,
              isTab2Child,
              allChildrenCorrect: isTab1Child && isTab2Child
            };
          }, [tabId1, tabId2]);

          if (result.found && result.groupTabId) {
            groupTabId = result.groupTabId;
            return result.allChildrenCorrect === true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Group tab was not created with children correctly' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

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
});
