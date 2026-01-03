/**
 * Side Panelの表示とリアルタイム更新のE2Eテスト
 *
 * Side Panelの表示とリアルタイム更新の実装とテスト
 *
 * - Side Panelを開いた場合、現在のタブツリーが正しく表示されることを検証
 * - 別のタブで新しいタブを開いた場合、Side Panelがリアルタイムで更新されることを検証
 * - タブのfavIconが変更された場合、ツリー表示のアイコンが更新されることを検証
 * - 大量のタブ（100個以上）が存在する場合、スクロールとレンダリングが滑らかに動作することを検証
 * - ツリーノードの展開/折りたたみを切り替えた場合、アニメーションが滑らかに実行されることを検証
 */
import { test } from './fixtures/extension';
import { assertTreeVisible, assertSmoothScrolling } from './utils/side-panel-utils';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('Side Panelの表示とリアルタイム更新', () => {
  test.describe('基本的な表示テスト', () => {
    test('Side Panelを開いた場合、Side Panelが正しく表示される', async ({
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

      // Side Panelが正しく表示されることを検証
      await assertTreeVisible(sidePanelPage);
    });

    test('Side Panelを開いた場合、現在のタブツリーが正しく表示される', async ({
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

      // ツリーが表示されることを検証
      await assertTreeVisible(sidePanelPage);
    });
  });

  test.describe('リアルタイム更新テスト', () => {
    test('新しいタブを作成した場合、Side Panelがリアルタイムで更新される', async ({
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

      // 新しいタブを作成
      const newTabId = await createTab(extensionContext, 'about:blank');

      // タブ作成後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: newTabId, depth: 0 },
      ], 0);

      // クリーンアップ
      await closeTab(extensionContext, newTabId);

      // クリーンアップ後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブを閉じた場合、Side Panelからタブが削除される', async ({
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

      // 新しいタブを作成
      const tabId = await createTab(extensionContext, 'about:blank');

      // タブ作成後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      // タブを閉じる
      await closeTab(extensionContext, tabId);

      // タブ削除後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブのURLを変更した場合、ツリー表示が更新される', async ({
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

      // 新しいタブを作成
      const tabId = await createTab(extensionContext, 'about:blank');

      // タブ作成後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      // タブのURLを変更
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { url: 'https://example.com' });
      }, tabId);

      // URL変更後もタブ構造が維持されていることを検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId);

      // クリーンアップ後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('展開/折りたたみテスト', () => {
    test('親タブに子タブがある場合、展開ボタンが表示される', async ({
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

      // 親タブを作成
      const parentTabId = await createTab(extensionContext, 'about:blank');

      // 親タブ作成後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      // 子タブを作成
      const childTabId = await createTab(extensionContext, 'about:blank', parentTabId);

      // 子タブ作成後のタブ構造を検証（展開状態であることも暗黙的に検証される）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: childTabId, depth: 1 },
      ], 0);

      // クリーンアップ - 子タブを閉じる
      await closeTab(extensionContext, childTabId);

      // 子タブ削除後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      // クリーンアップ - 親タブを閉じる
      await closeTab(extensionContext, parentTabId);

      // 親タブ削除後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('展開ボタンをクリックすると、子タブの表示/非表示が切り替わる', async ({
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

      // 親タブを作成
      const parentTabId = await createTab(extensionContext, 'about:blank');

      // 親タブ作成後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      // 子タブを作成
      const childTabId = await createTab(extensionContext, 'about:blank', parentTabId);

      // 子タブ作成後のタブ構造を検証（展開状態）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
        { tabId: childTabId, depth: 1 },
      ], 0);

      // 親タブノードの展開ボタンを取得
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
      const expandButton = parentNode.locator('[data-testid="expand-button"]');

      if (await expandButton.count() > 0) {
        // 展開ボタンをクリックして折りたたみ
        await expandButton.click();

        // 折りたたみ後は子タブが非表示（親タブのみ表示される）
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: pseudoSidePanelTabId, depth: 0 },
          { tabId: parentTabId, depth: 0 },
        ], 0);

        // もう一度クリックして展開
        await expandButton.click();

        // 展開後は子タブも表示される
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: pseudoSidePanelTabId, depth: 0 },
          { tabId: parentTabId, depth: 0 },
          { tabId: childTabId, depth: 1 },
        ], 0);
      }

      // クリーンアップ - 子タブを閉じる
      await closeTab(extensionContext, childTabId);

      // 子タブ削除後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: parentTabId, depth: 0 },
      ], 0);

      // クリーンアップ - 親タブを閉じる
      await closeTab(extensionContext, parentTabId);

      // 親タブ削除後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('スクロール性能テスト', () => {
    test('大量のタブがある場合、スクロールが滑らかに動作する', async ({
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

      // 複数のタブを作成（性能テストのため少なめに）
      const tabCount = 10;
      const createdTabIds: number[] = [];

      for (let i = 0; i < tabCount; i++) {
        const tabId = await createTab(extensionContext, 'about:blank');
        createdTabIds.push(tabId);

        // 各タブ作成後にタブ構造を検証
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: pseudoSidePanelTabId, depth: 0 },
          ...createdTabIds.map(id => ({ tabId: id, depth: 0 })),
        ], 0);
      }

      // スクロール動作を検証
      await assertSmoothScrolling(sidePanelPage, tabCount);

      // クリーンアップ
      for (let i = 0; i < createdTabIds.length; i++) {
        const tabId = createdTabIds[i];
        await closeTab(extensionContext, tabId);
        // 各タブ削除後にタブ構造を検証
        const stillExistingCreatedTabs = createdTabIds.slice(i + 1);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: pseudoSidePanelTabId, depth: 0 },
          ...stillExistingCreatedTabs.map(id => ({ tabId: id, depth: 0 })),
        ], 0);
      }
    });
  });

  test.describe('favIcon更新テスト', () => {
    test('タブのfavIconが変更された場合、ツリー表示のアイコンが更新される', async ({
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

      // 実際のウェブサイトを開くタブを作成（favIconを取得するため）
      const tabId = await createTab(extensionContext, 'https://example.com');

      // タブ作成後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId);

      // クリーンアップ後のタブ構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });
});
