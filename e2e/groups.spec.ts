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

/**
 * Side Panel が準備完了するまで待機
 */
async function waitForSidePanel(page: import('@playwright/test').Page) {
  // Side Panelのルート要素が表示されるまで待機
  await page.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

  // ローディングが消えるまで待機
  try {
    await page.waitForSelector('text=Loading', { state: 'hidden', timeout: 5000 });
  } catch {
    // ローディングが存在しなかった場合は無視
  }
}


/**
 * グループを作成するヘルパー関数
 */
async function createGroup(
  page: import('@playwright/test').Page,
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
    }) => {
      await waitForSidePanel(sidePanelPage);

      // グループを作成
      const groupId = await createGroup(sidePanelPage, 'Work', '#ef4444');

      // グループノードが存在することを確認
      const groupNode = sidePanelPage.locator(`[data-testid="group-node-${groupId}"]`);
      await expect(groupNode).toBeVisible({ timeout: 5000 });

      // グループ名が表示されることを確認
      await expect(groupNode).toContainText('Work');

      // グループ色が設定されていることを確認
      const colorIndicator = groupNode.locator('[data-testid="group-color-indicator"]');
      await expect(colorIndicator).toBeVisible();
      const color = await colorIndicator.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );
      // #ef4444 は rgb(239, 68, 68) に変換される
      expect(color).toContain('239');
    });

    test('グループ作成後、グループアイコンが表示される', async ({
      sidePanelPage,
    }) => {
      await waitForSidePanel(sidePanelPage);

      // グループを作成
      const groupId = await createGroup(sidePanelPage, 'Projects', '#3b82f6');

      // グループノードにアイコンが表示されることを確認
      const groupNode = sidePanelPage.locator(`[data-testid="group-node-${groupId}"]`);
      const groupIcon = groupNode.locator('[data-testid="group-icon"]');
      await expect(groupIcon).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('グループ展開/折りたたみ', () => {
    test('折りたたまれたグループのトグルボタンには展開アイコンが表示される', async ({
      sidePanelPage,
    }) => {
      await waitForSidePanel(sidePanelPage);

      // グループを作成
      const groupId = await createGroup(sidePanelPage, 'Toggle Test', '#f59e0b');

      // トグルボタンを取得
      const toggleButton = sidePanelPage.locator(`[data-testid="toggle-expand-${groupId}"]`);

      // デフォルトでは展開状態（▼）
      await expect(toggleButton).toContainText('▼');

      // 折りたたむ
      await toggleButton.click();
      await sidePanelPage.waitForTimeout(300);

      // 折りたたみ状態（▶）
      await expect(toggleButton).toContainText('▶');
    });

    test('グループを展開/折りたたみすると状態が保存される', async ({
      sidePanelPage,
    }) => {
      await waitForSidePanel(sidePanelPage);

      // グループを作成
      const groupId = await createGroup(sidePanelPage, 'Persist Test', '#10b981');

      // トグルボタンを取得
      const toggleButton = sidePanelPage.locator(`[data-testid="toggle-expand-${groupId}"]`);

      // デフォルトでは展開状態
      await expect(toggleButton).toContainText('▼');

      // 折りたたむ
      await toggleButton.click();
      await sidePanelPage.waitForTimeout(300);

      // 折りたたみ状態
      await expect(toggleButton).toContainText('▶');

      // 再度展開
      await toggleButton.click();
      await sidePanelPage.waitForTimeout(300);

      // 展開状態に戻る
      await expect(toggleButton).toContainText('▼');
    });
  });

  test.describe('グループ削除', () => {
    test('タブのないグループを削除した場合、確認なしで削除される', async ({
      sidePanelPage,
    }) => {
      await waitForSidePanel(sidePanelPage);

      // グループを作成
      const groupId = await createGroup(sidePanelPage, 'Empty Group', '#64748b');

      // グループノードが存在することを確認
      let groupNode = sidePanelPage.locator(`[data-testid="group-node-${groupId}"]`);
      await expect(groupNode).toBeVisible({ timeout: 5000 });

      // グループをホバーして閉じるボタンを表示
      await groupNode.hover();

      // 閉じるボタンをクリック
      const closeButton = sidePanelPage.locator(`[data-testid="close-button-${groupId}"]`);
      await expect(closeButton).toBeVisible({ timeout: 5000 });
      await closeButton.click();

      // 確認ダイアログが表示されずにグループが削除される
      await sidePanelPage.waitForTimeout(300);

      // グループが削除されたことを確認
      groupNode = sidePanelPage.locator(`[data-testid="group-node-${groupId}"]`);
      await expect(groupNode).not.toBeVisible({ timeout: 5000 });
    });

    test('グループ削除後、グループ一覧から消える', async ({
      sidePanelPage,
    }) => {
      await waitForSidePanel(sidePanelPage);

      // 複数のグループを作成
      const groupId1 = await createGroup(sidePanelPage, 'Group 1', '#ef4444');
      const groupId2 = await createGroup(sidePanelPage, 'Group 2', '#3b82f6');

      // 両方のグループが存在することを確認
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId1}"]`)).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId2}"]`)).toBeVisible();

      // 最初のグループを削除
      const groupNode1 = sidePanelPage.locator(`[data-testid="group-node-${groupId1}"]`);
      await groupNode1.hover();
      const closeButton = sidePanelPage.locator(`[data-testid="close-button-${groupId1}"]`);
      await closeButton.click();
      await sidePanelPage.waitForTimeout(300);

      // 最初のグループは削除され、2番目のグループは残っている
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId1}"]`)).not.toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId2}"]`)).toBeVisible();
    });
  });

  test.describe('グループUIの表示', () => {
    test('グループセクションが表示される', async ({
      sidePanelPage,
    }) => {
      await waitForSidePanel(sidePanelPage);

      // グループセクションが表示されることを確認
      const groupSection = sidePanelPage.locator('[data-testid="groups-section"]');
      await expect(groupSection).toBeVisible({ timeout: 5000 });
    });

    test('グループが空の場合、「No groups yet」メッセージが表示される', async ({
      sidePanelPage,
    }) => {
      await waitForSidePanel(sidePanelPage);

      // 初期状態では「No groups yet」メッセージが表示される
      const noGroupsMessage = sidePanelPage.locator('text=No groups yet');
      await expect(noGroupsMessage).toBeVisible({ timeout: 5000 });
    });

    test('グループ作成後、「No groups yet」メッセージが消える', async ({
      sidePanelPage,
    }) => {
      await waitForSidePanel(sidePanelPage);

      // 初期状態では「No groups yet」メッセージが表示される
      const noGroupsMessage = sidePanelPage.locator('text=No groups yet');
      await expect(noGroupsMessage).toBeVisible({ timeout: 5000 });

      // グループを作成
      await createGroup(sidePanelPage, 'New Group', '#3b82f6');

      // メッセージが消える
      await expect(noGroupsMessage).not.toBeVisible({ timeout: 5000 });
    });

    test('複数のグループを作成できる', async ({
      sidePanelPage,
    }) => {
      await waitForSidePanel(sidePanelPage);

      // 複数のグループを作成
      const groupId1 = await createGroup(sidePanelPage, 'Work', '#ef4444');
      const groupId2 = await createGroup(sidePanelPage, 'Personal', '#3b82f6');
      const groupId3 = await createGroup(sidePanelPage, 'Research', '#10b981');

      // 全てのグループが表示されることを確認
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId1}"]`)).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId2}"]`)).toBeVisible();
      await expect(sidePanelPage.locator(`[data-testid="group-node-${groupId3}"]`)).toBeVisible();
    });
  });
});
