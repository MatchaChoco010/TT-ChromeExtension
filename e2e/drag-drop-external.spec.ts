/**
 * ツリービュー外へのドラッグ&ドロップテスト
 *
 * Requirement 9: ツリービュー外へのドラッグ&ドロップ
 * - 9.1: タブをツリービューの外にドラッグした時、ツリービュー外へのドラッグを検知する
 * - 9.2: タブをツリービューの外でドロップした時、新しいブラウザウィンドウを作成する
 * - 9.3: タブをツリービューの外でドロップした時、ドロップしたタブを新しいウィンドウに移動する
 * - 9.4: dnd-kit標準のドロップ検知に依存せず、マウス位置によるツリービュー外へのドロップを確実に検知する
 *
 * このテストスイートでは、以下を検証します:
 * 1. タブをツリービュー外にドロップした際に新しいウィンドウが作成されることを検証
 * 2. ドロップしたタブが新しいウィンドウに正確に移動されることを検証
 *
 * Note: ヘッドレスモードで実行すること（npm run test:e2e）
 */
import { test, expect } from './fixtures/extension';
import { createTab, assertTabInTree } from './utils/tab-utils';
import { waitForCondition } from './utils/polling-utils';

test.describe('ツリービュー外へのドラッグ&ドロップ', () => {
  // Playwrightのmouse操作は各ステップで時間がかかるため、タイムアウトを延長
  test.setTimeout(120000);

  test('タブをツリービュー外にドロップした際に新しいウィンドウが作成されること', async ({
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

    // ツリービューのコンテナを取得
    const treeContainer = sidePanelPage.locator('[data-testid="tab-tree-root"]');
    await expect(treeContainer).toBeVisible();
    const containerBox = await treeContainer.boundingBox();
    expect(containerBox).not.toBeNull();

    // タブノードを取得
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
    await expect(tabNode).toBeVisible();
    const nodeBox = await tabNode.boundingBox();
    expect(nodeBox).not.toBeNull();

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // ドラッグ操作を実行（タブをツリービューの外にドラッグ）
    // 1. マウスをタブノードの中央に移動
    const startX = nodeBox!.x + nodeBox!.width / 2;
    const startY = nodeBox!.y + nodeBox!.height / 2;
    await sidePanelPage.mouse.move(startX, startY, { steps: 1 });

    // 2. マウスボタンを押下
    await sidePanelPage.mouse.down();

    // 3. dnd-kitのMouseSensorはdistance: 8を要求するため、まず8px以上移動
    await sidePanelPage.mouse.move(startX + 15, startY, { steps: 3 });

    // 4. ドラッグ状態が確立されるまで待機
    await sidePanelPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));

    // 5. ツリービューの外にドラッグ（右側に移動）
    // containerBoxの右端より右、またはサイドパネルの端より外側に移動
    const outsideX = containerBox!.x + containerBox!.width + 100;
    const outsideY = startY;
    await sidePanelPage.mouse.move(outsideX, outsideY, { steps: 5 });

    // 6. ドロップ状態を安定させるために少し待機
    await sidePanelPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));

    // 7. マウスをリリースしてドロップ
    await sidePanelPage.mouse.up();

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

    // ツリービューのコンテナを取得
    const treeContainer = sidePanelPage.locator('[data-testid="tab-tree-root"]');
    await expect(treeContainer).toBeVisible();
    const containerBox = await treeContainer.boundingBox();
    expect(containerBox).not.toBeNull();

    // タブノードを取得
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`).first();
    await expect(tabNode).toBeVisible();
    const nodeBox = await tabNode.boundingBox();
    expect(nodeBox).not.toBeNull();

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // ドラッグ操作を実行（タブをツリービューの外にドラッグ）
    const startX = nodeBox!.x + nodeBox!.width / 2;
    const startY = nodeBox!.y + nodeBox!.height / 2;
    await sidePanelPage.mouse.move(startX, startY, { steps: 1 });
    await sidePanelPage.mouse.down();
    await sidePanelPage.mouse.move(startX + 15, startY, { steps: 3 });
    await sidePanelPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));

    // ツリービューの外にドラッグ
    const outsideX = containerBox!.x + containerBox!.width + 100;
    const outsideY = startY;
    await sidePanelPage.mouse.move(outsideX, outsideY, { steps: 5 });
    await sidePanelPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
    await sidePanelPage.mouse.up();

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

  test('子タブを持つ親タブをツリービュー外にドロップした場合、サブツリー全体が新しいウィンドウに移動すること', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // 準備: 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com');
    expect(parentTabId).toBeGreaterThan(0);
    await assertTabInTree(sidePanelPage, parentTabId, 'Example');

    // 子タブを作成（親タブから開いたタブ）
    const childTabId = await createTab(extensionContext, 'https://www.iana.org', parentTabId);
    expect(childTabId).toBeGreaterThan(0);

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

    // ツリービューのコンテナを取得
    const treeContainer = sidePanelPage.locator('[data-testid="tab-tree-root"]');
    await expect(treeContainer).toBeVisible();
    const containerBox = await treeContainer.boundingBox();
    expect(containerBox).not.toBeNull();

    // 親タブノードを取得
    const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`).first();
    await expect(parentNode).toBeVisible();
    const nodeBox = await parentNode.boundingBox();
    expect(nodeBox).not.toBeNull();

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    // ドラッグ操作を実行（親タブをツリービューの外にドラッグ）
    const startX = nodeBox!.x + nodeBox!.width / 2;
    const startY = nodeBox!.y + nodeBox!.height / 2;
    await sidePanelPage.mouse.move(startX, startY, { steps: 1 });
    await sidePanelPage.mouse.down();
    await sidePanelPage.mouse.move(startX + 15, startY, { steps: 3 });
    await sidePanelPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));

    // ツリービューの外にドラッグ
    const outsideX = containerBox!.x + containerBox!.width + 100;
    const outsideY = startY;
    await sidePanelPage.mouse.move(outsideX, outsideY, { steps: 5 });
    await sidePanelPage.evaluate(() => new Promise(resolve => setTimeout(resolve, 100)));
    await sidePanelPage.mouse.up();

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

    // 親タブが新しいウィンドウに移動したことを確認（ポーリング）
    await waitForCondition(
      async () => {
        try {
          const parentTab = await serviceWorker.evaluate(
            ({ tabId }) => {
              return chrome.tabs.get(tabId);
            },
            { tabId: parentTabId }
          );
          return parentTab.windowId === newWindowId;
        } catch {
          return false;
        }
      },
      {
        timeout: 10000,
        interval: 200,
        timeoutMessage: `Parent tab ${parentTabId} was not moved to the new window`,
      }
    );

    // 検証: 親タブが新しいウィンドウに存在することを確認
    const parentTabAfter = await serviceWorker.evaluate(
      ({ tabId }) => {
        return chrome.tabs.get(tabId);
      },
      { tabId: parentTabId }
    );
    expect(parentTabAfter.windowId).toBe(newWindowId);

    // 検証: 子タブも新しいウィンドウに移動したことを確認（サブツリー全体の移動）
    // Note: CREATE_WINDOW_WITH_SUBTREEメッセージはサブツリーごと移動する実装
    await waitForCondition(
      async () => {
        try {
          const childTab = await serviceWorker.evaluate(
            ({ tabId }) => {
              return chrome.tabs.get(tabId);
            },
            { tabId: childTabId }
          );
          return childTab.windowId === newWindowId;
        } catch {
          return false;
        }
      },
      {
        timeout: 10000,
        interval: 200,
        timeoutMessage: `Child tab ${childTabId} was not moved to the new window`,
      }
    );

    const childTabAfter = await serviceWorker.evaluate(
      ({ tabId }) => {
        return chrome.tabs.get(tabId);
      },
      { tabId: childTabId }
    );
    expect(childTabAfter.windowId).toBe(newWindowId);
  });
});
