import { test } from './fixtures/extension';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import {
  waitForTabInTreeState,
  waitForTabRemovedFromTreeState,
} from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('親子関係不整合解消', () => {
  test('タブを閉じた後も、他のタブの親子関係が維持される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const parent1TabId = await createTab(serviceWorker, getTestServerUrl('/parent1'));
    await waitForTabInTreeState(serviceWorker, parent1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
    ], 0);

    const child1TabId = await createTab(serviceWorker, getTestServerUrl('/child1'), parent1TabId);
    await waitForTabInTreeState(serviceWorker, child1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
    ], 0);

    const parent2TabId = await createTab(serviceWorker, getTestServerUrl('/parent2'));
    await waitForTabInTreeState(serviceWorker, parent2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0 },
    ], 0);

    const child2TabId = await createTab(serviceWorker, getTestServerUrl('/child2'), parent2TabId);
    await waitForTabInTreeState(serviceWorker, child2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);

    const tempTabId = await createTab(serviceWorker, getTestServerUrl('/temp'));
    await waitForTabInTreeState(serviceWorker, tempTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
      { tabId: tempTabId, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, tempTabId);
    await waitForTabRemovedFromTreeState(serviceWorker, tempTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);
  });

  test('親タブを閉じた後、子タブが昇格しても他の親子関係が維持される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    // 親タブ1と子タブを作成
    const parent1TabId = await createTab(serviceWorker, getTestServerUrl('/parent1'));
    await waitForTabInTreeState(serviceWorker, parent1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
    ], 0);

    const child1TabId = await createTab(serviceWorker, getTestServerUrl('/child1'), parent1TabId);
    await waitForTabInTreeState(serviceWorker, child1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
    ], 0);

    // 親タブ2と子タブを作成（こちらの親子関係が維持されることを検証）
    const parent2TabId = await createTab(serviceWorker, getTestServerUrl('/parent2'));
    await waitForTabInTreeState(serviceWorker, parent2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0 },
    ], 0);

    const child2TabId = await createTab(serviceWorker, getTestServerUrl('/child2'), parent2TabId);
    await waitForTabInTreeState(serviceWorker, child2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1TabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);

    // 親タブ1を閉じる（子タブ1は昇格する）
    await closeTab(serviceWorker, parent1TabId);
    await waitForTabRemovedFromTreeState(serviceWorker, parent1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: child1TabId, depth: 0 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);
  });

  test('複数のタブ作成と削除を連続で行っても、親子関係が維持される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/parent'));
    await waitForTabInTreeState(serviceWorker, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/child'), parentTabId);
    await waitForTabInTreeState(serviceWorker, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // 連続でタブを作成して削除（5回繰り返す）
    for (let i = 0; i < 5; i++) {
      const tempTabId = await createTab(serviceWorker, getTestServerUrl(`/temp${i}`));
      await waitForTabInTreeState(serviceWorker, tempTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
        { tabId: tempTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tempTabId);
      await waitForTabRemovedFromTreeState(serviceWorker, tempTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);
    }
  });

  test('深い階層（3階層）の親子関係が、他のタブ操作後も維持される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const rootTabId = await createTab(serviceWorker, getTestServerUrl('/root'));
    await waitForTabInTreeState(serviceWorker, rootTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTabId, depth: 0 },
    ], 0);

    const middleTabId = await createTab(serviceWorker, getTestServerUrl('/middle'), rootTabId);
    await waitForTabInTreeState(serviceWorker, middleTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTabId, depth: 0, expanded: true },
      { tabId: middleTabId, depth: 1 },
    ], 0);

    const leafTabId = await createTab(serviceWorker, getTestServerUrl('/leaf'), middleTabId);
    await waitForTabInTreeState(serviceWorker, leafTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTabId, depth: 0, expanded: true },
      { tabId: middleTabId, depth: 1, expanded: true },
      { tabId: leafTabId, depth: 2 },
    ], 0);

    const temp1TabId = await createTab(serviceWorker, getTestServerUrl('/temp1'));
    await waitForTabInTreeState(serviceWorker, temp1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTabId, depth: 0, expanded: true },
      { tabId: middleTabId, depth: 1, expanded: true },
      { tabId: leafTabId, depth: 2 },
      { tabId: temp1TabId, depth: 0 },
    ], 0);

    const temp2TabId = await createTab(serviceWorker, getTestServerUrl('/temp2'));
    await waitForTabInTreeState(serviceWorker, temp2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTabId, depth: 0, expanded: true },
      { tabId: middleTabId, depth: 1, expanded: true },
      { tabId: leafTabId, depth: 2 },
      { tabId: temp1TabId, depth: 0 },
      { tabId: temp2TabId, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, temp1TabId);
    await waitForTabRemovedFromTreeState(serviceWorker, temp1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTabId, depth: 0, expanded: true },
      { tabId: middleTabId, depth: 1, expanded: true },
      { tabId: leafTabId, depth: 2 },
      { tabId: temp2TabId, depth: 0 },
    ], 0);
  });

  test('複数の独立した親子関係が、タブ操作の組み合わせ後も維持される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    // 関係1: parent1 -> child1a, child1b
    const parent1TabId = await createTab(serviceWorker, getTestServerUrl('/parent1'));
    await waitForTabInTreeState(serviceWorker, parent1TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0 },
    ], 0);

    const child1aTabId = await createTab(serviceWorker, getTestServerUrl('/child1a'), parent1TabId);
    await waitForTabInTreeState(serviceWorker, child1aTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
    ], 0);

    const child1bTabId = await createTab(serviceWorker, getTestServerUrl('/child1b'), parent1TabId);
    await waitForTabInTreeState(serviceWorker, child1bTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
      { tabId: child1bTabId, depth: 1 },
    ], 0);

    // 関係2: parent2 -> child2
    const parent2TabId = await createTab(serviceWorker, getTestServerUrl('/parent2'));
    await waitForTabInTreeState(serviceWorker, parent2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0 },
    ], 0);

    const child2TabId = await createTab(serviceWorker, getTestServerUrl('/child2'), parent2TabId);
    await waitForTabInTreeState(serviceWorker, child2TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
    ], 0);

    // 関係3: parent3 -> child3
    const parent3TabId = await createTab(serviceWorker, getTestServerUrl('/parent3'));
    await waitForTabInTreeState(serviceWorker, parent3TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
      { tabId: parent3TabId, depth: 0 },
    ], 0);

    const child3TabId = await createTab(serviceWorker, getTestServerUrl('/child3'), parent3TabId);
    await waitForTabInTreeState(serviceWorker, child3TabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1aTabId, depth: 1 },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
      { tabId: parent3TabId, depth: 0, expanded: true },
      { tabId: child3TabId, depth: 1 },
    ], 0);

    await closeTab(serviceWorker, child1aTabId);
    await waitForTabRemovedFromTreeState(serviceWorker, child1aTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1TabId, depth: 0, expanded: true },
      { tabId: child1bTabId, depth: 1 },
      { tabId: parent2TabId, depth: 0, expanded: true },
      { tabId: child2TabId, depth: 1 },
      { tabId: parent3TabId, depth: 0, expanded: true },
      { tabId: child3TabId, depth: 1 },
    ], 0);

    const newTabId = await createTab(serviceWorker, getTestServerUrl('/new'));
    await waitForTabInTreeState(serviceWorker, newTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    // 3階層の構造を作成:
    // tabA (root)
    //   └── tabB
    //         └── tabC
    const tabAId = await createTab(serviceWorker, getTestServerUrl('/A'));
    await waitForTabInTreeState(serviceWorker, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(serviceWorker, getTestServerUrl('/B'), tabAId);
    await waitForTabInTreeState(serviceWorker, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(serviceWorker, getTestServerUrl('/C'), tabBId);
    await waitForTabInTreeState(serviceWorker, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    await closeTab(serviceWorker, tabAId);
    await waitForTabRemovedFromTreeState(serviceWorker, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: tabBId, depth: 0, expanded: true },
      { tabId: tabCId, depth: 1 },
    ], 0);
  });
});
