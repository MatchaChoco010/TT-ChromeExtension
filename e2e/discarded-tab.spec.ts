import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getTestServerUrl } from './utils/tab-utils';
import { waitForTabStatusComplete } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';

// chrome.tabs.discard() を Playwright から呼び出すと Chrome がクラッシュするため、
// このテストは常にスキップする。
// 詳細: Playwright の persistent context で discard を実行すると、
// CDP ターゲットが破棄され、ブラウザ全体がクラッシュする既知の問題。
// chrome://crashes で確認済み。
test.describe.skip('休止タブの視覚的区別', () => {
  test('休止状態のタブはグレーアウト表示される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // アクティブタブは休止できないため、代替タブを先に作成してアクティブにしておく
    const alternativeTabId = await createTab(serviceWorker, getTestServerUrl('/page1'), undefined, {
      active: true,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: alternativeTabId, depth: 0 },
    ], 0);
    await waitForTabStatusComplete(serviceWorker, alternativeTabId);

    // テスト対象のタブを非アクティブで作成
    const tabId = await createTab(serviceWorker, getTestServerUrl('/page2'), undefined, {
      active: false,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: alternativeTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    await waitForTabStatusComplete(serviceWorker, tabId);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // 休止前はグレーアウトスタイルが適用されていない
    const discardedTitleBefore = tabNode.locator('[data-testid="discarded-tab-title"]');
    await expect(discardedTitleBefore).toHaveCount(0);

    // Service Worker から discard を呼び出す
    await serviceWorker.evaluate(async (tabIdToDiscard) => {
      await chrome.tabs.discard(tabIdToDiscard);
    }, tabId);

    // UI に休止スタイルが反映されるまで待機
    await expect(tabNode.locator('[data-testid="discarded-tab-title"]')).toBeVisible({ timeout: 10000 });

    const discardedTitleAfter = tabNode.locator('[data-testid="discarded-tab-title"]');
    await expect(discardedTitleAfter).toHaveClass(/text-gray-400/);
  });

  test('休止タブをアクティブ化するとグレーアウトが解除される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // アクティブタブは休止できないため、代替タブを先に作成してアクティブにしておく
    const alternativeTabId = await createTab(serviceWorker, getTestServerUrl('/page1'), undefined, {
      active: true,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: alternativeTabId, depth: 0 },
    ], 0);
    await waitForTabStatusComplete(serviceWorker, alternativeTabId);

    // テスト対象のタブを非アクティブで作成
    const tabId = await createTab(serviceWorker, getTestServerUrl('/page2'), undefined, {
      active: false,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: alternativeTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    await waitForTabStatusComplete(serviceWorker, tabId);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // コンテキストメニューを開いて「タブを休止」をクリック
    await tabNode.click({ button: 'right' });
    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible();
    const discardMenuItem = sidePanelPage.locator('[data-testid="context-menu-discard"]');
    await discardMenuItem.click();

    // UI に休止スタイルが反映されるまで待機
    await expect(tabNode.locator('[data-testid="discarded-tab-title"]')).toBeVisible({ timeout: 10000 });

    // 休止タブをアクティブ化（ダブルクリックでタブをアクティブにする）
    await tabNode.dblclick();

    // UI からグレーアウトスタイルが解除されるまで待機
    await expect(tabNode.locator('[data-testid="discarded-tab-title"]')).toHaveCount(0, { timeout: 10000 });
  });
});
