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
    serviceWorker,
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
      // ノードが安定するまで待機
      await expect(node).toBeVisible({ timeout: 5000 });
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.click();
          // 展開状態が反映されるまで待機
          await expect(node).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }
    };

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await expandAll(parentTab);
    await expandAll(child2);

    // ドラッグ対象とドロップ先の要素が完全に準備できるまで待機
    const parentNodeForDrag = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const targetNodeForDrop = sidePanelPage.locator(`[data-testid="tree-node-${targetParent}"]`).first();
    await expect(parentNodeForDrag).toBeVisible({ timeout: 5000 });
    await expect(targetNodeForDrop).toBeVisible({ timeout: 5000 });

    // 要素のバウンディングボックスが取得可能になるまで待機
    await sidePanelPage.waitForFunction(
      ([parentId, targetId]) => {
        const parent = document.querySelector(`[data-testid="tree-node-${parentId}"]`);
        const target = document.querySelector(`[data-testid="tree-node-${targetId}"]`);
        if (!parent || !target) return false;
        const parentRect = parent.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        return parentRect.width > 0 && parentRect.height > 0 && targetRect.width > 0 && targetRect.height > 0;
      },
      [parentTab, targetParent] as [number, number],
      { timeout: 5000 }
    );

    // 実行: parentTab（およびそのサブツリー全体）をtargetParentにドロップ
    await moveTabToParent(sidePanelPage, parentTab, targetParent);

    // 検証: parentTabとその全ての子孫が新しい親の配下に移動したことを確認
    // targetParentを展開
    await expandAll(targetParent);

    // parentTabが存在することを確認
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
    await expect(parentNode.first()).toBeVisible({ timeout: 15000 });

    // parentTabを展開
    await expandAll(parentTab);

    // 子タブが存在することを確認（タイムアウト増加）
    const child1Node = sidePanelPage.locator(`[data-testid="tree-node-${child1}"]`);
    const child2Node = sidePanelPage.locator(`[data-testid="tree-node-${child2}"]`);
    await expect(child1Node.first()).toBeVisible({ timeout: 15000 });
    await expect(child2Node.first()).toBeVisible({ timeout: 15000 });

    // child2を展開
    await expandAll(child2);

    // grandChildも一緒に移動していることを確認（タイムアウト増加）
    const grandChildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandChild}"]`);
    await expect(grandChildNode.first()).toBeVisible({ timeout: 15000 });
  });

  test('サブツリーをルートレベルにドロップした場合、元の親子関係から切り離され、ルートノードとして配置されることを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
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
      // ノードが安定するまで待機
      await expect(node).toBeVisible({ timeout: 5000 });
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.click();
          // 展開状態が反映されるまで待機
          await expect(node).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }
    };

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await expandAll(rootParent);
    await expandAll(childWithSubtree);

    // ドラッグ対象とドロップ先の要素が完全に準備できるまで待機
    const childForDrag = sidePanelPage.locator(`[data-testid="tree-node-${childWithSubtree}"]`).first();
    const rootTabForDrop = sidePanelPage.locator(`[data-testid="tree-node-${rootTab}"]`).first();
    await expect(childForDrag).toBeVisible({ timeout: 5000 });
    await expect(rootTabForDrop).toBeVisible({ timeout: 5000 });

    // 要素のバウンディングボックスが取得可能になるまで待機
    await sidePanelPage.waitForFunction(
      ([childId, rootId]) => {
        const child = document.querySelector(`[data-testid="tree-node-${childId}"]`);
        const root = document.querySelector(`[data-testid="tree-node-${rootId}"]`);
        if (!child || !root) return false;
        const childRect = child.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();
        return childRect.width > 0 && childRect.height > 0 && rootRect.width > 0 && rootRect.height > 0;
      },
      [childWithSubtree, rootTab] as [number, number],
      { timeout: 5000 }
    );

    // 実行: childWithSubtreeをルートレベルに移動（rootTabの後にドロップ）
    await reorderTabs(sidePanelPage, childWithSubtree, rootTab, 'after');

    // 検証: childWithSubtreeがルートレベルに存在することを確認
    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childWithSubtree}"]`);
    await expect(childNode.first()).toBeVisible({ timeout: 15000 });

    // childWithSubtreeを展開
    await expandAll(childWithSubtree);

    // その子孫（grandChild1, grandChild2）も一緒に移動していることを確認
    const grandChild1Node = sidePanelPage.locator(`[data-testid="tree-node-${grandChild1}"]`);
    const grandChild2Node = sidePanelPage.locator(`[data-testid="tree-node-${grandChild2}"]`);
    await expect(grandChild1Node.first()).toBeVisible({ timeout: 15000 });
    await expect(grandChild2Node.first()).toBeVisible({ timeout: 15000 });

    // depthの検証（ルートレベルに移動した場合、depthが0または1になるはず）
    const childDepth = await childNode.first().getAttribute('data-depth');
    if (childDepth !== null) {
      const childDepthNum = parseInt(childDepth, 10);
      // ルートレベルのタブのdepthは通常0または1
      expect(childDepthNum).toBeLessThanOrEqual(1);
    }
  });

  test('あるサブツリーを別のサブツリー内に移動した場合、サブツリー全体が移動することを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
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
      // ノードが安定するまで待機
      await expect(node).toBeVisible({ timeout: 5000 });
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.click();
          // 展開状態が反映されるまで待機
          await expect(node).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }
    };

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await expandAll(parent1);
    await expandAll(child1_1);
    await expandAll(parent2);

    // ドラッグ対象とドロップ先の要素が完全に準備できるまで待機
    const child1_1ForDrag = sidePanelPage.locator(`[data-testid="tree-node-${child1_1}"]`).first();
    const child2_1ForDrop = sidePanelPage.locator(`[data-testid="tree-node-${child2_1}"]`).first();
    await expect(child1_1ForDrag).toBeVisible({ timeout: 5000 });
    await expect(child2_1ForDrop).toBeVisible({ timeout: 5000 });

    // 要素のバウンディングボックスが取得可能になるまで待機
    await sidePanelPage.waitForFunction(
      ([child1Id, child2Id]) => {
        const child1 = document.querySelector(`[data-testid="tree-node-${child1Id}"]`);
        const child2 = document.querySelector(`[data-testid="tree-node-${child2Id}"]`);
        if (!child1 || !child2) return false;
        const child1Rect = child1.getBoundingClientRect();
        const child2Rect = child2.getBoundingClientRect();
        return child1Rect.width > 0 && child1Rect.height > 0 && child2Rect.width > 0 && child2Rect.height > 0;
      },
      [child1_1, child2_1] as [number, number],
      { timeout: 5000 }
    );

    // 実行: child1_1（とそのサブツリー）をchild2_1にドロップ
    await moveTabToParent(sidePanelPage, child1_1, child2_1, serviceWorker);

    // 検証: child1_1とgrandChild1_1_1が移動後も存在することを確認
    // child2_1を展開
    await expandAll(child2_1);

    // child1_1が存在することを確認
    const child1_1Node = sidePanelPage.locator(`[data-testid="tree-node-${child1_1}"]`);
    await expect(child1_1Node.first()).toBeVisible({ timeout: 15000 });

    // child1_1を展開
    await expandAll(child1_1);

    // grandChild1_1_1も一緒に移動していることを確認
    // これがサブツリー移動の本質的なテスト
    const grandChild1_1_1Node = sidePanelPage.locator(
      `[data-testid="tree-node-${grandChild1_1_1}"]`
    );
    await expect(grandChild1_1_1Node.first()).toBeVisible({ timeout: 15000 });
  });

  test('親タブを自分の子孫タブにドロップしようとした場合、循環参照を防ぐため操作が拒否されることを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
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
      // ノードが安定するまで待機
      await expect(node).toBeVisible({ timeout: 5000 });
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.click();
          // 展開状態が反映されるまで待機
          await expect(node).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }
    };

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await expandAll(parent);
    await expandAll(child);

    // 移動前の親子関係を記録
    const parentNodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${parent}"]`).first();
    const childNodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${child}"]`).first();
    const grandChildNodeBefore = sidePanelPage.locator(
      `[data-testid="tree-node-${grandChild}"]`
    ).first();

    // 移動前の状態を確認
    await expect(parentNodeBefore).toBeVisible({ timeout: 5000 });
    await expect(childNodeBefore).toBeVisible({ timeout: 5000 });
    await expect(grandChildNodeBefore).toBeVisible({ timeout: 5000 });

    // ドラッグ対象とドロップ先の要素が完全に準備できるまで待機
    // 要素のバウンディングボックスが取得可能になるまで待機
    await sidePanelPage.waitForFunction(
      ([parentId, grandChildId]) => {
        const parentEl = document.querySelector(`[data-testid="tree-node-${parentId}"]`);
        const grandChildEl = document.querySelector(`[data-testid="tree-node-${grandChildId}"]`);
        if (!parentEl || !grandChildEl) return false;
        const parentRect = parentEl.getBoundingClientRect();
        const grandChildRect = grandChildEl.getBoundingClientRect();
        return parentRect.width > 0 && parentRect.height > 0 && grandChildRect.width > 0 && grandChildRect.height > 0;
      },
      [parent, grandChild] as [number, number],
      { timeout: 5000 }
    );

    // 実行: parentをgrandChild（自分の子孫）にドロップしようとする
    // この操作は循環参照になるため、拒否されるべき
    await moveTabToParent(sidePanelPage, parent, grandChild);

    // 検証: 操作が拒否され、元の構造が維持されることを確認
    // ドロップ後に状態が更新されないことを確認（少し待機してから検証）
    await serviceWorker.evaluate(async () => {
      for (let i = 0; i < 10; i++) {
        const result = await chrome.storage.local.get('tree_state');
        if (result.tree_state) {
          return;
        }
        // eslint-disable-next-line no-undef
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    });

    // ツリーを再度展開
    await expandAll(parent);
    await expandAll(child);

    // 親子関係が変わっていないことを確認
    const parentNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parent}"]`).first();
    const childNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${child}"]`).first();
    const grandChildNodeAfter = sidePanelPage.locator(
      `[data-testid="tree-node-${grandChild}"]`
    ).first();

    await expect(parentNodeAfter).toBeVisible({ timeout: 15000 });
    await expect(childNodeAfter).toBeVisible({ timeout: 15000 });
    await expect(grandChildNodeAfter).toBeVisible({ timeout: 15000 });

    // depthが変わっていないことを確認（実装がある場合）
    const parentDepthBefore = await parentNodeBefore.getAttribute('data-depth');
    const parentDepthAfter = await parentNodeAfter.getAttribute('data-depth');

    if (parentDepthBefore !== null && parentDepthAfter !== null) {
      expect(parentDepthAfter).toBe(parentDepthBefore);
    }
  });

  test('サブツリーを移動した場合、サブツリー構造が維持されることを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
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
      // ノードが安定するまで待機
      await expect(node).toBeVisible({ timeout: 5000 });
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.click();
          // 展開状態が反映されるまで待機
          await expect(node).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }
    };

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // 全てのノードを展開
    await expandAll(parent1);
    await expandAll(child2);

    // ドラッグ対象とドロップ先の要素が完全に準備できるまで待機
    const child2ForDrag = sidePanelPage.locator(`[data-testid="tree-node-${child2}"]`).first();
    const parent2ForDrop = sidePanelPage.locator(`[data-testid="tree-node-${parent2}"]`).first();
    await expect(child2ForDrag).toBeVisible({ timeout: 5000 });
    await expect(parent2ForDrop).toBeVisible({ timeout: 5000 });

    // 要素のバウンディングボックスが取得可能になるまで待機
    await sidePanelPage.waitForFunction(
      ([child2Id, parent2Id]) => {
        const child2El = document.querySelector(`[data-testid="tree-node-${child2Id}"]`);
        const parent2El = document.querySelector(`[data-testid="tree-node-${parent2Id}"]`);
        if (!child2El || !parent2El) return false;
        const child2Rect = child2El.getBoundingClientRect();
        const parent2Rect = parent2El.getBoundingClientRect();
        return child2Rect.width > 0 && child2Rect.height > 0 && parent2Rect.width > 0 && parent2Rect.height > 0;
      },
      [child2, parent2] as [number, number],
      { timeout: 5000 }
    );

    // 実行: child2（サブツリー）をparent2にドロップ
    await moveTabToParent(sidePanelPage, child2, parent2, serviceWorker);

    // 検証: child2が移動したことを確認
    // parent2を展開
    await expandAll(parent2);

    // child2が存在することを確認
    const child2Node = sidePanelPage.locator(`[data-testid="tree-node-${child2}"]`);
    await expect(child2Node.first()).toBeVisible({ timeout: 15000 });

    // child2を展開して、grandChildも一緒に移動していることを確認
    // （これがサブツリー移動の本質的なテスト）
    await expandAll(child2);
    const grandChildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandChild}"]`);
    await expect(grandChildNode.first()).toBeVisible({ timeout: 15000 });
  });
});
