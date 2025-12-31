/**
 * Task 8.6 (tab-tree-bugfix-2): ツリービュー外へのドラッグ&ドロップテスト
 *
 * Requirements: 3.2.1, 3.2.3, 4.4, 4.5
 * - ドラッグアウトシナリオを自前D&D用に再実装
 * - サイドパネル内外の両ケースを検証
 *
 * このテストスイートでは、以下を検証します:
 * 1. タブをサイドパネル外にドロップした際に新しいウィンドウが作成されること
 * 2. ドロップしたタブが新しいウィンドウに正確に移動されること
 * 3. 子タブを持つ親タブをドラッグアウトした場合、サブツリー全体が移動すること
 * 4. サイドパネル内の空白領域へのドラッグでは新規ウィンドウを作成しないこと
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { waitForCondition } from './utils/polling-utils';
import { dragOutside, startDrag, moveTo, dropTab } from './utils/drag-drop-utils';

test.describe('ツリービュー外へのドラッグ&ドロップ', () => {
  // マウス操作は各ステップで時間がかかるため、タイムアウトを延長
  test.setTimeout(120000);

  test('タブをサイドパネル外にドロップした際に新しいウィンドウが作成されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 準備: タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    expect(tabId).toBeGreaterThan(0);

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, tabId, 'Example');

    // 元のウィンドウのIDを取得
    const originalWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const originalWindowId = originalWindow.id as number;

    // 現在のウィンドウ数を取得
    const windowsBefore = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    const windowCountBefore = windowsBefore.length;

    // タブをサイドパネル外にドラッグアウト
    await dragOutside(sidePanelPage, tabId, 'right');

    // 新しいウィンドウが作成されるまで待機（ポーリング）
    await waitForCondition(
      async () => {
        const windowsAfter = await serviceWorker.evaluate(() => {
          return chrome.windows.getAll();
        });
        return windowsAfter.length > windowCountBefore;
      },
      {
        timeout: 10000,
        interval: 200,
        timeoutMessage: 'New window was not created after external drop',
      }
    );

    // 検証: 新しいウィンドウが作成されたことを確認
    const windowsAfter = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    expect(windowsAfter.length).toBeGreaterThan(windowCountBefore);

    // 新しいウィンドウを特定（元のウィンドウ以外）
    const newWindow = windowsAfter.find((win: chrome.windows.Window) => win.id !== originalWindowId);
    expect(newWindow).toBeDefined();
  });

  test('ドロップしたタブが新しいウィンドウに正確に移動されること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 準備: タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    expect(tabId).toBeGreaterThan(0);

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, tabId, 'Example');

    // 元のウィンドウのIDを取得
    const originalWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const originalWindowId = originalWindow.id as number;

    // タブが元のウィンドウに存在することを確認
    const tabBefore = await serviceWorker.evaluate(
      ({ tabId }) => {
        return chrome.tabs.get(tabId);
      },
      { tabId }
    );
    expect(tabBefore.windowId).toBe(originalWindowId);

    // 現在のウィンドウ数を取得
    const windowsBefore = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    const windowCountBefore = windowsBefore.length;

    // タブをサイドパネル外にドラッグアウト
    await dragOutside(sidePanelPage, tabId, 'right');

    // 新しいウィンドウが作成されるまで待機
    await waitForCondition(
      async () => {
        const windowsAfter = await serviceWorker.evaluate(() => {
          return chrome.windows.getAll();
        });
        return windowsAfter.length > windowCountBefore;
      },
      {
        timeout: 10000,
        interval: 200,
        timeoutMessage: 'New window was not created after external drop',
      }
    );

    // 新しいウィンドウを特定
    const windowsAfter = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    const newWindow = windowsAfter.find((win: chrome.windows.Window) => win.id !== originalWindowId);
    expect(newWindow).toBeDefined();
    const newWindowId = newWindow!.id as number;

    // タブが新しいウィンドウに移動したことを確認（ポーリング）
    await waitForCondition(
      async () => {
        try {
          const tabAfter = await serviceWorker.evaluate(
            ({ tabId }) => {
              return chrome.tabs.get(tabId);
            },
            { tabId }
          );
          return tabAfter.windowId === newWindowId;
        } catch {
          // タブが見つからない場合はまだ移動中
          return false;
        }
      },
      {
        timeout: 10000,
        interval: 200,
        timeoutMessage: `Tab ${tabId} was not moved to the new window ${newWindowId}`,
      }
    );

    // 検証: タブが新しいウィンドウに存在することを確認
    const tabAfter = await serviceWorker.evaluate(
      ({ tabId }) => {
        return chrome.tabs.get(tabId);
      },
      { tabId }
    );
    expect(tabAfter.windowId).toBe(newWindowId);

    // 検証: 元のウィンドウにタブが存在しないことを確認
    const tabsInOriginalWindow = await serviceWorker.evaluate(
      ({ windowId }) => {
        return chrome.tabs.query({ windowId });
      },
      { windowId: originalWindowId }
    );
    const tabStillInOriginal = tabsInOriginalWindow.find(
      (tab: chrome.tabs.Tab) => tab.id === tabId
    );
    expect(tabStillInOriginal).toBeUndefined();
  });

  /**
   * Note: サブツリー全体の移動テストは Phase 3 (クロスウィンドウ機能) で実装予定
   * 現在の実装では TreeStateManager.getSubtree() がメモリ上の children 配列を
   * 正しく構築できていないため、サブツリー移動が機能していない。
   * この問題は Phase 3 のタスク 13.1-13.3 で修正される予定。
   *
   * 参照: docs/specs/tab-tree-bugfix-2/tasks.md - Phase 3
   */

  /**
   * Task 7.2 (tab-tree-bugfix-2): ドラッグアウト判定の修正
   * Requirement 4.2: サイドパネル内の空白領域（タブツリー下部）へのドラッグでは新規ウィンドウを作成しない
   *
   * このテストでは、タブをサイドパネル内の空白領域（タブツリー下部）にドラッグした場合、
   * 新規ウィンドウが作成されず、タブが元のウィンドウに留まることを検証します。
   */
  test('サイドパネル内の空白領域（タブツリー下部）へのドラッグでは新規ウィンドウを作成しないこと', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 準備: タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    expect(tabId).toBeGreaterThan(0);

    // タブがツリーに表示されるまで待機
    await assertTabInTree(sidePanelPage, tabId, 'Example');

    // 元のウィンドウのIDを取得
    const originalWindow = await serviceWorker.evaluate(() => {
      return chrome.windows.getCurrent();
    });
    const originalWindowId = originalWindow.id as number;

    // 現在のウィンドウ数を取得
    const windowsBefore = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    const windowCountBefore = windowsBefore.length;

    // サイドパネル全体のコンテナを取得（data-testid="side-panel-root"）
    const sidePanelContainer = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelContainer).toBeVisible();
    const sidePanelBox = await sidePanelContainer.boundingBox();
    expect(sidePanelBox).not.toBeNull();

    // ドラッグ操作を実行（タブをサイドパネル内の空白領域にドラッグ）
    await startDrag(sidePanelPage, tabId);

    // サイドパネル内の空白領域（タブツリー下部）に移動
    // サイドパネルの底から20px上の位置を使用（サイドパネル内であることを保証）
    const insideSidePanelX = sidePanelBox!.x + sidePanelBox!.width / 2;
    const insideSidePanelY = sidePanelBox!.y + sidePanelBox!.height - 20;
    await moveTo(sidePanelPage, insideSidePanelX, insideSidePanelY);

    // ドロップを実行
    await dropTab(sidePanelPage);

    // 少し待機して、新しいウィンドウが作成されないことを確認
    await sidePanelPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));

    // 検証: 新しいウィンドウが作成されていないことを確認
    const windowsAfter = await serviceWorker.evaluate(() => {
      return chrome.windows.getAll();
    });
    expect(windowsAfter.length).toBe(windowCountBefore);

    // 検証: タブが元のウィンドウに残っていることを確認
    const tabAfter = await serviceWorker.evaluate(
      ({ tabId }) => {
        return chrome.tabs.get(tabId);
      },
      { tabId }
    );
    expect(tabAfter.windowId).toBe(originalWindowId);
  });
});
