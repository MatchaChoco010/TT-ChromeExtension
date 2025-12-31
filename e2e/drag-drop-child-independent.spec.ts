/**
 * Task 16.4: 子タブの独立ドラッグ操作テスト
 *
 * Requirements 3.2.1, 3.2.3:
 * - 子タブをドラッグした際に親タブを追従させず、子タブのみ移動可能にする
 * - 子タブを親から切り離して別の位置にドロップ可能にする
 *
 * このテストスイートでは、親子関係にあるタブの独立ドラッグ操作を検証します。
 * - 子タブのみをドラッグして別の親の子として移動
 * - 子タブを親から切り離してルートレベルに移動
 * - 孫タブをドラッグして別の親の子として移動
 * - 子タブを移動しても元の親タブは移動しないこと
 *
 * Note: 自前D&D実装を使用
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { moveTabToParent, getParentTabId, getTabDepth } from './utils/drag-drop-utils';
import { waitForParentChildRelation } from './utils/polling-utils';

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
