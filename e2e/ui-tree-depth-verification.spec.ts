/**
 * UIツリービューのdepth属性検証テスト
 *
 * このテストスイートでは、実際のSide Panel UIの見た目（data-depth属性）を検証します。
 * ストレージの状態ではなく、実際にレンダリングされたDOMを確認します。
 */
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
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    // 子タブを作成（最初はルートレベル）
    const childTabId = await createTab(extensionContext, 'https://example.com/child');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 0 },
    ], 0);

    // ドラッグ&ドロップで子タブを親タブの子にする
    await moveTabToParent(sidePanelPage, childTabId, parentTabId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0);
  });

  test('親子関係作成後に新しいタブを開いても親子関係が維持される（UI検証）', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    // 子タブを作成（最初はルートレベル）
    const childTabId = await createTab(extensionContext, 'https://example.com/child');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 0 },
    ], 0);

    // ドラッグ&ドロップで子タブを親タブの子にする
    await moveTabToParent(sidePanelPage, childTabId, parentTabId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // 新しい独立タブを作成
    const newTabId = await createTab(extensionContext, 'https://example.org/new');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });

  test('3階層の親子関係が新しいタブ作成後もUI上で維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // タブAを作成
    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    // タブBを作成
    const tabBId = await createTab(extensionContext, 'https://example.com/B');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 0 },
    ], 0);

    // タブCを作成
    const tabCId = await createTab(extensionContext, 'https://example.com/C');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 0 },
      { tabId: tabCId, depth: 0 },
    ], 0);

    // タブBをタブAの子にする
    await moveTabToParent(sidePanelPage, tabBId, tabAId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 0 },
    ], 0);

    // タブCをタブBの子にする
    await moveTabToParent(sidePanelPage, tabCId, tabBId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
    ], 0);

    // 新しいタブを開く
    const newTabId = await createTab(extensionContext, 'https://example.org/new');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
      { tabId: newTabId, depth: 0 },
    ], 0);
  });
});
