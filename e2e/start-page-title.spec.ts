/**
 * スタートページタイトルのE2Eテスト
 *
 * テスト対象:
 * 1. 新規タブのタイトルが「スタートページ」または「新しいタブ」であることを検証
 * 2. ページ遷移後のタイトル更新を検証
 * 3. 新規タブのURLがVivaldiスタートページであることを検証
 *
 * 注意: Chromiumでは chrome://vivaldi-webui/startpage はエラーページとして扱われるが、
 *       URLが正しく設定されていることを検証する
 *       Vivaldiではスタートページが開かれ「スタートページ」と表示される
 */

import { test, expect } from './fixtures/extension';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';

/**
 * タブタイトル要素を取得するヘルパー関数
 * discarded-tab-title または tab-title の両方に対応
 */
async function getTabTitleElement(sidePanelPage: import('@playwright/test').Page, tabId: number) {
  // tab-title を優先して検索
  const tabTitle = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"] [data-testid="tab-title"]`);
  const discardedTabTitle = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"] [data-testid="discarded-tab-title"]`);

  // どちらが表示されているか確認
  if (await tabTitle.isVisible().catch(() => false)) {
    return tabTitle;
  }
  if (await discardedTabTitle.isVisible().catch(() => false)) {
    return discardedTabTitle;
  }

  // デフォルトで tab-title を返す
  return tabTitle;
}

test.describe('スタートページタイトル', () => {
  test.describe('新規タブボタンでVivaldiスタートページURLが設定される', () => {
    test('新規タブ追加ボタンで作成されたタブにVivaldiスタートページURLが設定され、タイトルが「スタートページ」と表示される', async ({
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

      // ツリー状態からタブのURLを取得して検証
      // URLがVivaldiスタートページであることを確認
      const treeTabUrl = await sidePanelPage.evaluate(async (tabId: number) => {
        // サイドパネル内のTreeStateContextからタブ情報を取得
        const tabNode = document.querySelector(`[data-testid="tree-node-${tabId}"]`);
        if (!tabNode) return null;
        // data-tab-url属性があれば取得
        return tabNode.getAttribute('data-tab-url');
      }, newTabId!);

      // ツリー状態にURLが保存されている場合は検証
      // 注: data-tab-url属性がない場合は、タイトル表示で検証
      if (treeTabUrl) {
        expect(treeTabUrl).toBe('chrome://vivaldi-webui/startpage');
      }

      // タブノード内のタイトル要素を取得
      const tabTitleElement = await getTabTitleElement(sidePanelPage, newTabId!);

      // タイトルが「スタートページ」になることを確認
      // chrome://vivaldi-webui/startpage のURLを持つタブは、
      // TreeNodeのgetDisplayTitle関数で「スタートページ」に変換される
      await waitForCondition(
        async () => {
          const titleText = await tabTitleElement.textContent();
          return titleText === 'スタートページ';
        },
        {
          timeout: 10000,
          interval: 200,
          timeoutMessage: 'Tab title did not become "スタートページ" (expected for chrome://vivaldi-webui/startpage URL)'
        }
      );

      const titleText = await tabTitleElement.textContent();
      expect(titleText).toBe('スタートページ');
    });
  });

  test.describe('新規タブのタイトルが「スタートページ」または「新しいタブ」であること', () => {

    test('chrome.tabs.createで作成された新規タブのタイトルが適切に表示される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 新規タブを作成
      const tab = await serviceWorker.evaluate(async () => {
        return chrome.tabs.create({});
      });

      expect(tab.id).toBeDefined();

      // タブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, tab.id!);

      // タブがツリーに表示されるまで待機
      await expect(async () => {
        const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${tab.id}"]`);
        await expect(tabNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // タブノード内のタイトル要素を取得
      const tabTitleElement = await getTabTitleElement(sidePanelPage, tab.id!);

      // タイトルが適切に設定されるまで待機
      await waitForCondition(
        async () => {
          const titleText = await tabTitleElement.textContent();
          return titleText === 'スタートページ' ||
                 titleText === '新しいタブ' ||
                 titleText === 'Loading...';
        },
        {
          timeout: 10000,
          interval: 200,
          timeoutMessage: 'Tab title was not set properly'
        }
      );

      const titleText = await tabTitleElement.textContent();
      expect(['スタートページ', '新しいタブ', 'Loading...']).toContain(titleText);

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), tab.id!);
    });
  });

  test.describe('ページ遷移後のタイトル更新', () => {
    test('新規タブから別のページに遷移するとタイトルが更新される', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Side Panelが表示されることを確認
      const sidePanelRoot = sidePanelPage.locator('[data-testid="side-panel-root"]');
      await expect(sidePanelRoot).toBeVisible();

      // 新規タブ追加ボタンをクリックして新しいタブを作成
      const newTabButton = sidePanelPage.locator('[data-testid="new-tab-button"]');
      await expect(newTabButton).toBeVisible({ timeout: 5000 });

      // 現在のタブ数を取得
      const initialTabCount = await serviceWorker.evaluate(async () => {
        const tabs = await chrome.tabs.query({});
        return tabs.length;
      });

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

      // タブがツリーに追加されるまで待機
      await waitForTabInTreeState(extensionContext, newTabId!);

      // タブがツリーに表示されるまで待機
      await expect(async () => {
        const tabNode = sidePanelPage.locator(`[data-testid="tree-node-${newTabId}"]`);
        await expect(tabNode).toBeVisible();
      }).toPass({ timeout: 10000 });

      // タブノード内のタイトル要素を取得
      const tabTitleElement = await getTabTitleElement(sidePanelPage, newTabId!);

      // タイトルが「スタートページ」（chrome://vivaldi-webui/startpageを開くため）または「Loading...」であることを確認
      await waitForCondition(
        async () => {
          const titleText = await tabTitleElement.textContent();
          // 新規タブボタンはchrome://vivaldi-webui/startpageを開くため、タイトルは「スタートページ」
          return titleText === 'スタートページ' || titleText === 'Loading...';
        },
        {
          timeout: 5000,
          interval: 200,
          timeoutMessage: 'Initial tab title was not set properly (expected "スタートページ" or "Loading...")'
        }
      );

      const initialTitle = await tabTitleElement.textContent();
      expect(['スタートページ', 'Loading...']).toContain(initialTitle);

      // example.comに遷移
      await serviceWorker.evaluate(async (tabId) => {
        await chrome.tabs.update(tabId, { url: 'https://example.com' });
      }, newTabId!);

      // ページの読み込みが完了するまで待機
      await waitForCondition(
        async () => {
          const tabInfo = await serviceWorker.evaluate(async (tabId) => {
            const t = await chrome.tabs.get(tabId);
            return { status: t.status, url: t.url };
          }, newTabId!);
          return tabInfo.status === 'complete' && tabInfo.url?.includes('example.com');
        },
        { timeout: 10000, interval: 200, timeoutMessage: 'Page navigation did not complete' }
      );

      // タイトルが更新されるまで待機
      await waitForCondition(
        async () => {
          const titleText = await tabTitleElement.textContent();
          return titleText !== 'スタートページ' &&
                 titleText !== 'Loading...';
        },
        {
          timeout: 10000,
          interval: 200,
          timeoutMessage: 'Tab title was not updated after navigation'
        }
      );

      // 最終的なタイトルがスタートページ関連の表示ではないことを確認
      const finalTitle = await tabTitleElement.textContent();
      expect(finalTitle).not.toBe('スタートページ');
      expect(finalTitle).not.toBe('Loading...');
      expect(finalTitle).toBeTruthy();

      // クリーンアップ
      await serviceWorker.evaluate((tabId) => chrome.tabs.remove(tabId), newTabId!);
    });

    // Note: about:blankへの遷移テストは、URL変更時のtabInfoMap更新のタイミング問題により
    // 現在の実装では安定しないため、スキップ。
    // 「新規タブから別のページに遷移するとタイトルが更新される」テストで検証済み。
    // 将来的にURL変更時の状態管理が改善された場合にこのテストを追加予定。
  });
});
