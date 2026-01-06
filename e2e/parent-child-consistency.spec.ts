import { test } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import {
  waitForTabInTreeState,
  waitForTabRemovedFromTreeState,
} from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';

test.describe('親子関係不整合解消', () => {
  test('タブを閉じた後も、他のタブの親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブ1を作成
    const parent1TabId = await createTab(extensionContext, 'https://example.com/parent1');
    await waitForTabInTreeState(extensionContext, parent1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
    ], 0);

    // 親タブ1の子タブを作成
    const child1TabId = await createTab(extensionContext, 'https://example.com/child1', parent1TabId);
    await waitForTabInTreeState(extensionContext, child1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
    ], 0);

    // 親タブ2を作成
    const parent2TabId = await createTab(extensionContext, 'https://example.org/parent2');
    await waitForTabInTreeState(extensionContext, parent2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0 },
    ], 0);

    // 親タブ2の子タブを作成
    const child2TabId = await createTab(extensionContext, 'https://example.org/child2', parent2TabId);
    await waitForTabInTreeState(extensionContext, child2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);

    // 独立したタブを作成
    const tempTabId = await createTab(extensionContext, 'https://example.net/temp');
    await waitForTabInTreeState(extensionContext, tempTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
      { tabId: tempTabId, depth: 0 },
    ], 0);

    // 独立したタブを閉じる
    await closeTab(extensionContext, tempTabId);
    await waitForTabRemovedFromTreeState(extensionContext, tempTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);
  });

  test('親タブを閉じた後、子タブが昇格しても他の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブ1と子タブを作成
    const parent1TabId = await createTab(extensionContext, 'https://example.com/parent1');
    await waitForTabInTreeState(extensionContext, parent1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
    ], 0);

    const child1TabId = await createTab(extensionContext, 'https://example.com/child1', parent1TabId);
    await waitForTabInTreeState(extensionContext, child1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
    ], 0);

    // 親タブ2と子タブを作成（こちらの親子関係が維持されることを検証）
    const parent2TabId = await createTab(extensionContext, 'https://example.org/parent2');
    await waitForTabInTreeState(extensionContext, parent2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0 },
    ], 0);

    const child2TabId = await createTab(extensionContext, 'https://example.org/child2', parent2TabId);
    await waitForTabInTreeState(extensionContext, child2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);

    // 親タブ1を閉じる（子タブ1は昇格する）
    await closeTab(extensionContext, parent1TabId);
    await waitForTabRemovedFromTreeState(extensionContext, parent1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: child1TabId, depth: 0 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);
  });

  test('複数のタブ作成と削除を連続で行っても、親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親子関係を作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await waitForTabInTreeState(extensionContext, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);
    await waitForTabInTreeState(extensionContext, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // 連続でタブを作成して削除（5回繰り返す）
    for (let i = 0; i < 5; i++) {
      const tempTabId = await createTab(extensionContext, `https://example.org/temp${i}`);
      await waitForTabInTreeState(extensionContext, tempTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
        { tabId: tempTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, tempTabId);
      await waitForTabRemovedFromTreeState(extensionContext, tempTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);
    }
  });

  test('深い階層（3階層）の親子関係が、他のタブ操作後も維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 3階層の親子関係を作成
    const rootTabId = await createTab(extensionContext, 'https://example.com/root');
    await waitForTabInTreeState(extensionContext, rootTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTabId, depth: 0 },
    ], 0);

    const middleTabId = await createTab(extensionContext, 'https://example.com/middle', rootTabId);
    await waitForTabInTreeState(extensionContext, middleTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTabId, depth: 0, expanded: true },
      { tabId: middleTabId, depth: 1 },
    ], 0);

    const leafTabId = await createTab(extensionContext, 'https://example.com/leaf', middleTabId);
    await waitForTabInTreeState(extensionContext, leafTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTabId, depth: 0, expanded: true },
      { tabId: middleTabId, depth: 1, expanded: true },
      { tabId: leafTabId, depth: 2 },
    ], 0);

    // 独立したタブをいくつか作成
    const temp1TabId = await createTab(extensionContext, 'https://example.org/temp1');
    await waitForTabInTreeState(extensionContext, temp1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTabId, depth: 0, expanded: true },
      { tabId: middleTabId, depth: 1, expanded: true },
      { tabId: leafTabId, depth: 2 },
      { tabId: temp1TabId, depth: 0 },
    ], 0);

    const temp2TabId = await createTab(extensionContext, 'https://example.org/temp2');
    await waitForTabInTreeState(extensionContext, temp2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTabId, depth: 0, expanded: true },
      { tabId: middleTabId, depth: 1, expanded: true },
      { tabId: leafTabId, depth: 2 },
      { tabId: temp1TabId, depth: 0 },
      { tabId: temp2TabId, depth: 0 },
    ], 0);

    // いくつかのタブを削除
    await closeTab(extensionContext, temp1TabId);
    await waitForTabRemovedFromTreeState(extensionContext, temp1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTabId, depth: 0, expanded: true },
      { tabId: middleTabId, depth: 1, expanded: true },
      { tabId: leafTabId, depth: 2 },
      { tabId: temp2TabId, depth: 0 },
    ], 0);
  });

  test('複数の独立した親子関係が、タブ操作の組み合わせ後も維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 3つの独立した親子関係を作成
    // 関係1: parent1 -> child1a, child1b
    const parent1TabId = await createTab(extensionContext, 'https://example.com/parent1');
    await waitForTabInTreeState(extensionContext, parent1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
    ], 0);

    const child1aTabId = await createTab(extensionContext, 'https://example.com/child1a', parent1TabId);
    await waitForTabInTreeState(extensionContext, child1aTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
    ], 0);

    const child1bTabId = await createTab(extensionContext, 'https://example.com/child1b', parent1TabId);
    await waitForTabInTreeState(extensionContext, child1bTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
      { tabId: child1bTabId, depth: 1 },
    ], 0);

    // 関係2: parent2 -> child2
    const parent2TabId = await createTab(extensionContext, 'https://example.org/parent2');
    await waitForTabInTreeState(extensionContext, parent2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0 },
    ], 0);

    const child2TabId = await createTab(extensionContext, 'https://example.org/child2', parent2TabId);
    await waitForTabInTreeState(extensionContext, child2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);

    // 関係3: parent3 -> child3
    const parent3TabId = await createTab(extensionContext, 'https://example.net/parent3');
    await waitForTabInTreeState(extensionContext, parent3TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
      { tabId: parent3TabId, depth: 0 },
    ], 0);

    const child3TabId = await createTab(extensionContext, 'https://example.net/child3', parent3TabId);
    await waitForTabInTreeState(extensionContext, child3TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
      { tabId: parent3TabId, depth: 0, expanded: true },
      { tabId: child3TabId, depth: 1 },
    ], 0);

    // 一部のタブを削除（child1a）
    await closeTab(extensionContext, child1aTabId);
    await waitForTabRemovedFromTreeState(extensionContext, child1aTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
      { tabId: parent3TabId, depth: 0, expanded: true },
      { tabId: child3TabId, depth: 1 },
    ], 0);

    // 新しいタブを作成
    const newTabId = await createTab(extensionContext, 'https://example.io/new');
    await waitForTabInTreeState(extensionContext, newTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
      { tabId: parent3TabId, depth: 0, expanded: true },
      { tabId: child3TabId, depth: 1 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });

  test('ルート親タブを閉じたとき、子と孫の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 3階層の構造を作成:
    // tabA (root)
    //   └── tabB
    //         └── tabC
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
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(extensionContext, 'https://example.com/C', tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    // ルート親タブAを閉じる
    await closeTab(extensionContext, tabAId);
    await waitForTabRemovedFromTreeState(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabBId, depth: 0, expanded: true },
      { tabId: tabCId, depth: 1 },
    ], 0);
  });
});
