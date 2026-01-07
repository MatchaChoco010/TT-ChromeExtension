/**
 * DragDropUtils
 *
 * ドラッグ&ドロップ操作シミュレーションユーティリティ
 */
import type { Page, Worker } from '@playwright/test';

/**
 * 要素のバウンディングボックスを取得
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
 * タイムアウト時は例外を投げる
 *
 * @param page - Page
 * @param maxWait - 最大待機時間（ミリ秒）
 * @throws タイムアウト時にError
 */
async function waitForDragState(page: Page, maxWait: number = 2000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const dragContainer = page.locator('[data-drag-container]');
    const hasDragClass = await dragContainer.evaluate((el) =>
      el.classList.contains('is-dragging')
    ).catch(() => false);
    if (hasDragClass) {
      return;
    }
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)));
  }
  throw new Error(`waitForDragState: is-dragging class not found within ${maxWait}ms`);
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

  const box = await getBoundingBox(page, selector);

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  await page.mouse.move(startX, startY, { steps: 3 });

  await page.mouse.down();

  await page.mouse.move(startX + 10, startY, { steps: 5 });

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

  const box = await getBoundingBox(page, selector);

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 10 });

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
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

/**
 * ドロップを実行
 *
 * @param page - Side PanelのPage
 */
export async function dropTab(page: Page): Promise<void> {
  await page.mouse.up();

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

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  const sourceBox = await getBoundingBox(page, sourceSelector, 5000);

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;

  await page.mouse.move(sourceX, sourceY, { steps: 3 });

  await page.mouse.down();

  await page.mouse.move(sourceX + 10, sourceY, { steps: 5 });

  await waitForDragState(page);

  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const targetBox = await getBoundingBox(page, targetSelector, 5000);
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = position === 'before'
    ? targetBox.y + targetBox.height * 0.15
    : targetBox.y + targetBox.height * 0.85;

  await page.mouse.move(targetX, targetY, { steps: 15 });

  await waitForDropIndicator(page, 2000);

  await page.mouse.up();

  await waitForDragEnd(page, 2000);
}

/**
 * タブを別のタブの子にするD&D操作を実行する（操作のみ、検証は行わない）
 *
 * 本番コード（useDragDrop.ts）でcommittedDropTargetRefを使用し、
 * Reactのレンダリング後に確定したdropTargetでドロップ処理を行うため、
 * テスト側では単純なマウス操作のみを行い、最終状態を検証する
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

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  const sourceBox = await getBoundingBox(page, sourceSelector, 5000);

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;

  await page.mouse.move(sourceX, sourceY, { steps: 3 });

  await page.mouse.down();

  await page.mouse.move(sourceX + 15, sourceY, { steps: 5 });

  await waitForDragState(page);

  // ドラッグ開始後にターゲット位置を取得（レイアウト変更を考慮）
  const targetBox = await getBoundingBox(page, targetSelector, 5000);
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(targetX, targetY, { steps: 15 });

  await page.mouse.up();

  await waitForDragEnd(page, 2000);
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

  const sourceBox = await getBoundingBox(page, sourceSelector, 5000);

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;

  const viewport = page.viewportSize() || { width: 800, height: 600 };

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

  await page.mouse.move(sourceX, sourceY, { steps: 3 });

  await page.mouse.down();

  await page.mouse.move(sourceX + 10, sourceY, { steps: 5 });

  await waitForDragState(page);

  await page.mouse.move(targetX, targetY, { steps: 10 });

  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  await page.mouse.up();

  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
 * タイムアウト時は例外を投げる
 *
 * @param page - Side PanelのPage
 * @param maxWait - 最大待機時間（ミリ秒）
 * @throws タイムアウト時にError
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
  throw new Error(`waitForDragEnd: is-dragging class still present after ${maxWait}ms`);
}

/**
 * ドロップインジケーターが表示されるまでポーリングで待機
 * ギャップドロップ時に使用
 * タイムアウト時は例外を投げる
 *
 * @param page - Side PanelのPage
 * @param maxWait - 最大待機時間（ミリ秒）
 * @throws タイムアウト時にError
 */
async function waitForDropIndicator(page: Page, maxWait: number = 2000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    const indicator = page.locator('[data-testid="drop-indicator"]');
    const isVisible = await indicator.isVisible().catch(() => false);
    if (isVisible) {
      return;
    }
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)));
  }
  throw new Error(`waitForDropIndicator: drop-indicator not visible within ${maxWait}ms`);
}


/**
 * ターゲットタブがハイライトされ、かつdropTargetの状態がTabになるまでポーリングで待機
 * タブ中央へのドロップ（子タブ化）時に使用
 * ハイライト時はring-2クラスが付与され、data-drop-target-type="tab"が設定される
 * 追加でdata-drop-target-nodeがターゲットタブのノードIDと一致することを確認
 * タイムアウト時は例外を投げる
 *
 * @param page - Side PanelのPage
 * @param targetTabId - ターゲットタブのID
 * @param maxWait - 最大待機時間（ミリ秒）
 * @throws タイムアウト時にError
 */
async function waitForTargetHighlight(page: Page, targetTabId: number, maxWait: number = 2000): Promise<void> {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWait) {
    // ハイライトクラスとdropTarget状態を確認
    const result = await page.evaluate((tabId: number) => {
      const targetNode = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
      const dragContainer = document.querySelector('[data-drag-container]');

      const hasHighlight = targetNode?.classList.contains('ring-2') &&
                           targetNode?.classList.contains('ring-gray-400');
      const dropTargetType = dragContainer?.getAttribute('data-drop-target-type');

      // ハイライトが表示され、かつdropTargetTypeが'tab'であることを確認
      // これにより、Tabドロップターゲットが正しく設定されていることを保証する
      return {
        hasHighlight,
        dropTargetType,
        isReady: hasHighlight && dropTargetType === 'tab',
      };
    }, targetTabId).catch(() => ({ hasHighlight: false, dropTargetType: null, isReady: false }));

    if (result.isReady) {
      return;
    }
    await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 10)));
  }
  throw new Error(`waitForTargetHighlight: target tab ${targetTabId} not highlighted within ${maxWait}ms`);
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

  // バックグラウンドスロットリングを回避するためにページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  const sourceBox = await getBoundingBox(page, sourceSelector, 5000);

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;

  await page.mouse.move(sourceX, sourceY, { steps: 3 });

  await page.mouse.down();

  await page.mouse.move(sourceX + 15, sourceY, { steps: 5 });

  await waitForDragState(page);

  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  const targetBox = await getBoundingBox(page, targetSelector, 5000);
  const targetX = targetBox.x + 30;
  const targetY = targetBox.y + targetBox.height * 0.15;

  await page.mouse.move(targetX, targetY, { steps: 10 });

  await waitForDropIndicator(page, 2000);

  await page.mouse.up();

  await waitForDragEnd(page, 2000);

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
        if (childNode && childNode.parentId === null) {
          return;
        }
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }, childTabId);
}


