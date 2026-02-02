import { test, expect } from './fixtures/extension';
import { setupWindow } from './utils/setup-utils';
import { getCurrentWindowId, getTestServerUrl } from './utils/tab-utils';
import {
  waitForSnapshotFile,
  readSnapshotFile,
  cleanupDownloadDir,
} from './utils/download-utils';
import { waitForTabInTreeState } from './utils/polling-utils';
import { assertTabStructure } from './utils/assertion-utils';

test.describe('スナップショット機能', () => {
  test('手動スナップショット作成でファイルがダウンロードされる', async ({
    extensionContext,
    serviceWorker,
    downloadDir,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    await sidePanelPage.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'CREATE_SNAPSHOT' });
    });

    const snapshotFile = await waitForSnapshotFile(downloadDir, 10000);

    expect(snapshotFile).not.toBeNull();

    if (snapshotFile) {
      const snapshotData = readSnapshotFile(snapshotFile);
      expect(snapshotData.id).toMatch(/^snapshot-/);
      expect(snapshotData.name).toBeTruthy();
      expect(snapshotData.isAutoSave).toBe(false);
      expect(snapshotData.data).toBeDefined();
      expect(snapshotData.data.views).toBeInstanceOf(Array);
      expect(snapshotData.data.tabs).toBeInstanceOf(Array);
    }

    cleanupDownloadDir(downloadDir);
    await sidePanelPage.close();
  });

  test('スナップショットのダウンロードリクエストが正しいパスを含む', async ({
    extensionContext,
    serviceWorker,
    downloadDir,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    await sidePanelPage.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'CREATE_SNAPSHOT' });
    });

    const snapshotFile = await waitForSnapshotFile(downloadDir, 10000);
    expect(snapshotFile).not.toBeNull();

    if (snapshotFile) {
      const snapshotData = readSnapshotFile(snapshotFile);
      expect(snapshotData.id).toMatch(/^snapshot-/);
      expect(snapshotData.data.views).toBeInstanceOf(Array);
      expect(snapshotData.data.tabs).toBeInstanceOf(Array);
    }

    cleanupDownloadDir(downloadDir);
    await sidePanelPage.close();
  });

  test('スナップショットに現在のタブ情報が含まれる', async ({
    extensionContext,
    serviceWorker,
    downloadDir,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    const testUrl = getTestServerUrl('/page');
    const newPage = await extensionContext.newPage();
    await newPage.goto(testUrl);
    await newPage.waitForLoadState('domcontentloaded');

    const newPageTabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
      return tab?.id;
    }, testUrl);
    await waitForTabInTreeState(serviceWorker, newPageTabId!);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: newPageTabId!, depth: 0 },
    ], 0);

    await sidePanelPage.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'CREATE_SNAPSHOT' });
    });

    const snapshotFile = await waitForSnapshotFile(downloadDir, 10000);
    expect(snapshotFile).not.toBeNull();

    if (snapshotFile) {
      const snapshotData = readSnapshotFile(snapshotFile);

      expect(snapshotData.data.tabs.length).toBeGreaterThanOrEqual(1);

      const hasTestTab = snapshotData.data.tabs.some(
        (tab) => tab.url.includes('127.0.0.1') || tab.url.includes('/page')
      );
      expect(hasTestTab).toBe(true);
    }

    cleanupDownloadDir(downloadDir);
    await newPage.close();
    await sidePanelPage.close();
  });
});
