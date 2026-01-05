/**
 * ピン留めタブセクションのE2Eテスト
 *
 * - ピン留めタブが上部セクションに横並びで表示されることをテストする
 * - ピン留めタブクリックでタブがアクティブ化することをテストする
 * - ピン留めタブと通常タブの間に区切り線が表示されることをテストする
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, pinTab, unpinTab } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { waitForTabActive } from './utils/polling-utils';

test.describe('ピン留めタブセクション', () => {
  test.describe('基本的な表示', () => {
    test('ピン留めタブが上部セクションに横並びで表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 通常タブを作成
      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      // ピン留めタブセクションが横並び表示であることを確認
      const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
      await expect(section).toBeVisible();
      await expect(section).toHaveClass(/flex/);

      // ピン留めタブが表示されることを確認
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTab).toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('複数のピン留めタブが横並びで表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 複数のタブを作成してピン留め
      const tabId1 = await createTab(extensionContext, 'https://example.com/1');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      const tabId2 = await createTab(extensionContext, 'https://example.com/2');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      // タブをピン留め
      await pinTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      // 両方のピン留めタブが表示されることを確認
      const pinnedTab1 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId1}"]`);
      const pinnedTab2 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId2}"]`);
      await expect(pinnedTab1).toBeVisible();
      await expect(pinnedTab2).toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めを解除するとセクションから削除される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブを作成してピン留め
      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      // ピン留めタブが表示されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めを解除
      // 注意: Chromeはピン留め解除時にタブを最初の非ピン留め位置（index 0）に配置する
      // そのためtabIdがpseudoSidePanelTabIdより前に表示される
      await unpinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // ピン留めタブセクションから削除されることを確認
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).not.toBeVisible();
      }).toPass({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('クリック操作', () => {
    test('ピン留めタブをクリックするとタブがアクティブ化する', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 2つのタブを作成（1つはピン留め、1つは通常）
      const pinnedTabId = await createTab(extensionContext, 'https://example.com/pinned', undefined, { active: false });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
      ], 0);

      const normalTabId = await createTab(extensionContext, 'https://example.com/normal', undefined, { active: true });
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      // ピン留めタブが表示されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 通常タブがアクティブであることを確認
      const initialActiveTab = await serviceWorker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id;
      });
      expect(initialActiveTab).toBe(normalTabId);

      // ピン留めタブをクリック
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
      await pinnedTab.click();

      // ピン留めタブがアクティブになるまで待機
      await waitForTabActive(extensionContext, pinnedTabId);

      // ピン留めタブがアクティブになったことを確認
      const newActiveTab = await serviceWorker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id;
      });
      expect(newActiveTab).toBe(pinnedTabId);

      // クリーンアップ
      await closeTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await closeTab(extensionContext, normalTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('区切り線の表示', () => {
    test('ピン留めタブと通常タブの間に区切り線が表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブを作成してピン留め
      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      // ピン留めタブが表示されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 区切り線が表示されることを確認
      const separator = sidePanelPage.locator('[data-testid="pinned-tabs-separator"]');
      await expect(separator).toBeVisible();

      // 区切り線がborder-bクラスを持つことを確認
      await expect(separator).toHaveClass(/border-b/);

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('ピン留めタブが0件の場合は区切り線も非表示になる', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 通常タブを作成（ピン留めなし）
      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // ピン留めタブセクションが表示されないことを確認
      const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
      await expect(section).not.toBeVisible();

      // 区切り線も表示されないことを確認
      const separator = sidePanelPage.locator('[data-testid="pinned-tabs-separator"]');
      await expect(separator).not.toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ピン留めタブとツリービューの統合', () => {
    test('ピン留めタブはピン留めセクションにのみ表示され、ツリービューには表示されない', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブを作成してピン留め
      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      // ピン留めタブセクションに表示されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めタブセクションに表示されることを確認
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTab).toBeVisible();

      // 通常のツリービューには表示されないことを確認
      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNode).not.toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('コンテキストメニュー - ピン留め解除', () => {
    test('ピン留めタブを右クリックするとコンテキストメニューが表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブを作成してピン留め
      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      // ピン留めタブが表示されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めタブを右クリック
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await pinnedTab.click({ button: 'right' });

      // コンテキストメニューが表示されることを確認
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible();

      // 「ピン留めを解除」オプションが表示されることを確認
      const unpinMenuItem = sidePanelPage.locator('[role="menuitem"]').filter({ hasText: 'ピン留めを解除' });
      await expect(unpinMenuItem).toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    test('コンテキストメニューから「ピン留めを解除」を選択するとピン留めが解除される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブを作成してピン留め
      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      // ピン留めタブが表示されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めタブを右クリック
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await pinnedTab.click({ button: 'right' });

      // コンテキストメニューが表示されることを確認
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible();

      // 「ピン留めを解除」をクリック
      // 注意: Chromeはピン留め解除時にタブを最初の非ピン留め位置（index 0）に配置する
      // そのためtabIdがpseudoSidePanelTabIdより前に表示される
      const unpinMenuItem = sidePanelPage.locator('[role="menuitem"]').filter({ hasText: 'ピン留めを解除' });
      await unpinMenuItem.click();
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tabId, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // ピン留めタブセクションから削除されることを確認
      await expect(async () => {
        const pinnedTabAfter = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTabAfter).not.toBeVisible();
      }).toPass({ timeout: 10000 });

      // タブがピン留め解除されたことをAPIで確認
      const isPinned = await serviceWorker.evaluate(async (tabId: number) => {
        const tab = await chrome.tabs.get(tabId);
        return tab.pinned;
      }, tabId);
      expect(isPinned).toBe(false);

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });
});
