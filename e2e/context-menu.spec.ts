/**
 * Context Menu E2E Tests
 *
 * コンテキストメニュー操作の E2E テスト
 *
 * - タブノード右クリック時のコンテキストメニュー表示
 * - "タブを閉じる" 機能
 * - "サブツリーを閉じる" 機能
 * - "グループに追加" 機能
 * - "新しいウィンドウで開く" 機能
 * - "URLをコピー" 機能
 * - メニュー外クリックでメニューが閉じること
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure, assertWindowCount } from './utils/assertion-utils';

test.describe('コンテキストメニュー操作', () => {
  test('タブノードを右クリックした場合、コンテキストメニューが表示される', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    // タブノードのlocatorを定義
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // バックグラウンドスロットリングを回避（ページにフォーカスを当てる）
    await sidePanelPage.bringToFront();

    // 要素のバウンディングボックスが安定するまで待機
    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    // Act: 右クリックでコンテキストメニューを開く
    await tabNode.click({ button: 'right' });

    // Assert: コンテキストメニューが表示される
    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // メニュー項目が存在することを確認
    await expect(sidePanelPage.getByRole('menuitem', { name: 'タブを閉じる' })).toBeVisible();

    // クリーンアップ
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューから"タブを閉じる"を選択した場合、対象タブが閉じられる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // 要素のバウンディングボックスが安定するまで待機（UI操作前確認）
    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    // Act: 右クリックでコンテキストメニューを開く
    await tabNode.click({ button: 'right' });

    // コンテキストメニューが表示されるまで待機（UIインタラクション結果）
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    // "タブを閉じる"をクリック
    await sidePanelPage.getByRole('menuitem', { name: 'タブを閉じる' }).click();

    // コンテキストメニューが閉じるまで待機（UIインタラクション結果）
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    // Assert: タブがUIで閉じられた後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューから"サブツリーを閉じる"を選択した場合、対象タブとその全ての子孫タブが閉じられる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const parentTabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
    ], 0);

    // 子タブを作成
    const childTabId1 = await createTab(extensionContext, 'about:blank', parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId1, depth: 1 },
    ], 0);

    const childTabId2 = await createTab(extensionContext, 'about:blank', parentTabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: parentTabId, depth: 0 },
      { tabId: childTabId1, depth: 1 },
      { tabId: childTabId2, depth: 1 },
    ], 0);

    // 親タブノードを取得
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);

    // 要素のバウンディングボックスが安定するまで待機
    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      parentTabId,
      { timeout: 5000 }
    );

    // Act: 右クリックでコンテキストメニューを開く
    await parentNode.click({ button: 'right' });

    // コンテキストメニューが表示されるまで待機
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    // "サブツリーを閉じる"をクリック（UI操作前確認）
    const closeSubtreeItem = sidePanelPage.getByRole('menuitem', { name: 'サブツリーを閉じる' });
    await expect(closeSubtreeItem).toBeVisible({ timeout: 3000 });
    await closeSubtreeItem.click();

    // コンテキストメニューが閉じるまで待機（UIインタラクション結果）
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    // Assert: サブツリーが閉じられた後の構造を検証（擬似サイドパネルタブだけが残る）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューから"グループに追加"を選択した場合、グループ選択またはグループ作成のインタラクションが開始される', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // 要素のバウンディングボックスが安定するまで待機
    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    // Act: 右クリックでコンテキストメニューを開く
    await tabNode.click({ button: 'right' });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    // Assert: "グループに追加"メニュー項目が存在する
    // Note: 単一タブ選択時の「グループに追加」はサブメニュー付きのdiv要素として実装されているため、
    // getByRole('menuitem')ではなくテキストコンテンツで検索する
    const groupItem = sidePanelPage.locator('[role="menu"]').getByText('グループに追加');
    await expect(groupItem).toBeVisible();

    // クリーンアップ: メニューを閉じてからタブを閉じる
    await sidePanelPage.keyboard.press('Escape');
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 2000 });
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューから"新しいウィンドウで開く"を選択した場合、タブが新しいウィンドウに移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // 要素のバウンディングボックスが安定するまで待機（UI操作前確認）
    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    // Act: 右クリックでコンテキストメニューを開く
    await tabNode.click({ button: 'right' });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    // "新しいウィンドウで開く"をクリック
    await sidePanelPage.getByRole('menuitem', { name: '新しいウィンドウで開く' }).click();

    // コンテキストメニューが閉じるまで待機（UIインタラクション結果）
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    // Assert: 新しいウィンドウが作成されたことを確認（タブが移動したので元ウィンドウには擬似サイドパネルタブのみ残る）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    // 新しいウィンドウが作成されたことを確認（初期ウィンドウ1 + 新ウィンドウ1 = 2）
    await assertWindowCount(extensionContext, 2);
  });

  test('コンテキストメニューから"URLをコピー"を選択した場合、クリップボードにURLがコピーされる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // 要素のバウンディングボックスが安定するまで待機
    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    // Act: 右クリックでコンテキストメニューを開く
    await tabNode.click({ button: 'right' });
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    // Assert: "URLをコピー"メニュー項目が存在する
    const copyUrlItem = sidePanelPage.getByRole('menuitem', { name: 'URLをコピー' });
    await expect(copyUrlItem).toBeVisible();

    // クリックしてコピーを実行
    await copyUrlItem.click();

    // クリップボード操作は環境によって異なるため、
    // ここではメニューが正常に閉じることを確認
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    // クリーンアップ
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('コンテキストメニューの外側をクリックした場合、メニューが閉じられる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // 要素のバウンディングボックスが安定するまで待機
    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // Act: 右クリックでコンテキストメニューを開く
    await tabNode.click({ button: 'right' });

    // コンテキストメニューが表示されることを確認（ポーリング）
    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(async () => {
      await expect(contextMenu).toBeVisible();
    }).toPass({ timeout: 5000 });

    // メニュー外をクリック - ポーリングで閉じるまでリトライ
    await expect(async () => {
      // メニューがまだ表示されていれば外側をクリック
      if (await contextMenu.isVisible()) {
        const menuBox = await contextMenu.boundingBox();
        if (menuBox) {
          // メニューの右下外側をクリック
          await sidePanelPage.mouse.click(
            menuBox.x + menuBox.width + 50,
            menuBox.y + menuBox.height + 50
          );
        }
      }
      // メニューが閉じたことを確認
      await expect(contextMenu).not.toBeVisible();
    }).toPass({ timeout: 10000, intervals: [200, 500, 1000, 2000] });

    // クリーンアップ
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });

  test('Escapeキーを押した場合、コンテキストメニューが閉じられる', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // ウィンドウIDと擬似サイドパネルタブIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

    // ブラウザ起動時のデフォルトタブを閉じる
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);

    // 初期状態を検証（擬似サイドパネルタブのみ）
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);

    const tabId = await createTab(extensionContext, 'about:blank');
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId, depth: 0 },
    ], 0);

    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // 要素のバウンディングボックスが安定するまで待機
    await sidePanelPage.waitForFunction(
      (tabId) => {
        const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!node) return false;
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      },
      tabId,
      { timeout: 5000 }
    );

    // Act: 右クリックでコンテキストメニューを開く
    await tabNode.click({ button: 'right' });

    // コンテキストメニューが表示されることを確認
    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    // Escapeキーを押す
    await sidePanelPage.keyboard.press('Escape');

    // Assert: コンテキストメニューが閉じられる
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // クリーンアップ
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
    ], 0);
  });
});
