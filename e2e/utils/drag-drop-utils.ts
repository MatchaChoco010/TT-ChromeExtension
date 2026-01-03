/**
 * DragDropUtils
 *
 * 自前D&D実装用のドラッグ&ドロップ操作シミュレーションユーティリティ
 * - dnd-kit固有のセレクタを使用しない
 * - マウスイベントベースのドラッグ操作シミュレーション
 */
import type { Page, Worker } from '@playwright/test';

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

/**
 * クロスウィンドウドラッグを開始
 * ドラッグ開始後、Service Workerにセッションが保存されるまで待機する
 * mouse.up()は呼ばない（ドラッグ状態を維持）
 *
 * @param page - Side PanelのPage
 * @param sourceTabId - ドラッグするタブのID
 */
export async function startCrossWindowDrag(page: Page, sourceTabId: number): Promise<void> {
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

  // 8px以上移動してドラッグを開始
  await page.mouse.move(startX + 10, startY, { steps: 5 });

  // ドラッグ状態が確立されるまで待機
  await waitForDragState(page);

  // Service Workerにドラッグセッションが保存されるまでポーリングで待機
  await page.evaluate(async (tabId) => {
    interface DragSession {
      tabId: number;
      state: string;
    }
    interface MessageResponse {
      success: boolean;
      data: DragSession | null;
    }
    for (let i = 0; i < 50; i++) {
      const response = await new Promise<MessageResponse>((resolve) => {
        chrome.runtime.sendMessage(
          { type: 'GET_DRAG_SESSION' },
          (resp) => resolve(resp as MessageResponse)
        );
      });
      if (response.success && response.data && response.data.tabId === tabId) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }, sourceTabId);
}

/**
 * クロスウィンドウドラッグのエントリをトリガー
 * 移動先ウィンドウのツリービューにマウスを移動してmouseenterを発火させる
 * これによりuseCrossWindowDragがService Workerからセッションを検知し、タブを移動する
 *
 * @param page - 移動先ウィンドウのSide PanelのPage
 */
export async function triggerCrossWindowDragEnter(page: Page): Promise<void> {
  // ページをフォーカス
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  // ツリービューのルート要素を取得
  const treeRoot = page.locator('[data-testid="tab-tree-root"]');
  await treeRoot.waitFor({ state: 'visible', timeout: 5000 });

  const box = await treeRoot.boundingBox();
  if (!box) {
    throw new Error('Tree root element not found or has no bounding box');
  }

  // ツリービューの中央にマウスを移動（mouseenterを発火）
  const targetX = box.x + box.width / 2;
  const targetY = box.y + box.height / 2;

  // ビューポート外からビュー内へ移動してmouseenterを確実に発火
  await page.mouse.move(0, 0);
  await page.mouse.move(targetX, targetY, { steps: 10 });

  // useCrossWindowDragがセッションを検知してタブを移動するまで待機
  await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));
}

/**
 * クロスウィンドウドラッグのドロップを完了
 * ターゲットタブに対するドロップ箇所を指定してドロップする
 *
 * @param page - 移動先ウィンドウのSide PanelのPage
 * @param targetTabId - ドロップ先の基準となるタブID
 * @param dropZone - ドロップ箇所
 *   - 'gap-above': ターゲットタブの上のギャップにドロップ（兄弟として上に挿入）
 *   - 'gap-below': ターゲットタブの下のギャップにドロップ（兄弟として下に挿入）
 *   - 'on-tab': ターゲットタブの上にドロップ（子タブになる）
 */
export async function completeCrossWindowDrop(
  page: Page,
  targetTabId: number,
  dropZone: 'gap-above' | 'gap-below' | 'on-tab' = 'gap-below'
): Promise<void> {
  const targetSelector = `[data-testid="tree-node-${targetTabId}"]`;

  // ターゲット要素のバウンディングボックスを取得
  const element = page.locator(targetSelector).first();
  await element.waitFor({ state: 'visible', timeout: 5000 });
  const targetBox = await element.boundingBox();
  if (!targetBox) {
    throw new Error(`Target element ${targetSelector} not found or has no bounding box`);
  }

  // ドロップ箇所に応じた座標を計算
  let targetX: number;
  let targetY: number;

  switch (dropZone) {
    case 'gap-above':
      // ターゲットタブの上部15%（上のギャップ）
      targetX = targetBox.x + targetBox.width / 2;
      targetY = targetBox.y + targetBox.height * 0.15;
      break;
    case 'gap-below':
      // ターゲットタブの下部85%（下のギャップ）
      targetX = targetBox.x + targetBox.width / 2;
      targetY = targetBox.y + targetBox.height * 0.85;
      break;
    case 'on-tab':
      // ターゲットタブの中央（タブの上にドロップ）
      targetX = targetBox.x + targetBox.width / 2;
      targetY = targetBox.y + targetBox.height / 2;
      break;
  }

  // バックグラウンドスロットリングを回避
  await page.bringToFront();
  await page.evaluate(() => window.focus());

  // ドロップ位置にマウスを移動
  await page.mouse.move(targetX, targetY, { steps: 10 });

  // Reactの状態更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // マウスをリリースしてドロップ
  await page.mouse.up();

  // D&D後のDOM更新を待機
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  // ドラッグ状態が解除されるまで待機
  await waitForDragEnd(page, 2000);
}
