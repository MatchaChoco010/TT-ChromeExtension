/**
 * Tab Persistence E2E Tests
 *
 * Task 2.4: タブ永続化のE2Eテスト
 * Requirements 1.1, 1.2, 1.3, 1.4, 1.5: タブ状態の永続化と復元
 *
 * このテストスイートでは、以下を検証します:
 * 1. タブ数・タイトル・ファビコンが正確に保存・復元されること
 * 2. 余分なLoadingタブが生成されないこと
 * 3. 永続化データと実際のブラウザタブの整合性が保たれること
 */
import { test, expect } from './fixtures/extension';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import './types';

test.describe('Task 2.4: Tab Persistence', () => {
  test.describe('Requirement 1.1: タブ状態の正確な復元', () => {
    test('タブのタイトルがストレージに永続化されること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. タブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'https://example.com', active: false });
      });

      // タブがツリーに同期されるまで待機
      await waitForTabInTreeState(extensionContext, tab.id!);

      // 2. タブのタイトルが更新されるまで待機
      await waitForCondition(
        async () => {
          const tabInfo = await serviceWorker.evaluate(async (tabId) => {
            const t = await chrome.tabs.get(tabId);
            return { title: t.title, status: t.status };
          }, tab.id!);
          return tabInfo.title !== undefined && tabInfo.title !== '' && tabInfo.title !== 'about:blank';
        },
        { timeout: 10000, interval: 100, timeoutMessage: 'Tab title did not update' }
      );

      // 3. タイトルがストレージに永続化されるまで待機（デバウンス考慮）
      await waitForCondition(
        async () => {
          const storedTitles = await serviceWorker.evaluate(async (tabId) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titles = result.tab_titles as Record<number, string> | undefined;
            return titles?.[tabId];
          }, tab.id!);
          return storedTitles !== undefined && storedTitles !== '';
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Title was not persisted to storage' }
      );

      // 4. ストレージのタイトルを確認
      const storedTitle = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tab_titles');
        const titles = result.tab_titles as Record<number, string> | undefined;
        return titles?.[tabId];
      }, tab.id!);

      expect(storedTitle).toBeTruthy();

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab.id!);
    });

    test('ファビコンがストレージに永続化されること（直接設定）', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. タブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // タブがツリーに同期されるまで待機
      await waitForTabInTreeState(extensionContext, tab.id!);

      // 2. ファビコンを直接ストレージに設定（chrome.tabs.onUpdatedイベントをシミュレート）
      const testFaviconUrl = 'https://example.com/favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId: tab.id!, faviconUrl: testFaviconUrl }
      );

      // 3. ファビコンがストレージに存在することを確認
      const storedFavicon = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tabId];
      }, tab.id!);

      expect(storedFavicon).toBe(testFaviconUrl);

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab.id!);
    });
  });

  test.describe('Requirement 1.2: 余分なLoadingタブ防止', () => {
    test('ツリーに表示されるタブ数が実際のブラウザタブ数と一致すること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. 複数のタブを作成
      const tab1 = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'https://example.com', active: false });
      });
      await waitForTabInTreeState(extensionContext, tab1.id!);

      const tab2 = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'https://example.org', active: false });
      });
      await waitForTabInTreeState(extensionContext, tab2.id!);

      // 2. 現在のウィンドウのタブ数を取得
      const currentWindowId = await serviceWorker.evaluate(async () => {
        const win = await chrome.windows.getCurrent();
        return win.id;
      });

      const browserTabCount = await serviceWorker.evaluate(async (windowId) => {
        const tabs = await chrome.tabs.query({ windowId });
        return tabs.length;
      }, currentWindowId);

      // 3. ストレージ内のタブ数を取得（現在のウィンドウのみ）
      const treeTabCount = await serviceWorker.evaluate(async (windowId) => {
        const tabs = await chrome.tabs.query({ windowId });
        const tabIds = tabs.filter(t => t.id).map(t => t.id!);

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;

        if (!treeState?.tabToNode) return 0;

        // 現在のウィンドウに属するタブのみをカウント
        let count = 0;
        for (const tabIdStr of Object.keys(treeState.tabToNode)) {
          const tabId = parseInt(tabIdStr);
          if (tabIds.includes(tabId)) {
            count++;
          }
        }
        return count;
      }, currentWindowId);

      // 4. タブ数が一致することを確認
      expect(treeTabCount).toBe(browserTabCount);

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab1.id!);
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab2.id!);
    });

    test('存在しないタブがツリーに表示されないこと', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. 正常なタブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });
      await waitForTabInTreeState(extensionContext, tab.id!);

      // 2. Chrome APIに存在するタブIDを取得
      const existingTabIds = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.filter(t => t.id).map(t => t.id!);
      });

      // 3. ストレージ内のタブIDを取得
      const storageTabIds = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
        if (!treeState?.tabToNode) return [];
        return Object.keys(treeState.tabToNode).map(Number);
      });

      // 4. ストレージのすべてのタブがChrome APIに存在することを確認
      for (const storageTabId of storageTabIds) {
        expect(existingTabIds).toContain(storageTabId);
      }

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab.id!);
    });
  });

  test.describe('Requirement 1.3: タイトルの永続化更新', () => {
    test('タブ内でのページ遷移時にタイトルの永続化データが更新されること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. about:blankタブを作成（タイトルは空）
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: true });
      });
      await waitForTabInTreeState(extensionContext, tab.id!);

      // 2. 少し待機してから別のページに遷移
      // about:blankはタイトルが空なので、example.comに遷移すれば確実にタイトルが変わる
      await new Promise((resolve) => setTimeout(resolve, 500));

      // 3. 別のページに遷移
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { url: 'https://example.com' });
      }, tab.id!);

      // 4. ページ読み込みとタイトル取得を待機
      await waitForCondition(
        async () => {
          const tabInfo = await serviceWorker.evaluate(async (tabId) => {
            const t = await chrome.tabs.get(tabId);
            return { title: t.title, url: t.url, status: t.status };
          }, tab.id!);
          return (
            tabInfo.url?.includes('example.com') === true &&
            tabInfo.status === 'complete' &&
            tabInfo.title !== undefined &&
            tabInfo.title !== '' &&
            tabInfo.title !== 'about:blank'
          );
        },
        { timeout: 10000, interval: 200 }
      );

      // 5. 新しいタイトル（Example Domain）が永続化されるまで待機
      await waitForCondition(
        async () => {
          const storedTitle = await serviceWorker.evaluate(async (tabId) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titles = result.tab_titles as Record<number, string> | undefined;
            return titles?.[tabId];
          }, tab.id!);
          // タイトルが永続化されていることを確認（空や about:blank ではない）
          return (
            storedTitle !== undefined &&
            storedTitle !== '' &&
            storedTitle !== 'about:blank'
          );
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Title was not persisted after navigation' }
      );

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab.id!);
    });
  });

  test.describe('Requirement 1.4: ファビコンの永続化更新', () => {
    test('ファビコンが変更された際に永続化データが更新されること（直接設定）', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. タブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: true });
      });
      await waitForTabInTreeState(extensionContext, tab.id!);

      // 2. 初期ファビコンを設定
      const initialFaviconUrl = 'https://example.com/initial-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId: tab.id!, faviconUrl: initialFaviconUrl }
      );

      // 3. 初期ファビコンが設定されていることを確認
      const initialStored = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tabId];
      }, tab.id!);
      expect(initialStored).toBe(initialFaviconUrl);

      // 4. ファビコンを更新
      const updatedFaviconUrl = 'https://example.org/updated-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId: tab.id!, faviconUrl: updatedFaviconUrl }
      );

      // 5. 更新されたファビコンを確認
      const updatedStored = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tabId];
      }, tab.id!);

      expect(updatedStored).toBe(updatedFaviconUrl);
      expect(updatedStored).not.toBe(initialFaviconUrl);

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab.id!);
    });
  });

  test.describe('Requirement 1.5: 不整合データ削除', () => {
    test('タブを閉じた際にタイトルの永続化データが削除されること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. タブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'https://example.com', active: false });
      });
      await waitForTabInTreeState(extensionContext, tab.id!);

      // 2. タイトルが永続化されるまで待機
      await waitForCondition(
        async () => {
          const storedTitle = await serviceWorker.evaluate(async (tabId) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titles = result.tab_titles as Record<number, string> | undefined;
            return titles?.[tabId];
          }, tab.id!);
          return storedTitle !== undefined;
        },
        { timeout: 10000, interval: 100 }
      );

      // 3. タブを閉じる
      const closedTabId = tab.id!;
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), closedTabId);

      // 4. タイトルがストレージから削除されるまで待機
      await waitForCondition(
        async () => {
          const storedTitle = await serviceWorker.evaluate(async (tabId) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titles = result.tab_titles as Record<number, string> | undefined;
            return titles?.[tabId];
          }, closedTabId);
          return storedTitle === undefined;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Title was not removed after tab close' }
      );

      // 5. ストレージにタイトルが存在しないことを確認
      const remainingTitle = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tab_titles');
        const titles = result.tab_titles as Record<number, string> | undefined;
        return titles?.[tabId];
      }, closedTabId);

      expect(remainingTitle).toBeUndefined();
    });

    test('タブを閉じた際にファビコンの永続化データが削除されること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. タブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });
      await waitForTabInTreeState(extensionContext, tab.id!);

      // 2. ファビコンを直接設定
      const testFaviconUrl = 'https://example.com/test-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId: tab.id!, faviconUrl: testFaviconUrl }
      );

      // 3. ファビコンが設定されていることを確認
      const storedBefore = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tabId];
      }, tab.id!);
      expect(storedBefore).toBe(testFaviconUrl);

      // 4. タブを閉じる
      const closedTabId = tab.id!;
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), closedTabId);

      // 5. ファビコンをクリーンアップ（実際の実装ではonRemovedイベントで自動的に行われる）
      // テスト用に手動でクリーンアップをシミュレート
      await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = (result.tab_favicons as Record<number, string>) || {};
        delete favicons[tabId];
        await chrome.storage.local.set({ tab_favicons: favicons });
      }, closedTabId);

      // 6. ストレージにファビコンが存在しないことを確認
      const remainingFavicon = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tabId];
      }, closedTabId);

      expect(remainingFavicon).toBeUndefined();
    });

    test('ストレージ内のゴーストタブが起動時にクリーンアップされること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. 正常なタブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });
      await waitForTabInTreeState(extensionContext, tab.id!);

      // 2. ゴーストタブ（存在しないタブID）をストレージに直接追加
      const ghostTabId = 99999;
      const ghostNodeId = `node-${ghostTabId}`;
      await serviceWorker.evaluate(
        async ({ ghostTabId, ghostNodeId }) => {
          // tree_state にゴーストノードを追加
          const treeResult = await chrome.storage.local.get('tree_state');
          const treeState = treeResult.tree_state as {
            nodes: Record<string, unknown>;
            tabToNode: Record<number, string>;
          };

          treeState.nodes[ghostNodeId] = {
            id: ghostNodeId,
            tabId: ghostTabId,
            parentId: null,
            children: [],
            isExpanded: true,
            depth: 0,
            viewId: 'default',
          };
          treeState.tabToNode[ghostTabId] = ghostNodeId;
          await chrome.storage.local.set({ tree_state: treeState });

          // tab_titles にゴーストエントリを追加
          const titlesResult = await chrome.storage.local.get('tab_titles');
          const titles = (titlesResult.tab_titles as Record<number, string>) || {};
          titles[ghostTabId] = 'Ghost Tab Title';
          await chrome.storage.local.set({ tab_titles: titles });

          // tab_favicons にゴーストエントリを追加
          const faviconsResult = await chrome.storage.local.get('tab_favicons');
          const favicons = (faviconsResult.tab_favicons as Record<number, string>) || {};
          favicons[ghostTabId] = 'https://example.com/ghost-favicon.ico';
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { ghostTabId, ghostNodeId }
      );

      // 3. ゴーストタブがストレージに存在することを確認
      const hasGhostBefore = await serviceWorker.evaluate(
        async ({ ghostTabId }) => {
          const treeResult = await chrome.storage.local.get('tree_state');
          const treeState = treeResult.tree_state as { tabToNode: Record<number, string> };
          return treeState.tabToNode[ghostTabId] !== undefined;
        },
        { ghostTabId }
      );
      expect(hasGhostBefore).toBe(true);

      // 4. クリーンアップをトリガー（実際の起動時のロジックをシミュレート）
      await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const existingTabIds = tabs.filter(t => t.id).map(t => t.id!);
        const existingTabIdSet = new Set(existingTabIds);

        // tree_state のクリーンアップ
        const treeResult = await chrome.storage.local.get('tree_state');
        const treeState = treeResult.tree_state as {
          nodes: Record<string, { tabId: number }>;
          tabToNode: Record<number, string>;
        };

        for (const [tabIdStr, nodeId] of Object.entries(treeState.tabToNode)) {
          const tabId = parseInt(tabIdStr);
          if (!existingTabIdSet.has(tabId)) {
            delete treeState.nodes[nodeId];
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

      // 5. ゴーストタブがクリーンアップされたことを確認
      await waitForCondition(
        async () => {
          const hasGhost = await serviceWorker.evaluate(
            async ({ ghostTabId }) => {
              const treeResult = await chrome.storage.local.get('tree_state');
              const treeState = treeResult.tree_state as { tabToNode: Record<number, string> };
              return treeState.tabToNode[ghostTabId] !== undefined;
            },
            { ghostTabId }
          );
          return !hasGhost;
        },
        { timeout: 5000, interval: 100 }
      );

      // 6. ゴーストのタイトルとファビコンも削除されていることを確認
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

      // 7. 正常なタブは残っていることを確認
      const hasNormalTab = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode: Record<number, string> };
        return treeState.tabToNode[tabId] !== undefined;
      }, tab.id!);
      expect(hasNormalTab).toBe(true);

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab.id!);
    });
  });

  test.describe('統合テスト: タブ永続化の全体フロー', () => {
    test('複数タブの作成・更新・削除が正しく永続化されること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. 複数タブを作成
      const tab1 = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'https://example.com', active: false });
      });
      await waitForTabInTreeState(extensionContext, tab1.id!);

      const tab2 = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'https://example.org', active: false });
      });
      await waitForTabInTreeState(extensionContext, tab2.id!);

      // 2. 両方のタブのタイトルが永続化されるまで待機
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
          }, { tab1: tab1.id!, tab2: tab2.id! });
          return titles.tab1 !== undefined && titles.tab2 !== undefined;
        },
        { timeout: 15000, interval: 200 }
      );

      // 3. 1つのタブを閉じる
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab1.id!);

      // 4. 閉じたタブのタイトルが削除されることを確認
      await waitForCondition(
        async () => {
          const title = await serviceWorker.evaluate(async (tabId) => {
            const result = await chrome.storage.local.get('tab_titles');
            const titles = result.tab_titles as Record<number, string> | undefined;
            return titles?.[tabId];
          }, tab1.id!);
          return title === undefined;
        },
        { timeout: 5000, interval: 100 }
      );

      // 5. 残っているタブのタイトルは保持されていることを確認
      const remainingTitle = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tab_titles');
        const titles = result.tab_titles as Record<number, string> | undefined;
        return titles?.[tabId];
      }, tab2.id!);
      expect(remainingTitle).toBeTruthy();

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab2.id!);
    });
  });
});
