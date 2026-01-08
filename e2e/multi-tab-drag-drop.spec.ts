import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, getTestServerUrl } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { startDrag, dropTab, waitForDragEnd } from './utils/drag-drop-utils';
import { setUserSettings } from './utils/settings-utils';

test.describe('複数タブのドラッグ&ドロップ', () => {
  test('複数選択したタブをドラッグ&ドロップすると全てのタブが移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 設定をリセット
    await setUserSettings(extensionContext, { newTabPositionManual: 'end' });
    await sidePanelPage.waitForTimeout(100);

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 5つのタブを作成
    const tabId1 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId2 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId3 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId4 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId5 = await createTab(extensionContext, getTestServerUrl('/page'));

    // 初期状態を確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
      { tabId: tabId4, depth: 0 },
      { tabId: tabId5, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // タブ1をクリックして選択
    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    // Shift+クリックでタブ3を選択（タブ1, 2, 3が選択される）
    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
    await tabNode3.click({ modifiers: ['Shift'] });

    // 選択状態を確認
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    // タブ2（選択されたタブの1つ）をドラッグして、タブ5の後にドロップ
    await startDrag(sidePanelPage, tabId2);

    // タブ5の下部にドロップ
    const tabNode5 = sidePanelPage.locator(`[data-testid="tree-node-${tabId5}"]`);
    const box5 = await tabNode5.boundingBox();
    if (!box5) throw new Error('tabNode5 not found');

    // タブ5の下部にマウスを移動（afterの位置）
    await sidePanelPage.mouse.move(box5.x + box5.width / 2, box5.y + box5.height * 0.85, { steps: 15 });
    await sidePanelPage.waitForTimeout(200);

    // ドロップインジケーターが表示されるのを待つ
    const dropIndicator = sidePanelPage.locator('[data-testid="drop-indicator"]');
    await expect(dropIndicator).toBeVisible({ timeout: 2000 });

    // ドロップ
    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    // ストレージ更新を待つ
    await sidePanelPage.waitForTimeout(300);

    // 全ての選択されたタブ（1, 2, 3）がタブ5の後に移動しているべき
    // 期待される順序: sidepanel, tab4, tab5, tab1, tab2, tab3
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId4, depth: 0 },
      { tabId: tabId5, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await closeTab(extensionContext, tabId2);
    await closeTab(extensionContext, tabId3);
    await closeTab(extensionContext, tabId4);
    await closeTab(extensionContext, tabId5);
  });

  test('Ctrl+クリックで飛び飛びに選択したタブをドラッグ&ドロップすると全てが移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 設定をリセット
    await setUserSettings(extensionContext, { newTabPositionManual: 'end' });
    await sidePanelPage.waitForTimeout(100);

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 5つのタブを作成
    const tabId1 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId2 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId3 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId4 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId5 = await createTab(extensionContext, getTestServerUrl('/page'));

    // 初期状態を確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
      { tabId: tabId4, depth: 0 },
      { tabId: tabId5, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // タブ1をクリックして選択
    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    // Ctrl+クリックでタブ3を追加選択（飛び飛び選択）
    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
    await tabNode3.click({ modifiers: ['Control'] });

    // Ctrl+クリックでタブ5を追加選択
    const tabNode5 = sidePanelPage.locator(`[data-testid="tree-node-${tabId5}"]`);
    await tabNode5.click({ modifiers: ['Control'] });

    // 選択状態を確認
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);
    await expect(tabNode5).toHaveClass(/bg-gray-500/);

    // タブ3（選択されたタブの1つ）をドラッグして、タブ2の前にドロップ
    await startDrag(sidePanelPage, tabId3);

    // タブ2の上部にドロップ
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    const box2 = await tabNode2.boundingBox();
    if (!box2) throw new Error('tabNode2 not found');

    // タブ2の上部にマウスを移動（beforeの位置）
    await sidePanelPage.mouse.move(box2.x + box2.width / 2, box2.y + box2.height * 0.15, { steps: 15 });
    await sidePanelPage.waitForTimeout(100);

    // ドロップ
    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    // ストレージ更新を待つ
    await sidePanelPage.waitForTimeout(300);

    // 全ての選択されたタブ（1, 3, 5）がタブ2の前に移動しているべき
    // 期待される順序: sidepanel, tab1, tab3, tab5, tab2, tab4
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId3, depth: 0 },
      { tabId: tabId5, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId4, depth: 0 },
    ], 0);

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await closeTab(extensionContext, tabId2);
    await closeTab(extensionContext, tabId3);
    await closeTab(extensionContext, tabId4);
    await closeTab(extensionContext, tabId5);
  });

  test('選択されていないタブをドラッグするとそのタブだけが移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 設定をリセット
    await setUserSettings(extensionContext, { newTabPositionManual: 'end' });
    await sidePanelPage.waitForTimeout(100);

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 4つのタブを作成
    const tabId1 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId2 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId3 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId4 = await createTab(extensionContext, getTestServerUrl('/page'));

    // 初期状態を確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
      { tabId: tabId4, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // タブ1, 2をShift+クリックで選択
    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    await tabNode1.click();
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    await tabNode2.click({ modifiers: ['Shift'] });

    // 選択状態を確認
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);

    // 選択されていないタブ3をドラッグ
    await startDrag(sidePanelPage, tabId3);

    // タブ4の後にドロップ
    const tabNode4 = sidePanelPage.locator(`[data-testid="tree-node-${tabId4}"]`);
    const box4 = await tabNode4.boundingBox();
    if (!box4) throw new Error('tabNode4 not found');

    await sidePanelPage.mouse.move(box4.x + box4.width / 2, box4.y + box4.height * 0.85, { steps: 15 });
    await sidePanelPage.waitForTimeout(100);

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    await sidePanelPage.waitForTimeout(300);

    // タブ3だけが移動し、選択は解除される
    // 期待される順序: sidepanel, tab1, tab2, tab4, tab3
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId4, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await closeTab(extensionContext, tabId2);
    await closeTab(extensionContext, tabId3);
    await closeTab(extensionContext, tabId4);
  });

  test('複数選択したタブを別のタブの子としてドロップすると全て子になる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 設定をリセット
    await setUserSettings(extensionContext, { newTabPositionManual: 'end' });
    await sidePanelPage.waitForTimeout(100);

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 4つのタブを作成
    const parentTabId = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId1 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId2 = await createTab(extensionContext, getTestServerUrl('/page'));
    const tabId3 = await createTab(extensionContext, getTestServerUrl('/page'));

    // 初期状態を確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // タブ1, 2, 3をShift+クリックで選択
    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    await tabNode1.click();
    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
    await tabNode3.click({ modifiers: ['Shift'] });

    // 選択状態を確認
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    // タブ2をドラッグして、parentTabの中央にドロップ（子として追加）
    await startDrag(sidePanelPage, tabId2);

    // parentTabの中央にドロップ
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
    const boxParent = await parentNode.boundingBox();
    if (!boxParent) throw new Error('parentNode not found');

    await sidePanelPage.mouse.move(boxParent.x + boxParent.width / 2, boxParent.y + boxParent.height / 2, { steps: 15 });
    await sidePanelPage.waitForTimeout(100);

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    await sidePanelPage.waitForTimeout(300);

    // 全ての選択されたタブ（1, 2, 3）がparentTabの子になる
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: tabId1, depth: 1 },
      { tabId: tabId2, depth: 1 },
      { tabId: tabId3, depth: 1 },
    ], 0);

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await closeTab(extensionContext, tabId2);
    await closeTab(extensionContext, tabId3);
    await closeTab(extensionContext, parentTabId);
  });
});
