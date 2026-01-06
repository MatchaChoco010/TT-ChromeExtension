import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, pinTab } from './utils/tab-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';

test.describe('ピン留めタブの並び替え', () => {
  // ドラッグ操作は時間がかかるためタイムアウトを延長
  test.setTimeout(120000);

  test.describe('ドラッグ＆ドロップによる並び替え', () => {
    test('ピン留めタブをドラッグ＆ドロップで並び替えできる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 3つのタブを作成してピン留め
      const tabId1 = await createTab(extensionContext, 'https://example.com/1');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(extensionContext, 'https://example.com/2');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId3 = await createTab(extensionContext, 'https://example.com/3');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め（順序: tabId1, tabId2, tabId3）
      await pinTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await pinTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // tabId3をtabId1の位置にドラッグ＆ドロップ
      const pinnedTab3 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId3}"]`);
      const pinnedTab1 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId1}"]`);

      // バックグラウンドスロットリングを回避するためにページをフォーカス
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // ドラッグ＆ドロップを実行
      const tab3Box = await pinnedTab3.boundingBox();
      const tab1Box = await pinnedTab1.boundingBox();

      if (tab3Box && tab1Box) {
        // tabId3の中央からドラッグ開始
        const startX = tab3Box.x + tab3Box.width / 2;
        const startY = tab3Box.y + tab3Box.height / 2;

        // tabId1の左端にドロップ（tabId1の前に配置するため）
        // 左端から20%の位置に配置することで、確実にtabId1の前に挿入される
        const endX = tab1Box.x + tab1Box.width * 0.2;
        const endY = tab1Box.y + tab1Box.height / 2;

        await sidePanelPage.mouse.move(startX, startY);
        await sidePanelPage.mouse.down();
        // ドラッグを開始するために少し移動
        await sidePanelPage.mouse.move(startX + 10, startY, { steps: 2 });
        // ドロップ先に移動
        await sidePanelPage.mouse.move(endX, endY, { steps: 5 });
        await sidePanelPage.mouse.up();
      }

      // ドラッグ＆ドロップ後にUIが更新されるまで待機
      await sidePanelPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));

      // ドラッグ&ドロップ後の順序を検証（順序はドラッグ操作の結果に依存）
      // assertPinnedTabStructureで3つのタブが存在することを確認
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }, { tabId: tabId1 }, { tabId: tabId2 }], 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await closeTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ブラウザとの同期', () => {
    test('並び替え後のピン留めタブ順序がブラウザと同期している', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 2つのタブを作成してピン留め
      const tabId1 = await createTab(extensionContext, 'https://example.com/first');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(extensionContext, 'https://example.com/second');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ブラウザ側で直接順序を変更（chrome.tabs.moveを使用）
      await serviceWorker.evaluate(async (tabId) => {
        // tabId2を先頭に移動
        await chrome.tabs.move(tabId, { index: 0 });
      }, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }, { tabId: tabId1 }], 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('包括的な順序同期テスト', () => {
    test('3つ以上のピン留めタブで各位置への移動が正しく同期される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 3つのタブを作成してピン留め
      const tabId1 = await createTab(extensionContext, 'https://example.com/tab1');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(extensionContext, 'https://example.com/tab2');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId3 = await createTab(extensionContext, 'https://example.com/tab3');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め（順序: tabId1, tabId2, tabId3）
      await pinTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await pinTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 1つ目のタブを移動
      // tabId1を末尾に移動: [tabId2, tabId3, tabId1]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 2 });
      }, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }, { tabId: tabId3 }, { tabId: tabId1 }], 0);

      // 2つ目以降のタブを移動
      // tabId3を先頭に移動: [tabId3, tabId2, tabId1]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }, { tabId: tabId2 }, { tabId: tabId1 }], 0);

      // 任意の位置への移動
      // tabId1を中間に移動: [tabId3, tabId1, tabId2]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 1 });
      }, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }, { tabId: tabId1 }, { tabId: tabId2 }], 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }, { tabId: tabId2 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }], 0);

      await closeTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ドロップ制限', () => {
    test('ピン留めタブを通常タブセクションにドロップしても通常タブにならない', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // ピン留めタブを作成
      const pinnedTabId = await createTab(extensionContext, 'https://example.com/pinned');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 通常タブを作成
      const normalTabId = await createTab(extensionContext, 'https://example.com/normal');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: pinnedTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めタブを通常タブセクションにドラッグ＆ドロップを試みる
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
      const normalTabNode = sidePanelPage.locator(`[data-testid="tree-node-${normalTabId}"]`).first();

      // バックグラウンドスロットリングを回避するためにページをフォーカス
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // ドラッグ＆ドロップを試みる
      const pinnedBox = await pinnedTab.boundingBox();
      const normalBox = await normalTabNode.boundingBox();

      if (pinnedBox && normalBox) {
        const startX = pinnedBox.x + pinnedBox.width / 2;
        const startY = pinnedBox.y + pinnedBox.height / 2;
        const endX = normalBox.x + normalBox.width / 2;
        const endY = normalBox.y + normalBox.height / 2;

        await sidePanelPage.mouse.move(startX, startY);
        await sidePanelPage.mouse.down();
        await sidePanelPage.mouse.move(startX + 10, startY, { steps: 2 });
        await sidePanelPage.mouse.move(endX, endY, { steps: 5 });
        await sidePanelPage.mouse.up();
      }

      // ドロップ操作後にUIが安定するまで待機
      await sidePanelPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 300)));

      // ピン留めタブがまだピン留め状態であることをassertPinnedTabStructureで確認
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: pinnedTabId }], 0);

      // クリーンアップ
      await closeTab(extensionContext, pinnedTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: normalTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await closeTab(extensionContext, normalTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ドラッグ可能性の確認', () => {
    test('ピン留めタブがソート可能として設定されている', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブを作成してピン留め
      const tabId = await createTab(extensionContext, 'https://example.com');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      await pinTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId }], 0);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めタブがソート可能として設定されているか確認
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);

      // data-sortable属性が設定されていることを確認
      const sortableAttr = await pinnedTab.getAttribute('data-sortable');
      expect(sortableAttr).toBe('true');

      // data-pinned-id属性が設定されていることを確認
      const pinnedIdAttr = await pinnedTab.getAttribute('data-pinned-id');
      expect(pinnedIdAttr).toBe(`pinned-${tabId}`);

      // クリーンアップ
      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });

  test.describe('ピン留めタブ順序同期の詳細テスト', () => {
    // 1つ目のタブの移動を個別に検証
    test('1つ目のピン留めタブを移動すると正しく同期される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 3つのピン留めタブを作成
      const tabId1 = await createTab(extensionContext, 'https://example.com/pinned1');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(extensionContext, 'https://example.com/pinned2');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId3 = await createTab(extensionContext, 'https://example.com/pinned3');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await pinTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // すべてのピン留めタブがUIに表示されるまで待機
      for (const tabId of [tabId1, tabId2, tabId3]) {
        await expect(async () => {
          const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
          await expect(pinnedTab).toBeVisible();
        }).toPass({ timeout: 10000 });
      }

      // 1つ目のタブを末尾に移動: [tabId2, tabId3, tabId1]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 2 });
      }, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }, { tabId: tabId3 }, { tabId: tabId1 }], 0);

      // 1つ目のタブを中間に移動: [tabId2, tabId1, tabId3]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 1 });
      }, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }, { tabId: tabId1 }, { tabId: tabId3 }], 0);

      // 1つ目のタブを先頭に移動: [tabId1, tabId2, tabId3]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }, { tabId: tabId3 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }], 0);

      await closeTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    // 2つ目のタブの移動を個別に検証
    test('2つ目のピン留めタブを移動すると正しく同期される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 3つのピン留めタブを作成
      const tabId1 = await createTab(extensionContext, 'https://example.com/pinned1');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(extensionContext, 'https://example.com/pinned2');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId3 = await createTab(extensionContext, 'https://example.com/pinned3');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await pinTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // すべてのピン留めタブがUIに表示されるまで待機
      for (const tabId of [tabId1, tabId2, tabId3]) {
        await expect(async () => {
          const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
          await expect(pinnedTab).toBeVisible();
        }).toPass({ timeout: 10000 });
      }

      // 2つ目のタブを先頭に移動: [tabId2, tabId1, tabId3]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }, { tabId: tabId1 }, { tabId: tabId3 }], 0);

      // 2つ目のタブを末尾に移動: [tabId1, tabId3, tabId2]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 2 });
      }, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId3 }, { tabId: tabId2 }], 0);

      // 2つ目のタブを中間に移動: [tabId1, tabId2, tabId3]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 1 });
      }, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }, { tabId: tabId3 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }], 0);

      await closeTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    // 3つ目のタブの移動を個別に検証
    test('3つ目のピン留めタブを移動すると正しく同期される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 3つのピン留めタブを作成
      const tabId1 = await createTab(extensionContext, 'https://example.com/pinned1');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(extensionContext, 'https://example.com/pinned2');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId3 = await createTab(extensionContext, 'https://example.com/pinned3');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await pinTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // すべてのピン留めタブがUIに表示されるまで待機
      for (const tabId of [tabId1, tabId2, tabId3]) {
        await expect(async () => {
          const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
          await expect(pinnedTab).toBeVisible();
        }).toPass({ timeout: 10000 });
      }

      // 3つ目のタブを先頭に移動: [tabId3, tabId1, tabId2]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }, { tabId: tabId1 }, { tabId: tabId2 }], 0);

      // 3つ目のタブを中間に移動: [tabId1, tabId3, tabId2]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 1 });
      }, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId3 }, { tabId: tabId2 }], 0);

      // 3つ目のタブを末尾に移動: [tabId1, tabId2, tabId3]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 2 });
      }, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }, { tabId: tabId3 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }], 0);

      await closeTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    // 4つ以上のピン留めタブでの複雑な移動パターン
    test('4つのピン留めタブで複雑な移動パターンが正しく同期される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 4つのピン留めタブを作成
      const tabId1 = await createTab(extensionContext, 'https://example.com/pinned1');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(extensionContext, 'https://example.com/pinned2');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId3 = await createTab(extensionContext, 'https://example.com/pinned3');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId4 = await createTab(extensionContext, 'https://example.com/pinned4');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await pinTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId4, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      await pinTab(extensionContext, tabId4);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }, { tabId: tabId4 }], 0);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // すべてのピン留めタブがUIに表示されるまで待機
      for (const tabId of [tabId1, tabId2, tabId3, tabId4]) {
        await expect(async () => {
          const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
          await expect(pinnedTab).toBeVisible();
        }).toPass({ timeout: 10000 });
      }

      // 複雑な移動パターン 1: 4つ目を先頭に -> [tabId4, tabId1, tabId2, tabId3]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 0 });
      }, tabId4);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId4 }, { tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      // 複雑な移動パターン 2: 2つ目を末尾に -> [tabId4, tabId2, tabId3, tabId1]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 3 });
      }, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId4 }, { tabId: tabId2 }, { tabId: tabId3 }, { tabId: tabId1 }], 0);

      // 複雑な移動パターン 3: 中間の入れ替え -> [tabId4, tabId3, tabId2, tabId1]
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.move(tabId, { index: 1 });
      }, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId4 }, { tabId: tabId3 }, { tabId: tabId2 }, { tabId: tabId1 }], 0);

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId4 }, { tabId: tabId3 }, { tabId: tabId2 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId4 }, { tabId: tabId3 }], 0);

      await closeTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId4 }], 0);

      await closeTab(extensionContext, tabId4);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });

    // ブラウザAPIによる移動の検証
    test('ブラウザのchrome.tabs.moveでピン留めタブを移動するとUIが即座に更新される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // テスト初期化
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // 3つのピン留めタブを作成
      const tabId1 = await createTab(extensionContext, 'https://example.com/pinned1');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId2 = await createTab(extensionContext, 'https://example.com/pinned2');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      const tabId3 = await createTab(extensionContext, 'https://example.com/pinned3');
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);

      // タブをピン留め
      await pinTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }], 0);

      await pinTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId3, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }], 0);

      await pinTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // すべてのピン留めタブがUIに表示されるまで待機
      for (const tabId of [tabId1, tabId2, tabId3]) {
        await expect(async () => {
          const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
          await expect(pinnedTab).toBeVisible();
        }).toPass({ timeout: 10000 });
      }

      // ブラウザAPIでタブを移動し、UIが即座に更新されることを確認
      // 複数回の移動を連続して行う
      for (let i = 0; i < 3; i++) {
        // tabId3を先頭に移動
        await serviceWorker.evaluate(async (tabId) => {
          await chrome.tabs.move(tabId, { index: 0 });
        }, tabId3);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: pseudoSidePanelTabId, depth: 0 },
        ], 0);
        await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }, { tabId: tabId1 }, { tabId: tabId2 }], 0);

        // tabId3を末尾に戻す
        await serviceWorker.evaluate(async (tabId) => {
          await chrome.tabs.move(tabId, { index: 2 });
        }, tabId3);
        await assertTabStructure(sidePanelPage, windowId, [
          { tabId: pseudoSidePanelTabId, depth: 0 },
        ], 0);
        await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId1 }, { tabId: tabId2 }, { tabId: tabId3 }], 0);
      }

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId2 }, { tabId: tabId3 }], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [{ tabId: tabId3 }], 0);

      await closeTab(extensionContext, tabId3);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
      await assertPinnedTabStructure(sidePanelPage, windowId, [], 0);
    });
  });
});
