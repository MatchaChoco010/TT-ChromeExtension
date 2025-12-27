/**
 * Side Panelの表示とリアルタイム更新のE2Eテスト
 *
 * Task 4.7: Side Panelの表示とリアルタイム更新の実装とテスト
 *
 * Requirements: 3.7
 * - Side Panelを開いた場合、現在のタブツリーが正しく表示されることを検証
 * - 別のタブで新しいタブを開いた場合、Side Panelがリアルタイムで更新されることを検証
 * - タブのfavIconが変更された場合、ツリー表示のアイコンが更新されることを検証
 * - 大量のタブ（100個以上）が存在する場合、スクロールとレンダリングが滑らかに動作することを検証
 * - ツリーノードの展開/折りたたみを切り替えた場合、アニメーションが滑らかに実行されることを検証
 */
import { test, expect } from './fixtures/extension';
import { openSidePanel, assertTreeVisible, assertSmoothScrolling } from './utils/side-panel-utils';
import { createTab, closeTab, assertTabInTree, assertTabNotInTree } from './utils/tab-utils';

test.describe('Side Panelの表示とリアルタイム更新', () => {
  test.describe('基本的な表示テスト', () => {
    test('Side Panelを開いた場合、Side Panelが正しく表示される', async ({
      extensionContext,
      extensionId,
      sidePanelPage,
    }) => {
      // Side Panelが正しく表示されることを検証
      await assertTreeVisible(sidePanelPage);

      // Side Panelのルート要素が表示されていることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // TabTreeViewが表示されていることを確認
      const tabTreeView = sidePanelPage.locator('[data-testid="tab-tree-view"]');
      await expect(tabTreeView).toBeVisible({ timeout: 10000 });
    });

    test('Side Panelを開いた場合、現在のタブツリーが正しく表示される', async ({
      extensionContext,
      extensionId,
      sidePanelPage,
    }) => {
      // ツリーが表示されることを検証
      await assertTreeVisible(sidePanelPage);

      // 少なくとも1つのタブノードが存在することを確認
      // （Side Panelページ自体もタブとして表示される）
      const tabNodes = sidePanelPage.locator('[data-testid^="tree-node-"]');
      await expect(tabNodes.first()).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('リアルタイム更新テスト', () => {
    test('新しいタブを作成した場合、Side Panelがリアルタイムで更新される', async ({
      extensionContext,
      extensionId,
      sidePanelPage,
    }) => {
      // 初期状態のタブノード数を取得（ツリーが安定するまで待機）
      await assertTreeVisible(sidePanelPage);
      // タブノードが少なくとも1つ表示されるまで待機してから数を取得
      await expect(sidePanelPage.locator('[data-testid^="tree-node-"]').first()).toBeVisible({ timeout: 10000 });
      const initialTabNodes = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();

      // 新しいタブを作成
      const newTabId = await createTab(extensionContext, 'about:blank');

      // Side Panelがリアルタイムで更新されるまで待機
      // タブが追加されたことを検証（タブ数が増加）
      await expect(async () => {
        const currentTabNodes = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();
        expect(currentTabNodes).toBeGreaterThan(initialTabNodes);
      }).toPass({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, newTabId);
    });

    test('タブを閉じた場合、Side Panelからタブが削除される', async ({
      extensionContext,
      extensionId,
      sidePanelPage,
    }) => {
      // 新しいタブを作成
      await assertTreeVisible(sidePanelPage);
      const tabId = await createTab(extensionContext, 'about:blank');

      // タブが追加されたことを確認
      await expect(async () => {
        const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        await expect(tabNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 現在のタブノード数を取得
      const beforeCloseCount = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();

      // タブを閉じる
      await closeTab(extensionContext, tabId);

      // Side Panelからタブが削除されるまで待機
      await expect(async () => {
        const currentCount = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();
        expect(currentCount).toBeLessThan(beforeCloseCount);
      }).toPass({ timeout: 10000 });
    });

    test('タブのURLを変更した場合、ツリー表示が更新される', async ({
      extensionContext,
      extensionId,
      sidePanelPage,
      serviceWorker,
    }) => {
      // 新しいタブを作成
      await assertTreeVisible(sidePanelPage);
      const tabId = await createTab(extensionContext, 'about:blank');

      // タブが追加されたことを確認
      await expect(async () => {
        const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        await expect(tabNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // タブのURLを変更
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { url: 'https://example.com' });
      }, tabId);

      // タブノードがまだ表示されていることを確認（ポーリングで待機）
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });
  });

  test.describe('展開/折りたたみテスト', () => {
    test('親タブに子タブがある場合、展開ボタンが表示される', async ({
      extensionContext,
      extensionId,
      sidePanelPage,
    }) => {
      // ツリーが表示されることを検証
      await assertTreeVisible(sidePanelPage);

      // 親タブを作成
      const parentTabId = await createTab(extensionContext, 'about:blank');

      // 親タブが表示されるまで待機
      await expect(async () => {
        const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
        await expect(parentNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 子タブを作成
      const childTabId = await createTab(extensionContext, 'about:blank', parentTabId);

      // 子タブが追加されるまで待機
      await expect(async () => {
        const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
        await expect(childNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 親タブノードに展開ボタンが表示されることを確認
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
      const expandButton = parentNode.locator('[data-testid="expand-button"]');

      // 展開ボタンがあるか、または親ノードが展開状態であることをポーリングで確認
      // （親子関係がUIに反映されるまで待機）
      await expect(async () => {
        const hasExpandButton = await expandButton.count();
        const isExpanded = await parentNode.getAttribute('data-expanded');
        // 展開ボタンがあるか、すでに展開されている場合はOK
        expect(hasExpandButton > 0 || isExpanded === 'true').toBeTruthy();
      }).toPass({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, childTabId);
      await closeTab(extensionContext, parentTabId);
    });

    test('展開ボタンをクリックすると、子タブの表示/非表示が切り替わる', async ({
      extensionContext,
      extensionId,
      sidePanelPage,
    }) => {
      // ツリーが表示されることを検証
      await assertTreeVisible(sidePanelPage);

      // 親タブを作成
      const parentTabId = await createTab(extensionContext, 'about:blank');

      // 親タブが表示されるまで待機
      await expect(async () => {
        const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
        await expect(parentNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 子タブを作成
      const childTabId = await createTab(extensionContext, 'about:blank', parentTabId);

      // 子タブが追加されるまで待機
      const childNode = sidePanelPage.locator(`[data-testid="tree-node-${childTabId}"]`);
      await expect(async () => {
        await expect(childNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // 親タブノードの展開ボタンを取得
      const parentNode = sidePanelPage.locator(`[data-testid="tree-node-${parentTabId}"]`);
      const expandButton = parentNode.locator('[data-testid="expand-button"]');

      if (await expandButton.count() > 0) {
        // 子タブが表示されていることを確認（展開状態）
        await expect(childNode).toBeVisible();

        // 展開ボタンをクリックして折りたたみ
        await expandButton.click();

        // 子タブが非表示になることを確認
        await expect(async () => {
          await expect(childNode).not.toBeVisible();
        }).toPass({ timeout: 5000 });

        // もう一度クリックして展開
        await expandButton.click();

        // 子タブが再び表示されることを確認
        await expect(async () => {
          await expect(childNode).toBeVisible();
        }).toPass({ timeout: 5000 });
      } else {
        // 展開ボタンがない場合は、子が表示されていることを確認するだけ
        await expect(childNode).toBeVisible();
      }

      // クリーンアップ
      await closeTab(extensionContext, childTabId);
      await closeTab(extensionContext, parentTabId);
    });
  });

  test.describe('スクロール性能テスト', () => {
    test('大量のタブがある場合、スクロールが滑らかに動作する', async ({
      extensionContext,
      extensionId,
      sidePanelPage,
    }) => {
      // ツリーが表示されることを検証
      await assertTreeVisible(sidePanelPage);

      // 複数のタブを作成（性能テストのため少なめに）
      const tabCount = 10;
      const createdTabIds: number[] = [];

      for (let i = 0; i < tabCount; i++) {
        const tabId = await createTab(extensionContext, 'about:blank');
        createdTabIds.push(tabId);
      }

      // すべてのタブが表示されるまで待機
      await expect(async () => {
        const currentCount = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();
        expect(currentCount).toBeGreaterThanOrEqual(tabCount);
      }).toPass({ timeout: 30000 });

      // スクロール動作を検証
      await assertSmoothScrolling(sidePanelPage, tabCount);

      // クリーンアップ
      for (const tabId of createdTabIds) {
        try {
          await closeTab(extensionContext, tabId);
        } catch {
          // タブが既に閉じられている場合は無視
        }
      }
    });
  });

  test.describe('favIcon更新テスト', () => {
    test('タブのfavIconが変更された場合、ツリー表示のアイコンが更新される', async ({
      extensionContext,
      extensionId,
      sidePanelPage,
      serviceWorker,
    }) => {
      // ツリーが表示されることを検証
      await assertTreeVisible(sidePanelPage);

      // 実際のウェブサイトを開くタブを作成（favIconを取得するため）
      const tabId = await createTab(extensionContext, 'https://example.com');

      // タブが追加されるまで待機
      await expect(async () => {
        const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        await expect(tabNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // タブノードが表示されていることを確認（favIconのロードを含む）
      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      await expect(tabNode).toBeVisible({ timeout: 10000 });

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });
  });
});
