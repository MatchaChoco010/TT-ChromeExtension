/**
 * Task 4.6: 子タブの独立ドラッグ操作テスト
 *
 * Requirements 8.1, 8.2:
 * - 子タブをドラッグした際に親タブを追従させず、子タブのみ移動可能にする
 * - 子タブを親から切り離して別の位置にドロップ可能にする
 *
 * このテストスイートでは、親子関係にあるタブの独立ドラッグ操作を検証します。
 * - 子タブのみをドラッグして別の親の子として移動
 * - 子タブを親から切り離してルートレベルに移動
 * - 孫タブをドラッグして別の親の子として移動
 * - 子タブを移動しても元の親タブは移動しないこと
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';
import { waitForParentChildRelation, waitForTabInTreeState } from './utils/polling-utils';

test.describe('Task 4.6: 子タブの独立ドラッグ操作', () => {
  // タイムアウトを延長
  test.setTimeout(120000);

  test('Requirement 8.1: 子タブをドラッグした際に親タブを追従させず、子タブのみ移動可能にすること', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org', parentTab);
    // 別の親タブを作成
    const otherParentTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, otherParentTab);

    // 親子関係がストレージに反映されるまで待機
    await waitForParentChildRelation(extensionContext, childTab, parentTab);

    // 親タブを展開
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    if ((await expandButton.count()) > 0) {
      const isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
      }
    }

    // 子タブが表示されることを確認
    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`).first();
    await expect(childNode).toBeVisible({ timeout: 5000 });

    // 元の親タブのdepthを取得
    const parentDepthBefore = await parentNode.getAttribute('data-depth');
    const childDepthBefore = await childNode.getAttribute('data-depth');

    // 実行: 子タブを別の親タブにドロップ
    await moveTabToParent(sidePanelPage, childTab, otherParentTab);

    // 検証: 子タブが新しい親の子になっている
    await waitForParentChildRelation(extensionContext, childTab, otherParentTab);

    // 元の親タブのdepthが変わっていないことを確認（親タブは移動していない）
    const parentNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    await expect(parentNodeAfter).toBeVisible({ timeout: 5000 });
    const parentDepthAfter = await parentNodeAfter.getAttribute('data-depth');
    expect(parentDepthAfter).toBe(parentDepthBefore);

    // 新しい親タブを展開
    const otherParentNode = sidePanelPage.locator(`[data-testid="tree-node-${otherParentTab}"]`).first();
    const otherExpandButton = otherParentNode.locator('[data-testid="expand-button"]');
    if ((await otherExpandButton.count()) > 0) {
      const isExpanded = await otherParentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await otherExpandButton.first().click();
        await expect(otherParentNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
      }
    }

    // 子タブが新しい親の配下に表示されていることを確認
    const childNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`).first();
    await expect(childNodeAfter).toBeVisible({ timeout: 5000 });
  });

  test('Requirement 8.2: 子タブを親から切り離して別の位置にドロップできること', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 2つの親タブとそれぞれに子タブを作成
    const parentTab1 = await createTab(extensionContext, 'https://example.com');
    const childTab1 = await createTab(extensionContext, 'https://www.iana.org', parentTab1);
    const parentTab2 = await createTab(extensionContext, 'https://www.w3.org');
    const childTab2 = await createTab(extensionContext, 'https://developer.mozilla.org', parentTab2);

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab1);
    await assertTabInTree(sidePanelPage, childTab1);
    await assertTabInTree(sidePanelPage, parentTab2);
    await assertTabInTree(sidePanelPage, childTab2);

    // 親子関係がストレージに反映されるまで待機
    await waitForParentChildRelation(extensionContext, childTab1, parentTab1);
    await waitForParentChildRelation(extensionContext, childTab2, parentTab2);

    // 両方の親タブを展開
    const expandAllParents = async () => {
      for (const parentId of [parentTab1, parentTab2]) {
        const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentId}"]`).first();
        const expandButton = parentNode.locator('[data-testid="expand-button"]');
        if ((await expandButton.count()) > 0) {
          const isExpanded = await parentNode.getAttribute('data-expanded');
          if (isExpanded !== 'true') {
            await expandButton.first().click();
            await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
          }
        }
      }
    };

    await expandAllParents();

    // childTab1を確認
    const childNode1 = sidePanelPage.locator(`[data-testid="tree-node-${childTab1}"]`).first();
    await expect(childNode1).toBeVisible({ timeout: 5000 });

    // 実行: childTab1をparentTab2にドロップ（親を切り離して別の親の子にする）
    await moveTabToParent(sidePanelPage, childTab1, parentTab2);

    // 検証: childTab1がparentTab2の子になっている
    await waitForParentChildRelation(extensionContext, childTab1, parentTab2);

    // 新しい親タブを展開
    await expandAllParents();

    // childTab1が新しい親の配下に表示されていることを確認
    const childNode1After = sidePanelPage.locator(`[data-testid="tree-node-${childTab1}"]`).first();
    await expect(childNode1After).toBeVisible({ timeout: 5000 });

    // 元の親（parentTab1）には展開ボタンがないか、または子がいないこと
    const parentNode1After = sidePanelPage.locator(`[data-testid="tree-node-${parentTab1}"]`).first();
    await expect(parentNode1After).toBeVisible({ timeout: 5000 });
  });

  test('孫タブをドラッグして別の親の子として移動できること', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 3階層のタブ構造を作成
    // ルート -> 親 -> 子 -> 孫
    const rootTab = await createTab(extensionContext, 'https://example.com');
    const parentTab = await createTab(extensionContext, 'https://www.iana.org', rootTab);
    const grandchildTab = await createTab(extensionContext, 'https://www.w3.org', parentTab);

    // 別のルートタブを作成
    const otherRootTab = await createTab(extensionContext, 'https://developer.mozilla.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, rootTab);
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, grandchildTab);
    await assertTabInTree(sidePanelPage, otherRootTab);

    // 親子関係がストレージに反映されるまで待機
    await waitForParentChildRelation(extensionContext, parentTab, rootTab);
    await waitForParentChildRelation(extensionContext, grandchildTab, parentTab);

    // 全ての親タブを展開
    const expandAll = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.first().click();
          await expect(node).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }
    };

    await expandAll(rootTab);
    await expandAll(parentTab);

    // 孫タブが表示されていることを確認
    const grandchildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandchildTab}"]`).first();
    await expect(grandchildNode).toBeVisible({ timeout: 5000 });

    // 孫タブのdepthを取得
    const grandchildDepthBefore = await grandchildNode.getAttribute('data-depth');
    expect(parseInt(grandchildDepthBefore || '0')).toBe(2); // ルート(0) -> 親(1) -> 孫(2)

    // 実行: 孫タブを別のルートタブにドロップ
    await moveTabToParent(sidePanelPage, grandchildTab, otherRootTab);

    // 検証: 孫タブが新しい親の子になっている
    await waitForParentChildRelation(extensionContext, grandchildTab, otherRootTab);

    // 新しい親タブを展開
    await expandAll(otherRootTab);

    // 孫タブが新しい親の配下に表示されていることを確認
    const grandchildNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${grandchildTab}"]`).first();
    await expect(grandchildNodeAfter).toBeVisible({ timeout: 5000 });

    // depth が変わっている（新しい親の子なので depth=1）
    const grandchildDepthAfter = await grandchildNodeAfter.getAttribute('data-depth');
    expect(parseInt(grandchildDepthAfter || '0')).toBe(1); // 新しいルート(0) -> 孫(1)
  });

  test('子タブを移動しても元の親タブは移動しないこと', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと複数の子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab1 = await createTab(extensionContext, 'https://www.iana.org', parentTab);
    const childTab2 = await createTab(extensionContext, 'https://www.w3.org', parentTab);
    // 別の親タブを作成
    const otherParentTab = await createTab(extensionContext, 'https://developer.mozilla.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab1);
    await assertTabInTree(sidePanelPage, childTab2);
    await assertTabInTree(sidePanelPage, otherParentTab);

    // 親子関係がストレージに反映されるまで待機
    await waitForParentChildRelation(extensionContext, childTab1, parentTab);
    await waitForParentChildRelation(extensionContext, childTab2, parentTab);

    // 親タブを展開
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    if ((await expandButton.count()) > 0) {
      const isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
      }
    }

    // 親タブのdepthと位置を取得
    const parentDepthBefore = await parentNode.getAttribute('data-depth');

    // 実行: childTab1を別の親タブにドロップ
    await moveTabToParent(sidePanelPage, childTab1, otherParentTab);

    // 検証: childTab1が新しい親の子になっている
    await waitForParentChildRelation(extensionContext, childTab1, otherParentTab);

    // 親タブのdepthが変わっていないこと（親タブは移動していない）
    const parentNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    await expect(parentNodeAfter).toBeVisible({ timeout: 5000 });
    const parentDepthAfter = await parentNodeAfter.getAttribute('data-depth');
    expect(parentDepthAfter).toBe(parentDepthBefore);

    // childTab2は元の親の子のまま
    await expect(async () => {
      // ストレージを確認
      const result = await sidePanelPage.evaluate(async (ids) => {
        interface TreeNode {
          id: string;
          parentId: string | null;
        }
        interface TreeState {
          nodes: Record<string, TreeNode>;
          tabToNode: Record<number, string>;
        }
        const storage = await chrome.storage.local.get('tree_state');
        const treeState = storage.tree_state as TreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) return false;

        const childNode2 = treeState.tabToNode[ids.childTab2];
        const parentNode = treeState.tabToNode[ids.parentTab];
        if (!childNode2 || !parentNode) return false;

        const childNodeData = treeState.nodes[childNode2];
        return childNodeData?.parentId === parentNode;
      }, { childTab2, parentTab });

      expect(result).toBe(true);
    }).toPass({ timeout: 5000 });
  });
});
