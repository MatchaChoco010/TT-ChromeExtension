/**
 * 親タブ削除時のサブツリー親子関係維持テスト
 *
 * このテストスイートでは、以下を検証します:
 * 1. 親タブを閉じたときに、子タブ間の親子関係（孫の関係）が維持される
 * 2. 深い階層のツリーでも親子関係が正しく維持される
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { waitForTabInTreeState } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('親タブ削除時のサブツリー親子関係維持', () => {
  test('親タブを閉じても子タブ間の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // タブA（ルート）を作成
    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await waitForTabInTreeState(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    // タブB（Aの子）を作成
    const tabBId = await createTab(extensionContext, 'https://example.com/B', tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
    ], 0);

    // タブC（Bの子）を作成
    const tabCId = await createTab(extensionContext, 'https://example.com/C', tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
    ], 0);

    // タブD（Bの子）を作成
    const tabDId = await createTab(extensionContext, 'https://example.com/D', tabBId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
    ], 0);

    // タブAを閉じる - Bがルートになり、C,DはBの子のまま維持される
    await closeTab(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabBId, depth: 0 },
      { tabId: tabCId, depth: 1 },
      { tabId: tabDId, depth: 1 },
    ], 0);
  });

  test('3階層のツリーで親を閉じても孫の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // タブA（ルート）を作成
    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await waitForTabInTreeState(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    // タブB（Aの子）を作成
    const tabBId = await createTab(extensionContext, 'https://example.com/B', tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
    ], 0);

    // タブC（Bの子）を作成
    const tabCId = await createTab(extensionContext, 'https://example.com/C', tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
    ], 0);

    // タブD（Cの子 = Aの曾孫）を作成
    const tabDId = await createTab(extensionContext, 'https://example.com/D', tabCId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 3 },
    ], 0);

    // タブAを閉じる - B→C→Dの親子関係が維持される
    await closeTab(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabBId, depth: 0 },
      { tabId: tabCId, depth: 1 },
      { tabId: tabDId, depth: 2 },
    ], 0);
  });

  test('複数の子タブにそれぞれ孫がある場合、親を閉じても全ての親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 構造:
    // A (root) ← 閉じる
    // ├── B
    // │   ├── C
    // │   └── D
    // ├── E
    // └── F
    //     └── G

    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await waitForTabInTreeState(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(extensionContext, 'https://example.com/B', tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(extensionContext, 'https://example.com/C', tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const tabDId = await createTab(extensionContext, 'https://example.com/D', tabBId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
    ], 0);

    const tabEId = await createTab(extensionContext, 'https://example.com/E', tabAId);
    await waitForTabInTreeState(extensionContext, tabEId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
      { tabId: tabEId, depth: 1 },
    ], 0);

    const tabFId = await createTab(extensionContext, 'https://example.com/F', tabAId);
    await waitForTabInTreeState(extensionContext, tabFId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
      { tabId: tabEId, depth: 1 },
      { tabId: tabFId, depth: 1 },
    ], 0);

    const tabGId = await createTab(extensionContext, 'https://example.com/G', tabFId);
    await waitForTabInTreeState(extensionContext, tabGId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 2 },
      { tabId: tabEId, depth: 1 },
      { tabId: tabFId, depth: 1 },
      { tabId: tabGId, depth: 2 },
    ], 0);

    // タブAを閉じる - B,E,Fがルートになり、各サブツリーの親子関係は維持される
    // 期待される構造:
    // B (root)
    // ├── C
    // └── D
    // E (root)
    // F (root)
    // └── G
    await closeTab(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabBId, depth: 0 },
      { tabId: tabCId, depth: 1 },
      { tabId: tabDId, depth: 1 },
      { tabId: tabEId, depth: 0 },
      { tabId: tabFId, depth: 0 },
      { tabId: tabGId, depth: 1 },
    ], 0);
  });
});
