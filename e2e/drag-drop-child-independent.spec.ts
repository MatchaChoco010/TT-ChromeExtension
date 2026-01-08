import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { moveTabToParent, moveTabToRoot } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForCondition } from './utils/polling-utils';
import type { Worker } from '@playwright/test';

test.describe('子タブの独立ドラッグ操作', () => {
  test.setTimeout(120000);

  test('子タブをドラッグした際に親タブを追従させず、子タブのみ移動可能にすること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const otherParentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: otherParentTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: otherParentTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, otherParentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: otherParentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);
  });

  test('子タブを親から切り離して別の位置にドロップできること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
    ], 0);

    const childTab1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab1, depth: 0 },
    ], 0);

    const parentTab2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    const childTab2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab1, parentTab1, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0, expanded: true },
      { tabId: childTab1, depth: 1 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab2, parentTab2, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0, expanded: true },
      { tabId: childTab1, depth: 1 },
      { tabId: parentTab2, depth: 0, expanded: true },
      { tabId: childTab2, depth: 1 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab1, parentTab2, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0, expanded: true },
      { tabId: childTab2, depth: 1 },
      { tabId: childTab1, depth: 1 },
    ], 0);
  });

  test('孫タブをドラッグして別の親の子として移動できること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const rootTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const grandchildTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: grandchildTab, depth: 0 },
    ], 0);

    const otherRootTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: grandchildTab, depth: 0 },
      { tabId: otherRootTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, parentTab, rootTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab, depth: 1 },
      { tabId: grandchildTab, depth: 0 },
      { tabId: otherRootTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, grandchildTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab, depth: 1, expanded: true },
      { tabId: grandchildTab, depth: 2 },
      { tabId: otherRootTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, grandchildTab, otherRootTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab, depth: 1 },
      { tabId: otherRootTab, depth: 0, expanded: true },
      { tabId: grandchildTab, depth: 1 },
    ], 0);
  });

  test('子タブを移動しても元の親タブは移動しないこと', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab1, depth: 0 },
    ], 0);

    const childTab2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab1, depth: 0 },
      { tabId: childTab2, depth: 0 },
    ], 0);

    const otherParentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab1, depth: 0 },
      { tabId: childTab2, depth: 0 },
      { tabId: otherParentTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab1, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab1, depth: 1 },
      { tabId: childTab2, depth: 0 },
      { tabId: otherParentTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab2, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab1, depth: 1 },
      { tabId: childTab2, depth: 1 },
      { tabId: otherParentTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab1, otherParentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab2, depth: 1 },
      { tabId: otherParentTab, depth: 0, expanded: true },
      { tabId: childTab1, depth: 1 },
    ], 0);
  });
});

test.describe('親子関係解消の永続化', () => {
  test.setTimeout(120000);

  test('ドラッグで親子関係を解消し、ルートレベルに移動後も状態が維持されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToRoot(sidePanelPage, childTab, siblingTab);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);
  });

  test('親子関係解消後、元子タブからの操作で元親タブの子にならないこと', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const targetTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: targetTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: targetTab, depth: 0 },
    ], 0);

    await moveTabToRoot(sidePanelPage, childTab, targetTab);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: targetTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, targetTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: targetTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);
  });

  test('親子関係解消が永続化され、ストレージに正しく反映されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToRoot(sidePanelPage, childTab, siblingTab);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await waitForStorageParentNull(serviceWorker, childTab);
  });
});

/**
 * ストレージで親子関係が解消されるまでポーリングで待機
 */
async function waitForStorageParentNull(serviceWorker: Worker, childTabId: number): Promise<void> {
  await waitForCondition(
    async () => {
      interface TreeNode {
        id: string;
        tabId: number;
        parentId: string | null;
      }
      interface LocalTreeState {
        tabToNode: Record<number, string>;
        nodes: Record<string, TreeNode>;
      }
      const treeState = await serviceWorker.evaluate(async (_childId) => {
        const result = await chrome.storage.local.get('tree_state');
        return result.tree_state as LocalTreeState | undefined;
      }, childTabId);
      if (treeState?.nodes && treeState?.tabToNode) {
        const childNodeId = treeState.tabToNode[childTabId];
        if (childNodeId) {
          const childNode = treeState.nodes[childNodeId];
          if (childNode && childNode.parentId === null) {
            return true;
          }
        }
      }
      return false;
    },
    { timeout: 5000, interval: 50, timeoutMessage: `Parent of tab ${childTabId} was not set to null` }
  );
}

test.describe('元子タブからの新規タブ作成', () => {
  test.setTimeout(120000);

  test('親子関係解消後、元子タブからリンクを開くと元子タブの子タブになること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    const newTab = await createTab(extensionContext, 'about:blank', childTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0, expanded: true },
      { tabId: newTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);
  });

  test('親子関係解消後の元子タブからリンクを開いても元親タブの子にならないこと', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    const newTab1 = await createTab(extensionContext, 'about:blank', childTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0, expanded: true },
      { tabId: newTab1, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    const newTab2 = await createTab(extensionContext, 'about:blank', childTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0, expanded: true },
      { tabId: newTab1, depth: 1 },
      { tabId: newTab2, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);
  });
});

test.describe('親子関係解消の永続化（包括的テスト）', () => {
  test.setTimeout(120000);

  test('複数回の親子関係解消と再構築が一貫して動作すること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await waitForStorageParentNull(serviceWorker, childTab);
  });

  test('親子関係解消後の元子タブから作成した新規タブがさらに子タブを持てること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    const newTab1 = await createTab(extensionContext, 'about:blank', childTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0, expanded: true },
      { tabId: newTab1, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    const grandchildTab = await createTab(extensionContext, 'about:blank', newTab1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0, expanded: true },
      { tabId: newTab1, depth: 1, expanded: true },
      { tabId: grandchildTab, depth: 2 },
      { tabId: siblingTab, depth: 0 },
    ], 0);
  });

  test('親子関係解消後も別のタブへの親子関係構築が正しく動作すること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTab1 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
    ], 0);

    const parentTab2 = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const siblingTab = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab1, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: parentTab2, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToRoot(sidePanelPage, childTab, siblingTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: siblingTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab2, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: parentTab2, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: siblingTab, depth: 0 },
    ], 0);
  });
});
