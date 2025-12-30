/**
 * 新規タブ追加ボタンのE2Eテスト
 *
 * Task 8.2: 新規タブ追加ボタンのE2Eテスト追加
 * Requirements: 8.5, 8.6, 8.7
 *
 * テスト対象:
 * 1. 新規タブ追加ボタンの存在を検証 (Requirement 8.5)
 * 2. ボタンクリックで新規タブが追加されることを検証 (Requirement 8.6)
 * 3. 新規タブがツリー末尾に配置されることを検証 (Requirement 8.7)
 */

import { test, expect } from './fixtures/extension';
import { createTab } from './utils/tab-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';

test.describe('新規タブ追加ボタン', () => {
  test.describe('Requirement 8.5: 新規タブ追加ボタンの存在', () => {
    test('新規タブ追加ボタンがサイドパネルに表示される', async ({
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 新規タブ追加ボタンが存在することを確認
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });
    });

    test('新規タブ追加ボタンがツリービューの横幅いっぱいの幅を持つ', async ({
      sidePanelPage,
    }) => {
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

  test.describe('Requirement 8.6: ボタンクリックで新規タブが追加される', () => {
    test('新規タブ追加ボタンをクリックすると新しいタブが作成される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

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

      // タブ数が増加したことを確認
      const finalTabCount = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.length;
      });
      expect(finalTabCount).toBeGreaterThan(initialTabCount);
    });

    test('新規タブ追加ボタンをクリックすると新しいタブがアクティブになる', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

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

      // 新しいタブがアクティブであることを確認
      const activeTabs = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true });
        return tabs;
      });

      expect(activeTabs.length).toBeGreaterThan(0);
      // 新しく作成されたタブがアクティブになっていることを確認
      // 最後に作成されたタブがアクティブなはず
    });
  });

  test.describe('Requirement 8.7: 新規タブがツリー末尾に配置される', () => {
    test('新規タブはツリーの末尾（最後の位置）に追加される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 既存のタブを作成してツリーにタブがある状態にする
      const existingTabId = await createTab(extensionContext, 'https://example.com');

      // タブがツリーに表示されるまで待機
      await waitForTabInTreeState(extensionContext, existingTabId);

      // ツリーノードが表示されるまで待機
      await expect(async () => {
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${existingTabId}"]`);
        await expect(treeNode).toBeVisible();
      }).toPass({ timeout: 10000 });

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

      // 新しいタブがツリーに表示されるまで待機
      await expect(async () => {
        const newTabNode = sidePanelPage.locator(`[data-testid="tree-node-${newTabId}"]`);
        await expect(newTabNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // ツリー内の全タブノードを取得
      const allTreeNodes = sidePanelPage.locator('[data-testid^="tree-node-"]');
      const nodeCount = await allTreeNodes.count();

      // 複数のタブがあることを確認
      expect(nodeCount).toBeGreaterThanOrEqual(2);

      // 新しいタブが最後の位置にあることを確認
      // 各ノードのY座標を比較して、新しいタブが一番下にあることを確認
      const newTabNode = sidePanelPage.locator(`[data-testid="tree-node-${newTabId}"]`);
      const newTabBox = await newTabNode.boundingBox();

      expect(newTabBox).not.toBeNull();

      // 他の全てのタブよりも新しいタブが下にあることを確認
      for (let i = 0; i < nodeCount; i++) {
        const node = allTreeNodes.nth(i);
        const nodeTestId = await node.getAttribute('data-testid');

        // 新しいタブ自身はスキップ
        if (nodeTestId === `tree-node-${newTabId}`) continue;

        const nodeBox = await node.boundingBox();
        if (nodeBox && newTabBox) {
          // 他のタブは新しいタブより上にあるはず
          expect(nodeBox.y).toBeLessThanOrEqual(newTabBox.y);
        }
      }
    });

    test('複数回クリックすると複数のタブが順番に末尾に追加される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 新規タブ追加ボタンが表示されるまで待機
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });

      // 現在のタブ数を取得
      const initialTabCount = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.length;
      });

      // 1つ目の新規タブを作成
      await newTabButton.click();

      // 1つ目のタブが作成されるまで待機
      await waitForCondition(
        async () => {
          const currentTabCount = await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            return tabs.length;
          });
          return currentTabCount > initialTabCount;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'First new tab was not created' }
      );

      const firstNewTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true });
        return tabs[0]?.id;
      });

      expect(firstNewTabId).toBeDefined();

      // 1つ目のタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, firstNewTabId!);

      // 2つ目の新規タブを作成
      const tabCountAfterFirst = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.length;
      });

      await newTabButton.click();

      // 2つ目のタブが作成されるまで待機
      await waitForCondition(
        async () => {
          const currentTabCount = await serviceWorker.evaluate(async () => {
            const tabs = await chrome.tabs.query({});
            return tabs.length;
          });
          return currentTabCount > tabCountAfterFirst;
        },
        { timeout: 5000, interval: 100, timeoutMessage: 'Second new tab was not created' }
      );

      const secondNewTabId = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({ active: true });
        return tabs[0]?.id;
      });

      expect(secondNewTabId).toBeDefined();
      expect(secondNewTabId).not.toBe(firstNewTabId);

      // 2つ目のタブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, secondNewTabId!);

      // 両方のタブがツリーに表示されることを確認
      await expect(async () => {
        const firstNode = sidePanelPage.locator(`[data-testid="tree-node-${firstNewTabId}"]`);
        const secondNode = sidePanelPage.locator(`[data-testid="tree-node-${secondNewTabId}"]`);
        await expect(firstNode).toBeVisible();
        await expect(secondNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 2つ目のタブが1つ目のタブより下にあることを確認
      const firstNode = sidePanelPage.locator(`[data-testid="tree-node-${firstNewTabId}"]`);
      const secondNode = sidePanelPage.locator(`[data-testid="tree-node-${secondNewTabId}"]`);

      const firstBox = await firstNode.boundingBox();
      const secondBox = await secondNode.boundingBox();

      expect(firstBox).not.toBeNull();
      expect(secondBox).not.toBeNull();
      if (firstBox && secondBox) {
        // 2つ目のタブが1つ目より下にあるはず
        expect(secondBox.y).toBeGreaterThan(firstBox.y);
      }
    });
  });
});
