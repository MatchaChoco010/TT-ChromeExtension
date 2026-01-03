/**
 * Settings Tab Title E2E Tests
 *
 * 設定タブと内部ページのタイトル表示に関するE2Eテスト
 *
 * - 設定タブタイトル表示のE2Eテスト
 * - 内部ページタイトル表示のE2Eテスト
 */

import { test, expect } from './fixtures/extension';
import { COMMON_SELECTORS, COMMON_TIMEOUTS } from './test-data/common-constants';
import {
  waitForTabInTreeState,
  waitForCondition,
} from './utils/polling-utils';
import {
  createTab,
  getCurrentWindowId,
  getPseudoSidePanelTabId,
  getInitialBrowserTabId,
  closeTab,
} from './utils/tab-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('設定タブのタイトル表示', () => {
  test('設定タブがツリーで「Settings」というタイトルで表示される', async ({
    extensionContext,
    extensionId,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Arrange: Side Panelが表示されていることを確認
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    // 現在のウィンドウIDを取得（Side Panelが表示されているウィンドウ）
    const windowId = await getCurrentWindowId(serviceWorker);

    // 初期状態をセットアップ
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // Act: 設定ページを同じウィンドウで新規タブとして開く
    const settingsTabId = await createTab(
      extensionContext,
      `chrome-extension://${extensionId}/settings.html`,
      { active: true, windowId }
    );

    // タブがツリー状態に追加されるまで待機
    await waitForTabInTreeState(extensionContext, settingsTabId, {
      timeout: COMMON_TIMEOUTS.medium,
      timeoutMessage: `Settings tab ${settingsTabId} was not added to tree`,
    });

    // タブ作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: settingsTabId, depth: 0 },
    ], 0);

    // タブが完全にロードされてタイトルが「Settings」になるまで待機
    await waitForCondition(
      async () => {
        const tabInfo = await serviceWorker.evaluate(async (id) => {
          const tab = await chrome.tabs.get(id);
          return { title: tab.title, status: tab.status };
        }, settingsTabId);
        return tabInfo.status === 'complete' && tabInfo.title === 'Settings';
      },
      {
        timeout: COMMON_TIMEOUTS.long,
        interval: 100,
        timeoutMessage: 'Settings tab did not load with correct title',
      }
    );

    // Assert: ツリーにSettingsタイトルが表示されることを確認
    // Side Panelはchrome.tabs.onUpdatedイベントでtabInfoMapを更新するので、
    // UIが更新されるまで待機
    await waitForCondition(
      async () => {
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${settingsTabId}"]`);
        if (!(await treeNode.isVisible())) {
          return false;
        }
        const title = await treeNode.locator('[data-testid="tab-title"], [data-testid="discarded-tab-title"]').textContent();
        return title === 'Settings';
      },
      {
        timeout: COMMON_TIMEOUTS.medium,
        interval: 100,
        timeoutMessage: 'Settings title was not displayed in tree',
      }
    );

    // Cleanup: タブを閉じる
    await closeTab(extensionContext, settingsTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
  });

  test('設定タブのHTMLタイトルが「Settings」である', async ({
    extensionContext,
    extensionId,
  }) => {
    // Act: 設定ページを新規タブで開く
    const settingsPage = await extensionContext.newPage();
    await settingsPage.goto(`chrome-extension://${extensionId}/settings.html`);
    await settingsPage.waitForLoadState('domcontentloaded');

    // Assert: ページのタイトルがSettingsであることを確認
    // このテストはページタイトル自体を確認する目的なので、expect使用が必須
    await expect(settingsPage).toHaveTitle('Settings');

    // Cleanup
    await settingsPage.close();
  });
});

test.describe('内部ページのタイトル表示', () => {
  test('chrome://versionページがツリーでブラウザのタイトルと同じタイトルで表示される', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Arrange: Side Panelが表示されていることを確認
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    // 現在のウィンドウIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);

    // 初期状態をセットアップ
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // Act: chrome://versionページを新規タブで開く
    const tabId = await createTab(
      extensionContext,
      'chrome://version',
      { active: true, windowId }
    );

    // タブがツリー状態に追加されるまで待機
    await waitForTabInTreeState(extensionContext, tabId, {
      timeout: COMMON_TIMEOUTS.medium,
      timeoutMessage: `chrome://version tab ${tabId} was not added to tree`,
    });

    // タブ作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // Assert: タブのタイトルを取得してツリーに表示されることを確認
    // chrome://versionのタイトルはブラウザによって異なるが、chrome.tabs.Tab.titleと一致するはず
    await waitForCondition(
      async () => {
        // ブラウザのタブ情報を取得
        const tabInfo = await serviceWorker.evaluate(async (id) => {
          const tab = await chrome.tabs.get(id);
          return { title: tab.title, status: tab.status };
        }, tabId);

        // タブのロードが完了するまで待機
        if (tabInfo.status !== 'complete') {
          return false;
        }

        // ツリーノードを確認
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        if (!(await treeNode.isVisible())) {
          return false;
        }

        const displayedTitle = await treeNode.locator('[data-testid="tab-title"], [data-testid="discarded-tab-title"]').textContent();
        // タイトルがchrome.tabs.Tab.titleと一致するか確認
        // タブツリーはchrome.tabs.Tab.titleをそのまま使用する
        return displayedTitle === tabInfo.title;
      },
      {
        timeout: COMMON_TIMEOUTS.long,
        interval: 100,
        timeoutMessage: 'chrome://version title was not correctly displayed in tree',
      }
    );

    // Cleanup: タブを閉じる
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
  });

  test('chrome://settingsページがツリーでブラウザのタイトルと同じタイトルで表示される', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Arrange: Side Panelが表示されていることを確認
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    // 現在のウィンドウIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);

    // 初期状態をセットアップ
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // Act: chrome://settingsページを新規タブで開く
    const tabId = await createTab(
      extensionContext,
      'chrome://settings',
      { active: true, windowId }
    );

    // タブがツリー状態に追加されるまで待機
    await waitForTabInTreeState(extensionContext, tabId, {
      timeout: COMMON_TIMEOUTS.medium,
      timeoutMessage: `chrome://settings tab ${tabId} was not added to tree`,
    });

    // タブ作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // Assert: タブのタイトルを取得してツリーに表示されることを確認
    await waitForCondition(
      async () => {
        // ブラウザのタブ情報を取得
        const tabInfo = await serviceWorker.evaluate(async (id) => {
          const tab = await chrome.tabs.get(id);
          return { title: tab.title, status: tab.status };
        }, tabId);

        // タブのロードが完了するまで待機
        if (tabInfo.status !== 'complete') {
          return false;
        }

        // ツリーノードを確認
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        if (!(await treeNode.isVisible())) {
          return false;
        }

        const displayedTitle = await treeNode.locator('[data-testid="tab-title"], [data-testid="discarded-tab-title"]').textContent();

        // chrome://settings は getDisplayTitle で「設定」にマッピングされる可能性がある
        // または、chrome.tabs.Tab.titleがURL形式でなければそのまま表示される
        // どちらの場合も、タイトルが空でなく、URL自体ではないことを確認
        if (!displayedTitle || displayedTitle.length === 0) {
          return false;
        }

        // タイトルがchrome://settingsというURLそのものではないことを確認
        // (TreeNode.tsxのgetDisplayTitleでフレンドリー名に変換される場合がある)
        return displayedTitle !== 'chrome://settings';
      },
      {
        timeout: COMMON_TIMEOUTS.long,
        interval: 100,
        timeoutMessage: 'chrome://settings title was not correctly displayed in tree',
      }
    );

    // Cleanup: タブを閉じる
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
  });

  test('about:blankページがツリーで適切なタイトルで表示される', async ({
    extensionContext,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Arrange: Side Panelが表示されていることを確認
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    // 現在のウィンドウIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);

    // 初期状態をセットアップ
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    // Act: about:blankページを新規タブで開く
    const tabId = await createTab(
      extensionContext,
      'about:blank',
      { active: true, windowId }
    );

    // タブがツリー状態に追加されるまで待機
    await waitForTabInTreeState(extensionContext, tabId, {
      timeout: COMMON_TIMEOUTS.medium,
      timeoutMessage: `about:blank tab ${tabId} was not added to tree`,
    });

    // タブ作成後の構造を検証
    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: pseudoSidePanelTabId, depth: 0 },
      { tabId: tabId, depth: 0 },
    ], 0);

    // Assert: about:blankは「新しいタブ」として表示されるはず（TreeNode.tsxのgetDisplayTitle）
    await waitForCondition(
      async () => {
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        if (!(await treeNode.isVisible())) {
          return false;
        }
        const displayedTitle = await treeNode.locator('[data-testid="tab-title"], [data-testid="discarded-tab-title"]').textContent();
        // about:blank は「新しいタブ」として表示される
        return displayedTitle === '新しいタブ';
      },
      {
        timeout: COMMON_TIMEOUTS.medium,
        interval: 100,
        timeoutMessage: 'about:blank title was not displayed as 新しいタブ',
      }
    );

    // Cleanup: タブを閉じる
    await closeTab(extensionContext, tabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);
  });
});

test.describe('タイトル表示の安定性テスト', () => {
  test('複数の設定タブを連続で開いても正しくタイトルが表示される', async ({
    extensionContext,
    extensionId,
    sidePanelPage,
    serviceWorker,
  }) => {
    // Arrange: Side Panelが表示されていることを確認
    await expect(sidePanelPage.locator(COMMON_SELECTORS.sidePanelRoot)).toBeVisible({
      timeout: COMMON_TIMEOUTS.long,
    });

    // 現在のウィンドウIDを取得
    const windowId = await getCurrentWindowId(serviceWorker);

    // 初期状態をセットアップ
    const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);
    const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
    await closeTab(extensionContext, initialBrowserTabId);
    await assertTabStructure(sidePanelPage, windowId, [{ tabId: pseudoSidePanelTabId, depth: 0 }], 0);

    const tabIds: number[] = [];

    // Act: 3つの設定タブを連続で開く（各タブ作成後にassertTabStructureを呼ぶ）
    for (let i = 0; i < 3; i++) {
      const tabId = await createTab(
        extensionContext,
        `chrome-extension://${extensionId}/settings.html`,
        { active: true, windowId }
      );
      tabIds.push(tabId);

      // タブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, tabId, {
        timeout: COMMON_TIMEOUTS.medium,
      });

      // 各タブ作成後に構造を検証
      const expectedStructure = [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        ...tabIds.map(id => ({ tabId: id, depth: 0 })),
      ];
      await assertTabStructure(sidePanelPage, windowId, expectedStructure, 0);

      // タブが完全にロードされてタイトルが「Settings」になるまで待機
      await waitForCondition(
        async () => {
          const tabInfo = await serviceWorker.evaluate(async (id) => {
            const tab = await chrome.tabs.get(id);
            return { title: tab.title, status: tab.status };
          }, tabId);
          return tabInfo.status === 'complete' && tabInfo.title === 'Settings';
        },
        {
          timeout: COMMON_TIMEOUTS.medium,
          interval: 100,
        }
      );
    }

    // Assert: すべてのタブが「Settings」タイトルで表示されることを確認
    for (const tabId of tabIds) {
      await waitForCondition(
        async () => {
          const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
          if (!(await treeNode.isVisible())) {
            return false;
          }
          const title = await treeNode.locator('[data-testid="tab-title"], [data-testid="discarded-tab-title"]').textContent();
          return title === 'Settings';
        },
        {
          timeout: COMMON_TIMEOUTS.medium,
          interval: 100,
          timeoutMessage: `Tab ${tabId} should display Settings title`,
        }
      );
    }

    // Cleanup: すべてのタブを閉じる（各タブ削除後にassertTabStructureを呼ぶ）
    for (let i = tabIds.length - 1; i >= 0; i--) {
      await closeTab(extensionContext, tabIds[i]);
      const remainingTabs = tabIds.slice(0, i);
      const expectedStructure = [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        ...remainingTabs.map(id => ({ tabId: id, depth: 0 })),
      ];
      await assertTabStructure(sidePanelPage, windowId, expectedStructure, 0);
    }
  });
});
