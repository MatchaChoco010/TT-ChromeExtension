/**
 * Multi-Selection E2E Tests
 *
 * 複数選択機能の E2E テスト
 *
 * - Shift+クリックで範囲選択ができること
 * - Ctrl+クリックで追加選択/選択解除ができること
 * - 複数選択時のコンテキストメニューオプションをテスト
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import { waitForTabInTreeState } from './utils/polling-utils';

test.describe('複数選択機能', () => {
  test('Shift+クリックで範囲選択ができる', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: 複数のタブを作成
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

    // Act: 最初のタブをクリック
    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    await tabNode1.click();

    // 最初のタブが選択されていることを確認（bg-gray-500クラスで選択状態を示す）
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    // Shift+クリックで3番目のタブを選択
    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);
    await tabNode3.click({ modifiers: ['Shift'] });

    // Assert: 範囲内のすべてのタブが選択されている
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await closeTab(extensionContext, tabId2);
    await closeTab(extensionContext, tabId3);
  });

  test('Ctrl+クリックで追加選択/選択解除ができる', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: 複数のタブを作成
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

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);

    // Act: 最初のタブをクリック
    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    // Ctrl+クリックで2番目のタブを追加選択
    await tabNode2.click({ modifiers: ['Control'] });
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).not.toHaveClass(/bg-gray-500/);

    // Ctrl+クリックで3番目のタブを追加選択
    await tabNode3.click({ modifiers: ['Control'] });
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    // Ctrl+クリックで2番目のタブを選択解除
    await tabNode2.click({ modifiers: ['Control'] });
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).not.toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await closeTab(extensionContext, tabId2);
    await closeTab(extensionContext, tabId3);
  });

  test('複数選択時にコンテキストメニューで選択タブ数が表示される', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: 複数のタブを作成
    const tabId1 = await createTab(extensionContext, 'about:blank');
    await waitForTabInTreeState(extensionContext, tabId1);
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`)).toBeVisible({ timeout: 10000 });

    const tabId2 = await createTab(extensionContext, 'about:blank');
    await waitForTabInTreeState(extensionContext, tabId2);
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`)).toBeVisible({ timeout: 10000 });

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

    // 最初のタブをクリックして選択
    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    // Ctrl+クリックで2番目のタブを追加選択
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

    // Assert: コンテキストメニューが表示され、選択タブ数が表示される
    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // 「選択されたタブを閉じる (2件)」というテキストが表示されることを確認
    const closeMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブを閉じる.*2件/ });
    await expect(closeMenuItem).toBeVisible();

    // メニューを閉じる
    await sidePanelPage.keyboard.press('Escape');
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await closeTab(extensionContext, tabId2);
  });

  test('複数選択時のコンテキストメニューから選択タブを一括で閉じることができる', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: 複数のタブを作成
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

    // 現在のタブ数を取得
    const initialTabNodes = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

    // 最初のタブをクリックして選択
    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    // Ctrl+クリックで2番目のタブを追加選択
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

    // コンテキストメニューが表示されるまで待機
    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // 「選択されたタブを閉じる」をクリック
    const closeMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブを閉じる/ });
    await closeMenuItem.click();

    // コンテキストメニューが閉じるまで待機
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // Assert: 選択されたタブ（2つ）が閉じられている
    await expect(async () => {
      const currentTabNodes = await sidePanelPage.locator('[data-testid^="tree-node-"]').count();
      expect(currentTabNodes).toBe(initialTabNodes - 2);
    }).toPass({ timeout: 5000 });

    // 3番目のタブは残っていることを確認
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`)).toBeVisible();

    // クリーンアップ
    await closeTab(extensionContext, tabId3);
  });

  test('複数選択時のコンテキストメニューでグループ化オプションが表示される', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: 複数のタブを作成
    const tabId1 = await createTab(extensionContext, 'about:blank');
    await waitForTabInTreeState(extensionContext, tabId1);
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`)).toBeVisible({ timeout: 10000 });

    const tabId2 = await createTab(extensionContext, 'about:blank');
    await waitForTabInTreeState(extensionContext, tabId2);
    await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`)).toBeVisible({ timeout: 10000 });

    // バックグラウンドスロットリングを回避
    await sidePanelPage.bringToFront();
    await sidePanelPage.evaluate(() => window.focus());

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);

    // 最初のタブをクリックして選択
    await tabNode1.click();
    await expect(tabNode1).toHaveClass(/bg-gray-500/);

    // Ctrl+クリックで2番目のタブを追加選択
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

    // Assert: コンテキストメニューが表示され、グループ化オプションが表示される
    const contextMenu = sidePanelPage.locator('[role="menu"]');
    await expect(contextMenu).toBeVisible({ timeout: 5000 });

    // 「選択されたタブをグループ化」というテキストが表示されることを確認
    const groupMenuItem = sidePanelPage.getByRole('menuitem', { name: /選択されたタブをグループ化/ });
    await expect(groupMenuItem).toBeVisible();

    // メニューを閉じる
    await sidePanelPage.keyboard.press('Escape');
    await expect(contextMenu).not.toBeVisible({ timeout: 3000 });

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await closeTab(extensionContext, tabId2);
  });

  test('通常クリックで既存の選択がクリアされる', async ({
    extensionContext,
    sidePanelPage,
  }) => {
    // Arrange: 複数のタブを作成
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

    const tabNode1 = sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`);
    const tabNode2 = sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`);
    const tabNode3 = sidePanelPage.locator(`[data-testid="tree-node-${tabId3}"]`);

    // 複数選択を行う
    await tabNode1.click();
    await tabNode2.click({ modifiers: ['Control'] });
    await expect(tabNode1).toHaveClass(/bg-gray-500/);
    await expect(tabNode2).toHaveClass(/bg-gray-500/);

    // Act: 通常クリックで3番目のタブを選択
    await tabNode3.click();

    // Assert: 以前の選択がクリアされ、3番目のタブのみが選択されている
    await expect(tabNode1).not.toHaveClass(/bg-gray-500/);
    await expect(tabNode2).not.toHaveClass(/bg-gray-500/);
    await expect(tabNode3).toHaveClass(/bg-gray-500/);

    // クリーンアップ
    await closeTab(extensionContext, tabId1);
    await closeTab(extensionContext, tabId2);
    await closeTab(extensionContext, tabId3);
  });
});
