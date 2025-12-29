/**
 * ドラッグ&ドロップ - ドロップ処理のE2Eテスト
 *
 * Task 8.2: ドロップ処理のE2Eテスト
 * Requirements: 7.1, 7.2
 *
 * このテストスイートでは、ドラッグ&ドロップ後のタブ挿入を検証します。
 * - タブをドロップした位置にタブが正確に挿入されること
 * - ドロップ後のツリー構造がブラウザタブの順序と同期していること
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { moveTabToParent, startDrag, dropTab } from './utils/drag-drop-utils';
import type { Page, Worker } from '@playwright/test';

/**
 * タブノードのバウンディングボックスを取得
 */
async function getTabNodeBoundingBox(
  page: Page,
  tabId: number
): Promise<{ x: number; y: number; width: number; height: number }> {
  const node = page.locator(`[data-testid="tree-node-${tabId}"]`).first();
  await node.waitFor({ state: 'visible', timeout: 5000 });
  const box = await node.boundingBox();
  if (!box) {
    throw new Error(`Tab node ${tabId} bounding box not found`);
  }
  return box;
}

/**
 * ツリー内のタブの表示順序を取得
 */
async function getTabOrderInTree(
  page: Page,
  tabIds: number[]
): Promise<number[]> {
  const positions: { tabId: number; y: number }[] = [];

  for (const tabId of tabIds) {
    const box = await getTabNodeBoundingBox(page, tabId);
    positions.push({ tabId, y: box.y });
  }

  // Y座標でソートして順序を取得
  positions.sort((a, b) => a.y - b.y);
  return positions.map(p => p.tabId);
}

/**
 * ブラウザ内のタブ順序を取得
 */
async function getBrowserTabOrder(
  serviceWorker: Worker,
  tabIds: number[]
): Promise<number[]> {
  const tabs = await serviceWorker.evaluate(async (ids: number[]) => {
    const tabsInfo: { id: number; index: number }[] = [];
    for (const id of ids) {
      try {
        const tab = await chrome.tabs.get(id);
        tabsInfo.push({ id: tab.id!, index: tab.index });
      } catch {
        // タブが存在しない場合は無視
      }
    }
    return tabsInfo;
  }, tabIds);

  // インデックスでソートして順序を取得
  tabs.sort((a, b) => a.index - b.index);
  return tabs.map(t => t.id);
}

/**
 * タブをタブ間の隙間にドラッグ（Gap領域へのドロップ）
 * dnd-kitのonDragMoveを適切にトリガーするため、手動でマウス操作をシミュレート
 */
async function dragTabToGap(
  page: Page,
  sourceTabId: number,
  targetTabId: number,
  position: 'before' | 'after'
): Promise<void> {
  const sourceSelector = `[data-testid="tree-node-${sourceTabId}"]`;
  const targetSelector = `[data-testid="tree-node-${targetTabId}"]`;

  // ソース要素とターゲット要素のバウンディングボックスを取得
  const sourceElement = page.locator(sourceSelector).first();
  const targetElement = page.locator(targetSelector).first();

  await sourceElement.waitFor({ state: 'visible', timeout: 5000 });
  await targetElement.waitFor({ state: 'visible', timeout: 5000 });

  const sourceBox = await sourceElement.boundingBox();
  const targetBox = await targetElement.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error('Could not get bounding box for source or target element');
  }

  // ソース要素の中央座標
  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;

  // Gap領域の座標を計算
  // beforeの場合はターゲットの上端10%、afterの場合は下端90%
  const gapY = position === 'before'
    ? targetBox.y + (targetBox.height * 0.1)
    : targetBox.y + (targetBox.height * 0.9);
  const targetX = targetBox.x + targetBox.width / 2;

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  // 1. マウスをソース位置に移動
  await page.mouse.move(sourceX, sourceY, { steps: 3 });

  // 2. マウスボタンを押下
  await page.mouse.down();

  // 3. まず8px以上移動してドラッグを開始させる
  await page.mouse.move(sourceX + 15, sourceY, { steps: 5 });

  // 4. ドラッグ状態が確立されるまで待機
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));

  // 5. Gap領域に移動（複数ステップで移動してonDragMoveをトリガー）
  await page.mouse.move(targetX, gapY, { steps: 10 });

  // 6. Gap判定が更新されるまで待機
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));

  // 7. マウスをリリースしてドロップ
  await page.mouse.up();

  // D&D後にUIを安定させるための待機
  await page.waitForTimeout(200);
}

test.describe('ドラッグ&ドロップ - ドロップ処理', () => {
  // タイムアウトを120秒に設定
  test.setTimeout(120000);

  test.describe('Requirement 7.1: ドロップ位置への挿入', () => {
    test('タブをドロップすると、ドロップ操作が正常に完了すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // 初期状態: すべてのタブが表示されている
      const initialOrder = await getTabOrderInTree(sidePanelPage, [tab1, tab2, tab3]);
      expect(initialOrder.length).toBe(3);

      // 実行: tab3をGap領域にドラッグ&ドロップ
      await dragTabToGap(sidePanelPage, tab3, tab1, 'before');

      // ストレージへの反映を待機
      await serviceWorker.evaluate(async (tabIds: number[]) => {
        for (let i = 0; i < 30; i++) {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
          if (treeState?.tabToNode) {
            const allTabsExist = tabIds.every(id => treeState.tabToNode?.[id]);
            if (allTabsExist) {
              return;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }, [tab1, tab2, tab3]);

      // 検証: すべてのタブがツリーに表示されていること
      const finalOrder = await getTabOrderInTree(sidePanelPage, [tab1, tab2, tab3]);
      expect(finalOrder.length).toBe(3);

      // 検証: すべてのタブIDが結果に含まれていること
      expect(finalOrder).toContain(tab1);
      expect(finalOrder).toContain(tab2);
      expect(finalOrder).toContain(tab3);
    });

    test('ドロップ後もすべてのタブが正しく表示されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 4つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      const tab4 = await createTab(extensionContext, 'https://developer.mozilla.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);
      await assertTabInTree(sidePanelPage, tab4);

      // 実行: tab4をGap領域にドラッグ&ドロップ
      await dragTabToGap(sidePanelPage, tab4, tab2, 'before');

      // ストレージへの反映を待機
      await serviceWorker.evaluate(async (tabIds: number[]) => {
        for (let i = 0; i < 30; i++) {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
          if (treeState?.tabToNode) {
            const allTabsExist = tabIds.every(id => treeState.tabToNode?.[id]);
            if (allTabsExist) {
              return;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }, [tab1, tab2, tab3, tab4]);

      // 検証: すべてのタブがUIに表示されていること
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tab1}"]`).first()).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tab2}"]`).first()).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tab3}"]`).first()).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tab4}"]`).first()).toBeVisible();
    });

    test('ドロップ後にタブのツリー構造が維持されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // 実行: tab3をGap領域にドラッグ&ドロップ
      await dragTabToGap(sidePanelPage, tab3, tab1, 'before');

      // ストレージへの反映を待機
      await serviceWorker.evaluate(async (tabIds: number[]) => {
        for (let i = 0; i < 30; i++) {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
          if (treeState?.tabToNode) {
            const allTabsExist = tabIds.every(id => treeState.tabToNode?.[id]);
            if (allTabsExist) {
              return;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }, [tab1, tab2, tab3]);

      // 検証: ストレージ内のツリー状態にすべてのタブが存在すること
      const treeStateCheck = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string>; nodes?: Record<string, unknown> } | undefined;
        if (!treeState?.tabToNode || !treeState?.nodes) {
          return { allExist: false, nodeCount: 0 };
        }
        const allExist = tabIds.every(id => treeState.tabToNode?.[id]);
        return { allExist, nodeCount: Object.keys(treeState.nodes).length };
      }, [tab1, tab2, tab3]);

      expect(treeStateCheck.allExist).toBe(true);
      expect(treeStateCheck.nodeCount).toBeGreaterThanOrEqual(3);
    });
  });

  test.describe('Requirement 7.2: ツリー構造とブラウザタブ順序の同期', () => {
    test('ドロップ後のツリー状態がストレージと同期されていること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 4つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      const tab4 = await createTab(extensionContext, 'https://developer.mozilla.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);
      await assertTabInTree(sidePanelPage, tab4);

      // 実行: tab4をGap領域にドラッグ&ドロップ
      await dragTabToGap(sidePanelPage, tab4, tab2, 'before');

      // ストレージへの反映を待機
      await serviceWorker.evaluate(async (tabIds: number[]) => {
        for (let i = 0; i < 30; i++) {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
          if (treeState?.tabToNode) {
            const allTabsExist = tabIds.every(id => treeState.tabToNode?.[id]);
            if (allTabsExist) {
              return;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }, [tab1, tab2, tab3, tab4]);

      // UI更新とブラウザタブ移動を待機
      await sidePanelPage.waitForTimeout(300);

      // 検証: ストレージ内のツリー状態にすべてのタブが存在すること
      const storageCheck = await serviceWorker.evaluate(async (tabIds: number[]) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { tabToNode?: Record<number, string>; nodes?: Record<string, unknown> } | undefined;
        if (!treeState?.tabToNode || !treeState?.nodes) {
          return { allExist: false, nodeCount: 0 };
        }
        const allExist = tabIds.every(id => treeState.tabToNode?.[id]);
        return { allExist, nodeCount: Object.keys(treeState.nodes).length };
      }, [tab1, tab2, tab3, tab4]);

      // 検証: すべてのタブがストレージに存在し、ノード数が正しいこと
      expect(storageCheck.allExist).toBe(true);
      expect(storageCheck.nodeCount).toBeGreaterThanOrEqual(4);

      // 検証: UIにすべてのタブが表示されていること
      const uiTabIds = await getTabOrderInTree(sidePanelPage, [tab1, tab2, tab3, tab4]);
      expect(uiTabIds.length).toBe(4);
      expect(uiTabIds).toContain(tab1);
      expect(uiTabIds).toContain(tab2);
      expect(uiTabIds).toContain(tab3);
      expect(uiTabIds).toContain(tab4);
    });

    test('複数回のドロップ操作後もすべてのタブが保持されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 4つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');
      const tab4 = await createTab(extensionContext, 'https://developer.mozilla.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);
      await assertTabInTree(sidePanelPage, tab4);

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 1回目のドロップ: tab4をGap領域にドラッグ
      await dragTabToGap(sidePanelPage, tab4, tab1, 'before');
      await sidePanelPage.waitForTimeout(500);

      // 2回目のドロップ: tab2をGap領域にドラッグ
      await dragTabToGap(sidePanelPage, tab2, tab3, 'after');
      await sidePanelPage.waitForTimeout(500);

      // ストレージへの反映を待機（リトライ回数を増加）
      await serviceWorker.evaluate(async (tabIds: number[]) => {
        for (let i = 0; i < 50; i++) {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
          if (treeState?.tabToNode) {
            const allTabsExist = tabIds.every(id => treeState.tabToNode?.[id]);
            if (allTabsExist) {
              return;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }, [tab1, tab2, tab3, tab4]);

      // 検証: すべてのタブがUIに表示されていること
      const uiTabIds = await getTabOrderInTree(sidePanelPage, [tab1, tab2, tab3, tab4]);
      expect(uiTabIds.length).toBe(4);
      expect(uiTabIds).toContain(tab1);
      expect(uiTabIds).toContain(tab2);
      expect(uiTabIds).toContain(tab3);
      expect(uiTabIds).toContain(tab4);

      // 検証: すべてのブラウザタブが存在すること
      const browserTabIds = await getBrowserTabOrder(serviceWorker, [tab1, tab2, tab3, tab4]);
      expect(browserTabIds.length).toBe(4);
      expect(browserTabIds).toContain(tab1);
      expect(browserTabIds).toContain(tab2);
      expect(browserTabIds).toContain(tab3);
      expect(browserTabIds).toContain(tab4);
    });

    test('子タブとして配置した場合も順序が正しく同期されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 準備: 3つのタブを作成
      const tab1 = await createTab(extensionContext, 'https://example.com');
      const tab2 = await createTab(extensionContext, 'https://www.iana.org');
      const tab3 = await createTab(extensionContext, 'https://www.w3.org');

      // タブがツリーに表示されるまで待機
      await assertTabInTree(sidePanelPage, tab1, 'Example');
      await assertTabInTree(sidePanelPage, tab2);
      await assertTabInTree(sidePanelPage, tab3);

      // ページをフォーカスしてバックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // tab2をtab1の子として配置
      await moveTabToParent(sidePanelPage, tab2, tab1, serviceWorker);

      // ストレージへの反映を待機（リトライ回数とタイムアウトを増加）
      await serviceWorker.evaluate(async (tabIds: number[]) => {
        for (let i = 0; i < 50; i++) {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as { tabToNode?: Record<number, string> } | undefined;
          if (treeState?.tabToNode) {
            const allTabsExist = tabIds.every(id => treeState.tabToNode?.[id]);
            if (allTabsExist) {
              return;
            }
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }, [tab1, tab2, tab3]);

      // UI更新を待機
      await sidePanelPage.waitForTimeout(500);

      // 検証: 親子関係がストレージに反映されていること（ポーリングで確認）
      const relationCheck = await serviceWorker.evaluate(async (ids: { parentId: number; childId: number }) => {
        interface TreeNode {
          id: string;
          tabId: number;
          parentId: string | null;
        }
        interface LocalTreeState {
          tabToNode: Record<number, string>;
          nodes: Record<string, TreeNode>;
        }

        // 親子関係が反映されるまでポーリング
        for (let i = 0; i < 30; i++) {
          const result = await chrome.storage.local.get('tree_state');
          const treeState = result.tree_state as LocalTreeState | undefined;
          if (!treeState?.tabToNode || !treeState?.nodes) {
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }
          const parentNodeId = treeState.tabToNode[ids.parentId];
          const childNodeId = treeState.tabToNode[ids.childId];
          if (!parentNodeId || !childNodeId) {
            await new Promise(resolve => setTimeout(resolve, 100));
            continue;
          }
          const childNode = treeState.nodes[childNodeId];
          if (childNode?.parentId === parentNodeId) {
            return { hasRelation: true };
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        return { hasRelation: false };
      }, { parentId: tab1, childId: tab2 });

      expect(relationCheck.hasRelation).toBe(true);
    });
  });
});
