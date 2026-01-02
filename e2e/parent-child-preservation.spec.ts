/**
 * 新規タブ作成時の親子関係維持テスト
 *
 * このテストスイートでは、以下を検証します:
 * 1. 既存の親子関係がある状態で新しいタブを開いても、既存の親子関係が維持される
 * 2. 複数のタブが親子関係にある状態で新しいタブを開いても、他のタブの親子関係を解消しない
 * 3. リンクから新しいタブを開いた場合、リンク元タブの子タブとして配置される
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import {
  waitForTabInTreeState,
  waitForParentChildRelation,
  waitForTabDepthInUI,
  waitForTabVisibleInUI,
} from './utils/polling-utils';

test.describe('新規タブ作成時の親子関係維持', () => {
  test('既存の親子関係がある状態で新しいタブを開いても、既存の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await waitForTabInTreeState(extensionContext, parentTabId);

    // 子タブを作成（親タブの子として）
    const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);
    await waitForTabInTreeState(extensionContext, childTabId);

    // 親子関係が確立されていることを確認
    await waitForParentChildRelation(extensionContext, childTabId, parentTabId);

    // 新しい独立したタブを作成
    const newTabId = await createTab(extensionContext, 'https://example.org/new');
    await waitForTabInTreeState(extensionContext, newTabId);

    // 既存の親子関係が維持されていることを確認
    const parentChildStillValid = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
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

        const parentNodeId = treeState.tabToNode[parentTabId];
        const childNodeId = treeState.tabToNode[childTabId];
        if (!parentNodeId || !childNodeId) return false;

        const childNode = treeState.nodes[childNodeId];
        return childNode && childNode.parentId === parentNodeId;
      },
      { parentTabId, childTabId }
    );

    expect(parentChildStillValid).toBe(true);

    // UI上の深さを確認
    await waitForTabDepthInUI(sidePanelPage, parentTabId, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, childTabId, 1, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, newTabId, 0, { timeout: 3000 });
  });

  test('複数のタブが親子関係にある状態で新しいタブを開いても、他のタブの親子関係を解消しない', async ({
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

    // 新しい独立したタブを作成
    const newTabId = await createTab(extensionContext, 'https://example.net/new');
    await waitForTabInTreeState(extensionContext, newTabId);

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

    // UI上の深さを確認
    await waitForTabDepthInUI(sidePanelPage, parent1TabId, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, child1TabId, 1, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, parent2TabId, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, child2TabId, 1, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, newTabId, 0, { timeout: 3000 });
  });

  test('孫タブまである親子関係が、新しいタブ作成後も維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await waitForTabInTreeState(extensionContext, parentTabId);

    // 子タブを作成
    const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);
    await waitForTabInTreeState(extensionContext, childTabId);
    await waitForParentChildRelation(extensionContext, childTabId, parentTabId);

    // 孫タブを作成（子タブの子として）
    const grandchildTabId = await createTab(extensionContext, 'https://example.com/grandchild', childTabId);
    await waitForTabInTreeState(extensionContext, grandchildTabId);
    await waitForParentChildRelation(extensionContext, grandchildTabId, childTabId);

    // 新しい独立したタブを作成
    const newTabId = await createTab(extensionContext, 'https://example.org/new');
    await waitForTabInTreeState(extensionContext, newTabId);

    // すべての親子関係が維持されていることを確認
    const allRelationsValid = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId, grandchildTabId }) => {
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
        const grandchildNodeId = treeState.tabToNode[grandchildTabId];

        if (!parentNodeId || !childNodeId || !grandchildNodeId) {
          return { valid: false, reason: 'Missing node IDs' };
        }

        const parentNode = treeState.nodes[parentNodeId];
        const childNode = treeState.nodes[childNodeId];
        const grandchildNode = treeState.nodes[grandchildNodeId];

        // 親タブはルートノード
        if (parentNode.parentId !== null) {
          return { valid: false, reason: 'Parent is not root' };
        }

        // 子タブの親は親タブ
        if (childNode.parentId !== parentNodeId) {
          return { valid: false, reason: 'Child parent mismatch' };
        }

        // 孫タブの親は子タブ
        if (grandchildNode.parentId !== childNodeId) {
          return { valid: false, reason: 'Grandchild parent mismatch' };
        }

        // 深さの確認
        if (parentNode.depth !== 0 || childNode.depth !== 1 || grandchildNode.depth !== 2) {
          return { valid: false, reason: 'Depth mismatch' };
        }

        return { valid: true };
      },
      { parentTabId, childTabId, grandchildTabId }
    );

    expect(allRelationsValid).toEqual({ valid: true });

    // UI上の深さを確認
    await waitForTabDepthInUI(sidePanelPage, parentTabId, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, childTabId, 1, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, grandchildTabId, 2, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, newTabId, 0, { timeout: 3000 });
  });
});
