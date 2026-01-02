/**
 * 子タブの並び替え・ドロップ位置E2Eテスト
 *
 * 子を親にドロップした場合の挙動テスト
 *
 * このテストスイートでは、子タブのドラッグ&ドロップ操作を検証します。
 * - 子タブを親の直上にドロップ → 最後の子として配置
 * - 子タブを隙間にドロップ → 兄弟として配置（先頭/間/末尾）
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { moveTabToParent, getParentTabId, reorderTabs, startDrag, dropTab } from './utils/drag-drop-utils';
import { waitForParentChildRelation, waitForTabDepthInUI } from './utils/polling-utils';
import type { Page } from '@playwright/test';

/**
 * タブノードのバウンディングボックスを取得
 */
async function getTabNodeBoundingBox(
  page: Page,
  tabId: number
): Promise<{ x: number; y: number; width: number; height: number }> {
  const node = page.locator(`[data-testid="tree-node-${tabId}"]`).first();
  await node.waitFor({ state: 'visible', timeout: 5000 });
  const box = await node.boundingBox();
  if (!box) {
    throw new Error(`Tab node ${tabId} bounding box not found`);
  }
  return box;
}

/**
 * ストレージから子タブの順序を取得
 */
async function getChildOrder(page: Page, parentTabId: number): Promise<number[]> {
  return await page.evaluate(async (parentId) => {
    interface TreeNode {
      id: string;
      tabId: number;
      parentId: string | null;
      children: TreeNode[];
    }
    interface LocalTreeState {
      nodes: Record<string, TreeNode>;
      tabToNode: Record<number, string>;
    }

    const result = await chrome.storage.local.get('tree_state');
    const treeState = result.tree_state as LocalTreeState | undefined;
    if (!treeState?.nodes || !treeState?.tabToNode) return [];

    const parentNodeId = treeState.tabToNode[parentId];
    if (!parentNodeId) return [];

    const parentNode = treeState.nodes[parentNodeId];
    if (!parentNode) return [];

    // 子ノードのtabIdを順序通りに取得
    return parentNode.children.map(child => child.tabId);
  }, parentTabId);
}

/**
 * ツリー内の表示順序を取得（Y座標ベース）
 */
async function getVisualTabOrder(page: Page, tabIds: number[]): Promise<number[]> {
  const positions: { tabId: number; y: number }[] = [];

  for (const tabId of tabIds) {
    try {
      const box = await getTabNodeBoundingBox(page, tabId);
      positions.push({ tabId, y: box.y });
    } catch {
      // タブが見つからない場合はスキップ
    }
  }

  // Y座標でソートして順序を取得
  positions.sort((a, b) => a.y - b.y);
  return positions.map(p => p.tabId);
}

test.describe('子タブの並び替え・ドロップ位置テスト', () => {
  // タイムアウトを120秒に設定
  test.setTimeout(120000);

  test.describe('子を親の直上にドロップ → 最後の子として配置', () => {
    test('子タブを親タブの直上にドロップすると、最後の子として配置されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 親タブと2つの子タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      const child1 = await createTab(extensionContext, 'https://www.iana.org');
      const child2 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab, 'Example');
      await assertTabInTree(sidePanelPage, child1);
      await assertTabInTree(sidePanelPage, child2);

      // 親子関係を構築: child1, child2 を parentTab の子にする
      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, child1, parentTab, { timeout: 5000 });

      await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, child2, parentTab, { timeout: 5000 });

      // 親タブを展開
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      const isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 初期状態の子の順序を確認
      const initialOrder = await getChildOrder(sidePanelPage, parentTab);
      expect(initialOrder).toContain(child1);
      expect(initialOrder).toContain(child2);

      // 実行: child1を親タブの直上（中央）にドロップ
      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);

      // 検証: child1が最後の子として配置されていること
      await expect(async () => {
        const finalOrder = await getChildOrder(sidePanelPage, parentTab);
        expect(finalOrder.length).toBe(2);
        // child1が最後の子であることを確認
        expect(finalOrder[finalOrder.length - 1]).toBe(child1);
      }).toPass({ timeout: 5000 });

      // 親子関係が維持されていることを確認
      const parent1 = await getParentTabId(sidePanelPage, child1);
      const parent2 = await getParentTabId(sidePanelPage, child2);
      expect(parent1).toBe(parentTab);
      expect(parent2).toBe(parentTab);

      // UI上のdepth属性を検証
      await waitForTabDepthInUI(sidePanelPage, parentTab, 0, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, child1, 1, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, child2, 1, { timeout: 3000 });
    });

    test('複数の子がある場合、任意の子を親にドロップすると最後の子になること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 親タブと3つの子タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      const child1 = await createTab(extensionContext, 'https://www.iana.org');
      const child2 = await createTab(extensionContext, 'https://www.w3.org');
      const child3 = await createTab(extensionContext, 'https://developer.mozilla.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab, 'Example');
      await assertTabInTree(sidePanelPage, child1);
      await assertTabInTree(sidePanelPage, child2);
      await assertTabInTree(sidePanelPage, child3);

      // 親子関係を構築
      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, child1, parentTab, { timeout: 5000 });

      await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, child2, parentTab, { timeout: 5000 });

      await moveTabToParent(sidePanelPage, child3, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, child3, parentTab, { timeout: 5000 });

      // 親タブを展開
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      const isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 実行: child1（最初の子）を親にドロップ
      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);

      // 検証: child1が最後の子として配置されていること
      await expect(async () => {
        const finalOrder = await getChildOrder(sidePanelPage, parentTab);
        expect(finalOrder.length).toBe(3);
        expect(finalOrder[finalOrder.length - 1]).toBe(child1);
        // 他の子の順序は維持される
        expect(finalOrder[0]).toBe(child2);
        expect(finalOrder[1]).toBe(child3);
      }).toPass({ timeout: 5000 });

      // UI上のdepth属性を検証
      await waitForTabDepthInUI(sidePanelPage, parentTab, 0, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, child1, 1, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, child2, 1, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, child3, 1, { timeout: 3000 });
    });
  });

  test.describe('子を隙間にドロップ → 兄弟として配置', () => {
    test('子タブを親の上の隙間にドロップすると、親の兄弟として配置されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 親タブと子タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      const childTab = await createTab(extensionContext, 'https://www.iana.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab, 'Example');
      await assertTabInTree(sidePanelPage, childTab);

      // 親子関係を構築
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

      // 親タブを展開
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      const isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 子タブが親の子であることを確認
      const parentBefore = await getParentTabId(sidePanelPage, childTab);
      expect(parentBefore).toBe(parentTab);

      // 実行: childTabを親タブの「上の隙間」にドロップ（reorderTabsの'before'）
      await reorderTabs(sidePanelPage, childTab, parentTab, 'before');

      // 検証: 親子関係が解消されていること（ルートレベルになる）
      await expect(async () => {
        const parentAfter = await getParentTabId(sidePanelPage, childTab);
        expect(parentAfter).toBeNull();
      }).toPass({ timeout: 5000 });

      // 両方のタブがUIに表示されていること
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first()).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`).first()).toBeVisible();

      // childTabがparentTabより上に表示されていること
      const order = await getVisualTabOrder(sidePanelPage, [parentTab, childTab]);
      expect(order[0]).toBe(childTab);
      expect(order[1]).toBe(parentTab);
    });

    test('タブAとタブBの間に子タブをドロップすると、その位置に兄弟として配置されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのルートタブと1つの子タブを作成
      const tabA = await createTab(extensionContext, 'https://example.com');
      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      const parentTab = await createTab(extensionContext, 'https://www.w3.org');
      const childTab = await createTab(extensionContext, 'https://developer.mozilla.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tabA, 'Example');
      await assertTabInTree(sidePanelPage, tabB);
      await assertTabInTree(sidePanelPage, parentTab);
      await assertTabInTree(sidePanelPage, childTab);

      // childTabをparentTabの子にする
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

      // parentTabを展開
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      if ((await expandButton.count()) > 0) {
        const isExpanded = await parentNode.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await expandButton.first().click();
          await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
        }
      }

      // 初期状態: childTabはparentTabの子
      const parentBefore = await getParentTabId(sidePanelPage, childTab);
      expect(parentBefore).toBe(parentTab);

      // 実行: childTabをtabAとtabBの間にドロップ
      await reorderTabs(sidePanelPage, childTab, tabB, 'before');

      // 検証: childTabが親子関係から解除されてルートレベルになること
      await expect(async () => {
        const parentAfter = await getParentTabId(sidePanelPage, childTab);
        expect(parentAfter).toBeNull();
      }).toPass({ timeout: 5000 });

      // すべてのタブが表示されていること
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabA}"]`).first()).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabB}"]`).first()).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`).first()).toBeVisible();
    });

    test('リスト末尾の隙間に子タブをドロップすると、末尾に兄弟として配置されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 親タブ、子タブ、末尾用タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      const childTab = await createTab(extensionContext, 'https://www.iana.org');
      const lastTab = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab, 'Example');
      await assertTabInTree(sidePanelPage, childTab);
      await assertTabInTree(sidePanelPage, lastTab);

      // childTabをparentTabの子にする
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

      // 親タブを展開
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      if ((await expandButton.count()) > 0) {
        const isExpanded = await parentNode.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await expandButton.first().click();
          await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
        }
      }

      // 実行: childTabをlastTabの後にドロップ
      await reorderTabs(sidePanelPage, childTab, lastTab, 'after');

      // 検証: 親子関係が解消されていること
      await expect(async () => {
        const parentAfter = await getParentTabId(sidePanelPage, childTab);
        expect(parentAfter).toBeNull();
      }).toPass({ timeout: 5000 });

      // childTabがlastTabより下に表示されていること
      const order = await getVisualTabOrder(sidePanelPage, [parentTab, lastTab, childTab]);
      expect(order[order.length - 1]).toBe(childTab);
    });
  });

  test.describe('複合シナリオ: サブツリーの移動', () => {
    test('サブツリー（親+子）を別の位置にドロップしても、サブツリー内の親子関係は維持されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 構造を作成
      // Tab A (root)
      // Tab B (root) - parent
      //   Tab C (child of B)
      //   Tab D (child of B)
      // Tab E (root)
      const tabA = await createTab(extensionContext, 'https://example.com');
      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      const tabC = await createTab(extensionContext, 'https://www.w3.org');
      const tabD = await createTab(extensionContext, 'https://developer.mozilla.org');
      const tabE = await createTab(extensionContext, 'https://httpbin.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tabA, 'Example');
      await assertTabInTree(sidePanelPage, tabB);
      await assertTabInTree(sidePanelPage, tabC);
      await assertTabInTree(sidePanelPage, tabD);
      await assertTabInTree(sidePanelPage, tabE);

      // 親子関係を構築: tabC, tabD を tabB の子にする
      await moveTabToParent(sidePanelPage, tabC, tabB, serviceWorker);
      await waitForParentChildRelation(extensionContext, tabC, tabB, { timeout: 5000 });

      await moveTabToParent(sidePanelPage, tabD, tabB, serviceWorker);
      await waitForParentChildRelation(extensionContext, tabD, tabB, { timeout: 5000 });

      // tabBを展開
      const tabBNode = sidePanelPage.locator(`[data-testid="tree-node-${tabB}"]`).first();
      const expandButton = tabBNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      const isExpanded = await tabBNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(tabBNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 実行: tabB（サブツリー）をtabAの前にドロップ
      await reorderTabs(sidePanelPage, tabB, tabA, 'before');

      // 検証: tabBがtabAより前に表示されていること
      await expect(async () => {
        const order = await getVisualTabOrder(sidePanelPage, [tabA, tabB]);
        expect(order[0]).toBe(tabB);
        expect(order[1]).toBe(tabA);
      }).toPass({ timeout: 5000 });

      // サブツリー内の親子関係が維持されていること
      await expect(async () => {
        const parentC = await getParentTabId(sidePanelPage, tabC);
        const parentD = await getParentTabId(sidePanelPage, tabD);
        expect(parentC).toBe(tabB);
        expect(parentD).toBe(tabB);
      }).toPass({ timeout: 5000 });

      // UI上のdepth属性を検証
      await waitForTabDepthInUI(sidePanelPage, tabB, 0, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, tabC, 1, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, tabD, 1, { timeout: 3000 });
    });

    test('ネストしたサブツリーを親の直上にドロップすると、最後の子として配置されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ユーザー報告のシナリオを再現
      // Tab A (root) - parent
      //   Tab B (child of A)
      //     Tab C (child of B)
      //     Tab D (child of B)
      //   Tab E (child of A) ← ドラッグ対象
      //     Tab F (child of E)
      //   Tab G (child of A)
      //
      // Tab E を Tab A の直上にドロップすると、Tab E と Tab F のサブツリーが
      // Tab A の最後の子になる（Tab G の下に移動する）
      const tabA = await createTab(extensionContext, 'https://example.com');
      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      const tabC = await createTab(extensionContext, 'https://www.w3.org');
      const tabD = await createTab(extensionContext, 'https://developer.mozilla.org');
      const tabE = await createTab(extensionContext, 'https://httpbin.org');
      const tabF = await createTab(extensionContext, 'https://www.google.com');
      const tabG = await createTab(extensionContext, 'https://www.github.com');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tabA, 'Example');
      await assertTabInTree(sidePanelPage, tabB);
      await assertTabInTree(sidePanelPage, tabC);
      await assertTabInTree(sidePanelPage, tabD);
      await assertTabInTree(sidePanelPage, tabE);
      await assertTabInTree(sidePanelPage, tabF);
      await assertTabInTree(sidePanelPage, tabG);

      // 親子関係を構築
      // 1. tabB, tabE, tabG を tabA の子にする
      await moveTabToParent(sidePanelPage, tabB, tabA, serviceWorker);
      await waitForParentChildRelation(extensionContext, tabB, tabA, { timeout: 5000 });

      await moveTabToParent(sidePanelPage, tabE, tabA, serviceWorker);
      await waitForParentChildRelation(extensionContext, tabE, tabA, { timeout: 5000 });

      await moveTabToParent(sidePanelPage, tabG, tabA, serviceWorker);
      await waitForParentChildRelation(extensionContext, tabG, tabA, { timeout: 5000 });

      // tabAを展開
      const tabANode = sidePanelPage.locator(`[data-testid="tree-node-${tabA}"]`).first();
      const expandButtonA = tabANode.locator('[data-testid="expand-button"]');
      await expect(expandButtonA.first()).toBeVisible({ timeout: 5000 });
      const isExpandedA = await tabANode.getAttribute('data-expanded');
      if (isExpandedA !== 'true') {
        await expandButtonA.first().click();
        await expect(tabANode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 2. tabC, tabD を tabB の子にする
      await moveTabToParent(sidePanelPage, tabC, tabB, serviceWorker);
      await waitForParentChildRelation(extensionContext, tabC, tabB, { timeout: 5000 });

      await moveTabToParent(sidePanelPage, tabD, tabB, serviceWorker);
      await waitForParentChildRelation(extensionContext, tabD, tabB, { timeout: 5000 });

      // tabBを展開
      const tabBNode = sidePanelPage.locator(`[data-testid="tree-node-${tabB}"]`).first();
      const expandButtonB = tabBNode.locator('[data-testid="expand-button"]');
      await expect(expandButtonB.first()).toBeVisible({ timeout: 5000 });
      const isExpandedB = await tabBNode.getAttribute('data-expanded');
      if (isExpandedB !== 'true') {
        await expandButtonB.first().click();
        await expect(tabBNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 3. tabF を tabE の子にする
      await moveTabToParent(sidePanelPage, tabF, tabE, serviceWorker);
      await waitForParentChildRelation(extensionContext, tabF, tabE, { timeout: 5000 });

      // tabEを展開
      const tabENode = sidePanelPage.locator(`[data-testid="tree-node-${tabE}"]`).first();
      const expandButtonE = tabENode.locator('[data-testid="expand-button"]');
      await expect(expandButtonE.first()).toBeVisible({ timeout: 5000 });
      const isExpandedE = await tabENode.getAttribute('data-expanded');
      if (isExpandedE !== 'true') {
        await expandButtonE.first().click();
        await expect(tabENode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 現在の順序を確認: tabB, tabE, tabG の順番
      await expect(async () => {
        const order = await getVisualTabOrder(sidePanelPage, [tabB, tabE, tabG]);
        expect(order).toEqual([tabB, tabE, tabG]);
      }).toPass({ timeout: 5000 });

      // 実行: tabE（サブツリー）をtabAの直上にドロップ
      await moveTabToParent(sidePanelPage, tabE, tabA, serviceWorker);

      // 検証: tabE が tabA の最後の子として配置されていること（tabG の下）
      await expect(async () => {
        const parentE = await getParentTabId(sidePanelPage, tabE);
        expect(parentE).toBe(tabA);
      }).toPass({ timeout: 5000 });

      // tabE が tabG より下に表示されていること（順序: tabB, tabG, tabE）
      await expect(async () => {
        const order = await getVisualTabOrder(sidePanelPage, [tabB, tabE, tabG]);
        expect(order).toEqual([tabB, tabG, tabE]);
      }).toPass({ timeout: 5000 });

      // tabF は依然として tabE の子であること
      await expect(async () => {
        const parentF = await getParentTabId(sidePanelPage, tabF);
        expect(parentF).toBe(tabE);
      }).toPass({ timeout: 5000 });

      // UI上のdepth属性を検証
      await waitForTabDepthInUI(sidePanelPage, tabA, 0, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, tabB, 1, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, tabC, 2, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, tabD, 2, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, tabE, 1, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, tabF, 2, { timeout: 3000 });
      await waitForTabDepthInUI(sidePanelPage, tabG, 1, { timeout: 3000 });
    });
  });
});
