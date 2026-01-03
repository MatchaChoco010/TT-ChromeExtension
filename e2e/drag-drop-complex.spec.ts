/**
 * ドラッグ&ドロップによる複雑なツリー移動テスト
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
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { moveTabToParent, reorderTabs } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForCondition } from './utils/polling-utils';

test.describe('ドラッグ&ドロップによる複雑なツリー移動', () => {
  test('子タブを持つ親タブを移動した場合、サブツリー全体が一緒に移動することを検証する', async ({
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

    // 準備: サブツリーを持つタブ構造を作成
    // parentTab (ルートレベル)
    //   ├─ child1
    //   └─ child2
    //       └─ grandChild
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org', parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org', parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);

    const grandChild = await createTab(
      extensionContext,
      'https://developer.mozilla.org',
      child2
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: grandChild, depth: 2 },
    ], 0);

    // 別のルートレベルのタブを作成（移動先）
    const targetParent = await createTab(extensionContext, 'https://www.github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: grandChild, depth: 2 },
      { tabId: targetParent, depth: 0 },
    ], 0);

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
    await waitForCondition(
      async () => {
        const parentBox = await parentNodeForDrag.boundingBox();
        const targetBox = await targetNodeForDrop.boundingBox();
        return !!(parentBox && targetBox && parentBox.width > 0 && parentBox.height > 0 && targetBox.width > 0 && targetBox.height > 0);
      },
      { timeout: 5000 }
    );

    // 実行: parentTab（およびそのサブツリー全体）をtargetParentにドロップ
    await moveTabToParent(sidePanelPage, parentTab, targetParent);

    // 検証: parentTabとその全ての子孫が新しい親の配下に移動したことを確認
    // targetParent(depth=0) -> parentTab(depth=1) -> child1/child2(depth=2) -> grandChild(depth=3)
    // ツリーを展開してから構造を検証
    await expandAll(targetParent);
    await expandAll(parentTab);
    await expandAll(child2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: targetParent, depth: 0 },
      { tabId: parentTab, depth: 1 },
      { tabId: child1, depth: 2 },
      { tabId: child2, depth: 2 },
      { tabId: grandChild, depth: 3 },
    ], 0);
  });

  test('サブツリーをルートレベルにドロップした場合、元の親子関係から切り離され、ルートノードとして配置されることを検証する', async ({
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

    // 準備: 深い階層のタブ構造を作成
    // rootParent
    //   └─ childWithSubtree
    //       ├─ grandChild1
    //       └─ grandChild2
    const rootParent = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0 },
    ], 0);

    const childWithSubtree = await createTab(extensionContext, 'https://www.iana.org', rootParent);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0 },
      { tabId: childWithSubtree, depth: 1 },
    ], 0);

    const grandChild1 = await createTab(
      extensionContext,
      'https://www.w3.org',
      childWithSubtree
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0 },
      { tabId: childWithSubtree, depth: 1 },
      { tabId: grandChild1, depth: 2 },
    ], 0);

    const grandChild2 = await createTab(
      extensionContext,
      'https://developer.mozilla.org',
      childWithSubtree
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0 },
      { tabId: childWithSubtree, depth: 1 },
      { tabId: grandChild1, depth: 2 },
      { tabId: grandChild2, depth: 2 },
    ], 0);

    // 別のルートレベルのタブを作成（並び替えのターゲット）
    const rootTab = await createTab(extensionContext, 'https://www.github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0 },
      { tabId: childWithSubtree, depth: 1 },
      { tabId: grandChild1, depth: 2 },
      { tabId: grandChild2, depth: 2 },
      { tabId: rootTab, depth: 0 },
    ], 0);

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
    await waitForCondition(
      async () => {
        const childBox = await childForDrag.boundingBox();
        const rootBox = await rootTabForDrop.boundingBox();
        return !!(childBox && rootBox && childBox.width > 0 && childBox.height > 0 && rootBox.width > 0 && rootBox.height > 0);
      },
      { timeout: 5000 }
    );

    // 実行: childWithSubtreeをルートレベルに移動（rootTabの後にドロップ）
    await reorderTabs(sidePanelPage, childWithSubtree, rootTab, 'after');

    // 検証: childWithSubtreeがルートレベルに移動し、子孫も一緒に移動していることを確認
    // childWithSubtree(depth=0) -> grandChild1/grandChild2(depth=1)
    // ツリーを展開してから構造を検証
    await expandAll(childWithSubtree);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: childWithSubtree, depth: 0 },
      { tabId: grandChild1, depth: 1 },
      { tabId: grandChild2, depth: 1 },
    ], 0);
  });

  test('あるサブツリーを別のサブツリー内に移動した場合、サブツリー全体が移動することを検証する', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
    ], 0);

    const child1_1 = await createTab(extensionContext, 'https://www.iana.org', parent1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1_1, depth: 1 },
    ], 0);

    const grandChild1_1_1 = await createTab(
      extensionContext,
      'https://www.w3.org',
      child1_1
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1_1, depth: 1 },
      { tabId: grandChild1_1_1, depth: 2 },
    ], 0);

    const parent2 = await createTab(extensionContext, 'https://www.github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1_1, depth: 1 },
      { tabId: grandChild1_1_1, depth: 2 },
      { tabId: parent2, depth: 0 },
    ], 0);

    const child2_1 = await createTab(extensionContext, 'https://developer.mozilla.org', parent2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1_1, depth: 1 },
      { tabId: grandChild1_1_1, depth: 2 },
      { tabId: parent2, depth: 0 },
      { tabId: child2_1, depth: 1 },
    ], 0);

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
    await waitForCondition(
      async () => {
        const child1Box = await child1_1ForDrag.boundingBox();
        const child2Box = await child2_1ForDrop.boundingBox();
        return !!(child1Box && child2Box && child1Box.width > 0 && child1Box.height > 0 && child2Box.width > 0 && child2Box.height > 0);
      },
      { timeout: 5000 }
    );

    // 実行: child1_1（とそのサブツリー）をchild2_1にドロップ
    await moveTabToParent(sidePanelPage, child1_1, child2_1, serviceWorker);

    // 検証: child1_1とgrandChild1_1_1がサブツリーごと移動したことを確認
    // parent2(depth=0) -> child2_1(depth=1) -> child1_1(depth=2) -> grandChild1_1_1(depth=3)
    // ツリーを展開してから構造を検証
    await expandAll(child2_1);
    await expandAll(child1_1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: parent2, depth: 0 },
      { tabId: child2_1, depth: 1 },
      { tabId: child1_1, depth: 2 },
      { tabId: grandChild1_1_1, depth: 3 },
    ], 0);
  });

  test('親タブを自分の子孫タブにドロップしようとした場合、循環参照を防ぐため操作が拒否されることを検証する', async ({
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

    // 準備: 階層的なタブ構造を作成
    // parent
    //   └─ child
    //       └─ grandChild
    const parent = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent, depth: 0 },
    ], 0);

    const child = await createTab(extensionContext, 'https://www.iana.org', parent);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent, depth: 0 },
      { tabId: child, depth: 1 },
    ], 0);

    const grandChild = await createTab(extensionContext, 'https://www.w3.org', child);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent, depth: 0 },
      { tabId: child, depth: 1 },
      { tabId: grandChild, depth: 2 },
    ], 0);

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

    // ドラッグ対象とドロップ先の要素が完全に準備できるまで待機
    const parentNodeForDrag = sidePanelPage.locator(`[data-testid="tree-node-${parent}"]`).first();
    const grandChildNodeForDrop = sidePanelPage.locator(`[data-testid="tree-node-${grandChild}"]`).first();
    await expect(parentNodeForDrag).toBeVisible({ timeout: 5000 });
    await expect(grandChildNodeForDrop).toBeVisible({ timeout: 5000 });

    // 要素のバウンディングボックスが取得可能になるまで待機
    await waitForCondition(
      async () => {
        const parentBox = await parentNodeForDrag.boundingBox();
        const grandChildBox = await grandChildNodeForDrop.boundingBox();
        return !!(parentBox && grandChildBox && parentBox.width > 0 && parentBox.height > 0 && grandChildBox.width > 0 && grandChildBox.height > 0);
      },
      { timeout: 5000 }
    );

    // 実行: parentをgrandChild（自分の子孫）にドロップしようとする
    // この操作は循環参照になるため、拒否されるべき
    await moveTabToParent(sidePanelPage, parent, grandChild);

    // 検証: 操作が拒否され、元の構造が維持されることを確認
    // parent(depth=0) -> child(depth=1) -> grandChild(depth=2)
    // ツリーを再度展開してから構造を検証
    await expandAll(parent);
    await expandAll(child);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent, depth: 0 },
      { tabId: child, depth: 1 },
      { tabId: grandChild, depth: 2 },
    ], 0);
  });

  test('サブツリーを移動した場合、サブツリー構造が維持されることを検証する', async ({
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

    // 準備: サブツリーを持つタブ構造を作成
    // parent1
    //   ├─ child1
    //   └─ child2
    //       └─ grandChild
    const parent1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org', parent1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 1 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org', parent1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);

    const grandChild = await createTab(
      extensionContext,
      'https://developer.mozilla.org',
      child2
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: grandChild, depth: 2 },
    ], 0);

    // 別のルートレベルのタブを作成（移動先）
    const parent2 = await createTab(extensionContext, 'https://www.github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: grandChild, depth: 2 },
      { tabId: parent2, depth: 0 },
    ], 0);

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
    await waitForCondition(
      async () => {
        const child2Box = await child2ForDrag.boundingBox();
        const parent2Box = await parent2ForDrop.boundingBox();
        return !!(child2Box && parent2Box && child2Box.width > 0 && child2Box.height > 0 && parent2Box.width > 0 && parent2Box.height > 0);
      },
      { timeout: 5000 }
    );

    // 実行: child2（サブツリー）をparent2にドロップ
    await moveTabToParent(sidePanelPage, child2, parent2, serviceWorker);

    // 検証: child2とgrandChildがサブツリー構造を維持して移動したことを確認
    // parent2(depth=0) -> child2(depth=1) -> grandChild(depth=2)
    // ツリーを展開してから構造を検証
    await expandAll(parent2);
    await expandAll(child2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: parent2, depth: 0 },
      { tabId: child2, depth: 1 },
      { tabId: grandChild, depth: 2 },
    ], 0);
  });
});
