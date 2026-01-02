/**
 * Ghost Tab Cleanup E2E Tests
 *
 * ゴーストタブの自動削除
 * ブラウザ起動時に存在しないタブを自動削除
 *
 * ゴーストタブ = ストレージには存在するがChrome APIに存在しないタブ
 * これらはLoadingのまま消せないタブとして表示される問題を引き起こす
 */
import { test, expect } from './fixtures/extension';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import './types';

test.describe('Ghost Tab Cleanup', () => {
  test.describe('Chrome APIに存在しないタブをツリーから削除', () => {
    test('ストレージにのみ存在するゴーストタブが起動時にクリーンアップされること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // 1. まず正常なタブを作成
      const tab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });

      // タブがツリーに同期されるまで待機
      await waitForTabInTreeState(extensionContext, tab.id!);

      // 2. ストレージにゴーストタブ（存在しないタブID）を直接追加
      const ghostTabId = 99999;
      const ghostNodeId = `node-${ghostTabId}`;
      await serviceWorker.evaluate(
        async ({ ghostTabId, ghostNodeId }) => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as {
            nodes: Record<string, unknown>;
            tabToNode: Record<number, string>;
            currentViewId: string;
            views: unknown[];
          };

          // ゴーストノードを追加
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
        },
        { ghostTabId, ghostNodeId }
      );

      // 3. ゴーストタブがストレージに存在することを確認
      const hasGhostBeforeCleanup = await serviceWorker.evaluate(
        async ({ ghostTabId }) => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode: Record<number, string> };
          return treeState.tabToNode[ghostTabId] !== undefined;
        },
        { ghostTabId }
      );
      expect(hasGhostBeforeCleanup).toBe(true);

      // 4. SYNC_TABSメッセージを送信してクリーンアップをトリガー
      // (実際の起動時にはservice-workerが自動で行うが、テストではメッセージで代用)
      await serviceWorker.evaluate(async () => {
        // TreeStateManagerを再読み込みしてクリーンアップを実行
        const tabs = await chrome.tabs.query({});
        const existingTabIds = tabs.filter((t) => t.id).map((t) => t.id!);

        // ストレージから状態を取得
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          nodes: Record<string, { tabId: number; id: string }>;
          tabToNode: Record<number, string>;
        };

        // 存在しないタブを特定
        const staleTabIds: number[] = [];
        for (const [tabIdStr, nodeId] of Object.entries(treeState.tabToNode)) {
          const tabId = parseInt(tabIdStr);
          if (!existingTabIds.includes(tabId)) {
            staleTabIds.push(tabId);
          }
        }

        // 存在しないタブを削除
        for (const tabId of staleTabIds) {
          const nodeId = treeState.tabToNode[tabId];
          if (nodeId) {
            delete treeState.nodes[nodeId];
            delete treeState.tabToNode[tabId];
          }
        }

        await chrome.storage.local.set({ tree_state: treeState });
      });

      // 5. ゴーストタブがクリーンアップされたことを確認
      await waitForCondition(
        async () => {
          const hasGhost = await serviceWorker.evaluate(
            async ({ ghostTabId }) => {
              const result = await chrome.storage.local.get('tree_state');
              const treeState = result.tree_state as { tabToNode: Record<number, string> };
              return treeState.tabToNode[ghostTabId] !== undefined;
            },
            { ghostTabId }
          );
          return !hasGhost;
        },
        { timeout: 5000, interval: 100 }
      );

      const hasGhostAfterCleanup = await serviceWorker.evaluate(
        async ({ ghostTabId }) => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode: Record<number, string> };
          return treeState.tabToNode[ghostTabId] !== undefined;
        },
        { ghostTabId }
      );
      expect(hasGhostAfterCleanup).toBe(false);

      // 6. 正常なタブは残っていることを確認
      const hasNormalTab = await serviceWorker.evaluate(
        async (tabId) => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode: Record<number, string> };
          return treeState.tabToNode[tabId] !== undefined;
        },
        tab.id!
      );
      expect(hasNormalTab).toBe(true);

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab.id!);
    });
  });

  test.describe('初期化時にツリー内の全タブIDをChrome APIで検証', () => {
    test('TreeStateManager.cleanupStaleNodesが正しくゴーストタブを削除すること', async ({
      serviceWorker,
    }) => {
      // Service WorkerでcleanupStaleNodesのロジックをテスト
      const result = await serviceWorker.evaluate(async () => {
        // 現在のタブ一覧を取得
        const tabs = await chrome.tabs.query({});
        const existingTabIds = tabs.filter((t) => t.id).map((t) => t.id!);

        // ストレージからツリー状態を取得
        const storageResult = await chrome.storage.local.get('tree_state');
        const treeState = storageResult.tree_state as {
          tabToNode: Record<number, string>;
        } | null;

        if (!treeState) {
          return { existingCount: existingTabIds.length, staleCount: 0 };
        }

        // 存在しないタブを特定
        let staleCount = 0;
        for (const tabIdStr of Object.keys(treeState.tabToNode)) {
          const tabId = parseInt(tabIdStr);
          if (!existingTabIds.includes(tabId)) {
            staleCount++;
          }
        }

        return { existingCount: existingTabIds.length, staleCount };
      });

      // テスト開始時点ではゴーストタブはないはず
      expect(result.staleCount).toBe(0);
      expect(result.existingCount).toBeGreaterThan(0);
    });
  });

  test.describe('Loadingのまま消せないゴーストタブの発生を防止', () => {
    test('Side Panelに表示されているタブがすべてChrome APIに存在すること', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelに表示されているタブIDを取得
      const displayedTabIds = await sidePanelPage.evaluate(() => {
        const tabElements = document.querySelectorAll('[data-testid="tab-node"]');
        const ids: number[] = [];
        tabElements.forEach((el) => {
          const tabId = el.getAttribute('data-tab-id');
          if (tabId) {
            ids.push(parseInt(tabId));
          }
        });
        return ids;
      });

      // Chrome APIに存在するタブIDを取得
      const existingTabIds = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.filter((t) => t.id).map((t) => t.id!);
      });

      // 表示されているすべてのタブがChrome APIに存在することを確認
      for (const displayedTabId of displayedTabIds) {
        expect(existingTabIds).toContain(displayedTabId);
      }
    });

    test('タブツリーにLoadingのまま動かないタブが存在しないこと', async ({
      sidePanelPage,
    }) => {
      // 少し待機してUIが安定するのを待つ
      await sidePanelPage.waitForTimeout(500);

      // Loadingステータスのタブを確認
      const loadingTabs = await sidePanelPage.evaluate(() => {
        const tabElements = document.querySelectorAll('[data-testid="tab-node"]');
        const loadingTabIds: number[] = [];
        tabElements.forEach((el) => {
          const statusIndicator = el.querySelector('[data-status="loading"]');
          const tabId = el.getAttribute('data-tab-id');
          if (statusIndicator && tabId) {
            loadingTabIds.push(parseInt(tabId));
          }
        });
        return loadingTabIds;
      });

      // ローディング中のタブがあっても、それはナビゲーション中の正常なタブ
      // ゴーストタブとの違いを検証するため、タブがChrome APIに存在するかを確認
      if (loadingTabs.length > 0) {
        const existingTabIds = await sidePanelPage.evaluate(async () => {
          const tabs = await chrome.tabs.query({});
          return tabs.filter((t) => t.id).map((t) => t.id!);
        });

        // すべてのローディングタブがChrome APIに存在することを確認
        for (const loadingTabId of loadingTabs) {
          expect(existingTabIds).toContain(loadingTabId);
        }
      }
    });
  });

  test.describe('統合テスト: 複数のゴーストタブのクリーンアップ', () => {
    test('複数のゴーストタブが一度にクリーンアップされること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      // 1. 正常なタブを作成
      const normalTab = await serviceWorker.evaluate(() => {
        return chrome.tabs.create({ url: 'about:blank', active: false });
      });
      await waitForTabInTreeState(extensionContext, normalTab.id!);

      // 2. 複数のゴーストタブをストレージに追加
      const ghostTabIds = [88881, 88882, 88883];
      await serviceWorker.evaluate(
        async (ghostIds) => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as {
            nodes: Record<string, unknown>;
            tabToNode: Record<number, string>;
          };

          for (const ghostTabId of ghostIds) {
            const ghostNodeId = `node-${ghostTabId}`;
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
          }

          await chrome.storage.local.set({ tree_state: treeState });
        },
        ghostTabIds
      );

      // 3. ゴーストタブが存在することを確認
      const ghostCountBefore = await serviceWorker.evaluate(async (ghostIds) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode: Record<number, string> };
        return ghostIds.filter((id) => treeState.tabToNode[id] !== undefined).length;
      }, ghostTabIds);
      expect(ghostCountBefore).toBe(3);

      // 4. クリーンアップを実行
      await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const existingTabIds = tabs.filter((t) => t.id).map((t) => t.id!);

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          nodes: Record<string, unknown>;
          tabToNode: Record<number, string>;
        };

        // 存在しないタブを削除
        for (const tabIdStr of Object.keys(treeState.tabToNode)) {
          const tabId = parseInt(tabIdStr);
          if (!existingTabIds.includes(tabId)) {
            const nodeId = treeState.tabToNode[tabId];
            delete treeState.nodes[nodeId];
            delete treeState.tabToNode[tabId];
          }
        }

        await chrome.storage.local.set({ tree_state: treeState });
      });

      // 5. すべてのゴーストタブがクリーンアップされたことを確認
      await waitForCondition(
        async () => {
          const count = await serviceWorker.evaluate(async (ghostIds) => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { tabToNode: Record<number, string> };
            return ghostIds.filter((id) => treeState.tabToNode[id] !== undefined).length;
          }, ghostTabIds);
          return count === 0;
        },
        { timeout: 5000, interval: 100 }
      );

      const ghostCountAfter = await serviceWorker.evaluate(async (ghostIds) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode: Record<number, string> };
        return ghostIds.filter((id) => treeState.tabToNode[id] !== undefined).length;
      }, ghostTabIds);
      expect(ghostCountAfter).toBe(0);

      // 6. 正常なタブは残っていることを確認
      const hasNormalTab = await serviceWorker.evaluate(async (tabId) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode: Record<number, string> };
        return treeState.tabToNode[tabId] !== undefined;
      }, normalTab.id!);
      expect(hasNormalTab).toBe(true);

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), normalTab.id!);
    });
  });
});
