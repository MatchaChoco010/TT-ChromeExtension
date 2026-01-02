/**
 * 親タブ削除時のサブツリー親子関係維持テスト
 *
 * このテストスイートでは、以下を検証します:
 * 1. 親タブを閉じたときに、子タブ間の親子関係（孫の関係）が維持される
 * 2. 深い階層のツリーでも親子関係が正しく維持される
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import {
  waitForTabInTreeState,
  waitForParentChildRelation,
} from './utils/polling-utils';

test.describe('親タブ削除時のサブツリー親子関係維持', () => {
  test('親タブを閉じても子タブ間の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // タブA（ルート）を作成
    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await waitForTabInTreeState(extensionContext, tabAId);

    // タブB（Aの子）を作成
    const tabBId = await createTab(extensionContext, 'https://example.com/B', tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await waitForParentChildRelation(extensionContext, tabBId, tabAId);

    // タブC（Bの子）を作成
    const tabCId = await createTab(extensionContext, 'https://example.com/C', tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await waitForParentChildRelation(extensionContext, tabCId, tabBId);

    // タブD（Bの子）を作成
    const tabDId = await createTab(extensionContext, 'https://example.com/D', tabBId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await waitForParentChildRelation(extensionContext, tabDId, tabBId);

    // タブAを閉じる
    await closeTab(extensionContext, tabAId);

    // 待機して状態が安定するのを確認
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    // B-C、B-Dの親子関係が維持されていることを確認
    const subtreeRelationsValid = await serviceWorker.evaluate(
      async ({ tabBId, tabCId, tabDId }) => {
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

        const nodeBId = treeState.tabToNode[tabBId];
        const nodeCId = treeState.tabToNode[tabCId];
        const nodeDId = treeState.tabToNode[tabDId];

        if (!nodeBId || !nodeCId || !nodeDId) {
          return { valid: false, reason: 'Missing node IDs', nodeBId, nodeCId, nodeDId };
        }

        const nodeB = treeState.nodes[nodeBId];
        const nodeC = treeState.nodes[nodeCId];
        const nodeD = treeState.nodes[nodeDId];

        // Bはルートノードになる
        if (nodeB.parentId !== null) {
          return {
            valid: false,
            reason: 'B should be root',
            bParentId: nodeB.parentId,
          };
        }

        // CはBの子のまま
        if (nodeC.parentId !== nodeBId) {
          return {
            valid: false,
            reason: 'C should be child of B',
            cParentId: nodeC.parentId,
            expectedParentId: nodeBId,
          };
        }

        // DはBの子のまま
        if (nodeD.parentId !== nodeBId) {
          return {
            valid: false,
            reason: 'D should be child of B',
            dParentId: nodeD.parentId,
            expectedParentId: nodeBId,
          };
        }

        // 深さの確認: Bはdepth 0、C,Dはdepth 1
        if (nodeB.depth !== 0) {
          return { valid: false, reason: 'B depth should be 0', bDepth: nodeB.depth };
        }
        if (nodeC.depth !== 1) {
          return { valid: false, reason: 'C depth should be 1', cDepth: nodeC.depth };
        }
        if (nodeD.depth !== 1) {
          return { valid: false, reason: 'D depth should be 1', dDepth: nodeD.depth };
        }

        return { valid: true };
      },
      { tabBId, tabCId, tabDId }
    );

    expect(subtreeRelationsValid).toEqual({ valid: true });
  });

  test('3階層のツリーで親を閉じても孫の親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // タブA（ルート）を作成
    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await waitForTabInTreeState(extensionContext, tabAId);

    // タブB（Aの子）を作成
    const tabBId = await createTab(extensionContext, 'https://example.com/B', tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await waitForParentChildRelation(extensionContext, tabBId, tabAId);

    // タブC（Bの子）を作成
    const tabCId = await createTab(extensionContext, 'https://example.com/C', tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await waitForParentChildRelation(extensionContext, tabCId, tabBId);

    // タブD（Cの子 = Aの曾孫）を作成
    const tabDId = await createTab(extensionContext, 'https://example.com/D', tabCId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await waitForParentChildRelation(extensionContext, tabDId, tabCId);

    // タブAを閉じる
    await closeTab(extensionContext, tabAId);

    // 待機して状態が安定するのを確認
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    // B→C→D の親子関係が維持されていることを確認
    const subtreeRelationsValid = await serviceWorker.evaluate(
      async ({ tabBId, tabCId, tabDId }) => {
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

        const nodeBId = treeState.tabToNode[tabBId];
        const nodeCId = treeState.tabToNode[tabCId];
        const nodeDId = treeState.tabToNode[tabDId];

        if (!nodeBId || !nodeCId || !nodeDId) {
          return { valid: false, reason: 'Missing node IDs' };
        }

        const nodeB = treeState.nodes[nodeBId];
        const nodeC = treeState.nodes[nodeCId];
        const nodeD = treeState.nodes[nodeDId];

        // Bはルートノードになる
        if (nodeB.parentId !== null) {
          return { valid: false, reason: 'B should be root', bParentId: nodeB.parentId };
        }

        // CはBの子のまま
        if (nodeC.parentId !== nodeBId) {
          return {
            valid: false,
            reason: 'C should be child of B',
            cParentId: nodeC.parentId,
            expectedParentId: nodeBId,
          };
        }

        // DはCの子のまま
        if (nodeD.parentId !== nodeCId) {
          return {
            valid: false,
            reason: 'D should be child of C',
            dParentId: nodeD.parentId,
            expectedParentId: nodeCId,
          };
        }

        // 深さの確認
        if (nodeB.depth !== 0 || nodeC.depth !== 1 || nodeD.depth !== 2) {
          return {
            valid: false,
            reason: 'Depth mismatch',
            bDepth: nodeB.depth,
            cDepth: nodeC.depth,
            dDepth: nodeD.depth,
          };
        }

        return { valid: true };
      },
      { tabBId, tabCId, tabDId }
    );

    expect(subtreeRelationsValid).toEqual({ valid: true });
  });

  test('複数の子タブにそれぞれ孫がある場合、親を閉じても全ての親子関係が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 構造:
    // A (root) ← 閉じる
    // ├── B
    // │   ├── C
    // │   └── D
    // ├── E
    // └── F
    //     └── G

    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await waitForTabInTreeState(extensionContext, tabAId);

    const tabBId = await createTab(extensionContext, 'https://example.com/B', tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await waitForParentChildRelation(extensionContext, tabBId, tabAId);

    const tabCId = await createTab(extensionContext, 'https://example.com/C', tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await waitForParentChildRelation(extensionContext, tabCId, tabBId);

    const tabDId = await createTab(extensionContext, 'https://example.com/D', tabBId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await waitForParentChildRelation(extensionContext, tabDId, tabBId);

    const tabEId = await createTab(extensionContext, 'https://example.com/E', tabAId);
    await waitForTabInTreeState(extensionContext, tabEId);
    await waitForParentChildRelation(extensionContext, tabEId, tabAId);

    const tabFId = await createTab(extensionContext, 'https://example.com/F', tabAId);
    await waitForTabInTreeState(extensionContext, tabFId);
    await waitForParentChildRelation(extensionContext, tabFId, tabAId);

    const tabGId = await createTab(extensionContext, 'https://example.com/G', tabFId);
    await waitForTabInTreeState(extensionContext, tabGId);
    await waitForParentChildRelation(extensionContext, tabGId, tabFId);

    // タブAを閉じる
    await closeTab(extensionContext, tabAId);

    // 待機して状態が安定するのを確認
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    // 期待される構造:
    // B (root)
    // ├── C
    // └── D
    // E (root)
    // F (root)
    // └── G

    const subtreeRelationsValid = await serviceWorker.evaluate(
      async ({ tabBId, tabCId, tabDId, tabEId, tabFId, tabGId }) => {
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

        const nodeBId = treeState.tabToNode[tabBId];
        const nodeCId = treeState.tabToNode[tabCId];
        const nodeDId = treeState.tabToNode[tabDId];
        const nodeEId = treeState.tabToNode[tabEId];
        const nodeFId = treeState.tabToNode[tabFId];
        const nodeGId = treeState.tabToNode[tabGId];

        if (!nodeBId || !nodeCId || !nodeDId || !nodeEId || !nodeFId || !nodeGId) {
          return { valid: false, reason: 'Missing node IDs' };
        }

        const nodeB = treeState.nodes[nodeBId];
        const nodeC = treeState.nodes[nodeCId];
        const nodeD = treeState.nodes[nodeDId];
        const nodeE = treeState.nodes[nodeEId];
        const nodeF = treeState.nodes[nodeFId];
        const nodeG = treeState.nodes[nodeGId];

        // B, E, Fはルートノードになる
        if (nodeB.parentId !== null) {
          return { valid: false, reason: 'B should be root', bParentId: nodeB.parentId };
        }
        if (nodeE.parentId !== null) {
          return { valid: false, reason: 'E should be root', eParentId: nodeE.parentId };
        }
        if (nodeF.parentId !== null) {
          return { valid: false, reason: 'F should be root', fParentId: nodeF.parentId };
        }

        // C, DはBの子のまま
        if (nodeC.parentId !== nodeBId) {
          return { valid: false, reason: 'C should be child of B', cParentId: nodeC.parentId };
        }
        if (nodeD.parentId !== nodeBId) {
          return { valid: false, reason: 'D should be child of B', dParentId: nodeD.parentId };
        }

        // GはFの子のまま
        if (nodeG.parentId !== nodeFId) {
          return { valid: false, reason: 'G should be child of F', gParentId: nodeG.parentId };
        }

        // 深さの確認
        if (nodeB.depth !== 0 || nodeE.depth !== 0 || nodeF.depth !== 0) {
          return {
            valid: false,
            reason: 'Root nodes depth should be 0',
            bDepth: nodeB.depth,
            eDepth: nodeE.depth,
            fDepth: nodeF.depth,
          };
        }
        if (nodeC.depth !== 1 || nodeD.depth !== 1 || nodeG.depth !== 1) {
          return {
            valid: false,
            reason: 'Child nodes depth should be 1',
            cDepth: nodeC.depth,
            dDepth: nodeD.depth,
            gDepth: nodeG.depth,
          };
        }

        return { valid: true };
      },
      { tabBId, tabCId, tabDId, tabEId, tabFId, tabGId }
    );

    expect(subtreeRelationsValid).toEqual({ valid: true });
  });
});
