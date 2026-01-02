/**
 * ドラッグ&ドロップによる階層変更（親子関係の作成）テスト
 *
 * 自前D&D実装用に書き直し
 *
 * このテストスイートでは、ドラッグ&ドロップによる親子関係の作成を検証します。
 * - タブを別のタブに重ねてドロップした際の親子関係作成
 * - 初めて子タブを追加した際の展開/折りたたみアイコン表示
 * - 折りたたまれた親タブへの子タブドロップ時の自動展開
 * - 既存の子を持つ親への新しい子の追加
 * - 深い階層のタブ移動時のdepth再計算
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { moveTabToParent, getParentTabId, getTabDepth } from './utils/drag-drop-utils';
import { waitForParentChildRelation, waitForTabDepthInUI } from './utils/polling-utils';

test.describe('ドラッグ&ドロップによる階層変更（親子関係の作成）', () => {
  // Playwrightのmouse.moveは各ステップで約1秒かかるため、タイムアウトを延長
  test.setTimeout(120000);

  test('タブを別のタブに重ねてドロップした場合、ドロップ先タブの子として配置されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 2つのルートレベルのタブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);

    // 実行: childTabをparentTabにドロップして親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

    // 検証: 親子関係が作成されたことを確認
    const actualParent = await getParentTabId(sidePanelPage, childTab);
    expect(actualParent).toBe(parentTab);

    // 親タブノードに展開ボタンが表示されることを確認
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 3000 });

    // 子タブが表示されることを確認（親を展開後）
    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`);
    await expect(childNode.first()).toBeVisible({ timeout: 3000 });
  });

  test('子タブを持たないタブに初めて子タブを追加した場合、親タブに展開/折りたたみアイコンが表示されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 2つのルートレベルのタブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);

    // 初期状態: 親タブに展開ボタンがないことを確認（子がいないため）
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButtonBefore = parentNode.locator('[data-testid="expand-button"]');
    const hasExpandButtonBefore = (await expandButtonBefore.count()) > 0;

    // 実行: childTabをparentTabにドロップして親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

    // 検証: 親タブに展開/折りたたみボタンが表示されること
    const expandButtonAfter = parentNode.locator('[data-testid="expand-button"]');

    if (!hasExpandButtonBefore) {
      // 展開ボタンが新しく表示されることを確認
      await expect(expandButtonAfter.first()).toBeVisible({ timeout: 5000 });
    } else {
      // 既に展開ボタンがある場合は、引き続き存在することを確認
      await expect(async () => {
        const hasExpandButtonAfter = (await expandButtonAfter.count()) > 0;
        expect(hasExpandButtonAfter).toBe(true);
      }).toPass({ timeout: 3000 });
    }
  });

  test('折りたたまれた親タブに子タブをドロップした場合、親タブが自動的に展開されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと既存の子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const existingChild = await createTab(extensionContext, 'https://www.iana.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, existingChild);

    // 既存の子タブを親タブの子にする
    await moveTabToParent(sidePanelPage, existingChild, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, existingChild, parentTab, { timeout: 5000 });

    // 親タブノードを取得して展開ボタンが表示されるまで待機
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]').first();
    await expect(expandButton).toBeVisible({ timeout: 5000 });

    // 親タブが展開されている場合は折りたたむ
    const isExpandedBefore = await parentNode.getAttribute('data-expanded');
    if (isExpandedBefore === 'true') {
      await expandButton.click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'false', { timeout: 3000 });
    }

    // 新しいタブを作成
    const newChild = await createTab(extensionContext, 'https://www.w3.org');
    await assertTabInTree(sidePanelPage, newChild);

    // 実行: 新しいタブを折りたたまれた親タブにドロップ
    await moveTabToParent(sidePanelPage, newChild, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, newChild, parentTab, { timeout: 5000 });

    // 検証: 新しい子タブが表示されること（親が自動展開されるか、表示されること）
    const newChildNode = sidePanelPage.locator(`[data-testid="tree-node-${newChild}"]`);
    await expect(newChildNode.first()).toBeVisible({ timeout: 5000 });

    // 親タブが展開状態であることを確認（可能であれば）
    const isExpandedAfter = await parentNode.getAttribute('data-expanded');
    if (isExpandedAfter !== null) {
      expect(isExpandedAfter).toBe('true');
    }
  });

  test('既に子を持つ親タブに新しい子をドロップした場合、子タブリストに追加されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: まずすべてのタブを作成（他のテストと同様のパターン）
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const child1 = await createTab(extensionContext, 'https://www.iana.org');
    const newChild = await createTab(extensionContext, 'https://developer.mozilla.org');

    // すべてのタブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, newChild);

    // D&Dで親子関係を構築
    // 最初に child1 を parentTab の子にする
    await moveTabToParent(sidePanelPage, child1, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, child1, parentTab, { timeout: 5000 });

    // 親タブを展開して子タブを表示
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.first().click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    // 次に newChild を parentTab の子にする
    await moveTabToParent(sidePanelPage, newChild, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, newChild, parentTab, { timeout: 5000 });

    // 検証: 両方の子タブが存在し、親子関係が正しいことを確認
    await expect(async () => {
      const parent1 = await getParentTabId(sidePanelPage, child1);
      const parent2 = await getParentTabId(sidePanelPage, newChild);

      expect(parent1).toBe(parentTab);
      expect(parent2).toBe(parentTab);
    }).toPass({ timeout: 5000 });
  });

  test('深い階層のタブを別の親にドロップした場合、depthが正しく再計算されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 深い階層のタブ構造を作成
    // Level 0: rootTab
    // Level 1: parentTab1 (rootTabの子)
    // Level 2: childTab (parentTab1の子)
    // Level 3: grandChildTab (childTabの子)
    const rootTab = await createTab(extensionContext, 'https://example.com');
    const parentTab1 = await createTab(extensionContext, 'https://www.iana.org');
    const childTab = await createTab(extensionContext, 'https://www.w3.org');
    const grandChildTab = await createTab(extensionContext, 'https://developer.mozilla.org');

    // 別のルートレベルのタブを作成（移動先）
    const parentTab2 = await createTab(extensionContext, 'https://github.com');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, rootTab);
    await assertTabInTree(sidePanelPage, parentTab1);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, grandChildTab);
    await assertTabInTree(sidePanelPage, parentTab2);

    // D&Dで階層構造を構築（各操作後に親子関係の反映を待機）
    await moveTabToParent(sidePanelPage, parentTab1, rootTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, parentTab1, rootTab, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, childTab, parentTab1, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab1, { timeout: 5000 });

    await moveTabToParent(sidePanelPage, grandChildTab, childTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, grandChildTab, childTab, { timeout: 5000 });

    // ツリーを展開してすべてのタブを表示
    const expandNode = async (tabId: number) => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
      const button = node.locator('[data-testid="expand-button"]');
      if ((await button.count()) > 0) {
        const isExpanded = await node.getAttribute('data-expanded');
        if (isExpanded !== 'true') {
          await button.first().click();
          await expect(node).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
        }
      }
    };

    await expandNode(rootTab);
    await expandNode(parentTab1);
    await expandNode(childTab);

    // 移動前のdepthを確認
    const childDepthBefore = await getTabDepth(sidePanelPage, childTab);
    const grandChildDepthBefore = await getTabDepth(sidePanelPage, grandChildTab);

    // childTabはrootTab -> parentTab1 -> childTabなのでdepth 2
    // grandChildTabはrootTab -> parentTab1 -> childTab -> grandChildTabなのでdepth 3
    expect(childDepthBefore).toBe(2);
    expect(grandChildDepthBefore).toBe(3);

    // 実行: childTab（およびそのサブツリー）をparentTab2にドロップ
    await moveTabToParent(sidePanelPage, childTab, parentTab2, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab2, { timeout: 5000 });

    // parentTab2を展開
    await expandNode(parentTab2);

    // childTabを再度展開（移動後）
    await expandNode(childTab);

    // 検証: childTabとgrandChildTabが新しい親の配下に移動したことを確認
    const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTab}"]`);
    await expect(childNode.first()).toBeVisible({ timeout: 5000 });

    const grandChildNode = sidePanelPage.locator(`[data-testid="tree-node-${grandChildTab}"]`);
    await expect(grandChildNode.first()).toBeVisible({ timeout: 5000 });

    // 親子関係が正しいことを確認
    const childParent = await getParentTabId(sidePanelPage, childTab);
    expect(childParent).toBe(parentTab2);

    const grandChildParent = await getParentTabId(sidePanelPage, grandChildTab);
    expect(grandChildParent).toBe(childTab);

    // depthが正しく再計算されたことを確認
    // childTabはparentTab2 -> childTabなのでdepth 1
    // grandChildTabはparentTab2 -> childTab -> grandChildTabなのでdepth 2
    await expect(async () => {
      const childDepthAfter = await getTabDepth(sidePanelPage, childTab);
      const grandChildDepthAfter = await getTabDepth(sidePanelPage, grandChildTab);

      expect(childDepthAfter).toBe(1);
      expect(grandChildDepthAfter).toBe(2);
      // grandChildのdepthはchildのdepth + 1であることも確認
      expect(grandChildDepthAfter).toBe(childDepthAfter + 1);
    }).toPass({ timeout: 5000 });
  });

  test('D&Dで親子関係を作成した後、新規タブを開いても既存の親子関係が維持されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 2つのルートレベルのタブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com/parent-dnd');
    const childTab = await createTab(extensionContext, 'https://example.org/child-dnd');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

    // D&D後の親子関係が正しいことを確認
    const actualParent = await getParentTabId(sidePanelPage, childTab);
    expect(actualParent).toBe(parentTab);

    // UI上の深さを確認（D&D後）- ポーリングで待機
    await waitForTabDepthInUI(sidePanelPage, parentTab, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, childTab, 1, { timeout: 3000 });

    // *** 重要: 実際のブラウザと同様に、D&D後に十分待機してから新規タブを作成 ***
    // ユーザーはD&D後に数秒待ってから新規タブを作成しても親子関係が失われると報告している
    // これはレースコンディションではなく、何か根本的な問題があることを示唆している

    // D&D後、数秒待機（実際のブラウザ操作をシミュレート）
    await sidePanelPage.waitForTimeout(3000);

    // 待機後のストレージ状態を確認
    const storageBeforeNewTab = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
          treeStructure?: unknown[];
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { error: 'No tree state' };
        }

        const parentNodeId = treeState.tabToNode[parentTabId];
        const childNodeId = treeState.tabToNode[childTabId];

        return {
          parentNodeId,
          childNodeId,
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
          treeStructureLength: treeState.treeStructure?.length ?? 0,
        };
      },
      { parentTabId: parentTab, childTabId: childTab }
    );

    // 新規タブを作成（ブラウザの「新しいタブ」ボタンをシミュレート）
    // 実際のブラウザでは about:blank や chrome://newtab が作成される
    const newTab = await serviceWorker.evaluate(async () => {
      // ブラウザの新しいタブボタンと同様に、URLなしで作成
      const tab = await chrome.tabs.create({});
      return tab.id as number;
    });

    // タブがツリーに表示されるまで待機
    await expect(async () => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${newTab}"]`);
      await expect(node.first()).toBeVisible();
    }).toPass({ timeout: 5000 });

    // 新規タブ作成後、UIが安定するまで待機
    await sidePanelPage.waitForTimeout(1000);

    // 新規タブ作成直後のストレージ状態を確認
    const storageAfterNewTab = await serviceWorker.evaluate(
      async ({ parentTabId, childTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
          treeStructure?: unknown[];
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { error: 'No tree state' };
        }

        const parentNodeId = treeState.tabToNode[parentTabId];
        const childNodeId = treeState.tabToNode[childTabId];

        return {
          parentNodeId,
          childNodeId,
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
          treeStructureLength: treeState.treeStructure?.length ?? 0,
        };
      },
      { parentTabId: parentTab, childTabId: childTab }
    );

    // UI上の状態を即座に取得して検証
    const parentDepthAfterNewTab = await sidePanelPage
      .locator(`[data-testid="tree-node-${parentTab}"]`)
      .getAttribute('data-depth');
    const childDepthAfterNewTab = await sidePanelPage
      .locator(`[data-testid="tree-node-${childTab}"]`)
      .getAttribute('data-depth');
    const newTabDepth = await sidePanelPage
      .locator(`[data-testid="tree-node-${newTab}"]`)
      .getAttribute('data-depth');

    // 親タブノードの展開ボタンがまだ存在するか確認
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButtonAfterNewTab = parentNode.locator('[data-testid="expand-button"]');
    const hasExpandButton = await expandButtonAfterNewTab.count() > 0;

    // 親タブはdepth=0であること
    expect(parentDepthAfterNewTab).toBe('0');
    // 子タブはdepth=1であること
    // 問題があれば、これは '0' になる（テストが失敗する）
    expect(childDepthAfterNewTab).toBe('1');
    // 新規タブはdepth=0であること
    expect(newTabDepth).toBe('0');

    // 親に展開ボタンがあることを確認（子がいることの証拠）
    expect(hasExpandButton).toBe(true);

    // 親子関係がUIでも確認できることを検証
    const parentAfterNewTab = await getParentTabId(sidePanelPage, childTab);
    expect(parentAfterNewTab).toBe(parentTab);

    // ストレージの状態も確認
    const relationsStillValid = await serviceWorker.evaluate(
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

        // 親子関係の検証
        if (childNode.parentId !== parentNodeId) {
          return {
            valid: false,
            reason: 'Child should be child of parent',
            actualParentId: childNode.parentId,
            expectedParentId: parentNodeId,
          };
        }

        // 深さの検証
        if (parentNode.depth !== 0 || childNode.depth !== 1) {
          return {
            valid: false,
            reason: 'Depth mismatch',
            parentDepth: parentNode.depth,
            childDepth: childNode.depth,
          };
        }

        return { valid: true };
      },
      { parentTabId: parentTab, childTabId: childTab }
    );

    expect(relationsStillValid).toEqual({ valid: true });
  });

  test('D&Dで複数の親子関係を作成した後、新規タブを開いても全ての親子関係が維持されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 4つのルートレベルのタブを作成
    const parent1 = await createTab(extensionContext, 'https://example.com/parent1-multi');
    const child1 = await createTab(extensionContext, 'https://example.org/child1-multi');
    const parent2 = await createTab(extensionContext, 'https://example.net/parent2-multi');
    const child2 = await createTab(extensionContext, 'https://www.w3.org/child2-multi');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parent1);
    await assertTabInTree(sidePanelPage, child1);
    await assertTabInTree(sidePanelPage, parent2);
    await assertTabInTree(sidePanelPage, child2);

    // D&Dで親子関係を作成（親子関係1）
    await moveTabToParent(sidePanelPage, child1, parent1, serviceWorker);
    await waitForParentChildRelation(extensionContext, child1, parent1, { timeout: 5000 });

    // D&Dで親子関係を作成（親子関係2）
    await moveTabToParent(sidePanelPage, child2, parent2, serviceWorker);
    await waitForParentChildRelation(extensionContext, child2, parent2, { timeout: 5000 });

    // UI上の深さを確認（D&D後）
    await waitForTabDepthInUI(sidePanelPage, parent1, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, child1, 1, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, parent2, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, child2, 1, { timeout: 3000 });

    // *** 重要: 新規タブを作成 ***
    const newTab = await createTab(extensionContext, 'https://github.com/new-tab-multi');
    await assertTabInTree(sidePanelPage, newTab);

    // 新規タブ作成後、UIが安定するまで待機
    await sidePanelPage.waitForTimeout(1000);

    // UI上の状態を即座に取得して検証（ポーリングではなく直接検証）
    const parent1Depth = await sidePanelPage
      .locator(`[data-testid="tree-node-${parent1}"]`)
      .getAttribute('data-depth');
    const child1Depth = await sidePanelPage
      .locator(`[data-testid="tree-node-${child1}"]`)
      .getAttribute('data-depth');
    const parent2Depth = await sidePanelPage
      .locator(`[data-testid="tree-node-${parent2}"]`)
      .getAttribute('data-depth');
    const child2Depth = await sidePanelPage
      .locator(`[data-testid="tree-node-${child2}"]`)
      .getAttribute('data-depth');
    const newTabDepth = await sidePanelPage
      .locator(`[data-testid="tree-node-${newTab}"]`)
      .getAttribute('data-depth');

    // 親タブ1はdepth=0であること
    expect(parent1Depth).toBe('0');
    // 子タブ1はdepth=1であること
    expect(child1Depth).toBe('1');
    // 親タブ2はdepth=0であること
    expect(parent2Depth).toBe('0');
    // 子タブ2はdepth=1であること
    expect(child2Depth).toBe('1');
    // 新規タブはdepth=0であること
    expect(newTabDepth).toBe('0');

    // ストレージの状態も確認
    const allRelationsStillValid = await serviceWorker.evaluate(
      async ({ parent1Id, child1Id, parent2Id, child2Id }) => {
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

        // 親子関係1の検証
        const parent1NodeId = treeState.tabToNode[parent1Id];
        const child1NodeId = treeState.tabToNode[child1Id];
        if (!parent1NodeId || !child1NodeId) {
          return { valid: false, reason: 'Missing node IDs for relation 1' };
        }
        const child1Node = treeState.nodes[child1NodeId];
        if (!child1Node || child1Node.parentId !== parent1NodeId) {
          return {
            valid: false,
            reason: 'Relation 1 broken',
            actualParentId: child1Node?.parentId,
            expectedParentId: parent1NodeId,
          };
        }

        // 親子関係2の検証
        const parent2NodeId = treeState.tabToNode[parent2Id];
        const child2NodeId = treeState.tabToNode[child2Id];
        if (!parent2NodeId || !child2NodeId) {
          return { valid: false, reason: 'Missing node IDs for relation 2' };
        }
        const child2Node = treeState.nodes[child2NodeId];
        if (!child2Node || child2Node.parentId !== parent2NodeId) {
          return {
            valid: false,
            reason: 'Relation 2 broken',
            actualParentId: child2Node?.parentId,
            expectedParentId: parent2NodeId,
          };
        }

        return { valid: true };
      },
      { parent1Id: parent1, child1Id: child1, parent2Id: parent2, child2Id: child2 }
    );

    expect(allRelationsStillValid).toEqual({ valid: true });
  });

  test('D&Dで親子関係を作成した後、別のタブを閉じても既存の親子関係が維持されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 3つのタブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com/parent-close');
    const childTab = await createTab(extensionContext, 'https://example.org/child-close');
    const unrelatedTab = await createTab(extensionContext, 'https://www.w3.org/unrelated-close');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, unrelatedTab);

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

    // D&D後の親子関係が正しいことを確認
    const actualParent = await getParentTabId(sidePanelPage, childTab);
    expect(actualParent).toBe(parentTab);

    // UI上の深さを確認（D&D後）
    await waitForTabDepthInUI(sidePanelPage, parentTab, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, childTab, 1, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, unrelatedTab, 0, { timeout: 3000 });

    // *** 重要: 無関係なタブを閉じる ***
    // これが既存の親子関係を壊さないことを検証
    const pages = extensionContext.pages();
    const unrelatedPage = pages.find(p => p.url().includes('unrelated-close'));
    if (unrelatedPage) {
      await unrelatedPage.close();
    } else {
      // Service Workerを使ってタブを閉じる
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.remove(tabId);
      }, unrelatedTab);
    }

    // タブが閉じられたことを確認
    await expect(async () => {
      const node = sidePanelPage.locator(`[data-testid="tree-node-${unrelatedTab}"]`);
      await expect(node).toHaveCount(0);
    }).toPass({ timeout: 5000 });

    // タブ削除後、UIが安定するまで待機
    await sidePanelPage.waitForTimeout(1000);

    // UI上の状態を即座に取得して検証（ポーリングではなく直接検証）
    const parentDepthAfterClose = await sidePanelPage
      .locator(`[data-testid="tree-node-${parentTab}"]`)
      .getAttribute('data-depth');
    const childDepthAfterClose = await sidePanelPage
      .locator(`[data-testid="tree-node-${childTab}"]`)
      .getAttribute('data-depth');

    // 親タブはdepth=0であること
    expect(parentDepthAfterClose).toBe('0');
    // 子タブはdepth=1であること
    expect(childDepthAfterClose).toBe('1');

    // 親子関係がUIでも確認できることを検証
    const parentAfterClose = await getParentTabId(sidePanelPage, childTab);
    expect(parentAfterClose).toBe(parentTab);

    // ストレージの状態も確認
    const relationsStillValid = await serviceWorker.evaluate(
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

        // 親子関係の検証
        if (childNode.parentId !== parentNodeId) {
          return {
            valid: false,
            reason: 'Child should be child of parent',
            actualParentId: childNode.parentId,
            expectedParentId: parentNodeId,
          };
        }

        // 深さの検証
        if (parentNode.depth !== 0 || childNode.depth !== 1) {
          return {
            valid: false,
            reason: 'Depth mismatch',
            parentDepth: parentNode.depth,
            childDepth: childNode.depth,
          };
        }

        return { valid: true };
      },
      { parentTabId: parentTab, childTabId: childTab }
    );

    expect(relationsStillValid).toEqual({ valid: true });
  });

  test('D&Dで親子関係を作成した後、新しいウィンドウを開いても既存の親子関係が維持されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 2つのルートレベルのタブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com/parent-window');
    const childTab = await createTab(extensionContext, 'https://example.org/child-window');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);

    // D&Dで親子関係を作成
    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

    // D&D後の親子関係が正しいことを確認
    const actualParent = await getParentTabId(sidePanelPage, childTab);
    expect(actualParent).toBe(parentTab);

    // UI上の深さを確認（D&D後）
    await waitForTabDepthInUI(sidePanelPage, parentTab, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, childTab, 1, { timeout: 3000 });

    // D&D後、数秒待機
    await sidePanelPage.waitForTimeout(2000);

    // ストレージの状態を確認（ウィンドウ作成前）
    const storageBeforeWindow = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
          treeStructure?: unknown[];
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { error: 'No tree state' };
        }

        const childNodeId = treeState.tabToNode[childTabId];

        return {
          childNodeId,
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
          treeStructureLength: treeState.treeStructure?.length ?? 0,
        };
      },
      { childTabId: childTab }
    );

    // 新しいウィンドウを作成
    // handleWindowCreated が syncWithChromeTabs() を呼び出し、
    // treeStructureが古いか空の場合は親子関係がリセットされる可能性がある
    const newWindowId = await serviceWorker.evaluate(async () => {
      const newWindow = await chrome.windows.create({ type: 'normal' });
      return newWindow.id as number;
    });

    // 新ウィンドウ作成後、処理完了を待機
    await sidePanelPage.waitForTimeout(2000);

    // ストレージの状態を確認（ウィンドウ作成後）
    const storageAfterWindow = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TreeNode {
          parentId: string | null;
          depth: number;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
          treeStructure?: unknown[];
        }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) {
          return { error: 'No tree state' };
        }

        const childNodeId = treeState.tabToNode[childTabId];

        return {
          childNodeId,
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
          treeStructureLength: treeState.treeStructure?.length ?? 0,
        };
      },
      { childTabId: childTab }
    );

    // UI上の状態を確認
    const parentDepthAfterWindow = await sidePanelPage
      .locator(`[data-testid="tree-node-${parentTab}"]`)
      .getAttribute('data-depth');
    const childDepthAfterWindow = await sidePanelPage
      .locator(`[data-testid="tree-node-${childTab}"]`)
      .getAttribute('data-depth');

    // 検証: 親子関係が維持されていること
    expect(parentDepthAfterWindow).toBe('0');
    expect(childDepthAfterWindow).toBe('1');

    // 親子関係がストレージでも維持されていることを確認
    expect(storageAfterWindow.childParentId).toBe(storageBeforeWindow.childParentId);
    expect(storageAfterWindow.childDepth).toBe(1);

    // 新しいウィンドウをクリーンアップ
    await serviceWorker.evaluate(async (windowId) => {
      await chrome.windows.remove(windowId);
    }, newWindowId);
  });

  test('D&Dで親子関係を作成した後、SYNC_TABSメッセージを送信しても既存の親子関係が維持されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(extensionContext, 'https://example.com/parent-sync');
    const childTab = await createTab(extensionContext, 'https://example.org/child-sync');

    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

    const actualParent = await getParentTabId(sidePanelPage, childTab);
    expect(actualParent).toBe(parentTab);

    await waitForTabDepthInUI(sidePanelPage, parentTab, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, childTab, 1, { timeout: 3000 });

    await sidePanelPage.waitForTimeout(2000);

    const storageBeforeSync = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TreeNode { parentId: string | null; depth: number; }
        interface LocalTreeState { tabToNode: Record<number, string>; nodes: Record<string, TreeNode>; }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) return { error: 'No tree state' };

        const childNodeId = treeState.tabToNode[childTabId];
        return {
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
        };
      },
      { childTabId: childTab }
    );

    await serviceWorker.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SYNC_TABS' }, () => resolve());
      });
    });

    await sidePanelPage.waitForTimeout(2000);

    const storageAfterSync = await serviceWorker.evaluate(
      async ({ childTabId }) => {
        interface TreeNode { parentId: string | null; depth: number; }
        interface LocalTreeState { tabToNode: Record<number, string>; nodes: Record<string, TreeNode>; }

        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as LocalTreeState | undefined;
        if (!treeState?.nodes || !treeState?.tabToNode) return { error: 'No tree state' };

        const childNodeId = treeState.tabToNode[childTabId];
        return {
          childParentId: childNodeId ? treeState.nodes[childNodeId]?.parentId : null,
          childDepth: childNodeId ? treeState.nodes[childNodeId]?.depth : null,
        };
      },
      { childTabId: childTab }
    );

    const parentDepthAfterSync = await sidePanelPage
      .locator(`[data-testid="tree-node-${parentTab}"]`)
      .getAttribute('data-depth');
    const childDepthAfterSync = await sidePanelPage
      .locator(`[data-testid="tree-node-${childTab}"]`)
      .getAttribute('data-depth');

    expect(parentDepthAfterSync).toBe('0');
    expect(childDepthAfterSync).toBe('1');
    expect(storageAfterSync.childParentId).toBe(storageBeforeSync.childParentId);
    expect(storageAfterSync.childDepth).toBe(1);
  });

  test('ストレージが破損した場合、背景の正しい状態から復元されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    const parentTab = await createTab(extensionContext, 'https://example.com/parent-recover');
    const childTab = await createTab(extensionContext, 'https://example.org/child-recover');

    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);

    await moveTabToParent(sidePanelPage, childTab, parentTab, serviceWorker);
    await waitForParentChildRelation(extensionContext, childTab, parentTab, { timeout: 5000 });

    const actualParent = await getParentTabId(sidePanelPage, childTab);
    expect(actualParent).toBe(parentTab);

    await waitForTabDepthInUI(sidePanelPage, parentTab, 0, { timeout: 3000 });
    await waitForTabDepthInUI(sidePanelPage, childTab, 1, { timeout: 3000 });

    await sidePanelPage.waitForTimeout(2000);

    // ストレージのtreeStructureのみを空にする（nodesのparentIdはそのまま）
    // これはREFRESH_TREE_STRUCTUREが失敗した場合をシミュレート
    await serviceWorker.evaluate(async () => {
      interface LocalTreeState {
        treeStructure?: unknown[];
        [key: string]: unknown;
      }

      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as LocalTreeState | undefined;
      if (treeState) {
        treeState.treeStructure = [];
        await chrome.storage.local.set({ tree_state: treeState });
      }
    });

    await serviceWorker.evaluate(async () => {
      return new Promise<void>((resolve) => {
        chrome.runtime.sendMessage({ type: 'SYNC_TABS' }, () => resolve());
      });
    });

    await sidePanelPage.waitForTimeout(2000);

    const childDepthAfterSync = await sidePanelPage
      .locator(`[data-testid="tree-node-${childTab}"]`)
      .getAttribute('data-depth');

    // treeStructureが空でもnodesのparentIdが正しければ復元される
    expect(childDepthAfterSync).toBe('1');
  });
});
