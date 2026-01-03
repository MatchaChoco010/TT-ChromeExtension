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
import { createTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, closeTab } from './utils/tab-utils';
import { moveTabToParent, reorderTabs } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('子タブの並び替え・ドロップ位置テスト', () => {
  // タイムアウトを120秒に設定
  test.setTimeout(120000);

  test.describe('子を親の直上にドロップ → 最後の子として配置', () => {
    test('子タブを親タブの直上にドロップすると、最後の子として配置されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 親タブと2つの子タブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const parentTab = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const child1 = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 0 },
      ], 0);

      const child2 = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 0 },
        { tabId: child2, depth: 0 },
      ], 0);

      // 親子関係を構築: child1, child2 を parentTab の子にする
      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 1 },
        { tabId: child2, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 1 },
        { tabId: child2, depth: 1 },
      ], 0);

      // 親タブを展開
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      const isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 実行: child1を親タブの直上（中央）にドロップ
      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);

      // 検証: child1が最後の子として配置されていること
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child2, depth: 1 },
        { tabId: child1, depth: 1 },
      ], 0);
    });

    test('複数の子がある場合、任意の子を親にドロップすると最後の子になること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 親タブと3つの子タブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const parentTab = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const child1 = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 0 },
      ], 0);

      const child2 = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 0 },
        { tabId: child2, depth: 0 },
      ], 0);

      const child3 = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 0 },
        { tabId: child2, depth: 0 },
        { tabId: child3, depth: 0 },
      ], 0);

      // 親子関係を構築
      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 1 },
        { tabId: child2, depth: 0 },
        { tabId: child3, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 1 },
        { tabId: child2, depth: 1 },
        { tabId: child3, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child3, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 1 },
        { tabId: child2, depth: 1 },
        { tabId: child3, depth: 1 },
      ], 0);

      // 親タブを展開
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      const isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 実行: child1を親にドロップ
      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);

      // 検証: child1が最後の子として配置され、順序は[child2, child3, child1]になること
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child2, depth: 1 },
        { tabId: child3, depth: 1 },
        { tabId: child1, depth: 1 },
      ], 0);
    });
  });

  test.describe('子を隙間にドロップ → 兄弟として配置', () => {
    test('子タブを親の上の隙間にドロップすると、親の兄弟として配置されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 親タブと子タブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const parentTab = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      // 親子関係を構築
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 1 },
      ], 0);

      // 親タブを展開
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      const isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 実行: childTabを親タブの「上の隙間」にドロップ（reorderTabsの'before'）
      await reorderTabs(sidePanelPage, childTab, parentTab, 'before');

      // 検証: 親子関係が解消され、childTabがparentTabより上に配置される
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: childTab, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);
    });

    test('タブAとタブBの間に子タブをドロップすると、その位置に兄弟として配置されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 3つのルートタブと1つの子タブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const tabA = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const parentTab = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      // childTabをparentTabの子にする
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 1 },
      ], 0);

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

      // 実行: childTabをtabAとtabBの間にドロップ
      await reorderTabs(sidePanelPage, childTab, tabB, 'before');

      // 検証: childTabがtabAとtabBの間に配置され、親子関係が解除されていること
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: childTab, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);
    });

    test('リスト末尾の隙間に子タブをドロップすると、末尾に兄弟として配置されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 親タブ、子タブ、末尾用タブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const parentTab = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      const lastTab = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
        { tabId: lastTab, depth: 0 },
      ], 0);

      // childTabをparentTabの子にする
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 1 },
        { tabId: lastTab, depth: 0 },
      ], 0);

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

      // 検証: 親子関係が解消され、childTabがlastTabより下に配置されること
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: lastTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);
    });
  });

  test.describe('複合シナリオ: サブツリーの移動', () => {
    test('サブツリー（親+子）を別の位置にドロップしても、サブツリー内の親子関係は維持されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 構造を作成
      // Tab A (root)
      // Tab B (root) - parent
      //   Tab C (child of B)
      //   Tab D (child of B)
      // Tab E (root)
      const tabA = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      const tabD = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
      ], 0);

      const tabE = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);

      // 親子関係を構築: tabC, tabD を tabB の子にする
      await moveTabToParent(sidePanelPage, tabC, tabB, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 1 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabD, tabB, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 1 },
        { tabId: tabD, depth: 1 },
        { tabId: tabE, depth: 0 },
      ], 0);

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

      // 検証: tabBがtabAより前に表示され、サブツリー内の親子関係が維持されること
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 1 },
        { tabId: tabD, depth: 1 },
        { tabId: tabA, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);
    });

    test('ネストしたサブツリーを親の直上にドロップすると、最後の子として配置されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

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
      const tabA = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      const tabD = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
      ], 0);

      const tabE = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);

      const tabF = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
        { tabId: tabF, depth: 0 },
      ], 0);

      const tabG = await createTab(extensionContext, 'about:blank');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
        { tabId: tabF, depth: 0 },
        { tabId: tabG, depth: 0 },
      ], 0);

      // 親子関係を構築
      // 1. tabB, tabE, tabG を tabA の子にする
      await moveTabToParent(sidePanelPage, tabB, tabA, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
        { tabId: tabF, depth: 0 },
        { tabId: tabG, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabE, tabA, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabE, depth: 1 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabF, depth: 0 },
        { tabId: tabG, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabG, tabA, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabE, depth: 1 },
        { tabId: tabG, depth: 1 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabF, depth: 0 },
      ], 0);

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
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 2 },
        { tabId: tabE, depth: 1 },
        { tabId: tabG, depth: 1 },
        { tabId: tabD, depth: 0 },
        { tabId: tabF, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabD, tabB, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 2 },
        { tabId: tabD, depth: 2 },
        { tabId: tabE, depth: 1 },
        { tabId: tabG, depth: 1 },
        { tabId: tabF, depth: 0 },
      ], 0);

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
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 2 },
        { tabId: tabD, depth: 2 },
        { tabId: tabE, depth: 1 },
        { tabId: tabF, depth: 2 },
        { tabId: tabG, depth: 1 },
      ], 0);

      // tabEを展開
      const tabENode = sidePanelPage.locator(`[data-testid="tree-node-${tabE}"]`).first();
      const expandButtonE = tabENode.locator('[data-testid="expand-button"]');
      await expect(expandButtonE.first()).toBeVisible({ timeout: 5000 });
      const isExpandedE = await tabENode.getAttribute('data-expanded');
      if (isExpandedE !== 'true') {
        await expandButtonE.first().click();
        await expect(tabENode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
      }

      // 実行: tabE（サブツリー）をtabAの直上にドロップ
      await moveTabToParent(sidePanelPage, tabE, tabA, serviceWorker);

      // 検証: tabE が tabA の最後の子として配置され、tabF は依然として tabE の子であること
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 2 },
        { tabId: tabD, depth: 2 },
        { tabId: tabG, depth: 1 },
        { tabId: tabE, depth: 1 },
        { tabId: tabF, depth: 2 },
      ], 0);
    });
  });
});
