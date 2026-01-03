/**
 * ドラッグ&ドロップによるサブツリー移動テスト
 *
 * サブツリードラッグ移動のE2Eテスト
 *
 * このテストスイートでは、子タブを持つ親タブのドラッグ移動を検証します。
 * - 折りたたみ状態でのサブツリー移動（非表示の子タブも含めて移動）
 * - 展開状態でのサブツリー移動（可視の子タブも含めて移動）
 * - 下方向への移動で正しい位置に配置されること
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { reorderTabs, moveTabToParent } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForCondition } from './utils/polling-utils';

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

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: ツリー構造を作成
    // Tab1 (サブツリーの親)
    //   - Child1
    //   - Child2
    // Tab2 (移動先の目印)
    // Tab3 (別のルートタブ)
    const tab1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    const tab3 = await createTab(extensionContext, 'https://github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

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

    // 実行: 折りたたまれた親タブ（tab1）をtab3の後にドラッグ
    await reorderTabs(sidePanelPage, tab1, tab3, 'after');

    // ストレージへの反映を待機
    const tabIds1 = [tab1, child1, child2, tab2, tab3];
    await waitForCondition(async () => {
      const result = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const storageResult = await chrome.storage.local.get('tree_state');
        const treeState = storageResult.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          return tabIds.every(id => treeState.tabToNode![id]);
        }
        return false;
      }, tabIds1);
      return result;
    }, { timeout: 1500, interval: 50 });

    // 検証: サブツリー全体が移動したことを確認
    // 折りたたみ状態のため、子タブは表示されていない
    // 新しい順序: pseudoSidePanelTabId, tab2, tab3, tab1（サブツリー）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);
  });

  test('展開された親タブをドラッグした場合、可視の子タブも含めてサブツリー全体が移動すること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: ツリー構造を作成
    // Tab1 (サブツリーの親)
    //   - Child1
    //   - Child2
    // Tab2 (移動先の目印)
    const tab1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: tab2, depth: 0 },
    ], 0);

    // 親タブを展開して子タブを表示
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    // 実行: 展開された親タブ（tab1）をtab2の後にドラッグ
    await reorderTabs(sidePanelPage, tab1, tab2, 'after');

    // ストレージへの反映を待機
    const tabIds2 = [tab1, child1, child2, tab2];
    await waitForCondition(async () => {
      const result = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const storageResult = await chrome.storage.local.get('tree_state');
        const treeState = storageResult.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          return tabIds.every(id => treeState.tabToNode![id]);
        }
        return false;
      }, tabIds2);
      return result;
    }, { timeout: 1500, interval: 50 });

    // 検証: サブツリー全体が移動したことを確認
    // 新しい順序: pseudoSidePanelTabId, tab2, tab1（親）, child1, child2
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);
  });

  test('サブツリーを下方向にドラッグした場合、正しい移動数で正しい位置に配置されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 複数のルートタブとサブツリーを作成
    // Tab1 (サブツリーの親)
    //   - Child1
    //   - Child2
    // Tab2
    // Tab3
    // Tab4 (最後のタブ、移動先)
    const tab1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    const tab3 = await createTab(extensionContext, 'https://github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    const tab4 = await createTab(extensionContext, 'https://httpbin.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab4, depth: 0 },
    ], 0);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab4, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab4, depth: 0 },
    ], 0);

    // 親タブを展開
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    // 実行: サブツリー（tab1 + 子タブ2つ）をtab4の後にドラッグ
    // サブツリーのサイズ（3ノード）を考慮した移動が必要
    await reorderTabs(sidePanelPage, tab1, tab4, 'after');

    // ストレージへの反映を待機
    const tabIds3 = [tab1, child1, child2, tab2, tab3, tab4];
    await waitForCondition(async () => {
      const result = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const storageResult = await chrome.storage.local.get('tree_state');
        const treeState = storageResult.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          return tabIds.every(id => treeState.tabToNode![id]);
        }
        return false;
      }, tabIds3);
      return result;
    }, { timeout: 1500, interval: 50 });

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
    // 新しい順序: pseudoSidePanelTabId, tab2, tab3, tab4, tab1（親）, child1, child2
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab4, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);
  });

  test('深いネストのサブツリーを移動した場合、全ての子孫が一緒に移動すること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 深いネストのツリー構造を作成
    // Tab1 (サブツリーのルート)
    //   - Child1
    //     - GrandChild1
    // Tab2 (移動先)
    const tab1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const grandChild1 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: grandChild1, depth: 0 },
    ], 0);

    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: grandChild1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    // D&Dで親子関係を構築（3レベルのネスト）
    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: grandChild1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, grandChild1, child1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: grandChild1, depth: 2 },
      { tabId: tab2, depth: 0 },
    ], 0);

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

    // 実行: tab1（サブツリー全体）をtab2の後にドラッグ
    await reorderTabs(sidePanelPage, tab1, tab2, 'after');

    // ストレージへの反映を待機
    const tabIds4 = [tab1, child1, grandChild1, tab2];
    await waitForCondition(async () => {
      const result = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const storageResult = await chrome.storage.local.get('tree_state');
        const treeState = storageResult.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          return tabIds.every(id => treeState.tabToNode![id]);
        }
        return false;
      }, tabIds4);
      return result;
    }, { timeout: 1500, interval: 50 });

    // 移動後、すべてのノードを再展開（ドラッグ操作で折りたたまれる可能性があるため）
    await expandNode(tab1);
    await expandNode(child1);

    // 検証: サブツリー全体（3レベル）が移動したことを確認
    // 新しい順序: pseudoSidePanelTabId, tab2, tab1（親）, child1, grandChild1
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: grandChild1, depth: 2 },
    ], 0);
  });
});
