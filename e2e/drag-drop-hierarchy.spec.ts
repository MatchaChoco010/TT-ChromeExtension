import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getTestServerUrl, getCurrentWindowId } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { setupWindow } from './utils/setup-utils';

test.describe('ドラッグ&ドロップによる階層変更（親子関係の作成）', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);

  test('タブを別のタブに重ねてドロップした場合、ドロップ先タブの子として配置されること', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    // 展開中はホバーでオーバーレイが表示されるので、まずホバーする
    await parentNode.hover();
    const expandOverlay = parentNode.locator('[data-testid="expand-overlay"]');
    await expect(expandOverlay.first()).toBeVisible({ timeout: 3000 });
  });

  test('子タブを持たないタブに初めて子タブを追加した場合、親タブに展開/折りたたみオーバーレイが表示されること', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    // 子タブがない状態ではオーバーレイは表示されない
    await parentNode.hover();
    const expandOverlayBefore = parentNode.locator('[data-testid="expand-overlay"]');
    const hasExpandOverlayBefore = (await expandOverlayBefore.count()) > 0;

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    // 展開中はホバーでオーバーレイが表示されるので、まずホバーする
    await parentNode.hover();
    const expandOverlayAfter = parentNode.locator('[data-testid="expand-overlay"]');

    if (!hasExpandOverlayBefore) {
      await expect(expandOverlayAfter.first()).toBeVisible({ timeout: 5000 });
    } else {
      await expect(async () => {
        const hasExpandOverlayAfter = (await expandOverlayAfter.count()) > 0;
        expect(hasExpandOverlayAfter).toBe(true);
      }).toPass({ timeout: 3000 });
    }
  });

  test('折りたたまれた親タブに子タブをドロップした場合、親タブが自動的に展開されること', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const existingChild = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: existingChild, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, existingChild, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: existingChild, depth: 1 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    // 展開中はホバーでオーバーレイが表示されるので、まずホバーする
    await parentNode.hover();
    const expandOverlay = parentNode.locator('[data-testid="expand-overlay"]').first();
    await expect(expandOverlay).toBeVisible({ timeout: 5000 });

    await expandOverlay.click();
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: false },
    ], 0);

    const newChild = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: false },
      { tabId: newChild, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, newChild, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: existingChild, depth: 1 },
      { tabId: newChild, depth: 1 },
    ], 0);
  });

  test('既に子を持つ親タブに新しい子をドロップした場合、子タブリストに追加されること', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const child1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const newChild = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: newChild, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: newChild, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, newChild, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: newChild, depth: 1 },
    ], 0);
  });

  test('深い階層のタブを別の親にドロップした場合、depthが正しく再計算されること', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const rootTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
    ], 0);

    const parentTab1 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab1, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const grandChildTab = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: grandChildTab, depth: 0 },
    ], 0);

    const parentTab2 = await createTab(serviceWorker, getTestServerUrl('/page'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: parentTab1, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: grandChildTab, depth: 0 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, parentTab1, rootTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab1, depth: 1 },
      { tabId: childTab, depth: 0 },
      { tabId: grandChildTab, depth: 0 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab1, depth: 1, expanded: true },
      { tabId: childTab, depth: 2 },
      { tabId: grandChildTab, depth: 0 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, grandChildTab, childTab, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab1, depth: 1, expanded: true },
      { tabId: childTab, depth: 2, expanded: true },
      { tabId: grandChildTab, depth: 3 },
      { tabId: parentTab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab2, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: rootTab, depth: 0, expanded: true },
      { tabId: parentTab1, depth: 1 },
      { tabId: parentTab2, depth: 0, expanded: true },
      { tabId: childTab, depth: 1, expanded: true },
      { tabId: grandChildTab, depth: 2 },
    ], 0);
  });

  test('D&Dで親子関係を作成した後、新規タブを開いても既存の親子関係が維持されること', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/parent-dnd'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, getTestServerUrl('/child-dnd'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    const _storageBeforeNewTab = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }

        const findNodeWithParent = (
          tabId: number,
          nodes: TabNode[],
          parentTabId: number | null,
          depth: number
        ): { found: boolean; parentTabId: number | null; depth: number } | null => {
          for (const node of nodes) {
            if (node.tabId === tabId) {
              return { found: true, parentTabId, depth };
            }
            const result = findNodeWithParent(tabId, node.children, node.tabId, depth + 1);
            if (result) return result;
          }
          return null;
        };

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) {
          return { error: 'No tree state' };
        }

        let childInfo: { parentTabId: number | null; depth: number } | null = null;
        let parentExists = false;

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const childResult = findNodeWithParent(childTabId, view.rootNodes, null, 0);
            if (childResult) {
              childInfo = { parentTabId: childResult.parentTabId, depth: childResult.depth };
            }
            const parentResult = findNodeWithParent(parentTabId, view.rootNodes, null, 0);
            if (parentResult) {
              parentExists = true;
            }
          }
        }

        return {
          parentExists,
          childParentTabId: childInfo?.parentTabId ?? null,
          childDepth: childInfo?.depth ?? null,
        };
      },
      { parentTabId: parentTab, childTabId: childTab }
    );

    const newTab = await createTab(serviceWorker, getTestServerUrl('/page'));

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: newTab, depth: 0 },
    ], 0);

    const _storageAfterNewTab = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }

        const findNodeWithParent = (
          tabId: number,
          nodes: TabNode[],
          parentTabId: number | null,
          depth: number
        ): { found: boolean; parentTabId: number | null; depth: number } | null => {
          for (const node of nodes) {
            if (node.tabId === tabId) {
              return { found: true, parentTabId, depth };
            }
            const result = findNodeWithParent(tabId, node.children, node.tabId, depth + 1);
            if (result) return result;
          }
          return null;
        };

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) {
          return { error: 'No tree state' };
        }

        let childInfo: { parentTabId: number | null; depth: number } | null = null;
        let parentExists = false;

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const childResult = findNodeWithParent(childTabId, view.rootNodes, null, 0);
            if (childResult) {
              childInfo = { parentTabId: childResult.parentTabId, depth: childResult.depth };
            }
            const parentResult = findNodeWithParent(parentTabId, view.rootNodes, null, 0);
            if (parentResult) {
              parentExists = true;
            }
          }
        }

        return {
          parentExists,
          childParentTabId: childInfo?.parentTabId ?? null,
          childDepth: childInfo?.depth ?? null,
        };
      },
      { parentTabId: parentTab, childTabId: childTab }
    );

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    // 展開中はホバーでオーバーレイが表示されるので、まずホバーする
    await parentNode.hover();
    const expandOverlayAfterNewTab = parentNode.locator('[data-testid="expand-overlay"]');
    const hasExpandOverlay = await expandOverlayAfterNewTab.count() > 0;
    expect(hasExpandOverlay).toBe(true);

    const relationsStillValid = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }

        const findNodeWithParent = (
          tabId: number,
          nodes: TabNode[],
          parentTabId: number | null,
          depth: number
        ): { found: boolean; parentTabId: number | null; depth: number } | null => {
          for (const node of nodes) {
            if (node.tabId === tabId) {
              return { found: true, parentTabId, depth };
            }
            const result = findNodeWithParent(tabId, node.children, node.tabId, depth + 1);
            if (result) return result;
          }
          return null;
        };

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) {
          return { valid: false, reason: 'No tree state' };
        }

        let parentInfo: { depth: number } | null = null;
        let childInfo: { parentTabId: number | null; depth: number } | null = null;

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const parentResult = findNodeWithParent(parentTabId, view.rootNodes, null, 0);
            if (parentResult) {
              parentInfo = { depth: parentResult.depth };
            }
            const childResult = findNodeWithParent(childTabId, view.rootNodes, null, 0);
            if (childResult) {
              childInfo = { parentTabId: childResult.parentTabId, depth: childResult.depth };
            }
          }
        }

        if (!parentInfo || !childInfo) {
          return { valid: false, reason: 'Missing nodes' };
        }

        if (childInfo.parentTabId !== parentTabId) {
          return {
            valid: false,
            reason: 'Child should be child of parent',
            actualParentTabId: childInfo.parentTabId,
            expectedParentTabId: parentTabId,
          };
        }

        if (parentInfo.depth !== 0 || childInfo.depth !== 1) {
          return {
            valid: false,
            reason: 'Depth mismatch',
            parentDepth: parentInfo.depth,
            childDepth: childInfo.depth,
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
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parent1 = await createTab(serviceWorker, getTestServerUrl('/parent1-multi'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
    ], 0);

    const child1 = await createTab(serviceWorker, getTestServerUrl('/child1-multi'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const parent2 = await createTab(serviceWorker, getTestServerUrl('/parent2-multi'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: parent2, depth: 0 },
    ], 0);

    const child2 = await createTab(serviceWorker, getTestServerUrl('/child2-multi'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: parent2, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1, parent1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: parent2, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, parent2, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: parent2, depth: 0, expanded: true },
      { tabId: child2, depth: 1 },
    ], 0);

    const newTab = await createTab(serviceWorker, getTestServerUrl('/new-tab-multi'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: parent2, depth: 0, expanded: true },
      { tabId: child2, depth: 1 },
      { tabId: newTab, depth: 0 },
    ], 0);

    const allRelationsStillValid = await serviceWorker.evaluate(
      async ({ parent1Id, child1Id, parent2Id, child2Id }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }

        const findNodeWithParent = (
          tabId: number,
          nodes: TabNode[],
          parentTabId: number | null,
        ): { found: boolean; parentTabId: number | null } | null => {
          for (const node of nodes) {
            if (node.tabId === tabId) {
              return { found: true, parentTabId };
            }
            const result = findNodeWithParent(tabId, node.children, node.tabId);
            if (result) return result;
          }
          return null;
        };

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) {
          return { valid: false, reason: 'No tree state' };
        }

        let child1Info: { parentTabId: number | null } | null = null;
        let child2Info: { parentTabId: number | null } | null = null;

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const child1Result = findNodeWithParent(child1Id, view.rootNodes, null);
            if (child1Result) {
              child1Info = { parentTabId: child1Result.parentTabId };
            }
            const child2Result = findNodeWithParent(child2Id, view.rootNodes, null);
            if (child2Result) {
              child2Info = { parentTabId: child2Result.parentTabId };
            }
          }
        }

        if (!child1Info || child1Info.parentTabId !== parent1Id) {
          return {
            valid: false,
            reason: 'Relation 1 broken',
            actualParentTabId: child1Info?.parentTabId,
            expectedParentTabId: parent1Id,
          };
        }

        if (!child2Info || child2Info.parentTabId !== parent2Id) {
          return {
            valid: false,
            reason: 'Relation 2 broken',
            actualParentTabId: child2Info?.parentTabId,
            expectedParentTabId: parent2Id,
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
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/parent-close'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, getTestServerUrl('/child-close'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    const unrelatedTab = await createTab(serviceWorker, getTestServerUrl('/unrelated-close'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
      { tabId: unrelatedTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
      { tabId: unrelatedTab, depth: 0 },
    ], 0);

    await closeTab(serviceWorker, unrelatedTab);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    const relationsStillValid = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }

        const findNodeWithParent = (
          tabId: number,
          nodes: TabNode[],
          parentTabId: number | null,
          depth: number
        ): { found: boolean; parentTabId: number | null; depth: number } | null => {
          for (const node of nodes) {
            if (node.tabId === tabId) {
              return { found: true, parentTabId, depth };
            }
            const result = findNodeWithParent(tabId, node.children, node.tabId, depth + 1);
            if (result) return result;
          }
          return null;
        };

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) {
          return { valid: false, reason: 'No tree state' };
        }

        let parentInfo: { depth: number } | null = null;
        let childInfo: { parentTabId: number | null; depth: number } | null = null;

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const parentResult = findNodeWithParent(parentTabId, view.rootNodes, null, 0);
            if (parentResult) {
              parentInfo = { depth: parentResult.depth };
            }
            const childResult = findNodeWithParent(childTabId, view.rootNodes, null, 0);
            if (childResult) {
              childInfo = { parentTabId: childResult.parentTabId, depth: childResult.depth };
            }
          }
        }

        if (!parentInfo || !childInfo) {
          return { valid: false, reason: 'Missing nodes' };
        }

        if (childInfo.parentTabId !== parentTabId) {
          return {
            valid: false,
            reason: 'Child should be child of parent',
            actualParentTabId: childInfo.parentTabId,
            expectedParentTabId: parentTabId,
          };
        }

        if (parentInfo.depth !== 0 || childInfo.depth !== 1) {
          return {
            valid: false,
            reason: 'Depth mismatch',
            parentDepth: parentInfo.depth,
            childDepth: childInfo.depth,
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
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/parent-window'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, getTestServerUrl('/child-window'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    const storageBeforeWindow = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }

        const findNodeWithParent = (
          tabId: number,
          nodes: TabNode[],
          parentTabId: number | null,
          depth: number
        ): { found: boolean; parentTabId: number | null; depth: number } | null => {
          for (const node of nodes) {
            if (node.tabId === tabId) {
              return { found: true, parentTabId, depth };
            }
            const result = findNodeWithParent(tabId, node.children, node.tabId, depth + 1);
            if (result) return result;
          }
          return null;
        };

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) {
          return { error: 'No tree state' };
        }

        let childInfo: { parentTabId: number | null; depth: number } | null = null;

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const childResult = findNodeWithParent(childTabId, view.rootNodes, null, 0);
            if (childResult) {
              childInfo = { parentTabId: childResult.parentTabId, depth: childResult.depth };
            }
          }
        }

        return {
          childParentTabId: childInfo?.parentTabId ?? null,
          childDepth: childInfo?.depth ?? null,
        };
      },
      { childTabId: childTab }
    );

    const newWindowId = await serviceWorker.evaluate(async () => {
      const newWindow = await chrome.windows.create({ type: 'normal' });
      return newWindow.id as number;
    });

    const storageAfterWindow = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }

        const findNodeWithParent = (
          tabId: number,
          nodes: TabNode[],
          parentTabId: number | null,
          depth: number
        ): { found: boolean; parentTabId: number | null; depth: number } | null => {
          for (const node of nodes) {
            if (node.tabId === tabId) {
              return { found: true, parentTabId, depth };
            }
            const result = findNodeWithParent(tabId, node.children, node.tabId, depth + 1);
            if (result) return result;
          }
          return null;
        };

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) {
          return { error: 'No tree state' };
        }

        let childInfo: { parentTabId: number | null; depth: number } | null = null;

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const childResult = findNodeWithParent(childTabId, view.rootNodes, null, 0);
            if (childResult) {
              childInfo = { parentTabId: childResult.parentTabId, depth: childResult.depth };
            }
          }
        }

        return {
          childParentTabId: childInfo?.parentTabId ?? null,
          childDepth: childInfo?.depth ?? null,
        };
      },
      { childTabId: childTab }
    );

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    expect(storageAfterWindow.childParentTabId).toBe(storageBeforeWindow.childParentTabId);
    expect(storageAfterWindow.childDepth).toBe(1);

    await serviceWorker.evaluate(async (windowId) => {
      await chrome.windows.remove(windowId);
    }, newWindowId);
  });

  test('D&Dで親子関係を作成した後、SYNC_TABSメッセージを送信しても既存の親子関係が維持されること', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/parent-sync'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, getTestServerUrl('/child-sync'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    const storageBeforeSync = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }

        const findNodeWithParent = (
          tabId: number,
          nodes: TabNode[],
          parentTabId: number | null,
          depth: number
        ): { found: boolean; parentTabId: number | null; depth: number } | null => {
          for (const node of nodes) {
            if (node.tabId === tabId) {
              return { found: true, parentTabId, depth };
            }
            const result = findNodeWithParent(tabId, node.children, node.tabId, depth + 1);
            if (result) return result;
          }
          return null;
        };

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return { error: 'No tree state' };

        let childInfo: { parentTabId: number | null; depth: number } | null = null;

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const childResult = findNodeWithParent(childTabId, view.rootNodes, null, 0);
            if (childResult) {
              childInfo = { parentTabId: childResult.parentTabId, depth: childResult.depth };
            }
          }
        }

        return {
          childParentTabId: childInfo?.parentTabId ?? null,
          childDepth: childInfo?.depth ?? null,
        };
      },
      { childTabId: childTab }
    );

    await serviceWorker.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SYNC_TABS' }, () => resolve());
      });
    });

    const storageAfterSync = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TabNode {
          tabId: number;
          isExpanded: boolean;
          children: TabNode[];
        }
        interface ViewState {
          rootNodes: TabNode[];
        }
        interface WindowState {
          views: ViewState[];
        }
        interface TreeState {
          windows: WindowState[];
        }

        const findNodeWithParent = (
          tabId: number,
          nodes: TabNode[],
          parentTabId: number | null,
          depth: number
        ): { found: boolean; parentTabId: number | null; depth: number } | null => {
          for (const node of nodes) {
            if (node.tabId === tabId) {
              return { found: true, parentTabId, depth };
            }
            const result = findNodeWithParent(tabId, node.children, node.tabId, depth + 1);
            if (result) return result;
          }
          return null;
        };

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as TreeState | undefined;
        if (!treeState?.windows) return { error: 'No tree state' };

        let childInfo: { parentTabId: number | null; depth: number } | null = null;

        for (const window of treeState.windows) {
          for (const view of window.views) {
            const childResult = findNodeWithParent(childTabId, view.rootNodes, null, 0);
            if (childResult) {
              childInfo = { parentTabId: childResult.parentTabId, depth: childResult.depth };
            }
          }
        }

        return {
          childParentTabId: childInfo?.parentTabId ?? null,
          childDepth: childInfo?.depth ?? null,
        };
      },
      { childTabId: childTab }
    );

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    expect(storageAfterSync.childParentTabId).toBe(storageBeforeSync.childParentTabId);
    expect(storageAfterSync.childDepth).toBe(1);
  });

  test('ストレージが破損した場合、背景の正しい状態から復元されること', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } =
      await setupWindow(extensionContext, serviceWorker, windowId);

    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(serviceWorker, getTestServerUrl('/parent-recover'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const childTab = await createTab(serviceWorker, getTestServerUrl('/child-recover'));
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
      { tabId: childTab, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);

    // This test simulates storage corruption by intentionally modifying the tree state
    // The TreeStateManager should recover from this by using its in-memory state
    await serviceWorker.evaluate(async () => {
      interface TabNode {
        tabId: number;
        isExpanded: boolean;
        children: TabNode[];
      }
      interface ViewState {
        rootNodes: TabNode[];
      }
      interface WindowState {
        views: ViewState[];
      }
      interface TreeState {
        windows: WindowState[];
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      if (treeState?.windows?.[0]?.views?.[0]) {
        // Corrupt the storage by clearing rootNodes
        treeState.windows[0].views[0].rootNodes = [];
        await chrome.storage.local.set({ tree_state: treeState });
      }
    });

    await serviceWorker.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SYNC_TABS' }, () => resolve());
      });
    });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: childTab, depth: 1 },
    ], 0);
  });
});
