/**
 * ピン留めタブセクションのE2Eテスト
 *
 * Task 12.3: ピン留めタブセクションのE2Eテストを追加する
 *
 * Requirements: 12.1, 12.2, 12.3, 12.4
 * - ピン留めタブが上部セクションに横並びで表示されることをテストする
 * - ピン留めタブクリックでタブがアクティブ化することをテストする
 * - ピン留めタブと通常タブの間に区切り線が表示されることをテストする
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';

test.describe('ピン留めタブセクション', () => {
  test.describe('基本的な表示 (Requirements 12.1, 12.2)', () => {
    test('ピン留めタブが上部セクションに横並びで表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 通常タブを作成
      const tabId = await createTab(extensionContext, 'https://example.com');

      // タブをピン留め
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      }, tabId);

      // ピン留め状態が更新されるまでポーリングで待機
      await serviceWorker.evaluate(async (tabId: number) => {
        for (let i = 0; i < 50; i++) {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (tab.pinned) {
              return;
            }
          } catch {
            // タブが存在しない場合は無視
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }, tabId);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めタブセクションが横並び表示であることを確認
      const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
      await expect(section).toBeVisible();
      await expect(section).toHaveClass(/flex/);

      // ピン留めタブが表示されることを確認
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTab).toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });

    test('複数のピン留めタブが横並びで表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 複数のタブを作成してピン留め
      const tabId1 = await createTab(extensionContext, 'https://example.com/1');
      const tabId2 = await createTab(extensionContext, 'https://example.com/2');

      // タブをピン留め
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      }, tabId1);
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      }, tabId2);

      // ピン留め状態が更新されるまで待機
      await serviceWorker.evaluate(async (tabIds: number[]) => {
        for (let i = 0; i < 50; i++) {
          let allPinned = true;
          for (const tabId of tabIds) {
            try {
              const tab = await chrome.tabs.get(tabId);
              if (!tab.pinned) {
                allPinned = false;
                break;
              }
            } catch {
              allPinned = false;
              break;
            }
          }
          if (allPinned) return;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }, [tabId1, tabId2]);

      // ピン留めタブセクションが表示されるまで待機
      await expect(async () => {
        const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
        await expect(section).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 両方のピン留めタブが表示されることを確認
      const pinnedTab1 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId1}"]`);
      const pinnedTab2 = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId2}"]`);
      await expect(pinnedTab1).toBeVisible();
      await expect(pinnedTab2).toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await closeTab(extensionContext, tabId2);
    });

    test('ピン留めを解除するとセクションから削除される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // タブを作成してピン留め
      const tabId = await createTab(extensionContext, 'https://example.com');

      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      }, tabId);

      // ピン留めタブが表示されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めを解除
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: false });
      }, tabId);

      // ピン留め解除状態が更新されるまで待機
      await serviceWorker.evaluate(async (tabId: number) => {
        for (let i = 0; i < 50; i++) {
          try {
            const tab = await chrome.tabs.get(tabId);
            if (!tab.pinned) {
              return;
            }
          } catch {
            // タブが存在しない場合は無視
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }, tabId);

      // ピン留めタブセクションから削除されることを確認
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).not.toBeVisible();
      }).toPass({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });
  });

  test.describe('クリック操作 (Requirement 12.2)', () => {
    test('ピン留めタブをクリックするとタブがアクティブ化する', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 2つのタブを作成（1つはピン留め、1つは通常）
      const pinnedTabId = await createTab(extensionContext, 'https://example.com/pinned', undefined, { active: false });
      const normalTabId = await createTab(extensionContext, 'https://example.com/normal', undefined, { active: true });

      // タブをピン留め
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      }, pinnedTabId);

      // ピン留めタブが表示されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 通常タブがアクティブであることを確認
      const initialActiveTab = await serviceWorker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id;
      });
      expect(initialActiveTab).toBe(normalTabId);

      // ピン留めタブをクリック
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${pinnedTabId}"]`);
      await pinnedTab.click();

      // ピン留めタブがアクティブになるまで待機
      await serviceWorker.evaluate(async (tabId: number) => {
        for (let i = 0; i < 50; i++) {
          const tab = await chrome.tabs.get(tabId);
          if (tab.active) {
            return;
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }, pinnedTabId);

      // ピン留めタブがアクティブになったことを確認
      const newActiveTab = await serviceWorker.evaluate(async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab?.id;
      });
      expect(newActiveTab).toBe(pinnedTabId);

      // クリーンアップ
      await closeTab(extensionContext, pinnedTabId);
      await closeTab(extensionContext, normalTabId);
    });
  });

  test.describe('区切り線の表示 (Requirements 12.3, 12.4)', () => {
    test('ピン留めタブと通常タブの間に区切り線が表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // タブを作成してピン留め
      const tabId = await createTab(extensionContext, 'https://example.com');

      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      }, tabId);

      // ピン留めタブが表示されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 区切り線が表示されることを確認
      const separator = sidePanelPage.locator('[data-testid="pinned-tabs-separator"]');
      await expect(separator).toBeVisible();

      // 区切り線がborder-bクラスを持つことを確認
      await expect(separator).toHaveClass(/border-b/);

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });

    test('ピン留めタブが0件の場合は区切り線も非表示になる', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 通常タブを作成（ピン留めなし）
      const tabId = await createTab(extensionContext, 'https://example.com');

      // ピン留めタブセクションが表示されないことを確認
      const section = sidePanelPage.locator('[data-testid="pinned-tabs-section"]');
      await expect(section).not.toBeVisible();

      // 区切り線も表示されないことを確認
      const separator = sidePanelPage.locator('[data-testid="pinned-tabs-separator"]');
      await expect(separator).not.toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });
  });

  test.describe('ピン留めタブとツリービューの統合', () => {
    test('ピン留めタブはピン留めセクションと通常ツリービューの両方に表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // タブを作成してピン留め
      const tabId = await createTab(extensionContext, 'https://example.com');

      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { pinned: true });
      }, tabId);

      // ピン留めタブセクションに表示されるまで待機
      await expect(async () => {
        const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
        await expect(pinnedTab).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ピン留めタブセクションに表示されることを確認
      const pinnedTab = sidePanelPage.locator(`[data-testid="pinned-tab-${tabId}"]`);
      await expect(pinnedTab).toBeVisible();

      // 通常のツリービューにも表示されていることを確認
      // （現在の実装では両方に表示される）
      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(treeNode).toBeVisible();

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });
  });
});
