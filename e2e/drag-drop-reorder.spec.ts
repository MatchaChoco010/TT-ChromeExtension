/**
 * ドラッグ&ドロップによるタブの並び替え（同階層）テスト
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getTestServerUrl } from './utils/tab-utils';
import { reorderTabs, moveTabToParent, startDrag, dropTab, isDragging } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ドラッグ&ドロップによるタブの並び替え（同階層）', () => {
  test.setTimeout(120000);
  test('ルートレベルのタブを別のルートレベルのタブ間にドロップした場合、タブの表示順序が変更されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const tab1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const tab2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    const tab3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    await reorderTabs(sidePanelPage, tab3, tab1, 'before');

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);
  });

  test('子タブを同じ親の他の子タブ間にドロップした場合、兄弟タブ間での順序が変更されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const child1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const child2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    const child3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: child3, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 0 },
      { tabId: child3, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: child3, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child3, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: child3, depth: 1 },
    ], 0);

    await reorderTabs(sidePanelPage, child3, child1, 'before');

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child3, depth: 1 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);
  });

  test('複数の子を持つサブツリー内でタブを並び替えた場合、他の子タブの順序が正しく調整されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const child1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const child2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    const child3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: child3, depth: 0 },
    ], 0);

    const child4 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: child3, depth: 0 },
      { tabId: child4, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 0 },
      { tabId: child3, depth: 0 },
      { tabId: child4, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: child3, depth: 0 },
      { tabId: child4, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child3, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: child3, depth: 1 },
      { tabId: child4, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child4, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: child3, depth: 1 },
      { tabId: child4, depth: 1 },
    ], 0);

    await reorderTabs(sidePanelPage, child2, child4, 'after');

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child3, depth: 1 },
      { tabId: child4, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);
  });

  test('ドラッグ中にis-draggingクラスが付与され、視覚的なフィードバックが表示されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const tab1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const tab2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    await startDrag(sidePanelPage, tab2);

    const dragging = await isDragging(sidePanelPage);
    expect(dragging).toBe(true);

    await dropTab(sidePanelPage);

    await expect(async () => {
      const stillDragging = await isDragging(sidePanelPage);
      expect(stillDragging).toBe(false);
    }).toPass({ timeout: 2000 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);
  });

  test('タブを自分より後ろの隙間にドロップした場合、正しい位置に配置されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const tabA = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
    ], 0);

    const tabB = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
    ], 0);

    const tabC = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
    ], 0);

    const tabD = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
    ], 0);

    const tabE = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
    ], 0);

    await reorderTabs(sidePanelPage, tabB, tabE, 'before');

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabE, depth: 0 },
    ], 0);
  });
});
