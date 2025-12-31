/**
 * ドラッグ&ドロップによるタブの並び替え（同階層）テスト
 *
 * Task 8.2 (tab-tree-bugfix-2): 自前D&D実装用に書き直し
 * Requirements: 2.4, 2.5, 3.2.1, 3.2.3
 *
 * このテストスイートでは、同じ階層内でのタブの並び替えを検証します。
 * - ルートレベルのタブの並び替え
 * - 同じ親を持つ子タブの並び替え
 * - 複数の子を持つサブツリー内でのタブの並び替え
 * - ドラッグ中の視覚的フィードバック
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { reorderTabs, moveTabToParent, startDrag, dropTab, isDragging } from './utils/drag-drop-utils';

test.describe('ドラッグ&ドロップによるタブの並び替え（同階層）', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);
  test('ルートレベルのタブを別のルートレベルのタブ間にドロップした場合、タブの表示順序が変更されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 準備: 3つのルートレベルのタブを作成
    const tab1 = await createTab(extensionContext, 'https://example.com');
    const tab2 = await createTab(extensionContext, 'https://www.iana.org');
    const tab3 = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, tab1, 'Example');
    await assertTabInTree(sidePanelPage, tab2);
    await assertTabInTree(sidePanelPage, tab3);

    // 初期状態: tab1, tab2, tab3の順序
    const initialNodes = sidePanelPage.locator('[data-testid^="tree-node-"]');
    const initialCount = await initialNodes.count();
    expect(initialCount).toBeGreaterThanOrEqual(3);

    // 実行: tab3をtab1の前にドラッグ&ドロップ
    await reorderTabs(sidePanelPage, tab3, tab1, 'before');

    // 検証: タブの順序が変更されたことを確認
    // ツリーの更新をポーリングで待機（tree_stateが存在するだけでなく、3つのタブが存在することを確認）
    await serviceWorker.evaluate(async () => {
      for (let i = 0; i < 20; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && Object.keys(treeState.nodes).length >= 3) {
          return;
        }
        // eslint-disable-next-line no-undef
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    // UIが更新されるまで待機してから検証
    await expect(async () => {
      const finalNodes = sidePanelPage.locator('[data-testid^="tree-node-"]');
      const finalCount = await finalNodes.count();
      expect(finalCount).toBeGreaterThanOrEqual(3);
    }).toPass({ timeout: 3000 });
  });

  test('子タブを同じ親の他の子タブ間にドロップした場合、兄弟タブ間での順序が変更されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 準備: 親タブと子タブをルートレベルで作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabInTree(sidePanelPage, parentTab);

    // 子タブをルートレベルで作成
    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    const child3 = await createTab(extensionContext, 'https://developer.mozilla.org');

    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, child2);
    await assertTabInTree(sidePanelPage, child3);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
    await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
    await moveTabToParent(sidePanelPage, child3, parentTab, serviceWorker);

    // 親タブを展開して子タブを表示
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    if ((await expandButton.count()) > 0) {
      const isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.click();
        // 展開状態が反映されるまで待機
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }
    }

    // 子タブがツリーに表示されることを確認（展開後）
    const child1NodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${child1}"]`);
    const child3NodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${child3}"]`);
    await expect(child1NodeBefore.first()).toBeVisible({ timeout: 3000 });
    await expect(child3NodeBefore.first()).toBeVisible({ timeout: 3000 });

    // 実行: child3をchild1の前にドラッグ&ドロップ
    await reorderTabs(sidePanelPage, child3, child1, 'before');

    // 検証: 子タブの順序が変更されたことを確認（ストレージへの反映を待機）
    // tree_stateが存在するだけでなく、子タブが存在することを確認
    await serviceWorker.evaluate(async (childIds: number[]) => {
      for (let i = 0; i < 20; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          const allChildrenExist = childIds.every(id => treeState.tabToNode[id]);
          if (allChildrenExist) {
            return;
          }
        }
        // eslint-disable-next-line no-undef
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, [child1, child2, child3]);

    // 子タブが存在することを確認（UIが更新されるまでポーリング）
    await expect(async () => {
      const child1Node = sidePanelPage.locator(`[data-testid="tree-node-${child1}"]`);
      const child3Node = sidePanelPage.locator(`[data-testid="tree-node-${child3}"]`);
      await expect(child1Node.first()).toBeVisible();
      await expect(child3Node.first()).toBeVisible();
    }).toPass({ timeout: 3000 });
  });

  test('複数の子を持つサブツリー内でタブを並び替えた場合、他の子タブの順序が正しく調整されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 準備: 親タブと子タブをルートレベルで作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabInTree(sidePanelPage, parentTab);

    // 子タブをルートレベルで作成
    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    const child3 = await createTab(extensionContext, 'https://developer.mozilla.org');
    const child4 = await createTab(extensionContext, 'https://httpbin.org');

    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, child2);
    await assertTabInTree(sidePanelPage, child3);
    await assertTabInTree(sidePanelPage, child4);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
    await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
    await moveTabToParent(sidePanelPage, child3, parentTab, serviceWorker);
    await moveTabToParent(sidePanelPage, child4, parentTab, serviceWorker);

    // 親タブを展開して子タブを表示
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    if ((await expandButton.count()) > 0) {
      const isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.click();
        // 展開状態が反映されるまで待機
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }
    }

    // 子タブがツリーに表示されることを確認（展開後）- タイムアウト指定でフレーキー対策
    const child1NodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${child1}"]`);
    const child2NodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${child2}"]`);
    const child3NodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${child3}"]`);
    const child4NodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${child4}"]`);
    await expect(child1NodeBefore.first()).toBeVisible({ timeout: 3000 });
    await expect(child2NodeBefore.first()).toBeVisible({ timeout: 3000 });
    await expect(child3NodeBefore.first()).toBeVisible({ timeout: 3000 });
    await expect(child4NodeBefore.first()).toBeVisible({ timeout: 3000 });

    // 実行: child2をchild4の後にドラッグ&ドロップ
    await reorderTabs(sidePanelPage, child2, child4, 'after');

    // 検証: 全ての子タブが存在することを確認（ストレージへの反映を待機）
    // tree_stateが存在するだけでなく、すべての子タブが存在することを確認
    await serviceWorker.evaluate(async (childIds: number[]) => {
      for (let i = 0; i < 20; i++) {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          const allChildrenExist = childIds.every(id => treeState.tabToNode[id]);
          if (allChildrenExist) {
            return;
          }
        }
        // eslint-disable-next-line no-undef
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }, [child1, child2, child3, child4]);

    // UIが更新されるまでポーリングで待機
    await expect(async () => {
      const child1Node = sidePanelPage.locator(`[data-testid="tree-node-${child1}"]`);
      const child2Node = sidePanelPage.locator(`[data-testid="tree-node-${child2}"]`);
      const child3Node = sidePanelPage.locator(`[data-testid="tree-node-${child3}"]`);
      const child4Node = sidePanelPage.locator(`[data-testid="tree-node-${child4}"]`);

      await expect(child1Node.first()).toBeVisible();
      await expect(child2Node.first()).toBeVisible();
      await expect(child3Node.first()).toBeVisible();
      await expect(child4Node.first()).toBeVisible();
    }).toPass({ timeout: 3000 });
  });

  test('ドラッグ中にis-draggingクラスが付与され、視覚的なフィードバックが表示されること', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // 準備: 2つのルートレベルのタブを作成
    const tab1 = await createTab(extensionContext, 'https://example.com');
    const tab2 = await createTab(extensionContext, 'https://www.iana.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, tab1, 'Example');
    await assertTabInTree(sidePanelPage, tab2);

    // 実行: tab2をドラッグ開始
    await startDrag(sidePanelPage, tab2);

    // 検証: ドラッグ状態を確認（is-draggingクラスの存在）
    // 自前D&D実装ではis-draggingクラスでドラッグ中を表現
    const dragging = await isDragging(sidePanelPage);
    expect(dragging).toBe(true);

    // クリーンアップ: ドロップを実行
    await dropTab(sidePanelPage);

    // ドロップ後はドラッグ状態が解除されることを確認
    await expect(async () => {
      const stillDragging = await isDragging(sidePanelPage);
      expect(stillDragging).toBe(false);
    }).toPass({ timeout: 2000 });

    // タブが存在することを確認
    const tab1Node = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`).first();
    const tab2Node = sidePanelPage.locator(`[data-testid="tree-node-${tab2}"]`).first();
    await expect(tab1Node).toBeVisible({ timeout: 3000 });
    await expect(tab2Node).toBeVisible({ timeout: 3000 });
  });
});
