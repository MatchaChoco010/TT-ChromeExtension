import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { reorderTabs, moveTabToParent } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForCondition } from './utils/polling-utils';

test.describe('ドラッグ&ドロップによるサブツリー移動', () => {
  test.setTimeout(120000);

  test('折りたたまれた親タブをドラッグした場合、非表示の子タブも含めてサブツリー全体が移動すること', async ({
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

    const tab1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    const tab3 = await createTab(extensionContext, 'https://github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expandButton.first().click();
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0, expanded: false },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    await reorderTabs(sidePanelPage, tab1, tab3, 'after');

    const tabIds1 = [tab1, child1, child2, tab2, tab3];
    await waitForCondition(async () => {
      const result = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const storageResult = await chrome.storage.local.get('tree_state');
        const treeState = storageResult.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          return tabIds.every(id => treeState.tabToNode![id]);
        }
        return false;
      }, tabIds1);
      return result;
    }, { timeout: 1500, interval: 50 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab1, depth: 0, expanded: false },
    ], 0);
  });

  test('展開された親タブをドラッグした場合、可視の子タブも含めてサブツリー全体が移動すること', async ({
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

    const tab1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: tab2, depth: 0 },
    ], 0);

    await reorderTabs(sidePanelPage, tab1, tab2, 'after');

    const tabIds2 = [tab1, child1, child2, tab2];
    await waitForCondition(async () => {
      const result = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const storageResult = await chrome.storage.local.get('tree_state');
        const treeState = storageResult.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          return tabIds.every(id => treeState.tabToNode![id]);
        }
        return false;
      }, tabIds2);
      return result;
    }, { timeout: 1500, interval: 50 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);
  });

  test('サブツリーを下方向にドラッグした場合、正しい移動数で正しい位置に配置されること', async ({
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

    const tab1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
    ], 0);

    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    const tab3 = await createTab(extensionContext, 'https://github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
    ], 0);

    const tab4 = await createTab(extensionContext, 'https://httpbin.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab4, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab4, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child2, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab4, depth: 0 },
    ], 0);

    await reorderTabs(sidePanelPage, tab1, tab4, 'after');

    const tabIds3 = [tab1, child1, child2, tab2, tab3, tab4];
    await waitForCondition(async () => {
      const result = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const storageResult = await chrome.storage.local.get('tree_state');
        const treeState = storageResult.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          return tabIds.every(id => treeState.tabToNode![id]);
        }
        return false;
      }, tabIds3);
      return result;
    }, { timeout: 1500, interval: 50 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab3, depth: 0 },
      { tabId: tab4, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);
  });

  test('深いネストのサブツリーを移動した場合、全ての子孫が一緒に移動すること', async ({
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

    const tab1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
    ], 0);

    const grandChild1 = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: grandChild1, depth: 0 },
    ], 0);

    const tab2 = await createTab(extensionContext, 'https://developer.mozilla.org');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0 },
      { tabId: child1, depth: 0 },
      { tabId: grandChild1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, child1, tab1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: grandChild1, depth: 0 },
      { tabId: tab2, depth: 0 },
    ], 0);

    await moveTabToParent(sidePanelPage, grandChild1, child1, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1, expanded: true },
      { tabId: grandChild1, depth: 2 },
      { tabId: tab2, depth: 0 },
    ], 0);

    await reorderTabs(sidePanelPage, tab1, tab2, 'after');

    const tabIds4 = [tab1, child1, grandChild1, tab2];
    await waitForCondition(async () => {
      const result = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const storageResult = await chrome.storage.local.get('tree_state');
        const treeState = storageResult.tree_state as { nodes?: Record<string, unknown>; tabToNode?: Record<number, string> } | undefined;
        if (treeState?.nodes && treeState?.tabToNode) {
          return tabIds.every(id => treeState.tabToNode![id]);
        }
        return false;
      }, tabIds4);
      return result;
    }, { timeout: 1500, interval: 50 });

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tab2, depth: 0 },
      { tabId: tab1, depth: 0, expanded: true },
      { tabId: child1, depth: 1, expanded: true },
      { tabId: grandChild1, depth: 2 },
    ], 0);
  });
});
