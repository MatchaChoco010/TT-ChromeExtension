/**
 * 新規タブ作成時のツリー展開テスト
 *
 * Task 9.1 (comprehensive-bugfix): 親タブの自動展開実装
 * Requirement 10.1, 10.2: ページ内リンクから新しいタブを開いた際にツリーが展開される
 *
 * このテストスイートでは以下を検証:
 * 1. 折りたたまれた親タブからリンクを開いた場合、親タブが自動的に展開される
 * 2. 新しい子タブが作成された場合、その子タブが見える状態になる
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import {
  waitForTabInTreeState,
  waitForParentChildRelation,
  waitForCondition,
} from './utils/polling-utils';

test.describe('新規タブ作成時のツリー展開', () => {
  test('折りたたまれた親タブから子タブを開くと、親タブが自動展開される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com');
    expect(parentTabId).toBeGreaterThan(0);
    await waitForTabInTreeState(extensionContext, parentTabId);

    // 子タブを作成（親タブのopenerTabIdを指定）
    const childTabId1 = await createTab(
      extensionContext,
      'https://example.com/child1',
      parentTabId
    );
    expect(childTabId1).toBeGreaterThan(0);
    await waitForTabInTreeState(extensionContext, childTabId1);
    await waitForParentChildRelation(extensionContext, childTabId1, parentTabId);

    // 親タブを折りたたむ（TreeStateManagerを経由して状態を更新）
    // treeStateManager.toggleExpand()を使用して折りたたむ
    await serviceWorker.evaluate(async (parentTabId) => {
      // globalThisからtreeStateManagerを取得
      const manager = (globalThis as { treeStateManager?: { toggleExpand: (nodeId: string) => Promise<void>; getNodeByTabId: (tabId: number) => { id: string } | null } }).treeStateManager;
      if (manager) {
        const node = manager.getNodeByTabId(parentTabId);
        if (node) {
          // 展開状態をトグルして折りたたむ（デフォルトはtrue=展開されている）
          await manager.toggleExpand(node.id);
        }
      }
    }, parentTabId);

    // 親タブが折りたたまれていることをポーリングで確認
    await waitForCondition(
      async () => {
        const isCollapsed = await serviceWorker.evaluate(async (parentTabId) => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as {
            nodes: Record<string, { isExpanded: boolean }>;
            tabToNode: Record<number, string>;
          };
          const parentNodeId = treeState?.tabToNode?.[parentTabId];
          return parentNodeId ? !treeState?.nodes?.[parentNodeId]?.isExpanded : false;
        }, parentTabId);
        return isCollapsed;
      },
      {
        timeout: 3000,
        interval: 50,
        timeoutMessage: 'Parent tab was not collapsed after toggleExpand',
      }
    );

    // 親タブから新しい子タブを作成（子タブはリンククリックで開かれたように振る舞う）
    // newTabPositionFromLink設定に関わらず、openerTabIdを指定してタブを作成
    const childTabId2 = await createTab(
      extensionContext,
      'https://example.com/child2',
      parentTabId
    );
    expect(childTabId2).toBeGreaterThan(0);
    await waitForTabInTreeState(extensionContext, childTabId2);
    await waitForParentChildRelation(extensionContext, childTabId2, parentTabId);

    // 親タブが自動展開されていることを確認
    await waitForCondition(
      async () => {
        const isExpanded = await serviceWorker.evaluate(async (parentTabId) => {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as {
            nodes: Record<string, { isExpanded: boolean }>;
            tabToNode: Record<number, string>;
          };
          const parentNodeId = treeState?.tabToNode?.[parentTabId];
          return parentNodeId ? treeState?.nodes?.[parentNodeId]?.isExpanded === true : false;
        }, parentTabId);
        return isExpanded;
      },
      {
        timeout: 5000,
        interval: 100,
        timeoutMessage: 'Parent tab was not auto-expanded after child tab creation',
      }
    );

    // クリーンアップ
    await closeTab(extensionContext, childTabId2);
    await closeTab(extensionContext, childTabId1);
    await closeTab(extensionContext, parentTabId);
  });

  test('既に展開されている親タブから子タブを開いても展開状態が維持される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com');
    expect(parentTabId).toBeGreaterThan(0);
    await waitForTabInTreeState(extensionContext, parentTabId);

    // 親タブが展開状態であることを確認
    const isExpandedBefore = await serviceWorker.evaluate(async (parentTabId) => {
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as {
        nodes: Record<string, { isExpanded: boolean }>;
        tabToNode: Record<number, string>;
      };
      const parentNodeId = treeState?.tabToNode?.[parentTabId];
      return parentNodeId ? treeState?.nodes?.[parentNodeId]?.isExpanded === true : false;
    }, parentTabId);
    expect(isExpandedBefore).toBe(true);

    // 子タブを作成
    const childTabId = await createTab(
      extensionContext,
      'https://example.com/child',
      parentTabId
    );
    expect(childTabId).toBeGreaterThan(0);
    await waitForTabInTreeState(extensionContext, childTabId);
    await waitForParentChildRelation(extensionContext, childTabId, parentTabId);

    // 親タブが展開状態のままであることを確認
    const isExpandedAfter = await serviceWorker.evaluate(async (parentTabId) => {
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as {
        nodes: Record<string, { isExpanded: boolean }>;
        tabToNode: Record<number, string>;
      };
      const parentNodeId = treeState?.tabToNode?.[parentTabId];
      return parentNodeId ? treeState?.nodes?.[parentNodeId]?.isExpanded === true : false;
    }, parentTabId);
    expect(isExpandedAfter).toBe(true);

    // クリーンアップ
    await closeTab(extensionContext, childTabId);
    await closeTab(extensionContext, parentTabId);
  });
});
