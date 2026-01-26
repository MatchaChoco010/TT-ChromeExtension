import { test } from './fixtures/extension';
import { createTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { moveTabToParent, reorderTabs } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('子タブの並び替え・ドロップ位置テスト', () => {
  test.setTimeout(120000);

  test.describe('子を親の直上にドロップ → 最後の子として配置', () => {
    test('子タブを親タブの直上にドロップすると、最後の子として配置されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const child1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 0 },
      ], 0);

      const child2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 0 },
        { tabId: child2, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: child2, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: child2, depth: 1 },
      ], 0);

      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: child2, depth: 1 },
        { tabId: child1, depth: 1 },
      ], 0);
    });

    test('複数の子がある場合、任意の子を親にドロップすると最後の子になること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const child1 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 0 },
      ], 0);

      const child2 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 0 },
        { tabId: child2, depth: 0 },
      ], 0);

      const child3 = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: child1, depth: 0 },
        { tabId: child2, depth: 0 },
        { tabId: child3, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: child2, depth: 0 },
        { tabId: child3, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: child2, depth: 1 },
        { tabId: child3, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, child3, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: child1, depth: 1 },
        { tabId: child2, depth: 1 },
        { tabId: child3, depth: 1 },
      ], 0);

      await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: child2, depth: 1 },
        { tabId: child3, depth: 1 },
        { tabId: child1, depth: 1 },
      ], 0);
    });
  });

  test.describe('子を隙間にドロップ → 兄弟として配置', () => {
    test('子タブを親の上の隙間にドロップすると、親の兄弟として配置されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      await reorderTabs(sidePanelPage, childTab, parentTab, 'before');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: childTab, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);
    });

    test('タブAとタブBの間に子タブをドロップすると、その位置に兄弟として配置されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabA = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
      ], 0);

      await reorderTabs(sidePanelPage, childTab, tabB, 'before');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: childTab, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);
    });

    test('リスト末尾の隙間に子タブをドロップすると、末尾に兄弟として配置されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
      ], 0);

      const childTab = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);

      const lastTab = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: childTab, depth: 0 },
        { tabId: lastTab, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0, expanded: true },
        { tabId: childTab, depth: 1 },
        { tabId: lastTab, depth: 0 },
      ], 0);

      await reorderTabs(sidePanelPage, childTab, lastTab, 'after');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTab, depth: 0 },
        { tabId: lastTab, depth: 0 },
        { tabId: childTab, depth: 0 },
      ], 0);
    });
  });

  test.describe('複合シナリオ: サブツリーの移動', () => {
    test('サブツリー（親+子）を別の位置にドロップしても、サブツリー内の親子関係は維持されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabA = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      const tabD = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
      ], 0);

      const tabE = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabC, tabB, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0, expanded: true },
        { tabId: tabC, depth: 1 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabD, tabB, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0, expanded: true },
        { tabId: tabC, depth: 1 },
        { tabId: tabD, depth: 1 },
        { tabId: tabE, depth: 0 },
      ], 0);

      await reorderTabs(sidePanelPage, tabB, tabA, 'before');

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabB, depth: 0, expanded: true },
        { tabId: tabC, depth: 1 },
        { tabId: tabD, depth: 1 },
        { tabId: tabA, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);
    });

    test('ネストしたサブツリーを親の直上にドロップすると、最後の子として配置されること', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabA = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      const tabD = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
      ], 0);

      const tabE = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);

      const tabF = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
        { tabId: tabF, depth: 0 },
      ], 0);

      const tabG = await createTab(serviceWorker, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
        { tabId: tabF, depth: 0 },
        { tabId: tabG, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabB, tabA, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0, expanded: true },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
        { tabId: tabF, depth: 0 },
        { tabId: tabG, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabE, tabA, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0, expanded: true },
        { tabId: tabB, depth: 1 },
        { tabId: tabE, depth: 1 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabF, depth: 0 },
        { tabId: tabG, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabG, tabA, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0, expanded: true },
        { tabId: tabB, depth: 1 },
        { tabId: tabE, depth: 1 },
        { tabId: tabG, depth: 1 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabF, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabC, tabB, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0, expanded: true },
        { tabId: tabB, depth: 1, expanded: true },
        { tabId: tabC, depth: 2 },
        { tabId: tabE, depth: 1 },
        { tabId: tabG, depth: 1 },
        { tabId: tabD, depth: 0 },
        { tabId: tabF, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabD, tabB, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0, expanded: true },
        { tabId: tabB, depth: 1, expanded: true },
        { tabId: tabC, depth: 2 },
        { tabId: tabD, depth: 2 },
        { tabId: tabE, depth: 1 },
        { tabId: tabG, depth: 1 },
        { tabId: tabF, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabF, tabE, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0, expanded: true },
        { tabId: tabB, depth: 1, expanded: true },
        { tabId: tabC, depth: 2 },
        { tabId: tabD, depth: 2 },
        { tabId: tabE, depth: 1, expanded: true },
        { tabId: tabF, depth: 2 },
        { tabId: tabG, depth: 1 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabE, tabA, serviceWorker);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: tabA, depth: 0, expanded: true },
        { tabId: tabB, depth: 1, expanded: true },
        { tabId: tabC, depth: 2 },
        { tabId: tabD, depth: 2 },
        { tabId: tabG, depth: 1 },
        { tabId: tabE, depth: 1, expanded: true },
        { tabId: tabF, depth: 2 },
      ], 0);
    });
  });
});
