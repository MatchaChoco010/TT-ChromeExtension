import { test, expect } from './fixtures/extension';
import {
  createTab,
  getTestServerUrl,
  getCurrentWindowId,
  pinTab,
} from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ピン留めタブから開いたページの表示', () => {
  test('ピン留めタブから開いたタブがツリービューに表示される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 初期タブをピン留め
    await pinTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
    await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: initialBrowserTabId }], 0);

    // ピン留めタブから新しいタブを開く（リンククリックをシミュレート）
    // createTabにparentTabIdを渡すと、そのタブの子として作成される
    const childTabId = await createTab(serviceWorker, getTestServerUrl('/page?child'), initialBrowserTabId);

    // 子タブがツリービューに表示されていることを確認
    // 親がピン留めタブ（フィルタリングされる）なので、子タブはルートノードとして表示されるべき
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: childTabId, depth: 0 },
    ], 0);

    // DOM上で子タブが存在することを確認
    const childTabNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
    await expect(childTabNode).toBeVisible();
  });

  test('ピン留めタブから複数のタブを開いても全てツリービューに表示される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 初期タブをピン留め
    await pinTab(serviceWorker, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // ピン留めタブから複数の新しいタブを開く
    const childTabId1 = await createTab(serviceWorker, getTestServerUrl('/page?child1'), initialBrowserTabId);
    const childTabId2 = await createTab(serviceWorker, getTestServerUrl('/page?child2'), initialBrowserTabId);
    const childTabId3 = await createTab(serviceWorker, getTestServerUrl('/page?child3'), initialBrowserTabId);

    // 全ての子タブがツリービューに表示されていることを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: childTabId1, depth: 0 },
      { tabId: childTabId2, depth: 0 },
      { tabId: childTabId3, depth: 0 },
    ], 0);
  });

  test('ピン留め解除すると子タブが正しく子として表示される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    // 初期タブをピン留め
    await pinTab(serviceWorker, initialBrowserTabId);

    // ピン留めタブから新しいタブを開く
    const childTabId = await createTab(serviceWorker, getTestServerUrl('/page?child'), initialBrowserTabId);

    // 子タブがルートノードとして表示されていることを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: childTabId, depth: 0 },
    ], 0);

    // ピン留めを解除
    await serviceWorker.evaluate(async (id) => {
      await chrome.tabs.update(id, { pinned: false });
    }, initialBrowserTabId);

    // ピン留め解除を待機
    await serviceWorker.evaluate(
      async (id) => {
        for (let i = 0; i < 100; i++) {
          const tab = await chrome.tabs.get(id);
          if (!tab.pinned) {
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 20));
        }
        throw new Error('Timeout waiting for tab to be unpinned');
      },
      initialBrowserTabId
    );

    // UIを更新
    await serviceWorker.evaluate(async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
      } catch {
        // リスナーが存在しない場合のエラーは無視
      }
    });

    // ピン留め解除後、元の親タブがツリービューに表示され、子タブがその子として表示されることを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });
});
