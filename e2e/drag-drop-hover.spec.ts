import { test } from './fixtures/extension';
import type { Worker } from '@playwright/test';
import { createTab, refreshSidePanel, getCurrentWindowId } from './utils/tab-utils';
import { startDrag, hoverOverTab, dropTab, moveTabToParent } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

const AUTO_EXPAND_HOVER_DELAY_MS = 1000;

// Sets the expanded state of a node in storage by modifying tree_state directly
async function setNodeExpanded(serviceWorker: Worker, tabId: number, isExpanded: boolean): Promise<void> {
  await serviceWorker.evaluate(async ({ tabId, isExpanded }: { tabId: number; isExpanded: boolean }) => {
    interface TreeState {
      views: Record<string, { nodes: Record<string, { isExpanded: boolean }> }>;
      tabToNode: Record<number, { viewId: string; nodeId: string }>;
    }
    const result = await chrome.storage.local.get('tree_state');
    if (result.tree_state) {
      const treeState = result.tree_state as TreeState;
      const nodeInfo = treeState.tabToNode[tabId];
      if (nodeInfo) {
        const viewState = treeState.views[nodeInfo.viewId];
        if (viewState && viewState.nodes[nodeInfo.nodeId]) {
          viewState.nodes[nodeInfo.nodeId].isExpanded = isExpanded;
          await chrome.storage.local.set({ tree_state: treeState });
        }
      }
    }
  }, { tabId, isExpanded });
}

test.describe('ドラッグ&ドロップのホバー自動展開', () => {
  test.setTimeout(60000);

  test('折りたたまれた親タブの上にタブをホバーした場合、一定時間後に自動的に展開されること', async ({
    extensionContext,
    serviceWorker,
    }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const parentTab = await createTab(serviceWorker, 'data:text/html,<h1>Parent</h1>');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, 'data:text/html,<h1>Child</h1>');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const dragTab = await createTab(serviceWorker, 'data:text/html,<h1>Drag</h1>');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: dragTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: dragTab, depth: 0 },
    ], 0);

    await refreshSidePanel(serviceWorker, sidePanelPage);

    await setNodeExpanded(serviceWorker, parentTab, false);

    await refreshSidePanel(serviceWorker, sidePanelPage);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: false },
      { tabId: dragTab, depth: 0 },
    ], 0);

    await startDrag(sidePanelPage, dragTab);

    await hoverOverTab(sidePanelPage, parentTab);

    await sidePanelPage.waitForTimeout(AUTO_EXPAND_HOVER_DELAY_MS + 1000);

    const childTabSelector = `[data-testid="tree-node-${childTab}"]`;
    const childTabElement = sidePanelPage.locator(childTabSelector).first();
    await childTabElement.waitFor({ state: 'visible', timeout: 5000 });

    const viewport = sidePanelPage.viewportSize() || { width: 400, height: 600 };
    await sidePanelPage.mouse.move(30, viewport.height - 80, { steps: 5 });

    await dropTab(sidePanelPage);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: dragTab, depth: 1 },
    ], 0);
  });

  test('自動展開のタイムアウト前にホバーを離れた場合、その時点では展開されていないこと', async ({
    extensionContext,
    serviceWorker,
    }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const parentTab = await createTab(serviceWorker, 'data:text/html,<h1>Parent</h1>');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, 'data:text/html,<h1>Child</h1>');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const anotherTab = await createTab(serviceWorker, 'data:text/html,<h1>Another</h1>');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: anotherTab, depth: 0 },
    ], 0);

    const dragTab = await createTab(serviceWorker, 'data:text/html,<h1>Drag</h1>');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: anotherTab, depth: 0 },
      { tabId: dragTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: anotherTab, depth: 0 },
      { tabId: dragTab, depth: 0 },
    ], 0);

    await refreshSidePanel(serviceWorker, sidePanelPage);

    await setNodeExpanded(serviceWorker, parentTab, false);

    await refreshSidePanel(serviceWorker, sidePanelPage);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: false },
      { tabId: anotherTab, depth: 0 },
      { tabId: dragTab, depth: 0 },
    ], 0);

    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await startDrag(sidePanelPage, dragTab);

    await hoverOverTab(sidePanelPage, parentTab);

    await sidePanelPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    await hoverOverTab(sidePanelPage, anotherTab);

    await sidePanelPage.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

    const viewport = sidePanelPage.viewportSize() || { width: 400, height: 600 };
    await sidePanelPage.mouse.move(viewport.width / 2, viewport.height - 50, { steps: 5 });

    await dropTab(sidePanelPage);

    await sidePanelPage.waitForTimeout(AUTO_EXPAND_HOVER_DELAY_MS + 500);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: false },
      { tabId: anotherTab, depth: 0 },
      { tabId: dragTab, depth: 0 },
    ], 0);
  });

  test('深いツリー構造でルートノードへのホバーにより自動展開が機能すること', async ({
    extensionContext,
    serviceWorker,
    }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage, pseudoSidePanelTabId } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const level0 = await createTab(serviceWorker, 'data:text/html,<h1>Level0</h1>');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: level0, depth: 0 },
    ], 0);

    const level1 = await createTab(serviceWorker, 'data:text/html,<h1>Level1</h1>');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: level0, depth: 0 },
      { tabId: level1, depth: 0 },
    ], 0);

    const dragTab = await createTab(serviceWorker, 'data:text/html,<h1>Drag</h1>');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: level0, depth: 0 },
      { tabId: level1, depth: 0 },
      { tabId: dragTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, level1, level0);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: level0, depth: 0, expanded: true },
      { tabId: level1, depth: 1 },
      { tabId: dragTab, depth: 0 },
    ], 0);

    await refreshSidePanel(serviceWorker, sidePanelPage);

    await setNodeExpanded(serviceWorker, level0, false);

    await refreshSidePanel(serviceWorker, sidePanelPage);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: level0, depth: 0, expanded: false },
      { tabId: dragTab, depth: 0 },
    ], 0);

    await startDrag(sidePanelPage, dragTab);

    await hoverOverTab(sidePanelPage, level0);

    await sidePanelPage.waitForTimeout(AUTO_EXPAND_HOVER_DELAY_MS + 1000);

    const level1Selector = `[data-testid="tree-node-${level1}"]`;
    const level1Element = sidePanelPage.locator(level1Selector).first();
    await level1Element.waitFor({ state: 'visible', timeout: 5000 });

    const viewport = sidePanelPage.viewportSize() || { width: 400, height: 600 };
    await sidePanelPage.mouse.move(30, viewport.height - 80, { steps: 5 });

    await dropTab(sidePanelPage);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: level0, depth: 0, expanded: true },
      { tabId: level1, depth: 1 },
      { tabId: dragTab, depth: 1 },
    ], 0);
  });
});
