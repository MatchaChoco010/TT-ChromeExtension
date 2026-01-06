import { test, expect } from './fixtures/extension';
import { createTab, closeTab, activateTab, pinTab, unpinTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const createdTabId = await createTab(extensionContext, 'https://example.com');
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
      expect(parentTabId).toBeDefined();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'https://example.com');
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1Id = await createTab(extensionContext, 'https://example.com/1');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(extensionContext, 'https://example.com/2');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      const tab3Id = await createTab(extensionContext, 'https://example.com/3');
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(
        async (id) => {
          return await chrome.tabs.update(id, { url: 'https://example.org' });
        },
        tabId
      );

      const currentTab = await waitForTabUrlLoaded(serviceWorker, tabId, 'example.org', 5000);

      expect(currentTab).toBeDefined();
      expect(currentTab.url).toContain('example.org');
    });

    test('chrome.tabs.update()でactiveを変更した場合、アクティブ状態が更新される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1Id = await createTab(extensionContext, 'https://example.com/1', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(extensionContext, 'https://example.com/2', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(async (tabId) => {
        return await chrome.tabs.update(tabId, { active: true });
      }, tab1Id);

      await waitForTabActive(extensionContext, tab1Id);

      await serviceWorker.evaluate(async (tabId) => {
        return await chrome.tabs.update(tabId, { active: true });
      }, tab2Id);

      await waitForTabActive(extensionContext, tab2Id);
    });

    test('chrome.tabs.update()でpinnedを変更した場合、ピン留め状態が更新される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'https://example.com');

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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1Id = await createTab(extensionContext, 'https://example.com/1');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(extensionContext, 'https://example.com/2');
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'https://example.com', undefined, { active: true });
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1Id = await createTab(extensionContext, 'https://example.com/test');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(extensionContext, 'https://example.org/other');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await waitForTabUrlLoaded(serviceWorker, tab1Id, 'example.com', 5000);
      await waitForTabUrlLoaded(serviceWorker, tab2Id, 'example.org', 5000);

      const filteredTabs = await serviceWorker.evaluate(async () => {
        return await chrome.tabs.query({ url: '*://example.com/*' });
      });

      const filteredTabIds = filteredTabs.map((t: chrome.tabs.Tab) => t.id);
      expect(filteredTabIds).toContain(tab1Id);
      expect(filteredTabIds).not.toContain(tab2Id);
      for (const tab of filteredTabs) {
        expect(tab.url).toContain('example.com');
      }
    });

    test('chrome.tabs.query()でピン留めタブをフィルタリングできる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(extensionContext, tabId);
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'https://example.com');
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'https://example.com');
      expect(tabId).toBeGreaterThan(0);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId, depth: 0 }], 0);

      let treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      });
      expect(treeState?.tabToNode?.[tabId]).toBeDefined();

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

      await waitForTabRemovedFromTreeState(extensionContext, tabId);

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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(async (id) => {
        await chrome.tabs.update(id, { url: 'https://example.com' });
      }, tabId);

      const updatedTab = await waitForTabUrlLoaded(serviceWorker, tabId, 'example.com', 5000);

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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1 = await createTab(extensionContext, 'https://example.com/1');
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: tab1, depth: 0 }], 0);

      const tab2 = await createTab(extensionContext, 'https://example.com/2');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      await activateTab(extensionContext, tab1);

      const activeInfo1 = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        return tabs[0];
      });
      expect(activeInfo1.id).toBe(tab1);

      await activateTab(extensionContext, tab2);

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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'https://example.com', undefined, {
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

      await activateTab(extensionContext, tabId);

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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'https://example.com');
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: parentTabId, depth: 0 }], 0);

      const childTabId = await createTab(
        extensionContext,
        'https://example.com/child',
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

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId, depth: 0 }], 0);

      let treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      });
      const nodeId = treeState.tabToNode[tabId];
      expect(nodeId).toBeDefined();

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

      await waitForTabRemovedFromTreeState(extensionContext, tabId);

      treeState = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state;
      });

      expect(treeState.tabToNode[tabId]).toBeUndefined();
      expect(treeState.nodes[nodeId]).toBeUndefined();
    });
  });
});
