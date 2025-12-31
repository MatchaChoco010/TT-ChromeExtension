/**
 * Tab Grouping E2E Tests
 *
 * タブグループ化機能の E2E テスト
 *
 * Task 12.3 (tab-tree-bugfix): グループ化機能のE2Eテスト
 * Requirements: 11.1, 11.2, 11.3, 11.4
 * - 複数タブを選択してグループ化した際にグループ親タブが作成されることを検証
 * - グループ親タブが専用のタブとして表示されることを検証
 * - 単一タブをグループに追加できることを検証
 *
 * Task 6.2 (tab-tree-comprehensive-fix): グループ化機能のE2Eテスト追加
 * Requirements: 6.5, 6.6, 6.7, 6.8
 * - 6.5: コンテキストメニューからのグループ化操作を検証
 * - 6.6: 単一タブのグループ化を検証
 * - 6.7: 複数タブ選択時のグループ化を検証
 * - 6.8: グループ化後の親子関係を検証
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab, refreshSidePanel } from './utils/tab-utils';
import { waitForCondition } from './utils/polling-utils';

/**
 * タブが作成された後、UIに表示されるまで待機するヘルパー関数
 */
async function waitForTabInUI(
  sidePanelPage: import('@playwright/test').Page,
  extensionContext: import('@playwright/test').BrowserContext,
  tabId: number,
  timeout: number = 15000
): Promise<void> {
  // まず STATE_UPDATED を送信してUIの更新をトリガー
  const serviceWorkers = extensionContext.serviceWorkers();
  if (serviceWorkers.length > 0) {
    await serviceWorkers[0].evaluate(async () => {
      try {
        await chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
      } catch { /* ignore */ }
    });
  }

  // UIに表示されるまで待機
  await expect(async () => {
    const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
    await expect(tabNode).toBeVisible();
  }).toPass({ timeout });
}

test.describe('タブグループ化機能', () => {
  test.describe('複数タブのグループ化', () => {
    /**
     * Requirement 11.1, 6.5, 6.7: 複数タブを選択してコンテキストメニューからグループ化
     */
    test('Requirement 11.1, 6.5, 6.7: 複数タブを選択してグループ化した際にグループ親タブが作成される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 複数のタブを作成
      const tabId1 = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId1);

      const tabId2 = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId2);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 最初のタブを選択
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click();
      await expect(tabNode1).toHaveClass(/bg-gray-500/);

      // Ctrl+クリックで2番目のタブを追加選択
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Control'] });
      await expect(tabNode2).toHaveClass(/bg-gray-500/);

      // 要素のバウンディングボックスが安定するまで待機
      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      // Act: 右クリックでコンテキストメニューを開く
      await tabNode2.click({ button: 'right' });

      // コンテキストメニューが表示されることを確認
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「選択されたタブをグループ化」をクリック
      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
      await expect(groupMenuItem).toBeVisible();
      await groupMenuItem.click();

      // コンテキストメニューが閉じるまで待機
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert: グループ親タブ（group-で始まるノード）が作成されていることを確認
      // ストレージをポーリングでチェック
      // 実装は実タブ（正のtabId）を使用するため、tabId > 0をチェック
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as { nodes?: Record<string, { id: string; tabId: number }> } | undefined;
          });
          if (!treeState?.nodes) return false;
          // group-で始まるIDを持つノードが存在するか確認（実タブを使用するためtabId > 0）
          return Object.values(treeState.nodes).some(
            (node) => node.id.startsWith('group-') && node.tabId > 0
          );
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created' }
      );

      // UIにグループノードが表示されていることを確認
      // グループノードのdata-testidは group-header-{groupId} の形式
      const groupNode = sidePanelPage.locator('[data-testid^="group-header-"]');
      await expect(groupNode.first()).toBeVisible({ timeout: 5000 });

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await closeTab(extensionContext, tabId2);
    });

    /**
     * Requirement 11.2: グループ親タブの表示スタイル検証
     */
    test('Requirement 11.2: グループ親タブが専用のタブとして表示される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 複数のタブを作成
      const tabId1 = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId1);

      const tabId2 = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId2);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 複数タブを選択してグループ化
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click();
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Control'] });

      // 要素が安定するまで待機
      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      // グループ化を実行
      await tabNode2.click({ button: 'right' });
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });
      await sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ }).click();
      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // グループノードが作成されるまで待機（実タブを使用するためtabId > 0）
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as { nodes?: Record<string, { id: string; tabId: number }> } | undefined;
          });
          if (!treeState?.nodes) return false;
          return Object.values(treeState.nodes).some(
            (node) => node.id.startsWith('group-') && node.tabId > 0
          );
        },
        { timeout: 10000 }
      );

      // Assert: グループノードが専用のスタイルで表示されていることを確認
      // グループノードのdata-testidは group-header-{groupId} の形式
      const groupNode = sidePanelPage.locator('[data-testid^="group-header-"]').first();
      await expect(groupNode).toBeVisible({ timeout: 5000 });

      // グループノードには折りたたみ/展開ボタン（▼または▶）が表示される
      const toggleButton = groupNode.locator('button').first();
      await expect(toggleButton).toBeVisible();

      // グループアイコン（フォルダアイコン）が表示されていることを確認
      // TaskGroupNodeHeaderコンポーネントでは📁アイコンを使用
      const groupIcon = groupNode.locator('text=📁');
      await expect(groupIcon).toBeVisible({ timeout: 3000 });

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await closeTab(extensionContext, tabId2);
    });
  });

  test.describe('単一タブのグループ化', () => {
    /**
     * Requirement 6.1-6.4, 6.5, 6.6, 6.8 (Task 6.1, 6.2):
     * - 6.5: コンテキストメニューからのグループ化操作を検証
     * - 6.6: 単一タブのグループ化を検証
     * - 6.8: グループ化後の親子関係を検証
     */
    test('Requirement 6.1-6.4, 6.5, 6.6, 6.8: 単一タブを新しいグループにグループ化できる', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 単一のタブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // 要素が安定するまで待機
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

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「タブをグループ化」メニュー項目が表示されることを確認
      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /タブをグループ化/ });
      await expect(groupMenuItem).toBeVisible();

      // 「タブをグループ化」をクリック
      await groupMenuItem.click();

      // コンテキストメニューが閉じるまで待機
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert: グループ親タブが作成されていることを確認（実タブを使用するためtabId > 0）
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as { nodes?: Record<string, { id: string; tabId: number }> } | undefined;
          });
          if (!treeState?.nodes) return false;
          // group-で始まるIDを持つノードが存在するか確認（実タブを使用するためtabId > 0）
          return Object.values(treeState.nodes).some(
            (node) => node.id.startsWith('group-') && node.tabId > 0
          );
        },
        { timeout: 10000, timeoutMessage: 'Group parent node was not created from single tab' }
      );

      // UIにグループノードが表示されていることを確認
      const groupNode = sidePanelPage.locator('[data-testid^="group-header-"]');
      await expect(groupNode.first()).toBeVisible({ timeout: 5000 });

      // 元のタブがグループの子として配置されていることを確認
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as {
              nodes?: Record<string, { id: string; tabId: number; parentId: string | null; groupId?: string }>;
              tabToNode?: Record<number, string>;
            } | undefined;
          });
          if (!treeState?.nodes || !treeState?.tabToNode) return false;

          const tabNodeId = treeState.tabToNode[tabId];
          if (!tabNodeId) return false;

          const tabNodeState = treeState.nodes[tabNodeId];
          if (!tabNodeState) return false;

          // タブがグループに属していることを確認（parentIdまたはgroupIdで判定）
          return (tabNodeState.parentId !== null && tabNodeState.parentId.startsWith('group-')) ||
                 (tabNodeState.groupId !== undefined && tabNodeState.groupId.startsWith('group-'));
        },
        { timeout: 10000, timeoutMessage: 'Tab was not added as child of group' }
      );

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });

    /**
     * Requirement 6.4 (Task 6.1): グループのデフォルト名設定検証
     */
    test('Requirement 6.4: 単一タブのグループ化時にデフォルト名「グループ」が設定される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 単一のタブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // 要素が安定するまで待機
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

      // Act: グループ化を実行
      await tabNode.click({ button: 'right' });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /タブをグループ化/ });
      await groupMenuItem.click();
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert: グループ名が「グループ」であることを確認
      await waitForCondition(
        async () => {
          const groups = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('groups');
            return result.groups as Record<string, { id: string; name: string }> | undefined;
          });
          if (!groups) return false;
          // 「グループ」という名前のグループが存在することを確認
          return Object.values(groups).some((group) => group.name === 'グループ');
        },
        { timeout: 10000, timeoutMessage: 'Group with default name "グループ" was not created' }
      );

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });
  });

  test.describe('単一タブのグループ追加', () => {
    test('Requirement 11.3, 11.4: 単一タブをグループに追加できる', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: まずグループを作成するために2つのタブを作成
      const tabId1 = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId1);

      const tabId2 = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId2);

      // 追加でグループに追加する3番目のタブを作成
      const tabId3 = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId3);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 最初の2つのタブを選択してグループ化
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      await tabNode1.click();
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
      await tabNode2.click({ modifiers: ['Control'] });

      // 要素が安定するまで待機
      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId2,
        { timeout: 5000 }
      );

      // グループ化
      await tabNode2.click({ button: 'right' });
      await expect(sidePanelPage.locator('[role="menu"]')).toBeVisible({ timeout: 5000 });
      await sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ }).click();
      await expect(sidePanelPage.locator('[role="menu"]')).not.toBeVisible({ timeout: 3000 });

      // グループが作成されるまで待機（実タブを使用するためtabId > 0）
      let groupId: string | undefined;
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as { nodes?: Record<string, { id: string; tabId: number }> } | undefined;
          });
          if (!treeState?.nodes) return false;
          const groupNode = Object.values(treeState.nodes).find(
            (node) => node.id.startsWith('group-') && node.tabId > 0
          );
          if (groupNode) {
            groupId = groupNode.id;
            return true;
          }
          return false;
        },
        { timeout: 10000 }
      );

      expect(groupId).toBeDefined();

      // グループが作成された後、STATE_UPDATEDを送信してUIの更新をトリガー
      await serviceWorker.evaluate(async () => {
        try {
          await chrome.runtime.sendMessage({ type: 'STATE_UPDATED' });
        } catch { /* ignore */ }
      });

      // グループ情報がUIに反映されるまでポーリングで待機
      const groupNode = sidePanelPage.locator('[data-testid^="group-header-"]');
      await expect(groupNode.first()).toBeVisible({ timeout: 5000 });

      // 3番目のタブを選択解除して単独で選択
      const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);

      // 要素が安定するまで待機
      await sidePanelPage.waitForFunction(
        (tabId) => {
          const node = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
          if (!node) return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        },
        tabId3,
        { timeout: 5000 }
      );

      // Act: 3番目のタブを右クリックしてコンテキストメニューを開く
      await tabNode3.click({ button: 'right' });

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // 「グループに追加」メニュー項目を見つける
      const addToGroupItem = sidePanelPage.locator('text=グループに追加');
      await expect(addToGroupItem).toBeVisible({ timeout: 3000 });

      // サブメニューを開くためにホバー
      await addToGroupItem.hover();

      // サブメニュー（グループ一覧）が表示されるまで待機
      // SubMenuコンポーネントはホバーで開く
      await expect(async () => {
        // グループ名を含むサブメニュー項目が表示されることを確認
        const subMenuItems = sidePanelPage.locator('[role="menu"] [role="menu"]');
        const count = await subMenuItems.count();
        expect(count).toBeGreaterThan(0);
      }).toPass({ timeout: 5000 });

      // サブメニュー内のグループを選択
      // SubMenuのアイテムはbutton要素として表示される
      // グループ名は「グループ」（TreeStateManager.createGroupFromTabsで設定されるデフォルト名）
      const subMenu = sidePanelPage.locator('[data-testid="submenu"]');
      await expect(subMenu).toBeVisible({ timeout: 3000 });

      const groupButton = subMenu.locator('button:has-text("グループ")');
      await expect(groupButton.first()).toBeVisible({ timeout: 3000 });
      await groupButton.first().click();

      // メニューが閉じるまで待機（first()を使用してメインメニューのみを対象）
      await expect(contextMenu.first()).not.toBeVisible({ timeout: 5000 });

      // Assert: タブがグループに追加されていることを確認
      // TreeStateProviderのaddTabToGroupはgroupIdフィールドを設定する
      // またはparentIdがグループノードになる場合もある
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as {
              nodes?: Record<string, { id: string; tabId: number; parentId: string | null; groupId?: string }>;
              tabToNode?: Record<number, string>;
            } | undefined;
          });
          if (!treeState?.nodes || !treeState?.tabToNode) return false;

          const tab3NodeId = treeState.tabToNode[tabId3];
          if (!tab3NodeId) return false;

          const tab3Node = treeState.nodes[tab3NodeId];
          if (!tab3Node) return false;

          // タブ3がグループに属していることを確認（parentIdまたはgroupIdで判定）
          return tab3Node.parentId === groupId || tab3Node.groupId === groupId;
        },
        { timeout: 10000, timeoutMessage: 'Tab was not added to group' }
      );

      // クリーンアップ
      await closeTab(extensionContext, tabId1);
      await closeTab(extensionContext, tabId2);
      await closeTab(extensionContext, tabId3);
    });

    test('Requirement 11.4: 利用可能なグループがない場合はメニュー項目が無効化される', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // Arrange: タブを1つだけ作成（グループがない状態）
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // 要素が安定するまで待機
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

      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      // Assert: 「グループに追加」メニュー項目が無効化されていることを確認
      // グループがない場合、「グループに追加」はグレーアウト表示される
      const addToGroupItem = sidePanelPage.locator('text=グループに追加');
      await expect(addToGroupItem).toBeVisible();

      // 無効化されているかどうかを確認（text-gray-500クラスで無効化状態を示す）
      const parentDiv = addToGroupItem.locator('..');
      await expect(parentDiv).toHaveClass(/text-gray-500|cursor-not-allowed/);

      // サブメニューが表示されないことを確認（矢印が表示されない）
      const arrow = parentDiv.locator('text=▶');
      await expect(arrow).not.toBeVisible();

      // メニューを閉じる
      await sidePanelPage.keyboard.press('Escape');
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // クリーンアップ
      await closeTab(extensionContext, tabId);
    });
  });

  /**
   * Task 16.6 (tab-tree-bugfix-2): 実タブグループ化機能のE2Eテスト追加
   * Requirements: 5.11, 5.12, 5.13, 5.14
   * - 5.11: グループタブのURLが拡張機能専用ページであることを検証
   * - 5.12: グループ化後に親タブの存在を検証
   * - 5.13: グループ化後の親子関係を検証
   * - 5.14: テストが安定して10回連続成功すること
   */
  test.describe('実タブグループ化機能（Task 16.6）', () => {
    /**
     * Requirement 5.11: グループタブのURLがchrome-extension://であることを検証
     * 単一タブのグループ化で検証（複数タブ選択のUIはフレーキーなため）
     */
    test('Requirement 5.11: グループ化するとchrome-extension://スキームのグループタブが作成される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 単一のタブを作成（単一タブの方がテストが安定）
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

      // 要素が安定するまで待機
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

      // Act: グループ化を実行
      await tabNode.click({ button: 'right' });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /タブをグループ化/ });
      await expect(groupMenuItem).toBeVisible();
      await groupMenuItem.click();
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert: グループタブが作成されていることを確認
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async () => {
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as { nodes?: Record<string, { id: string; tabId: number }> } | undefined;
            if (!treeState?.nodes) return { found: false };

            // group-で始まるIDを持ち、正のtabIdを持つノード（実タブ）を探す
            const groupNode = Object.values(treeState.nodes).find(
              (node) => node.id.startsWith('group-') && node.tabId > 0
            );
            if (!groupNode) return { found: false };

            // グループタブのURLを確認
            try {
              const tab = await chrome.tabs.get(groupNode.tabId);
              const urlMatch = tab.url?.startsWith('chrome-extension://') && tab.url?.includes('group.html');
              return { found: true, groupTabId: groupNode.tabId, urlMatch };
            } catch {
              return { found: false };
            }
          });
          if (result.found && result.groupTabId) {
            groupTabId = result.groupTabId;
            return result.urlMatch === true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Group tab was not created with chrome-extension:// URL' }
      );

      // クリーンアップ
      if (groupTabId) {
        await serviceWorker.evaluate(async (tabId) => {
          try {
            await chrome.tabs.remove(tabId);
          } catch { /* ignore */ }
        }, groupTabId);
      }
      await closeTab(extensionContext, tabId);
    });

    /**
     * Requirement 5.12: グループ化後に親タブ（グループタブ）が存在することを検証
     */
    test('Requirement 5.12: グループ化後にグループ親タブが実際のブラウザタブとして存在する', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 単一のタブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

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

      // Act: グループ化を実行
      await tabNode.click({ button: 'right' });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });
      await sidePanelPage.getByRole('menuitem', { name: /タブをグループ化/ }).click();
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert: グループタブが実際のブラウザタブとして存在することを確認
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as { nodes?: Record<string, { id: string; tabId: number }> } | undefined;
          });
          if (!treeState?.nodes) return false;

          const groupNode = Object.values(treeState.nodes).find(
            (node) => node.id.startsWith('group-') && node.tabId > 0
          );
          if (groupNode) {
            groupTabId = groupNode.tabId;
            return true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Group node with real tab ID was not found' }
      );

      // グループタブがChrome APIで取得できることを確認
      const tabExists = await serviceWorker.evaluate(async (tabId) => {
        try {
          const tab = await chrome.tabs.get(tabId);
          return tab !== null && tab !== undefined;
        } catch {
          return false;
        }
      }, groupTabId!);

      expect(tabExists).toBe(true);

      // クリーンアップ
      if (groupTabId) {
        await serviceWorker.evaluate(async (tabId) => {
          try {
            await chrome.tabs.remove(tabId);
          } catch { /* ignore */ }
        }, groupTabId);
      }
      await closeTab(extensionContext, tabId);
    });

    /**
     * Requirement 5.13: グループ化後の親子関係を検証
     */
    test('Requirement 5.13: グループ化後にタブがグループタブの子として配置される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 単一のタブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

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

      // Act: グループ化を実行
      await tabNode.click({ button: 'right' });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });
      await sidePanelPage.getByRole('menuitem', { name: /タブをグループ化/ }).click();
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert: 親子関係が正しく設定されていることを確認
      // Note: TreeStateManager.persistState()はchildren配列を空で保存し、loadStateで再構築する設計のため、
      //       parentIdを使って親子関係を確認する
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async (targetTabId) => {
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as {
              nodes?: Record<string, { id: string; tabId: number; parentId: string | null }>;
              tabToNode?: Record<number, string>;
            } | undefined;
            if (!treeState?.nodes || !treeState?.tabToNode) {
              return { found: false };
            }

            // グループノードを探す（正のtabId）
            const groupNode = Object.values(treeState.nodes).find(
              (node) => node.id.startsWith('group-') && node.tabId > 0
            );
            if (!groupNode) return { found: false };

            // 子タブがグループノードの子として配置されていることを確認（parentIdで判定）
            const tabNodeId = treeState.tabToNode[targetTabId];
            if (!tabNodeId) return { found: false, reason: 'tabNodeId not found' };

            const tabNodeState = treeState.nodes[tabNodeId];
            if (!tabNodeState) return { found: false, reason: 'tabNodeState not found' };

            const isChild = tabNodeState.parentId === groupNode.id;
            return { found: true, groupTabId: groupNode.tabId, isChild };
          }, tabId);

          if (result.found && result.groupTabId) {
            groupTabId = result.groupTabId;
            return result.isChild === true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Parent-child relationship was not established correctly' }
      );

      // クリーンアップ
      if (groupTabId) {
        await serviceWorker.evaluate(async (tabId) => {
          try {
            await chrome.tabs.remove(tabId);
          } catch { /* ignore */ }
        }, groupTabId);
      }
      await closeTab(extensionContext, tabId);
    });

    /**
     * 単一タブのグループ化でも実タブが作成されることを検証
     */
    test('単一タブをグループ化しても実タブのグループ親が作成される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 単一のタブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

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

      // Act: グループ化を実行
      await tabNode.click({ button: 'right' });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });

      const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /タブをグループ化/ });
      await expect(groupMenuItem).toBeVisible();
      await groupMenuItem.click();
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert: 実タブのグループ親が作成されていることを確認
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const treeState = await serviceWorker.evaluate(async () => {
            const result = await chrome.storage.local.get('tree_state');
            return result.tree_state as { nodes?: Record<string, { id: string; tabId: number }> } | undefined;
          });
          if (!treeState?.nodes) return false;

          const groupNode = Object.values(treeState.nodes).find(
            (node) => node.id.startsWith('group-') && node.tabId > 0
          );
          if (groupNode) {
            groupTabId = groupNode.tabId;
            return true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Real tab group parent was not created for single tab' }
      );

      // グループタブのURLを確認
      const groupTabUrl = await serviceWorker.evaluate(async (tabId) => {
        const tab = await chrome.tabs.get(tabId);
        return tab.url;
      }, groupTabId!);

      expect(groupTabUrl).toMatch(/^chrome-extension:\/\/.*\/group\.html/);

      // クリーンアップ
      if (groupTabId) {
        await serviceWorker.evaluate(async (tabId) => {
          try {
            await chrome.tabs.remove(tabId);
          } catch { /* ignore */ }
        }, groupTabId);
      }
      await closeTab(extensionContext, tabId);
    });

    /**
     * グループノードがストレージに正しく保存されることを検証
     * Note: UI表示のテストはTask 15.4で対応（isGroupNode関数の更新が必要）
     */
    test('グループ化後にグループノードがストレージに正しく保存される', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 単一のタブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInUI(sidePanelPage, extensionContext, tabId);

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);

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

      // Act: グループ化を実行
      await tabNode.click({ button: 'right' });
      const contextMenu = sidePanelPage.locator('[role="menu"]');
      await expect(contextMenu).toBeVisible({ timeout: 5000 });
      await sidePanelPage.getByRole('menuitem', { name: /タブをグループ化/ }).click();
      await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

      // Assert: グループノードがストレージに正しく保存されていることを確認
      let groupTabId: number | undefined;
      await waitForCondition(
        async () => {
          const result = await serviceWorker.evaluate(async () => {
            const storage = await chrome.storage.local.get('tree_state');
            const treeState = storage.tree_state as {
              nodes?: Record<string, { id: string; tabId: number; groupId?: string }>
            } | undefined;
            if (!treeState?.nodes) return { found: false };

            // group-で始まるIDを持ち、正のtabIdを持つノード（実タブ）を探す
            const groupNode = Object.values(treeState.nodes).find(
              (node) => node.id.startsWith('group-') && node.tabId > 0
            );
            if (!groupNode) return { found: false };

            // グループノードにgroupIdが設定されていることを確認
            return {
              found: true,
              groupTabId: groupNode.tabId,
              hasGroupId: !!groupNode.groupId
            };
          });
          if (result.found && result.groupTabId) {
            groupTabId = result.groupTabId;
            return result.hasGroupId === true;
          }
          return false;
        },
        { timeout: 15000, timeoutMessage: 'Group node was not saved correctly to storage' }
      );

      // クリーンアップ
      if (groupTabId) {
        await serviceWorker.evaluate(async (tabId) => {
          try {
            await chrome.tabs.remove(tabId);
          } catch { /* ignore */ }
        }, groupTabId);
      }
      await closeTab(extensionContext, tabId);
    });
  });
});
