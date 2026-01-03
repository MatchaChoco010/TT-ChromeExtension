/**
 * ツリー→Chromeタブ同期テスト
 *
 * タブツリーの順序をChromeネイティブタブに同期
 *
 * このテストスイートでは、タブツリーでのドラッグ＆ドロップ操作後に
 * Chromeのネイティブタブインデックスがツリーの深さ優先順序と一致することを検証します：
 * - 子タブとして配置した後のChrome同期
 * - 兄弟として配置した後のChrome同期
 * - サブツリーを移動した後のChrome同期
 */
import { test } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForCondition } from './utils/polling-utils';
import { moveTabToParent, reorderTabs } from './utils/drag-drop-utils';

test.describe('ツリー→Chromeタブ同期テスト', () => {
  // ドラッグ操作があるためタイムアウトを延長
  test.setTimeout(120000);

  /**
   * Chromeタブのインデックス順序を取得
   */
  async function getChromeTabOrder(serviceWorker: ReturnType<typeof test['extend']>['serviceWorker'] extends infer T ? T : never): Promise<number[]> {
    // @ts-expect-error - serviceWorkerはfixture型
    const tabs = await serviceWorker.evaluate(async () => {
      const allTabs = await chrome.tabs.query({ currentWindow: true });
      return allTabs
        .filter(t => !t.pinned)
        .sort((a, b) => a.index - b.index)
        .map(t => t.id);
    });
    return tabs;
  }

  test.describe('子タブ配置後のChrome同期', () => {
    test('タブを子として配置した後、Chromeタブインデックスが深さ優先順になること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 3つのタブを作成 (A, B, C)
      const tabA = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(extensionContext, 'https://www.w3.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      // タブBをタブAの子として配置
      await moveTabToParent(sidePanelPage, tabB, tabA);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 0 },
      ], 0);

      // Chromeタブインデックスが深さ優先順序（A → B → C）に更新されるまで待機
      await waitForCondition(
        async () => {
          const order = await getChromeTabOrder(serviceWorker);
          const indexA = order.indexOf(tabA);
          const indexB = order.indexOf(tabB);
          const indexC = order.indexOf(tabC);
          return indexA < indexB && indexB < indexC;
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Chrome tab order was not synchronized after child placement' }
      );
    });

    test('ネストした子タブを作成した場合、Chromeタブインデックスが深さ優先順になること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 4つのタブを作成 (A, B, C, D)
      const tabA = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(extensionContext, 'https://www.w3.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      const tabD = await createTab(extensionContext, 'https://httpbin.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
      ], 0);

      // タブBをタブAの子として配置
      await moveTabToParent(sidePanelPage, tabB, tabA);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
      ], 0);

      // タブCをタブBの子として配置 (A → B → C のネスト)
      await moveTabToParent(sidePanelPage, tabC, tabB);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 2 },
        { tabId: tabD, depth: 0 },
      ], 0);

      // Chromeタブインデックスが深さ優先順序（A → B → C → D）に更新されるまで待機
      await waitForCondition(
        async () => {
          const order = await getChromeTabOrder(serviceWorker);
          const indexA = order.indexOf(tabA);
          const indexB = order.indexOf(tabB);
          const indexC = order.indexOf(tabC);
          const indexD = order.indexOf(tabD);
          return indexA < indexB && indexB < indexC && indexC < indexD;
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Chrome tab order was not synchronized after nested child placement' }
      );
    });
  });

  test.describe('兄弟配置後のChrome同期', () => {
    test('タブを兄弟として並び替えた後、Chromeタブインデックスが更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 3つのタブを作成 (A, B, C)
      const tabA = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(extensionContext, 'https://www.w3.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      // 初期順序: A, B, C
      // タブCをタブAの前に移動 → C, A, B
      await reorderTabs(sidePanelPage, tabC, tabA, 'before');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      // Chromeタブインデックスが新しい順序（C → A → B）に更新されるまで待機
      await waitForCondition(
        async () => {
          const order = await getChromeTabOrder(serviceWorker);
          const indexA = order.indexOf(tabA);
          const indexB = order.indexOf(tabB);
          const indexC = order.indexOf(tabC);
          return indexC < indexA && indexA < indexB;
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Chrome tab order was not synchronized after sibling reorder' }
      );
    });
  });

  test.describe('サブツリー移動後のChrome同期', () => {
    test('サブツリーを移動した後、子タブも含めてChromeタブインデックスが更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 4つのタブを作成 (A, B, C, D)
      const tabA = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(extensionContext, 'https://www.w3.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      const tabD = await createTab(extensionContext, 'https://httpbin.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
      ], 0);

      // タブCをタブBの子として配置
      await moveTabToParent(sidePanelPage, tabC, tabB);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 1 },
        { tabId: tabD, depth: 0 },
      ], 0);

      // 現在の構造: A, B → C, D
      // タブB（とその子C）をタブDの後ろに移動
      await reorderTabs(sidePanelPage, tabB, tabD, 'after');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 1 },
      ], 0);

      // Chromeタブインデックスが深さ優先順序（A → D → B → C）に更新されるまで待機
      await waitForCondition(
        async () => {
          const order = await getChromeTabOrder(serviceWorker);
          const indexA = order.indexOf(tabA);
          const indexB = order.indexOf(tabB);
          const indexC = order.indexOf(tabC);
          const indexD = order.indexOf(tabD);
          return indexA < indexD && indexD < indexB && indexB < indexC;
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Chrome tab order was not synchronized after subtree move' }
      );
    });
  });

  test.describe('ツリービューとChromeタブの順序一致確認', () => {
    test('ドラッグ操作後、ツリービューの表示順序とChromeタブインデックスが一致すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // windowIdとpseudoSidePanelTabIdを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      // 準備: 5つのタブを作成
      const tabA = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
      ], 0);

      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
      ], 0);

      const tabC = await createTab(extensionContext, 'https://www.w3.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
      ], 0);

      const tabD = await createTab(extensionContext, 'https://httpbin.org');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
      ], 0);

      const tabE = await createTab(extensionContext, 'https://jsonplaceholder.typicode.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 0 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);

      // 複雑な親子関係を作成:
      // A
      //   B
      //     C
      // D
      // E
      await moveTabToParent(sidePanelPage, tabB, tabA);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 0 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);

      await moveTabToParent(sidePanelPage, tabC, tabB);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabA, depth: 0 },
        { tabId: tabB, depth: 1 },
        { tabId: tabC, depth: 2 },
        { tabId: tabD, depth: 0 },
        { tabId: tabE, depth: 0 },
      ], 0);

      // ツリービューの順序（深さ優先順序）: A → B → C → D → E
      const expectedTreeOrder = [tabA, tabB, tabC, tabD, tabE];

      // Chromeタブインデックスがツリービューの順序と一致するまで待機
      await waitForCondition(
        async () => {
          const chromeOrder = await getChromeTabOrder(serviceWorker);
          // 期待される順序のタブのみをフィルタして比較
          const chromeFiltered = chromeOrder.filter(id => expectedTreeOrder.includes(id));
          return JSON.stringify(expectedTreeOrder) === JSON.stringify(chromeFiltered);
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Tree view order and Chrome tab order do not match' }
      );
    });
  });
});
