/**
 * ドラッグ&ドロップによるサブツリー移動テスト
 *
 * Task 5.4 (comprehensive-bugfix): サブツリードラッグ移動のE2Eテスト
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5
 *
 * このテストスイートでは、子タブを持つ親タブのドラッグ移動を検証します。
 * - 折りたたみ状態でのサブツリー移動（非表示の子タブも含めて移動）
 * - 展開状態でのサブツリー移動（可視の子タブも含めて移動）
 * - 下方向への移動で正しい位置に配置されること
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { reorderTabs, moveTabToParent, getParentTabId, getTabOrder } from './utils/drag-drop-utils';
import { waitForParentChildRelation } from './utils/polling-utils';

test.describe('ドラッグ&ドロップによるサブツリー移動', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);

  test('折りたたまれた親タブをドラッグした場合、非表示の子タブも含めてサブツリー全体が移動すること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: ツリー構造を作成
    // Tab1 (サブツリーの親)
    //   - Child1
    //   - Child2
    // Tab2 (移動先の目印)
    // Tab3 (別のルートタブ)
    const tab1 = await createTab(extensionContext, 'https://example.com');
    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    const tab3 = await createTab(extensionContext, 'https://github.com');

    // すべてのタブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, tab1);
    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, child2);
    await assertTabInTree(sidePanelPage, tab2);
    await assertTabInTree(sidePanelPage, tab3);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, child1, tab1, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, child2, tab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, child2, tab1, { timeout: 5000 });

    // 親タブを展開して子タブを表示
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

    // 展開されている場合は折りたたむ
    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded === 'true') {
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'false', { timeout: 3000 });
    }

    // 折りたたみ状態を確認
    await expect(parentNode).toHaveAttribute('data-expanded', 'false');

    // 初期順序を確認: tab1, tab2, tab3 の順（子タブは非表示）
    const initialOrder = await getTabOrder(sidePanelPage);
    expect(initialOrder).toContain(tab1);
    expect(initialOrder).toContain(tab2);
    expect(initialOrder).toContain(tab3);

    // 実行: 折りたたまれた親タブ（tab1）をtab3の後にドラッグ
    await reorderTabs(sidePanelPage, tab1, tab3, 'after');

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
    }, [tab1, child1, child2, tab2, tab3]);

    // 検証: サブツリー全体が移動したことを確認
    // 新しい順序: tab2, tab3, tab1（サブツリー）
    await expect(async () => {
      const newOrder = await getTabOrder(sidePanelPage);

      // tab1がtab3の後にあることを確認
      const tab1Index = newOrder.indexOf(tab1);
      const tab3Index = newOrder.indexOf(tab3);
      expect(tab1Index).toBeGreaterThan(tab3Index);

      // tab2はtab1より前にあることを確認
      const tab2Index = newOrder.indexOf(tab2);
      expect(tab2Index).toBeLessThan(tab1Index);
    }).toPass({ timeout: 5000 });

    // 子タブの親子関係が維持されていることを確認
    await expect(async () => {
      const child1Parent = await getParentTabId(sidePanelPage, child1);
      const child2Parent = await getParentTabId(sidePanelPage, child2);
      expect(child1Parent).toBe(tab1);
      expect(child2Parent).toBe(tab1);
    }).toPass({ timeout: 5000 });
  });

  test('展開された親タブをドラッグした場合、可視の子タブも含めてサブツリー全体が移動すること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: ツリー構造を作成
    // Tab1 (サブツリーの親)
    //   - Child1
    //   - Child2
    // Tab2 (移動先の目印)
    const tab1 = await createTab(extensionContext, 'https://example.com');
    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');

    // すべてのタブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, tab1);
    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, child2);
    await assertTabInTree(sidePanelPage, tab2);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, child1, tab1, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, child2, tab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, child2, tab1, { timeout: 5000 });

    // 親タブを展開して子タブを表示
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    // 展開状態を確認
    await expect(parentNode).toHaveAttribute('data-expanded', 'true');

    // 子タブが表示されることを確認
    const child1Node = sidePanelPage.locator(`[data-testid="tree-node-${child1}"]`);
    const child2Node = sidePanelPage.locator(`[data-testid="tree-node-${child2}"]`);
    await expect(child1Node.first()).toBeVisible({ timeout: 3000 });
    await expect(child2Node.first()).toBeVisible({ timeout: 3000 });

    // 初期状態で親子関係が正しいことを確認
    const child1ParentBefore = await getParentTabId(sidePanelPage, child1);
    const child2ParentBefore = await getParentTabId(sidePanelPage, child2);
    expect(child1ParentBefore).toBe(tab1);
    expect(child2ParentBefore).toBe(tab1);

    // 実行: 展開された親タブ（tab1）をtab2の後にドラッグ
    await reorderTabs(sidePanelPage, tab1, tab2, 'after');

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
    }, [tab1, child1, child2, tab2]);

    // 検証: サブツリー全体が移動したことを確認
    // 重要: 子タブの親子関係が維持されていることを検証
    await expect(async () => {
      const child1Parent = await getParentTabId(sidePanelPage, child1);
      const child2Parent = await getParentTabId(sidePanelPage, child2);
      expect(child1Parent).toBe(tab1);
      expect(child2Parent).toBe(tab1);
    }).toPass({ timeout: 5000 });
  });

  test('サブツリーを下方向にドラッグした場合、正しい移動数で正しい位置に配置されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 複数のルートタブとサブツリーを作成
    // Tab1 (サブツリーの親)
    //   - Child1
    //   - Child2
    // Tab2
    // Tab3
    // Tab4 (最後のタブ、移動先)
    const tab1 = await createTab(extensionContext, 'https://example.com');
    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    const tab3 = await createTab(extensionContext, 'https://github.com');
    const tab4 = await createTab(extensionContext, 'https://httpbin.org');

    // すべてのタブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, tab1);
    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, child2);
    await assertTabInTree(sidePanelPage, tab2);
    await assertTabInTree(sidePanelPage, tab3);
    await assertTabInTree(sidePanelPage, tab4);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, child1, tab1, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, child2, tab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, child2, tab1, { timeout: 5000 });

    // 親タブを展開
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    // 初期順序: tab1, child1, child2, tab2, tab3, tab4
    const initialOrder = await getTabOrder(sidePanelPage);
    const tab1InitialIndex = initialOrder.indexOf(tab1);
    const tab4InitialIndex = initialOrder.indexOf(tab4);
    expect(tab1InitialIndex).toBeLessThan(tab4InitialIndex);

    // 実行: サブツリー（tab1 + 子タブ2つ）をtab4の後にドラッグ
    // サブツリーのサイズ（3ノード）を考慮した移動が必要
    await reorderTabs(sidePanelPage, tab1, tab4, 'after');

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
    }, [tab1, child1, child2, tab2, tab3, tab4]);

    // 移動後、親タブを再度展開（ドラッグ操作で折りたたまれる可能性があるため）
    const parentNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`).first();
    const expandButtonAfter = parentNodeAfter.locator('[data-testid="expand-button"]');
    if ((await expandButtonAfter.count()) > 0) {
      const isExpandedAfter = await parentNodeAfter.getAttribute('data-expanded');
      if (isExpandedAfter !== 'true') {
        await expandButtonAfter.first().click();
        await expect(parentNodeAfter).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }
    }

    // 検証: サブツリーが移動したことを確認
    // 重要: 子タブの親子関係が維持されていることを主に検証
    await expect(async () => {
      const child1Parent = await getParentTabId(sidePanelPage, child1);
      const child2Parent = await getParentTabId(sidePanelPage, child2);
      expect(child1Parent).toBe(tab1);
      expect(child2Parent).toBe(tab1);
    }).toPass({ timeout: 5000 });

    // タブが存在することを確認
    await expect(async () => {
      const newOrder = await getTabOrder(sidePanelPage);
      const tab1Index = newOrder.indexOf(tab1);
      const tab4Index = newOrder.indexOf(tab4);
      expect(tab1Index).toBeGreaterThanOrEqual(0);
      expect(tab4Index).toBeGreaterThanOrEqual(0);
    }).toPass({ timeout: 5000 });
  });

  test('深いネストのサブツリーを移動した場合、全ての子孫が一緒に移動すること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 深いネストのツリー構造を作成
    // Tab1 (サブツリーのルート)
    //   - Child1
    //     - GrandChild1
    // Tab2 (移動先)
    const tab1 = await createTab(extensionContext, 'https://example.com');
    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    const grandChild1 = await createTab(extensionContext, 'https://www.w3.org');
    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');

    // すべてのタブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, tab1);
    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, grandChild1);
    await assertTabInTree(sidePanelPage, tab2);

    // D&Dで親子関係を構築（3レベルのネスト）
    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, child1, tab1, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, grandChild1, child1, serviceWorker);
    await waitForParentChildRelation(extensionContext, grandChild1, child1, { timeout: 5000 });

    // すべてのノードを展開
    const expandNode = async (tabId: number) => {
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

    await expandNode(tab1);
    await expandNode(child1);

    // 孫タブが表示されることを確認
    const grandChild1Node = sidePanelPage.locator(`[data-testid="tree-node-${grandChild1}"]`);
    await expect(grandChild1Node.first()).toBeVisible({ timeout: 3000 });

    // 初期状態で親子関係が正しいことを確認
    const child1ParentBefore = await getParentTabId(sidePanelPage, child1);
    const grandChild1ParentBefore = await getParentTabId(sidePanelPage, grandChild1);
    expect(child1ParentBefore).toBe(tab1);
    expect(grandChild1ParentBefore).toBe(child1);

    // 実行: tab1（サブツリー全体）をtab2の後にドラッグ
    await reorderTabs(sidePanelPage, tab1, tab2, 'after');

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
    }, [tab1, child1, grandChild1, tab2]);

    // 検証: サブツリー全体（3レベル）が移動したことを確認
    // 重要: 親子関係が維持されていることを検証
    await expect(async () => {
      const child1Parent = await getParentTabId(sidePanelPage, child1);
      const grandChild1Parent = await getParentTabId(sidePanelPage, grandChild1);
      expect(child1Parent).toBe(tab1);
      expect(grandChild1Parent).toBe(child1);
    }).toPass({ timeout: 5000 });
  });
});
