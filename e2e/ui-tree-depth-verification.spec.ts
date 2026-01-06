import { test } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('UIツリービューのdepth属性検証', () => {
  test('ドラッグ&ドロップで作成した親子関係がUIに正しく反映される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(extensionContext, 'https://example.com/child');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTabId, parentTabId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);
  });

  test('親子関係作成後に新しいタブを開いても親子関係が維持される（UI検証）', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(extensionContext, 'https://example.com/child');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTabId, parentTabId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    const newTabId = await createTab(extensionContext, 'https://example.org/new');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });

  test('3階層の親子関係が新しいタブ作成後もUI上で維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(extensionContext, 'https://example.com/B');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 0 },
    ], 0);

    const tabCId = await createTab(extensionContext, 'https://example.com/C');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 0 },
      { tabId: tabCId, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, tabBId, tabAId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, tabCId, tabBId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const newTabId = await createTab(extensionContext, 'https://example.org/new');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0, expanded: true },
      { tabId: tabBId, depth: 1, expanded: true },
      { tabId: tabCId, depth: 2 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });
});
