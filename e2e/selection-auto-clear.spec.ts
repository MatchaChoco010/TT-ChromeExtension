/**
 * Selection Auto-Clear E2E Tests
 *
 * 選択状態の自動解除機能の E2E テスト
 *
 * Requirements: 15.1, 15.2
 * - 新しいタブが開かれたときにタブ選択状態が解除されること
 * - タブクローズ等の操作時にも選択状態が解除されること
 *
 * Note: アクティブタブ変更時の選択状態解除は、ツリー内でのタブクリック時にも
 * onActivatedイベントが発火するため、複数選択機能と競合するため実装していない
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import { waitForTabInTreeState, waitForTabRemovedFromTreeState } from './utils/polling-utils';

test.describe('Task 4.1: 選択状態の自動解除', () => {
  test.describe('Requirement 15.1: 新しいタブが開かれたときにタブ選択状態が解除される', () => {
    test('新しいタブを開くと複数選択状態が解除される', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // Arrange: 複数のタブを作成して選択状態にする
      const tabId1 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId1);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`)).toBeVisible({ timeout: 10000 });

      const tabId2 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId2);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`)).toBeVisible({ timeout: 10000 });

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 複数選択を行う
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await tabNode1.click();
      await expect(tabNode1).toHaveClass(/bg-gray-500/);

      await tabNode2.click({ modifiers: ['Control'] });
      await expect(tabNode1).toHaveClass(/bg-gray-500/);
      await expect(tabNode2).toHaveClass(/bg-gray-500/);

      // Act: 新しいタブを作成
      const tabId3 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId3);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`)).toBeVisible({ timeout: 10000 });

      // Assert: 選択状態が解除されている
      await expect(tabNode1).not.toHaveClass(/bg-gray-500/);
      await expect(tabNode2).not.toHaveClass(/bg-gray-500/);

      // Cleanup
      await closeTab(extensionContext, tabId1);
      await closeTab(extensionContext, tabId2);
      await closeTab(extensionContext, tabId3);
    });
  });

  test.describe('Requirement 15.2: タブクローズ等の操作時にも選択状態が解除される', () => {
    test('タブをクローズすると選択状態が解除される', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // Arrange: 複数のタブを作成して選択状態にする
      const tabId1 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId1);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`)).toBeVisible({ timeout: 10000 });

      const tabId2 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId2);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`)).toBeVisible({ timeout: 10000 });

      const tabId3 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId3);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`)).toBeVisible({ timeout: 10000 });

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 複数選択を行う（tabId1とtabId2を選択）
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await tabNode1.click();
      await expect(tabNode1).toHaveClass(/bg-gray-500/);

      await tabNode2.click({ modifiers: ['Control'] });
      await expect(tabNode1).toHaveClass(/bg-gray-500/);
      await expect(tabNode2).toHaveClass(/bg-gray-500/);

      // Act: 選択していないタブ（tabId3）をクローズ
      await closeTab(extensionContext, tabId3);
      await waitForTabRemovedFromTreeState(extensionContext, tabId3);

      // Assert: 選択状態が解除されている
      await expect(tabNode1).not.toHaveClass(/bg-gray-500/);
      await expect(tabNode2).not.toHaveClass(/bg-gray-500/);

      // Cleanup
      await closeTab(extensionContext, tabId1);
      await closeTab(extensionContext, tabId2);
    });

    // Note: アクティブタブ変更時の選択状態解除テストは削除
    // ツリー内でタブをクリックするとonActivatedイベントが発火するため、
    // 複数選択機能と競合してしまう

    test('新規タブボタンをクリックすると選択状態が解除される', async ({
      extensionContext,
      sidePanelPage,
    }) => {
      // Arrange: 複数のタブを作成して選択状態にする
      const tabId1 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId1);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`)).toBeVisible({ timeout: 10000 });

      const tabId2 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId2);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`)).toBeVisible({ timeout: 10000 });

      // バックグラウンドスロットリングを回避
      await sidePanelPage.bringToFront();
      await sidePanelPage.evaluate(() => window.focus());

      // 複数選択を行う
      const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
      const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

      await tabNode1.click();
      await expect(tabNode1).toHaveClass(/bg-gray-500/);

      await tabNode2.click({ modifiers: ['Control'] });
      await expect(tabNode1).toHaveClass(/bg-gray-500/);
      await expect(tabNode2).toHaveClass(/bg-gray-500/);

      // 初期タブ数を取得
      const initialNodeCount = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();

      // Act: 新規タブボタンをクリック
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });
      await newTabButton.click();

      // 新しいタブが作成されるのを待つ
      await expect(sidePanelPage.locator('[data-testid^="tree-node-"]')).toHaveCount(initialNodeCount + 1, { timeout: 10000 });

      // Assert: 選択状態が解除されている
      await expect(tabNode1).not.toHaveClass(/bg-gray-500/);
      await expect(tabNode2).not.toHaveClass(/bg-gray-500/);

      // Cleanup - タブは自動的にクリーンアップされる
    });
  });
});
