/**
 * 子タブの独立ドラッグ操作テスト
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
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { moveTabToParent, moveTabToRoot } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForCondition } from './utils/polling-utils';
import type { Worker } from '@playwright/test';

test.describe('子タブの独立ドラッグ操作', () => {
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

    // windowIdとpseudoSidePanelTabIdを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと子タブ、別の親タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const otherParentTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: otherParentTab, depth: 0 },
    ], 0);

    // D&Dで親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: otherParentTab, depth: 0 },
    ], 0);

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

    // 実行: 子タブを別の親タブにドロップ
    await moveTabToParent(sidePanelPage, childTab, otherParentTab, serviceWorker);

    // 検証: 子タブが新しい親の子になっている（元の親タブのdepthも変わっていないことを確認）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: otherParentTab, depth: 0 },
      { tabId: childTab, depth: 1 },
    ], 0);

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

  test('子タブを親から切り離して別の位置にドロップできること', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 2つの親タブとそれぞれに子タブを作成
    const parentTab1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
    ], 0);

    const childTab1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab1, depth: 0 },
    ], 0);

    const parentTab2 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    const childTab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab2, depth: 0 },
    ], 0);

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTab1, parentTab1, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab1, depth: 1 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab2, parentTab2, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab1, depth: 1 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab2, depth: 1 },
    ], 0);

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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab2, depth: 1 },
      { tabId: childTab1, depth: 1 },
    ], 0);

    // 新しい親タブを展開
    await expandAllParents();

    // childTab1が新しい親の配下に表示されていることを確認
    const childNode1After = sidePanelPage.locator(`[data-testid="tree-node-${childTab1}"]`).first();
    await expect(childNode1After).toBeVisible({ timeout: 5000 });
  });

  test('孫タブをドラッグして別の親の子として移動できること', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 3階層のタブ構造を作成
    // ルート -> 親 -> 孫
    const rootTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const grandchildTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: grandchildTab, depth: 0 },
    ], 0);

    const otherRootTab = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: grandchildTab, depth: 0 },
      { tabId: otherRootTab, depth: 0 },
    ], 0);

    // D&Dで階層構造を構築
    await moveTabToParent(sidePanelPage, parentTab, rootTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab, depth: 1 },
      { tabId: grandchildTab, depth: 0 },
      { tabId: otherRootTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, grandchildTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab, depth: 1 },
      { tabId: grandchildTab, depth: 2 },
      { tabId: otherRootTab, depth: 0 },
    ], 0);

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

    // 実行: 孫タブを別のルートタブにドロップ
    await moveTabToParent(sidePanelPage, grandchildTab, otherRootTab, serviceWorker);

    // 検証: 孫タブが新しい親の子になっている（depth=1に変わっている）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab, depth: 1 },
      { tabId: otherRootTab, depth: 0 },
      { tabId: grandchildTab, depth: 1 },
    ], 0);

    // 新しい親タブを展開
    await expandAll(otherRootTab);

    // 孫タブが新しい親の配下に表示されていることを確認
    const grandchildNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${grandchildTab}"]`).first();
    await expect(grandchildNodeAfter).toBeVisible({ timeout: 5000 });
  });

  test('子タブを移動しても元の親タブは移動しないこと', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと複数の子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab1, depth: 0 },
    ], 0);

    const childTab2 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab1, depth: 0 },
      { tabId: childTab2, depth: 0 },
    ], 0);

    const otherParentTab = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab1, depth: 0 },
      { tabId: childTab2, depth: 0 },
      { tabId: otherParentTab, depth: 0 },
    ], 0);

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTab1, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab1, depth: 1 },
      { tabId: childTab2, depth: 0 },
      { tabId: otherParentTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab2, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab1, depth: 1 },
      { tabId: childTab2, depth: 1 },
      { tabId: otherParentTab, depth: 0 },
    ], 0);

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

    // 実行: childTab1を別の親タブにドロップ
    await moveTabToParent(sidePanelPage, childTab1, otherParentTab, serviceWorker);

    // 検証: childTab1が新しい親の子になっている（元の親タブは移動していない、childTab2は元の親の子のまま）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab2, depth: 1 },
      { tabId: otherParentTab, depth: 0 },
      { tabId: childTab1, depth: 1 },
    ], 0);
  });
});

/**
 * ドラッグによる親子関係解消の確実な反映
 *
 * - 子タブをドラッグして親タブから取り出し兄弟関係にした場合、親子関係が解消された状態が維持される
 * - ドラッグで解消した親子関係が後続の操作で復活しないこと
 */
test.describe('親子関係解消の永続化', () => {
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

    // windowIdとpseudoSidePanelTabIdを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // D&Dで親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

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

    // 実行: 子タブをルートレベルに移動（siblingTabの上にギャップドロップ）
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);

    // 検証: 子タブの親がnullになっている（ルートレベルに移動された、depth=0）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);
  });

  test('親子関係解消後、元子タブからの操作で元親タブの子にならないこと', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const targetTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: targetTab, depth: 0 },
    ], 0);

    // D&Dで親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: targetTab, depth: 0 },
    ], 0);

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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: targetTab, depth: 0 },
    ], 0);

    // 元子タブを別のタブの子にドラッグ
    await moveTabToParent(sidePanelPage, childTab, targetTab, serviceWorker);

    // 検証: 元子タブは新しい親（targetTab）の子であり、元親（parentTab）の子ではない
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: targetTab, depth: 0 },
      { tabId: childTab, depth: 1 },
    ], 0);
  });

  test('親子関係解消が永続化され、ストレージに正しく反映されること', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

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
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);

    // 検証: ストレージで親子関係が解消されていることを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // ストレージで親子関係が解消されていることをポーリングで確認
    await waitForStorageParentNull(serviceWorker, childTab);
  });
});

/**
 * ストレージで親子関係が解消されるまでポーリングで待機
 */
async function waitForStorageParentNull(serviceWorker: Worker, childTabId: number): Promise<void> {
  await waitForCondition(
    async () => {
      interface TreeNode {
        id: string;
        tabId: number;
        parentId: string | null;
      }
      interface LocalTreeState {
        tabToNode: Record<number, string>;
        nodes: Record<string, TreeNode>;
      }
      const treeState = await serviceWorker.evaluate(async (childId) => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state as LocalTreeState | undefined;
      }, childTabId);
      if (treeState?.nodes && treeState?.tabToNode) {
        const childNodeId = treeState.tabToNode[childTabId];
        if (childNodeId) {
          const childNode = treeState.nodes[childNodeId];
          if (childNode && childNode.parentId === null) {
            return true;
          }
        }
      }
      return false;
    },
    { timeout: 5000, interval: 50, timeoutMessage: `Parent of tab ${childTabId} was not set to null` }
  );
}

/**
 * 元子タブからの新規タブ作成
 *
 * - 親子関係解消後の元子タブからリンクを開いた場合、元子タブの子として作成されること
 * - 元親タブの子タブにならないことを検証
 */
test.describe('元子タブからの新規タブ作成', () => {
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

    // windowIdとpseudoSidePanelTabIdを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // D&Dで親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

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
    // 元子タブがルートレベルになったことを確認（depth=0）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // 実行2: 元子タブから新しいタブを作成（リンクを開くシミュレーション）
    // openerTabIdを指定してタブを作成することで、リンククリックをシミュレート
    const newTab = await createTab(extensionContext, 'https://developer.mozilla.org', childTab);
    // 検証: 新しいタブが元子タブ（childTab）の子になっていること（depth=1で元親タブではない）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: newTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

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
  });

  test('親子関係解消後の元子タブからリンクを開いても元親タブの子にならないこと', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // D&Dで親子関係を作成（childTabをparentTabの子にする）
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // 実行2: 元子タブから複数の新しいタブを作成
    const newTab1 = await createTab(extensionContext, 'https://developer.mozilla.org', childTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: newTab1, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    const newTab2 = await createTab(extensionContext, 'https://www.wikipedia.org', childTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: newTab1, depth: 1 },
      { tabId: newTab2, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // assertTabStructureで新しいタブがchildTabの子であることを既に検証済み
    // （newTab1, newTab2がdepth: 1でchildTabの直後に配置されている）
  });
});

/**
 * E2Eテスト追加：親子関係解消の永続化
 *
 * このテストスイートでは、親子関係解消の永続化に関する包括的なテストを追加します。
 */
test.describe('親子関係解消の永続化（包括的テスト）', () => {
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

    // windowIdとpseudoSidePanelTabIdを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

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

    await expandParent(parentTab);
    // assertTabStructureでchildTabがdepth: 1であることを検証（親子関係が設定されている）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // 1回目: 親子関係を解消
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    // assertTabStructureでchildTabがdepth: 0であることを検証（親子関係が解消されている）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // 2回目: 再度親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await expandParent(parentTab);
    // assertTabStructureでchildTabがdepth: 1であることを検証（再び親子関係が設定されている）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // 2回目: 再度親子関係を解消
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    // assertTabStructureでchildTabがdepth: 0であることを検証（再び親子関係が解消されている）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // ストレージでも親子関係が解消されていることをポーリングで確認
    await waitForStorageParentNull(serviceWorker, childTab);
  });

  test('親子関係解消後の元子タブから作成した新規タブがさらに子タブを持てること', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

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

    await expandTab(parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // 親子関係を解消（childTabをルートレベルに移動）
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    // assertTabStructureでchildTabがdepth: 0であることを検証（ルートレベルになっている）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // 元子タブから新規タブを作成（第1世代の子タブ）
    const newTab1 = await createTab(extensionContext, 'https://developer.mozilla.org', childTab);
    // assertTabStructureでnewTab1がchildTabの直後にdepth: 1で配置されていることを検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: newTab1, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await expandTab(childTab);

    // 新規タブからさらに新規タブを作成（第2世代の子タブ、孫タブ）
    const grandchildTab = await createTab(extensionContext, 'https://www.wikipedia.org', newTab1);
    // assertTabStructureでgrandchildTabがnewTab1の直後にdepth: 2で配置されていることを検証
    // これにより、childTab -> newTab1 -> grandchildTab の階層構造が確認できる
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: newTab1, depth: 1 },
      { tabId: grandchildTab, depth: 2 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await expandTab(newTab1);

    // assertTabStructureで全体構造を検証済み
    // parentTabがdepth: 0で子を持たないことはchildTab, newTab1, grandchildTabが
    // 別の階層構造（childTab -> newTab1 -> grandchildTab）にいることで確認済み
  });

  test('親子関係解消後も別のタブへの親子関係構築が正しく動作すること', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 複数のタブを作成
    const parentTab1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
    ], 0);

    const parentTab2 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

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

    await expandTab(parentTab1);
    // assertTabStructureでchildTabがparentTab1の直後にdepth: 1で配置されていることを検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: parentTab2, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // 2. 親子関係を解消（ルートレベルに移動）
    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    // assertTabStructureでchildTabがdepth: 0であることを検証（ルートレベルになっている）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    // 3. childTabを別の親（parentTab2）の子にする
    await moveTabToParent(sidePanelPage, childTab, parentTab2, serviceWorker);

    await expandTab(parentTab2);
    // assertTabStructureでchildTabがparentTab2の直後にdepth: 1で配置されていることを検証
    // parentTab1の子ではないことは、childTabがparentTab2の直後にあることで確認できる
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);
  });
});
