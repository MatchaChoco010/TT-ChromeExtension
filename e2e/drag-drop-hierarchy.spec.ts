import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getPseudoSidePanelTabId, getCurrentWindowId, getInitialBrowserTabId } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ドラッグ&ドロップによる階層変更（親子関係の作成）', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);

  test('タブを別のタブに重ねてドロップした場合、ドロップ先タブの子として配置されること', async ({
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

    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 3000 });
  });

  test('子タブを持たないタブに初めて子タブを追加した場合、親タブに展開/折りたたみアイコンが表示されること', async ({
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

    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButtonBefore = parentNode.locator('[data-testid="expand-button"]');
    const hasExpandButtonBefore = (await expandButtonBefore.count()) > 0;

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    const expandButtonAfter = parentNode.locator('[data-testid="expand-button"]');

    if (!hasExpandButtonBefore) {
      await expect(expandButtonAfter.first()).toBeVisible({ timeout: 5000 });
    } else {
      await expect(async () => {
        const hasExpandButtonAfter = (await expandButtonAfter.count()) > 0;
        expect(hasExpandButtonAfter).toBe(true);
      }).toPass({ timeout: 3000 });
    }
  });

  test('折りたたまれた親タブに子タブをドロップした場合、親タブが自動的に展開されること', async ({
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

    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const existingChild = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: existingChild, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, existingChild, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: existingChild, depth: 1 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]').first();
    await expect(expandButton).toBeVisible({ timeout: 5000 });

    await expandButton.click();
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: false },
    ], 0);

    const newChild = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: false },
      { tabId: newChild, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, newChild, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: existingChild, depth: 1 },
      { tabId: newChild, depth: 1 },
    ], 0);
  });

  test('既に子を持つ親タブに新しい子をドロップした場合、子タブリストに追加されること', async ({
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

    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const newChild = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: newChild, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: newChild, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, newChild, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: newChild, depth: 1 },
    ], 0);
  });

  test('深い階層のタブを別の親にドロップした場合、depthが正しく再計算されること', async ({
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

    const rootTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
    ], 0);

    const parentTab1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab1, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const grandChildTab = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: grandChildTab, depth: 0 },
    ], 0);

    const parentTab2 = await createTab(extensionContext, 'https://github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: grandChildTab, depth: 0 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, parentTab1, rootTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab1, depth: 1 },
      { tabId: childTab, depth: 0 },
      { tabId: grandChildTab, depth: 0 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab1, depth: 1, expanded: true },
      { tabId: childTab, depth: 2 },
      { tabId: grandChildTab, depth: 0 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, grandChildTab, childTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab1, depth: 1, expanded: true },
      { tabId: childTab, depth: 2, expanded: true },
      { tabId: grandChildTab, depth: 3 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab2, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab1, depth: 1 },
      { tabId: parentTab2, depth: 0, expanded: true },
      { tabId: childTab, depth: 1, expanded: true },
      { tabId: grandChildTab, depth: 2 },
    ], 0);
  });

  test('D&Dで親子関係を作成した後、新規タブを開いても既存の親子関係が維持されること', async ({
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

    const parentTab = await createTab(extensionContext, 'https://example.com/parent-dnd');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://example.org/child-dnd');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    await sidePanelPage.waitForTimeout(3000);

    const _storageBeforeNewTab = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
          treeStructure?: unknown[];
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { error: 'No tree state' };
        }

        const parentNodeId = treeState.tabToNode[parentTabId];
        const childNodeId = treeState.tabToNode[childTabId];

        return {
          parentNodeId,
          childNodeId,
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
          treeStructureLength: treeState.treeStructure?.length ?? 0,
        };
      },
      { parentTabId: parentTab, childTabId: childTab }
    );

    const newTab = await createTab(extensionContext, '');

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: newTab, depth: 0 },
    ], 0);

    const _storageAfterNewTab = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
          treeStructure?: unknown[];
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { error: 'No tree state' };
        }

        const parentNodeId = treeState.tabToNode[parentTabId];
        const childNodeId = treeState.tabToNode[childTabId];

        return {
          parentNodeId,
          childNodeId,
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
          treeStructureLength: treeState.treeStructure?.length ?? 0,
        };
      },
      { parentTabId: parentTab, childTabId: childTab }
    );

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButtonAfterNewTab = parentNode.locator('[data-testid="expand-button"]');
    const hasExpandButton = await expandButtonAfterNewTab.count() > 0;
    expect(hasExpandButton).toBe(true);

    const relationsStillValid = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { valid: false, reason: 'No tree state' };
        }

        const parentNodeId = treeState.tabToNode[parentTabId];
        const childNodeId = treeState.tabToNode[childTabId];

        if (!parentNodeId || !childNodeId) {
          return {
            valid: false,
            reason: 'Missing node IDs',
            parentNodeId,
            childNodeId,
          };
        }

        const parentNode = treeState.nodes[parentNodeId];
        const childNode = treeState.nodes[childNodeId];

        if (!parentNode || !childNode) {
          return { valid: false, reason: 'Missing nodes' };
        }

        if (childNode.parentId !== parentNodeId) {
          return {
            valid: false,
            reason: 'Child should be child of parent',
            actualParentId: childNode.parentId,
            expectedParentId: parentNodeId,
          };
        }

        if (parentNode.depth !== 0 || childNode.depth !== 1) {
          return {
            valid: false,
            reason: 'Depth mismatch',
            parentDepth: parentNode.depth,
            childDepth: childNode.depth,
          };
        }

        return { valid: true };
      },
      { parentTabId: parentTab, childTabId: childTab }
    );

    expect(relationsStillValid).toEqual({ valid: true });
  });

  test('D&Dで複数の親子関係を作成した後、新規タブを開いても全ての親子関係が維持されること', async ({
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

    const parent1 = await createTab(extensionContext, 'https://example.com/parent1-multi');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://example.org/child1-multi');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const parent2 = await createTab(extensionContext, 'https://example.net/parent2-multi');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: parent2, depth: 0 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org/child2-multi');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: parent2, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1, parent1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: parent2, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, parent2, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: parent2, depth: 0, expanded: true },
      { tabId: child2, depth: 1 },
    ], 0);

    const newTab = await createTab(extensionContext, 'https://github.com/new-tab-multi');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: parent2, depth: 0, expanded: true },
      { tabId: child2, depth: 1 },
      { tabId: newTab, depth: 0 },
    ], 0);

    const allRelationsStillValid = await serviceWorker.evaluate(
      async ({ parent1Id, child1Id, parent2Id, child2Id }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { valid: false, reason: 'No tree state' };
        }

        const parent1NodeId = treeState.tabToNode[parent1Id];
        const child1NodeId = treeState.tabToNode[child1Id];
        if (!parent1NodeId || !child1NodeId) {
          return { valid: false, reason: 'Missing node IDs for relation 1' };
        }
        const child1Node = treeState.nodes[child1NodeId];
        if (!child1Node || child1Node.parentId !== parent1NodeId) {
          return {
            valid: false,
            reason: 'Relation 1 broken',
            actualParentId: child1Node?.parentId,
            expectedParentId: parent1NodeId,
          };
        }

        const parent2NodeId = treeState.tabToNode[parent2Id];
        const child2NodeId = treeState.tabToNode[child2Id];
        if (!parent2NodeId || !child2NodeId) {
          return { valid: false, reason: 'Missing node IDs for relation 2' };
        }
        const child2Node = treeState.nodes[child2NodeId];
        if (!child2Node || child2Node.parentId !== parent2NodeId) {
          return {
            valid: false,
            reason: 'Relation 2 broken',
            actualParentId: child2Node?.parentId,
            expectedParentId: parent2NodeId,
          };
        }

        return { valid: true };
      },
      { parent1Id: parent1, child1Id: child1, parent2Id: parent2, child2Id: child2 }
    );

    expect(allRelationsStillValid).toEqual({ valid: true });
  });

  test('D&Dで親子関係を作成した後、別のタブを閉じても既存の親子関係が維持されること', async ({
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

    const parentTab = await createTab(extensionContext, 'https://example.com/parent-close');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://example.org/child-close');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const unrelatedTab = await createTab(extensionContext, 'https://www.w3.org/unrelated-close');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: unrelatedTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: unrelatedTab, depth: 0 },
    ], 0);

    await closeTab(extensionContext, unrelatedTab);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    const relationsStillValid = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { valid: false, reason: 'No tree state' };
        }

        const parentNodeId = treeState.tabToNode[parentTabId];
        const childNodeId = treeState.tabToNode[childTabId];

        if (!parentNodeId || !childNodeId) {
          return {
            valid: false,
            reason: 'Missing node IDs',
            parentNodeId,
            childNodeId,
          };
        }

        const parentNode = treeState.nodes[parentNodeId];
        const childNode = treeState.nodes[childNodeId];

        if (!parentNode || !childNode) {
          return { valid: false, reason: 'Missing nodes' };
        }

        if (childNode.parentId !== parentNodeId) {
          return {
            valid: false,
            reason: 'Child should be child of parent',
            actualParentId: childNode.parentId,
            expectedParentId: parentNodeId,
          };
        }

        if (parentNode.depth !== 0 || childNode.depth !== 1) {
          return {
            valid: false,
            reason: 'Depth mismatch',
            parentDepth: parentNode.depth,
            childDepth: childNode.depth,
          };
        }

        return { valid: true };
      },
      { parentTabId: parentTab, childTabId: childTab }
    );

    expect(relationsStillValid).toEqual({ valid: true });
  });

  test('D&Dで親子関係を作成した後、新しいウィンドウを開いても既存の親子関係が維持されること', async ({
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

    const parentTab = await createTab(extensionContext, 'https://example.com/parent-window');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://example.org/child-window');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    await sidePanelPage.waitForTimeout(2000);

    const storageBeforeWindow = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
          treeStructure?: unknown[];
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { error: 'No tree state' };
        }

        const childNodeId = treeState.tabToNode[childTabId];

        return {
          childNodeId,
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
          treeStructureLength: treeState.treeStructure?.length ?? 0,
        };
      },
      { childTabId: childTab }
    );

    const newWindowId = await serviceWorker.evaluate(async () => {
      const newWindow = await chrome.windows.create({ type: 'normal' });
      return newWindow.id as number;
    });

    await sidePanelPage.waitForTimeout(2000);

    const storageAfterWindow = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
          treeStructure?: unknown[];
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { error: 'No tree state' };
        }

        const childNodeId = treeState.tabToNode[childTabId];

        return {
          childNodeId,
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
          treeStructureLength: treeState.treeStructure?.length ?? 0,
        };
      },
      { childTabId: childTab }
    );

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    expect(storageAfterWindow.childParentId).toBe(storageBeforeWindow.childParentId);
    expect(storageAfterWindow.childDepth).toBe(1);

    await serviceWorker.evaluate(async (windowId) => {
      await chrome.windows.remove(windowId);
    }, newWindowId);
  });

  test('D&Dで親子関係を作成した後、SYNC_TABSメッセージを送信しても既存の親子関係が維持されること', async ({
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

    const parentTab = await createTab(extensionContext, 'https://example.com/parent-sync');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://example.org/child-sync');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    await sidePanelPage.waitForTimeout(2000);

    const storageBeforeSync = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TreeNode { parentId: string | null; depth: number; }
        interface LocalTreeState { tabToNode: Record<number, string>; nodes: Record<string, TreeNode>; }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) return { error: 'No tree state' };

        const childNodeId = treeState.tabToNode[childTabId];
        return {
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
        };
      },
      { childTabId: childTab }
    );

    await serviceWorker.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SYNC_TABS' }, () => resolve());
      });
    });

    await sidePanelPage.waitForTimeout(2000);

    const storageAfterSync = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TreeNode { parentId: string | null; depth: number; }
        interface LocalTreeState { tabToNode: Record<number, string>; nodes: Record<string, TreeNode>; }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) return { error: 'No tree state' };

        const childNodeId = treeState.tabToNode[childTabId];
        return {
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
        };
      },
      { childTabId: childTab }
    );

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    expect(storageAfterSync.childParentId).toBe(storageBeforeSync.childParentId);
    expect(storageAfterSync.childDepth).toBe(1);
  });

  test('ストレージが破損した場合、背景の正しい状態から復元されること', async ({
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

    const parentTab = await createTab(extensionContext, 'https://example.com/parent-recover');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(extensionContext, 'https://example.org/child-recover');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    await sidePanelPage.waitForTimeout(2000);

    // REFRESH_TREE_STRUCTUREが失敗した場合をシミュレート
    await serviceWorker.evaluate(async () => {
      interface LocalTreeState {
        treeStructure?: unknown[];
        [key: string]: unknown;
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as LocalTreeState | undefined;
      if (treeState) {
        treeState.treeStructure = [];
        await chrome.storage.local.set({ tree_state: treeState });
      }
    });

    await serviceWorker.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SYNC_TABS' }, () => resolve());
      });
    });

    await sidePanelPage.waitForTimeout(2000);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);
  });
});
