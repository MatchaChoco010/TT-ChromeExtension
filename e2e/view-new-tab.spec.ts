import { test, expect } from './fixtures/extension';
import { waitForViewSwitcher, waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import { assertTabStructure, assertViewStructure } from './utils/assertion-utils';
import {
  createTab,
  closeTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
  getTestServerUrl,
} from './utils/tab-utils';

test.describe('ビューへの新規タブ追加', () => {
  test.describe('ビューを開いている状態で新しいタブをそのビューに追加', () => {
    test('カスタムビューを開いている状態で新しいタブを開いた場合、そのビューに追加される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // テスト初期化: windowIdと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（デフォルトビュー: index 0）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);

      // ビュー追加ボタンの可視性確認（UI操作前確認）
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });

      // 新しいビューを追加
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();

      // 新しいビューがアクティブになったことをassertViewStructureで検証
      // デフォルトビュー(#3B82F6)と新規ビュー(#10B981)が存在し、新規ビュー(index 1)がアクティブ
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      // 新しいビューには「No tabs in this view」が表示されるはず（UI状態確認）
      const emptyMessage = sidePanelPage.locator('text=No tabs in this view');
      await expect(emptyMessage).toBeVisible({ timeout: 5000 });

      // createTab関数を使って新しいタブを作成
      const newTabId = await createTab(extensionContext, getTestServerUrl('/page'));

      // タブ作成直後にassertTabStructureで検証
      // pseudoSidePanelTabIdはデフォルトビュー(index 0)に残り、
      // 新しいタブだけがカスタムビュー(index 1)に追加される
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);

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
      }, newTabId);

      // ビューIDが'default'ではないことを確認（カスタムビューに追加されている）
      expect(tabViewId).not.toBe('default');
      expect(tabViewId).toMatch(/^view_/);
    });
  });

  test.describe('新規タブ追加後もViewSwitcherが現在のビューを維持（ビューが閉じずに維持される）', () => {
    test('新しいタブを開いた後もビュースイッチャーは同じビューを表示し続ける', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // テスト初期化: windowIdと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（デフォルトビュー: index 0）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);

      // ビュー追加ボタンの可視性確認（UI操作前確認）
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });

      // 新しいビューを追加
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();

      // 新しいビューがアクティブになったことをassertViewStructureで検証
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      // createTab関数を使って新しいタブを作成
      const newTabId = await createTab(extensionContext, getTestServerUrl('/page'));

      // タブ作成直後にassertTabStructureで検証（ビューindex 1が維持されていることも確認）
      // pseudoSidePanelTabIdはデフォルトビュー(index 0)に残り、新しいタブだけがカスタムビュー(index 1)に追加される
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);

      // タブ追加後もビュー構造が維持されていることを検証
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);
    });

    test('複数のタブを追加してもビュースイッチャーは同じビューを維持する', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // テスト初期化: windowIdと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（デフォルトビュー: index 0）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);

      // ビュー追加ボタンの可視性確認（UI操作前確認）
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });

      // 新しいビューを追加
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();

      // 新しいビューがアクティブになったことをassertViewStructureで検証
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      // 3つのタブを順番に追加（各タブ作成直後にassertTabStructure）
      // pseudoSidePanelTabIdはデフォルトビュー(index 0)に残るため、新しいビュー(index 1)には含まれない
      const tab1 = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab1, depth: 0 },
      ], 1);

      const tab2 = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
      ], 1);

      const tab3 = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: tab1, depth: 0 },
        { tabId: tab2, depth: 0 },
        { tabId: tab3, depth: 0 },
      ], 1);

      // 複数タブ追加後もビュー構造が維持されていることを検証
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);
    });
  });

  test.describe('デフォルトビュー以外のビューでも新規タブが現在ビューに属する', () => {
    test('デフォルトビューで新しいタブを開いた場合、デフォルトビューに追加される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // テスト初期化: windowIdと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（デフォルトビュー: index 0）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);

      // デフォルトビューボタンの可視性確認（UI操作前確認）
      const defaultViewButton = sidePanelPage.locator(
        '[aria-label="Switch to Default view"]'
      );
      await expect(defaultViewButton).toBeVisible({ timeout: 5000 });

      // デフォルトビューをクリックしてアクティブにする
      await defaultViewButton.click();

      // デフォルトビューがアクティブであることをassertViewStructureで検証
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
      ], 0);

      // createTab関数を使って新しいタブを作成
      const newTabId = await createTab(extensionContext, getTestServerUrl('/page'));

      // タブ作成直後にassertTabStructureで検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: newTabId, depth: 0 },
      ], 0);

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
      }, newTabId);

      expect(tabViewId).toBe('default');
    });

    test('カスタムビューAからカスタムビューBに切り替えた後、新しいタブはビューBに追加される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // テスト初期化: windowIdと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（デフォルトビュー: index 0）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);

      // ビュー追加ボタンの可視性確認（UI操作前確認）
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });

      // ビューAを追加
      await addButton.click();

      // ビューA追加後のビュー構造を検証（デフォルト + ビューA、デフォルトがアクティブのまま）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 0);

      // ビューBを追加
      await addButton.click();

      // ビューB追加後のビュー構造を検証（デフォルト + ビューA + ビューB）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
        { viewIdentifier: '#F59E0B' },
      ], 0);

      // ビューAに切り替え
      const viewButtons = sidePanelPage.locator('[aria-label^="Switch to View"]');
      const viewAButton = viewButtons.first();
      await viewAButton.click();

      // ビューAがアクティブになったことを検証（index 1）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
        { viewIdentifier: '#F59E0B' },
      ], 1);

      // ビューAのIDを取得
      const viewAId = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { currentViewId: string };
        return treeState.currentViewId;
      });

      // ビューBに切り替え
      const viewBButton = viewButtons.nth(1);
      await viewBButton.click();

      // ビューBがアクティブになったことを検証（index 2）
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
        { viewIdentifier: '#F59E0B' },
      ], 2);

      // ビューBのIDを取得
      const viewBId = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { currentViewId: string };
        return treeState.currentViewId;
      });

      // ビューAとビューBが異なることを確認（ビジネスロジックの検証）
      expect(viewAId).not.toBe(viewBId);

      // createTab関数を使って新しいタブを作成
      const newTabId = await createTab(extensionContext, getTestServerUrl('/page'));

      // タブ作成直後にassertTabStructureで検証
      // pseudoSidePanelTabIdはデフォルトビュー(index 0)に残るため、ビューB(index 2)には含まれない
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 2);

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
      }, newTabId);

      // 新しいタブがビューBに追加されていることを確認（ビジネスロジックの検証）
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
      // テスト初期化: windowIdと擬似サイドパネルタブIDを取得
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      // ブラウザ起動時のデフォルトタブを閉じる
      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);

      // 初期状態を検証（デフォルトビュー: index 0）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForViewSwitcher(sidePanelPage);

      // ビュー追加ボタンの可視性確認（UI操作前確認）
      const addButton = sidePanelPage.locator('[aria-label="Add new view"]');
      await expect(addButton).toBeVisible({ timeout: 5000 });

      // 新しいビューを追加
      await addButton.click();

      // 新しいビューボタンが表示されるまで待機
      const newViewButton = sidePanelPage.locator(
        '[aria-label="Switch to View view"]'
      );
      await expect(newViewButton).toBeVisible({ timeout: 5000 });

      // 新しいビューに切り替え
      await newViewButton.click();

      // 新しいビューがアクティブになったことをassertViewStructureで検証
      await assertViewStructure(sidePanelPage, windowId, [
        { viewIdentifier: '#3B82F6' },
        { viewIdentifier: '#10B981' },
      ], 1);

      // 現在のビューIDを取得
      const currentViewId = await serviceWorker.evaluate(async () => {
        const result = await chrome.storage.local.get('tree_state');
        const treeState = result.tree_state as { currentViewId: string };
        return treeState.currentViewId;
      });

      // 新規タブ追加ボタンの可視性確認（UI操作前確認）
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

      // newTabIdがundefinedの場合はテスト失敗
      if (!newTabId) {
        throw new Error('New tab ID is undefined');
      }

      // 新しいタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId);

      // タブ作成直後にassertTabStructureで検証
      // pseudoSidePanelTabIdはデフォルトビュー(index 0)に残るため、カスタムビュー(index 1)には含まれない
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: newTabId, depth: 0 },
      ], 1);

      // 新しいタブが現在のビューに属していることを確認（ビジネスロジックの検証）
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
      }, newTabId);

      expect(tabViewId).toBe(currentViewId);
    });
  });
});
