/**
 * SidePanelUtils Test
 *
 * SidePanelUtilsの機能をテストします。
 * このテストは、ユーティリティ関数が正しく動作することを確認するためのものです。
 */
import { test, expect } from '../fixtures/extension';
import {
  openSidePanel,
  assertTreeVisible,
  assertRealTimeUpdate,
  assertSmoothScrolling,
} from './side-panel-utils';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './tab-utils';
import { assertTabStructure } from './assertion-utils';

test.describe('SidePanelUtils', () => {
  test('openSidePanelはSide Panelを開く', async ({ extensionContext, extensionId }) => {
    // Side Panelを開く
    const page = await openSidePanel(extensionContext, extensionId);

    // ページが正しく開かれたことを確認
    expect(page).toBeDefined();
    expect(page.url()).toContain('sidepanel.html');

    // クリーンアップ
    await page.close();
  });

  test('assertTreeVisibleはツリーが表示されることを検証する', async ({
    sidePanelPage,
  }) => {
    // ツリーが表示されることを確認（例外が発生しない）
    await assertTreeVisible(sidePanelPage);
  });

  test('assertRealTimeUpdateは別タブでのタブ作成をSide Panelで検証する', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 新しいタブを作成するアクション用の変数
    let createdTabId: number | null = null;
    const action = async () => {
      createdTabId = await createTab(extensionContext, 'https://example.com');
    };

    // リアルタイム更新を検証（例外が発生しない）
    await assertRealTimeUpdate(sidePanelPage, action);

    // 作成したタブの構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: createdTabId!, depth: 0 },
    ], 0);
  });

  test('assertRealTimeUpdateはタブ削除もSide Panelで検証する', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 事前にタブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');

    // タブ作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    // タブを削除するアクション
    const action = async () => {
      await closeTab(extensionContext, tabId);
    };

    // リアルタイム更新を検証（例外が発生しない）
    await assertRealTimeUpdate(sidePanelPage, action);

    // タブ削除後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('assertSmoothScrollingは大量タブ時のスクロール動作を検証する', async ({
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

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 複数のタブを作成（10個）
    const tabCount = 10;
    const createdTabs: number[] = [];
    for (let i = 0; i < tabCount; i++) {
      const tabId = await createTab(extensionContext, `https://example.com/page${i}`);
      createdTabs.push(tabId);

      // 各タブ作成直後に構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        ...createdTabs.map(id => ({ tabId: id, depth: 0 })),
      ], 0);
    }

    // スムーズなスクロールを検証（例外が発生しない）
    await assertSmoothScrolling(sidePanelPage, tabCount);
  });

  test('assertSmoothScrollingは少数のタブでも動作する', async ({
    sidePanelPage,
  }) => {
    // 少数のタブでもスムーズスクロール検証が動作することを確認
    await assertSmoothScrolling(sidePanelPage, 3);
  });
});
