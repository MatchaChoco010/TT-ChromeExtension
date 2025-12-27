/**
 * ドラッグ&ドロップのホバー自動展開テスト
 *
 * Requirement 3.5: ドラッグ&ドロップのホバー自動展開
 *
 * このテストスイートでは、ドラッグ中のホバー自動展開機能を検証します。
 * - 折りたたまれた親タブの上にタブをホバーした場合の自動展開
 * - 自動展開のタイムアウト前にホバーを離れた場合のキャンセル
 * - 深いツリー構造で複数のノードを経由してドラッグした場合の順次自動展開
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 * Note: 展開/折りたたみ状態の変更はservice workerを通じてストレージを操作します
 */
import { test, expect } from './fixtures/extension';
import type { BrowserContext } from '@playwright/test';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { startDrag, hoverOverTab, dropTab } from './utils/drag-drop-utils';

// 自動展開のホバー遅延（ミリ秒）- TabTreeView.tsxのAUTO_EXPAND_HOVER_DELAY_MSと一致
const AUTO_EXPAND_HOVER_DELAY_MS = 1000;
// テストで使用するホバー時間のバッファ
const HOVER_BUFFER_MS = 500;

/**
 * Service Workerを取得
 */
async function getServiceWorker(context: BrowserContext): Promise<Worker> {
  let [serviceWorker] = context.serviceWorkers();
  if (!serviceWorker) {
    serviceWorker = await context.waitForEvent('serviceworker');
  }
  return serviceWorker;
}

/**
 * ノードの展開状態をストレージから確認
 */
async function isNodeExpanded(context: BrowserContext, tabId: number): Promise<boolean> {
  const serviceWorker = await getServiceWorker(context);

  return await serviceWorker.evaluate(async (tabId) => {
    const result = await chrome.storage.local.get('tree_state');
    if (result.tree_state) {
      const nodeId = `node-${tabId}`;
      return result.tree_state.nodes[nodeId]?.isExpanded ?? true;
    }
    return true;
  }, tabId);
}

/**
 * ノードの展開状態が期待値になるまでポーリングで待機
 */
async function waitForNodeExpanded(
  context: BrowserContext,
  tabId: number,
  expectedExpanded: boolean,
  timeout: number = 5000
): Promise<boolean> {
  const startTime = Date.now();
  const pollInterval = 100;

  while (Date.now() - startTime < timeout) {
    const isExpanded = await isNodeExpanded(context, tabId);
    if (isExpanded === expectedExpanded) {
      return true;
    }
    // eslint-disable-next-line no-undef
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  // タイムアウト時は最終状態を返す
  return await isNodeExpanded(context, tabId);
}

/**
 * UIボタンをクリックして親タブを折りたたむ
 * DOMとストレージの両方で折りたたみ状態が反映されるまで待機
 */
async function collapseNodeViaUI(
  page: import('@playwright/test').Page,
  context: BrowserContext,
  tabId: number
): Promise<void> {
  const parentNode = page.locator(`[data-testid="tree-node-${tabId}"]`).first();
  const expandButton = parentNode.locator('[data-testid="expand-button"]');

  // 展開ボタンが存在する場合のみクリック
  if ((await expandButton.count()) > 0) {
    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded === 'true') {
      await expandButton.click();
      // DOM側で折りたたみ状態が反映されるまで待機
      await expect(parentNode).toHaveAttribute('data-expanded', 'false', { timeout: 3000 });

      // ストレージ側でも折りたたみ状態が反映されるまでポーリングで待機
      await waitForNodeExpanded(context, tabId, false, 3000);
    }
  }
}

test.describe('ドラッグ&ドロップのホバー自動展開', () => {
  // タイムアウトを60秒に設定
  test.setTimeout(60000);

  test('折りたたまれた親タブの上にタブをホバーした場合、一定時間後に自動的に展開されること', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    // ネットワーク不要のdata: URLを使用して安定性向上
    const parentTab = await createTab(extensionContext, 'data:text/html,<h1>Parent</h1>');
    const childTab = await createTab(extensionContext, 'data:text/html,<h1>Child</h1>', parentTab);

    // 別のルートレベルのタブを作成（ドラッグ対象）
    const dragTab = await createTab(extensionContext, 'data:text/html,<h1>Drag</h1>');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, dragTab);

    // 親タブを展開（子タブを追加すると自動展開されるため）
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const expandButton = parentNode.locator('[data-testid="expand-button"]');

    // 展開ボタンが表示されるまで待機
    await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

    // 展開状態を確認し、展開されていなければ展開
    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    // 親タブをUIで折りたたむ
    await collapseNodeViaUI(sidePanelPage, extensionContext, parentTab);

    // 親タブが折りたたまれていることを確認
    await expect(parentNode).toHaveAttribute('data-expanded', 'false', { timeout: 3000 });

    // dragTabノードが完全にレンダリングされていることを確認
    const dragNode = sidePanelPage.locator(`[data-testid="tree-node-${dragTab}"]`).first();
    await expect(dragNode).toBeVisible({ timeout: 5000 });

    // 実行: dragTabをドラッグ開始（dnd-kitのdistance: 8を満たすよう10px移動）
    await startDrag(sidePanelPage, dragTab);

    // 親タブの上にホバーして、自動展開を待つ
    await hoverOverTab(sidePanelPage, parentTab);

    // 自動展開のタイマーが発火するまでホバー状態を維持
    const hoverWaitTime = AUTO_EXPAND_HOVER_DELAY_MS + HOVER_BUFFER_MS;
    await sidePanelPage.evaluate((waitMs) => new Promise(resolve => setTimeout(resolve, waitMs)), hoverWaitTime);

    // 展開状態がストレージに反映されるまでポーリングで待機
    const expandedDuringHover = await waitForNodeExpanded(extensionContext, parentTab, true, 5000);

    // ドロップを実行
    await dropTab(sidePanelPage);

    // 検証: 親タブが自動的に展開されていること
    expect(expandedDuringHover).toBe(true);

    // DOM側でも展開状態を確認
    await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });
  });

  test('自動展開のタイムアウト前にホバーを離れた場合、その時点では展開されていないこと', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: createTabで親子関係を作成
    // 4つのタブを作成: parentTab(折りたたみ対象), childTab(親の子), anotherTab(ホバー先), dragTab(ドラッグ対象)
    const parentTab = await createTab(extensionContext, 'data:text/html,<h1>Parent</h1>');
    const childTab = await createTab(extensionContext, 'data:text/html,<h1>Child</h1>', parentTab);
    const anotherTab = await createTab(extensionContext, 'data:text/html,<h1>Another</h1>');
    const dragTab = await createTab(extensionContext, 'data:text/html,<h1>Drag</h1>');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, anotherTab);
    await assertTabInTree(sidePanelPage, dragTab);

    // 事前条件の検証
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    const dragNode = sidePanelPage.locator(`[data-testid="tree-node-${dragTab}"]`).first();
    const anotherNode = sidePanelPage.locator(`[data-testid="tree-node-${anotherTab}"]`).first();

    await expect(parentNode).toBeVisible({ timeout: 5000 });
    await expect(dragNode).toBeVisible({ timeout: 5000 });
    await expect(anotherNode).toBeVisible({ timeout: 5000 });

    // 展開ボタンが表示されるまで待機
    const expandButton = parentNode.locator('[data-testid="expand-button"]');
    await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

    // 展開状態を確認し、展開されていなければ展開
    const isExpanded = await parentNode.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.click();
      await expect(parentNode).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    // 親タブをUIで折りたたむ
    await collapseNodeViaUI(sidePanelPage, extensionContext, parentTab);
    await expect(parentNode).toHaveAttribute('data-expanded', 'false', { timeout: 3000 });

    // ストレージでも折りたたまれていることを確認
    const isCollapsedBefore = await isNodeExpanded(extensionContext, parentTab);
    expect(isCollapsedBefore).toBe(false);

    // ページをフォーカスしてバックグラウンドスロットリングを回避
    // ChromeはバックグラウンドタブでタイマーとrequestAnimationFrameを1秒に1回にスロットリングする
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // 実行: dragTabをドラッグ開始
    await startDrag(sidePanelPage, dragTab);

    // 親タブの上にホバー（タイマー開始）
    await hoverOverTab(sidePanelPage, parentTab);

    // 200ms待機（1秒未満なのでタイマーはまだ発火しない）
    await sidePanelPage.waitForTimeout(200);

    // 親タブが未だ折りたたまれていることを確認
    const midCheckExpanded = await parentNode.getAttribute('data-expanded');
    expect(midCheckExpanded).toBe('false');

    // 別のタブ（anotherTab）にホバーを移動してタイマーをクリア
    // これによりonDragOverが発火し、over.idが変わることでタイマーがキャンセルされる
    await hoverOverTab(sidePanelPage, anotherTab);
    await sidePanelPage.waitForTimeout(100);

    // ドラッグを終了
    await dropTab(sidePanelPage);

    // さらに1秒以上待機しても、親タブが展開されないことを確認
    await sidePanelPage.waitForTimeout(AUTO_EXPAND_HOVER_DELAY_MS + 200);

    // 検証: タイマーがクリアされたため、親タブは折りたたまれたまま
    const dataExpanded = await parentNode.getAttribute('data-expanded');
    expect(dataExpanded).toBe('false');

    // ストレージ側でも確認
    const isExpandedAfterDrop = await isNodeExpanded(extensionContext, parentTab);
    expect(isExpandedAfterDrop).toBe(false);
  });

  test('深いツリー構造でルートノードへのホバーにより自動展開が機能すること', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成（2階層のシンプルな構造）
    // level0 (ルートレベル)
    //   └─ level1
    // ネットワーク不要のdata: URLを使用して安定性向上
    const level0 = await createTab(extensionContext, 'data:text/html,<h1>Level0</h1>');
    const level1 = await createTab(extensionContext, 'data:text/html,<h1>Level1</h1>', level0);

    // ドラッグ対象のタブを作成
    const dragTab = await createTab(extensionContext, 'data:text/html,<h1>Drag</h1>');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, level0);
    await assertTabInTree(sidePanelPage, level1);
    await assertTabInTree(sidePanelPage, dragTab);

    // level0ノードが存在することを確認
    const level0Node = sidePanelPage.locator(`[data-testid="tree-node-${level0}"]`).first();
    const expandButton = level0Node.locator('[data-testid="expand-button"]');

    // 展開ボタンが表示されるまで待機
    await expect(expandButton.first()).toBeVisible({ timeout: 5000 });

    // 展開状態を確認し、展開されていなければ展開
    const isExpanded = await level0Node.getAttribute('data-expanded');
    if (isExpanded !== 'true') {
      await expandButton.click();
      await expect(level0Node).toHaveAttribute('data-expanded', 'true', { timeout: 3000 });
    }

    // level0をUIで折りたたむ
    await collapseNodeViaUI(sidePanelPage, extensionContext, level0);

    // level0が折りたたまれていることを確認
    await expect(level0Node).toHaveAttribute('data-expanded', 'false', { timeout: 3000 });

    // dragTabノードが完全にレンダリングされていることを確認
    const dragNode = sidePanelPage.locator(`[data-testid="tree-node-${dragTab}"]`).first();
    await expect(dragNode).toBeVisible({ timeout: 5000 });

    // 実行: dragTabをドラッグ開始
    await startDrag(sidePanelPage, dragTab);

    // level0の上でホバーして自動展開を待つ
    await hoverOverTab(sidePanelPage, level0);

    // 自動展開のタイマーが発火するまでホバー状態を維持
    const hoverWaitTime = AUTO_EXPAND_HOVER_DELAY_MS + HOVER_BUFFER_MS;
    await sidePanelPage.evaluate((waitMs) => new Promise(resolve => setTimeout(resolve, waitMs)), hoverWaitTime);

    // 展開状態がストレージに反映されるまでポーリングで待機
    await waitForNodeExpanded(extensionContext, level0, true, 5000);

    // ドロップを実行
    await dropTab(sidePanelPage);

    // 検証: level0が展開されたこと（DOM属性で確認）
    await expect(level0Node).toHaveAttribute('data-expanded', 'true', { timeout: 5000 });

    // level1が表示されていること
    const level1Node = sidePanelPage.locator(`[data-testid="tree-node-${level1}"]`);
    await expect(level1Node.first()).toBeVisible({ timeout: 5000 });
  });
});
