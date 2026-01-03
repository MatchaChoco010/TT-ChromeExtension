/**
 * ドラッグ&ドロップによるタブの並び替え（同階層）テスト
 *
 * 自前D&D実装用に書き直し
 *
 * このテストスイートでは、同じ階層内でのタブの並び替えを検証します。
 * - ルートレベルのタブの並び替え
 * - 同じ親を持つ子タブの並び替え
 * - 複数の子を持つサブツリー内でのタブの並び替え
 * - ドラッグ中の視覚的フィードバック
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { reorderTabs, moveTabToParent, startDrag, dropTab, isDragging } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ドラッグ&ドロップによるタブの並び替え（同階層）', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);
  test('ルートレベルのタブを別のルートレベルのタブ間にドロップした場合、タブの表示順序が変更されること', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 3つのルートレベルのタブを作成
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

    // 実行: tab3をtab1の前にドラッグ&ドロップ
    await reorderTabs(sidePanelPage, tab3, tab1, 'before');

    // 検証: タブの順序が変更されたことをassertTabStructureで確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);
  });

  test('子タブを同じ親の他の子タブ間にドロップした場合、兄弟タブ間での順序が変更されること', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと子タブをルートレベルで作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    // 子タブをルートレベルで作成
    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    const child3 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: child3, depth: 0 },
    ], 0);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 0 },
      { tabId: child3, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: child3, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child3, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: child3, depth: 1 },
    ], 0);

    // 実行: child3をchild1の前にドラッグ&ドロップ
    await reorderTabs(sidePanelPage, child3, child1, 'before');

    // 検証: 子タブの順序が変更されたことをassertTabStructureで確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child3, depth: 1 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);
  });

  test('複数の子を持つサブツリー内でタブを並び替えた場合、他の子タブの順序が正しく調整されること', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 親タブと子タブをルートレベルで作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    // 子タブをルートレベルで作成
    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    const child3 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: child3, depth: 0 },
    ], 0);

    const child4 = await createTab(extensionContext, 'https://httpbin.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: child3, depth: 0 },
      { tabId: child4, depth: 0 },
    ], 0);

    // D&Dで親子関係を構築
    await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 0 },
      { tabId: child3, depth: 0 },
      { tabId: child4, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: child3, depth: 0 },
      { tabId: child4, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child3, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: child3, depth: 1 },
      { tabId: child4, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child4, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: child3, depth: 1 },
      { tabId: child4, depth: 1 },
    ], 0);

    // 実行: child2をchild4の後にドラッグ&ドロップ
    await reorderTabs(sidePanelPage, child2, child4, 'after');

    // 検証: タブの順序が変更されたことをassertTabStructureで確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 1 },
      { tabId: child3, depth: 1 },
      { tabId: child4, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);
  });

  test('ドラッグ中にis-draggingクラスが付与され、視覚的なフィードバックが表示されること', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 2つのルートレベルのタブを作成
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

    // 実行: tab2をドラッグ開始
    await startDrag(sidePanelPage, tab2);

    // 検証: ドラッグ状態を確認（is-draggingクラスの存在）
    // 自前D&D実装ではis-draggingクラスでドラッグ中を表現
    const dragging = await isDragging(sidePanelPage);
    expect(dragging).toBe(true);

    // クリーンアップ: ドロップを実行
    await dropTab(sidePanelPage);

    // ドロップ後はドラッグ状態が解除されることを確認
    await expect(async () => {
      const stillDragging = await isDragging(sidePanelPage);
      expect(stillDragging).toBe(false);
    }).toPass({ timeout: 2000 });

    // タブ構造をassertTabStructureで確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);
  });

  test('タブを自分より後ろの隙間にドロップした場合、正しい位置に配置されること', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 準備: 5つのルートレベルのタブを作成
    // タブA, タブB, タブC, タブD, タブE の順序で作成
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

    const tabD = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
    ], 0);

    const tabE = await createTab(extensionContext, 'https://httpbin.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabE, depth: 0 },
    ], 0);

    // 実行: tabBをtabDの後（tabEの前）にドラッグ&ドロップ
    // これは「自分より後ろの隙間への移動」のテストケース
    await reorderTabs(sidePanelPage, tabB, tabE, 'before');

    // 検証: タブの順序が正しいことをassertTabStructureで確認
    // 期待される順序: tabA, tabC, tabD, tabB, tabE
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabA, depth: 0 },
      { tabId: tabC, depth: 0 },
      { tabId: tabD, depth: 0 },
      { tabId: tabB, depth: 0 },
      { tabId: tabE, depth: 0 },
    ], 0);
  });
});
