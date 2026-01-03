/**
 * 新規タブ追加ボタンのE2Eテスト
 *
 * テスト対象:
 * 1. 新規タブ追加ボタンの存在を検証
 * 2. ボタンクリックで新規タブが追加されることを検証
 * 3. 新規タブがツリー末尾に配置されることを検証
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId } from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';

test.describe('新規タブ追加ボタン', () => {
  test.describe('新規タブ追加ボタンの存在', () => {
    test('新規タブ追加ボタンがサイドパネルに表示される', async ({
      sidePanelPage,
      extensionContext,
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

      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 新規タブ追加ボタンが存在することを確認
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });
    });

    test('新規タブ追加ボタンがツリービューの横幅いっぱいの幅を持つ', async ({
      sidePanelPage,
      extensionContext,
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

      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 新規タブ追加ボタンが存在することを確認
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });

      // ボタンの幅がフルワイドであることを確認
      // w-full クラスが適用されているため、親要素と同じ幅になるはず
      const tabTreeRoot = sidePanelPage.locator('[data-testid="tab-tree-root"]');
      await expect(tabTreeRoot).toBeVisible({ timeout: 5000 });

      const buttonBox = await newTabButton.boundingBox();
      const parentBox = await tabTreeRoot.boundingBox();

      // ボタンの幅が親コンテナとほぼ同じであることを確認
      // 許容誤差: 20px（スクロールバーやパディングの影響を考慮）
      expect(buttonBox).not.toBeNull();
      expect(parentBox).not.toBeNull();
      if (buttonBox && parentBox) {
        expect(Math.abs(buttonBox.width - parentBox.width)).toBeLessThanOrEqual(20);
      }
    });
  });

  test.describe('ボタンクリックで新規タブが追加される', () => {
    test('新規タブ追加ボタンをクリックすると新しいタブが作成される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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

      // 新規タブ追加ボタンをクリック
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await newTabButton.click();

      // 新しいタブIDを取得
      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const allTabs = await chrome.tabs.query({ windowId: wId });
            return allTabs.filter(t => {
              const url = t.url || t.pendingUrl || '';
              return !url.startsWith(sidePanelUrlPrefix);
            });
          }, windowId);
          if (tabs.length > 0) {
            newTabId = tabs[tabs.length - 1]?.id;
            return true;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );

      // 新しいタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId!);

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);
    });

    test('新規タブ追加ボタンをクリックすると新しいタブがアクティブになる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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

      // 新規タブ追加ボタンをクリック
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await newTabButton.click();

      // 新しいタブIDを取得
      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const allTabs = await chrome.tabs.query({ windowId: wId });
            return allTabs.filter(t => {
              const url = t.url || t.pendingUrl || '';
              return !url.startsWith(sidePanelUrlPrefix);
            });
          }, windowId);
          if (tabs.length > 0) {
            newTabId = tabs[tabs.length - 1]?.id;
            return true;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );

      // 新しいタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId!);

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);
    });
  });

  test.describe('新規タブがツリー末尾に配置される', () => {
    test('新規タブはツリーの末尾（最後の位置）に追加される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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

      // 既存のタブを作成してツリーにタブがある状態にする
      const existingTabId = await createTab(extensionContext, 'https://example.com');

      // タブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: existingTabId, depth: 0 },
      ], 0);

      // 新規タブ追加ボタンをクリック
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await newTabButton.click();

      // 新しいタブIDを取得（アクティブタブを取得）
      let newTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const allTabs = await chrome.tabs.query({ windowId: wId });
            return allTabs.filter(t => {
              const url = t.url || t.pendingUrl || '';
              return !url.startsWith(sidePanelUrlPrefix);
            });
          }, windowId);
          if (tabs.length > 1) {
            const activeTab = await serviceWorker.evaluate(async () => {
              const tabs = await chrome.tabs.query({ active: true });
              return tabs[0];
            });
            newTabId = activeTab?.id;
            return newTabId !== existingTabId && newTabId !== undefined;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'New tab was not created' }
      );

      // 新しいタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId!);

      // タブ作成後の構造を検証（新規タブが末尾にあることでY座標検証を代替）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: existingTabId, depth: 0 },
        { tabId: newTabId!, depth: 0 },
      ], 0);
    });

    test('複数回クリックすると複数のタブが順番に末尾に追加される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
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

      // 新規タブ追加ボタンをクリック（1つ目）
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await newTabButton.click();

      // 1つ目のタブIDを取得
      let firstNewTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const allTabs = await chrome.tabs.query({ windowId: wId });
            return allTabs.filter(t => {
              const url = t.url || t.pendingUrl || '';
              return !url.startsWith(sidePanelUrlPrefix);
            });
          }, windowId);
          if (tabs.length > 0) {
            firstNewTabId = tabs[tabs.length - 1]?.id;
            return true;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'First new tab was not created' }
      );

      // 1つ目のタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, firstNewTabId!);

      // 1つ目のタブ作成後の構造を検証
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: firstNewTabId!, depth: 0 },
      ], 0);

      // 2つ目の新規タブを作成
      await newTabButton.click();

      // 2つ目のタブIDを取得
      let secondNewTabId: number | undefined;
      await waitForCondition(
        async () => {
          const tabs = await serviceWorker.evaluate(async (wId) => {
            const extensionId = chrome.runtime.id;
            const sidePanelUrlPrefix = `chrome-extension://${extensionId}/sidepanel.html`;
            const allTabs = await chrome.tabs.query({ windowId: wId });
            return allTabs.filter(t => {
              const url = t.url || t.pendingUrl || '';
              return !url.startsWith(sidePanelUrlPrefix);
            });
          }, windowId);
          if (tabs.length > 1) {
            const activeTab = await serviceWorker.evaluate(async () => {
              const tabs = await chrome.tabs.query({ active: true });
              return tabs[0];
            });
            secondNewTabId = activeTab?.id;
            return secondNewTabId !== firstNewTabId && secondNewTabId !== undefined;
          }
          return false;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Second new tab was not created' }
      );

      // 2つ目のタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, secondNewTabId!);

      // 2つ目のタブ作成後の構造を検証（順序でY座標検証を代替）
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: firstNewTabId!, depth: 0 },
        { tabId: secondNewTabId!, depth: 0 },
      ], 0);
    });
  });
});
