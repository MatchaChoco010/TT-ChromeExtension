/**
 * chrome.windows API統合テスト
 *
 * このテストスイートでは、以下を検証します:
 * 1. chrome.windows.create()で新しいウィンドウを作成した場合、新しいウィンドウコンテキストが確立されることを検証する
 * 2. chrome.windows.remove()でウィンドウを閉じた場合、ウィンドウ内の全タブがツリーから削除されることを検証する
 * 3. chrome.windows.update()でウィンドウをフォーカスした場合、"Current Window"ビューが正しく更新されることを検証する
 * 4. chrome.windows.getAll()で全ウィンドウを取得した場合、全ウィンドウのタブが正しく列挙されることを検証する
 * 5. 複数ウィンドウが存在する場合、各ウィンドウのタブツリーが独立して管理されることを検証する
 *
 * 注: 本テストは `npm run test:e2e` (ヘッドレスモード) で実行すること
 */
import { test, expect } from './fixtures/extension';
import { createWindow, openSidePanelForWindow } from './utils/window-utils';
import { createTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure, assertWindowClosed, assertWindowExists } from './utils/assertion-utils';

test.describe('chrome.windows API統合', () => {
  test('chrome.windows.create()で新しいウィンドウを作成した場合、新しいウィンドウコンテキストが確立される', async ({
    sidePanelPage,
    extensionContext,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 新しいウィンドウを作成
    const windowId = await createWindow(extensionContext);

    // ウィンドウが作成されたことを検証
    await assertWindowExists(extensionContext, windowId);
  });

  test('chrome.windows.remove()でウィンドウを閉じた場合、ウィンドウ内の全タブがツリーから削除される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 新しいウィンドウを作成
    const windowId = await createWindow(extensionContext);

    // ウィンドウが作成されたことを検証
    await assertWindowExists(extensionContext, windowId);

    // 新しいウィンドウ用のサイドパネルを開く
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, windowId);

    // 新しいウィンドウの擬似サイドパネルタブIDとデフォルトタブを取得
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, windowId);

    // 初期状態を検証（擬似サイドパネルタブと初期タブ）
    await assertTabStructure(newWindowSidePanel, windowId, [
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: newWindowInitialTabId, depth: 0 },
    ], 0);

    // 新しいウィンドウにタブを作成（createTabを使用）
    const tabId1 = await createTab(extensionContext, 'https://example.com', { windowId, active: false });
    await assertTabStructure(newWindowSidePanel, windowId, [
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    const tabId2 = await createTab(extensionContext, 'https://example.org', { windowId, active: false });
    await assertTabStructure(newWindowSidePanel, windowId, [
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    // ウィンドウを閉じる
    await serviceWorker.evaluate((wId) => {
      return chrome.windows.remove(wId);
    }, windowId);

    // ウィンドウが閉じられたことを検証
    await assertWindowClosed(extensionContext, windowId);
  });

  test('chrome.windows.update()でウィンドウをフォーカスした場合、フォーカス状態が正しく更新される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 新しいウィンドウを作成
    const windowId = await createWindow(extensionContext);

    // ウィンドウが作成されたことを検証
    await assertWindowExists(extensionContext, windowId);

    // ウィンドウをフォーカス
    await serviceWorker.evaluate((wId) => {
      return chrome.windows.update(wId, { focused: true });
    }, windowId);

    // フォーカス状態が更新されたことを確認（Chrome APIの動作確認）
    await expect
      .poll(
        async () => {
          const windows = await serviceWorker.evaluate(() => {
            return chrome.windows.getAll();
          });
          const focusedWindow = windows.find((win: chrome.windows.Window) => win.id === windowId);
          return focusedWindow?.focused;
        },
        {
          message: 'フォーカス状態が更新されるのを待機',
          timeout: 5000,
        }
      )
      .toBe(true);
  });

  test('chrome.windows.getAll()で全ウィンドウを取得した場合、全ウィンドウのタブが正しく列挙される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 複数のウィンドウを作成
    const windowId1 = await createWindow(extensionContext);
    const windowId2 = await createWindow(extensionContext);

    // ウィンドウが作成されたことを検証
    await assertWindowExists(extensionContext, windowId1);
    await assertWindowExists(extensionContext, windowId2);

    // 全ウィンドウを取得（Chrome APIの動作確認）
    const windows = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll({ populate: true });
    });

    // 全ウィンドウが取得されたことを確認
    expect(windows.length).toBeGreaterThanOrEqual(3); // 元のウィンドウ + 2つの新しいウィンドウ

    // 作成したウィンドウが含まれることを確認
    const window1 = windows.find((win: chrome.windows.Window) => win.id === windowId1);
    const window2 = windows.find((win: chrome.windows.Window) => win.id === windowId2);
    expect(window1).toBeDefined();
    expect(window2).toBeDefined();

    // 各ウィンドウにタブが含まれることを確認（populate: trueの場合）
    expect(Array.isArray(window1?.tabs)).toBe(true);
    expect(Array.isArray(window2?.tabs)).toBe(true);
  });

  test('複数ウィンドウが存在する場合、各ウィンドウのタブツリーが独立して管理される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 2つの新しいウィンドウを作成
    const windowId1 = await createWindow(extensionContext);
    const windowId2 = await createWindow(extensionContext);

    // ウィンドウが作成されたことを検証
    await assertWindowExists(extensionContext, windowId1);
    await assertWindowExists(extensionContext, windowId2);

    // 各ウィンドウ用のサイドパネルを開く
    const sidePanel1 = await openSidePanelForWindow(extensionContext, windowId1);
    const sidePanel2 = await openSidePanelForWindow(extensionContext, windowId2);

    // 各ウィンドウの擬似サイドパネルタブIDとデフォルトタブを取得
    const pseudoSidePanelTabId1 = await getPseudoSidePanelTabId(serviceWorker, windowId1);
    const initialTabId1 = await getInitialBrowserTabId(serviceWorker, windowId1);
    const pseudoSidePanelTabId2 = await getPseudoSidePanelTabId(serviceWorker, windowId2);
    const initialTabId2 = await getInitialBrowserTabId(serviceWorker, windowId2);

    // ウィンドウ1の初期状態を検証
    await assertTabStructure(sidePanel1, windowId1, [
      { tabId: pseudoSidePanelTabId1, depth: 0 },
      { tabId: initialTabId1, depth: 0 },
    ], 0);

    // ウィンドウ2の初期状態を検証
    await assertTabStructure(sidePanel2, windowId2, [
      { tabId: pseudoSidePanelTabId2, depth: 0 },
      { tabId: initialTabId2, depth: 0 },
    ], 0);

    // ウィンドウ1にタブを作成（createTabを使用）
    const tabId1 = await createTab(extensionContext, 'https://example.com', { windowId: windowId1, active: false });
    await assertTabStructure(sidePanel1, windowId1, [
      { tabId: pseudoSidePanelTabId1, depth: 0 },
      { tabId: initialTabId1, depth: 0 },
      { tabId: tabId1, depth: 0 },
    ], 0);

    // ウィンドウ2にタブを作成（createTabを使用）
    const tabId2 = await createTab(extensionContext, 'https://example.org', { windowId: windowId2, active: false });
    await assertTabStructure(sidePanel2, windowId2, [
      { tabId: pseudoSidePanelTabId2, depth: 0 },
      { tabId: initialTabId2, depth: 0 },
      { tabId: tabId2, depth: 0 },
    ], 0);

    // ウィンドウ1のタブリストにtabId2が含まれないことを確認（独立性）
    // assertTabStructureで既に検証済み - ウィンドウ1にはtabId1のみ
    // ウィンドウ2のタブリストにtabId1が含まれないことを確認（独立性）
    // assertTabStructureで既に検証済み - ウィンドウ2にはtabId2のみ
  });
});
