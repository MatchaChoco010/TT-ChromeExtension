/**
 * ビューへの新規タブ追加のE2Eテスト
 *
 * テスト対象:
 * 1. ビューを開いている状態で新しいタブをそのビューに追加
 * 2. 新規タブ追加後もViewSwitcherが現在のビューを維持（ビューが閉じずに維持される）
 * 3. デフォルトビュー以外のビューでも新規タブが現在ビューに属する
 * 4. E2Eテストで検証可能であり、--repeat-each=10で10回連続成功
 * 5. ポーリングベースの状態確定待機を使用してフレーキーでないこと
 */

import { test, expect } from './fixtures/extension';
import { waitForViewSwitcher, waitForTabInTreeState, waitForCondition } from './utils/polling-utils';

test.describe('ビューへの新規タブ追加', () => {
  test.describe('ビューを開いている状態で新しいタブをそのビューに追加', () => {
    test('カスタムビューを開いている状態で新しいタブを開いた場合、そのビューに追加される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();

      // 新しいビューがアクティブになるまで待機
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // 新しいビューには「No tabs in this view」が表示されるはず
      const emptyMessage = sidePanelPage.locator('text=No tabs in this view');
      await expect(emptyMessage).toBeVisible({ timeout: 5000 });

      // Chrome APIを使って新しいタブを開く
      const newTabId = await sidePanelPage.evaluate(async () => {
        const tab = await chrome.tabs.create({ url: 'about:blank' });
        return tab.id;
      });

      expect(newTabId).toBeDefined();

      // 新しいタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId!);

      // 新しいタブがこのビューに表示されることを確認（空のメッセージが非表示になる）
      await expect(async () => {
        const treeItems = sidePanelPage.locator('[data-testid^="tree-node-"]');
        const count = await treeItems.count();
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      // 新しいタブがカスタムビューに属していることをストレージで確認
      const tabViewId = await serviceWorker.evaluate(async (tabId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          nodes: Record<string, { tabId: number; viewId: string }>;
          tabToNode: Record<number, string>;
        };
        const nodeId = treeState.tabToNode[tabId];
        if (nodeId && treeState.nodes[nodeId]) {
          return treeState.nodes[nodeId].viewId;
        }
        return null;
      }, newTabId!);

      // ビューIDが'default'ではないことを確認（カスタムビューに追加されている）
      expect(tabViewId).not.toBe('default');
      expect(tabViewId).toMatch(/^view_/);
    });
  });

  test.describe('新規タブ追加後もViewSwitcherが現在のビューを維持（ビューが閉じずに維持される）', () => {
    test('新しいタブを開いた後もビュースイッチャーは同じビューを表示し続ける', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();

      // 新しいビューがアクティブになるまで待機
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // 現在のビューを記録
      const currentViewIsActive = await newViewButton.getAttribute('data-active');
      expect(currentViewIsActive).toBe('true');

      // Chrome APIを使って新しいタブを開く
      const newTabId = await sidePanelPage.evaluate(async () => {
        const tab = await chrome.tabs.create({ url: 'about:blank' });
        return tab.id;
      });

      expect(newTabId).toBeDefined();

      // 新しいタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId!);

      // タブがツリーに表示されるまで待機（UIの反映を確認）
      await expect(async () => {
        const treeItems = sidePanelPage.locator('[data-testid^="tree-node-"]');
        const count = await treeItems.count();
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 10000 });

      // ビュースイッチャーが同じビューをアクティブに保っていることを確認
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // デフォルトビューがアクティブでないことを確認
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toHaveAttribute('data-active', 'false', { timeout: 5000 });
    });

    test('複数のタブを追加してもビュースイッチャーは同じビューを維持する', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // 3つのタブを順番に追加
      for (let i = 0; i < 3; i++) {
        const tabId = await sidePanelPage.evaluate(async () => {
          const tab = await chrome.tabs.create({ url: 'about:blank' });
          return tab.id;
        });

        if (tabId) {
          await waitForTabInTreeState(extensionContext, tabId);
        }
      }

      // ビュースイッチャーが同じビューをアクティブに保っていることを確認
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });
    });
  });

  test.describe('デフォルトビュー以外のビューでも新規タブが現在ビューに属する', () => {
    test('デフォルトビューで新しいタブを開いた場合、デフォルトビューに追加される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // デフォルトビューがアクティブであることを確認
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });

      // デフォルトビューをクリックしてアクティブにする
      await defaultViewButton.click();
      await expect(defaultViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // Chrome APIを使って新しいタブを開く
      const newTabId = await sidePanelPage.evaluate(async () => {
        const tab = await chrome.tabs.create({ url: 'about:blank' });
        return tab.id;
      });

      expect(newTabId).toBeDefined();

      // 新しいタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId!);

      // 新しいタブがデフォルトビューに属していることをストレージで確認
      const tabViewId = await serviceWorker.evaluate(async (tabId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          nodes: Record<string, { tabId: number; viewId: string }>;
          tabToNode: Record<number, string>;
        };
        const nodeId = treeState.tabToNode[tabId];
        if (nodeId && treeState.nodes[nodeId]) {
          return treeState.nodes[nodeId].viewId;
        }
        return null;
      }, newTabId!);

      expect(tabViewId).toBe('default');
    });

    test('カスタムビューAからカスタムビューBに切り替えた後、新しいタブはビューBに追加される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // ビューAを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // ビューAボタンが表示されるまで待機（最初のNew Viewボタン）
      const viewButtons = sidePanelPage.locator('[aria-label^="Switch to New View"]');
      await expect(viewButtons.first()).toBeVisible({ timeout: 5000 });

      // ビューBを追加
      await addButton.click();

      // 2つ目のビューボタンが表示されるまで待機
      await expect(async () => {
        const count = await viewButtons.count();
        expect(count).toBe(2);
      }).toPass({ timeout: 5000 });

      // ビューAに切り替え（最初のNew Viewボタン）
      const viewAButton = viewButtons.first();
      await viewAButton.click();
      await expect(viewAButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // ビューAのIDを取得
      const viewAId = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { currentViewId: string };
        return treeState.currentViewId;
      });

      // 2つ目のビューボタン（ビューB）を見つけて切り替え
      const viewBButton = viewButtons.nth(1);
      await viewBButton.click();
      await expect(viewBButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // ビューBのIDを取得
      const viewBId = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { currentViewId: string };
        return treeState.currentViewId;
      });

      // ビューAとビューBが異なることを確認
      expect(viewAId).not.toBe(viewBId);

      // Chrome APIを使って新しいタブを開く
      const newTabId = await sidePanelPage.evaluate(async () => {
        const tab = await chrome.tabs.create({ url: 'about:blank' });
        return tab.id;
      });

      expect(newTabId).toBeDefined();

      // 新しいタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId!);

      // 新しいタブがビューBに属していることをストレージで確認
      const tabViewId = await serviceWorker.evaluate(async (tabId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          nodes: Record<string, { tabId: number; viewId: string }>;
          tabToNode: Record<number, string>;
        };
        const nodeId = treeState.tabToNode[tabId];
        if (nodeId && treeState.nodes[nodeId]) {
          return treeState.nodes[nodeId].viewId;
        }
        return null;
      }, newTabId!);

      // 新しいタブがビューBに追加されていることを確認
      expect(tabViewId).toBe(viewBId);
      expect(tabViewId).not.toBe(viewAId);
    });
  });

  test.describe('E2Eテスト検証', () => {
    test('NewTabButtonを使用してカスタムビューに新規タブを追加できる', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      await waitForViewSwitcher(sidePanelPage);

      // 新しいビューを追加
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to New View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();
      await expect(newViewButton).toHaveAttribute('data-active', 'true', { timeout: 5000 });

      // 現在のビューIDを取得
      const currentViewId = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { currentViewId: string };
        return treeState.currentViewId;
      });

      // 新規タブ追加ボタンが表示されるまで待機
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });

      // 現在のタブ数を取得
      const initialTabCount = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.length;
      });

      // 新規タブ追加ボタンをクリック
      await newTabButton.click();

      // 新しいタブが作成されるまでポーリングで待機
      await waitForCondition(
        async () => {
          const currentTabCount = await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            return tabs.length;
          });
          return currentTabCount > initialTabCount;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );

      // 新しいタブのIDを取得
      const newTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true });
        return tabs[0]?.id;
      });

      expect(newTabId).toBeDefined();

      // 新しいタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId!);

      // 新しいタブが現在のビューに属していることを確認
      const tabViewId = await serviceWorker.evaluate(async (tabId: number) => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as {
          nodes: Record<string, { tabId: number; viewId: string }>;
          tabToNode: Record<number, string>;
        };
        const nodeId = treeState.tabToNode[tabId];
        if (nodeId && treeState.nodes[nodeId]) {
          return treeState.nodes[nodeId].viewId;
        }
        return null;
      }, newTabId!);

      expect(tabViewId).toBe(currentViewId);
    });
  });
});
