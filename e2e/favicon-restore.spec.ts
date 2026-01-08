/**
 * ファビコンの永続化と復元の検証 E2E テスト
 */

import { test, expect } from './fixtures/extension';
import { createTab, closeTab, getCurrentWindowId, getPseudoSidePanelTabId, getInitialBrowserTabId, getTestServerUrl } from './utils/tab-utils';
import { waitForTabInTreeState, waitForCondition } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('ファビコンの永続化復元', () => {
  test.describe('ブラウザ再起動後にファビコンが永続化データから復元される', () => {
    test('ストレージに保存されたファビコンがUIに反映されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

      const testFaviconUrl = 'http://127.0.0.1/test-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      const storedFavicon = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);

      expect(storedFavicon).toBe(testFaviconUrl);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('ファビコンが永続化ストレージに正しく保存されること', async ({
      extensionContext,
      serviceWorker,
      sidePanelPage,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

      const testFaviconUrl = 'http://127.0.0.1/favicon.png';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      const retrievedFavicon = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);

      expect(retrievedFavicon).toBe(testFaviconUrl);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('タブがロードされていない状態でも永続化されていた画像を表示', () => {
    test('discardされたタブでも永続化ファビコンが表示されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

      const testFaviconUrl = 'http://127.0.0.1/discarded-tab-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      const storedFavicon = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);

      expect(storedFavicon).toBe(testFaviconUrl);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('ファビコン永続化と復元のE2Eテスト検証', () => {
    test('複数タブのファビコンが正しく永続化されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId1 = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId1);

      const tabId2 = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId1, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId2);

      const favicon1 = 'http://127.0.0.1/favicon1.ico';
      const favicon2 = 'http://127.0.0.1/favicon2.ico';

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

      await closeTab(extensionContext, tabId1);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId: tabId2, depth: 0 },
      ], 0);

      await closeTab(extensionContext, tabId2);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブを閉じた際にファビコンデータが削除されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

      const testFaviconUrl = 'http://127.0.0.1/to-be-deleted.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      const storedBefore = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedBefore).toBe(testFaviconUrl);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = (result.tab_favicons as Record<number, string>) || {};
        delete favicons[tid];
        await chrome.storage.local.set({ tab_favicons: favicons });
      }, tabId);

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
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

      const initialFavicon = 'http://127.0.0.1/initial.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: initialFavicon }
      );

      const storedInitial = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedInitial).toBe(initialFavicon);

      const updatedFavicon = 'http://127.0.0.1/updated.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: updatedFavicon }
      );

      const storedUpdated = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);

      expect(storedUpdated).toBe(updatedFavicon);
      expect(storedUpdated).not.toBe(initialFavicon);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('ファビコン永続化復元と表示', () => {
    test('永続化されたファビコンがUI上のimgタグに正しく表示されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

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

      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      await waitForCondition(async () => {
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        return (await treeNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Tree node for tab ${tabId} not visible after reload` });

      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      const faviconImg = treeNode.locator('img[alt="Favicon"]');

      await waitForCondition(async () => {
        const count = await faviconImg.count();
        if (count === 0) return false;
        const src = await faviconImg.getAttribute('src');
        return src === testFaviconUrl;
      }, { timeout: 10000, timeoutMessage: `Favicon img not found or incorrect src for tab ${tabId}` });

      const displayedFaviconSrc = await faviconImg.getAttribute('src');
      expect(displayedFaviconSrc).toBe(testFaviconUrl);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブ情報にfavIconUrlがない場合でも永続化ファビコンが表示されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      const defaultIcon = treeNode.locator('[data-testid="default-icon"]');
      await expect(defaultIcon).toBeVisible({ timeout: 5000 });

      const testFaviconUrl = 'http://127.0.0.1/test-favicon.png';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      await waitForCondition(async () => {
        const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        return (await node.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Tree node for tab ${tabId} not visible after reload` });

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

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブがロードされた後に新しいファビコンで表示が更新されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

      const initialFaviconUrl = 'http://127.0.0.1/initial-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: initialFaviconUrl }
      );

      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      await waitForCondition(async () => {
        const node = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        return (await node.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Tree node for tab ${tabId} not visible after reload` });

      const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
      const faviconImg = treeNode.locator('img[alt="Favicon"]');

      await waitForCondition(async () => {
        const count = await faviconImg.count();
        if (count === 0) return false;
        const src = await faviconImg.getAttribute('src');
        return src === initialFaviconUrl;
      }, { timeout: 10000, timeoutMessage: 'Initial favicon not displayed' });

      const newFaviconUrl = 'http://127.0.0.1/new-favicon.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });

          chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
        },
        { tabId, faviconUrl: newFaviconUrl }
      );

      await waitForCondition(async () => {
        const src = await faviconImg.getAttribute('src');
        return src === newFaviconUrl;
      }, { timeout: 10000, timeoutMessage: 'Favicon was not updated with new value' });

      const updatedFaviconSrc = await faviconImg.getAttribute('src');
      expect(updatedFaviconSrc).toBe(newFaviconUrl);
      expect(updatedFaviconSrc).not.toBe(initialFaviconUrl);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });
  });

  test.describe('ファビコン永続化復元UIテスト', () => {
    test('ストレージに保存されたファビコンがサイドパネルリロード後もUIに反映されること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
      extensionId,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

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

      const storedFavicon = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedFavicon).toBe(testFaviconUrl);

      await sidePanelPage.goto(`chrome-extension://${extensionId}/sidepanel.html?windowId=${windowId}`);
      await sidePanelPage.waitForLoadState('domcontentloaded');
      await sidePanelPage.waitForSelector('[data-testid="side-panel-root"]', { timeout: 10000 });

      await waitForCondition(async () => {
        const treeNode = sidePanelPage.locator(`[data-testid="tree-node-${tabId}"]`);
        return (await treeNode.count()) > 0;
      }, { timeout: 10000, timeoutMessage: `Tree node for tab ${tabId} not visible after reload` });

      const faviconAfterReload = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(faviconAfterReload).toBe(testFaviconUrl);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('ファビコン永続化の読み書きが正しく動作すること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

      const testFaviconUrl = 'http://127.0.0.1/auto-persist-test.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

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

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);
    });

    test('タブを閉じた際に永続化ファビコンデータが自動的にクリーンアップされること', async ({
      extensionContext,
      sidePanelPage,
      serviceWorker,
    }) => {
      const windowId = await getCurrentWindowId(serviceWorker);
      const pseudoSidePanelTabId = await getPseudoSidePanelTabId(serviceWorker, windowId);

      const initialBrowserTabId = await getInitialBrowserTabId(serviceWorker, windowId);
      await closeTab(extensionContext, initialBrowserTabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      const tabId = await createTab(extensionContext, getTestServerUrl('/page'));
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
        { tabId, depth: 0 },
      ], 0);

      await waitForTabInTreeState(extensionContext, tabId);

      const testFaviconUrl = 'http://127.0.0.1/cleanup-test.ico';
      await serviceWorker.evaluate(
        async ({ tabId, faviconUrl }) => {
          const result = await chrome.storage.local.get('tab_favicons');
          const favicons = (result.tab_favicons as Record<number, string>) || {};
          favicons[tabId] = faviconUrl;
          await chrome.storage.local.set({ tab_favicons: favicons });
        },
        { tabId, faviconUrl: testFaviconUrl }
      );

      const storedBefore = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedBefore).toBe(testFaviconUrl);

      await closeTab(extensionContext, tabId);
      await assertTabStructure(sidePanelPage, windowId, [
        { tabId: pseudoSidePanelTabId, depth: 0 },
      ], 0);

      await waitForCondition(async () => {
        const result = await serviceWorker.evaluate(async (tid) => {
          const storedResult = await chrome.storage.local.get('tab_favicons');
          const favicons = storedResult.tab_favicons as Record<number, string> | undefined;
          return favicons?.[tid];
        }, tabId);
        return result === undefined;
      }, { timeout: 5000, timeoutMessage: 'Favicon was not cleaned up after tab close' });

      const storedAfter = await serviceWorker.evaluate(async (tid) => {
        const result = await chrome.storage.local.get('tab_favicons');
        const favicons = result.tab_favicons as Record<number, string> | undefined;
        return favicons?.[tid];
      }, tabId);
      expect(storedAfter).toBeUndefined();
    });
  });
});
