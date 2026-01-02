/**
 * ブラウザ再起動時のツリー構造復元テスト
 *
 * このテストスイートでは、以下を検証します:
 * 1. treeStructureがストレージに正しく保存される
 * 2. ストレージからツリー構造を復元できる
 * 3. タブIDが変わっても親子関係が維持される
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';
import {
  waitForTabInTreeState,
  waitForParentChildRelation,
  waitForTabDepthInUI,
} from './utils/polling-utils';

test.describe('ブラウザ再起動時のツリー構造復元', () => {
  test('treeStructureがストレージに正しく保存される', async ({
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

    // 少し待ってストレージに保存されることを確認
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    // treeStructureがストレージに保存されていることを確認
    const treeStructure = await serviceWorker.evaluate(async () => {
      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
        index: number;
        viewId: string;
        isExpanded: boolean;
      }
      interface TreeState {
        treeStructure?: TreeStructureEntry[];
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      return treeState?.treeStructure;
    });

    expect(treeStructure).toBeDefined();
    expect(treeStructure!.length).toBeGreaterThanOrEqual(2);

    // 親子関係が正しく保存されていることを確認
    // 親タブはparentIndex === null
    // 子タブはparentIndexが親のインデックスを指す
    const parentEntry = treeStructure!.find(e => e.url === 'https://example.com/parent');
    const childEntry = treeStructure!.find(e => e.url === 'https://example.com/child');

    expect(parentEntry).toBeDefined();
    expect(childEntry).toBeDefined();
    expect(parentEntry!.parentIndex).toBeNull();
    expect(childEntry!.parentIndex).not.toBeNull();

    // 子のparentIndexが親のインデックスを指していることを確認
    const parentIndex = treeStructure!.findIndex(e => e.url === 'https://example.com/parent');
    expect(childEntry!.parentIndex).toBe(parentIndex);
  });

  test('深い階層のツリーがtreeStructureに正しく保存される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 構造:
    // A (root)
    // └── B
    //     └── C
    //         └── D

    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await waitForTabInTreeState(extensionContext, tabAId);

    const tabBId = await createTab(extensionContext, 'https://example.com/B', tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await waitForParentChildRelation(extensionContext, tabBId, tabAId);

    const tabCId = await createTab(extensionContext, 'https://example.com/C', tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await waitForParentChildRelation(extensionContext, tabCId, tabBId);

    const tabDId = await createTab(extensionContext, 'https://example.com/D', tabCId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await waitForParentChildRelation(extensionContext, tabDId, tabCId);

    // 少し待ってストレージに保存されることを確認
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    // treeStructureを取得
    const treeStructure = await serviceWorker.evaluate(async () => {
      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
        index: number;
        viewId: string;
        isExpanded: boolean;
      }
      interface TreeState {
        treeStructure?: TreeStructureEntry[];
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      return treeState?.treeStructure;
    });

    expect(treeStructure).toBeDefined();

    // 各エントリの親子関係を確認
    const entryA = treeStructure!.find(e => e.url === 'https://example.com/A');
    const entryB = treeStructure!.find(e => e.url === 'https://example.com/B');
    const entryC = treeStructure!.find(e => e.url === 'https://example.com/C');
    const entryD = treeStructure!.find(e => e.url === 'https://example.com/D');

    expect(entryA).toBeDefined();
    expect(entryB).toBeDefined();
    expect(entryC).toBeDefined();
    expect(entryD).toBeDefined();

    // インデックスを取得
    const indexA = treeStructure!.findIndex(e => e.url === 'https://example.com/A');
    const indexB = treeStructure!.findIndex(e => e.url === 'https://example.com/B');
    const indexC = treeStructure!.findIndex(e => e.url === 'https://example.com/C');

    // 親子関係の検証
    expect(entryA!.parentIndex).toBeNull(); // Aはルート
    expect(entryB!.parentIndex).toBe(indexA); // BはAの子
    expect(entryC!.parentIndex).toBe(indexB); // CはBの子
    expect(entryD!.parentIndex).toBe(indexC); // DはCの子
  });

  test('syncWithChromeTabsがtreeStructureから親子関係を復元する', async ({
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

    // 孫タブを作成
    const grandchildTabId = await createTab(extensionContext, 'https://example.com/grandchild', childTabId);
    await waitForTabInTreeState(extensionContext, grandchildTabId);
    await waitForParentChildRelation(extensionContext, grandchildTabId, childTabId);

    // 少し待ってストレージに保存されることを確認
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    // ストレージからtreeStructureがあることを確認
    const hasTreeStructure = await serviceWorker.evaluate(async () => {
      interface TreeState {
        treeStructure?: unknown[];
      }
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      return treeState?.treeStructure && treeState.treeStructure.length > 0;
    });

    expect(hasTreeStructure).toBe(true);

    // ツリー状態をクリアしてsyncWithChromeTabsを呼び出す
    // これはブラウザ再起動時の動作をシミュレート
    await serviceWorker.evaluate(async () => {
      interface TreeState {
        views?: unknown[];
        currentViewId?: string;
        nodes?: Record<string, unknown>;
        tabToNode?: Record<number, string>;
        treeStructure?: unknown[];
      }

      // 現在のtreeStructureを保持しながらnodesとtabToNodeをクリア
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;

      if (treeState) {
        // nodesとtabToNodeをクリア（タブIDが変わった状態をシミュレート）
        const clearedState = {
          ...treeState,
          nodes: {},
          tabToNode: {},
        };
        await chrome.storage.local.set({ tree_state: clearedState });

        // treeStateManagerをリロード
        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.loadState();
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.syncWithChromeTabs();
        }
      }
    });

    // 少し待って復元が完了するのを待つ
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    // 親子関係が復元されていることを確認
    const relationsValid = await serviceWorker.evaluate(
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

        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { valid: false, reason: 'No tree state' };
        }

        const parentNodeId = treeState.tabToNode[parentTabId];
        const childNodeId = treeState.tabToNode[childTabId];
        const grandchildNodeId = treeState.tabToNode[grandchildTabId];

        if (!parentNodeId || !childNodeId || !grandchildNodeId) {
          return {
            valid: false,
            reason: 'Missing node IDs',
            parentNodeId,
            childNodeId,
            grandchildNodeId,
          };
        }

        const parentNode = treeState.nodes[parentNodeId];
        const childNode = treeState.nodes[childNodeId];
        const grandchildNode = treeState.nodes[grandchildNodeId];

        // 親子関係の検証
        if (parentNode.parentId !== null) {
          return { valid: false, reason: 'Parent should be root' };
        }
        if (childNode.parentId !== parentNodeId) {
          return {
            valid: false,
            reason: 'Child should be child of parent',
            childParentId: childNode.parentId,
            expectedParentId: parentNodeId,
          };
        }
        if (grandchildNode.parentId !== childNodeId) {
          return {
            valid: false,
            reason: 'Grandchild should be child of child',
            grandchildParentId: grandchildNode.parentId,
            expectedParentId: childNodeId,
          };
        }

        return { valid: true };
      },
      { parentTabId, childTabId, grandchildTabId }
    );

    expect(relationsValid).toEqual({ valid: true });
  });

  test('D&Dで作成した親子関係がtreeStructureに保存され、復元される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
    test.setTimeout(120000);

    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 2つのルートレベルのタブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/dnd-parent');
    await waitForTabInTreeState(extensionContext, parentTabId);

    const childTabId = await createTab(extensionContext, 'https://example.com/dnd-child');
    await waitForTabInTreeState(extensionContext, childTabId);

    // タブがツリーに表示されるまで待機
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
    await expect(parentNode.first()).toBeVisible({ timeout: 5000 });

    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
    await expect(childNode.first()).toBeVisible({ timeout: 5000 });

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTabId, parentTabId, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTabId, parentTabId, { timeout: 5000 });

    // UI上の深さを確認
    await waitForTabDepthInUI(sidePanelPage, parentTabId, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, childTabId, 1, { timeout: 3000 });

    // 少し待ってストレージに保存されることを確認
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    // D&D後にtreeStructureに親子関係が保存されていることを確認
    // D&D操作後、Side PanelからREFRESH_TREE_STRUCTUREが送信されるため、少し待つ
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    const treeStructure = await serviceWorker.evaluate(async () => {
      interface TreeStructureEntry {
        url: string;
        parentIndex: number | null;
        index: number;
        viewId: string;
        isExpanded: boolean;
      }
      interface TreeState {
        treeStructure?: TreeStructureEntry[];
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;
      return treeState?.treeStructure;
    });

    expect(treeStructure).toBeDefined();

    // 親子関係が正しく保存されていることを確認
    const parentEntry = treeStructure!.find(e => e.url === 'https://example.com/dnd-parent');
    const childEntry = treeStructure!.find(e => e.url === 'https://example.com/dnd-child');

    expect(parentEntry).toBeDefined();
    expect(childEntry).toBeDefined();
    expect(parentEntry!.parentIndex).toBeNull();
    expect(childEntry!.parentIndex).not.toBeNull();

    // 子のparentIndexが親のインデックスを指していることを確認
    const parentIndex = treeStructure!.findIndex(e => e.url === 'https://example.com/dnd-parent');
    expect(childEntry!.parentIndex).toBe(parentIndex);

    // 復元テスト: nodesとtabToNodeをクリアしてsyncWithChromeTabsを呼び出す
    await serviceWorker.evaluate(async () => {
      interface TreeState {
        views?: unknown[];
        currentViewId?: string;
        nodes?: Record<string, unknown>;
        tabToNode?: Record<number, string>;
        treeStructure?: unknown[];
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as TreeState | undefined;

      if (treeState) {
        // nodesとtabToNodeをクリア（再起動をシミュレート）
        const clearedState = {
          ...treeState,
          nodes: {},
          tabToNode: {},
        };
        await chrome.storage.local.set({ tree_state: clearedState });

        // treeStateManagerをリロードして再同期
        // @ts-expect-error accessing global treeStateManager
        if (globalThis.treeStateManager) {
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.loadState();
          // @ts-expect-error accessing global treeStateManager
          await globalThis.treeStateManager.syncWithChromeTabs();
        }
      }
    });

    // 復元を待つ
    await serviceWorker.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    // 親子関係が復元されていることを確認
    const relationsValid = await serviceWorker.evaluate(
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

        if (parentNode.parentId !== null) {
          return { valid: false, reason: 'Parent should be root' };
        }
        if (childNode.parentId !== parentNodeId) {
          return {
            valid: false,
            reason: 'Child should be child of parent',
            childParentId: childNode.parentId,
            expectedParentId: parentNodeId,
          };
        }

        return { valid: true };
      },
      { parentTabId, childTabId }
    );

    expect(relationsValid).toEqual({ valid: true });

    // UI上でも親子関係が復元されていることを確認
    await waitForTabDepthInUI(sidePanelPage, parentTabId, 0, { timeout: 5000 });
    await waitForTabDepthInUI(sidePanelPage, childTabId, 1, { timeout: 5000 });
  });
});
