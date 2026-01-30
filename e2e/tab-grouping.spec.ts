import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getTestServerUrl, confirmGroupNameModal } from './utils/tab-utils';
import { waitForCondition } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';
import { moveTabToParent } from './utils/drag-drop-utils';

test.describe('タブグループ化機能', () => {
  test.describe('複数タブのグループ化', () => {
    test('複数タブを選択してグループ化した際にグループ親タブが作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
            for (const node of nodes) {
              if (node.groupInfo !== undefined && node.tabId > 0) return node;
              const found = findGroupNode(node.children);
              if (found) return found;
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              if (findGroupNode(view.rootNodes)) return true;
            }
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created' }
      );

      const groupTabId = await serviceWorker.evaluate(async () => {
        interface TabNode {
          tabId: number;
          groupInfo?: { name: string };
          children: TabNode[];
        }
        interface TreeState {
          windows: { views: { rootNodes: TabNode[] }[] }[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return null;

        const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
          for (const node of nodes) {
            if (node.groupInfo !== undefined && node.tabId > 0) return node;
            const found = findGroupNode(node.children);
            if (found) return found;
          }
          return undefined;
        };

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const groupNode = findGroupNode(view.rootNodes);
            if (groupNode) return groupNode.tabId;
          }
        }
        return null;
      });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
            for (const node of nodes) {
              if (node.groupInfo !== undefined && node.tabId > 0) return node;
              const found = findGroupNode(node.children);
              if (found) return found;
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              const groupNode = findGroupNode(view.rootNodes);
              if (groupNode) {
                groupTabId = groupNode.tabId;
                return true;
              }
            }
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created from multiple tabs' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findNodeWithParent = (nodes: TabNode[], targetTabId: number): { node: TabNode; parent: TabNode | null } | undefined => {
            for (const node of nodes) {
              if (node.tabId === targetTabId) return { node, parent: null };
              for (const child of node.children) {
                if (child.tabId === targetTabId) return { node: child, parent: node };
                const found = findNodeWithParent(child.children, targetTabId);
                if (found) return found;
              }
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              const result = findNodeWithParent(view.rootNodes, tabId1);
              if (result && result.parent && result.parent.groupInfo !== undefined) {
                return true;
              }
            }
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Tab was not added as child of group' }
      );

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
      ], 0);
    });

    test('複数タブのグループ化時にデフォルト名「新しいグループ」が設定される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange: 共通単語がないタイトルのタブを使用
      // "/blank" (Blank) と "/example" (Example) は共通単語がないため、
      // デフォルトの「グループ」名が使用される
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/blank'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/example'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      // Assert
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async () => {
            interface TabNode {
              tabId: number;
              groupInfo?: { name: string };
              children: TabNode[];
            }
            interface TreeState {
              windows: { views: { rootNodes: TabNode[] }[] }[];
            }
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as TreeState | undefined;
            if (!treeState?.windows) return false;

            const findGroupNodeByName = (nodes: TabNode[], name: string): TabNode | undefined => {
              for (const node of nodes) {
                if (node.groupInfo?.name === name) return node;
                const found = findGroupNodeByName(node.children, name);
                if (found) return found;
              }
              return undefined;
            };

            for (const window of treeState.windows) {
              for (const view of window.views) {
                if (findGroupNodeByName(view.rootNodes, 'グループ')) return true;
              }
            }
            return false;
          });
          return result;
        },
        { timeout: 10000, timeoutMessage: 'Group with default name "グループ" was not created' }
      );

      const groupTabId = await serviceWorker.evaluate(async () => {
        interface TabNode {
          tabId: number;
          groupInfo?: { name: string };
          children: TabNode[];
        }
        interface TreeState {
          windows: { views: { rootNodes: TabNode[] }[] }[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return null;

        const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
          for (const node of nodes) {
            if (node.groupInfo !== undefined && node.tabId > 0) return node;
            const found = findGroupNode(node.children);
            if (found) return found;
          }
          return undefined;
        };

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const groupNode = findGroupNode(view.rootNodes);
            if (groupNode) return groupNode.tabId;
          }
        }
        return null;
      });

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, groupTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('実タブグループ化機能', () => {
    test('グループ化するとchrome-extension://スキームのグループタブが作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async () => {
            interface TabNode {
              tabId: number;
              groupInfo?: { name: string };
              children: TabNode[];
            }
            interface TreeState {
              windows: { views: { rootNodes: TabNode[] }[] }[];
            }
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as TreeState | undefined;
            if (!treeState?.windows) return { found: false };

            const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
              for (const node of nodes) {
                if (node.groupInfo !== undefined && node.tabId > 0) return node;
                const found = findGroupNode(node.children);
                if (found) return found;
              }
              return undefined;
            };

            let groupNode: TabNode | undefined;
            for (const window of treeState.windows) {
              for (const view of window.views) {
                groupNode = findGroupNode(view.rootNodes);
                if (groupNode) break;
              }
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
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('グループ化後にグループ親タブが実際のブラウザタブとして存在する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
            for (const node of nodes) {
              if (node.groupInfo !== undefined && node.tabId > 0) return node;
              const found = findGroupNode(node.children);
              if (found) return found;
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              const groupNode = findGroupNode(view.rootNodes);
              if (groupNode) {
                groupTabId = groupNode.tabId;
                return true;
              }
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
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('グループ化後にタブがグループタブの子として配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async (targetTabId) => {
            interface TabNode {
              tabId: number;
              groupInfo?: { name: string };
              children: TabNode[];
            }
            interface TreeState {
              windows: { views: { rootNodes: TabNode[] }[] }[];
            }
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as TreeState | undefined;
            if (!treeState?.windows) return { found: false };

            const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
              for (const node of nodes) {
                if (node.groupInfo !== undefined && node.tabId > 0) return node;
                const found = findGroupNode(node.children);
                if (found) return found;
              }
              return undefined;
            };

            const findNodeWithParent = (nodes: TabNode[], targetTabId: number): { node: TabNode; parent: TabNode | null } | undefined => {
              for (const node of nodes) {
                if (node.tabId === targetTabId) return { node, parent: null };
                for (const child of node.children) {
                  if (child.tabId === targetTabId) return { node: child, parent: node };
                  const found = findNodeWithParent(child.children, targetTabId);
                  if (found) return found;
                }
              }
              return undefined;
            };

            let groupNode: TabNode | undefined;
            for (const window of treeState.windows) {
              for (const view of window.views) {
                groupNode = findGroupNode(view.rootNodes);
                if (groupNode) break;
              }
              if (groupNode) break;
            }
            if (!groupNode) return { found: false };

            for (const window of treeState.windows) {
              for (const view of window.views) {
                const nodeResult = findNodeWithParent(view.rootNodes, targetTabId);
                if (nodeResult && nodeResult.parent && nodeResult.parent.tabId === groupNode.tabId) {
                  return { found: true, groupTabId: groupNode.tabId, isChild: true };
                }
              }
            }
            return { found: true, groupTabId: groupNode.tabId, isChild: false };
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
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('複数タブをグループ化すると実タブのグループ親が作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
            for (const node of nodes) {
              if (node.groupInfo !== undefined && node.tabId > 0) return node;
              const found = findGroupNode(node.children);
              if (found) return found;
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              const groupNode = findGroupNode(view.rootNodes);
              if (groupNode) {
                groupTabId = groupNode.tabId;
                return true;
              }
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
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('グループ化後にグループノードがストレージに正しく保存される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async () => {
            interface TabNode {
              tabId: number;
              groupInfo?: { name: string; color: string };
              children: TabNode[];
            }
            interface TreeState {
              windows: { views: { rootNodes: TabNode[] }[] }[];
            }
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as TreeState | undefined;
            if (!treeState?.windows) return { found: false };

            const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
              for (const node of nodes) {
                if (node.groupInfo !== undefined && node.tabId > 0) return node;
                const found = findGroupNode(node.children);
                if (found) return found;
              }
              return undefined;
            };

            for (const window of treeState.windows) {
              for (const view of window.views) {
                const groupNode = findGroupNode(view.rootNodes);
                if (groupNode) {
                  return {
                    found: true,
                    groupTabId: groupNode.tabId,
                    hasGroupInfo: !!groupNode.groupInfo
                  };
                }
              }
            }
            return { found: false };
          });
          if (result.found && result.groupTabId) {
            groupTabId = result.groupTabId;
            return result.hasGroupInfo === true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Group node was not saved correctly to storage' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('タブグループ化 追加検証', () => {
    test('単一タブを選択してグループ化するとグループ親タブが作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      // Assert
      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
            for (const node of nodes) {
              if (node.groupInfo !== undefined && node.tabId > 0) return node;
              const found = findGroupNode(node.children);
              if (found) return found;
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              if (findGroupNode(view.rootNodes)) return true;
            }
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created' }
      );

      const groupTabId = await serviceWorker.evaluate(async () => {
        interface TabNode {
          tabId: number;
          groupInfo?: { name: string };
          children: TabNode[];
        }
        interface TreeState {
          windows: { views: { rootNodes: TabNode[] }[] }[];
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return null;

        const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
          for (const node of nodes) {
            if (node.groupInfo !== undefined && node.tabId > 0) return node;
            const found = findGroupNode(node.children);
            if (found) return found;
          }
          return undefined;
        };

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const groupNode = findGroupNode(view.rootNodes);
            if (groupNode) return groupNode.tabId;
          }
        }
        return null;
      });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
      ], 0);
    });

    test('グループ化後にグループタブは展開状態である', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async () => {
            interface TabNode {
              tabId: number;
              isExpanded: boolean;
              groupInfo?: { name: string };
              children: TabNode[];
            }
            interface TreeState {
              windows: { views: { rootNodes: TabNode[] }[] }[];
            }
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as TreeState | undefined;
            if (!treeState?.windows) return { found: false };

            const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
              for (const node of nodes) {
                if (node.groupInfo !== undefined && node.tabId > 0) return node;
                const found = findGroupNode(node.children);
                if (found) return found;
              }
              return undefined;
            };

            for (const window of treeState.windows) {
              for (const view of window.views) {
                const groupNode = findGroupNode(view.rootNodes);
                if (groupNode) {
                  return {
                    found: true,
                    groupTabId: groupNode.tabId,
                    isExpanded: groupNode.isExpanded
                  };
                }
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
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('グループ化後に子タブの元の順序が維持される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async (tabIds) => {
            interface TabNode {
              tabId: number;
              groupInfo?: { name: string };
              children: TabNode[];
            }
            interface TreeState {
              windows: { views: { rootNodes: TabNode[] }[] }[];
            }
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as TreeState | undefined;
            if (!treeState?.windows) return { found: false };

            const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
              for (const node of nodes) {
                if (node.groupInfo !== undefined && node.tabId > 0) return node;
                const found = findGroupNode(node.children);
                if (found) return found;
              }
              return undefined;
            };

            let groupNode: TabNode | undefined;
            for (const window of treeState.windows) {
              for (const view of window.views) {
                groupNode = findGroupNode(view.rootNodes);
                if (groupNode) break;
              }
              if (groupNode) break;
            }
            if (!groupNode) return { found: false };

            const childTabIds = groupNode.children.map(child => child.tabId);
            const allAreChildren = tabIds.every(tabId => childTabIds.includes(tabId));
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
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
        { tabId: tabId3, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
          { tabId: tabId3, depth: 0 },
        ], 0);
      }

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('グループタブが生成され子タブが正しく配置される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // Arrange
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
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

      await confirmGroupNameModal(sidePanelPage);

      // Assert
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async (tabIds) => {
            interface TabNode {
              tabId: number;
              groupInfo?: { name: string };
              children: TabNode[];
            }
            interface TreeState {
              windows: { views: { rootNodes: TabNode[] }[] }[];
            }
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as TreeState | undefined;
            if (!treeState?.windows) return { found: false };

            const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
              for (const node of nodes) {
                if (node.groupInfo !== undefined && node.tabId > 0) return node;
                const found = findGroupNode(node.children);
                if (found) return found;
              }
              return undefined;
            };

            let groupNode: TabNode | undefined;
            for (const window of treeState.windows) {
              for (const view of window.views) {
                groupNode = findGroupNode(view.rootNodes);
                if (groupNode) break;
              }
              if (groupNode) break;
            }
            if (!groupNode) return { found: false };

            const childTabIds = groupNode.children.map(child => child.tabId);
            const isTab1Child = childTabIds.includes(tabIds[0]);
            const isTab2Child = childTabIds.includes(tabIds[1]);

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
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      if (groupTabId) {
        await closeTab(serviceWorker, groupTabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: tabId1, depth: 0 },
          { tabId: tabId2, depth: 0 },
        ], 0);
      }

      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('非選択タブの右クリックでのグループ化', () => {
    test('複数タブ選択時に非選択タブを右クリックすると選択タブの最後の位置にグループが作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // タブを作成: tab1, tab2, tab3, tab4
      // tab1とtab2を選択した状態でtab4を右クリック
      // → tab1とtab2がグループ化され、グループはtab2の位置に挿入される
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      const tabId4 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // tab1とtab2を選択
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ force: true, noWaitAfter: true });
      await expect(tabNode1).toHaveClass(/bg-gray-500/);

      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Control'], force: true, noWaitAfter: true });
      await expect(tabNode2).toHaveClass(/bg-gray-500/);

      // tab4(非選択)を右クリック
      const tabNode4 = sidePanelPage.locator(`[data-testid="tree-node-${tabId4}"]`);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId4,
        { timeout: 5000 }
      );

      await tabNode4.click({ button: 'right', force: true, noWaitAfter: true });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 非選択タブを右クリックするとtargetTabIdsは右クリックしたタブのみになるため
      // メニューは「タブをグループ化」と表示される
      // しかし、実際の動作は選択タブをグループ化する
      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: 'タブをグループ化' });
      await expect(groupMenuItem).toBeVisible();
      await groupMenuItem.click({ force: true, noWaitAfter: true });

      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      await confirmGroupNameModal(sidePanelPage);

      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
            for (const node of nodes) {
              if (node.groupInfo !== undefined && node.tabId > 0) return node;
              const found = findGroupNode(node.children);
              if (found) return found;
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              const groupNode = findGroupNode(view.rootNodes);
              if (groupNode) {
                groupTabId = groupNode.tabId;
                return true;
              }
            }
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created' }
      );

      // グループがtab2の位置（tab3の前）に挿入されていることを確認
      // 期待: initialBrowserTabId, groupTabId(tab1,tab2を含む), tab3, tab4
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);

      // クリーンアップ
      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId2, depth: 1 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, groupTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId4);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('非連続選択時に非選択タブを右クリックすると選択タブの最後の位置にグループが作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // タブを作成: tab1, tab2, tab3, tab4, tab5
      // tab1とtab3を選択（非連続）した状態でtab5を右クリック
      // → tab1とtab3がグループ化され、グループはtab3の位置に挿入される
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);

      const tabId4 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);

      const tabId5 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
        { tabId: tabId5, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // tab1とtab3を選択（非連続）
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ force: true, noWaitAfter: true });
      await expect(tabNode1).toHaveClass(/bg-gray-500/);

      const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
      await tabNode3.click({ modifiers: ['Control'], force: true, noWaitAfter: true });
      await expect(tabNode3).toHaveClass(/bg-gray-500/);

      // tab5(非選択)を右クリック
      const tabNode5 = sidePanelPage.locator(`[data-testid="tree-node-${tabId5}"]`);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId5,
        { timeout: 5000 }
      );

      await tabNode5.click({ button: 'right', force: true, noWaitAfter: true });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 非選択タブを右クリックするとtargetTabIdsは右クリックしたタブのみになるため
      // メニューは「タブをグループ化」と表示される
      // しかし、実際の動作は選択タブをグループ化する
      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: 'タブをグループ化' });
      await expect(groupMenuItem).toBeVisible();
      await groupMenuItem.click({ force: true, noWaitAfter: true });

      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      await confirmGroupNameModal(sidePanelPage);

      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
            for (const node of nodes) {
              if (node.groupInfo !== undefined && node.tabId > 0) return node;
              const found = findGroupNode(node.children);
              if (found) return found;
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              const groupNode = findGroupNode(view.rootNodes);
              if (groupNode) {
                groupTabId = groupNode.tabId;
                return true;
              }
            }
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created' }
      );

      // グループがtab3の位置（選択タブの最後）に挿入されていることを確認
      // 期待: initialBrowserTabId, tab2, groupTabId(tab1,tab3を含む), tab4, tab5
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId3, depth: 1 },
        { tabId: tabId4, depth: 0 },
        { tabId: tabId5, depth: 0 },
      ], 0);

      // クリーンアップ
      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId3, depth: 1 },
        { tabId: tabId4, depth: 0 },
        { tabId: tabId5, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
        { tabId: tabId4, depth: 0 },
        { tabId: tabId5, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, groupTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId4, depth: 0 },
        { tabId: tabId5, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId4, depth: 0 },
        { tabId: tabId5, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId4);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId5, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId5);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('サブツリーのグループ化', () => {
    test('サブツリーをグループ化した際に親子関係が維持される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const child1TabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: child1TabId, depth: 0 },
      ], 0);

      const child2TabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: child1TabId, depth: 0 },
        { tabId: child2TabId, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child1TabId, parentTabId, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child2TabId, parentTabId, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: child1TabId, depth: 1 },
        { tabId: child2TabId, depth: 1 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
      await parentNode.click({ force: true, noWaitAfter: true });
      await expect(parentNode).toHaveClass(/bg-gray-500/);

      const child1Node = sidePanelPage.locator(`[data-testid="tree-node-${child1TabId}"]`);
      await child1Node.click({ modifiers: ['Control'], force: true, noWaitAfter: true });
      await expect(child1Node).toHaveClass(/bg-gray-500/);

      const child2Node = sidePanelPage.locator(`[data-testid="tree-node-${child2TabId}"]`);
      await child2Node.click({ modifiers: ['Control'], force: true, noWaitAfter: true });
      await expect(child2Node).toHaveClass(/bg-gray-500/);

      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        child2TabId,
        { timeout: 5000 }
      );

      await child2Node.click({ button: 'right', force: true, noWaitAfter: true });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
      await expect(groupMenuItem).toBeVisible();
      await groupMenuItem.click({ force: true, noWaitAfter: true });

      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      await confirmGroupNameModal(sidePanelPage);

      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
            for (const node of nodes) {
              if (node.groupInfo !== undefined && node.tabId > 0) return node;
              const found = findGroupNode(node.children);
              if (found) return found;
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              const groupNode = findGroupNode(view.rootNodes);
              if (groupNode) {
                groupTabId = groupNode.tabId;
                return true;
              }
            }
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: parentTabId, depth: 1, expanded: true },
        { tabId: child1TabId, depth: 2 },
        { tabId: child2TabId, depth: 2 },
      ], 0);

      const verifyResult = await serviceWorker.evaluate(async (tabIds) => {
        interface TabNode {
          tabId: number;
          children: TabNode[];
        }
        interface TreeState {
          windows: { views: { rootNodes: TabNode[] }[] }[];
        }
        const storage = await chrome.storage.local.get('tree_state');
        const treeState = storage.tree_state as TreeState | undefined;
        if (!treeState?.windows) return { verified: false };

        const [parentTabId, child1TabId, child2TabId] = tabIds;

        const findNodeWithParent = (nodes: TabNode[], targetTabId: number, parentOfNodes: TabNode | null = null): { node: TabNode; parent: TabNode | null } | undefined => {
          for (const node of nodes) {
            if (node.tabId === targetTabId) return { node, parent: parentOfNodes };
            const found = findNodeWithParent(node.children, targetTabId, node);
            if (found) return found;
          }
          return undefined;
        };

        let parentNode: TabNode | undefined;
        let child1Parent: TabNode | null | undefined;
        let child2Parent: TabNode | null | undefined;

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const parentResult = findNodeWithParent(view.rootNodes, parentTabId);
            if (parentResult) parentNode = parentResult.node;
            const child1Result = findNodeWithParent(view.rootNodes, child1TabId);
            if (child1Result) child1Parent = child1Result.parent;
            const child2Result = findNodeWithParent(view.rootNodes, child2TabId);
            if (child2Result) child2Parent = child2Result.parent;
          }
        }

        if (!parentNode || child1Parent === undefined || child2Parent === undefined) return { verified: false };

        const child1IsChildOfParent = child1Parent?.tabId === parentTabId;
        const child2IsChildOfParent = child2Parent?.tabId === parentTabId;
        const parentHasTwoChildren = parentNode.children.length === 2;

        return {
          verified: child1IsChildOfParent && child2IsChildOfParent && parentHasTwoChildren,
          child1IsChildOfParent,
          child2IsChildOfParent,
          parentHasTwoChildren,
          parentChildrenCount: parentNode.children.length
        };
      }, [parentTabId, child1TabId, child2TabId]);

      expect(verifyResult.verified).toBe(true);

      await closeTab(serviceWorker, child1TabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: parentTabId, depth: 1, expanded: true },
        { tabId: child2TabId, depth: 2 },
      ], 0);

      await closeTab(serviceWorker, child2TabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: parentTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, groupTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('グループタブ名編集', () => {
    test('サイドパネルのコンテキストメニューからグループ名を編集できる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      // タブを2つ作成
      const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 複数タブを選択
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

      // グループ化
      await tabNode2.click({ button: 'right', force: true, noWaitAfter: true });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
      await groupMenuItem.click({ force: true, noWaitAfter: true });
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      await confirmGroupNameModal(sidePanelPage);

      // グループタブIDを取得
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
            for (const node of nodes) {
              if (node.groupInfo !== undefined && node.tabId > 0) return node;
              const found = findGroupNode(node.children);
              if (found) return found;
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              const groupNode = findGroupNode(view.rootNodes);
              if (groupNode) {
                groupTabId = groupNode.tabId;
                return true;
              }
            }
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created' }
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId1, depth: 1 },
        { tabId: tabId2, depth: 1 },
      ], 0);

      // グループタブを右クリックして名前を編集
      const groupNode = sidePanelPage.locator(`[data-testid="tree-node-${groupTabId}"]`);
      await groupNode.click({ button: 'right', force: true, noWaitAfter: true });

      const editContextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(editContextMenu).toBeVisible({ timeout: 5000 });

      const editTitleMenuItem = sidePanelPage.locator('[data-testid="context-menu-edit-group-title"]');
      await expect(editTitleMenuItem).toBeVisible();
      await editTitleMenuItem.click({ force: true, noWaitAfter: true });
      await expect(editContextMenu).not.toBeVisible({ timeout: 3000 });

      // インライン入力フィールドが表示されるのを待つ
      const inlineInput = sidePanelPage.locator(`[data-testid="tree-node-${groupTabId}"] input`);
      await expect(inlineInput).toBeVisible({ timeout: 5000 });

      // 新しいグループ名を入力
      await inlineInput.clear();
      await inlineInput.fill('新しいグループ名');
      await inlineInput.press('Enter');

      // グループ名が更新されたことを確認
      await waitForCondition(
        async () => {
          interface TabNode {
            tabId: number;
            groupInfo?: { name: string };
            children: TabNode[];
          }
          interface TreeState {
            windows: { views: { rootNodes: TabNode[] }[] }[];
          }
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state;
          }) as TreeState | undefined;
          if (!treeState?.windows) return false;

          const findGroupNode = (nodes: TabNode[]): TabNode | undefined => {
            for (const node of nodes) {
              if (node.groupInfo !== undefined && node.tabId > 0) return node;
              const found = findGroupNode(node.children);
              if (found) return found;
            }
            return undefined;
          };

          for (const window of treeState.windows) {
            for (const view of window.views) {
              const groupNode = findGroupNode(view.rootNodes);
              if (groupNode?.groupInfo?.name === '新しいグループ名') {
                return true;
              }
            }
          }
          return false;
        },
        { timeout: 10000, timeoutMessage: 'Group name was not updated' }
      );

      // クリーンアップ
      await closeTab(serviceWorker, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0, expanded: true },
        { tabId: tabId2, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: groupTabId!, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, groupTabId!);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });
});
