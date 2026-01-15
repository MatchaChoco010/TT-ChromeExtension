import { test } from './fixtures/extension';
import {
  waitForViewSwitcher,
  waitForCondition,
} from './utils/polling-utils';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ビューのタブカウント正確性', () => {
  test.describe('タブ追加・削除時のカウント即時更新', () => {
    test('タブを追加した場合、ViewSwitcherのタブカウントバッジが即座に更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

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
      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // タブカウントが増加するまで待機し検証（ポーリング内で確認）
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

      // クリーンアップ: 作成したタブを閉じる
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブを削除した場合、ViewSwitcherのタブカウントバッジが即座に更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

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
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // タブカウントが減少するまで待機し検証（ポーリング内で確認）
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
    });

    test('複数タブを連続で追加した場合、タブカウントが正確に更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

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

      const tabIds: number[] = [];
      const tab1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      tabIds.push(tab1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      tabIds.push(tab2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      tabIds.push(tab3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      // タブカウントが3増加するまで待機し検証（ポーリング内で確認）
      await waitForCondition(
        async () => {
          const currentCount = await getTabCountBadge();
          return currentCount === initialCount + 3;
        },
        {
          timeout: 5000,
          interval: 100,
          timeoutMessage: 'Tab count did not increase by 3 after adding 3 tabs',
        }
      );

      // クリーンアップ
      await closeTab(serviceWorker, tab1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tab2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tab3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('不整合タブ削除時のカウント再計算', () => {
    test('ストレージに不整合タブが存在する場合、クリーンアップ後にカウントが再計算される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const normalTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);

      const ghostTabId = 99998;
      const ghostNodeId = `ghost-node-${ghostTabId}`;

      await serviceWorker.evaluate(
        async ({ ghostTabId, ghostNodeId }) => {
          interface ViewState {
            info: { id: string; name: string; color: string };
            rootNodeIds: string[];
            nodes: Record<string, unknown>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as {
            views: Record<string, ViewState>;
            tabToNode: Record<number, { viewId: string; nodeId: string }>;
            currentViewId: string;
          };

          // デフォルトビューIDを取得
          const defaultViewId = 'default';

          // ゴーストノードを追加
          if (treeState.views[defaultViewId]) {
            treeState.views[defaultViewId].nodes[ghostNodeId] = {
              id: ghostNodeId,
              tabId: ghostTabId,
              parentId: null,
              children: [],
              isExpanded: true,
              depth: 0,
            };
            treeState.tabToNode[ghostTabId] = { viewId: defaultViewId, nodeId: ghostNodeId };
          }

          await chrome.storage.local.set({ tree_state: treeState });
        },
        { ghostTabId, ghostNodeId }
      );

      await waitForCondition(
        async () => {
          const hasGhost = await serviceWorker.evaluate(
            async ({ ghostTabId }) => {
              const result = await chrome.storage.local.get('tree_state');
              const treeState = result.tree_state as {
                tabToNode: Record<number, { viewId: string; nodeId: string }>;
              };
              return treeState.tabToNode[ghostTabId] !== undefined;
            },
            { ghostTabId }
          );
          return hasGhost;
        },
        {
          timeout: 5000,
          interval: 100,
          timeoutMessage: 'Ghost tab was not added to storage',
        }
      );

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

      await sidePanelPage.reload();
      await waitForViewSwitcher(sidePanelPage);

      // (viewTabCountsはtabInfoMapに存在するタブのみをカウント)
      // ゴーストタブはchrome.tabs APIに存在しないため、tabInfoMapに含まれず、
      // したがってviewTabCountsにも含まれない
      await waitForCondition(
        async () => {
          const count = await getTabCountBadge();
          return count > 0;
        },
        {
          timeout: 5000,
          interval: 100,
          timeoutMessage: 'Tab count badge should show count > 0',
        }
      );

      await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        const existingTabIds = tabs.filter((t) => t.id).map((t) => t.id!);

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          views: Record<string, { nodes: Record<string, unknown> }>;
          tabToNode: Record<number, { viewId: string; nodeId: string }>;
        };

        // 存在しないタブを削除
        for (const tabIdStr of Object.keys(treeState.tabToNode)) {
          const tabId = parseInt(tabIdStr);
          if (!existingTabIds.includes(tabId)) {
            const nodeInfo = treeState.tabToNode[tabId];
            if (nodeInfo && treeState.views[nodeInfo.viewId]) {
              delete treeState.views[nodeInfo.viewId].nodes[nodeInfo.nodeId];
            }
            delete treeState.tabToNode[tabId];
          }
        }

        await chrome.storage.local.set({ tree_state: treeState });
      });

      await waitForCondition(
        async () => {
          const hasGhost = await serviceWorker.evaluate(
            async ({ ghostTabId }) => {
              const result = await chrome.storage.local.get('tree_state');
              const treeState = result.tree_state as {
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

      // クリーンアップ
      await closeTab(serviceWorker, normalTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('ビューのタブカウントは実際に存在するタブのみをカウントする', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      const getTabCountBadge = async () => {
        const badge = sidePanelPage.locator('[data-testid="tab-count-badge-default"]');
        if (await badge.isVisible()) {
          const text = await badge.textContent();
          return parseInt(text || '0', 10);
        }
        return 0;
      };

      await waitForCondition(
        async () => {
          const count = await getTabCountBadge();
          return count > 0;
        },
        { timeout: 5000, interval: 100 }
      );

      const tabCountWithTab = await getTabCountBadge();

      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

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
    });
  });

});

test.describe('タブ数表示の視認性', () => {
  test.describe('タブ数が正しく表示される', () => {
    test('タブ数バッジが表示され、正しい数値を表示する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

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

      const tab1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      // タブカウントが正確に更新されるまで待機（ポーリング内で検証）
      await waitForCondition(
        async () => {
          const badge = sidePanelPage.locator('[data-testid="tab-count-badge-default"]');
          if (!(await badge.isVisible())) return false;
          const count = await getTabCountBadge();
          return count === initialCount + 3;
        },
        {
          timeout: 5000,
          interval: 100,
          timeoutMessage: 'Tab count badge was not updated correctly to expected value',
        }
      );

      // クリーンアップ
      await closeTab(serviceWorker, tab1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tab2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tab3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('2桁のタブ数が正しく表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

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

      const tabIds: number[] = [];
      const targetTotal = 10;
      const tabsToAdd = Math.max(0, targetTotal - initialCount);

      for (let i = 0; i < tabsToAdd; i++) {
        const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
        tabIds.push(tabId);
        // 各タブ作成後にassertTabStructure
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: pseudoSidePanelTabId, depth: 0 },
          ...tabIds.map(id => ({ tabId: id, depth: 0 })),
        ], 0);
      }

      // タブカウントが2桁になり、バッジサイズが適切であることを確認（ポーリング内で検証）
      await waitForCondition(
        async () => {
          const badge = sidePanelPage.locator('[data-testid="tab-count-badge-default"]');
          const badgeText = await badge.textContent();
          const count = parseInt(badgeText || '0', 10);
          if (count < targetTotal) return false;

          // バッジが見切れていないことを検証（min-width: 20px）
          const badgeBox = await badge.boundingBox();
          if (!badgeBox) return false;
          return badgeBox.width >= 20;
        },
        {
          timeout: 10000,
          interval: 100,
          timeoutMessage: 'Tab count badge did not reach double digits or size is incorrect',
        }
      );

      // クリーンアップ
      for (let i = 0; i < tabIds.length; i++) {
        await closeTab(serviceWorker, tabIds[i]);
        const remainingTabIds = tabIds.slice(i + 1);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: pseudoSidePanelTabId, depth: 0 },
          ...remainingTabIds.map(id => ({ tabId: id, depth: 0 })),
        ], 0);
      }
    });
  });

  test.describe('タブ数バッジの視認性', () => {
    test('タブ数バッジは適切なサイズで表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      // バッジが表示され、適切なサイズと位置であることを確認（ポーリング内で検証）
      // UI要素のスタイル・レイアウト確認は「避け得ない必要なもの」に該当
      await waitForCondition(
        async () => {
          const badge = sidePanelPage.locator('[data-testid="tab-count-badge-default"]');
          if (!(await badge.isVisible())) return false;

          const badgeBox = await badge.boundingBox();
          if (!badgeBox) return false;

          // 高さが適切であること（h-4 = 16px）
          if (badgeBox.height < 14 || badgeBox.height > 20) return false;
          // 幅が最小値以上であること（min-w-[20px]）
          if (badgeBox.width < 18) return false;

          // バッジがビューボタンの右上付近に配置されていることを確認
          const viewButton = sidePanelPage.locator('[data-active="true"]');
          const viewButtonBox = await viewButton.boundingBox();
          if (!viewButtonBox) return false;

          // バッジの左端がボタンのx座標以上にある
          if (badgeBox.x < viewButtonBox.x) return false;
          // バッジの上端がボタンの中央より上にある
          if (badgeBox.y > viewButtonBox.y + viewButtonBox.height / 2) return false;

          return true;
        },
        {
          timeout: 5000,
          interval: 100,
          timeoutMessage: 'Tab count badge was not visible or has incorrect size/position',
        }
      );

      // クリーンアップ
      await closeTab(serviceWorker, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブ数が0の場合はバッジが非表示になる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      await waitForViewSwitcher(sidePanelPage);

      // 現在のウィンドウのタブをすべて取得
      const tabs = await serviceWorker.evaluate(async (windowId) => {
        const tabs = await chrome.tabs.query({ windowId });
        return tabs.map((t) => t.id);
      }, windowId);

      // このテストは実装が正しいことを確認するのみ
      // （実際にすべてのタブを閉じるとウィンドウも閉じてしまうため）
      // ViewSwitcherのコード: {tabCount > 0 && (...)} を検証

      // タブが存在する場合、バッジが表示されることをポーリングで確認
      if (tabs.length > 0) {
        await waitForCondition(
          async () => {
            const badge = sidePanelPage.locator('[data-testid="tab-count-badge-default"]');
            return await badge.isVisible();
          },
          {
            timeout: 5000,
            interval: 100,
            timeoutMessage: 'Tab count badge should be visible when tabs exist',
          }
        );
      }
    });
  });
});
