import { test } from './fixtures/extension';
import {
  createTab,
  getTestServerUrl,
  getCurrentWindowId,
  pinTab,
  unpinTab,
} from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ピン留めタブから開いたページの表示', () => {
  test('ピン留めタブから開いたタブがツリービューに表示される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    await pinTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
    ], 0);
    await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: initialBrowserTabId }], 0);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/page?child'), initialBrowserTabId);

    // 親がピン留めタブ（フィルタリングされる）なので、子タブはルートノードとして表示されるべき
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: childTabId, depth: 0 },
    ], 0);
  });

  test('ピン留めタブから複数のタブを開いても全てツリービューに表示される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    await pinTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
    ], 0);
    await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: initialBrowserTabId }], 0);

    const childTabId1 = await createTab(serviceWorker, getTestServerUrl('/page?child1'), initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: childTabId1, depth: 0 },
    ], 0);

    const childTabId2 = await createTab(serviceWorker, getTestServerUrl('/page?child2'), initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: childTabId1, depth: 0 },
      { tabId: childTabId2, depth: 0 },
    ], 0);

    const childTabId3 = await createTab(serviceWorker, getTestServerUrl('/page?child3'), initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: childTabId1, depth: 0 },
      { tabId: childTabId2, depth: 0 },
      { tabId: childTabId3, depth: 0 },
    ], 0);
  });

  test('タブをピン留めすると親子関係が解消される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/page?child'), initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    await pinTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: childTabId, depth: 0 },
    ], 0);
    await assertPinnedTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId },
    ], 0);
  });

  test('ピン留め解除後も親子関係は復元されない', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const childTabId = await createTab(serviceWorker, getTestServerUrl('/page?child'), initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);

    await pinTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: childTabId, depth: 0 },
    ], 0);
    await assertPinnedTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId },
    ], 0);

    await unpinTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: childTabId, depth: 0 },
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);
    await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
  });
});
