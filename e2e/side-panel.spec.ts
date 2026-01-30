import { test } from './fixtures/extension';
import { assertTreeVisible, assertSmoothScrolling } from './utils/side-panel-utils';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('Side Panelの表示とリアルタイム更新', () => {
  test.describe('基本的な表示テスト', () => {
    test('Side Panelを開いた場合、Side Panelが正しく表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      await assertTreeVisible(sidePanelPage);
    });

    test('Side Panelを開いた場合、現在のタブツリーが正しく表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);
      await assertTreeVisible(sidePanelPage);
    });
  });

  test.describe('リアルタイム更新テスト', () => {
    test('新しいタブを作成した場合、Side Panelがリアルタイムで更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const newTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: newTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, newTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('タブを閉じた場合、Side Panelからタブが削除される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('タブのURLを変更した場合、ツリー表示が更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      const newUrl = getTestServerUrl('/example');
      await serviceWorker.evaluate(async ({ tabId, url }) => {
        await chrome.tabs.update(tabId, { url });
      }, { tabId, url: newUrl });

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('展開/折りたたみテスト', () => {
    test('親タブに子タブがある場合、展開ボタンが表示される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(serviceWorker, getTestServerUrl('/page'), parentTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      await closeTab(serviceWorker, childTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });

    test('展開ボタンをクリックすると、子タブの表示/非表示が切り替わる', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      const childTabId = await createTab(serviceWorker, getTestServerUrl('/page'), parentTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0, expanded: true },
        { tabId: childTabId, depth: 1 },
      ], 0);

      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
      // 展開中はホバーでオーバーレイが表示されるので、まずホバーする
      await parentNode.hover();
      const expandOverlay = parentNode.locator('[data-testid="expand-overlay"]');

      if (await expandOverlay.count() > 0) {
        await expandOverlay.click({ force: true, noWaitAfter: true });

        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: parentTabId, depth: 0, expanded: false },
        ], 0);

        // 折りたたみ中はオーバーレイが常に表示されているので、直接クリックできる
        await expandOverlay.click({ force: true, noWaitAfter: true });

        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          { tabId: parentTabId, depth: 0, expanded: true },
          { tabId: childTabId, depth: 1 },
        ], 0);
      }

      await closeTab(serviceWorker, childTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, parentTabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('スクロール性能テスト', () => {
    test('大量のタブがある場合、スクロールが滑らかに動作する', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabCount = 10;
      const createdTabIds: number[] = [];

      for (let i = 0; i < tabCount; i++) {
        const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));
        createdTabIds.push(tabId);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          ...createdTabIds.map(id => ({ tabId: id, depth: 0 })),
        ], 0);
      }

      await assertSmoothScrolling(sidePanelPage, tabCount);

      const remainingTabIds = [...createdTabIds];
      for (const tabId of createdTabIds) {
        await closeTab(serviceWorker, tabId);
        remainingTabIds.shift();
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: initialBrowserTabId, depth: 0 },
          ...remainingTabIds.map(id => ({ tabId: id, depth: 0 })),
        ], 0);
      }
    });
  });

  test.describe('favIcon更新テスト', () => {
    test('タブのfavIconが変更された場合、ツリー表示のアイコンが更新される', async ({
      extensionContext,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const { initialBrowserTabId, sidePanelPage } =
        await setupWindow(extensionContext, serviceWorker, windowId);

      const tabId = await createTab(serviceWorker, getTestServerUrl('/example'));

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await closeTab(serviceWorker, tabId);

      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: initialBrowserTabId, depth: 0 },
      ], 0);
    });
  });
});
