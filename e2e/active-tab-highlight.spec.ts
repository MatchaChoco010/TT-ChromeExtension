/**
 * アクティブタブハイライトのE2Eテスト
 *
 * - 通常タブがアクティブになった時に該当タブのみがハイライトされることを検証
 * - ピン留めタブがアクティブになった時に該当ピン留めタブのみがハイライトされ、通常タブのハイライトが解除されることを検証
 * - 通常タブとピン留めタブ間でアクティブタブを切り替えた際に、常に1つのタブのみがハイライト状態であることを検証
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab, pinTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { waitForTabActive } from './utils/polling-utils';

test.describe('アクティブタブのハイライト', () => {
  test.describe('通常タブのハイライト', () => {
    test('通常タブがアクティブになった時に該当タブのみがハイライトされる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 2つの通常タブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const tabId1 = await createTab(extensionContext, 'about:blank', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: tabId1, depth: 0 }], 0);

      const tabId2 = await createTab(extensionContext, 'about:blank', undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      // アクティブなタブ（tabId2）のみがハイライトされていることを確認
      const treeNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const treeNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      // tabId2がハイライトクラスを持つことを確認（TabTreeViewではbg-gray-600）
      await expect(treeNode2).toHaveClass(/bg-gray-600/);
      // tabId1がハイライトクラスを持たないことを確認
      await expect(treeNode1).not.toHaveClass(/bg-gray-600/);

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: tabId2, depth: 0 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
    });

    test('通常タブをクリックするとそのタブのみがハイライトされる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 2つの通常タブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const tabId1 = await createTab(extensionContext, 'about:blank', undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: tabId1, depth: 0 }], 0);

      const tabId2 = await createTab(extensionContext, 'about:blank', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      // 最初はtabId1がハイライト
      const treeNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const treeNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await expect(treeNode1).toHaveClass(/bg-gray-600/);
      await expect(treeNode2).not.toHaveClass(/bg-gray-600/);

      // tabId2をクリック
      await treeNode2.click();

      // tabId2がアクティブになるまで待機
      await waitForTabActive(extensionContext, tabId2);

      // ハイライトが切り替わっていることを確認
      await expect(async () => {
        await expect(treeNode2).toHaveClass(/bg-gray-600/);
        await expect(treeNode1).not.toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: tabId2, depth: 0 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
    });
  });

  test.describe('ピン留めタブのハイライト', () => {
    test('ピン留めタブがアクティブになった時に該当ピン留めタブのみがハイライトされる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // ピン留めタブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const pinnedTabId = await createTab(extensionContext, 'about:blank', undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: pinnedTabId, depth: 0 }], 0);

      // タブをピン留め（ピン留め後はツリーから消えてpinned-tabセクションに移動）
      await pinTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      // ピン留めタブがハイライトされていることを確認（bg-gray-600）
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
      await expect(pinnedTab).toHaveClass(/bg-gray-600/);

      // クリーンアップ（ピン留めタブを閉じる）
      await closeTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めタブをクリックするとそのピン留めタブのみがハイライトされる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 2つのピン留めタブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const pinnedTabId1 = await createTab(extensionContext, 'about:blank', undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: pinnedTabId1, depth: 0 }], 0);

      const pinnedTabId2 = await createTab(extensionContext, 'about:blank', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId1, depth: 0 },
        { tabId: pinnedTabId2, depth: 0 },
      ], 0);

      // タブをピン留め（ピン留め後はツリーから消えてpinned-tabセクションに移動）
      await pinTab(extensionContext, pinnedTabId1);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: pinnedTabId2, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }], 0);

      await pinTab(extensionContext, pinnedTabId2);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }, { tabId: pinnedTabId2 }], 0);

      // 最初はpinnedTabId1がハイライト
      const pinnedTab1 = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId1}"]`);
      const pinnedTab2 = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId2}"]`);
      await expect(pinnedTab1).toHaveClass(/bg-gray-600/);
      await expect(pinnedTab2).not.toHaveClass(/bg-gray-600/);

      // pinnedTabId2をクリック
      await pinnedTab2.click();

      // ハイライトが切り替わっていることを確認
      await expect(async () => {
        await expect(pinnedTab2).toHaveClass(/bg-gray-600/);
        await expect(pinnedTab1).not.toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      // クリーンアップ
      await closeTab(extensionContext, pinnedTabId1);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId2 }], 0);

      await closeTab(extensionContext, pinnedTabId2);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('通常タブとピン留めタブ間のハイライト切替', () => {
    test('通常タブからピン留めタブに切り替えると、通常タブのハイライトが解除され、ピン留めタブがハイライトされる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 通常タブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const normalTabId = await createTab(extensionContext, 'about:blank', undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: normalTabId, depth: 0 }], 0);

      // ピン留めタブを作成（非アクティブ）
      const pinnedTabId = await createTab(extensionContext, 'about:blank', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
      ], 0);

      // タブをピン留め（ピン留め後はツリーから消えてpinned-tabセクションに移動）
      await pinTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: normalTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      const normalTab = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId}"]`);
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);

      // 最初は通常タブがハイライト（TabTreeViewではbg-gray-600）
      await expect(normalTab).toHaveClass(/bg-gray-600/);
      await expect(pinnedTab).not.toHaveClass(/bg-gray-600/);

      // ピン留めタブをクリック
      await pinnedTab.click();

      // ハイライトが切り替わっていることを確認
      await expect(async () => {
        await expect(normalTab).not.toHaveClass(/bg-gray-600/);
        await expect(pinnedTab).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      // クリーンアップ
      await closeTab(extensionContext, normalTabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      await closeTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めタブから通常タブに切り替えると、ピン留めタブのハイライトが解除され、通常タブがハイライトされる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // ピン留めタブを作成（ネットワーク依存を避けるためabout:blankを使用）
      const pinnedTabId = await createTab(extensionContext, 'about:blank', undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: pinnedTabId, depth: 0 }], 0);

      // タブをピン留め（ピン留め後はツリーから消えてpinned-tabセクションに移動）
      await pinTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      // 通常タブを作成（非アクティブ）
      const normalTabId = await createTab(extensionContext, 'about:blank', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: normalTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
      const normalTab = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId}"]`);

      // 最初はピン留めタブがハイライト
      await expect(pinnedTab).toHaveClass(/bg-gray-600/);
      await expect(normalTab).not.toHaveClass(/bg-gray-600/);

      // 通常タブをクリック
      await normalTab.click();

      // ハイライトが切り替わっていることを確認
      await expect(async () => {
        await expect(pinnedTab).not.toHaveClass(/bg-gray-600/);
        await expect(normalTab).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      // クリーンアップ
      await closeTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: normalTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await closeTab(extensionContext, normalTabId);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('常に1つのタブのみがハイライト状態であることを確認（連続切替テスト）', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 初期状態を検証（擬似サイドパネルタブのみ）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 通常タブ2つとピン留めタブ2つを作成（ネットワーク依存を避けるためabout:blankを使用）
      const normalTabId1 = await createTab(extensionContext, 'about:blank', undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: normalTabId1, depth: 0 }], 0);

      const normalTabId2 = await createTab(extensionContext, 'about:blank', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
      ], 0);

      const pinnedTabId1 = await createTab(extensionContext, 'about:blank', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
        { tabId: pinnedTabId1, depth: 0 },
      ], 0);

      const pinnedTabId2 = await createTab(extensionContext, 'about:blank', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
        { tabId: pinnedTabId1, depth: 0 },
        { tabId: pinnedTabId2, depth: 0 },
      ], 0);

      // ピン留め
      await pinTab(extensionContext, pinnedTabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
        { tabId: pinnedTabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }], 0);

      await pinTab(extensionContext, pinnedTabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId1, depth: 0 },
        { tabId: normalTabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }, { tabId: pinnedTabId2 }], 0);

      const normalTab1 = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId1}"]`);
      const normalTab2 = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId2}"]`);
      const pinnedTab1 = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId1}"]`);
      const pinnedTab2 = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId2}"]`);

      // ハイライト数を数えるヘルパー関数
      const countHighlightedTabs = async (): Promise<number> => {
        let count = 0;
        const normalTab1Class = await normalTab1.getAttribute('class') || '';
        const normalTab2Class = await normalTab2.getAttribute('class') || '';
        if (normalTab1Class.includes('bg-gray-600')) count++;
        if (normalTab2Class.includes('bg-gray-600')) count++;
        const pinnedTab1Class = await pinnedTab1.getAttribute('class') || '';
        const pinnedTab2Class = await pinnedTab2.getAttribute('class') || '';
        if (pinnedTab1Class.includes('bg-gray-600')) count++;
        if (pinnedTab2Class.includes('bg-gray-600')) count++;
        return count;
      };

      // 最初はnormalTab1のみがハイライト
      await expect(async () => {
        expect(await countHighlightedTabs()).toBe(1);
      }).toPass({ timeout: 5000 });

      // 切替パターン1: normalTab1 -> pinnedTab1
      await pinnedTab1.click();
      await expect(async () => {
        expect(await countHighlightedTabs()).toBe(1);
        await expect(pinnedTab1).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      // 切替パターン2: pinnedTab1 -> normalTab2
      await normalTab2.click();
      await expect(async () => {
        expect(await countHighlightedTabs()).toBe(1);
        await expect(normalTab2).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      // 切替パターン3: normalTab2 -> pinnedTab2
      await pinnedTab2.click();
      await expect(async () => {
        expect(await countHighlightedTabs()).toBe(1);
        await expect(pinnedTab2).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      // 切替パターン4: pinnedTab2 -> normalTab1
      await normalTab1.click();
      await expect(async () => {
        expect(await countHighlightedTabs()).toBe(1);
        await expect(normalTab1).toHaveClass(/bg-gray-600/);
      }).toPass({ timeout: 5000 });

      // クリーンアップ
      await closeTab(extensionContext, normalTabId1);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }, { tabId: normalTabId2, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }, { tabId: pinnedTabId2 }], 0);

      await closeTab(extensionContext, normalTabId2);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId1 }, { tabId: pinnedTabId2 }], 0);

      await closeTab(extensionContext, pinnedTabId1);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId2 }], 0);

      await closeTab(extensionContext, pinnedTabId2);
      await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });
});
