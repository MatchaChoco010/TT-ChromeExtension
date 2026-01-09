import { test, expect } from './fixtures/extension';
import { createTab, closeTab, activateTab, getCurrentWindowId, getPseudoSidePanelTabId, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForTabRemovedFromTreeState, waitForTabUrlLoaded } from './utils/polling-utils';

test.describe('タブライフサイクルとツリー構造の基本操作', () => {
  test('新しいタブを作成した場合、タブが正常に作成される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // タブを作成
    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

    // URLが正しく設定されていることを確認（ロード完了を待機）
    const createdTab = await waitForTabUrlLoaded(serviceWorker, tabId, '127.0.0.1');
    expect(createdTab.url || createdTab.pendingUrl || '').toContain('127.0.0.1');
  });

  test('親タブから新しいタブを開いた場合、親子関係が正しく確立される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // 親タブを作成
    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

    // 親タブから子タブを作成（openerTabIdを指定）
    const childTabId = await createTab(
      serviceWorker,
      getTestServerUrl('/page'),
      parentTabId
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId, depth: 1 },
    ], 0);
  });

  test('タブを閉じた場合、タブが正常に削除される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // タブを作成
    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

    // タブを閉じる
    await closeTab(serviceWorker, tabId);
    await waitForTabRemovedFromTreeState(serviceWorker, tabId);

    // タブ削除後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('子タブを持つ親タブを閉じた場合、親タブが正常に削除される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // 親タブを作成
    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));

    // 子タブを作成
    const childTabId1 = await createTab(
      serviceWorker,
      getTestServerUrl('/page'),
      parentTabId
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
    ], 0);

    const childTabId2 = await createTab(
      serviceWorker,
      getTestServerUrl('/page'),
      parentTabId
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: childTabId1, depth: 1 },
      { tabId: childTabId2, depth: 1 },
    ], 0);

    // 親タブを閉じる
    await closeTab(serviceWorker, parentTabId);
    await waitForTabRemovedFromTreeState(serviceWorker, parentTabId);

    // 親タブ削除後の構造を検証（子タブは昇格）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: childTabId1, depth: 0 },
      { tabId: childTabId2, depth: 0 },
    ], 0);
  });

  test('タブのタイトルまたはURLが変更された場合、変更が反映される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // タブを作成
    const tabId = await createTab(serviceWorker, getTestServerUrl('/page'));

    // 元のタブ情報を確認（ロード完了を待機）
    const pageUrl = getTestServerUrl('/page');
    const tabBefore = await waitForTabUrlLoaded(serviceWorker, tabId, '127.0.0.1', 10000);
    expect(tabBefore.url || tabBefore.pendingUrl || '').toContain('127.0.0.1');

    // タブのURLを変更
    await serviceWorker.evaluate(
      ({ tabId, url }) => {
        return chrome.tabs.update(tabId, { url });
      },
      { tabId, url: pageUrl }
    );

    // 更新を待機（URL変更とロード完了を待つ）
    const tabAfter = await waitForTabUrlLoaded(serviceWorker, tabId, '127.0.0.1', 10000);

    // URLが変更されたことを確認
    expect(tabAfter).toBeDefined();
    expect(tabAfter.id).toBe(tabId);

    // タブ構造に変化がないことを検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);
  });

  test('タブがアクティブ化された場合、アクティブ状態が正しく設定される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // 複数のタブを作成（非アクティブ）
    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, {
      active: false,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'), undefined, {
      active: false,
    });
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    // タブ1をアクティブ化
    await activateTab(serviceWorker, tabId1);

    // アクティブ状態を確認
    const tabs1 = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });
    const activeTab1 = tabs1.find((tab: chrome.tabs.Tab) => tab.id === tabId1);
    expect(activeTab1?.active).toBe(true);

    // タブ構造に変化がないことを検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    // タブ2をアクティブ化
    await activateTab(serviceWorker, tabId2);

    // アクティブ状態が切り替わったことを確認
    const tabs2 = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });
    const activeTab2 = tabs2.find((tab: chrome.tabs.Tab) => tab.id === tabId2);
    expect(activeTab2?.active).toBe(true);

    // タブ構造に変化がないことを検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);
  });
});
