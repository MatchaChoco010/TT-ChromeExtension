import { test, expect } from './fixtures/extension';
import { createTab, closeTab, activateTab, pinTab, getCurrentWindowId, getPseudoSidePanelTabId, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { waitForCondition, waitForTabRemovedFromTreeState, waitForTabUrlLoaded, waitForTabActive } from './utils/polling-utils';

test.describe('chrome.tabs API統合', () => {
  test.describe('chrome.tabs.create()', () => {
    test('chrome.tabs.create()を呼び出した場合、新しいタブが作成される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const createdTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: createdTabId, depth: 0 },
      ], 0);
    });

    test('chrome.tabs.create()でopenerTabIdを指定した場合、親子関係が確立される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));
      expect(parentTabId).toBeDefined();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(serviceWorker, getTestServerUrl('/child'), parentTabId);
      expect(childTabId).toBeDefined();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);
    });
  });

  test.describe('chrome.tabs.remove()', () => {
    test('chrome.tabs.remove()を呼び出した場合、タブが削除される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(async (id) => {
        await chrome.tabs.remove(id);
      }, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('chrome.tabs.remove()で複数タブを一括削除できる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tab1Id = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      const tab3Id = await createTab(serviceWorker, getTestServerUrl('/page3'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
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
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('chrome.tabs.update()', () => {
    test('chrome.tabs.update()でURLを変更した場合、タブのURLが更新される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/google'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
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
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tab1Id = await createTab(serviceWorker, getTestServerUrl('/page1'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(serviceWorker, getTestServerUrl('/page2'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
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
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(async (id) => {
        return await chrome.tabs.update(id, { pinned: true });
      }, tabId);

      await assertPinnedTabStructure(sidePanelPage, windowId, [
        { tabId: tabId },
      ], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // Chromeはピン留め解除時にタブを最初の非ピン留め位置（index 0）に配置するため、
      // tabIdがpseudoSidePanelTabIdより前に表示される
      await serviceWorker.evaluate(async (id) => {
        return await chrome.tabs.update(id, { pinned: false });
      }, tabId);

      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('chrome.tabs.query()', () => {
    test('chrome.tabs.query()で全タブを取得できる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tab1Id = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);
    });

    test('chrome.tabs.query()でアクティブタブを取得できる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
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
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tab1Id = await createTab(serviceWorker, getTestServerUrl('/test'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(serviceWorker, getTestServerUrl('/other'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
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
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(serviceWorker, tabId);
      await assertPinnedTabStructure(sidePanelPage, windowId, [
        { tabId: tabId },
      ], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('chrome.tabs.onCreated イベント', () => {
    test('タブ作成時にonCreatedイベントが発火してツリーが更新される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      expect(tabId).toBeGreaterThan(0);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId, depth: 0 }], 0);

      const treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      });

      expect(treeState).toBeDefined();
      expect(treeState.tabToNode).toBeDefined();
      expect(treeState.tabToNode[tabId]).toBeDefined();
    });
  });

  test.describe('chrome.tabs.onRemoved イベント', () => {
    test('タブ削除時にonRemovedイベントが発火してツリーから削除される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      expect(tabId).toBeGreaterThan(0);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId, depth: 0 }], 0);

      let treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      });
      expect(treeState?.tabToNode?.[tabId]).toBeDefined();

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

      await waitForTabRemovedFromTreeState(serviceWorker, tabId);

      treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      });

      expect(treeState?.tabToNode?.[tabId]).toBeUndefined();
    });
  });

  test.describe('chrome.tabs.onUpdated イベント', () => {
    test('タブURL更新時にonUpdatedイベントが発火する', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/blank'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
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
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tab1 = await createTab(serviceWorker, getTestServerUrl('/page1'));
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: tab1, depth: 0 }], 0);

      const tab2 = await createTab(serviceWorker, getTestServerUrl('/page2'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      await activateTab(serviceWorker, tab1);

      const activeInfo1 = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0];
      });
      expect(activeInfo1.id).toBe(tab1);

      await activateTab(serviceWorker, tab2);

      const activeInfo2 = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0];
      });
      expect(activeInfo2.id).toBe(tab2);
    });

    test('未読タブをアクティブ化すると未読状態がクリアされる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, {
        active: false,
      });
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId, depth: 0 }], 0);

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
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId, depth: 0 }], 0);

      const treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      });

      expect(treeState).toBeDefined();
      expect(treeState.tabToNode).toBeDefined();
      const nodeId = treeState.tabToNode[tabId];
      expect(nodeId).toBeDefined();

      const node = treeState.nodes[nodeId];
      expect(node).toBeDefined();
      expect(node.tabId).toBe(tabId);
    });

    test('親子関係付きでタブを作成するとツリー構造が正しく形成される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: parentTabId, depth: 0 }], 0);

      const childTabId = await createTab(
      serviceWorker,
        getTestServerUrl('/child'),
        parentTabId
      );
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      });

      const parentNodeId = treeState.tabToNode[parentTabId];
      const childNodeId = treeState.tabToNode[childTabId];

      expect(parentNodeId).toBeDefined();
      expect(childNodeId).toBeDefined();

      const childNode = treeState.nodes[childNodeId];
      expect(childNode.parentId).toBe(parentNodeId);
    });

    test('タブ削除時にツリーからノードが削除される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId, depth: 0 }], 0);

      let treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      });
      const nodeId = treeState.tabToNode[tabId];
      expect(nodeId).toBeDefined();

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

      await waitForTabRemovedFromTreeState(serviceWorker, tabId);

      treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      });

      expect(treeState.tabToNode[tabId]).toBeUndefined();
      expect(treeState.nodes[nodeId]).toBeUndefined();
    });
  });
});
