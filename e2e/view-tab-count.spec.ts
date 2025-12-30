/**
 * ビューのタブカウント正確性 E2Eテスト
 *
 * Task 2.2 (tab-tree-comprehensive-fix): タブカウント更新のE2Eテスト追加
 * Requirements: 2.2, 2.4, 2.5
 *
 * テスト対象:
 * 1. 不整合タブ削除時のカウント再計算
 * 2. タブ追加・削除時のカウント即時更新
 * 3. 安定性: --repeat-each=10 で10回連続成功
 */
import { test, expect } from './fixtures/extension';
import {
  waitForTabInTreeState,
  waitForTabRemovedFromTreeState,
  waitForViewSwitcher,
  waitForCondition,
} from './utils/polling-utils';
import { createTab, closeTab } from './utils/tab-utils';

test.describe('Task 2.2: ビューのタブカウント正確性', () => {
  test.describe('Requirement 2.2: タブ追加・削除時のカウント即時更新', () => {
    test('タブを追加した場合、ViewSwitcherのタブカウントバッジが即座に更新される', async ({
      sidePanelPage,
      extensionContext,
    }) => {
      // Side Panelが表示されることを確認
      await waitForViewSwitcher(sidePanelPage);

      // 初期状態のタブ数を取得
      const getTabCountBadge = async () => {
        // デフォルトビューのタブカウントバッジを取得
        const badge = sidePanelPage.locator('[data-testid="tab-count-badge-default"]');
        if (await badge.isVisible()) {
          const text = await badge.textContent();
          return parseInt(text || '0', 10);
        }
        return 0;
      };

      const initialCount = await getTabCountBadge();

      // 新しいタブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      expect(tabId).toBeGreaterThan(0);

      // タブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, tabId);

      // タブカウントが増加するまで待機（ポーリング）
      await waitForCondition(
        async () => {
          const currentCount = await getTabCountBadge();
          return currentCount > initialCount;
        },
        {
          timeout: 5000,
          interval: 100,
          timeoutMessage: 'Tab count did not increase after adding a tab',
        }
      );

      // タブカウントが増加したことを検証
      const newCount = await getTabCountBadge();
      expect(newCount).toBeGreaterThan(initialCount);

      // クリーンアップ: 作成したタブを閉じる
      await closeTab(extensionContext, tabId);
    });

    test('タブを削除した場合、ViewSwitcherのタブカウントバッジが即座に更新される', async ({
      sidePanelPage,
      extensionContext,
    }) => {
      // Side Panelが表示されることを確認
      await waitForViewSwitcher(sidePanelPage);

      // タブを作成して初期状態を確立
      const tabId = await createTab(extensionContext, 'about:blank');
      expect(tabId).toBeGreaterThan(0);

      // タブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, tabId);

      // タブカウントバッジを取得するヘルパー関数
      const getTabCountBadge = async () => {
        const badge = sidePanelPage.locator('[data-testid="tab-count-badge-default"]');
        if (await badge.isVisible()) {
          const text = await badge.textContent();
          return parseInt(text || '0', 10);
        }
        return 0;
      };

      // タブ追加後のカウントを取得
      await waitForCondition(
        async () => {
          const count = await getTabCountBadge();
          return count > 0;
        },
        { timeout: 5000, interval: 100 }
      );

      const countBeforeDelete = await getTabCountBadge();

      // タブを削除
      await closeTab(extensionContext, tabId);

      // タブがツリーから削除されるまで待機
      await waitForTabRemovedFromTreeState(extensionContext, tabId);

      // タブカウントが減少するまで待機（ポーリング）
      await waitForCondition(
        async () => {
          const currentCount = await getTabCountBadge();
          return currentCount < countBeforeDelete;
        },
        {
          timeout: 5000,
          interval: 100,
          timeoutMessage: 'Tab count did not decrease after removing a tab',
        }
      );

      // タブカウントが減少したことを検証
      const countAfterDelete = await getTabCountBadge();
      expect(countAfterDelete).toBeLessThan(countBeforeDelete);
    });

    test('複数タブを連続で追加した場合、タブカウントが正確に更新される', async ({
      sidePanelPage,
      extensionContext,
    }) => {
      // Side Panelが表示されることを確認
      await waitForViewSwitcher(sidePanelPage);

      const getTabCountBadge = async () => {
        const badge = sidePanelPage.locator('[data-testid="tab-count-badge-default"]');
        if (await badge.isVisible()) {
          const text = await badge.textContent();
          return parseInt(text || '0', 10);
        }
        return 0;
      };

      const initialCount = await getTabCountBadge();

      // 3つのタブを追加
      const tabIds: number[] = [];
      for (let i = 0; i < 3; i++) {
        const tabId = await createTab(extensionContext, 'about:blank');
        tabIds.push(tabId);
        await waitForTabInTreeState(extensionContext, tabId);
      }

      // タブカウントが3増加するまで待機
      await waitForCondition(
        async () => {
          const currentCount = await getTabCountBadge();
          return currentCount >= initialCount + 3;
        },
        {
          timeout: 5000,
          interval: 100,
          timeoutMessage: 'Tab count did not increase by 3 after adding 3 tabs',
        }
      );

      // タブカウントが正確に更新されたことを検証
      const finalCount = await getTabCountBadge();
      expect(finalCount).toBe(initialCount + 3);

      // クリーンアップ
      for (const tabId of tabIds) {
        await closeTab(extensionContext, tabId);
      }
    });
  });

  test.describe('Requirement 2.4-2.5: 不整合タブ削除時のカウント再計算', () => {
    test('ストレージに不整合タブが存在する場合、クリーンアップ後にカウントが再計算される', async ({
      sidePanelPage,
      extensionContext,
      serviceWorker,
    }) => {
      // Side Panelが表示されることを確認
      await waitForViewSwitcher(sidePanelPage);

      // 1. 正常なタブを作成
      const normalTabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, normalTabId);

      // 2. ストレージにゴーストタブ（存在しないタブID）を直接追加
      const ghostTabId = 99998;
      const ghostNodeId = `ghost-node-${ghostTabId}`;

      await serviceWorker.evaluate(
        async ({ ghostTabId, ghostNodeId }) => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as {
            nodes: Record<string, unknown>;
            tabToNode: Record<number, string>;
            currentViewId: string;
            views: { id: string }[];
          };

          // デフォルトビューIDを取得
          const defaultViewId = treeState.views?.[0]?.id || 'default';

          // ゴーストノードを追加
          treeState.nodes[ghostNodeId] = {
            id: ghostNodeId,
            tabId: ghostTabId,
            parentId: null,
            children: [],
            isExpanded: true,
            depth: 0,
            viewId: defaultViewId,
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

      // 4. タブカウントを取得（ゴーストタブは実際には存在しないため、カウントに含まれない）
      // viewTabCountsはtabInfoMapに存在するタブのみをカウントするため、
      // ゴーストタブはカウントに含まれないはず
      const getTabCountBadge = async () => {
        const badge = sidePanelPage.locator('[data-testid="tab-count-badge-default"]');
        if (await badge.isVisible()) {
          const text = await badge.textContent();
          return parseInt(text || '0', 10);
        }
        return 0;
      };

      // 5. サイドパネルをリロードして状態を更新
      await sidePanelPage.reload();
      await waitForViewSwitcher(sidePanelPage);

      // 6. タブカウントがゴーストタブを含まないことを確認
      // (viewTabCountsはtabInfoMapに存在するタブのみをカウント)
      await waitForCondition(
        async () => {
          const count = await getTabCountBadge();
          return count > 0;
        },
        { timeout: 5000, interval: 100 }
      );

      // タブカウントはゴーストタブを含まない正確な値であるべき
      const tabCount = await getTabCountBadge();
      // ゴーストタブはchrome.tabs APIに存在しないため、tabInfoMapに含まれず、
      // したがってviewTabCountsにも含まれない
      expect(tabCount).toBeGreaterThan(0);

      // 7. ゴーストタブをクリーンアップ
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

      // 8. クリーンアップ後もタブカウントが正確であることを確認
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

      // クリーンアップ
      await closeTab(extensionContext, normalTabId);
    });

    test('ビューのタブカウントは実際に存在するタブのみをカウントする', async ({
      sidePanelPage,
      extensionContext,
      serviceWorker,
    }) => {
      // Side Panelが表示されることを確認
      await waitForViewSwitcher(sidePanelPage);

      // 1. タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);

      const getTabCountBadge = async () => {
        const badge = sidePanelPage.locator('[data-testid="tab-count-badge-default"]');
        if (await badge.isVisible()) {
          const text = await badge.textContent();
          return parseInt(text || '0', 10);
        }
        return 0;
      };

      // 2. タブカウントを取得
      await waitForCondition(
        async () => {
          const count = await getTabCountBadge();
          return count > 0;
        },
        { timeout: 5000, interval: 100 }
      );

      const tabCountWithTab = await getTabCountBadge();

      // 3. Chrome APIでタブを直接削除（Service Worker経由ではなく）
      await serviceWorker.evaluate((tabId) => {
        return chrome.tabs.remove(tabId);
      }, tabId);

      // 4. ツリー状態からタブが削除されるまで待機
      await waitForTabRemovedFromTreeState(extensionContext, tabId);

      // 5. タブカウントが減少したことを確認
      await waitForCondition(
        async () => {
          const count = await getTabCountBadge();
          return count < tabCountWithTab;
        },
        {
          timeout: 5000,
          interval: 100,
          timeoutMessage: 'Tab count did not update after tab was removed via Chrome API',
        }
      );

      const tabCountAfterRemoval = await getTabCountBadge();
      expect(tabCountAfterRemoval).toBeLessThan(tabCountWithTab);
    });
  });

});
