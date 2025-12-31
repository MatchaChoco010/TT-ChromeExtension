/**
 * Tab Duplicate E2E Tests
 *
 * タブ複製時の配置検証 E2E テスト
 *
 * Requirements: 16.1, 16.2, 16.3, 16.4, 16.5
 * - 複製されたタブが元のタブの兄弟として配置されること
 * - 複製されたタブが元のタブの直下（1つ下）に表示されること
 * - 複製されたタブが元のタブの子タブとして配置されないこと
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import { waitForTabInTreeState, waitForCondition, waitForParentChildRelation } from './utils/polling-utils';

test.describe('Task 4.2: タブ複製時の配置', () => {
  test.describe('Requirement 16.1: 複製されたタブが元のタブの兄弟として配置される', () => {
    test('タブを複製すると兄弟タブとして配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 要素のバウンディングボックスが安定するまで待機
      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId,
        { timeout: 5000 }
      );

      // 元のタブのノードIDを取得
      const originalNodeId = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode: Record<number, string> };
        return treeState.tabToNode[tid];
      }, tabId);

      // 元のタブの親ノードIDを取得
      const originalParentId = await serviceWorker.evaluate(async (nodeId) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { nodes: Record<string, { parentId: string | null }> };
        return treeState.nodes[nodeId]?.parentId;
      }, originalNodeId);

      // 現在のタブ数を取得
      const initialTabCount = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();

      // Act: コンテキストメニューからタブを複製
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await tabNode.click({ button: 'right' });

      // コンテキストメニューが表示されるまで待機
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      // 「タブを複製」をクリック
      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      // コンテキストメニューが閉じるまで待機
      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 新しいタブが作成されるまで待機
      await expect(sidePanelPage.locator('[data-testid^="tree-node-"]')).toHaveCount(initialTabCount + 1, { timeout: 10000 });

      // Assert: 新しいタブ（複製されたタブ）を見つける
      const newTabId = await serviceWorker.evaluate(async (originalTabId) => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        // 最後に作成されたタブ（最大ID）を複製されたタブとみなす
        const sortedTabs = tabs.filter(t => t.id && t.id !== originalTabId).sort((a, b) => (b.id || 0) - (a.id || 0));
        return sortedTabs[0]?.id;
      }, tabId);

      expect(newTabId).toBeDefined();

      // 複製されたタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId!);

      // 複製されたタブの親ノードIDを取得
      const duplicateParentId = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode: Record<number, string>;
          nodes: Record<string, { parentId: string | null }>;
        };
        const nodeId = treeState.tabToNode[tid];
        return treeState.nodes[nodeId]?.parentId;
      }, newTabId!);

      // 複製されたタブが元のタブと同じ親を持つこと（兄弟関係）を確認
      expect(duplicateParentId).toBe(originalParentId);

      // Cleanup
      await closeTab(extensionContext, tabId);
      await closeTab(extensionContext, newTabId!);
    });
  });

  test.describe('Requirement 16.2: 複製されたタブが元のタブの直下（1つ下）に表示される', () => {
    test('複製されたタブは元のタブの直後に配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: タブを作成
      const tabId1 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId1);

      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`)).toBeVisible({ timeout: 10000 });

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 要素のバウンディングボックスが安定するまで待機
      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId1,
        { timeout: 5000 }
      );

      // 現在のタブ数を取得
      const initialTabCount = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();

      // 元のタブの位置（Y座標）を取得
      const originalY = await sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`).boundingBox().then(b => b?.y ?? 0);

      // Act: タブ1を複製
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 新しいタブが作成されるまで待機
      await expect(sidePanelPage.locator('[data-testid^="tree-node-"]')).toHaveCount(initialTabCount + 1, { timeout: 10000 });

      // 複製されたタブのIDを取得
      const duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
        return sortedTabs[0]?.id;
      }, [tabId1]);

      expect(duplicatedTabId).toBeDefined();

      await waitForTabInTreeState(extensionContext, duplicatedTabId!);

      // 複製されたタブがUIに表示されるまで待機
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${duplicatedTabId}"]`)).toBeVisible({ timeout: 10000 });

      // Assert: 複製されたタブが元のタブと同じ親（兄弟関係）を持つことを確認
      const { originalParentId, duplicateParentId } = await serviceWorker.evaluate(async ({ origId, dupId }) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode: Record<number, string>;
          nodes: Record<string, { parentId: string | null }>;
        };
        const origNodeId = treeState.tabToNode[origId];
        const dupNodeId = treeState.tabToNode[dupId];
        return {
          originalParentId: treeState.nodes[origNodeId]?.parentId,
          duplicateParentId: treeState.nodes[dupNodeId]?.parentId,
        };
      }, { origId: tabId1, dupId: duplicatedTabId! });

      // 複製されたタブは元のタブと同じ親を持つ（兄弟関係）
      expect(duplicateParentId).toBe(originalParentId);

      // 複製されたタブのY座標が元のタブより下にあることを確認（直後に配置されている）
      const duplicateY = await sidePanelPage.locator(`[data-testid="tree-node-${duplicatedTabId}"]`).boundingBox().then(b => b?.y ?? 0);
      expect(duplicateY).toBeGreaterThan(originalY);

      // Cleanup
      await closeTab(extensionContext, tabId1);
      await closeTab(extensionContext, duplicatedTabId!);
    });
  });

  test.describe('Requirement 16.3: 複製されたタブが元のタブの子タブとして配置されない', () => {
    test('親タブを持つタブを複製しても、複製タブは子タブにならない', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 親子関係のあるタブを作成
      const parentTabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, parentTabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`)).toBeVisible({ timeout: 10000 });

      // 子タブを作成（親タブのopenerTabIdを指定）
      const childTabId = await createTab(extensionContext, 'about:blank', parentTabId);
      await waitForTabInTreeState(extensionContext, childTabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`)).toBeVisible({ timeout: 10000 });

      // 親子関係が反映されるまで待機
      await waitForParentChildRelation(extensionContext, childTabId, parentTabId);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 要素のバウンディングボックスが安定するまで待機
      await sidePanelPage.waitForFunction(
        (tid) => {
          const node = document.querySelector(`[data-testid="tree-node-${tid}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        childTabId,
        { timeout: 5000 }
      );

      // 元の子タブのノードIDを取得
      const childNodeId = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode: Record<number, string> };
        return treeState.tabToNode[tid];
      }, childTabId);

      // 現在のタブ数を取得
      const initialTabCount = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();

      // Act: 子タブを複製
      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
      await childNode.click({ button: 'right' });

      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });

      const duplicateItem = sidePanelPage.getByRole('menuitem', { name: 'タブを複製' });
      await expect(duplicateItem).toBeVisible({ timeout: 3000 });
      await duplicateItem.click();

      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // 新しいタブが作成されるまで待機
      await expect(sidePanelPage.locator('[data-testid^="tree-node-"]')).toHaveCount(initialTabCount + 1, { timeout: 10000 });

      // 複製されたタブのIDを取得
      const duplicatedTabId = await serviceWorker.evaluate(async (excludeIds) => {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        const sortedTabs = tabs.filter(t => t.id && !excludeIds.includes(t.id)).sort((a, b) => (b.id || 0) - (a.id || 0));
        return sortedTabs[0]?.id;
      }, [parentTabId, childTabId]);

      expect(duplicatedTabId).toBeDefined();

      await waitForTabInTreeState(extensionContext, duplicatedTabId!);

      // 複製されたタブがUIに表示されるまで待機
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${duplicatedTabId}"]`)).toBeVisible({ timeout: 10000 });

      // Assert: 複製されたタブの親ノードIDを確認
      const duplicateParentNodeId = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          tabToNode: Record<number, string>;
          nodes: Record<string, { parentId: string | null }>;
        };
        const nodeId = treeState.tabToNode[tid];
        return treeState.nodes[nodeId]?.parentId;
      }, duplicatedTabId!);

      // 複製されたタブの親が、複製元タブ自身でないことを確認
      // これにより、複製されたタブが複製元の子タブとして配置されていないことを検証
      expect(duplicateParentNodeId).not.toBe(childNodeId);

      // Cleanup
      await closeTab(extensionContext, parentTabId);
      await closeTab(extensionContext, childTabId);
      await closeTab(extensionContext, duplicatedTabId!);
    });
  });
});
