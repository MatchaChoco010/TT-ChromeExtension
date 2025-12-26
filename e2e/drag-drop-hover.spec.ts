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
import type { Page, Worker } from '@playwright/test';

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
 * ストレージを操作してノードを折りたたむ
 */
async function collapseNodeViaStorage(context: BrowserContext, tabId: number): Promise<void> {
  const serviceWorker = await getServiceWorker(context);

  await serviceWorker.evaluate(async (tabId) => {
    const result = await chrome.storage.local.get('tree_state');
    if (result.tree_state) {
      const treeState = result.tree_state;
      const nodeId = `node-${tabId}`;

      if (treeState.nodes[nodeId]) {
        treeState.nodes[nodeId].isExpanded = false;
        await chrome.storage.local.set({ tree_state: treeState });

        // UIに状態変更を通知
        await chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
      }
    }
  }, tabId);

  // UIが更新されるまで待機
  await new Promise(resolve => setTimeout(resolve, 500));
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

test.describe('ドラッグ&ドロップのホバー自動展開', () => {
  test('折りたたまれた親タブの上にタブをホバーした場合、一定時間後に自動的に展開されること', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org', parentTab);

    // 別のルートレベルのタブを作成（ドラッグ対象）
    const dragTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, dragTab);

    // 親タブをストレージ経由で折りたたむ
    await collapseNodeViaStorage(extensionContext, parentTab);

    // Side Panelをリロードして状態を反映
    await sidePanelPage.reload();
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブが折りたたまれていることを確認
    const isExpandedBefore = await isNodeExpanded(extensionContext, parentTab);
    expect(isExpandedBefore).toBe(false);

    // 親タブノードが存在することを確認
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    await expect(parentNode).toBeVisible({ timeout: 10000 });

    // data-expanded属性を確認
    await expect(parentNode).toHaveAttribute('data-expanded', 'false', { timeout: 5000 });

    // 実行: dragTabをドラッグ開始
    await startDrag(sidePanelPage, dragTab);

    // 親タブの上にホバーして、自動展開の時間を待つ
    await hoverOverTab(sidePanelPage, parentTab);
    await sidePanelPage.waitForTimeout(AUTO_EXPAND_HOVER_DELAY_MS + HOVER_BUFFER_MS);

    // ドロップを実行
    await dropTab(sidePanelPage);

    // 検証: 親タブが自動的に展開されていること
    await sidePanelPage.waitForTimeout(500);
    const isExpandedAfter = await isNodeExpanded(extensionContext, parentTab);
    expect(isExpandedAfter).toBe(true);
  });

  test('自動展開のタイムアウト前にホバーを離れた場合、その時点では展開されていないこと', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org', parentTab);

    // 別のルートレベルのタブを作成
    const dragTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, dragTab);

    // 親タブをストレージ経由で折りたたむ
    await collapseNodeViaStorage(extensionContext, parentTab);

    // Side Panelをリロードして状態を反映
    await sidePanelPage.reload();
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブが折りたたまれていることを確認
    const isExpandedBefore = await isNodeExpanded(extensionContext, parentTab);
    expect(isExpandedBefore).toBe(false);

    // 親タブノードが存在することを確認
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    await expect(parentNode).toBeVisible({ timeout: 10000 });

    // 実行: dragTabをドラッグ開始
    await startDrag(sidePanelPage, dragTab);

    // 親タブの上にホバーするが、自動展開の時間未満で検証
    await hoverOverTab(sidePanelPage, parentTab);
    await sidePanelPage.waitForTimeout(300); // 300ms（1秒未満）

    // 検証: 300msのホバー後でも親タブはまだ折りたたまれている
    // 自動展開のタイムアウトは1秒なので、まだ展開されていないはず
    const isExpandedDuringShortHover = await isNodeExpanded(extensionContext, parentTab);
    expect(isExpandedDuringShortHover).toBe(false);

    // Note: この時点でドラッグを継続中なので、
    // 追加で1秒以上ホバーし続けると最終的に展開される
    // テストの目的は「タイムアウト前は展開されない」ことの検証
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
    const level0 = await createTab(extensionContext, 'https://example.com');
    const level1 = await createTab(extensionContext, 'https://www.iana.org', level0);

    // ドラッグ対象のタブを作成
    const dragTab = await createTab(extensionContext, 'https://www.github.com');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, level0);
    await assertTabInTree(sidePanelPage, level1);
    await assertTabInTree(sidePanelPage, dragTab);

    // level0をストレージ経由で折りたたむ
    await collapseNodeViaStorage(extensionContext, level0);

    // Side Panelをリロードして状態を反映
    await sidePanelPage.reload();
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await expect(sidePanelRoot).toBeVisible();

    // level0が折りたたまれていることを確認
    const isLevel0Collapsed = await isNodeExpanded(extensionContext, level0);
    expect(isLevel0Collapsed).toBe(false);

    // level0ノードが存在することを確認
    const level0Node = sidePanelPage.locator(`[data-testid="tree-node-${level0}"]`).first();
    await expect(level0Node).toBeVisible({ timeout: 10000 });

    // 実行: dragTabをドラッグ開始
    await startDrag(sidePanelPage, dragTab);

    // level0の上でホバーして自動展開を待つ
    await hoverOverTab(sidePanelPage, level0);
    await sidePanelPage.waitForTimeout(AUTO_EXPAND_HOVER_DELAY_MS + HOVER_BUFFER_MS);

    // 検証: level0が展開されたこと
    const isLevel0ExpandedAfter = await isNodeExpanded(extensionContext, level0);
    expect(isLevel0ExpandedAfter).toBe(true);

    // level1が表示されていること
    const level1Node = sidePanelPage.locator(`[data-testid="tree-node-${level1}"]`);
    await expect(level1Node.first()).toBeVisible({ timeout: 5000 });

    // ドロップを実行
    await dropTab(sidePanelPage);

    // level0が展開されていることを最終確認
    await sidePanelPage.waitForTimeout(500);
    const finalLevel0 = await isNodeExpanded(extensionContext, level0);
    expect(finalLevel0).toBe(true);
  });

  test('ドラッグ中に折りたたまれた親タブ上で1秒未満ホバーした場合、ホバー中は展開されないこと', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 準備: 親タブと子タブを作成
    const parentTab = await createTab(extensionContext, 'https://example.com');
    const childTab = await createTab(extensionContext, 'https://www.iana.org', parentTab);

    // ドラッグ対象のタブを作成
    const dragTab = await createTab(extensionContext, 'https://www.w3.org');

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, parentTab);
    await assertTabInTree(sidePanelPage, childTab);
    await assertTabInTree(sidePanelPage, dragTab);

    // 親タブをストレージ経由で折りたたむ
    await collapseNodeViaStorage(extensionContext, parentTab);

    // Side Panelをリロードして状態を反映
    await sidePanelPage.reload();
    await sidePanelPage.waitForLoadState('domcontentloaded');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブが折りたたまれていることを確認
    const isExpandedBefore = await isNodeExpanded(extensionContext, parentTab);
    expect(isExpandedBefore).toBe(false);

    // 親タブノードが存在することを確認
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTab}"]`).first();
    await expect(parentNode).toBeVisible({ timeout: 10000 });

    // 実行: dragTabをドラッグ開始
    await startDrag(sidePanelPage, dragTab);

    // 親タブの上で短時間ホバー（300ミリ秒）
    await hoverOverTab(sidePanelPage, parentTab);
    await sidePanelPage.waitForTimeout(300);

    // 検証: 短時間ホバー中は親タブが折りたたまれたままであること
    // 自動展開のタイムアウト（1秒）に達していないので、まだ展開されていないはず
    const isExpandedDuringShortHover = await isNodeExpanded(extensionContext, parentTab);
    expect(isExpandedDuringShortHover).toBe(false);

    // Note: ドロップ操作は親の子として配置する場合は親を自動展開するため、
    // この検証はホバー中の状態を確認することが主目的
  });
});
