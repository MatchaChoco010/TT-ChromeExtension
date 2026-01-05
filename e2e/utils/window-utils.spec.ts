/**
 * WindowTestUtils Test
 *
 * WindowTestUtilsの機能をテストします。
 * このテストは、ユーティリティ関数が正しく動作することを確認するためのものです。
 */
import { test, expect } from '../fixtures/extension';
import {
  createWindow,
  moveTabToWindow,
  assertWindowTreeSync,
  openSidePanelForWindow,
} from './window-utils';
import {
  createTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
} from './tab-utils';
import { assertTabStructure, assertWindowExists } from './assertion-utils';

test.describe('WindowTestUtils', () => {
  test('createWindowは新しいウィンドウを作成する', async ({ extensionContext }) => {
    // 新しいウィンドウを作成
    const windowId = await createWindow(extensionContext);

    // ウィンドウが存在することを確認
    await assertWindowExists(extensionContext, windowId);
  });

  test('moveTabToWindowはタブを別ウィンドウに移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 新しいタブを作成（about:blankを使用して高速化）
    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // 新しいウィンドウを作成
    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    // 新ウィンドウのサイドパネルを開く
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);

    // 新ウィンドウのデフォルトタブを取得（削除せずにタブ構造に含める）
    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    // タブを新しいウィンドウに移動
    await moveTabToWindow(extensionContext, tabId, newWindowId);

    // サイドパネルをリロードして変更を反映
    await newWindowSidePanel.reload();
    await sidePanelPage.reload();

    // 元のウィンドウからタブが消えたことを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 新しいウィンドウにタブが移動したことを確認
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);
  });

  test('クロスウィンドウでタブを別ウィンドウに移動する（moveTabToWindow）', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 新しいタブを作成（about:blankを使用して高速化）
    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // 新しいウィンドウを作成
    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    // 新ウィンドウのサイドパネルを開く
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);

    // 新ウィンドウのデフォルトタブを取得（タブ移動前に取得）
    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    // タブを新しいウィンドウに移動（moveTabToWindow APIを使用）
    await moveTabToWindow(extensionContext, tabId, newWindowId);

    // サイドパネルをリロードして変更を反映
    await newWindowSidePanel.reload();
    await sidePanelPage.reload();

    // 移動完了後の最終状態を確認（移動元・移動先両ウィンドウ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);
  });

  test('assertWindowTreeSyncは各ウィンドウのツリー状態が正しく同期されることを検証する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    // 新しいウィンドウを作成
    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    // 新ウィンドウのサイドパネルを開く
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);

    // 新ウィンドウのデフォルトタブを取得
    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    // ツリー状態の同期を検証（例外が発生しないことを確認）
    await expect(
      assertWindowTreeSync(extensionContext, newWindowId)
    ).resolves.not.toThrow();
  });

  test('複数ウィンドウ間でタブを移動した後、各ウィンドウのツリー状態が正しく同期されることを検証する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const currentWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, currentWindowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, currentWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 最初のウィンドウにタブを作成（about:blankを使用して高速化）
    const tab1Id = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1Id, depth: 0 },
    ], 0);

    const tab2Id = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1Id, depth: 0 },
      { tabId: tab2Id, depth: 0 },
    ], 0);

    // 新しいウィンドウを作成
    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    // 新ウィンドウのサイドパネルを開く
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);

    // 新ウィンドウのデフォルトタブを取得
    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    // タブを新しいウィンドウに移動
    await moveTabToWindow(extensionContext, tab1Id, newWindowId);

    // サイドパネルをリロードして変更を反映
    await newWindowSidePanel.reload();
    await sidePanelPage.reload();

    // 元のウィンドウからタブ1が消えたことを確認
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab2Id, depth: 0 },
    ], 0);

    // 新しいウィンドウにタブ1が移動したことを確認
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: tab1Id, depth: 0 },
    ], 0);

    // 両方のウィンドウのツリー状態が同期されていることを確認
    await assertWindowTreeSync(extensionContext, currentWindowId);
    await assertWindowTreeSync(extensionContext, newWindowId);
  });

  test('子タブを持つ親タブを別ウィンドウに移動した場合、サブツリー全体が一緒に移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const currentWindowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, currentWindowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, currentWindowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブを作成（about:blankを使用して高速化）
    const parentTabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    // 子タブを作成
    const childTabId = await createTab(
      extensionContext,
      'about:blank',
      parentTabId
    );
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // 新しいウィンドウを作成
    const newWindowId = await createWindow(extensionContext);
    await assertWindowExists(extensionContext, newWindowId);

    // 新ウィンドウのサイドパネルを開く
    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId);
    const newWindowPseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, newWindowId);

    // 新ウィンドウのデフォルトタブを取得（タブ移動前に取得）
    const newWindowInitialTabId = await getInitialBrowserTabId(serviceWorker, newWindowId);
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブを新しいウィンドウに移動（子タブも一緒に移動）
    await moveTabToWindow(extensionContext, parentTabId, newWindowId);

    // サイドパネルをリロードして変更を反映
    await newWindowSidePanel.reload();
    await sidePanelPage.reload();

    // 元のウィンドウから親タブと子タブが消えたことを確認
    await assertTabStructure(sidePanelPage, currentWindowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブと子タブが新しいウィンドウに移動し、階層が維持されていることを確認
    await assertTabStructure(newWindowSidePanel, newWindowId, [
      { tabId: newWindowInitialTabId, depth: 0 },
      { tabId: newWindowPseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // ツリー状態の同期を検証
    await assertWindowTreeSync(extensionContext, newWindowId);
  });
});
