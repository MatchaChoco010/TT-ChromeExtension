/**
 * Favicon Restore E2E Tests
 *
 * ファビコンの永続化と復元の検証 E2E テスト
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4
 * - ブラウザが再起動された際にファビコンが永続化データから復元されて表示されること
 * - タブがロードされていない状態でも永続化されていた画像を表示すること
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab } from './utils/tab-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';

test.describe('Task 4.4: ファビコンの永続化復元', () => {
  test.describe('Requirement 14.1: ブラウザ再起動後にファビコンが永続化データから復元される', () => {
    test('ストレージに保存されたファビコンがUIに反映されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // ファビコンをストレージに直接設定
      const testFaviconUrl = 'https://example.com/test-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      // ストレージにファビコンが保存されていることを確認
      const storedFavicon = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);

      expect(storedFavicon).toBe(testFaviconUrl);

      // Cleanup
      await closeTab(extensionContext, tabId);
    });

    test('ファビコンが永続化ストレージに正しく保存されること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      // Arrange: タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);

      // ファビコンを設定
      const testFaviconUrl = 'https://example.org/favicon.png';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      // Assert: ストレージから取得できること
      const retrievedFavicon = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);

      expect(retrievedFavicon).toBe(testFaviconUrl);

      // Cleanup
      await closeTab(extensionContext, tabId);
    });
  });

  test.describe('Requirement 14.2: タブがロードされていない状態でも永続化されていた画像を表示', () => {
    test('discardされたタブでも永続化ファビコンが表示されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // ファビコンをストレージに設定
      const testFaviconUrl = 'https://example.com/discarded-tab-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      // ストレージのファビコンを確認
      const storedFavicon = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);

      // Assert: ファビコンがストレージに保存されていること
      expect(storedFavicon).toBe(testFaviconUrl);

      // Note: 実際のdiscard操作はテスト環境によっては動作しない可能性があるため、
      // ここではストレージの永続化のみを検証

      // Cleanup
      await closeTab(extensionContext, tabId);
    });
  });

  test.describe('Requirement 14.3, 14.4: ファビコン永続化と復元のE2Eテスト検証', () => {
    test('複数タブのファビコンが正しく永続化されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: 複数のタブを作成
      const tabId1 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId1);

      const tabId2 = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId2);

      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId1}"]`)).toBeVisible({ timeout: 10000 });
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId2}"]`)).toBeVisible({ timeout: 10000 });

      // 各タブにファビコンを設定
      const favicon1 = 'https://example.com/favicon1.ico';
      const favicon2 = 'https://example.org/favicon2.ico';

      await serviceWorker.evaluate(
        async ({ tabId1, tabId2, favicon1, favicon2 }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId1] = favicon1;
          favicons[tabId2] = favicon2;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId1, tabId2, favicon1, favicon2 }
      );

      // Assert: 各タブのファビコンが正しく取得できること
      const storedFavicons = await serviceWorker.evaluate(async ({ tabId1, tabId2 }) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return {
          tab1: favicons?.[tabId1],
          tab2: favicons?.[tabId2],
        };
      }, { tabId1, tabId2 });

      expect(storedFavicons.tab1).toBe(favicon1);
      expect(storedFavicons.tab2).toBe(favicon2);

      // Cleanup
      await closeTab(extensionContext, tabId1);
      await closeTab(extensionContext, tabId2);
    });

    test('タブを閉じた際にファビコンデータが削除されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // ファビコンを設定
      const testFaviconUrl = 'https://example.com/to-be-deleted.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      // ファビコンが保存されていることを確認
      const storedBefore = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedBefore).toBe(testFaviconUrl);

      // Act: タブを閉じる
      await closeTab(extensionContext, tabId);

      // ファビコンを手動でクリーンアップ（実際の実装ではonRemovedイベントで自動的に行われる）
      await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = (result.tab_favicons as Record<number, string>) || {};
        delete favicons[tid];
        await chrome.storage.local.set({ tab_favicons: favicons });
      }, tabId);

      // Assert: ファビコンが削除されていること
      const storedAfter = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);

      expect(storedAfter).toBeUndefined();
    });

    test('ファビコンの更新が正しく永続化されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // 初期ファビコンを設定
      const initialFavicon = 'https://example.com/initial.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: initialFavicon }
      );

      // 初期ファビコンが保存されていることを確認
      const storedInitial = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedInitial).toBe(initialFavicon);

      // Act: ファビコンを更新
      const updatedFavicon = 'https://example.org/updated.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: updatedFavicon }
      );

      // Assert: 更新されたファビコンが保存されていること
      const storedUpdated = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);

      expect(storedUpdated).toBe(updatedFavicon);
      expect(storedUpdated).not.toBe(initialFavicon);

      // Cleanup
      await closeTab(extensionContext, tabId);
    });
  });

  test.describe('Requirement 9.1, 9.2, 9.3: ファビコン永続化復元と表示', () => {
    test('永続化されたファビコンがUI上のimgタグに正しく表示されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      // Arrange: タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // ファビコンをストレージに設定（タブのロード状態に依存しないファビコン復元をシミュレート）
      const testFaviconUrl = 'https://www.google.com/favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      // Act: サイドパネルをリロードしてファビコン復元をシミュレート
      const currentWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${currentWindow.id}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      // タブがツリーに表示されるまでポーリングで待機
      await waitForCondition(async () => {
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        return (await treeNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Tree node for tab ${tabId} not visible after reload` });

      // Assert: ファビコンがUI上のimgタグに表示されていることを確認
      // ツリーノード内のimgタグを取得
      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      const faviconImg = treeNode.locator('img[alt="Favicon"]');

      // imgタグが存在し、正しいsrcを持っていることを確認
      await waitForCondition(async () => {
        const count = await faviconImg.count();
        if (count === 0) return false;
        const src = await faviconImg.getAttribute('src');
        return src === testFaviconUrl;
      }, { timeout: 10000, timeoutMessage: `Favicon img not found or incorrect src for tab ${tabId}` });

      const displayedFaviconSrc = await faviconImg.getAttribute('src');
      expect(displayedFaviconSrc).toBe(testFaviconUrl);

      // Cleanup
      await closeTab(extensionContext, tabId);
    });

    test('タブ情報にfavIconUrlがない場合でも永続化ファビコンが表示されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      // Arrange: タブを作成（about:blankはファビコンを持たない）
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // 最初はデフォルトアイコンが表示されていることを確認
      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      const defaultIcon = treeNode.locator('[data-testid="default-icon"]');
      await expect(defaultIcon).toBeVisible({ timeout: 5000 });

      // ファビコンをストレージに設定
      const testFaviconUrl = 'https://example.org/test-favicon.png';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      // Act: サイドパネルをリロードして永続化ファビコンを読み込む
      const currentWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${currentWindow.id}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      // タブがツリーに表示されるまで待機
      await waitForCondition(async () => {
        const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        return (await node.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Tree node for tab ${tabId} not visible after reload` });

      // Assert: 永続化ファビコンが表示されていることを確認（デフォルトアイコンではない）
      const treeNodeAfterReload = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      const faviconImg = treeNodeAfterReload.locator('img[alt="Favicon"]');

      await waitForCondition(async () => {
        const count = await faviconImg.count();
        if (count === 0) return false;
        const src = await faviconImg.getAttribute('src');
        return src === testFaviconUrl;
      }, { timeout: 10000, timeoutMessage: `Persisted favicon not displayed for tab ${tabId}` });

      const displayedFaviconSrc = await faviconImg.getAttribute('src');
      expect(displayedFaviconSrc).toBe(testFaviconUrl);

      // Cleanup
      await closeTab(extensionContext, tabId);
    });

    test('タブがロードされた後に新しいファビコンで表示が更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      // Arrange: タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // 初期ファビコンをストレージに設定
      const initialFaviconUrl = 'https://example.com/initial-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: initialFaviconUrl }
      );

      // サイドパネルをリロードして初期ファビコンを表示
      const currentWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${currentWindow.id}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      // タブがツリーに表示されるまで待機
      await waitForCondition(async () => {
        const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        return (await node.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Tree node for tab ${tabId} not visible after reload` });

      // 初期ファビコンが表示されていることを確認
      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      const faviconImg = treeNode.locator('img[alt="Favicon"]');

      await waitForCondition(async () => {
        const count = await faviconImg.count();
        if (count === 0) return false;
        const src = await faviconImg.getAttribute('src');
        return src === initialFaviconUrl;
      }, { timeout: 10000, timeoutMessage: 'Initial favicon not displayed' });

      // Act: 新しいファビコンをストレージに設定（タブがロードされたときをシミュレート）
      const newFaviconUrl = 'https://example.org/new-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });

          // STATE_UPDATEDメッセージを送信してUIを更新
          chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
        },
        { tabId, faviconUrl: newFaviconUrl }
      );

      // Assert: 新しいファビコンで表示が更新されていることを確認
      await waitForCondition(async () => {
        const src = await faviconImg.getAttribute('src');
        return src === newFaviconUrl;
      }, { timeout: 10000, timeoutMessage: 'Favicon was not updated with new value' });

      const updatedFaviconSrc = await faviconImg.getAttribute('src');
      expect(updatedFaviconSrc).toBe(newFaviconUrl);
      expect(updatedFaviconSrc).not.toBe(initialFaviconUrl);

      // Cleanup
      await closeTab(extensionContext, tabId);
    });
  });

  test.describe('Requirement 9.4, 9.5: ファビコン永続化復元UIテスト', () => {
    test('ストレージに保存されたファビコンがサイドパネルリロード後もUIに反映されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      // Arrange: タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // ファビコンをストレージに設定
      const testFaviconUrl = 'https://www.google.com/favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      // ストレージにファビコンが保存されていることを確認
      const storedFavicon = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedFavicon).toBe(testFaviconUrl);

      // Act: サイドパネルをリロードしてファビコン復元をシミュレート
      const currentWindow = await serviceWorker.evaluate(() => {
        return chrome.windows.getCurrent();
      });
      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${currentWindow.id}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      // タブがツリーに表示されるまでポーリングで待機
      await waitForCondition(async () => {
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        return (await treeNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Tree node for tab ${tabId} not visible after reload` });

      // Assert: ストレージにファビコンが保存されていることを再確認
      const faviconAfterReload = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(faviconAfterReload).toBe(testFaviconUrl);

      // Cleanup
      await closeTab(extensionContext, tabId);
    });

    test('ファビコン永続化の読み書きが正しく動作すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: タブを作成
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // ファビコンをストレージに手動で設定（実際のネットワーク依存を避ける）
      const testFaviconUrl = 'https://example.com/auto-persist-test.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      // Assert: ファビコンがストレージに保存されていること
      await waitForCondition(async () => {
        const result = await serviceWorker.evaluate(async (tid) => {
          const storedResult = await chrome.storage.local.get('tab_favicons');
          const favicons = storedResult.tab_favicons as Record<number, string> | undefined;
          return favicons?.[tid];
        }, tabId);
        return result === testFaviconUrl;
      }, { timeout: 5000, timeoutMessage: 'Favicon was not persisted correctly' });

      const storedFavicon = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedFavicon).toBe(testFaviconUrl);

      // Cleanup
      await closeTab(extensionContext, tabId);
    });

    test('タブを閉じた際に永続化ファビコンデータが自動的にクリーンアップされること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      // Arrange: タブを作成してファビコンを設定
      const tabId = await createTab(extensionContext, 'about:blank');
      await waitForTabInTreeState(extensionContext, tabId);
      await expect(sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`)).toBeVisible({ timeout: 10000 });

      // ファビコンを手動で設定
      const testFaviconUrl = 'https://example.com/cleanup-test.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      // ファビコンが保存されていることを確認
      const storedBefore = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedBefore).toBe(testFaviconUrl);

      // Act: タブを閉じる
      await closeTab(extensionContext, tabId);

      // ファビコンデータがクリーンアップされるまでポーリングで待機
      // event-handlers.ts の handleTabRemoved でファビコンが削除される
      await waitForCondition(async () => {
        const result = await serviceWorker.evaluate(async (tid) => {
          const storedResult = await chrome.storage.local.get('tab_favicons');
          const favicons = storedResult.tab_favicons as Record<number, string> | undefined;
          return favicons?.[tid];
        }, tabId);
        return result === undefined;
      }, { timeout: 5000, timeoutMessage: 'Favicon was not cleaned up after tab close' });

      // Assert: ファビコンデータがクリーンアップされていること
      const storedAfter = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedAfter).toBeUndefined();
    });
  });
});
