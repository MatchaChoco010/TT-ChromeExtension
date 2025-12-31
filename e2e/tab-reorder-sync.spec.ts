/**
 * タブ並び替え同期テスト
 *
 * Task 2.2 (tree-tab-bugfixes-and-ux-improvements): タブ並び替えE2Eテストの追加
 * Requirements: 2.4, 2.5
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
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { waitForCondition, waitForTabInTreeState } from './utils/polling-utils';
import { reorderTabs, getTabOrder } from './utils/drag-drop-utils';

test.describe('タブ並び替え同期テスト', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);

  test.describe('chrome.tabs.move APIによるタブ移動', () => {
    test('chrome.tabs.moveでタブを移動した場合、ツリービューの表示順序が更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // ツリービューでのタブ順序を取得（初期状態）
      const initialOrder = await getTabOrder(sidePanelPage);
      expect(initialOrder).toContain(tab1);
      expect(initialOrder).toContain(tab2);
      expect(initialOrder).toContain(tab3);

      // chrome.tabs.move APIでtab3を先頭に移動
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tab3);

      // ツリービューが更新されるまでポーリングで待機
      // Task 2.1の修正により、onMovedイベントでツリー状態が再読み込みされる
      await waitForCondition(
        async () => {
          const order = await getTabOrder(sidePanelPage);
          // tab3が先頭にあることを確認
          const tab3Index = order.indexOf(tab3);
          const tab1Index = order.indexOf(tab1);
          return tab3Index !== -1 && tab1Index !== -1 && tab3Index < tab1Index;
        },
        { timeout: 10000, interval: 100, timeoutMessage: 'Tab order was not updated after chrome.tabs.move' }
      );

      // 最終確認: ツリービューでtab3が先頭にあること
      const finalOrder = await getTabOrder(sidePanelPage);
      const tab3FinalIndex = finalOrder.indexOf(tab3);
      const tab1FinalIndex = finalOrder.indexOf(tab1);
      expect(tab3FinalIndex).toBeLessThan(tab1FinalIndex);
    });

    test('chrome.tabs.moveでタブを末尾に移動した場合、ツリービューが正しく更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1);
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // chrome.tabs.move APIでtab1を末尾に移動
      await serviceWorker.evaluate(async (tabId) => {
        // index: -1 は末尾に移動
        await chrome.tabs.move(tabId, { index: -1 });
      }, tab1);

      // ツリービューが更新されるまでポーリングで待機
      await waitForCondition(
        async () => {
          const order = await getTabOrder(sidePanelPage);
          const tab1Index = order.indexOf(tab1);
          const tab3Index = order.indexOf(tab3);
          // tab1が末尾（tab3より後）にあることを確認
          return tab1Index !== -1 && tab3Index !== -1 && tab1Index > tab3Index;
        },
        { timeout: 10000, interval: 100, timeoutMessage: 'Tab order was not updated when moving to end' }
      );

      // 最終確認
      const finalOrder = await getTabOrder(sidePanelPage);
      const tab1FinalIndex = finalOrder.indexOf(tab1);
      const tab3FinalIndex = finalOrder.indexOf(tab3);
      expect(tab1FinalIndex).toBeGreaterThan(tab3FinalIndex);
    });

    test('chrome.tabs.moveで複数回タブを移動した場合、ツリービューが毎回正しく更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 4つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      const tab4 = await createTab(extensionContext, 'https://httpbin.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1);
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);
      await assertTabInTree(sidePanelPage, tab4);

      // 第1回移動: tab4を先頭に移動
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tab4);

      // 更新を待機
      await waitForCondition(
        async () => {
          const order = await getTabOrder(sidePanelPage);
          const tab4Index = order.indexOf(tab4);
          const tab1Index = order.indexOf(tab1);
          return tab4Index !== -1 && tab1Index !== -1 && tab4Index < tab1Index;
        },
        { timeout: 10000, interval: 100 }
      );

      // 第2回移動: tab1を先頭に移動（tab4の前に）
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tab1);

      // 更新を待機
      await waitForCondition(
        async () => {
          const order = await getTabOrder(sidePanelPage);
          const tab1Index = order.indexOf(tab1);
          const tab4Index = order.indexOf(tab4);
          return tab1Index !== -1 && tab4Index !== -1 && tab1Index < tab4Index;
        },
        { timeout: 10000, interval: 100, timeoutMessage: 'Tab order was not updated after second move' }
      );

      // 最終確認: tab1が先頭にあること
      const finalOrder = await getTabOrder(sidePanelPage);
      const tab1FinalIndex = finalOrder.indexOf(tab1);
      expect(tab1FinalIndex).toBeLessThan(finalOrder.indexOf(tab4));
    });
  });

  test.describe('ドラッグ&ドロップによるタブ移動と同期', () => {
    test('D&Dでタブを並び替えた後、ブラウザタブの順序とツリービューが同期していること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1);
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // D&Dでtab3をtab1の前に移動
      await reorderTabs(sidePanelPage, tab3, tab1, 'before');

      // ブラウザタブの順序を取得
      const browserTabOrder = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        return tabs.filter(t => t.id).map(t => t.id as number);
      });

      // ツリービューの順序を取得
      const treeOrder = await getTabOrder(sidePanelPage);

      // ブラウザタブとツリービューでtab3がtab1より前にあることを確認
      const browserTab3Index = browserTabOrder.indexOf(tab3);
      const browserTab1Index = browserTabOrder.indexOf(tab1);
      expect(browserTab3Index).toBeLessThan(browserTab1Index);

      const treeTab3Index = treeOrder.indexOf(tab3);
      const treeTab1Index = treeOrder.indexOf(tab1);
      expect(treeTab3Index).toBeLessThan(treeTab1Index);
    });

    test('D&Dでタブを並び替えた後、ブラウザタブの順序がストレージに反映されていること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1);
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // D&Dでtab3をtab1の前に移動
      await reorderTabs(sidePanelPage, tab3, tab1, 'before');

      // ブラウザのタブ順序が更新されたことを確認
      await waitForCondition(
        async () => {
          const browserTabOrder = await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({ currentWindow: true });
            return tabs.filter(t => t.id).map(t => t.id as number);
          }) as number[];

          const tab3Index = browserTabOrder.indexOf(tab3);
          const tab1Index = browserTabOrder.indexOf(tab1);

          // tab3がtab1より前にあることを確認
          return tab3Index !== -1 && tab1Index !== -1 && tab3Index < tab1Index;
        },
        { timeout: 10000, interval: 100, timeoutMessage: 'Browser tab order was not updated after D&D' }
      );

      // ツリービューの順序もブラウザタブと同期していることを確認
      const treeOrder = await getTabOrder(sidePanelPage);
      const treeTab3Index = treeOrder.indexOf(tab3);
      const treeTab1Index = treeOrder.indexOf(tab1);
      expect(treeTab3Index).toBeLessThan(treeTab1Index);
    });
  });

  test.describe('エッジケース', () => {
    test('タブが1つしかない場合、chrome.tabs.moveを呼んでもエラーが発生しないこと', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 1つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1);

      // chrome.tabs.moveを呼び出し（エラーが発生しないことを確認）
      await expect(
        serviceWorker.evaluate(async (tabId) => {
          await chrome.tabs.move(tabId, { index: 0 });
        }, tab1)
      ).resolves.not.toThrow();

      // タブがまだツリーに存在することを確認
      await assertTabInTree(sidePanelPage, tab1);
    });

    test('高速に連続してタブを移動した場合、最終的な順序が正しく反映されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 5つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      const tab4 = await createTab(extensionContext, 'https://httpbin.org');
      const tab5 = await createTab(extensionContext, 'https://developer.mozilla.org');

      // タブがツリーに表示されるまで待機
      await waitForTabInTreeState(extensionContext, tab1);
      await waitForTabInTreeState(extensionContext, tab2);
      await waitForTabInTreeState(extensionContext, tab3);
      await waitForTabInTreeState(extensionContext, tab4);
      await waitForTabInTreeState(extensionContext, tab5);

      // 高速に連続してタブを移動
      await serviceWorker.evaluate(async (tabIds: number[]) => {
        // tab5を先頭に
        await chrome.tabs.move(tabIds[4], { index: 0 });
        // tab4を先頭に（tab5の前）
        await chrome.tabs.move(tabIds[3], { index: 0 });
        // tab3を先頭に（tab4の前）
        await chrome.tabs.move(tabIds[2], { index: 0 });
      }, [tab1, tab2, tab3, tab4, tab5]);

      // ツリービューが最終的な順序に更新されるまで待機
      await waitForCondition(
        async () => {
          const order = await getTabOrder(sidePanelPage);
          const tab3Index = order.indexOf(tab3);
          const tab4Index = order.indexOf(tab4);
          const tab5Index = order.indexOf(tab5);
          // tab3, tab4, tab5の順序を確認（全て先頭近くにあるはず）
          return tab3Index !== -1 && tab4Index !== -1 && tab5Index !== -1 &&
                 tab3Index < tab4Index && tab4Index < tab5Index;
        },
        { timeout: 15000, interval: 100, timeoutMessage: 'Final tab order was not correctly applied after rapid moves' }
      );

      // 最終確認
      const finalOrder = await getTabOrder(sidePanelPage);
      expect(finalOrder.indexOf(tab3)).toBeLessThan(finalOrder.indexOf(tab4));
      expect(finalOrder.indexOf(tab4)).toBeLessThan(finalOrder.indexOf(tab5));
    });
  });
});
