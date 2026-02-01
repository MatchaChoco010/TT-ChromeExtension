import { test, expect } from './fixtures/extension';
import type { Worker } from '@playwright/test';
import { createTab, closeTab, activateTab, pinTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { waitForCondition, waitForTabRemovedFromTreeState, waitForTabUrlLoaded, waitForTabActive } from './utils/polling-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('chrome.tabs API統合', () => {
  test.describe('chrome.tabs.create()', () => {
    test('chrome.tabs.create()を呼び出した場合、新しいタブが作成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const createdTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: createdTabId, depth: 0 },
      ], 0);
    });

    test('chrome.tabs.create()でopenerTabIdを指定した場合、親子関係が確立される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));
      expect(parentTabId).toBeDefined();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(serviceWorker, getTestServerUrl('/child'), parentTabId);
      expect(childTabId).toBeDefined();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);
    });
  });

  test.describe('chrome.tabs.remove()', () => {
    test('chrome.tabs.remove()を呼び出した場合、タブが削除される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(async (id) => {
        await chrome.tabs.remove(id);
      }, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('chrome.tabs.remove()で複数タブを一括削除できる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tab1Id = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      const tab3Id = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
        { tabId: tab3Id, depth: 0 },
      ], 0);

      const tabIdsToRemove = [tab1Id, tab2Id, tab3Id];
      await serviceWorker.evaluate(
        async (tabIds) => {
          await chrome.tabs.remove(tabIds as number[]);
        },
        tabIdsToRemove
      );

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('chrome.tabs.update()', () => {
    test('chrome.tabs.update()でURLを変更した場合、タブのURLが更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/google'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      const newUrl = getTestServerUrl('/google-search');
      await serviceWorker.evaluate(
        async ({ id, url }) => {
          return await chrome.tabs.update(id, { url });
        },
        { id: tabId, url: newUrl }
      );

      const currentTab = await waitForTabUrlLoaded(serviceWorker, tabId, 'google-search', 10000);

      expect(currentTab).toBeDefined();
      expect(currentTab.url).toContain('google-search');
    });

    test('chrome.tabs.update()でactiveを変更した場合、アクティブ状態が更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tab1Id = await createTab(serviceWorker, getTestServerUrl('/page1'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(serviceWorker, getTestServerUrl('/page2'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(async (tabId) => {
        return await chrome.tabs.update(tabId, { active: true });
      }, tab1Id);

      await waitForTabActive(serviceWorker, tab1Id);

      await serviceWorker.evaluate(async (tabId) => {
        return await chrome.tabs.update(tabId, { active: true });
      }, tab2Id);

      await waitForTabActive(serviceWorker, tab2Id);
    });

    test('chrome.tabs.update()でpinnedを変更した場合、ピン留め状態が更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(async (id) => {
        return await chrome.tabs.update(id, { pinned: true });
      }, tabId);

      await assertPinnedTabStructure(sidePanelPage, windowId, [
        { tabId: tabId },
      ], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      // ツリービューが常に正であり、ピン留め解除時はタブが最後尾に配置される
      await serviceWorker.evaluate(async (id) => {
        return await chrome.tabs.update(id, { pinned: false });
      }, tabId);

      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('chrome.tabs.query()', () => {
    test('chrome.tabs.query()で全タブを取得できる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tab1Id = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);
    });

    test('chrome.tabs.query()でアクティブタブを取得できる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      const activeTabs = await serviceWorker.evaluate(async () => {
        return await chrome.tabs.query({ active: true, currentWindow: true });
      });

      expect(activeTabs[0].id).toBe(tabId);
    });

    test('chrome.tabs.query()でURLでフィルタリングできる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tab1Id = await createTab(serviceWorker, getTestServerUrl('/test'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(serviceWorker, getTestServerUrl('/other'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await waitForTabUrlLoaded(serviceWorker, tab1Id, '/test', 5000);
      await waitForTabUrlLoaded(serviceWorker, tab2Id, '/other', 5000);

      const filteredTabs = await serviceWorker.evaluate(async () => {
        return await chrome.tabs.query({ url: '*://127.0.0.1/test' });
      });

      const filteredTabIds = filteredTabs.map((t: chrome.tabs.Tab) => t.id);
      expect(filteredTabIds).toContain(tab1Id);
      expect(filteredTabIds).not.toContain(tab2Id);
      for (const tab of filteredTabs) {
        expect(tab.url).toContain('127.0.0.1');
      }
    });

    test('chrome.tabs.query()でピン留めタブをフィルタリングできる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, tabId);
      await assertPinnedTabStructure(sidePanelPage, windowId, [
        { tabId: tabId },
      ], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('chrome.tabs.onCreated イベント', () => {
    test('タブ作成時にonCreatedイベントが発火してツリーが更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      expect(tabId).toBeGreaterThan(0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      interface TabNode {
        tabId: number;
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }
      const treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      }) as TreeState;

      const findTabInTree = (nodes: TabNode[], targetTabId: number): boolean => {
        for (const node of nodes) {
          if (node.tabId === targetTabId) return true;
          if (findTabInTree(node.children, targetTabId)) return true;
        }
        return false;
      };

      expect(treeState).toBeDefined();
      expect(treeState.windows).toBeDefined();
      let tabFound = false;
      for (const window of treeState.windows) {
        for (const view of window.views) {
          if (findTabInTree(view.rootNodes, tabId)) {
            tabFound = true;
            break;
          }
        }
      }
      expect(tabFound).toBe(true);
    });
  });

  test.describe('chrome.tabs.onRemoved イベント', () => {
    test('タブ削除時にonRemovedイベントが発火してツリーから削除される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      expect(tabId).toBeGreaterThan(0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      interface TabNode {
        tabId: number;
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }

      const findTabInTree = (nodes: TabNode[], targetTabId: number): boolean => {
        for (const node of nodes) {
          if (node.tabId === targetTabId) return true;
          if (findTabInTree(node.children, targetTabId)) return true;
        }
        return false;
      };

      let treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      }) as TreeState;
      let tabFound = false;
      for (const window of treeState.windows) {
        for (const view of window.views) {
          if (findTabInTree(view.rootNodes, tabId)) {
            tabFound = true;
            break;
          }
        }
      }
      expect(tabFound).toBe(true);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      await waitForTabRemovedFromTreeState(serviceWorker, tabId);

      treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      }) as TreeState;

      tabFound = false;
      for (const window of treeState.windows) {
        for (const view of window.views) {
          if (findTabInTree(view.rootNodes, tabId)) {
            tabFound = true;
            break;
          }
        }
      }
      expect(tabFound).toBe(false);
    });
  });

  test.describe('chrome.tabs.onUpdated イベント', () => {
    test('タブURL更新時にonUpdatedイベントが発火する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/blank'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      const newUrl = getTestServerUrl('/page');
      await serviceWorker.evaluate(async ({ id, url }) => {
        await chrome.tabs.update(id, { url });
      }, { id: tabId, url: newUrl });

      const updatedTab = await waitForTabUrlLoaded(serviceWorker, tabId, '/page', 5000);

      expect(updatedTab).toBeDefined();
      expect(updatedTab.id).toBe(tabId);
    });
  });

  test.describe('chrome.tabs.onActivated イベント', () => {
    test('タブアクティブ化時にonActivatedイベントが発火する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tab1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, tab1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const activeInfo1 = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0];
      });
      expect(activeInfo1.id).toBe(tab1);

      await activateTab(serviceWorker, tab2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const activeInfo2 = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0];
      });
      expect(activeInfo2.id).toBe(tab2);
    });

    test('未読タブをアクティブ化すると未読状態がクリアされる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, {
        active: false,
      });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForCondition(async () => {
        const result = await serviceWorker.evaluate(async () => {
          return await chrome.storage.local.get('unread_tabs');
        });
        return Array.isArray(result.unread_tabs) && result.unread_tabs.includes(tabId);
      }, { timeout: 3000 });

      let unreadState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('unread_tabs');
        return result.unread_tabs;
      });
      expect(Array.isArray(unreadState) && unreadState.includes(tabId)).toBe(true);

      await activateTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForCondition(async () => {
        const result = await serviceWorker.evaluate(async () => {
          return await chrome.storage.local.get('unread_tabs');
        });
        return !result.unread_tabs || !result.unread_tabs.includes(tabId);
      }, { timeout: 3000 });

      unreadState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('unread_tabs');
        return result.unread_tabs;
      });
      expect(!unreadState || !unreadState.includes(tabId)).toBe(true);
    });
  });

  test.describe('ツリー状態との統合', () => {
    test('タブ作成時にツリーにノードが追加される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      interface TabNode {
        tabId: number;
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }
      const treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      }) as TreeState;

      const findTabInTree = (nodes: TabNode[], targetTabId: number): TabNode | undefined => {
        for (const node of nodes) {
          if (node.tabId === targetTabId) return node;
          const found = findTabInTree(node.children, targetTabId);
          if (found) return found;
        }
        return undefined;
      };

      expect(treeState).toBeDefined();
      expect(treeState.windows).toBeDefined();

      let tabNode: TabNode | undefined;
      for (const window of treeState.windows) {
        for (const view of window.views) {
          tabNode = findTabInTree(view.rootNodes, tabId);
          if (tabNode) break;
        }
        if (tabNode) break;
      }
      expect(tabNode).toBeDefined();
      expect(tabNode!.tabId).toBe(tabId);
    });

    test('親子関係付きでタブを作成するとツリー構造が正しく形成される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(
      serviceWorker,
        getTestServerUrl('/child'),
        parentTabId
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      interface TabNode {
        tabId: number;
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }
      const treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      }) as TreeState;

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

      let parentNode: TabNode | undefined;
      let childResult: { node: TabNode; parent: TabNode | null } | undefined;
      for (const window of treeState.windows) {
        for (const view of window.views) {
          const parentResult = findNodeWithParent(view.rootNodes, parentTabId);
          if (parentResult) parentNode = parentResult.node;
          childResult = findNodeWithParent(view.rootNodes, childTabId);
        }
      }

      expect(parentNode).toBeDefined();
      expect(childResult).toBeDefined();
      expect(childResult!.parent).toBeDefined();
      expect(childResult!.parent!.tabId).toBe(parentTabId);
    });

    test('タブ削除時にツリーからノードが削除される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      interface TabNode {
        tabId: number;
        children: TabNode[];
      }
      interface TreeState {
        windows: { views: { rootNodes: TabNode[] }[] }[];
      }

      const findTabInTree = (nodes: TabNode[], targetTabId: number): boolean => {
        for (const node of nodes) {
          if (node.tabId === targetTabId) return true;
          if (findTabInTree(node.children, targetTabId)) return true;
        }
        return false;
      };

      let treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      }) as TreeState;

      let tabFound = false;
      for (const window of treeState.windows) {
        for (const view of window.views) {
          if (findTabInTree(view.rootNodes, tabId)) {
            tabFound = true;
            break;
          }
        }
      }
      expect(tabFound).toBe(true);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);

      await waitForTabRemovedFromTreeState(serviceWorker, tabId);

      treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      }) as TreeState;

      tabFound = false;
      for (const window of treeState.windows) {
        for (const view of window.views) {
          if (findTabInTree(view.rootNodes, tabId)) {
            tabFound = true;
            break;
          }
        }
      }
      expect(tabFound).toBe(false);
    });
  });

  test.describe('chrome.tabs.move() - ツリー→Chrome一方通行同期', () => {
    async function getChromeTabOrder(serviceWorker: Worker): Promise<number[]> {
      const tabs = await serviceWorker.evaluate(async () => {
        const allTabs = await chrome.tabs.query({ currentWindow: true });
        return allTabs
          .filter(t => !t.pinned)
          .sort((a, b) => a.index - b.index)
          .map(t => t.id!)
          .filter((id): id is number => id !== undefined);
      });
      return tabs;
    }

    test('Chrome API経由でタブを移動してもツリービューの状態がChromeに再同期される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabA = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(async ({ tabId, targetIndex }) => {
        await chrome.tabs.move(tabId, { index: targetIndex });
      }, { tabId: tabC, targetIndex: 0 });

      // ツリービューの状態は変わらないはず（ツリーが正なので）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      // Chromeタブの順序もツリービューの順序に再同期されているはず
      await waitForCondition(
        async () => {
          const order = await getChromeTabOrder(serviceWorker);
          const indexA = order.indexOf(tabA);
          const indexB = order.indexOf(tabB);
          const indexC = order.indexOf(tabC);
          return indexA < indexB && indexB < indexC;
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Chrome tab order was not re-synchronized from tree state' }
      );

      await closeTab(serviceWorker, tabA);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabB);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabC);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('子タブがある場合、Chrome API経由での移動後も親子関係が維持される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/parent'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/child'), parentTab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      const otherTab = await createTab(serviceWorker, getTestServerUrl('/other'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
        { tabId: otherTab, depth: 0 },
      ], 0);

      // Chrome API経由で子タブを親から引き離そうとしても、ツリーの状態が維持される
      await serviceWorker.evaluate(async ({ tabId, targetIndex }) => {
        await chrome.tabs.move(tabId, { index: targetIndex });
      }, { tabId: childTab, targetIndex: 0 });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
        { tabId: otherTab, depth: 0 },
      ], 0);

      // Chromeタブの順序もツリービューの深さ優先順に再同期される
      await waitForCondition(
        async () => {
          const order = await getChromeTabOrder(serviceWorker);
          const indexParent = order.indexOf(parentTab);
          const indexChild = order.indexOf(childTab);
          const indexOther = order.indexOf(otherTab);
          return indexParent < indexChild && indexChild < indexOther;
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Chrome tab order was not re-synchronized to maintain tree hierarchy' }
      );

      await closeTab(serviceWorker, childTab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: otherTab, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: otherTab, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, otherTab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });
});
