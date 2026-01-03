/**
 * ドラッグ&ドロップによる異なる深さ間の移動テスト
 *
 * このテストスイートでは、異なる深さのノード間へのドロップを検証します。
 * - 子タブを持つ親タブを、異なる深さのノード間のギャップにドロップ
 * - サブツリー構造が維持されること
 * - Chromeタブの順序と整合性が取れていること
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { reorderTabs, moveTabToParent, getParentTabId, getTabOrder } from './utils/drag-drop-utils';
import { waitForParentChildRelation, waitForTabDepthInUI } from './utils/polling-utils';

test.describe('ドラッグ&ドロップによる異なる深さ間の移動', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);

  test('異なる深さのノード間のギャップにサブツリーをドロップした場合、下のノードの親の子として配置されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: ユーザーが報告した問題のツリー構造を作成（ネットワーク依存を避けるためabout:blankを使用）
    // タブA (ルート)
    //   タブB (タブAの子)
    //     タブC (タブBの子)
    //     タブD (タブBの子)
    //   タブE (タブAの子)
    //   タブF (タブAの子) ← ドラッグするタブ
    //     タブG (タブFの子)
    const tabA = await createTab(extensionContext, 'about:blank');
    const tabB = await createTab(extensionContext, 'about:blank');
    const tabC = await createTab(extensionContext, 'about:blank');
    const tabD = await createTab(extensionContext, 'about:blank');
    const tabE = await createTab(extensionContext, 'about:blank');
    const tabF = await createTab(extensionContext, 'about:blank');
    const tabG = await createTab(extensionContext, 'about:blank');

    // すべてのタブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, tabA);
    await assertTabInTree(sidePanelPage, tabB);
    await assertTabInTree(sidePanelPage, tabC);
    await assertTabInTree(sidePanelPage, tabD);
    await assertTabInTree(sidePanelPage, tabE);
    await assertTabInTree(sidePanelPage, tabF);
    await assertTabInTree(sidePanelPage, tabG);

    // D&Dで親子関係を構築
    // タブB を タブA の子にする
    await moveTabToParent(sidePanelPage, tabB, tabA, serviceWorker);
    await waitForParentChildRelation(extensionContext, tabB, tabA, { timeout: 5000 });

    // タブC を タブB の子にする
    await moveTabToParent(sidePanelPage, tabC, tabB, serviceWorker);
    await waitForParentChildRelation(extensionContext, tabC, tabB, { timeout: 5000 });

    // タブD を タブB の子にする
    await moveTabToParent(sidePanelPage, tabD, tabB, serviceWorker);
    await waitForParentChildRelation(extensionContext, tabD, tabB, { timeout: 5000 });

    // タブE を タブA の子にする
    await moveTabToParent(sidePanelPage, tabE, tabA, serviceWorker);
    await waitForParentChildRelation(extensionContext, tabE, tabA, { timeout: 5000 });

    // タブF を タブA の子にする
    await moveTabToParent(sidePanelPage, tabF, tabA, serviceWorker);
    await waitForParentChildRelation(extensionContext, tabF, tabA, { timeout: 5000 });

    // タブG を タブF の子にする
    await moveTabToParent(sidePanelPage, tabG, tabF, serviceWorker);
    await waitForParentChildRelation(extensionContext, tabG, tabF, { timeout: 5000 });

    // すべてのタブを展開
    const expandAll = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.first().click();
          await expect(node).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
        }
      }
    };

    await expandAll(tabA);
    await expandAll(tabB);
    await expandAll(tabF);

    // 親子関係が正しく構築されていることを確認
    await expect(async () => {
      const bParent = await getParentTabId(sidePanelPage, tabB);
      const cParent = await getParentTabId(sidePanelPage, tabC);
      const dParent = await getParentTabId(sidePanelPage, tabD);
      const eParent = await getParentTabId(sidePanelPage, tabE);
      const fParent = await getParentTabId(sidePanelPage, tabF);
      const gParent = await getParentTabId(sidePanelPage, tabG);

      expect(bParent).toBe(tabA);
      expect(cParent).toBe(tabB);
      expect(dParent).toBe(tabB);
      expect(eParent).toBe(tabA);
      expect(fParent).toBe(tabA);
      expect(gParent).toBe(tabF);
    }).toPass({ timeout: 5000 });

    // 初期順序を確認: moveTabToParentは順序確定を待機するため、F が E の後になる
    const initialOrder = await getTabOrder(sidePanelPage);
    const initialFIndex = initialOrder.indexOf(tabF);
    const initialEIndex = initialOrder.indexOf(tabE);
    expect(initialFIndex).toBeGreaterThan(initialEIndex); // 初期状態では F が E の後

    // 実行: タブFをタブEの前（タブDとタブEの間のギャップ）にドロップ
    // 異なる深さ（タブD: depth=2、タブE: depth=1）のノード間のギャップへのドロップ
    await reorderTabs(sidePanelPage, tabF, tabE, 'before');

    // ストレージへの反映を待機
    await serviceWorker.evaluate(async (tabIds: number[]) => {
      for (let i = 0; i < 30; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          const allTabsExist = tabIds.every(id => treeState.tabToNode[id]);
          if (allTabsExist) {
            return;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, [tabA, tabB, tabC, tabD, tabE, tabF, tabG]);

    // 移動後、タブFを再展開（ドラッグ操作で折りたたまれる可能性があるため）
    await expandAll(tabF);

    // 検証1: タブFの親がタブA（タブEと同じ親）であることを確認
    await expect(async () => {
      const fParentAfter = await getParentTabId(sidePanelPage, tabF);
      expect(fParentAfter).toBe(tabA);
    }).toPass({ timeout: 5000 });

    // 検証2: タブGの親がタブFのまま（サブツリー構造が維持されていること）
    await expect(async () => {
      const gParentAfter = await getParentTabId(sidePanelPage, tabG);
      expect(gParentAfter).toBe(tabF);
    }).toPass({ timeout: 5000 });

    // 検証2.5: UIでの深さが正しいことを確認
    // タブA (depth 0), タブB (depth 1), タブC (depth 2), タブD (depth 2)
    // タブF (depth 1), タブG (depth 2), タブE (depth 1)
    await waitForTabDepthInUI(sidePanelPage, tabA, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, tabB, 1, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, tabC, 2, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, tabD, 2, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, tabF, 1, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, tabG, 2, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, tabE, 1, { timeout: 3000 });

    // 検証3: タブFがタブEの前に配置されていることを確認
    await expect(async () => {
      const newOrder = await getTabOrder(sidePanelPage);
      const newFIndex = newOrder.indexOf(tabF);
      const newEIndex = newOrder.indexOf(tabE);
      expect(newFIndex).toBeLessThan(newEIndex); // 移動後は F が E の前
    }).toPass({ timeout: 5000 });

    // 検証4: Chromeタブのインデックスがツリー順序と整合していることを確認
    // ツリーを深さ優先で走査したときの順序がChromeタブのインデックス順と一致すべき
    await expect(async () => {
      const orderedTabIds = await getTabOrder(sidePanelPage);

      // Chromeタブのインデックスを取得（sidePanelPage経由でChrome APIにアクセス）
      const tabs = await sidePanelPage.evaluate(async () => {
        const allTabs = await chrome.tabs.query({ currentWindow: true });
        return allTabs
          .filter(t => !t.pinned)
          .sort((a, b) => a.index - b.index)
          .map(t => t.id);
      });

      // タブAとその子孫のタブIDをフィルタリング
      const relevantTabIds = [tabA, tabB, tabC, tabD, tabE, tabF, tabG];
      const filteredTreeOrder = orderedTabIds.filter(id => relevantTabIds.includes(id));
      const filteredChromeOrder = (tabs as (number | undefined)[]).filter((id) => id !== undefined && relevantTabIds.includes(id));

      // 順序が一致することを確認
      expect(filteredTreeOrder).toEqual(filteredChromeOrder);
    }).toPass({ timeout: 5000 });
  });

  test('サブツリーを別の親の子ノード間のギャップにドロップした場合、その親の子として配置されサブツリー構造が維持されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: より単純なツリー構造を作成（ネットワーク依存を避けるためabout:blankを使用）
    // ルート1 (親なし)
    //   子1A (ルート1の子)
    //   子1B (ルート1の子)
    // ルート2 (親なし) ← ドラッグするタブ
    //   子2A (ルート2の子)
    const root1 = await createTab(extensionContext, 'about:blank');
    const child1A = await createTab(extensionContext, 'about:blank');
    const child1B = await createTab(extensionContext, 'about:blank');
    const root2 = await createTab(extensionContext, 'about:blank');
    const child2A = await createTab(extensionContext, 'about:blank');

    // すべてのタブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, root1);
    await assertTabInTree(sidePanelPage, child1A);
    await assertTabInTree(sidePanelPage, child1B);
    await assertTabInTree(sidePanelPage, root2);
    await assertTabInTree(sidePanelPage, child2A);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1A, root1, serviceWorker);
    await waitForParentChildRelation(extensionContext, child1A, root1, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, child1B, root1, serviceWorker);
    await waitForParentChildRelation(extensionContext, child1B, root1, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, child2A, root2, serviceWorker);
    await waitForParentChildRelation(extensionContext, child2A, root2, { timeout: 5000 });

    // すべてのタブを展開
    const expandAll = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.first().click();
          await expect(node).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
        }
      }
    };

    await expandAll(root1);
    await expandAll(root2);

    // 実行: ルート2（とその子）を子1Aと子1Bの間のギャップにドロップ
    await reorderTabs(sidePanelPage, root2, child1B, 'before');

    // ストレージへの反映を待機
    await serviceWorker.evaluate(async (tabIds: number[]) => {
      for (let i = 0; i < 30; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          const allTabsExist = tabIds.every(id => treeState.tabToNode[id]);
          if (allTabsExist) {
            return;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, [root1, child1A, child1B, root2, child2A]);

    // ルート2を再展開
    await expandAll(root2);

    // 検証1: ルート2の親がルート1になっていること
    // （child1Bの親がルート1なので、ルート2もルート1の子として配置される）
    await expect(async () => {
      const root2Parent = await getParentTabId(sidePanelPage, root2);
      expect(root2Parent).toBe(root1);
    }).toPass({ timeout: 5000 });

    // 検証2: 子2Aの親がルート2のまま（サブツリー構造が維持されていること）
    await expect(async () => {
      const child2AParent = await getParentTabId(sidePanelPage, child2A);
      expect(child2AParent).toBe(root2);
    }).toPass({ timeout: 5000 });

    // 検証2.5: UIでの深さが正しいことを確認
    // root1 (depth 0), child1A (depth 1), root2 (depth 1), child2A (depth 2), child1B (depth 1)
    await waitForTabDepthInUI(sidePanelPage, root1, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, child1A, 1, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, root2, 1, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, child2A, 2, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, child1B, 1, { timeout: 3000 });

    // 検証3: 順序が正しいことを確認（ルート2が子1Aと子1Bの間にある）
    await expect(async () => {
      const order = await getTabOrder(sidePanelPage);
      const child1AIndex = order.indexOf(child1A);
      const root2Index = order.indexOf(root2);
      const child1BIndex = order.indexOf(child1B);

      expect(root2Index).toBeGreaterThan(child1AIndex);
      expect(root2Index).toBeLessThan(child1BIndex);
    }).toPass({ timeout: 5000 });
  });
});
