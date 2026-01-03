/**
 * DragDropUtils
 *
 * 自前D&D実装用のドラッグ&ドロップ操作シミュレーションユーティリティ
 * - dnd-kit固有のセレクタを使用しない
 * - マウスイベントベースのドラッグ操作シミュレーション
 */
import type { Page, Worker, BrowserContext } from '@playwright/test';
import { openSidePanelForWindow } from './window-utils';

/**
 * 要素のバウンディングボックスを取得
 * Playwrightの自動待機を活用
 *
 * @param page - Page
 * @param selector - 要素のセレクタ
 * @param timeout - タイムアウト（ミリ秒）
 */
async function getBoundingBox(
  page: Page,
  selector: string,
  timeout: number = 500
): Promise<{ x: number; y: number; width: number; height: number }> {
  const element = page.locator(selector).first();
  await element.waitFor({ state: 'visible', timeout });
  const box = await element.boundingBox();
  if (!box || box.width === 0 || box.height === 0) {
    throw new Error(`Element ${selector} not found or has zero size`);
  }
  return box;
}

/**
 * ドラッグ状態が確立されるまでポーリングで待機
 * 自前D&D実装では `is-dragging` クラスがドラッグコンテナに付与される
 *
 * @param page - Page
 * @param maxWait - 最大待機時間（ミリ秒）
 */
async function waitForDragState(page: Page, maxWait: number = 2000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const dragContainer = page.locator('[data-drag-container]');
    const hasDragClass = await dragContainer.evaluate((el) =>
      el.classList.contains('is-dragging')
    ).catch(() => false);
    if (hasDragClass) {
      return true;
    }
    // 短い間隔でポーリング
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)));
  }
  return false;
}

/**
 * タブノードをドラッグ開始
 * 自前D&D実装は8px移動でドラッグを開始するため、
 * mousedown後に8px以上移動してドラッグを開始する
 *
 * @param page - Side PanelのPage
 * @param sourceTabId - ドラッグするタブのID
 */
export async function startDrag(page: Page, sourceTabId: number): Promise<void> {
  const selector = `[data-testid="tree-node-${sourceTabId}"]`;

  // 要素のバウンディングボックスを取得
  const box = await getBoundingBox(page, selector);

  // マウスを要素の中央に移動
  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  // マウスを開始位置に移動
  await page.mouse.move(startX, startY, { steps: 3 });

  // マウスボタンを押下
  await page.mouse.down();

  // 自前D&D実装は8px移動でドラッグを開始するため、10px移動
  // steps: 5 でドラッグを確実に検出できるようにする
  await page.mouse.move(startX + 10, startY, { steps: 5 });

  // ドラッグ状態が確立されるまで待機
  await waitForDragState(page);
}

/**
 * 別のタブノード上にホバー
 *
 * @param page - Side PanelのPage
 * @param targetTabId - ホバー先のタブのID
 */
export async function hoverOverTab(page: Page, targetTabId: number): Promise<void> {
  const selector = `[data-testid="tree-node-${targetTabId}"]`;

  // 要素のバウンディングボックスを取得
  const box = await getBoundingBox(page, selector);

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  // ターゲットノードの中央にマウスを移動（steps: 10 でホバーを確実に検出）
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });

  // Reactの状態更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/**
 * 指定位置へマウスを移動
 * ドラッグ中に使用
 *
 * @param page - Side PanelのPage
 * @param x - X座標
 * @param y - Y座標
 */
export async function moveTo(page: Page, x: number, y: number): Promise<void> {
  await page.mouse.move(x, y, { steps: 5 });
  // Reactの状態更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/**
 * ドロップを実行
 *
 * @param page - Side PanelのPage
 */
export async function dropTab(page: Page): Promise<void> {
  // マウスアップイベントでドロップを実行
  await page.mouse.up();

  // ドロップ後の状態更新を待機 - DOMの更新が完了するまで待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/**
 * 同階層の並び替えを実行
 *
 * @param page - Side PanelのPage
 * @param sourceTabId - 移動元のタブID
 * @param targetTabId - 移動先のタブID
 * @param position - ドロップ位置（'before' または 'after'）
 */
export async function reorderTabs(
  page: Page,
  sourceTabId: number,
  targetTabId: number,
  position: 'before' | 'after'
): Promise<void> {
  const sourceSelector = `[data-testid="tree-node-${sourceTabId}"]`;
  const targetSelector = `[data-testid="tree-node-${targetTabId}"]`;

  // ソース要素とターゲット要素のバウンディングボックスを取得
  const sourceBox = await getBoundingBox(page, sourceSelector, 5000);
  const targetBox = await getBoundingBox(page, targetSelector, 5000);

  // ソース要素の中央座標
  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;

  // ターゲット要素の座標（位置に応じて上部または下部）
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = position === 'before'
    ? targetBox.y + targetBox.height * 0.15  // 上部15%の位置（Gap判定領域）
    : targetBox.y + targetBox.height * 0.85; // 下部85%の位置（Gap判定領域）

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  // 1. マウスをソース位置に移動
  await page.mouse.move(sourceX, sourceY, { steps: 3 });

  // 2. マウスボタンを押下
  await page.mouse.down();

  // 3. 8px以上移動してドラッグを開始
  await page.mouse.move(sourceX + 10, sourceY, { steps: 5 });

  // 4. ドラッグ状態が確立されるまで待機
  await waitForDragState(page);

  // 5. ターゲット位置に移動
  await page.mouse.move(targetX, targetY, { steps: 10 });

  // 6. Reactの状態更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // 7. マウスをリリースしてドロップ
  await page.mouse.up();

  // D&D後のDOM更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/**
 * タブを別のタブの子にするD&D操作を実行する（操作のみ、検証は行わない）
 *
 * @param page - Side PanelのPage
 * @param childTabId - 子にするタブのID
 * @param parentTabId - 親タブのID
 * @param _serviceWorker - 後方互換性のため残しているが未使用
 */
export async function moveTabToParent(
  page: Page,
  childTabId: number,
  parentTabId: number,
  _serviceWorker?: Worker
): Promise<void> {
  const sourceSelector = `[data-testid="tree-node-${childTabId}"]`;
  const targetSelector = `[data-testid="tree-node-${parentTabId}"]`;

  // ソース要素とターゲット要素のバウンディングボックスを取得
  const sourceBox = await getBoundingBox(page, sourceSelector, 5000);
  const targetBox = await getBoundingBox(page, targetSelector, 5000);

  // ソース要素の中央座標
  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;

  // ターゲット要素の中央座標（タブの中央にドロップすると子タブになる）
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = targetBox.y + targetBox.height / 2;

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  // 1. マウスをソース位置に移動
  await page.mouse.move(sourceX, sourceY, { steps: 3 });

  // 2. マウスボタンを押下
  await page.mouse.down();

  // 3. 8px以上移動してドラッグを開始
  await page.mouse.move(sourceX + 15, sourceY, { steps: 5 });

  // 4. ドラッグ状態が確立されるまで待機
  await waitForDragState(page);

  // 5. ターゲット位置に移動（steps: 10で確実にホバーを検出）
  await page.mouse.move(targetX, targetY, { steps: 10 });

  // 6. ホバー状態を安定させるための待機（並列実行時のタイミング問題対策）
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));

  // 7. Reactの状態更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // 8. マウスをリリースしてドロップ
  await page.mouse.up();

  // 9. D&D後のDOM更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // 10. ドラッグ状態が完全に解除されるまで待機
  await waitForDragEnd(page, 2000);
}

/**
 * 期待するタブ構造の定義
 */
export interface ExpectedTabStructure {
  tabId: number;
  depth: number;
}

/**
 * assertTabStructure / assertPinnedTabStructure のオプション
 */
export interface AssertTabStructureOptions {
  /** タイムアウト（ミリ秒、デフォルト: 5000） */
  timeout?: number;
}

/**
 * 現在アクティブなビューのインデックスを取得するヘルパー関数
 */
async function getActiveViewIndex(page: Page): Promise<number> {
  const viewSwitcher = page.locator('[data-testid="view-switcher-container"]');
  const viewButtons = viewSwitcher.locator('button[data-color]');
  const count = await viewButtons.count();

  // X座標順にソートするための情報を収集
  const views: { x: number; isActive: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const button = viewButtons.nth(i);
    const isActive = (await button.getAttribute('data-active')) === 'true';
    const box = await button.boundingBox();
    views.push({ x: box?.x || 0, isActive });
  }

  // X座標でソート
  views.sort((a, b) => a.x - b.x);

  // アクティブなビューのインデックスを返す
  return views.findIndex(v => v.isActive);
}

/**
 * UI上でタブ構造が期待通りであることを検証する
 *
 * タブ操作（moveTabToParent, createTab, closeTab等）の後に必ず呼び出して、
 * UI上で期待する順序とdepthになっていることを確認する。
 * 期待通りになるまで待機し、タイムアウトした場合は期待値と実際の値を含むエラーでテストを失敗させる。
 *
 * 空の配列を渡した場合は、タブが0個であることを検証する。
 *
 * 使用例:
 * ```typescript
 * // テスト開始時にサイドパネルを開く
 * const sidePanelPage = await openSidePanelForWindow(context, windowId);
 *
 * await moveTabToParent(sidePanelPage, child, parent);
 * await assertTabStructure(sidePanelPage, windowId, [
 *   { tabId: parent, depth: 0 },
 *   { tabId: child, depth: 1 },
 * ], 0);
 *
 * // タブが0個であることを検証
 * await closeTab(context, lastTabId);
 * await assertTabStructure(sidePanelPage, windowId, [], 0);
 * ```
 *
 * @param page - 対象ウィンドウのSide PanelのPage（openSidePanelForWindowで取得）
 * @param windowId - 検証するウィンドウのID（エラーメッセージの明示性のため）
 * @param expectedStructure - 期待するタブ構造（順序も検証される）。空配列の場合は0個であることを検証。
 * @param expectedActiveViewIndex - 期待するアクティブビューのインデックス（0始まり）
 * @param options - オプション（timeout）
 */
export async function assertTabStructure(
  page: Page,
  windowId: number,
  expectedStructure: ExpectedTabStructure[],
  expectedActiveViewIndex: number,
  options: AssertTabStructureOptions = {}
): Promise<void> {
  const { timeout = 5000 } = options;
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      // アクティブビューの検証（必須）
      const actualActiveViewIndex = await getActiveViewIndex(page);
      if (actualActiveViewIndex !== expectedActiveViewIndex) {
        throw new Error(
          `Active view index mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${expectedActiveViewIndex}\n` +
          `  Actual:   ${actualActiveViewIndex}`
        );
      }

      // UI上に存在する全タブを取得
      const allTreeNodes = page.locator('[data-testid^="tree-node-"]');
      const actualTabCount = await allTreeNodes.count();

      // 期待されるタブ数と実際のタブ数を比較
      if (actualTabCount !== expectedStructure.length) {
        throw new Error(
          `Tab count mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${expectedStructure.length} tabs\n` +
          `  Actual:   ${actualTabCount} tabs`
        );
      }

      // タブが0個の場合は、ここでチェック完了
      if (expectedStructure.length === 0) {
        return;
      }

      // UI上のタブをY座標順に取得
      const actualStructure: { tabId: number; depth: number; y: number }[] = [];

      for (const expected of expectedStructure) {
        const element = page.locator(`[data-testid="tree-node-${expected.tabId}"]`).first();
        const isVisible = await element.isVisible().catch(() => false);

        if (!isVisible) {
          throw new Error(`Tab ${expected.tabId} is not visible (windowId: ${windowId})`);
        }

        const box = await element.boundingBox();
        if (!box) {
          throw new Error(`Tab ${expected.tabId} has no bounding box (windowId: ${windowId})`);
        }

        const depth = await element.getAttribute('data-depth');
        actualStructure.push({
          tabId: expected.tabId,
          depth: depth ? parseInt(depth, 10) : 0,
          y: box.y
        });
      }

      // Y座標でソートして順序を確認
      actualStructure.sort((a, b) => a.y - b.y);

      // 順序の検証
      const actualOrder = actualStructure.map(s => s.tabId);
      const expectedOrder = expectedStructure.map(s => s.tabId);

      if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
        throw new Error(
          `Tab order mismatch (windowId: ${windowId}):\n` +
          `  Expected: [${expectedOrder.join(', ')}]\n` +
          `  Actual:   [${actualOrder.join(', ')}]`
        );
      }

      // 深さの検証
      for (let i = 0; i < expectedStructure.length; i++) {
        const expected = expectedStructure[i];
        const actual = actualStructure.find(s => s.tabId === expected.tabId);

        if (actual && actual.depth !== expected.depth) {
          throw new Error(
            `Depth mismatch for tab ${expected.tabId} (windowId: ${windowId}):\n` +
            `  Expected: ${expected.depth}\n` +
            `  Actual:   ${actual.depth}`
          );
        }
      }

      // すべて一致
      return;
    } catch (e) {
      lastError = e as Error;
    }

    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }

  throw lastError || new Error(`Timeout waiting for tab structure (windowId: ${windowId})`);
}

/**
 * タブをツリービュー外にドラッグ（新規ウィンドウ作成用）
 *
 * @param page - Side PanelのPage
 * @param sourceTabId - ドラッグするタブのID
 * @param direction - ドラッグアウト方向（'left', 'right', 'top', 'bottom'）
 */
export async function dragOutside(
  page: Page,
  sourceTabId: number,
  direction: 'left' | 'right' | 'top' | 'bottom' = 'right'
): Promise<void> {
  const sourceSelector = `[data-testid="tree-node-${sourceTabId}"]`;

  // ソース要素のバウンディングボックスを取得
  const sourceBox = await getBoundingBox(page, sourceSelector, 5000);

  // ソース要素の中央座標
  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;

  // ビューポートサイズを取得
  const viewport = page.viewportSize() || { width: 800, height: 600 };

  // ドラッグアウト先の座標を計算
  let targetX: number;
  let targetY: number;
  switch (direction) {
    case 'left':
      targetX = -50;
      targetY = sourceY;
      break;
    case 'right':
      targetX = viewport.width + 50;
      targetY = sourceY;
      break;
    case 'top':
      targetX = sourceX;
      targetY = -50;
      break;
    case 'bottom':
      targetX = sourceX;
      targetY = viewport.height + 50;
      break;
  }

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  // 1. マウスをソース位置に移動
  await page.mouse.move(sourceX, sourceY, { steps: 3 });

  // 2. マウスボタンを押下
  await page.mouse.down();

  // 3. 8px以上移動してドラッグを開始
  await page.mouse.move(sourceX + 10, sourceY, { steps: 5 });

  // 4. ドラッグ状態が確立されるまで待機
  await waitForDragState(page);

  // 5. ツリービュー外の位置に移動
  await page.mouse.move(targetX, targetY, { steps: 10 });

  // 6. Reactの状態更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // 7. マウスをリリースしてドロップ（外部ドロップ発火）
  await page.mouse.up();

  // D&D後のDOM更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/**
 * ドロップインジケータが表示されることを検証
 *
 * @param page - Side PanelのPage
 * @param _position - ドロップ位置（'before', 'after', 'child'）
 */
export async function assertDropIndicator(
  page: Page,
  _position: 'before' | 'after' | 'child'
): Promise<void> {
  // ドロップインジケータの要素を検索
  const indicator = page.locator('[data-testid="drop-indicator"]');

  // インジケータが表示されることを確認
  await indicator.waitFor({ state: 'visible', timeout: 2000 }).catch(() => {
    // インジケータが見つからない場合もエラーにしない（実装に依存）
  });
}

/**
 * ホバー自動展開を検証
 *
 * @param page - Side PanelのPage
 * @param parentTabId - 親タブのID
 * @param _hoverDuration - ホバー時間（ミリ秒）
 */
export async function assertAutoExpand(
  page: Page,
  parentTabId: number,
  _hoverDuration: number
): Promise<void> {
  // 親タブノードを取得
  const parentNode = page.locator(`[data-testid="tree-node-${parentTabId}"]`).first();

  // ホバー前の展開状態を確認
  const _isExpandedBefore = await parentNode.getAttribute('data-expanded');

  // 指定時間ホバー - 展開状態の変化をポーリングで待機
  await parentNode.hover();

  // 展開状態が変わるまでポーリングで待機（最大5秒）
  const startTime = Date.now();
  const timeout = 5000;
  let isExpandedAfter = _isExpandedBefore;

  while (Date.now() - startTime < timeout) {
    isExpandedAfter = await parentNode.getAttribute('data-expanded');
    if (isExpandedAfter === 'true') {
      break;
    }
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }
}

/**
 * タブの順序を取得
 *
 * @param page - Side PanelのPage
 * @returns タブIDの配列（表示順）
 */
export async function getTabOrder(page: Page): Promise<number[]> {
  const treeNodes = page.locator('[data-testid^="tree-node-"]');
  const count = await treeNodes.count();
  const tabIds: number[] = [];

  for (let i = 0; i < count; i++) {
    const testId = await treeNodes.nth(i).getAttribute('data-testid');
    if (testId) {
      const match = testId.match(/tree-node-(\d+)/);
      if (match) {
        tabIds.push(parseInt(match[1], 10));
      }
    }
  }

  return tabIds;
}

/**
 * タブの親子関係を取得
 *
 * @param page - Side PanelのPage
 * @param tabId - 親子関係を確認するタブのID
 * @returns 親タブID（ルートの場合はnull）
 */
export async function getParentTabId(page: Page, tabId: number): Promise<number | null> {
  const result = await page.evaluate(async (targetTabId) => {
    interface TreeNode {
      id: string;
      tabId: number;
      parentId: string | null;
    }
    interface LocalTreeState {
      nodes: Record<string, TreeNode>;
    }
    const storageResult = await chrome.storage.local.get('tree_state');
    const treeState = storageResult.tree_state as LocalTreeState | undefined;
    if (!treeState?.nodes) return null;

    const targetNode = Object.values(treeState.nodes).find(
      (n: TreeNode) => n.tabId === targetTabId
    );
    if (!targetNode || !targetNode.parentId) return null;

    const parentNode = treeState.nodes[targetNode.parentId];
    return parentNode?.tabId ?? null;
  }, tabId);

  return result;
}

/**
 * タブの深さ（インデントレベル）を取得
 *
 * @param page - Side PanelのPage
 * @param tabId - 深さを確認するタブのID
 * @returns 深さ（0が最上位）
 */
export async function getTabDepth(page: Page, tabId: number): Promise<number> {
  const selector = `[data-testid="tree-node-${tabId}"]`;
  const element = page.locator(selector).first();
  const depth = await element.getAttribute('data-depth');
  return depth ? parseInt(depth, 10) : 0;
}

/**
 * ドラッグ中かどうかを確認
 *
 * @param page - Side PanelのPage
 * @returns ドラッグ中の場合true
 */
export async function isDragging(page: Page): Promise<boolean> {
  const dragContainer = page.locator('[data-drag-container]');
  return await dragContainer.evaluate((el) =>
    el.classList.contains('is-dragging')
  ).catch(() => false);
}

/**
 * ドラッグ状態が解除されるまで待機
 *
 * @param page - Side PanelのPage
 * @param maxWait - 最大待機時間（ミリ秒）
 */
export async function waitForDragEnd(page: Page, maxWait: number = 2000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const dragging = await isDragging(page);
    if (!dragging) {
      return;
    }
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)));
  }
}

/**
 * 期待するピン留めタブ構造の定義
 * 順序だけを検証する（depthは常に0）
 */
export interface ExpectedPinnedTabStructure {
  tabId: number;
}

/**
 * UI上でピン留めタブ構造が期待通りであることを検証する
 *
 * ピン留め操作後に必ず呼び出して、UI上で期待する順序になっていることを確認する。
 * ピン留めタブが0個の場合は空配列を渡す。
 *
 * 使用例:
 * ```typescript
 * // テスト開始時にサイドパネルを開く
 * const sidePanelPage = await openSidePanelForWindow(context, windowId);
 *
 * await pinTab(context, tabId);
 * await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tab1 }, { tabId: tab2 }], 0);
 *
 * // ピン留めタブが0個であることを検証
 * await unpinTab(context, lastPinnedTabId);
 * await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
 * ```
 *
 * @param page - 対象ウィンドウのSide PanelのPage（openSidePanelForWindowで取得）
 * @param windowId - 検証するウィンドウのID（エラーメッセージの明示性のため）
 * @param expectedStructure - 期待するピン留めタブ構造（順序も検証される）。空配列の場合は0個であることを検証。
 * @param expectedActiveViewIndex - 期待するアクティブビューのインデックス（0始まり）
 * @param options - オプション（timeout）
 */
export async function assertPinnedTabStructure(
  page: Page,
  windowId: number,
  expectedStructure: ExpectedPinnedTabStructure[],
  expectedActiveViewIndex: number,
  options: AssertTabStructureOptions = {}
): Promise<void> {
  const { timeout = 5000 } = options;
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      // アクティブビューの検証（必須）
      const actualActiveViewIndex = await getActiveViewIndex(page);
      if (actualActiveViewIndex !== expectedActiveViewIndex) {
        throw new Error(
          `Active view index mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${expectedActiveViewIndex}\n` +
          `  Actual:   ${actualActiveViewIndex}`
        );
      }

      // ピン留めタブセクションが存在するか確認
      const pinnedSection = page.locator('[data-testid="pinned-tabs-section"]');
      const sectionExists = await pinnedSection.isVisible().catch(() => false);

      // ピン留めタブが0個の場合、セクションが非表示であるべき
      if (expectedStructure.length === 0) {
        if (!sectionExists) {
          return;
        }
        // セクションが存在する場合、その中にピン留めタブがないか確認
        const pinnedTabs = page.locator('[data-testid^="pinned-tab-"]');
        const actualCount = await pinnedTabs.count();
        if (actualCount === 0) {
          return;
        }
        throw new Error(
          `Pinned tab count mismatch (windowId: ${windowId}):\n` +
          `  Expected: 0 tabs (section should be hidden)\n` +
          `  Actual:   ${actualCount} tabs`
        );
      }

      // ピン留めタブが存在する場合、セクションが表示されているべき
      if (!sectionExists) {
        throw new Error(
          `Pinned tabs section not visible but expected ${expectedStructure.length} pinned tabs (windowId: ${windowId})`
        );
      }

      // UI上のピン留めタブを取得
      const pinnedTabs = page.locator('[data-testid^="pinned-tab-"]');
      const actualCount = await pinnedTabs.count();

      // ピン留めタブ数を比較
      if (actualCount !== expectedStructure.length) {
        throw new Error(
          `Pinned tab count mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${expectedStructure.length} tabs\n` +
          `  Actual:   ${actualCount} tabs`
        );
      }

      // UI上のピン留めタブをX座標順に取得
      const actualStructure: { tabId: number; x: number }[] = [];

      for (const expected of expectedStructure) {
        const element = page.locator(`[data-testid="pinned-tab-${expected.tabId}"]`).first();
        const isVisible = await element.isVisible().catch(() => false);

        if (!isVisible) {
          throw new Error(`Pinned tab ${expected.tabId} is not visible (windowId: ${windowId})`);
        }

        const box = await element.boundingBox();
        if (!box) {
          throw new Error(`Pinned tab ${expected.tabId} has no bounding box (windowId: ${windowId})`);
        }

        actualStructure.push({
          tabId: expected.tabId,
          x: box.x
        });
      }

      // X座標でソートして順序を確認（ピン留めタブは水平並び）
      actualStructure.sort((a, b) => a.x - b.x);

      // 順序の検証
      const actualOrder = actualStructure.map(s => s.tabId);
      const expectedOrder = expectedStructure.map(s => s.tabId);

      if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
        throw new Error(
          `Pinned tab order mismatch (windowId: ${windowId}):\n` +
          `  Expected: [${expectedOrder.join(', ')}]\n` +
          `  Actual:   [${actualOrder.join(', ')}]`
        );
      }

      // すべて一致
      return;
    } catch (e) {
      lastError = e as Error;
    }

    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }

  throw lastError || new Error(`Timeout waiting for pinned tab structure (windowId: ${windowId})`);
}

/**
 * 期待するビュー構造の定義
 */
export interface ExpectedViewStructure {
  /** ビューの名前またはカラー（識別用） */
  viewIdentifier: string;
}

/**
 * UI上でビュー構造が期待通りであることを検証する
 *
 * ビュー操作後に呼び出して、UI上でビューの順序と現在のハイライト状態を確認する。
 *
 * 使用例:
 * ```typescript
 * // テスト開始時にサイドパネルを開く
 * const sidePanelPage = await openSidePanelForWindow(context, windowId);
 *
 * await createView(sidePanelPage, 'Work');
 * await assertViewStructure(sidePanelPage, windowId, [
 *   { viewIdentifier: '#3B82F6' },  // デフォルトのビュー
 *   { viewIdentifier: '#10B981' },  // 新規作成したビュー
 * ], 0);  // 0番目のビューがハイライト中
 * ```
 *
 * @param page - 対象ウィンドウのSide PanelのPage（openSidePanelForWindowで取得）
 * @param windowId - 検証するウィンドウのID（エラーメッセージの明示性のため）
 * @param expectedStructure - 期待するビュー構造（順序も検証される）。色またはビュー名で識別。
 * @param activeViewIndex - 現在ハイライト中のビューのインデックス
 * @param timeout - タイムアウト（ミリ秒、デフォルト: 5000）
 */
export async function assertViewStructure(
  page: Page,
  windowId: number,
  expectedStructure: ExpectedViewStructure[],
  activeViewIndex: number,
  timeout: number = 5000
): Promise<void> {
  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeout) {
    try {
      // ビュースイッチャーコンテナを取得
      const viewSwitcher = page.locator('[data-testid="view-switcher-container"]');
      const containerExists = await viewSwitcher.isVisible().catch(() => false);

      if (!containerExists) {
        throw new Error(`View switcher container is not visible (windowId: ${windowId})`);
      }

      // ビューボタン要素を取得（data-color属性を持つbutton要素）
      const viewButtons = viewSwitcher.locator('button[data-color]');
      const actualCount = await viewButtons.count();

      // ビュー数を比較
      if (actualCount !== expectedStructure.length) {
        throw new Error(
          `View count mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${expectedStructure.length} views\n` +
          `  Actual:   ${actualCount} views`
        );
      }

      // ビューが0個の場合は検証完了
      if (expectedStructure.length === 0) {
        return;
      }

      // 各ビューをX座標順に取得
      const actualViews: { color: string; x: number; isActive: boolean }[] = [];

      for (let i = 0; i < actualCount; i++) {
        const button = viewButtons.nth(i);
        const color = await button.getAttribute('data-color');
        const isActive = (await button.getAttribute('data-active')) === 'true';
        const box = await button.boundingBox();

        if (!box) {
          throw new Error(`View button ${i} has no bounding box (windowId: ${windowId})`);
        }

        actualViews.push({
          color: color || '',
          x: box.x,
          isActive
        });
      }

      // X座標でソートして順序を確認
      actualViews.sort((a, b) => a.x - b.x);

      // 順序の検証
      const actualOrder = actualViews.map(v => v.color);
      const expectedOrder = expectedStructure.map(s => s.viewIdentifier);

      if (JSON.stringify(actualOrder) !== JSON.stringify(expectedOrder)) {
        throw new Error(
          `View order mismatch (windowId: ${windowId}):\n` +
          `  Expected: [${expectedOrder.join(', ')}]\n` +
          `  Actual:   [${actualOrder.join(', ')}]`
        );
      }

      // アクティブビューの検証
      const activeViews = actualViews.filter(v => v.isActive);
      if (activeViews.length !== 1) {
        throw new Error(
          `Expected exactly 1 active view, but found ${activeViews.length} (windowId: ${windowId})`
        );
      }

      const actualActiveIndex = actualViews.findIndex(v => v.isActive);
      if (actualActiveIndex !== activeViewIndex) {
        throw new Error(
          `Active view index mismatch (windowId: ${windowId}):\n` +
          `  Expected: ${activeViewIndex} (${expectedStructure[activeViewIndex]?.viewIdentifier})\n` +
          `  Actual:   ${actualActiveIndex} (${actualViews[actualActiveIndex]?.color})`
        );
      }

      // すべて一致
      return;
    } catch (e) {
      lastError = e as Error;
    }

    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 50)));
  }

  throw lastError || new Error(`Timeout waiting for view structure (windowId: ${windowId})`);
}

/**
 * タブをルートレベルに移動（親子関係を解消）
 *
 * 子タブをドラッグして、別のタブの上部ギャップ（兄弟として挿入される位置）にドロップする
 * これにより親子関係が解消され、タブはルートレベルまたは別の親の下に配置される
 *
 * @param page - Side PanelのPage
 * @param childTabId - 移動する子タブのID
 * @param targetTabId - ドロップ先のタブのID（このタブの上にギャップドロップする）
 */
export async function moveTabToRoot(
  page: Page,
  childTabId: number,
  targetTabId: number
): Promise<void> {
  const sourceSelector = `[data-testid="tree-node-${childTabId}"]`;
  const targetSelector = `[data-testid="tree-node-${targetTabId}"]`;

  // ソース要素とターゲット要素のバウンディングボックスを取得
  const sourceBox = await getBoundingBox(page, sourceSelector, 5000);
  const targetBox = await getBoundingBox(page, targetSelector, 5000);

  // ソース要素の中央座標
  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;

  // ターゲット要素の上部ギャップ位置（上部15%）とルートレベルのX座標（左端付近）
  const targetX = targetBox.x + 30;  // ルートレベルの位置（インデントなし）
  const targetY = targetBox.y + targetBox.height * 0.15;  // 上部ギャップ

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  // 1. マウスをソース位置に移動
  await page.mouse.move(sourceX, sourceY, { steps: 3 });

  // 2. マウスボタンを押下
  await page.mouse.down();

  // 3. 8px以上移動してドラッグを開始
  await page.mouse.move(sourceX + 15, sourceY, { steps: 5 });

  // 4. ドラッグ状態が確立されるまで待機
  await waitForDragState(page);

  // 5. ターゲット位置（上部ギャップ）に移動
  await page.mouse.move(targetX, targetY, { steps: 10 });

  // 6. Reactの状態更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // 7. マウスをリリースしてドロップ
  await page.mouse.up();

  // D&D後のDOM更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // ストレージへの親子関係解消の反映をポーリングで待機
  await page.evaluate(async (childId) => {
    interface TreeNode {
      id: string;
      tabId: number;
      parentId: string | null;
    }
    interface LocalTreeState {
      nodes: Record<string, TreeNode>;
    }
    for (let i = 0; i < 20; i++) {
      const result = await chrome.storage.local.get('tree_state');
      const treeState = result.tree_state as LocalTreeState | undefined;
      if (treeState?.nodes) {
        const childNode = Object.values(treeState.nodes).find(
          (n: TreeNode) => n.tabId === childId
        );
        // 子ノードのparentIdがnullになっていることを確認
        if (childNode && childNode.parentId === null) {
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }, childTabId);
}
