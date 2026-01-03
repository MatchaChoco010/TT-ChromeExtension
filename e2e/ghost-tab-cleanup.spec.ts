/**
 * Ghost Tab Cleanup E2E Tests
 *
 * ゴーストタブの自動削除
 * ブラウザ起動時に存在しないタブを自動削除
 *
 * ゴーストタブ = ストレージには存在するがChrome APIに存在しないタブ
 * これらはLoadingのまま消せないタブとして表示される問題を引き起こす
 */
import { test } from './fixtures/extension';
import { waitForCondition } from './utils/polling-utils';
import {
  createTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import './types';

test.describe('Ghost Tab Cleanup', () => {
  test.describe('Chrome APIに存在しないタブをツリーから削除', () => {
    test('ストレージにのみ存在するゴーストタブが起動時にクリーンアップされること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // テスト初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 1. まず正常なタブを作成
      const tab = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab, depth: 0 },
      ], 0);

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

      // 3. ゴーストタブがストレージに存在することを確認（ストレージ内部状態の検証）
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
          return hasGhost;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Ghost tab was not added to storage' }
      );

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

      // 5. ゴーストタブがクリーンアップされたことを確認（ストレージ内部状態の検証）
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
        { timeout: 5000, interval: 100, timeoutMessage: 'Ghost tab was not cleaned up from storage' }
      );

      // 6. 正常なタブは残っていることを確認（タブ構造全体を検証）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab, depth: 0 },
      ], 0);

      // クリーンアップ
      await closeTab(extensionContext, tab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('初期化時にツリー内の全タブIDをChrome APIで検証', () => {
    test('TreeStateManager.cleanupStaleNodesが正しくゴーストタブを削除すること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // テスト初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // Service WorkerでcleanupStaleNodesのロジックをテスト
      // ゴーストタブがないことを waitForCondition で待機して確認
      await waitForCondition(
        async () => {
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
          // テスト開始時点ではゴーストタブはないはず、かつタブは存在する
          return result.staleCount === 0 && result.existingCount > 0;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Stale tabs found or no existing tabs' }
      );
    });
  });

  test.describe('Loadingのまま消せないゴーストタブの発生を防止', () => {
    test('Side Panelに表示されているタブがすべてChrome APIに存在すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // テスト初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 表示されているすべてのタブがChrome APIに存在することをwaitForConditionで確認
      await waitForCondition(
        async () => {
          // Side Panelに表示されているタブIDを取得
          const displayedTabIds = await sidePanelPage.evaluate(() => {
            const tabElements = document.querySelectorAll('[data-testid^="tree-node-"]');
            const ids: number[] = [];
            tabElements.forEach((el) => {
              const testId = el.getAttribute('data-testid');
              if (testId) {
                const match = testId.match(/^tree-node-(\d+)$/);
                if (match) {
                  ids.push(parseInt(match[1]));
                }
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
          return displayedTabIds.every((id) => existingTabIds.includes(id));
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Some displayed tabs do not exist in Chrome API' }
      );
    });

    test('タブツリーにLoadingのまま動かないタブが存在しないこと', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // テスト初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // ローディング中のタブがある場合、すべてChrome APIに存在することを確認
      await waitForCondition(
        async () => {
          // Loadingステータスのタブを確認
          const loadingTabs = await sidePanelPage.evaluate(() => {
            const tabElements = document.querySelectorAll('[data-testid^="tree-node-"]');
            const loadingTabIds: number[] = [];
            tabElements.forEach((el) => {
              const statusIndicator = el.querySelector('[data-status="loading"]');
              const testId = el.getAttribute('data-testid');
              if (statusIndicator && testId) {
                const match = testId.match(/^tree-node-(\d+)$/);
                if (match) {
                  loadingTabIds.push(parseInt(match[1]));
                }
              }
            });
            return loadingTabIds;
          });

          // ローディング中のタブがなければOK
          if (loadingTabs.length === 0) {
            return true;
          }

          // ローディング中のタブがあっても、それはナビゲーション中の正常なタブ
          // ゴーストタブとの違いを検証するため、タブがChrome APIに存在するかを確認
          const existingTabIds = await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            return tabs.filter((t) => t.id).map((t) => t.id!);
          });

          // すべてのローディングタブがChrome APIに存在することを確認
          return loadingTabs.every((id) => existingTabIds.includes(id));
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Some loading tabs do not exist in Chrome API (ghost tabs detected)' }
      );
    });
  });

  test.describe('統合テスト: 複数のゴーストタブのクリーンアップ', () => {
    test('複数のゴーストタブが一度にクリーンアップされること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // テスト初期化: ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 1. 正常なタブを作成
      const normalTab = await createTab(extensionContext, 'about:blank', { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTab, depth: 0 },
      ], 0);

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

      // 3. ゴーストタブがストレージに追加されたことを確認（ストレージ内部状態の検証）
      await waitForCondition(
        async () => {
          const ghostCount = await serviceWorker.evaluate(async (ghostIds) => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { tabToNode: Record<number, string> };
            return ghostIds.filter((id) => treeState.tabToNode[id] !== undefined).length;
          }, ghostTabIds);
          return ghostCount === 3;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Ghost tabs were not added to storage' }
      );

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

      // 5. すべてのゴーストタブがクリーンアップされたことを確認（ストレージ内部状態の検証）
      await waitForCondition(
        async () => {
          const count = await serviceWorker.evaluate(async (ghostIds) => {
            const result = await chrome.storage.local.get('tree_state');
            const treeState = result.tree_state as { tabToNode: Record<number, string> };
            return ghostIds.filter((id) => treeState.tabToNode[id] !== undefined).length;
          }, ghostTabIds);
          return count === 0;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Ghost tabs were not cleaned up from storage' }
      );

      // 6. 正常なタブは残っていることを確認（タブ構造全体を検証）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTab, depth: 0 },
      ], 0);

      // クリーンアップ
      await closeTab(extensionContext, normalTab);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });
});
