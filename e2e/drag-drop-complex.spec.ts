import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { moveTabToParent, reorderTabs } from './utils/drag-drop-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ドラッグ&ドロップによる複雑なツリー移動', () => {
  test('子タブを持つ親タブを移動した場合、サブツリー全体が一緒に移動することを検証する', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // parentTab (ルートレベル)
    //   ├─ child1
    //   └─ child2
    //       └─ grandChild
    const parentTab = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org', parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org', parentTab);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);

    const grandChild = await createTab(
      extensionContext,
      'https://developer.mozilla.org',
      child2
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1, expanded: true },
      { tabId: grandChild, depth: 2 },
    ], 0);

    const targetParent = await createTab(extensionContext, 'https://www.github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTab, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1, expanded: true },
      { tabId: grandChild, depth: 2 },
      { tabId: targetParent, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await moveTabToParent(sidePanelPage, parentTab, targetParent);

    // targetParent(depth=0) -> parentTab(depth=1) -> child1/child2(depth=2) -> grandChild(depth=3)
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: targetParent, depth: 0, expanded: true },
      { tabId: parentTab, depth: 1, expanded: true },
      { tabId: child1, depth: 2 },
      { tabId: child2, depth: 2, expanded: true },
      { tabId: grandChild, depth: 3 },
    ], 0);
  });

  test('サブツリーをルートレベルにドロップした場合、元の親子関係から切り離され、ルートノードとして配置されることを検証する', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // rootParent
    //   └─ childWithSubtree
    //       ├─ grandChild1
    //       └─ grandChild2
    const rootParent = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0 },
    ], 0);

    const childWithSubtree = await createTab(extensionContext, 'https://www.iana.org', rootParent);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0, expanded: true },
      { tabId: childWithSubtree, depth: 1 },
    ], 0);

    const grandChild1 = await createTab(
      extensionContext,
      'https://www.w3.org',
      childWithSubtree
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0, expanded: true },
      { tabId: childWithSubtree, depth: 1, expanded: true },
      { tabId: grandChild1, depth: 2 },
    ], 0);

    const grandChild2 = await createTab(
      extensionContext,
      'https://developer.mozilla.org',
      childWithSubtree
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0, expanded: true },
      { tabId: childWithSubtree, depth: 1, expanded: true },
      { tabId: grandChild1, depth: 2 },
      { tabId: grandChild2, depth: 2 },
    ], 0);

    const rootTab = await createTab(extensionContext, 'https://www.github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0, expanded: true },
      { tabId: childWithSubtree, depth: 1, expanded: true },
      { tabId: grandChild1, depth: 2 },
      { tabId: grandChild2, depth: 2 },
      { tabId: rootTab, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await reorderTabs(sidePanelPage, childWithSubtree, rootTab, 'after');

    // childWithSubtree(depth=0) -> grandChild1/grandChild2(depth=1)
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: rootParent, depth: 0 },
      { tabId: rootTab, depth: 0 },
      { tabId: childWithSubtree, depth: 0, expanded: true },
      { tabId: grandChild1, depth: 1 },
      { tabId: grandChild2, depth: 1 },
    ], 0);
  });

  test('あるサブツリーを別のサブツリー内に移動した場合、サブツリー全体が移動することを検証する', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // Tree 1:
    // parent1
    //   └─ child1_1
    //       └─ grandChild1_1_1
    //
    // Tree 2:
    // parent2
    //   └─ child2_1
    const parent1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
    ], 0);

    const child1_1 = await createTab(extensionContext, 'https://www.iana.org', parent1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1_1, depth: 1 },
    ], 0);

    const grandChild1_1_1 = await createTab(
      extensionContext,
      'https://www.w3.org',
      child1_1
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1_1, depth: 1, expanded: true },
      { tabId: grandChild1_1_1, depth: 2 },
    ], 0);

    const parent2 = await createTab(extensionContext, 'https://www.github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1_1, depth: 1, expanded: true },
      { tabId: grandChild1_1_1, depth: 2 },
      { tabId: parent2, depth: 0 },
    ], 0);

    const child2_1 = await createTab(extensionContext, 'https://developer.mozilla.org', parent2);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1_1, depth: 1, expanded: true },
      { tabId: grandChild1_1_1, depth: 2 },
      { tabId: parent2, depth: 0, expanded: true },
      { tabId: child2_1, depth: 1 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await moveTabToParent(sidePanelPage, child1_1, child2_1, serviceWorker);

    // parent2(depth=0) -> child2_1(depth=1) -> child1_1(depth=2) -> grandChild1_1_1(depth=3)
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
      { tabId: parent2, depth: 0, expanded: true },
      { tabId: child2_1, depth: 1, expanded: true },
      { tabId: child1_1, depth: 2, expanded: true },
      { tabId: grandChild1_1_1, depth: 3 },
    ], 0);
  });

  test('親タブを自分の子孫タブにドロップしようとした場合、循環参照を防ぐため操作が拒否されることを検証する', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // parent
    //   └─ child
    //       └─ grandChild
    const parent = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent, depth: 0 },
    ], 0);

    const child = await createTab(extensionContext, 'https://www.iana.org', parent);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent, depth: 0, expanded: true },
      { tabId: child, depth: 1 },
    ], 0);

    const grandChild = await createTab(extensionContext, 'https://www.w3.org', child);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent, depth: 0, expanded: true },
      { tabId: child, depth: 1, expanded: true },
      { tabId: grandChild, depth: 2 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // 循環参照になるため、この操作は拒否されるべき
    await moveTabToParent(sidePanelPage, parent, grandChild);

    // parent(depth=0) -> child(depth=1) -> grandChild(depth=2)
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent, depth: 0, expanded: true },
      { tabId: child, depth: 1, expanded: true },
      { tabId: grandChild, depth: 2 },
    ], 0);
  });

  test('サブツリーを移動した場合、サブツリー構造が維持されることを検証する', async ({
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
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // parent1
    //   ├─ child1
    //   └─ child2
    //       └─ grandChild
    const parent1 = await createTab(extensionContext, 'https://example.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0 },
    ], 0);

    const child1 = await createTab(extensionContext, 'https://www.iana.org', parent1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
    ], 0);

    const child2 = await createTab(extensionContext, 'https://www.w3.org', parent1);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1 },
    ], 0);

    const grandChild = await createTab(
      extensionContext,
      'https://developer.mozilla.org',
      child2
    );
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1, expanded: true },
      { tabId: grandChild, depth: 2 },
    ], 0);

    const parent2 = await createTab(extensionContext, 'https://www.github.com');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: child2, depth: 1, expanded: true },
      { tabId: grandChild, depth: 2 },
      { tabId: parent2, depth: 0 },
    ], 0);

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    await moveTabToParent(sidePanelPage, child2, parent2, serviceWorker);

    // parent2(depth=0) -> child2(depth=1) -> grandChild(depth=2)
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parent1, depth: 0, expanded: true },
      { tabId: child1, depth: 1 },
      { tabId: parent2, depth: 0, expanded: true },
      { tabId: child2, depth: 1, expanded: true },
      { tabId: grandChild, depth: 2 },
    ], 0);
  });
});
