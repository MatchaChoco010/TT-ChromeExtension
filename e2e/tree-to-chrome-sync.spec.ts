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
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { waitForCondition } from './utils/polling-utils';
import { moveTabToParent, reorderTabs, getTabOrder } from './utils/drag-drop-utils';

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
      // 準備: 3つのタブを作成 (A, B, C)
      const tabA = await createTab(extensionContext, 'https://example.com');
      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      const tabC = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tabA, 'Example');
      await assertTabInTree(sidePanelPage, tabB);
      await assertTabInTree(sidePanelPage, tabC);

      // 初期状態のChromeタブ順序を確認
      const initialOrder = await getChromeTabOrder(serviceWorker);
      expect(initialOrder).toContain(tabA);
      expect(initialOrder).toContain(tabB);
      expect(initialOrder).toContain(tabC);

      // タブBをタブAの子として配置
      await moveTabToParent(sidePanelPage, tabB, tabA);

      // Chromeタブインデックスが更新されるまで待機
      // 深さ優先順序: A → B (Aの子) → C
      await waitForCondition(
        async () => {
          const order = await getChromeTabOrder(serviceWorker);
          const indexA = order.indexOf(tabA);
          const indexB = order.indexOf(tabB);
          const indexC = order.indexOf(tabC);
          // A → B → C の順序になっていること
          return indexA < indexB && indexB < indexC;
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Chrome tab order was not synchronized after child placement' }
      );

      // 最終確認
      const finalOrder = await getChromeTabOrder(serviceWorker);
      const indexA = finalOrder.indexOf(tabA);
      const indexB = finalOrder.indexOf(tabB);
      const indexC = finalOrder.indexOf(tabC);
      expect(indexA).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexC);
    });

    test('ネストした子タブを作成した場合、Chromeタブインデックスが深さ優先順になること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 4つのタブを作成 (A, B, C, D)
      const tabA = await createTab(extensionContext, 'https://example.com');
      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      const tabC = await createTab(extensionContext, 'https://www.w3.org');
      const tabD = await createTab(extensionContext, 'https://httpbin.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tabA, 'Example');
      await assertTabInTree(sidePanelPage, tabB);
      await assertTabInTree(sidePanelPage, tabC);
      await assertTabInTree(sidePanelPage, tabD);

      // タブBをタブAの子として配置
      await moveTabToParent(sidePanelPage, tabB, tabA);
      await sidePanelPage.waitForTimeout(500);

      // タブCをタブBの子として配置 (A → B → C のネスト)
      await moveTabToParent(sidePanelPage, tabC, tabB);

      // Chromeタブインデックスが更新されるまで待機
      // 深さ優先順序: A → B (Aの子) → C (Bの子) → D
      await waitForCondition(
        async () => {
          const order = await getChromeTabOrder(serviceWorker);
          const indexA = order.indexOf(tabA);
          const indexB = order.indexOf(tabB);
          const indexC = order.indexOf(tabC);
          const indexD = order.indexOf(tabD);
          // A → B → C → D の順序になっていること
          return indexA < indexB && indexB < indexC && indexC < indexD;
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Chrome tab order was not synchronized after nested child placement' }
      );

      // 最終確認
      const finalOrder = await getChromeTabOrder(serviceWorker);
      const indexA = finalOrder.indexOf(tabA);
      const indexB = finalOrder.indexOf(tabB);
      const indexC = finalOrder.indexOf(tabC);
      const indexD = finalOrder.indexOf(tabD);
      expect(indexA).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexC);
      expect(indexC).toBeLessThan(indexD);
    });
  });

  test.describe('兄弟配置後のChrome同期', () => {
    test('タブを兄弟として並び替えた後、Chromeタブインデックスが更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのタブを作成 (A, B, C)
      const tabA = await createTab(extensionContext, 'https://example.com');
      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      const tabC = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tabA, 'Example');
      await assertTabInTree(sidePanelPage, tabB);
      await assertTabInTree(sidePanelPage, tabC);

      // 初期順序: A, B, C
      // タブCをタブAの前に移動 → C, A, B
      await reorderTabs(sidePanelPage, tabC, tabA, 'before');

      // Chromeタブインデックスが更新されるまで待機
      await waitForCondition(
        async () => {
          const order = await getChromeTabOrder(serviceWorker);
          const indexA = order.indexOf(tabA);
          const indexC = order.indexOf(tabC);
          // C が A より前にあること
          return indexC < indexA;
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Chrome tab order was not synchronized after sibling reorder' }
      );

      // 最終確認: C → A → B の順序
      const finalOrder = await getChromeTabOrder(serviceWorker);
      const indexA = finalOrder.indexOf(tabA);
      const indexB = finalOrder.indexOf(tabB);
      const indexC = finalOrder.indexOf(tabC);
      expect(indexC).toBeLessThan(indexA);
      expect(indexA).toBeLessThan(indexB);
    });
  });

  test.describe('サブツリー移動後のChrome同期', () => {
    test('サブツリーを移動した後、子タブも含めてChromeタブインデックスが更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 4つのタブを作成 (A, B, C, D)
      const tabA = await createTab(extensionContext, 'https://example.com');
      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      const tabC = await createTab(extensionContext, 'https://www.w3.org');
      const tabD = await createTab(extensionContext, 'https://httpbin.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tabA, 'Example');
      await assertTabInTree(sidePanelPage, tabB);
      await assertTabInTree(sidePanelPage, tabC);
      await assertTabInTree(sidePanelPage, tabD);

      // タブCをタブBの子として配置
      await moveTabToParent(sidePanelPage, tabC, tabB);
      await sidePanelPage.waitForTimeout(500);

      // 現在の構造: A, B → C, D
      // タブB（とその子C）をタブDの後ろに移動
      await reorderTabs(sidePanelPage, tabB, tabD, 'after');

      // Chromeタブインデックスが更新されるまで待機
      // 深さ優先順序: A → D → B → C
      await waitForCondition(
        async () => {
          const order = await getChromeTabOrder(serviceWorker);
          const indexA = order.indexOf(tabA);
          const indexB = order.indexOf(tabB);
          const indexC = order.indexOf(tabC);
          const indexD = order.indexOf(tabD);
          // A → D → B → C の順序になっていること
          return indexA < indexD && indexD < indexB && indexB < indexC;
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Chrome tab order was not synchronized after subtree move' }
      );

      // 最終確認
      const finalOrder = await getChromeTabOrder(serviceWorker);
      const indexA = finalOrder.indexOf(tabA);
      const indexB = finalOrder.indexOf(tabB);
      const indexC = finalOrder.indexOf(tabC);
      const indexD = finalOrder.indexOf(tabD);
      expect(indexA).toBeLessThan(indexD);
      expect(indexD).toBeLessThan(indexB);
      expect(indexB).toBeLessThan(indexC);
    });
  });

  test.describe('ツリービューとChromeタブの順序一致確認', () => {
    test('ドラッグ操作後、ツリービューの表示順序とChromeタブインデックスが一致すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 5つのタブを作成
      const tabA = await createTab(extensionContext, 'https://example.com');
      const tabB = await createTab(extensionContext, 'https://www.iana.org');
      const tabC = await createTab(extensionContext, 'https://www.w3.org');
      const tabD = await createTab(extensionContext, 'https://httpbin.org');
      const tabE = await createTab(extensionContext, 'https://jsonplaceholder.typicode.com');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tabA, 'Example');
      await assertTabInTree(sidePanelPage, tabB);
      await assertTabInTree(sidePanelPage, tabC);
      await assertTabInTree(sidePanelPage, tabD);
      await assertTabInTree(sidePanelPage, tabE);

      // 複雑な親子関係を作成:
      // A
      //   B
      //     C
      // D
      // E
      await moveTabToParent(sidePanelPage, tabB, tabA);
      await sidePanelPage.waitForTimeout(500);
      await moveTabToParent(sidePanelPage, tabC, tabB);
      await sidePanelPage.waitForTimeout(500);

      // ツリービューの順序を取得
      const treeOrder = await getTabOrder(sidePanelPage);

      // Chromeタブインデックスが更新されるまで待機
      await waitForCondition(
        async () => {
          const chromeOrder = await getChromeTabOrder(serviceWorker);
          // 両方の順序に含まれるタブのみを比較
          const commonTabs = treeOrder.filter(id => chromeOrder.includes(id));
          const chromeFiltered = chromeOrder.filter(id => treeOrder.includes(id));
          // 順序が一致するか確認
          return JSON.stringify(commonTabs) === JSON.stringify(chromeFiltered);
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Tree view order and Chrome tab order do not match' }
      );

      // 最終確認: ツリービューとChromeタブの順序が一致
      const finalTreeOrder = await getTabOrder(sidePanelPage);
      const finalChromeOrder = await getChromeTabOrder(serviceWorker);
      const commonTabs = finalTreeOrder.filter(id => finalChromeOrder.includes(id));
      const chromeFiltered = finalChromeOrder.filter(id => finalTreeOrder.includes(id));
      expect(commonTabs).toEqual(chromeFiltered);
    });
  });
});
