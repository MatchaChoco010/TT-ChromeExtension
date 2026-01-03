/**
 * ブラウザ再起動時のツリー構造復元テスト
 *
 * このテストスイートでは、以下を検証します:
 * 1. treeStructureがストレージに正しく保存される
 * 2. ストレージからツリー構造を復元できる
 * 3. タブIDが変わっても親子関係が維持される
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getPseudoSidePanelTabId, getCurrentWindowId, getInitialBrowserTabId } from './utils/tab-utils';
import { moveTabToParent } from './utils/drag-drop-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ブラウザ再起動時のツリー構造復元', () => {
  test('treeStructureがストレージに正しく保存される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 事前準備: windowIdとpseudoSidePanelTabIdを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await waitForTabInTreeState(extensionContext, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    // 子タブを作成
    const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);
    await waitForTabInTreeState(extensionContext, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // treeStructureがストレージに保存されるまでポーリング待機
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

    let treeStructure: TreeStructureEntry[] | undefined;
    await waitForCondition(async () => {
      treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: { url: string; parentIndex: number | null; index: number; viewId: string; isExpanded: boolean; }[] } | undefined;
        return treeState?.treeStructure;
      });
      return treeStructure !== undefined && treeStructure.length >= 2;
    }, { timeout: 5000, timeoutMessage: 'treeStructure was not saved to storage' });

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

    // 事前準備: windowIdとpseudoSidePanelTabIdを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 構造:
    // A (root)
    // └── B
    //     └── C
    //         └── D

    const tabAId = await createTab(extensionContext, 'https://example.com/A');
    await waitForTabInTreeState(extensionContext, tabAId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
    ], 0);

    const tabBId = await createTab(extensionContext, 'https://example.com/B', tabAId);
    await waitForTabInTreeState(extensionContext, tabBId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
    ], 0);

    const tabCId = await createTab(extensionContext, 'https://example.com/C', tabBId);
    await waitForTabInTreeState(extensionContext, tabCId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
    ], 0);

    const tabDId = await createTab(extensionContext, 'https://example.com/D', tabCId);
    await waitForTabInTreeState(extensionContext, tabDId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabAId, depth: 0 },
      { tabId: tabBId, depth: 1 },
      { tabId: tabCId, depth: 2 },
      { tabId: tabDId, depth: 3 },
    ], 0);

    // treeStructureがストレージに保存されるまでポーリング待機
    interface TreeStructureEntry {
      url: string;
      parentIndex: number | null;
      index: number;
      viewId: string;
      isExpanded: boolean;
    }

    let treeStructure: TreeStructureEntry[] | undefined;
    await waitForCondition(async () => {
      treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: { url: string; parentIndex: number | null; index: number; viewId: string; isExpanded: boolean; }[] } | undefined;
        return treeState?.treeStructure;
      });
      // 4つのタブすべてが保存されていることを確認
      if (!treeStructure) return false;
      const hasA = treeStructure.some(e => e.url === 'https://example.com/A');
      const hasB = treeStructure.some(e => e.url === 'https://example.com/B');
      const hasC = treeStructure.some(e => e.url === 'https://example.com/C');
      const hasD = treeStructure.some(e => e.url === 'https://example.com/D');
      return hasA && hasB && hasC && hasD;
    }, { timeout: 5000, timeoutMessage: 'treeStructure was not saved to storage with all tabs' });

    // 各エントリの親子関係を確認
    const entryA = treeStructure!.find(e => e.url === 'https://example.com/A');
    const entryB = treeStructure!.find(e => e.url === 'https://example.com/B');
    const entryC = treeStructure!.find(e => e.url === 'https://example.com/C');
    const entryD = treeStructure!.find(e => e.url === 'https://example.com/D');

    // インデックスを取得
    const indexA = treeStructure!.findIndex(e => e.url === 'https://example.com/A');
    const indexB = treeStructure!.findIndex(e => e.url === 'https://example.com/B');
    const indexC = treeStructure!.findIndex(e => e.url === 'https://example.com/C');

    // 親子関係の検証（ストレージ内部データの検証は避けられない必要なもの）
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

    // 事前準備: windowIdとpseudoSidePanelTabIdを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/parent');
    await waitForTabInTreeState(extensionContext, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    // 子タブを作成
    const childTabId = await createTab(extensionContext, 'https://example.com/child', parentTabId);
    await waitForTabInTreeState(extensionContext, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // 孫タブを作成
    const grandchildTabId = await createTab(extensionContext, 'https://example.com/grandchild', childTabId);
    await waitForTabInTreeState(extensionContext, grandchildTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
      { tabId: grandchildTabId, depth: 2 },
    ], 0);

    // treeStructureがストレージに保存されるまでポーリング待機
    await waitForCondition(async () => {
      const hasTreeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: unknown[] } | undefined;
        return treeState?.treeStructure && treeState.treeStructure.length > 0;
      });
      return hasTreeStructure;
    }, { timeout: 5000, timeoutMessage: 'treeStructure was not saved to storage' });

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

    // 親子関係が復元されるまでポーリング待機
    interface RelationsResult {
      valid: boolean;
      reason?: string;
      parentNodeId?: string;
      childNodeId?: string;
      grandchildNodeId?: string;
      childParentId?: string | null;
      grandchildParentId?: string | null;
      expectedParentId?: string;
    }

    let relationsValid: RelationsResult = { valid: false };
    await waitForCondition(async () => {
      relationsValid = await serviceWorker.evaluate(
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
      return relationsValid.valid;
    }, { timeout: 5000, timeoutMessage: 'Tree relations were not restored correctly' });

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

    // 事前準備: windowIdとpseudoSidePanelTabIdを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 2つのルートレベルのタブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com/dnd-parent');
    await waitForTabInTreeState(extensionContext, parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    const childTabId = await createTab(extensionContext, 'https://example.com/dnd-child');
    await waitForTabInTreeState(extensionContext, childTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 0 },
    ], 0);

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTabId, parentTabId, serviceWorker);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0);

    // D&D後にtreeStructureに親子関係が保存されるまでポーリング待機
    interface TreeStructureEntry {
      url: string;
      parentIndex: number | null;
      index: number;
      viewId: string;
      isExpanded: boolean;
    }

    let treeStructure: TreeStructureEntry[] | undefined;
    let parentEntry: TreeStructureEntry | undefined;
    let childEntry: TreeStructureEntry | undefined;

    await waitForCondition(async () => {
      treeStructure = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { treeStructure?: { url: string; parentIndex: number | null; index: number; viewId: string; isExpanded: boolean; }[] } | undefined;
        return treeState?.treeStructure;
      });
      if (!treeStructure) return false;

      parentEntry = treeStructure.find(e => e.url === 'https://example.com/dnd-parent');
      childEntry = treeStructure.find(e => e.url === 'https://example.com/dnd-child');

      // 親子関係が正しく保存されていることを確認
      if (!parentEntry || !childEntry) return false;
      if (parentEntry.parentIndex !== null) return false;
      if (childEntry.parentIndex === null) return false;

      const parentIndex = treeStructure.findIndex(e => e.url === 'https://example.com/dnd-parent');
      return childEntry.parentIndex === parentIndex;
    }, { timeout: 5000, timeoutMessage: 'D&D parent-child relation was not saved to treeStructure' });

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

    // 親子関係が復元されるまでポーリング待機
    interface DndRelationsResult {
      valid: boolean;
      reason?: string;
      parentNodeId?: string;
      childNodeId?: string;
      childParentId?: string | null;
      expectedParentId?: string;
    }

    let relationsValid: DndRelationsResult = { valid: false };
    await waitForCondition(async () => {
      relationsValid = await serviceWorker.evaluate(
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
      return relationsValid.valid;
    }, { timeout: 5000, timeoutMessage: 'D&D tree relations were not restored correctly' });

    expect(relationsValid).toEqual({ valid: true });

    // UI上でも親子関係が復元されていることを確認
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId, depth: 1 },
    ], 0, { timeout: 5000 });
  });
});
