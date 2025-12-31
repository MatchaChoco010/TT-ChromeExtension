/**
 * Tree State Persistence E2E Tests
 *
 * Task 15.2 (comprehensive-bugfix): ツリー状態永続化のE2Eテスト
 * Requirements: 13.4, 13.5, 13.6
 *
 * このテストスイートでは、ツリー状態の永続化と復元を検証します。
 * - 親子関係がストレージに正しく保存されること
 * - 折りたたみ状態がストレージに正しく保存されること
 * - サイドパネルリロード後に親子関係が復元されること
 * - サイドパネルリロード後に折りたたみ状態が復元されること
 *
 * Note: `--repeat-each=10`で安定性を確認済み
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { moveTabToParent, getParentTabId, getTabDepth } from './utils/drag-drop-utils';
import { waitForParentChildRelation, waitForCondition, waitForTabInTreeState } from './utils/polling-utils';

test.describe('Task 15.2: ツリー状態永続化', () => {
  // タイムアウトを延長（D&D操作があるため）
  test.setTimeout(120000);

  test.describe('Requirement 13.4: 親子関係の永続化', () => {
    test('親子関係がストレージに正しく保存されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 準備: 親タブと子タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      const childTab = await createTab(extensionContext, 'https://www.iana.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab);
      await assertTabInTree(sidePanelPage, childTab);

      // D&Dで親子関係を作成
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

      // ストレージで親子関係が保存されていることを確認
      const parentIdInStorage = await serviceWorker.evaluate(async ({ childId, parentId }) => {
        interface TreeNode {
          id: string;
          tabId: number;
          parentId: string | null;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
        }
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) return { found: false, parentNodeId: null };

        const childNodeId = treeState.tabToNode[childId];
        const parentNodeId = treeState.tabToNode[parentId];
        if (!childNodeId || !parentNodeId) return { found: false, parentNodeId: null };

        const childNode = treeState.nodes[childNodeId];
        return { found: true, parentNodeId: childNode?.parentId, expectedParentNodeId: parentNodeId };
      }, { childId: childTab, parentId: parentTab });

      expect(parentIdInStorage.found).toBe(true);
      expect(parentIdInStorage.parentNodeId).toBe(parentIdInStorage.expectedParentNodeId);
    });

    test('サイドパネルリロード後に親子関係が復元されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 準備: 親タブと子タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      const childTab = await createTab(extensionContext, 'https://www.iana.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab);
      await assertTabInTree(sidePanelPage, childTab);

      // D&Dで親子関係を作成
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

      // UIで親子関係を確認
      const parentNodeBefore = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButtonBefore = parentNodeBefore.locator('[data-testid="expand-button"]');
      if ((await expandButtonBefore.count()) > 0) {
        const isExpanded = await parentNodeBefore.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await expandButtonBefore.first().click();
          await expect(parentNodeBefore).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }
      const childParentBefore = await getParentTabId(sidePanelPage, childTab);
      expect(childParentBefore).toBe(parentTab);

      // サイドパネルをリロード
      const currentWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${currentWindow.id}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      // タブがリロード後もツリーに表示されることを確認
      await waitForCondition(async () => {
        const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
        return (await parentNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Parent tab ${parentTab} not visible after reload` });

      // 親タブを展開して子タブを表示
      const parentNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButtonAfter = parentNodeAfter.locator('[data-testid="expand-button"]');
      if ((await expandButtonAfter.count()) > 0) {
        const isExpanded = await parentNodeAfter.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await expandButtonAfter.first().click();
          await expect(parentNodeAfter).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
        }
      }

      // リロード後も親子関係が維持されていることを確認
      const childParentAfter = await getParentTabId(sidePanelPage, childTab);
      expect(childParentAfter).toBe(parentTab);

      // 子タブのdepthが正しいことを確認
      const childDepthAfter = await getTabDepth(sidePanelPage, childTab);
      expect(childDepthAfter).toBe(1);
    });

    test('深いネストの親子関係がストレージに正しく保存・復元されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 準備: 3階層のタブ構造を作成
      const rootTab = await createTab(extensionContext, 'https://example.com');
      const childTab = await createTab(extensionContext, 'https://www.iana.org');
      const grandchildTab = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, rootTab);
      await assertTabInTree(sidePanelPage, childTab);
      await assertTabInTree(sidePanelPage, grandchildTab);

      // D&Dで階層構造を構築
      await moveTabToParent(sidePanelPage, childTab, rootTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, childTab, rootTab, { timeout: 5000 });

      await moveTabToParent(sidePanelPage, grandchildTab, childTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, grandchildTab, childTab, { timeout: 5000 });

      // ヘルパー関数: タブを展開
      const expandTab = async (tabId: number) => {
        const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
        const expandButton = tabNode.locator('[data-testid="expand-button"]');
        if ((await expandButton.count()) > 0) {
          const isExpanded = await tabNode.getAttribute('data-expanded');
          if (isExpanded !== 'true') {
            await expandButton.first().click();
            await expect(tabNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
          }
        }
      };

      // 親タブを展開
      await expandTab(rootTab);
      await expandTab(childTab);

      // サイドパネルをリロード
      const currentWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${currentWindow.id}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      // タブがリロード後もツリーに表示されることを確認
      await waitForCondition(async () => {
        const rootNode = sidePanelPage.locator(`[data-testid="tree-node-${rootTab}"]`);
        return (await rootNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Root tab ${rootTab} not visible after reload` });

      // 親タブを展開
      await expandTab(rootTab);
      await expandTab(childTab);

      // リロード後も親子関係が維持されていることを確認
      const childParent = await getParentTabId(sidePanelPage, childTab);
      expect(childParent).toBe(rootTab);

      const grandchildParent = await getParentTabId(sidePanelPage, grandchildTab);
      expect(grandchildParent).toBe(childTab);

      // depthが正しいことを確認
      const childDepth = await getTabDepth(sidePanelPage, childTab);
      expect(childDepth).toBe(1);

      const grandchildDepth = await getTabDepth(sidePanelPage, grandchildTab);
      expect(grandchildDepth).toBe(2);
    });
  });

  test.describe('Requirement 13.5: 折りたたみ状態の永続化', () => {
    test('折りたたみ状態がストレージに正しく保存されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 準備: 親タブと子タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      const childTab = await createTab(extensionContext, 'https://www.iana.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab);
      await assertTabInTree(sidePanelPage, childTab);

      // D&Dで親子関係を作成
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

      // 親タブを展開
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      // 展開ボタンをクリックして展開状態にする
      let isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
      }

      // ストレージで展開状態が保存されていることを確認
      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface LocalTreeState {
            tabToNode: Record<number, string>;
            nodes: Record<string, TreeNode>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.nodes || !treeState?.tabToNode) return null;

          const nodeId = treeState.tabToNode[parentId];
          if (!nodeId) return null;

          const node = treeState.nodes[nodeId];
          return node?.isExpanded ?? null;
        }, parentTab);
        return isExpandedInStorage === true;
      }, { timeout: 5000, timeoutMessage: 'Expanded state was not saved to storage' });

      // 折りたたみ状態に変更
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'false', { timeout: 5000 });

      // ストレージで折りたたみ状態が保存されていることを確認
      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface LocalTreeState {
            tabToNode: Record<number, string>;
            nodes: Record<string, TreeNode>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.nodes || !treeState?.tabToNode) return null;

          const nodeId = treeState.tabToNode[parentId];
          if (!nodeId) return null;

          const node = treeState.nodes[nodeId];
          return node?.isExpanded ?? null;
        }, parentTab);
        return isExpandedInStorage === false;
      }, { timeout: 5000, timeoutMessage: 'Collapsed state was not saved to storage' });
    });

    test('サイドパネルリロード後に折りたたみ状態が復元されること（折りたたみ状態）', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 準備: 親タブと子タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      const childTab = await createTab(extensionContext, 'https://www.iana.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab);
      await assertTabInTree(sidePanelPage, childTab);

      // D&Dで親子関係を作成
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

      // 親タブを折りたたみ状態にする
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      // 展開されている場合は折りたたむ
      const isExpandedBefore = await parentNode.getAttribute('data-expanded');
      if (isExpandedBefore === 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'false', { timeout: 5000 });
      }

      // 折りたたみ状態がストレージに保存されるまで待機
      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface LocalTreeState {
            tabToNode: Record<number, string>;
            nodes: Record<string, TreeNode>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.nodes || !treeState?.tabToNode) return null;

          const nodeId = treeState.tabToNode[parentId];
          if (!nodeId) return null;

          const node = treeState.nodes[nodeId];
          return node?.isExpanded ?? null;
        }, parentTab);
        return isExpandedInStorage === false;
      }, { timeout: 5000, timeoutMessage: 'Collapsed state was not saved to storage' });

      // サイドパネルをリロード
      const currentWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${currentWindow.id}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      // タブがリロード後もツリーに表示されることを確認
      await waitForCondition(async () => {
        const pNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
        return (await pNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Parent tab ${parentTab} not visible after reload` });

      // リロード後も折りたたみ状態が維持されていることを確認
      const parentNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const isExpandedAfter = await parentNodeAfter.getAttribute('data-expanded');
      expect(isExpandedAfter).toBe('false');
    });

    test('サイドパネルリロード後に折りたたみ状態が復元されること（展開状態）', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 準備: 親タブと子タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      const childTab = await createTab(extensionContext, 'https://www.iana.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab);
      await assertTabInTree(sidePanelPage, childTab);

      // D&Dで親子関係を作成
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

      // 親タブを展開状態にする
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      // 折りたたまれている場合は展開する
      const isExpandedBefore = await parentNode.getAttribute('data-expanded');
      if (isExpandedBefore !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
      }

      // 展開状態がストレージに保存されるまで待機
      await waitForCondition(async () => {
        const isExpandedInStorage = await serviceWorker.evaluate(async (parentId) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface LocalTreeState {
            tabToNode: Record<number, string>;
            nodes: Record<string, TreeNode>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.nodes || !treeState?.tabToNode) return null;

          const nodeId = treeState.tabToNode[parentId];
          if (!nodeId) return null;

          const node = treeState.nodes[nodeId];
          return node?.isExpanded ?? null;
        }, parentTab);
        return isExpandedInStorage === true;
      }, { timeout: 5000, timeoutMessage: 'Expanded state was not saved to storage' });

      // サイドパネルをリロード
      const currentWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${currentWindow.id}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      // タブがリロード後もツリーに表示されることを確認
      await waitForCondition(async () => {
        const pNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`);
        return (await pNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Parent tab ${parentTab} not visible after reload` });

      // リロード後も展開状態が維持されていることを確認
      const parentNodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const isExpandedAfter = await parentNodeAfter.getAttribute('data-expanded');
      expect(isExpandedAfter).toBe('true');

      // 子タブが表示されていることを確認
      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`).first();
      await expect(childNode).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('Requirement 13.6: 統合テスト', () => {
    test('親子関係と折りたたみ状態の両方がリロード後に復元されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 準備: 複数のタブで異なる親子関係と折りたたみ状態を作成
      // Parent1 (展開) -> Child1
      // Parent2 (折りたたみ) -> Child2
      const parent1 = await createTab(extensionContext, 'https://example.com');
      const child1 = await createTab(extensionContext, 'https://www.iana.org');
      const parent2 = await createTab(extensionContext, 'https://www.w3.org');
      const child2 = await createTab(extensionContext, 'https://developer.mozilla.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parent1);
      await assertTabInTree(sidePanelPage, child1);
      await assertTabInTree(sidePanelPage, parent2);
      await assertTabInTree(sidePanelPage, child2);

      // D&Dで親子関係を作成
      await moveTabToParent(sidePanelPage, child1, parent1, serviceWorker);
      await waitForParentChildRelation(extensionContext, child1, parent1, { timeout: 5000 });

      await moveTabToParent(sidePanelPage, child2, parent2, serviceWorker);
      await waitForParentChildRelation(extensionContext, child2, parent2, { timeout: 5000 });

      // ヘルパー関数: タブの折りたたみ状態を設定
      const setExpandedState = async (tabId: number, expanded: boolean) => {
        const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
        const expandButton = tabNode.locator('[data-testid="expand-button"]');
        if ((await expandButton.count()) > 0) {
          const isExpanded = await tabNode.getAttribute('data-expanded');
          if (expanded && isExpanded !== 'true') {
            await expandButton.first().click();
            await expect(tabNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
          } else if (!expanded && isExpanded === 'true') {
            await expandButton.first().click();
            await expect(tabNode).toHaveAttribute('data-expanded', 'false', { timeout: 5000 });
          }
        }
      };

      // parent1は展開状態、parent2は折りたたみ状態にする
      await setExpandedState(parent1, true);
      await setExpandedState(parent2, false);

      // ストレージに保存されるまで待機
      await waitForCondition(async () => {
        const states = await serviceWorker.evaluate(async ({ parent1Id, parent2Id }) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface LocalTreeState {
            tabToNode: Record<number, string>;
            nodes: Record<string, TreeNode>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.nodes || !treeState?.tabToNode) return null;

          const node1Id = treeState.tabToNode[parent1Id];
          const node2Id = treeState.tabToNode[parent2Id];
          if (!node1Id || !node2Id) return null;

          const node1 = treeState.nodes[node1Id];
          const node2 = treeState.nodes[node2Id];
          return {
            parent1Expanded: node1?.isExpanded,
            parent2Expanded: node2?.isExpanded,
          };
        }, { parent1Id: parent1, parent2Id: parent2 });
        return states?.parent1Expanded === true && states?.parent2Expanded === false;
      }, { timeout: 5000, timeoutMessage: 'Expand states were not saved to storage' });

      // サイドパネルをリロード
      const currentWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${currentWindow.id}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      // タブがリロード後もツリーに表示されることを確認
      await waitForCondition(async () => {
        const p1Node = sidePanelPage.locator(`[data-testid="tree-node-${parent1}"]`);
        const p2Node = sidePanelPage.locator(`[data-testid="tree-node-${parent2}"]`);
        return (await p1Node.count()) > 0 && (await p2Node.count()) > 0;
      }, { timeout: 10000, timeoutMessage: 'Parent tabs not visible after reload' });

      // リロード後の状態を検証
      // parent1: 展開状態
      const parent1NodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parent1}"]`).first();
      const parent1ExpandedAfter = await parent1NodeAfter.getAttribute('data-expanded');
      expect(parent1ExpandedAfter).toBe('true');

      // parent2: 折りたたみ状態
      const parent2NodeAfter = sidePanelPage.locator(`[data-testid="tree-node-${parent2}"]`).first();
      const parent2ExpandedAfter = await parent2NodeAfter.getAttribute('data-expanded');
      expect(parent2ExpandedAfter).toBe('false');

      // 親子関係も維持されていることを確認
      const child1Parent = await getParentTabId(sidePanelPage, child1);
      expect(child1Parent).toBe(parent1);

      // parent2を展開して子タブを確認
      await setExpandedState(parent2, true);
      const child2Parent = await getParentTabId(sidePanelPage, child2);
      expect(child2Parent).toBe(parent2);
    });

    test('複数回の折りたたみ操作後もストレージが正しく更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 準備: 親タブと子タブを作成
      const parentTab = await createTab(extensionContext, 'https://example.com');
      const childTab = await createTab(extensionContext, 'https://www.iana.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, parentTab);
      await assertTabInTree(sidePanelPage, childTab);

      // D&Dで親子関係を作成
      await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
      await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

      // 親タブの展開ボタンを取得
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
      const expandButton = parentNode.locator('[data-testid="expand-button"]');
      await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

      // ヘルパー関数: ストレージの展開状態を確認
      const getExpandedFromStorage = async () => {
        return await serviceWorker.evaluate(async (parentId) => {
          interface TreeNode {
            id: string;
            tabId: number;
            isExpanded: boolean;
          }
          interface LocalTreeState {
            tabToNode: Record<number, string>;
            nodes: Record<string, TreeNode>;
          }
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.nodes || !treeState?.tabToNode) return null;

          const nodeId = treeState.tabToNode[parentId];
          if (!nodeId) return null;

          const node = treeState.nodes[nodeId];
          return node?.isExpanded ?? null;
        }, parentTab);
      };

      // 展開 -> 折りたたみ -> 展開 を繰り返す
      // 1. 展開状態にする
      let isExpanded = await parentNode.getAttribute('data-expanded');
      if (isExpanded !== 'true') {
        await expandButton.first().click();
        await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
      }
      await waitForCondition(async () => (await getExpandedFromStorage()) === true, { timeout: 3000 });
      expect(await getExpandedFromStorage()).toBe(true);

      // 2. 折りたたみ状態にする
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'false', { timeout: 5000 });
      await waitForCondition(async () => (await getExpandedFromStorage()) === false, { timeout: 3000 });
      expect(await getExpandedFromStorage()).toBe(false);

      // 3. 再び展開状態にする
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
      await waitForCondition(async () => (await getExpandedFromStorage()) === true, { timeout: 3000 });
      expect(await getExpandedFromStorage()).toBe(true);
    });
  });
});
