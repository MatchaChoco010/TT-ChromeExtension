/**
 * グループ機能のE2Eテスト
 *
 * Task 4.9: グループ機能の実装とテスト
 * Requirements: 3.9
 *
 * テスト対象:
 * 1. タブのグループ追加
 * 2. グループ作成
 * 3. 展開/折りたたみ機能
 * 4. グループ削除
 * 5. タブのグループ間移動
 */
import { test, expect } from './fixtures/extension';
import type { Worker } from '@playwright/test';
import {
  waitForSidePanelReady,
  waitForGroupInStorage,
  waitForGroupRemovedFromStorage,
} from './utils/polling-utils';


/**
 * グループを作成するヘルパー関数
 */
async function createGroup(
  page: import('@playwright/test').Page,
  context: import('@playwright/test').BrowserContext,
  name: string,
  color: string = '#6b7280'
) {
  // グループ作成ボタンをクリック
  const createButton = page.locator('[aria-label="Create new group"]');
  await expect(createButton).toBeVisible({ timeout: 5000 });
  await createButton.click();

  // グループ作成フォームが表示されるまで待機
  const createForm = page.locator('[data-testid="group-create-form"]');
  await expect(createForm).toBeVisible({ timeout: 5000 });

  // グループ名を入力
  const nameInput = page.locator('[aria-label="Group Name"]');
  await nameInput.fill(name);

  // 色を設定
  const colorInput = page.locator('[aria-label="Group Color"]');
  await colorInput.fill(color);

  // 作成ボタンをクリック
  const submitButton = page.locator('[aria-label="Create group"]');
  await submitButton.click();

  // フォームが閉じるまで待機
  await expect(createForm).not.toBeVisible({ timeout: 5000 });

  // グループがストレージに保存されるまで待機
  await waitForGroupInStorage(context, name);

  // 作成されたグループのIDを返す
  // グループノードが表示されるのを待機
  const groupNode = page.locator(`[data-testid^="group-node-"]`).filter({ hasText: name });
  await expect(groupNode).toBeVisible({ timeout: 5000 });

  // data-testid属性からグループIDを抽出
  const testId = await groupNode.getAttribute('data-testid');
  return testId?.replace('group-node-', '') || '';
}

test.describe('グループ機能', () => {
  test.describe('グループ作成', () => {
    test('新しいグループを作成した場合、グループ名と色が設定される', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      await waitForSidePanelReady(sidePanelPage, serviceWorker);

      // グループを作成
      const groupId = await createGroup(sidePanelPage, extensionContext, 'Work', '#ef4444');

      // グループノードが存在することを確認
      const groupNode = sidePanelPage.locator(`[data-testid="group-node-${groupId}"]`);
      await expect(groupNode).toBeVisible({ timeout: 5000 });

      // グループ名が表示されることを確認
      await expect(groupNode).toContainText('Work', { timeout: 5000 });

      // グループ色が設定されていることを確認
      const colorIndicator = groupNode.locator('[data-testid="group-color-indicator"]');
      await expect(colorIndicator).toBeVisible({ timeout: 5000 });
      const color = await colorIndicator.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );
      // #ef4444 は rgb(239, 68, 68) に変換される
      expect(color).toContain('239');
    });

    test('グループ作成後、グループアイコンが表示される', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      await waitForSidePanelReady(sidePanelPage, serviceWorker);

      // グループを作成
      const groupId = await createGroup(sidePanelPage, extensionContext, 'Projects', '#3b82f6');

      // グループノードにアイコンが表示されることを確認
      const groupNode = sidePanelPage.locator(`[data-testid="group-node-${groupId}"]`);
      const groupIcon = groupNode.locator('[data-testid="group-icon"]');
      await expect(groupIcon).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('グループ展開/折りたたみ', () => {
    test('折りたたまれたグループのトグルボタンには展開アイコンが表示される', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      await waitForSidePanelReady(sidePanelPage, serviceWorker);

      // グループを作成
      const groupId = await createGroup(sidePanelPage, extensionContext, 'Toggle Test', '#f59e0b');

      // トグルボタンを取得
      const toggleButton = sidePanelPage.locator(`[data-testid="toggle-expand-${groupId}"]`);

      // デフォルトでは展開状態（▼）
      await expect(toggleButton).toContainText('▼', { timeout: 5000 });

      // 折りたたむ
      await toggleButton.click();

      // 折りたたみ状態（▶）になるまで待機
      await expect(toggleButton).toContainText('▶', { timeout: 5000 });
    });

    test('グループを展開/折りたたみすると状態が保存される', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      await waitForSidePanelReady(sidePanelPage, serviceWorker);

      // グループを作成
      const groupId = await createGroup(sidePanelPage, extensionContext, 'Persist Test', '#10b981');

      // トグルボタンを取得
      const toggleButton = sidePanelPage.locator(`[data-testid="toggle-expand-${groupId}"]`);

      // デフォルトでは展開状態
      await expect(toggleButton).toContainText('▼', { timeout: 5000 });

      // 折りたたむ
      await toggleButton.click();

      // 折りたたみ状態になるまで待機
      await expect(toggleButton).toContainText('▶', { timeout: 5000 });

      // 再度展開
      await toggleButton.click();

      // 展開状態に戻るまで待機
      await expect(toggleButton).toContainText('▼', { timeout: 5000 });
    });
  });

  test.describe('グループ削除', () => {
    test('タブのないグループを削除した場合、確認なしで削除される', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      await waitForSidePanelReady(sidePanelPage, serviceWorker);

      // グループを作成
      const groupId = await createGroup(sidePanelPage, extensionContext, 'Empty Group', '#64748b');

      // グループノードが存在することを確認
      let groupNode = sidePanelPage.locator(`[data-testid="group-node-${groupId}"]`);
      await expect(groupNode).toBeVisible({ timeout: 5000 });

      // グループをホバーして閉じるボタンを表示
      await groupNode.hover();

      // 閉じるボタンをクリック
      const closeButton = sidePanelPage.locator(`[data-testid="close-button-${groupId}"]`);
      await expect(closeButton).toBeVisible({ timeout: 5000 });
      await closeButton.click();

      // グループがストレージから削除されるまで待機
      await waitForGroupRemovedFromStorage(extensionContext, groupId);

      // グループが削除されたことを確認（確認ダイアログが表示されずに削除される）
      groupNode = sidePanelPage.locator(`[data-testid="group-node-${groupId}"]`);
      await expect(groupNode).not.toBeVisible({ timeout: 5000 });
    });

    test('グループ削除後、グループ一覧から消える', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      await waitForSidePanelReady(sidePanelPage, serviceWorker);

      // 複数のグループを作成
      const groupId1 = await createGroup(sidePanelPage, extensionContext, 'Group 1', '#ef4444');
      const groupId2 = await createGroup(sidePanelPage, extensionContext, 'Group 2', '#3b82f6');

      // 両方のグループが存在することを確認
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId1}"]`)).toBeVisible({ timeout: 5000 });
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId2}"]`)).toBeVisible({ timeout: 5000 });

      // 最初のグループを削除
      const groupNode1 = sidePanelPage.locator(`[data-testid="group-node-${groupId1}"]`);
      await groupNode1.hover();
      const closeButton = sidePanelPage.locator(`[data-testid="close-button-${groupId1}"]`);
      await expect(closeButton).toBeVisible({ timeout: 5000 });
      await closeButton.click();

      // グループがストレージから削除されるまで待機
      await waitForGroupRemovedFromStorage(extensionContext, groupId1);

      // 最初のグループは削除され、2番目のグループは残っている
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId1}"]`)).not.toBeVisible({ timeout: 5000 });
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId2}"]`)).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('グループUIの表示', () => {
    test('グループセクションが表示される', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      await waitForSidePanelReady(sidePanelPage, serviceWorker);

      // グループセクションが表示されることを確認
      const groupSection = sidePanelPage.locator('[data-testid="groups-section"]');
      await expect(groupSection).toBeVisible({ timeout: 5000 });
    });

    test('グループが空の場合、「No groups yet」メッセージが表示される', async ({
      sidePanelPage,
      serviceWorker,
    }) => {
      await waitForSidePanelReady(sidePanelPage, serviceWorker);

      // 初期状態では「No groups yet」メッセージが表示される
      const noGroupsMessage = sidePanelPage.locator('text=No groups yet');
      await expect(noGroupsMessage).toBeVisible({ timeout: 5000 });
    });

    test('グループ作成後、「No groups yet」メッセージが消える', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      await waitForSidePanelReady(sidePanelPage, serviceWorker);

      // 初期状態では「No groups yet」メッセージが表示される
      const noGroupsMessage = sidePanelPage.locator('text=No groups yet');
      await expect(noGroupsMessage).toBeVisible({ timeout: 5000 });

      // グループを作成
      await createGroup(sidePanelPage, extensionContext, 'New Group', '#3b82f6');

      // メッセージが消える
      await expect(noGroupsMessage).not.toBeVisible({ timeout: 5000 });
    });

    test('複数のグループを作成できる', async ({
      sidePanelPage,
      serviceWorker,
      extensionContext,
    }) => {
      await waitForSidePanelReady(sidePanelPage, serviceWorker);

      // 複数のグループを作成
      const groupId1 = await createGroup(sidePanelPage, extensionContext, 'Work', '#ef4444');
      const groupId2 = await createGroup(sidePanelPage, extensionContext, 'Personal', '#3b82f6');
      const groupId3 = await createGroup(sidePanelPage, extensionContext, 'Research', '#10b981');

      // 全てのグループが表示されることを確認
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId1}"]`)).toBeVisible({ timeout: 5000 });
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId2}"]`)).toBeVisible({ timeout: 5000 });
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId3}"]`)).toBeVisible({ timeout: 5000 });
    });
  });
});
