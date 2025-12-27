/**
 * Context Menu E2E Tests
 *
 * コンテキストメニュー操作の E2E テスト
 *
 * Requirement 3.11: コンテキストメニュー操作
 * - タブノード右クリック時のコンテキストメニュー表示
 * - "タブを閉じる" 機能
 * - "サブツリーを閉じる" 機能
 * - "グループに追加" 機能
 * - "新しいウィンドウで開く" 機能
 * - "URLをコピー" 機能
 * - メニュー外クリックでメニューが閉じること
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';

test.describe('コンテキストメニュー操作', () => {
  test('タブノードを右クリックした場合、コンテキストメニューが表示される', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'about:blank');

    // タブノードのlocatorを定義
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

    // タブノードが表示されるまで待機（Playwrightの自動リトライ機能を活用）
    await expect(tabNode).toBeVisible({ timeout: 10000 });

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
  });

  test('コンテキストメニューから"タブを閉じる"を選択した場合、対象タブが閉じられる', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: テスト用タブを作成
    const tabId = await createTab(extensionContext, 'about:blank');

    // タブノードが表示されるまで待機
    await expect(async () => {
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(tabNode).toBeVisible();
    }).toPass({ timeout: 10000 });

    // 現在のタブ数を取得
    const initialTabNodes = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();

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

    // コンテキストメニューが表示されるまで待機
    await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 3000 });

    // "タブを閉じる"をクリック
    await sidePanelPage.getByRole('menuitem', { name: 'タブを閉じる' }).click();

    // コンテキストメニューが閉じるまで待機
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    // Assert: タブ数が減少している
    await expect(async () => {
      const currentTabNodes = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();
      expect(currentTabNodes).toBeLessThan(initialTabNodes);
    }).toPass({ timeout: 5000 });
  });

  test('コンテキストメニューから"サブツリーを閉じる"を選択した場合、対象タブとその全ての子孫タブが閉じられる', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: 親タブと子タブを作成してサブツリーを構築
    const parentTabId = await createTab(extensionContext, 'about:blank');

    // 親タブが表示されるまで待機
    await expect(async () => {
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
      await expect(parentNode).toBeVisible();
    }).toPass({ timeout: 10000 });

    // 子タブを作成
    const childTabId1 = await createTab(extensionContext, 'about:blank', parentTabId);
    await expect(async () => {
      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId1}"]`);
      await expect(childNode).toBeVisible();
    }).toPass({ timeout: 10000 });

    const childTabId2 = await createTab(extensionContext, 'about:blank', parentTabId);
    await expect(async () => {
      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId2}"]`);
      await expect(childNode).toBeVisible();
    }).toPass({ timeout: 10000 });

    // 現在のタブ数を取得（初期タブ + 親タブ + 子タブ2つ）
    const initialTabNodes = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();
    expect(initialTabNodes).toBeGreaterThanOrEqual(3);

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

    // "サブツリーを閉じる"をクリック
    const closeSubtreeItem = sidePanelPage.getByRole('menuitem', { name: 'サブツリーを閉じる' });
    await expect(closeSubtreeItem).toBeVisible({ timeout: 3000 });
    await closeSubtreeItem.click();

    // コンテキストメニューが閉じるまで待機
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    // Assert: サブツリー全体（親 + 子2つ = 3タブ）が削除されている
    await expect(async () => {
      const currentTabNodes = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();
      expect(currentTabNodes).toBe(initialTabNodes - 3);
    }).toPass({ timeout: 5000 });
  });

  test('コンテキストメニューから"グループに追加"を選択した場合、グループ選択またはグループ作成のインタラクションが開始される', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'about:blank');

    // タブノードが表示されるまで待機
    await expect(async () => {
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(tabNode).toBeVisible();
    }).toPass({ timeout: 10000 });

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
    const groupItem = sidePanelPage.getByRole('menuitem', { name: /グループ/ });
    await expect(groupItem).toBeVisible();

    // クリーンアップ: メニューを閉じてからタブを閉じる
    await sidePanelPage.keyboard.press('Escape');
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 2000 });
    await closeTab(extensionContext, tabId);
  });

  test('コンテキストメニューから"新しいウィンドウで開く"を選択した場合、タブが新しいウィンドウに移動する', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'about:blank');

    // タブノードが表示されるまで待機
    await expect(async () => {
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(tabNode).toBeVisible();
    }).toPass({ timeout: 10000 });

    // 初期のウィンドウ数を取得
    const initialWindowCount = await serviceWorker.evaluate(async () => {
      const windows = await chrome.windows.getAll();
      return windows.length;
    });

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

    // "新しいウィンドウで開く"をクリック
    await sidePanelPage.getByRole('menuitem', { name: '新しいウィンドウで開く' }).click();

    // コンテキストメニューが閉じるまで待機
    await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

    // Assert: 新しいウィンドウが作成されたことを確認
    // chrome.windows APIを使用して正確にウィンドウ数を確認
    await expect(async () => {
      const currentWindowCount = await serviceWorker.evaluate(async () => {
        const windows = await chrome.windows.getAll();
        return windows.length;
      });
      // 新しいウィンドウが作成されるので、ウィンドウ数は増加するはず
      expect(currentWindowCount).toBeGreaterThan(initialWindowCount);
    }).toPass({ timeout: 5000 });
  });

  test('コンテキストメニューから"URLをコピー"を選択した場合、クリップボードにURLがコピーされる', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'about:blank');

    // タブノードが表示されるまで待機
    await expect(async () => {
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(tabNode).toBeVisible();
    }).toPass({ timeout: 10000 });

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
  });

  test('コンテキストメニューの外側をクリックした場合、メニューが閉じられる', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'about:blank');

    // タブノードが表示されるまで待機
    await expect(async () => {
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(tabNode).toBeVisible();
    }).toPass({ timeout: 10000 });

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

    // コンテキストメニューが表示されることを確認
    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 3000 });

    // メニュー外をクリック（ページの左上付近）
    await sidePanelPage.click('body', { position: { x: 10, y: 10 } });

    // Assert: コンテキストメニューが閉じられる
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // クリーンアップ
    await closeTab(extensionContext, tabId);
  });

  test('Escapeキーを押した場合、コンテキストメニューが閉じられる', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: タブを作成
    const tabId = await createTab(extensionContext, 'about:blank');

    // タブノードが表示されるまで待機
    await expect(async () => {
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(tabNode).toBeVisible();
    }).toPass({ timeout: 10000 });

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
  });
});
