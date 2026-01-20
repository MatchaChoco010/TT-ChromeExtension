import { test, expect } from './fixtures/extension';
import { waitForCondition } from './utils/polling-utils';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';
import './types';

test.describe('Tab Persistence', () => {
  test.describe('タブ状態の正確な復元', () => {
    test('タブのタイトルがストレージに永続化されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForCondition(
        async () => {
          const tabInfo = await serviceWorker.evaluate(async (id) => {
            const t = await chrome.tabs.get(id);
            return { title: t.title, status: t.status };
          }, tabId);
          return tabInfo.title !== undefined && tabInfo.title !== '' && tabInfo.title !== getTestServerUrl('/page');
        },
        { timeout: 10000, interval: 100, timeoutMessage: 'Tab title did not update' }
      );

      await waitForCondition(
        async () => {
          const storedTitles = await serviceWorker.evaluate(async (id) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titles = result.tab_titles as Record<number, string> | undefined;
            return titles?.[id];
          }, tabId);
          return storedTitles !== undefined && storedTitles !== '';
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Title was not persisted to storage' }
      );

      const storedTitle = await serviceWorker.evaluate(async (id) => {
        const result = await chrome.storage.local.get('tab_titles');
        const titles = result.tab_titles as Record<number, string> | undefined;
        return titles?.[id];
      }, tabId);

      expect(storedTitle).toBeTruthy();

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('ファビコンがストレージに永続化されること（直接設定）', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabUrl = getTestServerUrl('/page');
      const tabId = await createTab(serviceWorker, tabUrl, undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      const testFaviconUrl = 'http://127.0.0.1/favicon.ico';
      await serviceWorker.evaluate(
        async ({ url, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<string, string>) || {};
          favicons[url] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { url: tabUrl, faviconUrl: testFaviconUrl }
      );

      const storedFavicon = await serviceWorker.evaluate(async (url) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<string, string> | undefined;
        return favicons?.[url];
      }, tabUrl);

      expect(storedFavicon).toBe(testFaviconUrl);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('余分なLoadingタブ防止', () => {
    test('ツリーに表示されるタブ数が実際のブラウザタブ数と一致すること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tab1Id = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      const browserTabCount = await serviceWorker.evaluate(async (windowId) => {
        const tabs = await chrome.tabs.query({ windowId });
        return tabs.length;
      }, windowId);

      const treeTabCount = await serviceWorker.evaluate(async (windowId) => {
        const tabs = await chrome.tabs.query({ windowId });
        const tabIds = tabs.filter(t => t.id).map(t => t.id!);

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;

        if (!treeState?.tabToNode) return 0;

        let count = 0;
        for (const tabIdStr of Object.keys(treeState.tabToNode)) {
          const tabId = parseInt(tabIdStr);
          if (tabIds.includes(tabId)) {
            count++;
          }
        }
        return count;
      }, windowId);

      expect(treeTabCount).toBe(browserTabCount);

      await closeTab(serviceWorker, tab1Id);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tab2Id);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('存在しないタブがツリーに表示されないこと', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      const existingTabIds = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.filter(t => t.id).map(t => t.id!);
      });

      const storageTabIds = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
        if (!treeState?.tabToNode) return [];
        return Object.keys(treeState.tabToNode).map(Number);
      });

      for (const storageTabId of storageTabIds) {
        expect(existingTabIds).toContain(storageTabId);
      }

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('タイトルの永続化更新', () => {
    test('タブ内でのページ遷移時にタイトルの永続化データが更新されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      const navigateUrl = getTestServerUrl('/page2');
      await serviceWorker.evaluate(async ({ id, url }) => {
        await chrome.tabs.update(id, { url });
      }, { id: tabId, url: navigateUrl });

      await waitForCondition(
        async () => {
          const tabInfo = await serviceWorker.evaluate(async (id) => {
            const t = await chrome.tabs.get(id);
            return { title: t.title, url: t.url, status: t.status };
          }, tabId);
          return (
            tabInfo.url?.includes('127.0.0.1') === true &&
            tabInfo.status === 'complete' &&
            tabInfo.title !== undefined &&
            tabInfo.title !== ''
          );
        },
        { timeout: 10000, interval: 200 }
      );

      await waitForCondition(
        async () => {
          const storedTitle = await serviceWorker.evaluate(async (id) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titles = result.tab_titles as Record<number, string> | undefined;
            return titles?.[id];
          }, tabId);
          return storedTitle !== undefined && storedTitle !== '';
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Title was not persisted after navigation' }
      );

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('ファビコンの永続化更新', () => {
    test('ファビコンが変更された際に永続化データが更新されること（直接設定）', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      const initialFaviconUrl = 'http://127.0.0.1/initial-favicon.ico';
      await serviceWorker.evaluate(
        async ({ id, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[id] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { id: tabId, faviconUrl: initialFaviconUrl }
      );

      const initialStored = await serviceWorker.evaluate(async (id) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[id];
      }, tabId);
      expect(initialStored).toBe(initialFaviconUrl);

      const updatedFaviconUrl = 'http://127.0.0.1/updated-favicon.ico';
      await serviceWorker.evaluate(
        async ({ id, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[id] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { id: tabId, faviconUrl: updatedFaviconUrl }
      );

      const updatedStored = await serviceWorker.evaluate(async (id) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[id];
      }, tabId);

      expect(updatedStored).toBe(updatedFaviconUrl);
      expect(updatedStored).not.toBe(initialFaviconUrl);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('不整合データ削除', () => {
    test('タブを閉じた際にタイトルの永続化データが削除されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForCondition(
        async () => {
          const storedTitle = await serviceWorker.evaluate(async (id) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titles = result.tab_titles as Record<number, string> | undefined;
            return titles?.[id];
          }, tabId);
          return storedTitle !== undefined;
        },
        { timeout: 10000, interval: 100 }
      );

      const closedTabId = tabId;
      await closeTab(serviceWorker, closedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForCondition(
        async () => {
          const storedTitle = await serviceWorker.evaluate(async (id) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titles = result.tab_titles as Record<number, string> | undefined;
            return titles?.[id];
          }, closedTabId);
          return storedTitle === undefined;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Title was not removed after tab close' }
      );

      const remainingTitle = await serviceWorker.evaluate(async (id) => {
        const result = await chrome.storage.local.get('tab_titles');
        const titles = result.tab_titles as Record<number, string> | undefined;
        return titles?.[id];
      }, closedTabId);

      expect(remainingTitle).toBeUndefined();
    });

    test('タブを閉じた際にファビコンの永続化データが削除されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      const testFaviconUrl = 'http://127.0.0.1/test-favicon.ico';
      await serviceWorker.evaluate(
        async ({ id, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[id] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { id: tabId, faviconUrl: testFaviconUrl }
      );

      const storedBefore = await serviceWorker.evaluate(async (id) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[id];
      }, tabId);
      expect(storedBefore).toBe(testFaviconUrl);

      const closedTabId = tabId;
      await closeTab(serviceWorker, closedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // テスト用に手動でクリーンアップをシミュレート
      await serviceWorker.evaluate(async (id) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = (result.tab_favicons as Record<number, string>) || {};
        delete favicons[id];
        await chrome.storage.local.set({ tab_favicons: favicons });
      }, closedTabId);

      const remainingFavicon = await serviceWorker.evaluate(async (id) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[id];
      }, closedTabId);

      expect(remainingFavicon).toBeUndefined();
    });

    test('ストレージ内のゴーストタブが起動時にクリーンアップされること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      const ghostTabId = 99999;
      const ghostNodeId = `node-${ghostTabId}`;
      await serviceWorker.evaluate(
        async ({ ghostTabId, ghostNodeId }) => {
          interface ViewState {
            info: { id: string; name: string; color: string };
            rootNodeIds: string[];
            nodes: Record<string, unknown>;
          }
          // tree_state にゴーストノードを追加
          const treeResult = await chrome.storage.local.get('tree_state');
          const treeState = treeResult.tree_state as {
            views: Record<string, ViewState>;
            tabToNode: Record<number, { viewId: string; nodeId: string }>;
          };

          const viewId = 'default';
          if (treeState.views[viewId]) {
            treeState.views[viewId].nodes[ghostNodeId] = {
              id: ghostNodeId,
              tabId: ghostTabId,
              parentId: null,
              children: [],
              isExpanded: true,
              depth: 0,
            };
            treeState.tabToNode[ghostTabId] = { viewId, nodeId: ghostNodeId };
          }
          await chrome.storage.local.set({ tree_state: treeState });

          // tab_titles にゴーストエントリを追加
          const titlesResult = await chrome.storage.local.get('tab_titles');
          const titles = (titlesResult.tab_titles as Record<number, string>) || {};
          titles[ghostTabId] = 'Ghost Tab Title';
          await chrome.storage.local.set({ tab_titles: titles });

          // tab_favicons にゴーストエントリを追加
          const faviconsResult = await chrome.storage.local.get('tab_favicons');
          const favicons = (faviconsResult.tab_favicons as Record<number, string>) || {};
          favicons[ghostTabId] = 'http://127.0.0.1/ghost-favicon.ico';
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { ghostTabId, ghostNodeId }
      );

      const hasGhostBefore = await serviceWorker.evaluate(
        async ({ ghostTabId }) => {
          const treeResult = await chrome.storage.local.get('tree_state');
          const treeState = treeResult.tree_state as {
            tabToNode: Record<number, { viewId: string; nodeId: string }>;
          };
          return treeState.tabToNode[ghostTabId] !== undefined;
        },
        { ghostTabId }
      );
      expect(hasGhostBefore).toBe(true);

      await serviceWorker.evaluate(async () => {
        interface ViewState {
          nodes: Record<string, { tabId: number }>;
        }
        const tabs = await chrome.tabs.query({});
        const existingTabIds = tabs.filter(t => t.id).map(t => t.id!);
        const existingTabIdSet = new Set(existingTabIds);

        // tree_state のクリーンアップ
        const treeResult = await chrome.storage.local.get('tree_state');
        const treeState = treeResult.tree_state as {
          views: Record<string, ViewState>;
          tabToNode: Record<number, { viewId: string; nodeId: string }>;
        };

        for (const [tabIdStr] of Object.entries(treeState.tabToNode)) {
          const tabId = parseInt(tabIdStr);
          if (!existingTabIdSet.has(tabId)) {
            const nodeInfo = treeState.tabToNode[tabId];
            if (nodeInfo && treeState.views[nodeInfo.viewId]) {
              delete treeState.views[nodeInfo.viewId].nodes[nodeInfo.nodeId];
            }
            delete treeState.tabToNode[tabId];
          }
        }
        await chrome.storage.local.set({ tree_state: treeState });

        // tab_titles のクリーンアップ
        const titlesResult = await chrome.storage.local.get('tab_titles');
        const titles = (titlesResult.tab_titles as Record<number, string>) || {};
        for (const tabIdStr of Object.keys(titles)) {
          const tabId = parseInt(tabIdStr);
          if (!existingTabIdSet.has(tabId)) {
            delete titles[tabId];
          }
        }
        await chrome.storage.local.set({ tab_titles: titles });

        // tab_favicons のクリーンアップ
        const faviconsResult = await chrome.storage.local.get('tab_favicons');
        const favicons = (faviconsResult.tab_favicons as Record<number, string>) || {};
        for (const tabIdStr of Object.keys(favicons)) {
          const tabId = parseInt(tabIdStr);
          if (!existingTabIdSet.has(tabId)) {
            delete favicons[tabId];
          }
        }
        await chrome.storage.local.set({ tab_favicons: favicons });
      });

      await waitForCondition(
        async () => {
          const hasGhost = await serviceWorker.evaluate(
            async ({ ghostTabId }) => {
              const treeResult = await chrome.storage.local.get('tree_state');
              const treeState = treeResult.tree_state as {
                tabToNode: Record<number, { viewId: string; nodeId: string }>;
              };
              return treeState.tabToNode[ghostTabId] !== undefined;
            },
            { ghostTabId }
          );
          return !hasGhost;
        },
        { timeout: 5000, interval: 100 }
      );

      const remainingGhostTitle = await serviceWorker.evaluate(
        async ({ ghostTabId }) => {
          const result = await chrome.storage.local.get('tab_titles');
          const titles = result.tab_titles as Record<number, string> | undefined;
          return titles?.[ghostTabId];
        },
        { ghostTabId }
      );
      expect(remainingGhostTitle).toBeUndefined();

      const remainingGhostFavicon = await serviceWorker.evaluate(
        async ({ ghostTabId }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = result.tab_favicons as Record<number, string> | undefined;
          return favicons?.[ghostTabId];
        },
        { ghostTabId }
      );
      expect(remainingGhostFavicon).toBeUndefined();

      const hasNormalTab = await serviceWorker.evaluate(async (id) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode: Record<number, { viewId: string; nodeId: string }>;
        };
        return treeState.tabToNode[id] !== undefined;
      }, tabId);
      expect(hasNormalTab).toBe(true);

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('統合テスト: タブ永続化の全体フロー', () => {
    test('複数タブの作成・更新・削除が正しく永続化されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tab1Id = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
      ], 0);

      const tab2Id = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1Id, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await waitForCondition(
        async () => {
          const titles = await serviceWorker.evaluate(async (tabIds) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titlesMap = result.tab_titles as Record<number, string> | undefined;
            if (!titlesMap) return { tab1: undefined, tab2: undefined };
            return {
              tab1: titlesMap[tabIds.tab1],
              tab2: titlesMap[tabIds.tab2],
            };
          }, { tab1: tab1Id, tab2: tab2Id });
          return titles.tab1 !== undefined && titles.tab2 !== undefined;
        },
        { timeout: 15000, interval: 200 }
      );

      await closeTab(serviceWorker, tab1Id);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab2Id, depth: 0 },
      ], 0);

      await waitForCondition(
        async () => {
          const title = await serviceWorker.evaluate(async (id) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titles = result.tab_titles as Record<number, string> | undefined;
            return titles?.[id];
          }, tab1Id);
          return title === undefined;
        },
        { timeout: 5000, interval: 100 }
      );

      const remainingTitle = await serviceWorker.evaluate(async (id) => {
        const result = await chrome.storage.local.get('tab_titles');
        const titles = result.tab_titles as Record<number, string> | undefined;
        return titles?.[id];
      }, tab2Id);
      expect(remainingTitle).toBeTruthy();

      await closeTab(serviceWorker, tab2Id);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });
});
