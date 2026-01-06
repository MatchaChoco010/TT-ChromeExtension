import { test } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { reorderTabs, moveTabToParent } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ドラッグ&ドロップ - タブ挿入', () => {
  test.setTimeout(120000);

  test.describe('タブの挿入位置', () => {
    test('タブをドロップすると、ドロップ操作が正常に完了すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1 = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
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

    test('ドロップ後もすべてのタブが正しく表示されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1 = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      const tab4 = await createTab(extensionContext, 'https://developer.mozilla.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab4, depth: 0 },
      ], 0);

      await reorderTabs(sidePanelPage, tab4, tab2, 'before');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab4, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);
    });

    test('ドロップ後にタブのツリー構造が維持されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1 = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
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
  });

  test.describe('ツリー構造とブラウザタブ順序の同期', () => {
    test('ドロップ後のツリー状態がストレージと同期されていること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1 = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      const tab4 = await createTab(extensionContext, 'https://developer.mozilla.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab4, depth: 0 },
      ], 0);

      await reorderTabs(sidePanelPage, tab4, tab2, 'before');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab4, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);
    });

    test('複数回のドロップ操作後もすべてのタブが保持されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1 = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      const tab4 = await createTab(extensionContext, 'https://developer.mozilla.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab4, depth: 0 },
      ], 0);

      await reorderTabs(sidePanelPage, tab4, tab1, 'before');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab4, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      await reorderTabs(sidePanelPage, tab2, tab3, 'after');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab4, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });

    test('子タブとして配置した場合も順序が正しく同期されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tab1 = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);

      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tab2, tab1, serviceWorker);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0, expanded: true },
        { tabId: tab2, depth: 1 },
        { tabId: tab3, depth: 0 },
      ], 0);
    });
  });
});
