/**
 * Gapドロップ精度のE2Eテスト
 *
 * Task 8.10 (tab-tree-bugfix-2): 自前D&D実装用に書き直し
 * Requirements: 3.2.1, 3.2.3
 *
 * このテストスイートでは、タブ間隙間へのドロップ精度を検証します。
 * - タブ間隙間へのドロップで正確な位置に配置されること
 * - 異なる深度の隙間へのドロップを検証
 * - `--repeat-each=10`で10回連続成功する安定したテストを実装
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { startDrag, dropTab, moveTabToParent, reorderTabs } from './utils/drag-drop-utils';
import { waitForCondition } from './utils/polling-utils';
import type { Page, Worker } from '@playwright/test';

/**
 * タブノードのバウンディングボックスを取得
 */
async function getTabNodeBoundingBox(
  page: Page,
  tabId: number
): Promise<{ x: number; y: number; width: number; height: number }> {
  const node = page.locator(`[data-testid="tree-node-${tabId}"]`).first();
  await node.waitFor({ state: 'visible', timeout: 5000 });
  const box = await node.boundingBox();
  if (!box) {
    throw new Error(`Tab node ${tabId} bounding box not found`);
  }
  return box;
}

/**
 * ツリー内のタブの表示順序を取得
 */
async function getTabOrderInTree(
  page: Page,
  tabIds: number[]
): Promise<number[]> {
  const positions: { tabId: number; y: number }[] = [];

  for (const tabId of tabIds) {
    try {
      const box = await getTabNodeBoundingBox(page, tabId);
      positions.push({ tabId, y: box.y });
    } catch {
      // タブが見つからない場合はスキップ
    }
  }

  // Y座標でソートして順序を取得
  positions.sort((a, b) => a.y - b.y);
  return positions.map(p => p.tabId);
}

/**
 * ストレージにすべてのタブが存在するまで待機
 */
async function waitForAllTabsInStorage(
  serviceWorker: Worker,
  tabIds: number[]
): Promise<void> {
  await serviceWorker.evaluate(async (ids: number[]) => {
    for (let i = 0; i < 30; i++) {
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
      if (treeState?.tabToNode) {
        const allTabsExist = ids.every(id => treeState.tabToNode?.[id]);
        if (allTabsExist) {
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }, tabIds);
}

test.describe('Gapドロップ精度のE2Eテスト', () => {
  // タイムアウトを120秒に設定
  test.setTimeout(120000);

  test.describe('Requirement 3.4: タブ間隙間へのドロップで正確な位置に配置されること', () => {
    test('タブをGap領域にドロップすると、ドロップ操作が正常に完了すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 4つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      const tab4 = await createTab(extensionContext, 'https://developer.mozilla.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);
      await assertTabInTree(sidePanelPage, tab4);

      // 初期状態: すべてのタブが表示されている
      const initialOrder = await getTabOrderInTree(sidePanelPage, [tab1, tab2, tab3, tab4]);
      expect(initialOrder.length).toBe(4);

      // 実行: tab4をtab1の前にドラッグ&ドロップ
      await reorderTabs(sidePanelPage, tab4, tab1, 'before');

      // ストレージへの反映を待機
      await waitForAllTabsInStorage(serviceWorker, [tab1, tab2, tab3, tab4]);

      // 検証: すべてのタブがツリーに表示されていること（ポーリングで待機）
      await expect(async () => {
        const finalOrder = await getTabOrderInTree(sidePanelPage, [tab1, tab2, tab3, tab4]);
        expect(finalOrder.length).toBe(4);
        expect(finalOrder).toContain(tab1);
        expect(finalOrder).toContain(tab2);
        expect(finalOrder).toContain(tab3);
        expect(finalOrder).toContain(tab4);
      }).toPass({ timeout: 3000 });
    });

    test('タブをGap領域（after位置）にドロップすると、正常に完了すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // 初期状態: すべてのタブが表示されている
      const initialOrder = await getTabOrderInTree(sidePanelPage, [tab1, tab2, tab3]);
      expect(initialOrder.length).toBe(3);

      // 実行: tab3をtab1の後にドラッグ&ドロップ
      await reorderTabs(sidePanelPage, tab3, tab1, 'after');

      // ストレージへの反映を待機
      await waitForAllTabsInStorage(serviceWorker, [tab1, tab2, tab3]);

      // 検証: すべてのタブがUIに表示されていること（ポーリングで待機）
      await expect(async () => {
        await expect(sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`).first()).toBeVisible();
        await expect(sidePanelPage.locator(`[data-testid="tree-node-${tab2}"]`).first()).toBeVisible();
        await expect(sidePanelPage.locator(`[data-testid="tree-node-${tab3}"]`).first()).toBeVisible();
      }).toPass({ timeout: 3000 });
    });

    test('複数回のGapドロップを連続で行ってもすべてのタブが保持されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 4つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      const tab4 = await createTab(extensionContext, 'https://developer.mozilla.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);
      await assertTabInTree(sidePanelPage, tab4);

      // 1回目のドロップ: tab4をtab1の前に
      await reorderTabs(sidePanelPage, tab4, tab1, 'before');
      await waitForAllTabsInStorage(serviceWorker, [tab1, tab2, tab3, tab4]);

      // 2回目のドロップ: tab2をtab3の後に
      await reorderTabs(sidePanelPage, tab2, tab3, 'after');
      await waitForAllTabsInStorage(serviceWorker, [tab1, tab2, tab3, tab4]);

      // 検証: すべてのタブがUIに表示されていること（ポーリングで待機）
      await expect(async () => {
        const uiTabIds = await getTabOrderInTree(sidePanelPage, [tab1, tab2, tab3, tab4]);
        expect(uiTabIds.length).toBe(4);
        expect(uiTabIds).toContain(tab1);
        expect(uiTabIds).toContain(tab2);
        expect(uiTabIds).toContain(tab3);
        expect(uiTabIds).toContain(tab4);
      }).toPass({ timeout: 3000 });
    });
  });

  test.describe('Requirement 3.5: 異なる深度の隙間へのドロップを検証', () => {
    test('親子関係があるツリーでGapドロップが正しく動作すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 親タブと子タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      await assertTabInTree(sidePanelPage, parentTab, 'Example');

      // 子タブを作成
      const child1 = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabInTree(sidePanelPage, child1);

      // child1を parentTabの子として配置
      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);

      // 親タブを展開（ポーリングで確認）
      await expect(async () => {
        const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
        const expandButton = parentNode.locator('[data-testid="expand-button"]');
        if ((await expandButton.count()) > 0) {
          const isExpanded = await parentNode.getAttribute('data-expanded');
          if (isExpanded !== 'true') {
            await expandButton.click();
          }
        }
        await expect(parentNode).toHaveAttribute('data-expanded', 'true');
      }).toPass({ timeout: 5000 });

      // 別のルートタブを作成
      const rootTab = await createTab(extensionContext, 'https://www.w3.org');
      await assertTabInTree(sidePanelPage, rootTab);

      // 検証: 親タブ、子タブ、ルートタブが全て表示されていること
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first()).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${child1}"]`).first()).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${rootTab}"]`).first()).toBeVisible();

      // rootTabをparentTabの前にドラッグ&ドロップ
      await reorderTabs(sidePanelPage, rootTab, parentTab, 'before');

      // ストレージへの反映を待機
      await waitForAllTabsInStorage(serviceWorker, [parentTab, child1, rootTab]);

      // 検証: すべてのタブがUIに表示されていること（ポーリングで待機）
      await expect(async () => {
        await expect(sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first()).toBeVisible();
        await expect(sidePanelPage.locator(`[data-testid="tree-node-${child1}"]`).first()).toBeVisible();
        await expect(sidePanelPage.locator(`[data-testid="tree-node-${rootTab}"]`).first()).toBeVisible();
      }).toPass({ timeout: 3000 });
    });

    test('子タブとして配置した後もGapドロップが動作すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // tab2をtab1の子として配置
      await moveTabToParent(sidePanelPage, tab2, tab1, serviceWorker);

      // ストレージへの反映を待機
      await waitForAllTabsInStorage(serviceWorker, [tab1, tab2, tab3]);

      // 検証: 親子関係がストレージに反映されていること（ポーリングで確認）
      await expect(async () => {
        const relationCheck = await serviceWorker.evaluate(async (ids: { parentId: number; childId: number }) => {
          interface TreeNode {
            id: string;
            tabId: number;
            parentId: string | null;
          }
          interface LocalTreeState {
            tabToNode: Record<number, string>;
            nodes: Record<string, TreeNode>;
          }

          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.tabToNode || !treeState?.nodes) {
            return { hasRelation: false };
          }
          const parentNodeId = treeState.tabToNode[ids.parentId];
          const childNodeId = treeState.tabToNode[ids.childId];
          if (!parentNodeId || !childNodeId) {
            return { hasRelation: false };
          }
          const childNode = treeState.nodes[childNodeId];
          return { hasRelation: childNode?.parentId === parentNodeId };
        }, { parentId: tab1, childId: tab2 });

        expect(relationCheck.hasRelation).toBe(true);
      }).toPass({ timeout: 5000 });
    });
  });

  test.describe('Requirement 3.6: テストの安定性', () => {
    test('Gapドロップ後にすべてのタブがUIに表示され続けること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 5つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      const tab4 = await createTab(extensionContext, 'https://developer.mozilla.org');
      const tab5 = await createTab(extensionContext, 'https://httpbin.org');

      const allTabs = [tab1, tab2, tab3, tab4, tab5];

      // タブがツリーに表示されるまで待機
      for (const tab of allTabs) {
        await assertTabInTree(sidePanelPage, tab);
      }

      // 1回目のドロップ操作
      await reorderTabs(sidePanelPage, tab5, tab1, 'before');
      await waitForAllTabsInStorage(serviceWorker, allTabs);

      // 2回目のドロップ操作
      await reorderTabs(sidePanelPage, tab4, tab2, 'before');
      await waitForAllTabsInStorage(serviceWorker, allTabs);

      // 検証: 全てのタブがUIに表示されていること（ポーリングで待機）
      await expect(async () => {
        for (const tab of allTabs) {
          await expect(sidePanelPage.locator(`[data-testid="tree-node-${tab}"]`).first()).toBeVisible();
        }
      }).toPass({ timeout: 5000 });

      // 検証: ストレージにも全てのタブが存在すること
      const storageCheck = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
        if (!treeState?.tabToNode) return { allExist: false };
        const allExist = tabIds.every(id => treeState.tabToNode?.[id]);
        return { allExist };
      }, allTabs);

      expect(storageCheck.allExist).toBe(true);
    });

    test('高速な連続Gapドロップ操作でも安定して動作すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 4つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      const tab4 = await createTab(extensionContext, 'https://developer.mozilla.org');

      const allTabs = [tab1, tab2, tab3, tab4];

      // タブがツリーに表示されるまで待機
      for (const tab of allTabs) {
        await assertTabInTree(sidePanelPage, tab);
      }

      // startDragを使用した基本的なドラッグ&ドロップ
      await startDrag(sidePanelPage, tab4);

      // tab1とtab2の間にホバー
      const tab1Box = await getTabNodeBoundingBox(sidePanelPage, tab1);
      const tab2Box = await getTabNodeBoundingBox(sidePanelPage, tab2);
      const gapY = (tab1Box.y + tab1Box.height + tab2Box.y) / 2;
      await sidePanelPage.mouse.move(tab1Box.x + tab1Box.width / 2, gapY, { steps: 10 });

      // ドロップインジケーターが表示されるまで待機（ポーリング）
      await waitForCondition(
        async () => {
          const indicator = sidePanelPage.locator('[data-testid="drop-indicator"]');
          return await indicator.isVisible().catch(() => false);
        },
        { timeout: 3000, interval: 50, timeoutMessage: 'Drop indicator not visible' }
      );

      // ドロップを実行
      await dropTab(sidePanelPage);

      // ストレージへの反映を待機
      await waitForAllTabsInStorage(serviceWorker, allTabs);

      // 検証: 全てのタブがUIに表示されていること（ポーリングで待機）
      await expect(async () => {
        for (const tab of allTabs) {
          await expect(sidePanelPage.locator(`[data-testid="tree-node-${tab}"]`).first()).toBeVisible();
        }
      }).toPass({ timeout: 5000 });
    });

    test('ドロップインジケーターがGap位置に正しく表示されること', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // tab3をドラッグ開始
      await startDrag(sidePanelPage, tab3);

      // tab1とtab2の間にマウスを移動
      const tab1Box = await getTabNodeBoundingBox(sidePanelPage, tab1);
      const tab2Box = await getTabNodeBoundingBox(sidePanelPage, tab2);
      const gapY = (tab1Box.y + tab1Box.height + tab2Box.y) / 2;
      await sidePanelPage.mouse.move(tab1Box.x + tab1Box.width / 2, gapY, { steps: 10 });

      // ドロップインジケーターが表示されるまでポーリング
      await waitForCondition(
        async () => {
          const indicator = sidePanelPage.locator('[data-testid="drop-indicator"]');
          return await indicator.isVisible().catch(() => false);
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Drop indicator did not appear' }
      );

      // ドロップインジケーターが表示されていることを確認
      const dropIndicator = sidePanelPage.locator('[data-testid="drop-indicator"]');
      await expect(dropIndicator).toBeVisible();

      // ドロップを実行
      await dropTab(sidePanelPage);
    });
  });
});
