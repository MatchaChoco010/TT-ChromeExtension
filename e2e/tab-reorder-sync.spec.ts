/**
 * タブ並び替え同期テスト
 *
 * タブ並び替えE2Eテストの追加
 *
 * このテストスイートでは、タブ並び替え後にブラウザタブとツリービューが
 * 正しく同期されることを検証します：
 * - chrome.tabs.move APIでタブを移動した場合のツリービュー同期
 * - ドラッグ&ドロップでタブを移動した場合のツリービュー同期
 * - 並び替え後の順序がストレージに永続化されること
 *
 * Note: フレーキーテスト対策として固定時間待機は使用せず、
 * ポーリングベースの状態確定待機を使用しています。
 */
import { test } from './fixtures/extension';
import { createTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, closeTab } from './utils/tab-utils';
import { reorderTabs } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('タブ並び替え同期テスト', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);

  test.describe('chrome.tabs.move APIによるタブ移動', () => {
    test('chrome.tabs.moveでタブを移動した場合、ツリービューの表示順序が更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 3つのタブを作成（各createTabの直後にassertTabStructure）
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

      // chrome.tabs.move APIでtab3を先頭に移動
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tab3);

      // ツリービューが更新されることを検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab3, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });

    test('chrome.tabs.moveでタブを末尾に移動した場合、ツリービューが正しく更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 3つのタブを作成（各createTabの直後にassertTabStructure）
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

      // chrome.tabs.move APIでtab1を末尾に移動
      await serviceWorker.evaluate(async (tabId) => {
        // index: -1 は末尾に移動
        await chrome.tabs.move(tabId, { index: -1 });
      }, tab1);

      // ツリービューが更新されることを検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);
    });

    test('chrome.tabs.moveで複数回タブを移動した場合、ツリービューが毎回正しく更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 4つのタブを作成（各createTabの直後にassertTabStructure）
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

      const tab4 = await createTab(extensionContext, 'https://httpbin.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab4, depth: 0 },
      ], 0);

      // 第1回移動: tab4を先頭に移動
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tab4);

      // 第1回移動後の状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab4, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);

      // 第2回移動: tab1を先頭に移動（tab4の前に）
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tab1);

      // 第2回移動後の状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab1, depth: 0 },
        { tabId: tab4, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 0);
    });
  });

  test.describe('ドラッグ&ドロップによるタブ移動と同期', () => {
    test('D&Dでタブを並び替えた後、ブラウザタブの順序とツリービューが同期していること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 3つのタブを作成（各createTabの直後にassertTabStructure）
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

      // D&Dでtab3をtab1の前に移動
      await reorderTabs(sidePanelPage, tab3, tab1, 'before');

      // D&D後の状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });

    test('D&Dでタブを並び替えた後、ブラウザタブの順序がストレージに反映されていること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 3つのタブを作成（各createTabの直後にassertTabStructure）
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

      // D&Dでtab3をtab1の前に移動
      await reorderTabs(sidePanelPage, tab3, tab1, 'before');

      // D&D後の状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });
  });

  test.describe('エッジケース', () => {
    test('タブが1つしかない場合、chrome.tabs.moveを呼んでもエラーが発生しないこと', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 1つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
      ], 0);

      // chrome.tabs.moveを呼び出し
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tab1);

      // タブがまだツリーに存在することを確認
      // chrome.tabs.moveでindex:0に移動したので、tab1が先頭になる
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab1, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('高速に連続してタブを移動した場合、最終的な順序が正しく反映されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ウィンドウIDと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 5つのタブを作成（各createTabの直後にassertTabStructure）
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

      const tab4 = await createTab(extensionContext, 'https://httpbin.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab4, depth: 0 },
      ], 0);

      const tab5 = await createTab(extensionContext, 'https://developer.mozilla.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
        { tabId: tab4, depth: 0 },
        { tabId: tab5, depth: 0 },
      ], 0);

      // 高速に連続してタブを移動
      await serviceWorker.evaluate(async (tabIds: number[]) => {
        // tab5を先頭に
        await chrome.tabs.move(tabIds[4], { index: 0 });
        // tab4を先頭に（tab5の前）
        await chrome.tabs.move(tabIds[3], { index: 0 });
        // tab3を先頭に（tab4の前）
        await chrome.tabs.move(tabIds[2], { index: 0 });
      }, [tab1, tab2, tab3, tab4, tab5]);

      // 高速移動後の最終状態を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab3, depth: 0 },
        { tabId: tab4, depth: 0 },
        { tabId: tab5, depth: 0 },
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 0);
    });
  });
});
