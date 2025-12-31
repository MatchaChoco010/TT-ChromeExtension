/**
 * Task 16.4 & Task 6.1: 子タブの独立ドラッグ操作テスト
 *
 * Requirements 3.2.1, 3.2.3:
 * - 子タブをドラッグした際に親タブを追従させず、子タブのみ移動可能にする
 * - 子タブを親から切り離して別の位置にドロップ可能にする
 *
 * Requirements 11.1, 11.3 (Task 6.1):
 * - ドラッグで親子関係を解消した状態が維持されること
 * - 元子タブの`parentId`がnullまたは新しい親IDに正しく更新されること
 *
 * このテストスイートでは、親子関係にあるタブの独立ドラッグ操作を検証します。
 * - 子タブのみをドラッグして別の親の子として移動
 * - 子タブを親から切り離してルートレベルに移動
 * - 孫タブをドラッグして別の親の子として移動
 * - 子タブを移動しても元の親タブは移動しないこと
 * - 親子関係解消が永続化されること
 *
 * Note: 自前D&D実装を使用
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { moveTabToParent, getParentTabId, getTabDepth, moveTabToRoot } from './utils/drag-drop-utils';
import { waitForParentChildRelation, waitForTabNoParent } from './utils/polling-utils';

test.describe('Task 16.4: 子タブの独立ドラッグ操作', () => {
  // タイムアウトを延長
  test.setTimeout(120000);

  test('子タブをドラッグした際に親タブを追従させず、子タブのみ移動可能にすること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブ、別の親タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    const otherParentTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, otherParentTab);

    // D&Dで親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

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

    // 実行: 子タブを別の親タブにドロップ
    await moveTabToParent(sidePanelPage, childTab, otherParentTab, serviceWorker);

    // 検証: 子タブが新しい親の子になっている
    await waitForParentChildRelation(extensionContext, childTab, otherParentTab, { timeout: 5000 });

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

    // 子タブのdepthが正しいことを確認
    const childDepthAfter = await getTabDepth(sidePanelPage, childTab);
    expect(childDepthAfter).toBe(1); // 新しい親の直下なのでdepth=1
  });

  test('子タブを親から切り離して別の位置にドロップできること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 2つの親タブとそれぞれに子タブを作成
    const parentTab1 = await createTab(extensionContext, 'https://example.com');
    const childTab1 = await createTab(extensionContext, 'https://www.iana.org');
    const parentTab2 = await createTab(extensionContext, 'https://www.w3.org');
    const childTab2 = await createTab(extensionContext, 'https://developer.mozilla.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab1);
    await assertTabInTree(sidePanelPage, childTab1);
    await assertTabInTree(sidePanelPage, parentTab2);
    await assertTabInTree(sidePanelPage, childTab2);

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTab1, parentTab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab1, parentTab1, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, childTab2, parentTab2, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab2, parentTab2, { timeout: 5000 });

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
    await moveTabToParent(sidePanelPage, childTab1, parentTab2, serviceWorker);

    // 検証: childTab1がparentTab2の子になっている
    await waitForParentChildRelation(extensionContext, childTab1, parentTab2, { timeout: 5000 });

    // 新しい親タブを展開
    await expandAllParents();

    // childTab1が新しい親の配下に表示されていることを確認
    const childNode1After = sidePanelPage.locator(`[data-testid="tree-node-${childTab1}"]`).first();
    await expect(childNode1After).toBeVisible({ timeout: 5000 });

    // 親子関係が正しいことを確認
    const parent = await getParentTabId(sidePanelPage, childTab1);
    expect(parent).toBe(parentTab2);
  });

  test('孫タブをドラッグして別の親の子として移動できること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 3階層のタブ構造を作成
    // ルート -> 親 -> 孫
    const rootTab = await createTab(extensionContext, 'https://example.com');
    const parentTab = await createTab(extensionContext, 'https://www.iana.org');
    const grandchildTab = await createTab(extensionContext, 'https://www.w3.org');
    const otherRootTab = await createTab(extensionContext, 'https://developer.mozilla.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, rootTab);
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, grandchildTab);
    await assertTabInTree(sidePanelPage, otherRootTab);

    // D&Dで階層構造を構築
    await moveTabToParent(sidePanelPage, parentTab, rootTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, parentTab, rootTab, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, grandchildTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, grandchildTab, parentTab, { timeout: 5000 });

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
    const grandchildDepthBefore = await getTabDepth(sidePanelPage, grandchildTab);
    expect(grandchildDepthBefore).toBe(2); // ルート(0) -> 親(1) -> 孫(2)

    // 実行: 孫タブを別のルートタブにドロップ
    await moveTabToParent(sidePanelPage, grandchildTab, otherRootTab, serviceWorker);

    // 検証: 孫タブが新しい親の子になっている
    await waitForParentChildRelation(extensionContext, grandchildTab, otherRootTab, { timeout: 5000 });

    // 新しい親タブを展開
    await expandAll(otherRootTab);

    // 孫タブが新しい親の配下に表示されていることを確認
    const grandchildNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${grandchildTab}"]`).first();
    await expect(grandchildNodeAfter).toBeVisible({ timeout: 5000 });

    // depth が変わっている（新しい親の子なので depth=1）
    const grandchildDepthAfter = await getTabDepth(sidePanelPage, grandchildTab);
    expect(grandchildDepthAfter).toBe(1); // 新しいルート(0) -> 孫(1)
  });

  test('子タブを移動しても元の親タブは移動しないこと', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと複数の子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab1 = await createTab(extensionContext, 'https://www.iana.org');
    const childTab2 = await createTab(extensionContext, 'https://www.w3.org');
    const otherParentTab = await createTab(extensionContext, 'https://developer.mozilla.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab1);
    await assertTabInTree(sidePanelPage, childTab2);
    await assertTabInTree(sidePanelPage, otherParentTab);

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTab1, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab1, parentTab, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, childTab2, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab2, parentTab, { timeout: 5000 });

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

    // 親タブのdepthを取得
    const parentDepthBefore = await parentNode.getAttribute('data-depth');

    // 実行: childTab1を別の親タブにドロップ
    await moveTabToParent(sidePanelPage, childTab1, otherParentTab, serviceWorker);

    // 検証: childTab1が新しい親の子になっている
    await waitForParentChildRelation(extensionContext, childTab1, otherParentTab, { timeout: 5000 });

    // 親タブのdepthが変わっていないこと（親タブは移動していない）
    const parentNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    await expect(parentNodeAfter).toBeVisible({ timeout: 5000 });
    const parentDepthAfter = await parentNodeAfter.getAttribute('data-depth');
    expect(parentDepthAfter).toBe(parentDepthBefore);

    // childTab2は元の親の子のまま
    const parent2 = await getParentTabId(sidePanelPage, childTab2);
    expect(parent2).toBe(parentTab);

    // childTab1は新しい親の子
    const parent1 = await getParentTabId(sidePanelPage, childTab1);
    expect(parent1).toBe(otherParentTab);
  });
});

/**
 * Task 6.1: ドラッグによる親子関係解消の確実な反映
 *
 * Requirements 11.1, 11.3:
 * - 子タブをドラッグして親タブから取り出し兄弟関係にした場合、親子関係が解消された状態が維持される
 * - ドラッグで解消した親子関係が後続の操作で復活しないこと
 */
test.describe('Task 6.1: 親子関係解消の永続化', () => {
  // タイムアウトを延長
  test.setTimeout(120000);

  test('ドラッグで親子関係を解消し、ルートレベルに移動後も状態が維持されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, siblingTab);

    // D&Dで親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

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

    // 子タブの親IDを確認（parentTabの子であること）
    const parentBefore = await getParentTabId(sidePanelPage, childTab);
    expect(parentBefore).toBe(parentTab);

    // 実行: 子タブをルートレベルに移動（siblingTabの上にギャップドロップ）
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);

    // 検証: 子タブの親がnullになっている（ルートレベルに移動された）
    await waitForTabNoParent(extensionContext, childTab, { timeout: 5000 });

    // 子タブのdepthが0（ルートレベル）になっていることを確認
    const childDepthAfter = await getTabDepth(sidePanelPage, childTab);
    expect(childDepthAfter).toBe(0);

    // 親タブの親IDがnullのままであることを確認（元子タブはルートレベル）
    const parentAfter = await getParentTabId(sidePanelPage, childTab);
    expect(parentAfter).toBeNull();
  });

  test('親子関係解消後、元子タブからの操作で元親タブの子にならないこと', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    const targetTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, targetTab);

    // D&Dで親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

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

    // 実行: 子タブをルートレベルに移動
    await moveTabToRoot(sidePanelPage, childTab, targetTab);

    // 検証: 子タブの親がnullになっている
    await waitForTabNoParent(extensionContext, childTab, { timeout: 5000 });

    // 元子タブを別のタブの子にドラッグ
    await moveTabToParent(sidePanelPage, childTab, targetTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, targetTab, { timeout: 5000 });

    // 検証: 元子タブは新しい親（targetTab）の子であり、元親（parentTab）の子ではない
    const newParent = await getParentTabId(sidePanelPage, childTab);
    expect(newParent).toBe(targetTab);
    expect(newParent).not.toBe(parentTab);
  });

  test('親子関係解消が永続化され、ストレージに正しく反映されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, siblingTab);

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

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

    // ストレージで親子関係が保存されていることを確認
    const parentIdBefore = await serviceWorker.evaluate(async (ids) => {
      interface TreeNode {
        id: string;
        tabId: number;
        parentId: string | null;
      }
      interface LocalTreeState {
        tabToNode: Record<number, string>;
        nodes: Record<string, TreeNode>;
      }
      const { childId, parentId } = ids;
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as LocalTreeState | undefined;
      if (!treeState?.nodes || !treeState?.tabToNode) return null;

      const childNodeId = treeState.tabToNode[childId];
      const parentNodeId = treeState.tabToNode[parentId];
      if (!childNodeId || !parentNodeId) return null;

      const childNode = treeState.nodes[childNodeId];
      return childNode?.parentId ?? null;
    }, { childId: childTab, parentId: parentTab });

    // 親子関係が設定されていることを確認
    expect(parentIdBefore).not.toBeNull();

    // 実行: 子タブをルートレベルに移動
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);

    // 検証: ストレージで親子関係が解消されていることを確認
    await waitForTabNoParent(extensionContext, childTab, { timeout: 5000 });

    const parentIdAfter = await serviceWorker.evaluate(async (childId) => {
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
      if (!treeState?.nodes || !treeState?.tabToNode) return 'NOT_FOUND';

      const childNodeId = treeState.tabToNode[childId];
      if (!childNodeId) return 'NODE_NOT_FOUND';

      const childNode = treeState.nodes[childNodeId];
      return childNode?.parentId ?? null;
    }, childTab);

    // 親IDがnullになっていることを確認（ストレージで永続化されている）
    expect(parentIdAfter).toBeNull();
  });
});

/**
 * Task 6.2: 元子タブからの新規タブ作成
 *
 * Requirement 11.2:
 * - 親子関係解消後の元子タブからリンクを開いた場合、元子タブの子として作成されること
 * - 元親タブの子タブにならないことを検証
 */
test.describe('Task 6.2: 元子タブからの新規タブ作成', () => {
  // タイムアウトを延長
  test.setTimeout(120000);

  test('親子関係解消後、元子タブからリンクを開くと元子タブの子タブになること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, siblingTab);

    // D&Dで親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

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

    // 子タブの親がparentTabであることを確認
    const childParentBefore = await getParentTabId(sidePanelPage, childTab);
    expect(childParentBefore).toBe(parentTab);

    // 実行1: 子タブをルートレベルに移動（親子関係を解消）
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await waitForTabNoParent(extensionContext, childTab, { timeout: 5000 });

    // 元子タブがルートレベルになったことを確認
    const childDepthAfter = await getTabDepth(sidePanelPage, childTab);
    expect(childDepthAfter).toBe(0);

    // 実行2: 元子タブから新しいタブを作成（リンクを開くシミュレーション）
    // openerTabIdを指定してタブを作成することで、リンククリックをシミュレート
    const newTab = await createTab(extensionContext, 'https://developer.mozilla.org', childTab);

    // 新しいタブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, newTab);

    // 検証: 新しいタブが元子タブ（childTab）の子になっていること
    await waitForParentChildRelation(extensionContext, newTab, childTab, { timeout: 5000 });

    // 元子タブを展開
    const childNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`).first();
    const childExpandButton = childNodeAfter.locator('[data-testid="expand-button"]');
    if ((await childExpandButton.count()) > 0) {
      const isExpanded = await childNodeAfter.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await childExpandButton.first().click();
        await expect(childNodeAfter).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
      }
    }

    // 新しいタブが表示されることを確認
    const newTabNode = sidePanelPage.locator(`[data-testid="tree-node-${newTab}"]`).first();
    await expect(newTabNode).toBeVisible({ timeout: 5000 });

    // 新しいタブの親が元子タブ（childTab）であること
    const newTabParent = await getParentTabId(sidePanelPage, newTab);
    expect(newTabParent).toBe(childTab);

    // 新しいタブの親が元親タブ（parentTab）ではないこと
    expect(newTabParent).not.toBe(parentTab);

    // 新しいタブのdepthが1（childTabがルートレベルなので、その子はdepth=1）
    const newTabDepth = await getTabDepth(sidePanelPage, newTab);
    expect(newTabDepth).toBe(1);
  });

  test('親子関係解消後の元子タブからリンクを開いても元親タブの子にならないこと', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, siblingTab);

    // D&Dで親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

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

    // 実行1: 子タブをルートレベルに移動（親子関係を解消）
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await waitForTabNoParent(extensionContext, childTab, { timeout: 5000 });

    // 実行2: 元子タブから複数の新しいタブを作成
    const newTab1 = await createTab(extensionContext, 'https://developer.mozilla.org', childTab);
    const newTab2 = await createTab(extensionContext, 'https://www.wikipedia.org', childTab);

    // 新しいタブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, newTab1);
    await assertTabInTree(sidePanelPage, newTab2);

    // 検証: 新しいタブはすべて元子タブ（childTab）の子であること
    await waitForParentChildRelation(extensionContext, newTab1, childTab, { timeout: 5000 });
    await waitForParentChildRelation(extensionContext, newTab2, childTab, { timeout: 5000 });

    // 元親タブの子孫を取得して、新しいタブが含まれていないことを確認
    const parentChildren = await serviceWorker.evaluate(async (parentTabId) => {
      interface TreeNode {
        id: string;
        tabId: number;
        parentId: string | null;
        children: TreeNode[];
      }
      interface LocalTreeState {
        tabToNode: Record<number, string>;
        nodes: Record<string, TreeNode>;
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as LocalTreeState | undefined;
      if (!treeState?.nodes || !treeState?.tabToNode) return [];

      const parentNodeId = treeState.tabToNode[parentTabId];
      if (!parentNodeId) return [];

      // 親ノードの子孫タブIDを再帰的に収集
      const collectDescendants = (nodeId: string): number[] => {
        const node = treeState.nodes[nodeId];
        if (!node) return [];

        const result: number[] = [];
        // このノードの子を探す
        for (const [, n] of Object.entries(treeState.nodes)) {
          if (n.parentId === nodeId) {
            result.push(n.tabId);
            result.push(...collectDescendants(n.id));
          }
        }
        return result;
      };

      return collectDescendants(parentNodeId);
    }, parentTab);

    // 元親タブの子孫に新しいタブが含まれていないこと
    expect(parentChildren).not.toContain(newTab1);
    expect(parentChildren).not.toContain(newTab2);
  });
});

/**
 * Task 6.3: E2Eテスト追加：親子関係解消の永続化
 *
 * Requirements 11.4, 11.5, 11.6:
 * - 親子関係解消の永続化 shall E2Eテストで検証されること
 * - 親子関係E2Eテスト shall 元子タブからの新規タブ作成を含めて検証すること
 * - 親子関係E2Eテスト shall `--repeat-each=10`で安定して通過すること
 *
 * このテストスイートでは、親子関係解消の永続化に関する包括的なテストを追加します。
 */
test.describe('Task 6.3: 親子関係解消の永続化（包括的テスト）', () => {
  // タイムアウトを延長
  test.setTimeout(120000);

  test('複数回の親子関係解消と再構築が一貫して動作すること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, siblingTab);

    // ヘルパー関数: 親タブを展開
    const expandParent = async (tabId: number) => {
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      if ((await expandButton.count()) > 0) {
        const isExpanded = await parentNode.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await expandButton.first().click();
          await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }
    };

    // 1回目: 親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });
    await expandParent(parentTab);

    // 親子関係が正しく設定されたことを確認
    let childParent = await getParentTabId(sidePanelPage, childTab);
    expect(childParent).toBe(parentTab);

    // 1回目: 親子関係を解消
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await waitForTabNoParent(extensionContext, childTab, { timeout: 5000 });

    // 親子関係が解消されたことを確認
    childParent = await getParentTabId(sidePanelPage, childTab);
    expect(childParent).toBeNull();
    let childDepth = await getTabDepth(sidePanelPage, childTab);
    expect(childDepth).toBe(0);

    // 2回目: 再度親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });
    await expandParent(parentTab);

    // 再び親子関係が正しく設定されたことを確認
    childParent = await getParentTabId(sidePanelPage, childTab);
    expect(childParent).toBe(parentTab);

    // 2回目: 再度親子関係を解消
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await waitForTabNoParent(extensionContext, childTab, { timeout: 5000 });

    // 再び親子関係が解消されたことを確認
    childParent = await getParentTabId(sidePanelPage, childTab);
    expect(childParent).toBeNull();
    childDepth = await getTabDepth(sidePanelPage, childTab);
    expect(childDepth).toBe(0);

    // ストレージでも親子関係が解消されていることを確認
    const parentIdInStorage = await serviceWorker.evaluate(async (childId) => {
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
      if (!treeState?.nodes || !treeState?.tabToNode) return 'NOT_FOUND';

      const childNodeId = treeState.tabToNode[childId];
      if (!childNodeId) return 'NODE_NOT_FOUND';

      const childNode = treeState.nodes[childNodeId];
      return childNode?.parentId ?? null;
    }, childTab);

    expect(parentIdInStorage).toBeNull();
  });

  test('親子関係解消後の元子タブから作成した新規タブがさらに子タブを持てること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, siblingTab);

    // ヘルパー関数: タブを展開
    const expandTab = async (tabId: number) => {
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const expandButton = tabNode.locator('[data-testid="expand-button"]');
      if ((await expandButton.count()) > 0) {
        const isExpanded = await tabNode.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await expandButton.first().click();
          await expect(tabNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }
    };

    // 親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });
    await expandTab(parentTab);

    // 親子関係を解消（childTabをルートレベルに移動）
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await waitForTabNoParent(extensionContext, childTab, { timeout: 5000 });

    // 元子タブがルートレベルになったことを確認
    const childDepth = await getTabDepth(sidePanelPage, childTab);
    expect(childDepth).toBe(0);

    // 元子タブから新規タブを作成（第1世代の子タブ）
    const newTab1 = await createTab(extensionContext, 'https://developer.mozilla.org', childTab);
    await assertTabInTree(sidePanelPage, newTab1);
    await waitForParentChildRelation(extensionContext, newTab1, childTab, { timeout: 5000 });
    await expandTab(childTab);

    // 新規タブが元子タブの子になっていることを確認
    const newTab1Parent = await getParentTabId(sidePanelPage, newTab1);
    expect(newTab1Parent).toBe(childTab);
    const newTab1Depth = await getTabDepth(sidePanelPage, newTab1);
    expect(newTab1Depth).toBe(1);

    // 新規タブからさらに新規タブを作成（第2世代の子タブ、孫タブ）
    const grandchildTab = await createTab(extensionContext, 'https://www.wikipedia.org', newTab1);
    await assertTabInTree(sidePanelPage, grandchildTab);
    await waitForParentChildRelation(extensionContext, grandchildTab, newTab1, { timeout: 5000 });
    await expandTab(newTab1);

    // 孫タブが新規タブ（newTab1）の子になっていることを確認
    const grandchildParent = await getParentTabId(sidePanelPage, grandchildTab);
    expect(grandchildParent).toBe(newTab1);
    const grandchildDepth = await getTabDepth(sidePanelPage, grandchildTab);
    expect(grandchildDepth).toBe(2);

    // 全てのタブが元親タブ（parentTab）とは無関係であることを確認
    const parentDescendants = await serviceWorker.evaluate(async (parentTabId) => {
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
      if (!treeState?.nodes || !treeState?.tabToNode) return [];

      const parentNodeId = treeState.tabToNode[parentTabId];
      if (!parentNodeId) return [];

      // 親ノードの子孫タブIDを再帰的に収集
      const collectDescendants = (nodeId: string): number[] => {
        const resultIds: number[] = [];
        for (const [, n] of Object.entries(treeState.nodes)) {
          if (n.parentId === nodeId) {
            resultIds.push(n.tabId);
            resultIds.push(...collectDescendants(n.id));
          }
        }
        return resultIds;
      };

      return collectDescendants(parentNodeId);
    }, parentTab);

    // 元親タブの子孫に、元子タブ、新規タブ、孫タブが含まれていないこと
    expect(parentDescendants).not.toContain(childTab);
    expect(parentDescendants).not.toContain(newTab1);
    expect(parentDescendants).not.toContain(grandchildTab);
  });

  test('親子関係解消後も別のタブへの親子関係構築が正しく動作すること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 複数のタブを作成
    const parentTab1 = await createTab(extensionContext, 'https://example.com');
    const parentTab2 = await createTab(extensionContext, 'https://www.iana.org');
    const childTab = await createTab(extensionContext, 'https://www.w3.org');
    const siblingTab = await createTab(extensionContext, 'https://developer.mozilla.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab1);
    await assertTabInTree(sidePanelPage, parentTab2);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, siblingTab);

    // ヘルパー関数: タブを展開
    const expandTab = async (tabId: number) => {
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const expandButton = tabNode.locator('[data-testid="expand-button"]');
      if ((await expandButton.count()) > 0) {
        const isExpanded = await tabNode.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await expandButton.first().click();
          await expect(tabNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }
    };

    // 1. childTabをparentTab1の子にする
    await moveTabToParent(sidePanelPage, childTab, parentTab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab1, { timeout: 5000 });
    await expandTab(parentTab1);

    let childParent = await getParentTabId(sidePanelPage, childTab);
    expect(childParent).toBe(parentTab1);

    // 2. 親子関係を解消（ルートレベルに移動）
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await waitForTabNoParent(extensionContext, childTab, { timeout: 5000 });

    childParent = await getParentTabId(sidePanelPage, childTab);
    expect(childParent).toBeNull();

    // 3. childTabを別の親（parentTab2）の子にする
    await moveTabToParent(sidePanelPage, childTab, parentTab2, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab2, { timeout: 5000 });
    await expandTab(parentTab2);

    // 親子関係が正しく設定されたことを確認（UIレベル）
    childParent = await getParentTabId(sidePanelPage, childTab);
    expect(childParent).toBe(parentTab2);
    expect(childParent).not.toBe(parentTab1);

    const childDepth = await getTabDepth(sidePanelPage, childTab);
    expect(childDepth).toBe(1);
  });
});
