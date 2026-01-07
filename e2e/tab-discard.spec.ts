import { test, expect } from './fixtures/extension';
import {
  createTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('タブの休止機能', () => {
  test('コンテキストメニューに「タブを休止」オプションが表示される', async ({
    extensionContext,
    serviceWorker,
    sidePanelPage,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // テスト用タブを作成
    const tabId = await createTab(extensionContext, 'about:blank', undefined, { active: false });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    // タブを右クリックしてコンテキストメニューを開く
    const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
    await treeNode.click({ button: 'right' });

    // 「タブを休止」メニューが存在することを確認
    const discardButton = sidePanelPage.locator('[data-testid="context-menu-discard"]');
    await expect(discardButton).toBeVisible();
    await expect(discardButton).toContainText('タブを休止');

    // クリーンアップ
    await closeTab(extensionContext, tabId);
  });

  test('複数タブ選択時にコンテキストメニューに件数が表示される', async ({
    extensionContext,
    serviceWorker,
    sidePanelPage,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // テスト用タブを2つ作成
    const tabId1 = await createTab(extensionContext, 'about:blank', undefined, { active: false });
    const tabId2 = await createTab(extensionContext, 'about:blank', undefined, { active: false });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    // Ctrl+クリックで複数タブを選択
    const treeNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const treeNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

    await treeNode1.click({ modifiers: ['Control'] });
    await treeNode2.click({ modifiers: ['Control'] });

    // 選択したタブを右クリック
    await treeNode1.click({ button: 'right' });

    // 「タブを休止 (2件)」と表示されることを確認
    const discardButton = sidePanelPage.locator('[data-testid="context-menu-discard"]');
    await expect(discardButton).toContainText('タブを休止 (2件)');

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await closeTab(extensionContext, tabId2);
  });

});
