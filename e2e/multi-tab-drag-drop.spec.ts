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

    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
    await tabNode3.click({ modifiers: ['Shift'] });

    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    await startDrag(sidePanelPage, tabId2);

    const tabNode5 = sidePanelPage.locator(`[data-testid="tree-node-${tabId5}"]`);
    const box5 = await tabNode5.boundingBox();
    if (!box5) throw new Error('tabNode5 not found');

    await sidePanelPage.mouse.move(box5.x + box5.width / 2, box5.y + box5.height * 0.85, { steps: 1 });

    const dropIndicator = sidePanelPage.locator('[data-testid="drop-indicator"]');
    await expect(dropIndicator).toBeVisible({ timeout: 2000 });

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

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

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
    await tabNode3.click({ modifiers: ['Control'] });

    const tabNode5 = sidePanelPage.locator(`[data-testid="tree-node-${tabId5}"]`);
    await tabNode5.click({ modifiers: ['Control'] });

    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);
    await expect(tabNode5).toHaveClass(/bg-gray-500/);

    await startDrag(sidePanelPage, tabId3);

    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    const box2 = await tabNode2.boundingBox();
    if (!box2) throw new Error('tabNode2 not found');

    await sidePanelPage.mouse.move(box2.x + box2.width / 2, box2.y + box2.height * 0.15, { steps: 1 });

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId3, depth: 0 },
      { tabId: tabId5, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId4, depth: 0 },
    ], 0);

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

    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId4 = await createTab(serviceWorker, getTestServerUrl('/page'));

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
      { tabId: tabId4, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    await tabNode1.click();
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    await tabNode2.click({ modifiers: ['Shift'] });

    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);

    await startDrag(sidePanelPage, tabId3);

    const tabNode4 = sidePanelPage.locator(`[data-testid="tree-node-${tabId4}"]`);
    const box4 = await tabNode4.boundingBox();
    if (!box4) throw new Error('tabNode4 not found');

    await sidePanelPage.mouse.move(box4.x + box4.width / 2, box4.y + box4.height * 0.85, { steps: 1 });

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

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

    const parentTabId = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    const tabId3 = await createTab(serviceWorker, getTestServerUrl('/page'));

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: tabId1, depth: 0 },
      { tabId: tabId2, depth: 0 },
      { tabId: tabId3, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    await tabNode1.click();
    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
    await tabNode3.click({ modifiers: ['Shift'] });

    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    await startDrag(sidePanelPage, tabId2);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
    const boxParent = await parentNode.boundingBox();
    if (!boxParent) throw new Error('parentNode not found');

    await sidePanelPage.mouse.move(boxParent.x + boxParent.width / 2, boxParent.y + boxParent.height / 2, { steps: 1 });

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0, expanded: true },
      { tabId: tabId1, depth: 1 },
      { tabId: tabId2, depth: 1 },
      { tabId: tabId3, depth: 1 },
    ], 0);

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

    const targetTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentA, depth: 0, expanded: true },
      { tabId: childA1, depth: 1 },
      { tabId: childA2, depth: 1 },
      { tabId: targetTab, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const parentNodeA = sidePanelPage.locator(`[data-testid="tree-node-${parentA}"]`);
    await parentNodeA.click();
    await expect(parentNodeA).toHaveClass(/bg-gray-500/);

    const childNodeA2 = sidePanelPage.locator(`[data-testid="tree-node-${childA2}"]`);
    await childNodeA2.click({ modifiers: ['Shift'] });

    const childNodeA1 = sidePanelPage.locator(`[data-testid="tree-node-${childA1}"]`);
    await expect(parentNodeA).toHaveClass(/bg-gray-500/);
    await expect(childNodeA1).toHaveClass(/bg-gray-500/);
    await expect(childNodeA2).toHaveClass(/bg-gray-500/);

    await startDrag(sidePanelPage, parentA);

    const targetNode = sidePanelPage.locator(`[data-testid="tree-node-${targetTab}"]`);
    const boxTarget = await targetNode.boundingBox();
    if (!boxTarget) throw new Error('targetNode not found');

    await sidePanelPage.mouse.move(boxTarget.x + boxTarget.width / 2, boxTarget.y + boxTarget.height / 2, { steps: 1 });

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: targetTab, depth: 0, expanded: true },
      { tabId: parentA, depth: 1, expanded: true },
      { tabId: childA1, depth: 2 },
      { tabId: childA2, depth: 2 },
    ], 0);

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

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parent}"]`);
    await parentNode.click();
    await expect(parentNode).toHaveClass(/bg-gray-500/);

    const grandchildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandchild}"]`);
    await grandchildNode.click({ modifiers: ['Shift'] });

    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${child}"]`);
    await expect(parentNode).toHaveClass(/bg-gray-500/);
    await expect(childNode).toHaveClass(/bg-gray-500/);
    await expect(grandchildNode).toHaveClass(/bg-gray-500/);

    await startDrag(sidePanelPage, parent);

    const targetNode = sidePanelPage.locator(`[data-testid="tree-node-${targetTab}"]`);
    const boxTarget = await targetNode.boundingBox();
    if (!boxTarget) throw new Error('targetNode not found');

    await sidePanelPage.mouse.move(boxTarget.x + boxTarget.width / 2, boxTarget.y + boxTarget.height * 0.85, { steps: 1 });

    await dropTab(sidePanelPage);
    await waitForDragEnd(sidePanelPage, 2000);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: grandparent, depth: 0 },
      { tabId: targetTab, depth: 0 },
      { tabId: parent, depth: 0, expanded: true },
      { tabId: child, depth: 1, expanded: true },
      { tabId: grandchild, depth: 2 },
    ], 0);

    await closeTab(serviceWorker, grandchild);
    await closeTab(serviceWorker, child);
    await closeTab(serviceWorker, parent);
    await closeTab(serviceWorker, grandparent);
    await closeTab(serviceWorker, targetTab);
  });
});
