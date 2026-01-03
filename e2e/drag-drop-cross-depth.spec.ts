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
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { reorderTabs, moveTabToParent } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';

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

    // windowIdとpseudoSidePanelTabIdを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // 準備: ユーザーが報告した問題のツリー構造を作成（ネットワーク依存を避けるためabout:blankを使用）
    // タブA (ルート)
    //   タブB (タブAの子)
    //     タブC (タブBの子)
    //     タブD (タブBの子)
    //   タブE (タブAの子)
    //   タブF (タブAの子) ← ドラッグするタブ
    //     タブG (タブFの子)
    const tabA = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
    ], 0);

    const tabB = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
    ], 0);

    const tabC = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
    ], 0);

    const tabD = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
    ], 0);

    const tabE = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
    ], 0);

    const tabF = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
      { tabId: tabF, depth: 0 },
    ], 0);

    const tabG = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
      { tabId: tabF, depth: 0 },
      { tabId: tabG, depth: 0 },
    ], 0);

    // D&Dで親子関係を構築
    // タブB を タブA の子にする
    await moveTabToParent(sidePanelPage, tabB, tabA, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 1 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
      { tabId: tabF, depth: 0 },
      { tabId: tabG, depth: 0 },
    ], 0);

    // タブC を タブB の子にする
    await moveTabToParent(sidePanelPage, tabC, tabB, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 1 },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
      { tabId: tabF, depth: 0 },
      { tabId: tabG, depth: 0 },
    ], 0);

    // タブD を タブB の子にする
    await moveTabToParent(sidePanelPage, tabD, tabB, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 1 },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 2 },
      { tabId: tabE, depth: 0 },
      { tabId: tabF, depth: 0 },
      { tabId: tabG, depth: 0 },
    ], 0);

    // タブE を タブA の子にする
    await moveTabToParent(sidePanelPage, tabE, tabA, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 1 },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 2 },
      { tabId: tabE, depth: 1 },
      { tabId: tabF, depth: 0 },
      { tabId: tabG, depth: 0 },
    ], 0);

    // タブF を タブA の子にする
    await moveTabToParent(sidePanelPage, tabF, tabA, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 1 },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 2 },
      { tabId: tabE, depth: 1 },
      { tabId: tabF, depth: 1 },
      { tabId: tabG, depth: 0 },
    ], 0);

    // タブG を タブF の子にする
    await moveTabToParent(sidePanelPage, tabG, tabF, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 1 },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 2 },
      { tabId: tabE, depth: 1 },
      { tabId: tabF, depth: 1 },
      { tabId: tabG, depth: 2 },
    ], 0);

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

    // 実行: タブFをタブEの前（タブDとタブEの間のギャップ）にドロップ
    // 異なる深さ（タブD: depth=2、タブE: depth=1）のノード間のギャップへのドロップ
    await reorderTabs(sidePanelPage, tabF, tabE, 'before');

    // 移動後、タブFを再展開（ドラッグ操作で折りたたまれる可能性があるため）
    await expandAll(tabF);

    // 検証: UIでの順序と深さが正しいことを確認
    // タブA (depth 0), タブB (depth 1), タブC (depth 2), タブD (depth 2)
    // タブF (depth 1), タブG (depth 2), タブE (depth 1)
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 1 },
      { tabId: tabC, depth: 2 },
      { tabId: tabD, depth: 2 },
      { tabId: tabF, depth: 1 },
      { tabId: tabG, depth: 2 },
      { tabId: tabE, depth: 1 },
    ], 0);
  });

  test('サブツリーを別の親の子ノード間のギャップにドロップした場合、その親の子として配置されサブツリー構造が維持されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // windowIdとpseudoSidePanelTabIdを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // 準備: より単純なツリー構造を作成（ネットワーク依存を避けるためabout:blankを使用）
    // ルート1 (親なし)
    //   子1A (ルート1の子)
    //   子1B (ルート1の子)
    // ルート2 (親なし) ← ドラッグするタブ
    //   子2A (ルート2の子)
    const root1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
    ], 0);

    const child1A = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 0 },
    ], 0);

    const child1B = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 0 },
      { tabId: child1B, depth: 0 },
    ], 0);

    const root2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 0 },
      { tabId: child1B, depth: 0 },
      { tabId: root2, depth: 0 },
    ], 0);

    const child2A = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 0 },
      { tabId: child1B, depth: 0 },
      { tabId: root2, depth: 0 },
      { tabId: child2A, depth: 0 },
    ], 0);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1A, root1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 1 },
      { tabId: child1B, depth: 0 },
      { tabId: root2, depth: 0 },
      { tabId: child2A, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1B, root1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 1 },
      { tabId: child1B, depth: 1 },
      { tabId: root2, depth: 0 },
      { tabId: child2A, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2A, root2, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 1 },
      { tabId: child1B, depth: 1 },
      { tabId: root2, depth: 0 },
      { tabId: child2A, depth: 1 },
    ], 0);

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

    // ルート2を再展開
    await expandAll(root2);

    // 検証: UIでの順序と深さが正しいことを確認
    // root1 (depth 0), child1A (depth 1), root2 (depth 1), child2A (depth 2), child1B (depth 1)
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: root1, depth: 0 },
      { tabId: child1A, depth: 1 },
      { tabId: root2, depth: 1 },
      { tabId: child2A, depth: 2 },
      { tabId: child1B, depth: 1 },
    ], 0);
  });
});
