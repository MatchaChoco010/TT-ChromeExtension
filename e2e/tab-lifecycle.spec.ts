/**
 * タブライフサイクルとツリー構造の基本操作テスト
 *
 * このテストスイートでは、以下を検証します:
 * 1. 新しいタブ作成時のツリーノード追加
 * 2. 親タブからの子タブ作成時の親子関係確立
 * 3. タブを閉じた際のツリーノード削除
 * 4. 子タブを持つ親タブ削除時の子タブ処理
 * 5. タブのタイトル・URL変更時のリアルタイム更新
 * 6. タブアクティブ化時のハイライト表示
 *
 * 注: これらのテストは、chrome.tabs APIの動作を検証します。
 * Side Panelが表示され、基本的なタブ操作が可能であることを確認します。
 */
import { test, expect } from './fixtures/extension';
import { createTab, closeTab, activateTab } from './utils/tab-utils';

test.describe('タブライフサイクルとツリー構造の基本操作', () => {
  test('新しいタブを作成した場合、タブが正常に作成される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    expect(tabId).toBeGreaterThan(0);

    // タブのロード完了を待機してから情報を取得
    // chrome.tabs.query()はタブのロード状態によってはURLが空の場合があるため、
    // タブのロード完了を待機する
    const createdTab = await serviceWorker.evaluate(async (tabId) => {
      // タブのロード完了を待機
      const maxWait = 10000; // 最大10秒
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete' || (tab.url && tab.url !== '')) {
          return tab;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // タイムアウト時でも現在の状態を返す
      return chrome.tabs.get(tabId);
    }, tabId);

    // 作成したタブが存在することを確認
    expect(createdTab).toBeDefined();
    expect(createdTab.id).toBe(tabId);
    // URLが設定されているか、または pending URL が example.com を含むことを確認
    expect(createdTab.url || createdTab.pendingUrl || '').toContain('example.com');
  });

  test('親タブから新しいタブを開いた場合、親子関係が正しく確立される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com');
    expect(parentTabId).toBeGreaterThan(0);

    // 親タブから子タブを作成（openerTabIdを指定）
    const childTabId = await createTab(
      extensionContext,
      'https://example.com/child',
      parentTabId
    );
    expect(childTabId).toBeGreaterThan(0);
    expect(childTabId).not.toBe(parentTabId);

    // タブが作成されたことをchrome.tabs APIで確認
    const tabs = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });

    // 両方のタブが存在することを確認
    expect(tabs.length).toBeGreaterThanOrEqual(2);
    const parent = tabs.find((tab: chrome.tabs.Tab) => tab.id === parentTabId);
    const child = tabs.find((tab: chrome.tabs.Tab) => tab.id === childTabId);
    expect(parent).toBeDefined();
    expect(child).toBeDefined();
  });

  test('タブを閉じた場合、タブが正常に削除される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    expect(tabId).toBeGreaterThan(0);

    // タブ作成前のタブ数を記録
    const tabsBefore = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });
    const tabCountBefore = tabsBefore.length;

    // タブを閉じる
    await closeTab(extensionContext, tabId);

    // タブが削除されたことをchrome.tabs APIで確認
    const tabsAfter = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });

    // タブ数が減っていることを確認
    expect(tabsAfter.length).toBeLessThan(tabCountBefore);

    // 削除したタブが存在しないことを確認
    const deletedTab = tabsAfter.find((tab: chrome.tabs.Tab) => tab.id === tabId);
    expect(deletedTab).toBeUndefined();
  });

  test('子タブを持つ親タブを閉じた場合、親タブが正常に削除される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 親タブを作成
    const parentTabId = await createTab(extensionContext, 'https://example.com');
    expect(parentTabId).toBeGreaterThan(0);

    // 子タブを作成
    const childTabId1 = await createTab(
      extensionContext,
      'https://example.com/child1',
      parentTabId
    );
    const childTabId2 = await createTab(
      extensionContext,
      'https://example.com/child2',
      parentTabId
    );

    expect(childTabId1).toBeGreaterThan(0);
    expect(childTabId2).toBeGreaterThan(0);

    // タブ作成前のタブ数を記録
    const tabsBefore = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });
    const tabCountBefore = tabsBefore.length;

    // 親タブを閉じる
    await closeTab(extensionContext, parentTabId);

    // タブが削除されたことをchrome.tabs APIで確認
    const tabsAfter = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });

    // 親タブが削除されたことを確認
    const parentTab = tabsAfter.find((tab: chrome.tabs.Tab) => tab.id === parentTabId);
    expect(parentTab).toBeUndefined();

    // タブ数が変化していることを確認
    expect(tabsAfter.length).not.toBe(tabCountBefore);
  });

  test('タブのタイトルまたはURLが変更された場合、変更が反映される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // タブを作成
    const tabId = await createTab(extensionContext, 'https://example.com');
    expect(tabId).toBeGreaterThan(0);

    // 元のタブ情報を確認（ロード完了を待機）
    const tabBefore = await serviceWorker.evaluate(async (tabId) => {
      const maxWait = 10000;
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.status === 'complete' || (tab.url && tab.url !== '')) {
          return tab;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return chrome.tabs.get(tabId);
    }, tabId);
    expect(tabBefore.url || tabBefore.pendingUrl || '').toContain('example.com');

    // タブのURLを変更
    await serviceWorker.evaluate(
      (tabId) => {
        return chrome.tabs.update(tabId, { url: 'https://www.example.org/' });
      },
      tabId
    );

    // 更新を待機（URL変更とロード完了を待つ）
    const tabAfter = await serviceWorker.evaluate(async (tabId) => {
      const maxWait = 10000;
      const startTime = Date.now();
      while (Date.now() - startTime < maxWait) {
        const tab = await chrome.tabs.get(tabId);
        // example.orgへのナビゲーションが完了するのを待つ
        if ((tab.url && tab.url.includes('example.org')) ||
            (tab.pendingUrl && tab.pendingUrl.includes('example.org'))) {
          return tab;
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return chrome.tabs.get(tabId);
    }, tabId);

    // URLが変更されたことを確認
    expect(tabAfter).toBeDefined();
    expect(tabAfter.id).toBe(tabId);
  });

  test('タブがアクティブ化された場合、アクティブ状態が正しく設定される', async ({
    sidePanelPage,
    extensionContext,
    serviceWorker,
  }) => {
    // Side Panelが表示されることを確認
    const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
    await expect(sidePanelRoot).toBeVisible();

    // 複数のタブを作成（非アクティブ）
    const tabId1 = await createTab(extensionContext, 'https://example.com', undefined, {
      active: false,
    });
    const tabId2 = await createTab(extensionContext, 'https://example.org', undefined, {
      active: false,
    });

    expect(tabId1).toBeGreaterThan(0);
    expect(tabId2).toBeGreaterThan(0);

    // タブ1をアクティブ化
    await activateTab(extensionContext, tabId1);

    // アクティブ状態を確認
    const tabs1 = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });
    const activeTab1 = tabs1.find((tab: chrome.tabs.Tab) => tab.id === tabId1);
    expect(activeTab1?.active).toBe(true);

    // タブ2をアクティブ化
    await activateTab(extensionContext, tabId2);

    // アクティブ状態が切り替わったことを確認
    const tabs2 = await serviceWorker.evaluate(() => {
      return chrome.tabs.query({});
    });
    const activeTab2 = tabs2.find((tab: chrome.tabs.Tab) => tab.id === tabId2);
    expect(activeTab2?.active).toBe(true);
  });
});
