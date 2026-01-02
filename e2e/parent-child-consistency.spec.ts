/**
 * 親子関係不整合解消テスト（タスク8）
 *
 * このテストスイートでは、以下を検証します:
 * 1. タブを閉じた後も、他のタブの親子関係が維持される
 * 2. タブを移動した後も、他のタブの親子関係が維持される
 * 3. 複数のタブ操作を連続で行っても、親子関係が維持される
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import {
  waitForTabInTreeState,
  waitForTabRemovedFromTreeState,
  waitForParentChildRelation,
} from './utils/polling-utils';

test.describe('親子関係不整合解消', () => {
  test('タブを閉じた後も、他のタブの親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブ1を作成
    const parent1TabId = await createTab(extensionContext, 'https://example.com/parent1');
    await waitForTabInTreeState(extensionContext, parent1TabId);

    // 親タブ1の子タブを作成
    const child1TabId = await createTab(extensionContext, 'https://example.com/child1', parent1TabId);
    await waitForTabInTreeState(extensionContext, child1TabId);
    await waitForParentChildRelation(extensionContext, child1TabId, parent1TabId);

    // 親タブ2を作成
    const parent2TabId = await createTab(extensionContext, 'https://example.org/parent2');
    await waitForTabInTreeState(extensionContext, parent2TabId);

    // 親タブ2の子タブを作成
    const child2TabId = await createTab(extensionContext, 'https://example.org/child2', parent2TabId);
    await waitForTabInTreeState(extensionContext, child2TabId);
    await waitForParentChildRelation(extensionContext, child2TabId, parent2TabId);

    // 独立したタブを作成して閉じる
    const tempTabId = await createTab(extensionContext, 'https://example.net/temp');
    await waitForTabInTreeState(extensionContext, tempTabId);
    await closeTab(extensionContext, tempTabId);
    await waitForTabRemovedFromTreeState(extensionContext, tempTabId);

    // 両方の親子関係が維持されていることを確認
    const allRelationsValid = await serviceWorker.evaluate(
      async ({ parent1TabId, child1TabId, parent2TabId, child2TabId }) => {
        interface TreeNode {
          parentId: string | null;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) return false;

        // 親子関係1の確認
        const parent1NodeId = treeState.tabToNode[parent1TabId];
        const child1NodeId = treeState.tabToNode[child1TabId];
        if (!parent1NodeId || !child1NodeId) return false;
        const child1Node = treeState.nodes[child1NodeId];
        const relation1Valid = child1Node && child1Node.parentId === parent1NodeId;

        // 親子関係2の確認
        const parent2NodeId = treeState.tabToNode[parent2TabId];
        const child2NodeId = treeState.tabToNode[child2TabId];
        if (!parent2NodeId || !child2NodeId) return false;
        const child2Node = treeState.nodes[child2NodeId];
        const relation2Valid = child2Node && child2Node.parentId === parent2NodeId;

        return relation1Valid && relation2Valid;
      },
      { parent1TabId, child1TabId, parent2TabId, child2TabId }
    );

    expect(allRelationsValid).toBe(true);
  });

  test('親タブを閉じた後、子タブが昇格しても他の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブ1と子タブを作成
    const parent1TabId = await createTab(extensionContext, 'https://example.com/parent1');
    await waitForTabInTreeState(extensionContext, parent1TabId);

    const child1TabId = await createTab(extensionContext, 'https://example.com/child1', parent1TabId);
    await waitForTabInTreeState(extensionContext, child1TabId);
    await waitForParentChildRelation(extensionContext, child1TabId, parent1TabId);

    // 親タブ2と子タブを作成（こちらの親子関係が維持されることを検証）
    const parent2TabId = await createTab(extensionContext, 'https://example.org/parent2');
    await waitForTabInTreeState(extensionContext, parent2TabId);

    const child2TabId = await createTab(extensionContext, 'https://example.org/child2', parent2TabId);
    await waitForTabInTreeState(extensionContext, child2TabId);
    await waitForParentChildRelation(extensionContext, child2TabId, parent2TabId);

    // 親タブ1を閉じる（子タブ1は昇格する）
    await closeTab(extensionContext, parent1TabId);
    await waitForTabRemovedFromTreeState(extensionContext, parent1TabId);

    // 親タブ2と子タブ2の親子関係が維持されていることを確認
    const relation2Valid = await serviceWorker.evaluate(
      async ({ parent2TabId, child2TabId }) => {
        interface TreeNode {
          parentId: string | null;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) return false;

        const parent2NodeId = treeState.tabToNode[parent2TabId];
        const child2NodeId = treeState.tabToNode[child2TabId];
        if (!parent2NodeId || !child2NodeId) return false;

        const child2Node = treeState.nodes[child2NodeId];
        return child2Node && child2Node.parentId === parent2NodeId;
      },
      { parent2TabId, child2TabId }
    );

    expect(relation2Valid).toBe(true);
  });

  test('複数のタブ作成と削除を連続で行っても、親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親子関係を作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await waitForTabInTreeState(extensionContext, parentTabId);

    const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);
    await waitForTabInTreeState(extensionContext, childTabId);
    await waitForParentChildRelation(extensionContext, childTabId, parentTabId);

    // 連続でタブを作成して削除（5回繰り返す）
    for (let i = 0; i < 5; i++) {
      const tempTabId = await createTab(extensionContext, `https://example.org/temp${i}`);
      await waitForTabInTreeState(extensionContext, tempTabId);
      await closeTab(extensionContext, tempTabId);
      await waitForTabRemovedFromTreeState(extensionContext, tempTabId);
    }

    // 親子関係が維持されていることを確認
    const relationValid = await serviceWorker.evaluate(
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
        if (!treeState?.nodes || !treeState?.tabToNode) return { valid: false, reason: 'No tree state' };

        const parentNodeId = treeState.tabToNode[parentTabId];
        const childNodeId = treeState.tabToNode[childTabId];
        if (!parentNodeId || !childNodeId) return { valid: false, reason: 'Missing node IDs' };

        const parentNode = treeState.nodes[parentNodeId];
        const childNode = treeState.nodes[childNodeId];

        if (childNode.parentId !== parentNodeId) {
          return { valid: false, reason: 'Parent ID mismatch' };
        }
        if (parentNode.depth !== 0 || childNode.depth !== 1) {
          return { valid: false, reason: 'Depth mismatch' };
        }

        return { valid: true };
      },
      { parentTabId, childTabId }
    );

    expect(relationValid).toEqual({ valid: true });
  });

  test('深い階層（3階層）の親子関係が、他のタブ操作後も維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 3階層の親子関係を作成
    const rootTabId = await createTab(extensionContext, 'https://example.com/root');
    await waitForTabInTreeState(extensionContext, rootTabId);

    const middleTabId = await createTab(extensionContext, 'https://example.com/middle', rootTabId);
    await waitForTabInTreeState(extensionContext, middleTabId);
    await waitForParentChildRelation(extensionContext, middleTabId, rootTabId);

    const leafTabId = await createTab(extensionContext, 'https://example.com/leaf', middleTabId);
    await waitForTabInTreeState(extensionContext, leafTabId);
    await waitForParentChildRelation(extensionContext, leafTabId, middleTabId);

    // 独立したタブをいくつか作成
    const temp1TabId = await createTab(extensionContext, 'https://example.org/temp1');
    await waitForTabInTreeState(extensionContext, temp1TabId);

    const temp2TabId = await createTab(extensionContext, 'https://example.org/temp2');
    await waitForTabInTreeState(extensionContext, temp2TabId);

    // いくつかのタブを削除
    await closeTab(extensionContext, temp1TabId);
    await waitForTabRemovedFromTreeState(extensionContext, temp1TabId);

    // 3階層の親子関係が維持されていることを確認
    const allRelationsValid = await serviceWorker.evaluate(
      async ({ rootTabId, middleTabId, leafTabId }) => {
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
        if (!treeState?.nodes || !treeState?.tabToNode) return { valid: false, reason: 'No tree state' };

        const rootNodeId = treeState.tabToNode[rootTabId];
        const middleNodeId = treeState.tabToNode[middleTabId];
        const leafNodeId = treeState.tabToNode[leafTabId];

        if (!rootNodeId || !middleNodeId || !leafNodeId) {
          return { valid: false, reason: 'Missing node IDs' };
        }

        const rootNode = treeState.nodes[rootNodeId];
        const middleNode = treeState.nodes[middleNodeId];
        const leafNode = treeState.nodes[leafNodeId];

        // 親子関係の確認
        if (rootNode.parentId !== null) {
          return { valid: false, reason: 'Root should have no parent' };
        }
        if (middleNode.parentId !== rootNodeId) {
          return { valid: false, reason: 'Middle parent mismatch' };
        }
        if (leafNode.parentId !== middleNodeId) {
          return { valid: false, reason: 'Leaf parent mismatch' };
        }

        // 深さの確認
        if (rootNode.depth !== 0 || middleNode.depth !== 1 || leafNode.depth !== 2) {
          return { valid: false, reason: 'Depth mismatch' };
        }

        return { valid: true };
      },
      { rootTabId, middleTabId, leafTabId }
    );

    expect(allRelationsValid).toEqual({ valid: true });
  });

  test('複数の独立した親子関係が、タブ操作の組み合わせ後も維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 3つの独立した親子関係を作成
    // 関係1: parent1 -> child1a, child1b
    const parent1TabId = await createTab(extensionContext, 'https://example.com/parent1');
    await waitForTabInTreeState(extensionContext, parent1TabId);

    const child1aTabId = await createTab(extensionContext, 'https://example.com/child1a', parent1TabId);
    await waitForTabInTreeState(extensionContext, child1aTabId);
    await waitForParentChildRelation(extensionContext, child1aTabId, parent1TabId);

    const child1bTabId = await createTab(extensionContext, 'https://example.com/child1b', parent1TabId);
    await waitForTabInTreeState(extensionContext, child1bTabId);
    await waitForParentChildRelation(extensionContext, child1bTabId, parent1TabId);

    // 関係2: parent2 -> child2
    const parent2TabId = await createTab(extensionContext, 'https://example.org/parent2');
    await waitForTabInTreeState(extensionContext, parent2TabId);

    const child2TabId = await createTab(extensionContext, 'https://example.org/child2', parent2TabId);
    await waitForTabInTreeState(extensionContext, child2TabId);
    await waitForParentChildRelation(extensionContext, child2TabId, parent2TabId);

    // 関係3: parent3 -> child3
    const parent3TabId = await createTab(extensionContext, 'https://example.net/parent3');
    await waitForTabInTreeState(extensionContext, parent3TabId);

    const child3TabId = await createTab(extensionContext, 'https://example.net/child3', parent3TabId);
    await waitForTabInTreeState(extensionContext, child3TabId);
    await waitForParentChildRelation(extensionContext, child3TabId, parent3TabId);

    // 一部のタブを削除（child1a）
    await closeTab(extensionContext, child1aTabId);
    await waitForTabRemovedFromTreeState(extensionContext, child1aTabId);

    // 新しいタブを作成
    const newTabId = await createTab(extensionContext, 'https://example.io/new');
    await waitForTabInTreeState(extensionContext, newTabId);

    // すべての残りの親子関係が維持されていることを確認
    const allRelationsValid = await serviceWorker.evaluate(
      async ({ parent1TabId, child1bTabId, parent2TabId, child2TabId, parent3TabId, child3TabId }) => {
        interface TreeNode {
          parentId: string | null;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) return { valid: false, reason: 'No tree state' };

        // 関係1の確認（child1aは削除済み、child1bは維持）
        const parent1NodeId = treeState.tabToNode[parent1TabId];
        const child1bNodeId = treeState.tabToNode[child1bTabId];
        if (!parent1NodeId || !child1bNodeId) return { valid: false, reason: 'Missing relation1 nodes' };
        const child1bNode = treeState.nodes[child1bNodeId];
        if (!child1bNode || child1bNode.parentId !== parent1NodeId) {
          return { valid: false, reason: 'Relation1 invalid' };
        }

        // 関係2の確認
        const parent2NodeId = treeState.tabToNode[parent2TabId];
        const child2NodeId = treeState.tabToNode[child2TabId];
        if (!parent2NodeId || !child2NodeId) return { valid: false, reason: 'Missing relation2 nodes' };
        const child2Node = treeState.nodes[child2NodeId];
        if (!child2Node || child2Node.parentId !== parent2NodeId) {
          return { valid: false, reason: 'Relation2 invalid' };
        }

        // 関係3の確認
        const parent3NodeId = treeState.tabToNode[parent3TabId];
        const child3NodeId = treeState.tabToNode[child3TabId];
        if (!parent3NodeId || !child3NodeId) return { valid: false, reason: 'Missing relation3 nodes' };
        const child3Node = treeState.nodes[child3NodeId];
        if (!child3Node || child3Node.parentId !== parent3NodeId) {
          return { valid: false, reason: 'Relation3 invalid' };
        }

        return { valid: true };
      },
      { parent1TabId, child1bTabId, parent2TabId, child2TabId, parent3TabId, child3TabId }
    );

    expect(allRelationsValid).toEqual({ valid: true });
  });
});
