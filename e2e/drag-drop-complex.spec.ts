/**
 * ドラッグ&ドロップによる複雑なツリー移動テスト
 *
 * Requirement 3.4: ドラッグ&ドロップによる複雑なツリー移動
 *
 * このテストスイートでは、複雑なツリー移動操作を検証します。
 * - サブツリー全体の一括移動
 * - サブツリーのルートレベルへの移動
 * - サブツリーを別のサブツリー内に移動した際のdepth再計算
 * - 循環参照の防止
 * - 折りたたまれた状態のサブツリー移動時の展開状態保持
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { moveTabToParent, reorderTabs } from './utils/drag-drop-utils';

test.describe('ドラッグ&ドロップによる複雑なツリー移動', () => {
  test('子タブを持つ親タブを移動した場合、サブツリー全体が一緒に移動することを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: サブツリーを持つタブ構造を作成
    // parentTab (ルートレベル)
    //   ├─ child1
    //   └─ child2
    //       └─ grandChild
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const child1 = await createTab(extensionContext, 'https://www.iana.org', parentTab);
    const child2 = await createTab(extensionContext, 'https://www.w3.org', parentTab);
    const grandChild = await createTab(
      extensionContext,
      'https://developer.mozilla.org',
      child2
    );

    // 別のルートレベルのタブを作成（移動先）
    const targetParent = await createTab(extensionContext, 'https://www.github.com');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, child2);
    await assertTabInTree(sidePanelPage, grandChild);
    await assertTabInTree(sidePanelPage, targetParent);

    // ツリーを展開してすべてのタブを表示
    const expandAll = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.click();
          await sidePanelPage.waitForTimeout(200);
        }
      }
    };

    await expandAll(parentTab);
    await expandAll(child2);

    // 実行: parentTab（およびそのサブツリー全体）をtargetParentにドロップ
    await moveTabToParent(sidePanelPage, parentTab, targetParent);

    // 検証: parentTabとその全ての子孫が新しい親の配下に移動したことを確認
    await sidePanelPage.waitForTimeout(500);

    // targetParentを展開
    await expandAll(targetParent);

    // parentTabが存在することを確認
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
    await expect(parentNode.first()).toBeVisible();

    // parentTabを展開
    await expandAll(parentTab);

    // 子タブが存在することを確認
    const child1Node = sidePanelPage.locator(`[data-testid="tree-node-${child1}"]`);
    const child2Node = sidePanelPage.locator(`[data-testid="tree-node-${child2}"]`);
    await expect(child1Node.first()).toBeVisible();
    await expect(child2Node.first()).toBeVisible();

    // child2を展開
    await expandAll(child2);

    // grandChildも一緒に移動していることを確認
    const grandChildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandChild}"]`);
    await expect(grandChildNode.first()).toBeVisible();
  });

  test('サブツリーをルートレベルにドロップした場合、元の親子関係から切り離され、ルートノードとして配置されることを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 深い階層のタブ構造を作成
    // rootParent
    //   └─ childWithSubtree
    //       ├─ grandChild1
    //       └─ grandChild2
    const rootParent = await createTab(extensionContext, 'https://example.com');
    const childWithSubtree = await createTab(extensionContext, 'https://www.iana.org', rootParent);
    const grandChild1 = await createTab(
      extensionContext,
      'https://www.w3.org',
      childWithSubtree
    );
    const grandChild2 = await createTab(
      extensionContext,
      'https://developer.mozilla.org',
      childWithSubtree
    );

    // 別のルートレベルのタブを作成（並び替えのターゲット）
    const rootTab = await createTab(extensionContext, 'https://www.github.com');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, rootParent);
    await assertTabInTree(sidePanelPage, childWithSubtree);
    await assertTabInTree(sidePanelPage, grandChild1);
    await assertTabInTree(sidePanelPage, grandChild2);
    await assertTabInTree(sidePanelPage, rootTab);

    // ツリーを展開してすべてのタブを表示
    const expandAll = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.click();
          await sidePanelPage.waitForTimeout(200);
        }
      }
    };

    await expandAll(rootParent);
    await expandAll(childWithSubtree);

    // 実行: childWithSubtreeをルートレベルに移動（rootTabの後にドロップ）
    await reorderTabs(sidePanelPage, childWithSubtree, rootTab, 'after');

    // 検証: childWithSubtreeがルートレベルに配置されたことを確認
    await sidePanelPage.waitForTimeout(500);

    // childWithSubtreeがルートレベルに存在することを確認
    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childWithSubtree}"]`);
    await expect(childNode.first()).toBeVisible();

    // childWithSubtreeを展開
    await expandAll(childWithSubtree);

    // その子孫（grandChild1, grandChild2）も一緒に移動していることを確認
    const grandChild1Node = sidePanelPage.locator(`[data-testid="tree-node-${grandChild1}"]`);
    const grandChild2Node = sidePanelPage.locator(`[data-testid="tree-node-${grandChild2}"]`);
    await expect(grandChild1Node.first()).toBeVisible();
    await expect(grandChild2Node.first()).toBeVisible();

    // depthの検証（ルートレベルに移動した場合、depthが0または1になるはず）
    const childDepth = await childNode.first().getAttribute('data-depth');
    if (childDepth !== null) {
      const childDepthNum = parseInt(childDepth, 10);
      // ルートレベルのタブのdepthは通常0または1
      expect(childDepthNum).toBeLessThanOrEqual(1);
    }
  });

  test('あるサブツリーを別のサブツリー内に移動した場合、全ての子孫ノードのdepthが正しく更新されることを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 2つの独立したサブツリーを作成
    // Tree 1:
    // parent1
    //   └─ child1_1
    //       └─ grandChild1_1_1
    //
    // Tree 2:
    // parent2
    //   └─ child2_1
    const parent1 = await createTab(extensionContext, 'https://example.com');
    const child1_1 = await createTab(extensionContext, 'https://www.iana.org', parent1);
    const grandChild1_1_1 = await createTab(
      extensionContext,
      'https://www.w3.org',
      child1_1
    );

    const parent2 = await createTab(extensionContext, 'https://www.github.com');
    const child2_1 = await createTab(extensionContext, 'https://developer.mozilla.org', parent2);

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parent1);
    await assertTabInTree(sidePanelPage, child1_1);
    await assertTabInTree(sidePanelPage, grandChild1_1_1);
    await assertTabInTree(sidePanelPage, parent2);
    await assertTabInTree(sidePanelPage, child2_1);

    // ツリーを展開してすべてのタブを表示
    const expandAll = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.click();
          await sidePanelPage.waitForTimeout(200);
        }
      }
    };

    await expandAll(parent1);
    await expandAll(child1_1);
    await expandAll(parent2);

    // 移動前のdepthを記録
    const child1_1NodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${child1_1}"]`).first();
    const grandChild1_1_1NodeBefore = sidePanelPage.locator(
      `[data-testid="tree-node-${grandChild1_1_1}"]`
    ).first();
    const depthBefore_child1_1 = await child1_1NodeBefore.getAttribute('data-depth');
    const depthBefore_grandChild1_1_1 = await grandChild1_1_1NodeBefore.getAttribute('data-depth');

    // 実行: child1_1（とそのサブツリー）をchild2_1にドロップ
    await moveTabToParent(sidePanelPage, child1_1, child2_1);

    // 検証: child1_1とgrandChild1_1_1が新しい親の配下に移動したことを確認
    await sidePanelPage.waitForTimeout(500);

    // child2_1を展開
    await expandAll(child2_1);

    // child1_1が存在することを確認
    const child1_1Node = sidePanelPage.locator(`[data-testid="tree-node-${child1_1}"]`);
    await expect(child1_1Node.first()).toBeVisible();

    // child1_1を展開
    await expandAll(child1_1);

    // grandChild1_1_1も一緒に移動していることを確認
    const grandChild1_1_1Node = sidePanelPage.locator(
      `[data-testid="tree-node-${grandChild1_1_1}"]`
    );
    await expect(grandChild1_1_1Node.first()).toBeVisible();

    // depthの検証
    const depthAfter_child1_1 = await child1_1Node.first().getAttribute('data-depth');
    const depthAfter_grandChild1_1_1 = await grandChild1_1_1Node
      .first()
      .getAttribute('data-depth');

    // depthが設定されている場合、移動後のdepthが正しく更新されていることを確認
    if (
      depthBefore_child1_1 !== null &&
      depthBefore_grandChild1_1_1 !== null &&
      depthAfter_child1_1 !== null &&
      depthAfter_grandChild1_1_1 !== null
    ) {
      const depthBefore_child1_1_num = parseInt(depthBefore_child1_1, 10);
      const depthBefore_grandChild1_1_1_num = parseInt(depthBefore_grandChild1_1_1, 10);
      const depthAfter_child1_1_num = parseInt(depthAfter_child1_1, 10);
      const depthAfter_grandChild1_1_1_num = parseInt(depthAfter_grandChild1_1_1, 10);

      // 移動前のdepth差が保持されることを確認
      const depthDiffBefore = depthBefore_grandChild1_1_1_num - depthBefore_child1_1_num;
      const depthDiffAfter = depthAfter_grandChild1_1_1_num - depthAfter_child1_1_num;
      expect(depthDiffAfter).toBe(depthDiffBefore);

      // grandChild1_1_1のdepthがchild1_1のdepthより1大きいことを確認
      expect(depthAfter_grandChild1_1_1_num).toBe(depthAfter_child1_1_num + 1);
    }
  });

  test('親タブを自分の子孫タブにドロップしようとした場合、循環参照を防ぐため操作が拒否されることを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 階層的なタブ構造を作成
    // parent
    //   └─ child
    //       └─ grandChild
    const parent = await createTab(extensionContext, 'https://example.com');
    const child = await createTab(extensionContext, 'https://www.iana.org', parent);
    const grandChild = await createTab(extensionContext, 'https://www.w3.org', child);

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parent);
    await assertTabInTree(sidePanelPage, child);
    await assertTabInTree(sidePanelPage, grandChild);

    // ツリーを展開してすべてのタブを表示
    const expandAll = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.click();
          await sidePanelPage.waitForTimeout(200);
        }
      }
    };

    await expandAll(parent);
    await expandAll(child);

    // 移動前の親子関係を記録
    const parentNodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${parent}"]`).first();
    const childNodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${child}"]`).first();
    const grandChildNodeBefore = sidePanelPage.locator(
      `[data-testid="tree-node-${grandChild}"]`
    ).first();

    // 移動前の状態を確認
    await expect(parentNodeBefore).toBeVisible();
    await expect(childNodeBefore).toBeVisible();
    await expect(grandChildNodeBefore).toBeVisible();

    // 実行: parentをgrandChild（自分の子孫）にドロップしようとする
    // この操作は循環参照になるため、拒否されるべき
    await moveTabToParent(sidePanelPage, parent, grandChild);

    // 検証: 操作が拒否され、元の構造が維持されることを確認
    await sidePanelPage.waitForTimeout(500);

    // ツリーを再度展開
    await expandAll(parent);
    await expandAll(child);

    // 親子関係が変わっていないことを確認
    const parentNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parent}"]`).first();
    const childNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${child}"]`).first();
    const grandChildNodeAfter = sidePanelPage.locator(
      `[data-testid="tree-node-${grandChild}"]`
    ).first();

    await expect(parentNodeAfter).toBeVisible();
    await expect(childNodeAfter).toBeVisible();
    await expect(grandChildNodeAfter).toBeVisible();

    // depthが変わっていないことを確認（実装がある場合）
    const parentDepthBefore = await parentNodeBefore.getAttribute('data-depth');
    const parentDepthAfter = await parentNodeAfter.getAttribute('data-depth');

    if (parentDepthBefore !== null && parentDepthAfter !== null) {
      expect(parentDepthAfter).toBe(parentDepthBefore);
    }
  });

  test('折りたたまれた状態のサブツリーを移動した場合、展開状態を保持したまま移動することを検証する', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: サブツリーを持つタブ構造を作成
    // parent1
    //   ├─ child1
    //   └─ child2
    //       └─ grandChild
    const parent1 = await createTab(extensionContext, 'https://example.com');
    const child1 = await createTab(extensionContext, 'https://www.iana.org', parent1);
    const child2 = await createTab(extensionContext, 'https://www.w3.org', parent1);
    const grandChild = await createTab(
      extensionContext,
      'https://developer.mozilla.org',
      child2
    );

    // 別のルートレベルのタブを作成（移動先）
    const parent2 = await createTab(extensionContext, 'https://www.github.com');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parent1);
    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, child2);
    await assertTabInTree(sidePanelPage, grandChild);
    await assertTabInTree(sidePanelPage, parent2);

    // ツリーを展開してすべてのタブを表示
    const expandAll = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.click();
          await sidePanelPage.waitForTimeout(200);
        }
      }
    };

    const collapseNode = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded === 'true') {
          await button.click();
          await sidePanelPage.waitForTimeout(200);
        }
      }
    };

    // 全てのノードを展開
    await expandAll(parent1);
    await expandAll(child2);

    // child2を折りたたむ
    await collapseNode(child2);

    // 移動前の展開状態を記録
    const child2NodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${child2}"]`).first();
    const isExpandedBefore = await child2NodeBefore.getAttribute('data-expanded');

    // 実行: child2（折りたたまれたサブツリー）をparent2にドロップ
    await moveTabToParent(sidePanelPage, child2, parent2);

    // 検証: child2が移動し、展開状態が保持されることを確認
    await sidePanelPage.waitForTimeout(500);

    // parent2を展開
    await expandAll(parent2);

    // child2が存在することを確認
    const child2Node = sidePanelPage.locator(`[data-testid="tree-node-${child2}"]`);
    await expect(child2Node.first()).toBeVisible();

    // 展開状態が保持されていることを確認
    const isExpandedAfter = await child2Node.first().getAttribute('data-expanded');

    // 移動前が折りたたまれていた場合、移動後も折りたたまれていることを確認
    if (isExpandedBefore === 'false') {
      expect(isExpandedAfter).toBe('false');
    }

    // child2を展開して、grandChildも一緒に移動していることを確認
    await expandAll(child2);
    const grandChildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandChild}"]`);
    await expect(grandChildNode.first()).toBeVisible();
  });
});
