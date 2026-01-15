import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { startDrag, dropTab, waitForDragEnd } from './utils/drag-drop-utils';
import { setUserSettings } from './utils/settings-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('複数タブのドラッグ&ドロップ', () => {
  test('複数選択したタブをドラッグ&ドロップすると全てのタブが移動する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    await setUserSettings(extensionContext, { newTabPositionManual: 'end' });

    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    // 5つのタブを作成
    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId4 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId5 = await createTab(serviceWorker, getTestServerUrl('/page'));

    // 初期状態を確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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
    await sidePanelPage.mouse.move(box5.x + box5.width / 2, box5.y + box5.height * 0.85, { steps: 1 });

    // ドロップインジケーターが表示されるのを待つ
    const dropIndicator = sidePanelPage.locator('[data-testid="drop-indicator"]');
    await expect(dropIndicator).toBeVisible({ timeout: 2000 });

    // ドロップ
    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    // 全ての選択されたタブ（1, 2, 3）がタブ5の後に移動しているべき
    // 期待される順序: initialBrowserTab, sidepanel, tab4, tab5, tab1, tab2, tab3
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId4, depth: 0 },
      { tabId: tabId5, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    // クリーンアップ
    await closeTab(serviceWorker, tabId1);
    await closeTab(serviceWorker, tabId2);
    await closeTab(serviceWorker, tabId3);
    await closeTab(serviceWorker, tabId4);
    await closeTab(serviceWorker, tabId5);
  });

  test('Ctrl+クリックで飛び飛びに選択したタブをドラッグ&ドロップすると全てが移動する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    await setUserSettings(extensionContext, { newTabPositionManual: 'end' });

    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    // 5つのタブを作成
    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId4 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId5 = await createTab(serviceWorker, getTestServerUrl('/page'));

    // 初期状態を確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await sidePanelPage.mouse.move(box2.x + box2.width / 2, box2.y + box2.height * 0.15, { steps: 1 });

    // ドロップ
    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    // 全ての選択されたタブ（1, 3, 5）がタブ2の前に移動しているべき
    // 期待される順序: initialBrowserTab, sidepanel, tab1, tab3, tab5, tab2, tab4
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId3, depth: 0 },
      { tabId: tabId5, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId4, depth: 0 },
    ], 0);

    // クリーンアップ
    await closeTab(serviceWorker, tabId1);
    await closeTab(serviceWorker, tabId2);
    await closeTab(serviceWorker, tabId3);
    await closeTab(serviceWorker, tabId4);
    await closeTab(serviceWorker, tabId5);
  });

  test('選択されていないタブをドラッグするとそのタブだけが移動する', async ({
    extensionContext,
    serviceWorker,
  }) => {
    await setUserSettings(extensionContext, { newTabPositionManual: 'end' });

    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    // 4つのタブを作成
    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId4 = await createTab(serviceWorker, getTestServerUrl('/page'));

    // 初期状態を確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await sidePanelPage.mouse.move(box4.x + box4.width / 2, box4.y + box4.height * 0.85, { steps: 1 });

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    // タブ3だけが移動し、選択は解除される
    // 期待される順序: initialBrowserTab, sidepanel, tab1, tab2, tab4, tab3
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId4, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    // クリーンアップ
    await closeTab(serviceWorker, tabId1);
    await closeTab(serviceWorker, tabId2);
    await closeTab(serviceWorker, tabId3);
    await closeTab(serviceWorker, tabId4);
  });

  test('複数選択したタブを別のタブの子としてドロップすると全て子になる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    await setUserSettings(extensionContext, { newTabPositionManual: 'end' });

    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    // 4つのタブを作成
    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));

    // 初期状態を確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
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

    await sidePanelPage.mouse.move(boxParent.x + boxParent.width / 2, boxParent.y + boxParent.height / 2, { steps: 1 });

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    // 全ての選択されたタブ（1, 2, 3）がparentTabの子になる
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: tabId1, depth: 1 },
      { tabId: tabId2, depth: 1 },
      { tabId: tabId3, depth: 1 },
    ], 0);

    // クリーンアップ
    await closeTab(serviceWorker, tabId1);
    await closeTab(serviceWorker, tabId2);
    await closeTab(serviceWorker, tabId3);
    await closeTab(serviceWorker, parentTabId);
  });

  test('親タブと子タブを同時に選択してドラッグするとサブツリー構造が保持される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    await setUserSettings(extensionContext, { newTabPositionManual: 'end' });

    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    // 親タブと子タブを作成
    const parentA = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentA, depth: 0 },
    ], 0);

    const childA1 = await createTab(serviceWorker, getTestServerUrl('/page'), parentA);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentA, depth: 0, expanded: true },
      { tabId: childA1, depth: 1 },
    ], 0);

    const childA2 = await createTab(serviceWorker, getTestServerUrl('/page'), parentA);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentA, depth: 0, expanded: true },
      { tabId: childA1, depth: 1 },
      { tabId: childA2, depth: 1 },
    ], 0);

    // ドロップターゲットとなるタブを作成
    const targetTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentA, depth: 0, expanded: true },
      { tabId: childA1, depth: 1 },
      { tabId: childA2, depth: 1 },
      { tabId: targetTab, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // 親タブと子タブを複数選択（親Aとその子A1, A2）
    const parentNodeA = sidePanelPage.locator(`[data-testid="tree-node-${parentA}"]`);
    await parentNodeA.click();
    await expect(parentNodeA).toHaveClass(/bg-gray-500/);

    // Shift+クリックで子タブA2まで選択（親A, 子A1, 子A2が選択される）
    const childNodeA2 = sidePanelPage.locator(`[data-testid="tree-node-${childA2}"]`);
    await childNodeA2.click({ modifiers: ['Shift'] });

    // 全ての選択状態を確認
    const childNodeA1 = sidePanelPage.locator(`[data-testid="tree-node-${childA1}"]`);
    await expect(parentNodeA).toHaveClass(/bg-gray-500/);
    await expect(childNodeA1).toHaveClass(/bg-gray-500/);
    await expect(childNodeA2).toHaveClass(/bg-gray-500/);

    // 親タブをドラッグして、targetTabの子としてドロップ
    await startDrag(sidePanelPage, parentA);

    const targetNode = sidePanelPage.locator(`[data-testid="tree-node-${targetTab}"]`);
    const boxTarget = await targetNode.boundingBox();
    if (!boxTarget) throw new Error('targetNode not found');

    // targetTabの中央にドロップ（子として追加）
    await sidePanelPage.mouse.move(boxTarget.x + boxTarget.width / 2, boxTarget.y + boxTarget.height / 2, { steps: 1 });

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    // サブツリー構造が保持されていることを確認
    // 親AとそのchildA1, childA2がtargetTabの子として移動し、
    // 親子関係（A -> A1, A2）が維持される
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: targetTab, depth: 0, expanded: true },
      { tabId: parentA, depth: 1, expanded: true },
      { tabId: childA1, depth: 2 },
      { tabId: childA2, depth: 2 },
    ], 0);

    // クリーンアップ
    await closeTab(serviceWorker, childA1);
    await closeTab(serviceWorker, childA2);
    await closeTab(serviceWorker, parentA);
    await closeTab(serviceWorker, targetTab);
  });

  test('深いネストのサブツリーを複数選択してドラッグしても構造が保持される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    await setUserSettings(extensionContext, { newTabPositionManual: 'end' });

    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    // 深いネスト構造を作成: grandparent -> parent -> child -> grandchild
    const grandparent = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: grandparent, depth: 0 },
    ], 0);

    const parent = await createTab(serviceWorker, getTestServerUrl('/page'), grandparent);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: grandparent, depth: 0, expanded: true },
      { tabId: parent, depth: 1 },
    ], 0);

    const child = await createTab(serviceWorker, getTestServerUrl('/page'), parent);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: grandparent, depth: 0, expanded: true },
      { tabId: parent, depth: 1, expanded: true },
      { tabId: child, depth: 2 },
    ], 0);

    const grandchild = await createTab(serviceWorker, getTestServerUrl('/page'), child);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: grandparent, depth: 0, expanded: true },
      { tabId: parent, depth: 1, expanded: true },
      { tabId: child, depth: 2, expanded: true },
      { tabId: grandchild, depth: 3 },
    ], 0);

    // ドロップターゲットとなるタブを作成
    const targetTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: grandparent, depth: 0, expanded: true },
      { tabId: parent, depth: 1, expanded: true },
      { tabId: child, depth: 2, expanded: true },
      { tabId: grandchild, depth: 3 },
      { tabId: targetTab, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // サブツリー全体を選択（parent以下: parent, child, grandchild）
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parent}"]`);
    await parentNode.click();
    await expect(parentNode).toHaveClass(/bg-gray-500/);

    // Shift+クリックでgrandchildまで選択
    const grandchildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandchild}"]`);
    await grandchildNode.click({ modifiers: ['Shift'] });

    // 選択状態を確認
    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${child}"]`);
    await expect(parentNode).toHaveClass(/bg-gray-500/);
    await expect(childNode).toHaveClass(/bg-gray-500/);
    await expect(grandchildNode).toHaveClass(/bg-gray-500/);

    // parentをドラッグして、targetTabの後に兄弟として配置
    await startDrag(sidePanelPage, parent);

    const targetNode = sidePanelPage.locator(`[data-testid="tree-node-${targetTab}"]`);
    const boxTarget = await targetNode.boundingBox();
    if (!boxTarget) throw new Error('targetNode not found');

    // targetTabの下部にドロップ（afterの位置）
    await sidePanelPage.mouse.move(boxTarget.x + boxTarget.width / 2, boxTarget.y + boxTarget.height * 0.85, { steps: 1 });

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    // サブツリー構造が保持されていることを確認
    // parent -> child -> grandchildの階層構造が維持される
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: grandparent, depth: 0 },
      { tabId: targetTab, depth: 0 },
      { tabId: parent, depth: 0, expanded: true },
      { tabId: child, depth: 1, expanded: true },
      { tabId: grandchild, depth: 2 },
    ], 0);

    // クリーンアップ
    await closeTab(serviceWorker, grandchild);
    await closeTab(serviceWorker, child);
    await closeTab(serviceWorker, parent);
    await closeTab(serviceWorker, grandparent);
    await closeTab(serviceWorker, targetTab);
  });
});
