/**
 * 休止タブ（Discarded Tab）のグレーアウト表示E2Eテスト
 *
 * このテストスイートでは、以下を検証します:
 * 1. 休止状態のタブがグレーアウト表示されることを検証
 * 2. 休止タブがアクティブ化された際にグレーアウトが解除されることを検証
 *
 * 注意: chrome.tabs.discard() APIはheadlessモードやテスト環境では
 * 正常に動作しない場合があります。その場合、テストはスキップされます。
 *
 * 本機能はユニットテスト（TreeNode.test.tsx）でコンポーネントレベルの
 * 動作が完全に検証されています。
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab, activateTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { waitForCondition, waitForTabStatusComplete } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('休止タブの視覚的区別', () => {
  /**
   * テスト: 休止状態のタブはグレーアウト表示される
   *
   * このテストは、タブを休止状態にした際に、タブタイトルがグレーアウト
   * 表示されることを検証します。
   *
   * 注意: chrome.tabs.discard() APIがテスト環境で動作しない場合は、
   * テストはスキップされます。
   */
  test('休止状態のタブはグレーアウト表示される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // テスト環境を取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // タブを作成（アクティブではない状態で作成）
    const tabId = await createTab(extensionContext, 'https://example.com', undefined, {
      active: false,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    // タブの読み込みが完了するまで待機
    await waitForTabStatusComplete(serviceWorker, tabId);

    // グレーアウト状態確認用のロケータを取得
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // グレーアウトされていない状態を確認（休止前の通常状態）
    // discarded-tab-titleのdata-testidはisDiscarded=trueの場合のみ設定される
    const discardedTitleBefore = tabNode.locator('[data-testid="discarded-tab-title"]');
    await expect(discardedTitleBefore).toHaveCount(0);

    // タブを休止状態にする（chrome.tabs.discard）
    // 注: chrome.tabs.discard()はタブがアクティブではなく、読み込み完了している必要がある
    // また、headlessモードやPlaywright環境では動作しない可能性がある
    let actuallyDiscarded = false;
    try {
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.discard(tabId);
      }, tabId);

      // discardが実際に動作したかをポーリングで確認
      try {
        await waitForCondition(
          async () => {
            const tab = await serviceWorker.evaluate((tabId) => chrome.tabs.get(tabId), tabId);
            return tab.discarded === true;
          },
          { timeout: 3000, interval: 100, timeoutMessage: 'Tab was not discarded' }
        );
        actuallyDiscarded = true;
      } catch {
        actuallyDiscarded = false;
      }
    } catch {
      // Service Workerコンテキストが閉じられた場合（discard操作の副作用）
      // chrome.tabs.discard()の副作用でコンテキストが閉じられることがある
      actuallyDiscarded = false;
    }

    // chrome.tabs.discard()が実際に動作しなかった場合はスキップ
    // コンポーネントの動作はユニットテストで検証済み
    if (!actuallyDiscarded) {
      test.skip(true, 'chrome.tabs.discard() did not work in this environment');
      return;
    }

    // Side PanelのtabInfoMapが更新されるまで待機
    await waitForCondition(
      async () => {
        const hasDiscardedStyle = await sidePanelPage.evaluate((tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const title = node.querySelector('[data-testid="discarded-tab-title"]');
          return title !== null;
        }, tabId);
        return hasDiscardedStyle;
      },
      { timeout: 10000, interval: 100, timeoutMessage: 'Discarded tab style was not applied' }
    );

    // グレーアウトスタイルが適用されていることを確認
    const discardedTitleAfter = tabNode.locator('[data-testid="discarded-tab-title"]');
    await expect(discardedTitleAfter).toBeVisible();

    // text-gray-400 クラス（グレーアウト）が適用されていることを確認
    await expect(discardedTitleAfter).toHaveClass(/text-gray-400/);
  });

  /**
   * テスト: 休止タブをアクティブ化するとグレーアウトが解除される
   *
   * このテストは、休止状態のタブをアクティブ化した際に、グレーアウト
   * 表示が解除されることを検証します。
   *
   * 注意: chrome.tabs.discard() APIがテスト環境で動作しない場合は、
   * テストはスキップされます。
   */
  test('休止タブをアクティブ化するとグレーアウトが解除される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // テスト環境を取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // タブを作成（アクティブではない状態で作成）
    const tabId = await createTab(extensionContext, 'https://example.com', undefined, {
      active: false,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    // タブの読み込みが完了するまで待機
    await waitForTabStatusComplete(serviceWorker, tabId);

    // グレーアウト状態確認用のロケータを取得
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // タブを休止状態にする（chrome.tabs.discard）
    let actuallyDiscarded = false;
    try {
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.discard(tabId);
      }, tabId);

      // discardが実際に動作したかをポーリングで確認
      try {
        await waitForCondition(
          async () => {
            const tab = await serviceWorker.evaluate((tabId) => chrome.tabs.get(tabId), tabId);
            return tab.discarded === true;
          },
          { timeout: 3000, interval: 100, timeoutMessage: 'Tab was not discarded' }
        );
        actuallyDiscarded = true;
      } catch {
        actuallyDiscarded = false;
      }
    } catch {
      // chrome.tabs.discard()の副作用でコンテキストが閉じられることがある
      actuallyDiscarded = false;
    }

    // chrome.tabs.discard()が実際に動作しなかった場合はスキップ
    if (!actuallyDiscarded) {
      test.skip(true, 'chrome.tabs.discard() did not work in this environment');
      return;
    }

    // Side PanelのtabInfoMapが更新されるまで待機（グレーアウト状態）
    await waitForCondition(
      async () => {
        const hasDiscardedStyle = await sidePanelPage.evaluate((tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const title = node.querySelector('[data-testid="discarded-tab-title"]');
          return title !== null;
        }, tabId);
        return hasDiscardedStyle;
      },
      { timeout: 10000, interval: 100, timeoutMessage: 'Discarded tab style was not applied' }
    );

    // グレーアウト状態であることを確認
    const discardedTitle = tabNode.locator('[data-testid="discarded-tab-title"]');
    await expect(discardedTitle).toBeVisible();

    // 休止タブをアクティブ化する（タブを読み込む）
    await activateTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    // タブがアクティブになり、休止状態が解除されるまで待機
    await waitForCondition(
      async () => {
        const tab = await serviceWorker.evaluate(async (tabId) => {
          return chrome.tabs.get(tabId);
        }, tabId);
        // discardedがfalseになることを確認
        return tab.discarded === false;
      },
      { timeout: 10000, interval: 100, timeoutMessage: 'Tab was not un-discarded after activation' }
    );

    // Side PanelのtabInfoMapが更新されるまで待機（グレーアウト解除）
    await waitForCondition(
      async () => {
        const hasDiscardedStyle = await sidePanelPage.evaluate((tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const title = node.querySelector('[data-testid="discarded-tab-title"]');
          // グレーアウトスタイルがなくなっている（nullになっている）ことを確認
          return title === null;
        }, tabId);
        return hasDiscardedStyle;
      },
      { timeout: 10000, interval: 100, timeoutMessage: 'Discarded tab style was not removed after activation' }
    );

    // グレーアウトスタイルが解除されていることを確認
    const discardedTitleAfterActivation = tabNode.locator('[data-testid="discarded-tab-title"]');
    await expect(discardedTitleAfterActivation).toHaveCount(0);
  });
});
