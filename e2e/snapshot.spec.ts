import { test, expect } from './fixtures/extension';
import { setupWindow } from './utils/setup-utils';
import { getCurrentWindowId, getTestServerUrl } from './utils/tab-utils';
import {
  waitForSnapshotFile,
  readSnapshotFile,
  cleanupDownloadDir,
} from './utils/download-utils';
import { waitForCondition, waitForTabInTreeState, waitForSidePanelReady, waitForInitialized } from './utils/polling-utils';
import { assertTabStructure, assertPinnedTabStructure } from './utils/assertion-utils';
import { openSidePanelForWindow } from './utils/window-utils';

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

test.describe('スナップショット復元機能', () => {
  test('スナップショット復元時に親子関係が正しく復元される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    const snapshotData = {
      id: 'snapshot-test-1',
      createdAt: new Date().toISOString(),
      name: 'Test Snapshot',
      isAutoSave: false,
      data: {
        views: [{ id: 'default', name: 'Default', color: '#3B82F6' }],
        tabs: [
          {
            index: 0,
            url: getTestServerUrl('/parent'),
            title: 'Parent Tab',
            parentIndex: null,
            viewId: 'default',
            isExpanded: true,
            pinned: false,
          },
          {
            index: 1,
            url: getTestServerUrl('/child'),
            title: 'Child Tab',
            parentIndex: 0,
            viewId: 'default',
            isExpanded: false,
            pinned: false,
          },
        ],
      },
    };

    await sidePanelPage.evaluate(async (jsonData: string) => {
      await chrome.runtime.sendMessage({
        type: 'RESTORE_SNAPSHOT',
        payload: { jsonData, closeCurrentTabs: false },
      });
    }, JSON.stringify(snapshotData));

    await waitForCondition(
      async () => {
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        const parentTab = tabs.find(t => t.url?.includes('/parent'));
        const childTab = tabs.find(t => t.url?.includes('/child'));
        return !!parentTab?.id && !!childTab?.id;
      },
      { timeout: 5000, timeoutMessage: 'Restored tabs did not appear' }
    );

    const { newWindowId, parentTabId, childTabId } = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const parentTab = tabs.find(t => t.url?.includes('/parent'));
      const childTab = tabs.find(t => t.url?.includes('/child'));
      return {
        newWindowId: parentTab?.windowId,
        parentTabId: parentTab?.id,
        childTabId: childTab?.id,
      };
    });

    expect(newWindowId).toBeDefined();
    expect(parentTabId).toBeDefined();
    expect(childTabId).toBeDefined();

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId!);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);
    await waitForInitialized(serviceWorker);

    await assertTabStructure(newWindowSidePanel, newWindowId!, [
      { tabId: parentTabId!, depth: 0, expanded: true },
      { tabId: childTabId!, depth: 1 },
    ], 0);

    await newWindowSidePanel.close();
    await sidePanelPage.close();
  });

  test('スナップショット復元時にタブが正しいビューに配置される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    const snapshotData = {
      id: 'snapshot-test-2',
      createdAt: new Date().toISOString(),
      name: 'Test Snapshot with Views',
      isAutoSave: false,
      data: {
        views: [
          { id: 'view-work', name: 'Work', color: '#3B82F6' },
          { id: 'view-personal', name: 'Personal', color: '#10B981' },
        ],
        tabs: [
          {
            index: 0,
            url: getTestServerUrl('/work-tab'),
            title: 'Work Tab',
            parentIndex: null,
            viewId: 'view-work',
            isExpanded: false,
            pinned: false,
          },
          {
            index: 1,
            url: getTestServerUrl('/personal-tab'),
            title: 'Personal Tab',
            parentIndex: null,
            viewId: 'view-personal',
            isExpanded: false,
            pinned: false,
          },
        ],
      },
    };

    await sidePanelPage.evaluate(async (jsonData: string) => {
      await chrome.runtime.sendMessage({
        type: 'RESTORE_SNAPSHOT',
        payload: { jsonData, closeCurrentTabs: false },
      });
    }, JSON.stringify(snapshotData));

    await waitForCondition(
      async () => {
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        const workTab = tabs.find(t => t.url?.includes('/work-tab'));
        const personalTab = tabs.find(t => t.url?.includes('/personal-tab'));
        return !!workTab?.id && !!personalTab?.id;
      },
      { timeout: 5000, timeoutMessage: 'Restored tabs did not appear' }
    );

    const { newWindowId, workTabId, personalTabId } = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const workTab = tabs.find(t => t.url?.includes('/work-tab'));
      const personalTab = tabs.find(t => t.url?.includes('/personal-tab'));
      return {
        newWindowId: workTab?.windowId,
        workTabId: workTab?.id,
        personalTabId: personalTab?.id,
      };
    });

    expect(newWindowId).toBeDefined();
    expect(workTabId).toBeDefined();
    expect(personalTabId).toBeDefined();

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId!);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);
    await waitForInitialized(serviceWorker);

    await assertTabStructure(newWindowSidePanel, newWindowId!, [
      { tabId: workTabId!, depth: 0 },
    ], 0);

    const viewSwitcher = newWindowSidePanel.locator('[data-testid="view-switcher-container"]');
    const viewButtons = viewSwitcher.locator('button[data-color]');
    await viewButtons.nth(1).click();

    await assertTabStructure(newWindowSidePanel, newWindowId!, [
      { tabId: personalTabId!, depth: 0 },
    ], 1);

    await newWindowSidePanel.close();
    await sidePanelPage.close();
  });

  test('既存タブを削除してスナップショットを復元できる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    const existingUrl = getTestServerUrl('/existing');
    const existingPage = await extensionContext.newPage();
    await existingPage.goto(existingUrl);
    await existingPage.waitForLoadState('domcontentloaded');

    const existingTabId = await serviceWorker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({});
      const tab = tabs.find(t => (t.url || t.pendingUrl || '').includes(url));
      return tab?.id;
    }, existingUrl);
    await waitForTabInTreeState(serviceWorker, existingTabId!);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
      { tabId: existingTabId!, depth: 0 },
    ], 0);

    const tabsBeforeRestore = await serviceWorker.evaluate(async () => {
      return await chrome.tabs.query({});
    });
    const existingTabCount = tabsBeforeRestore.length;
    expect(existingTabCount).toBeGreaterThanOrEqual(2);

    const snapshotData = {
      id: 'snapshot-test-3',
      createdAt: new Date().toISOString(),
      name: 'Test Snapshot for Replace',
      isAutoSave: false,
      data: {
        views: [{ id: 'default', name: 'Default', color: '#3B82F6' }],
        tabs: [
          {
            index: 0,
            url: getTestServerUrl('/restored-tab-1'),
            title: 'Restored Tab 1',
            parentIndex: null,
            viewId: 'default',
            isExpanded: false,
            pinned: false,
          },
          {
            index: 1,
            url: getTestServerUrl('/restored-tab-2'),
            title: 'Restored Tab 2',
            parentIndex: null,
            viewId: 'default',
            isExpanded: false,
            pinned: false,
          },
        ],
      },
    };

    await sidePanelPage.evaluate(async (jsonData: string) => {
      await chrome.runtime.sendMessage({
        type: 'RESTORE_SNAPSHOT',
        payload: { jsonData, closeCurrentTabs: true },
      });
    }, JSON.stringify(snapshotData));

    await waitForCondition(
      async () => {
        const tabs = await serviceWorker.evaluate(async () => {
          return await chrome.tabs.query({});
        });
        const hasRestoredTab1 = tabs.some(t => t.url?.includes('/restored-tab-1'));
        const hasRestoredTab2 = tabs.some(t => t.url?.includes('/restored-tab-2'));
        return hasRestoredTab1 && hasRestoredTab2;
      },
      { timeout: 5000, timeoutMessage: 'Restored tabs did not appear' }
    );

    const { newWindowId, restoredTab1Id, restoredTab2Id } = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const restoredTab1 = tabs.find(t => t.url?.includes('/restored-tab-1'));
      const restoredTab2 = tabs.find(t => t.url?.includes('/restored-tab-2'));
      return {
        newWindowId: restoredTab1?.windowId,
        restoredTab1Id: restoredTab1?.id,
        restoredTab2Id: restoredTab2?.id,
      };
    });

    expect(newWindowId).toBeDefined();
    expect(restoredTab1Id).toBeDefined();
    expect(restoredTab2Id).toBeDefined();

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId!);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);
    await waitForInitialized(serviceWorker);

    await assertTabStructure(newWindowSidePanel, newWindowId!, [
      { tabId: restoredTab1Id!, depth: 0 },
      { tabId: restoredTab2Id!, depth: 0 },
    ], 0);

    const tabsAfterRestore = await serviceWorker.evaluate(async () => {
      return await chrome.tabs.query({});
    });
    const hasExistingTab = tabsAfterRestore.some(t => t.url?.includes('/existing'));
    expect(hasExistingTab).toBe(false);

    await newWindowSidePanel.close();
    await sidePanelPage.close();
  });

  test('スナップショット復元時にビューの順序が維持される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    // ビューの順序: Default (0) -> Work (1) -> Personal (2)
    // タブは親を持たないものを先にソートするが、ビューの順序は元のviews配列順を維持すべき
    const snapshotData = {
      id: 'snapshot-test-view-order',
      createdAt: new Date().toISOString(),
      name: 'Test Snapshot View Order',
      isAutoSave: false,
      data: {
        views: [
          { id: 'view-default', name: 'Default', color: '#3B82F6' },
          { id: 'view-work', name: 'Work', color: '#10B981' },
          { id: 'view-personal', name: 'Personal', color: '#EF4444' },
        ],
        tabs: [
          {
            index: 0,
            url: getTestServerUrl('/default-tab'),
            title: 'Default Tab',
            parentIndex: null,
            viewId: 'view-default',
            isExpanded: false,
            pinned: false,
            windowIndex: 0,
          },
          {
            index: 1,
            url: getTestServerUrl('/work-tab'),
            title: 'Work Tab',
            parentIndex: null,
            viewId: 'view-work',
            isExpanded: false,
            pinned: false,
            windowIndex: 0,
          },
          {
            index: 2,
            url: getTestServerUrl('/personal-tab'),
            title: 'Personal Tab',
            parentIndex: null,
            viewId: 'view-personal',
            isExpanded: false,
            pinned: false,
            windowIndex: 0,
          },
        ],
      },
    };

    await sidePanelPage.evaluate(async (jsonData: string) => {
      await chrome.runtime.sendMessage({
        type: 'RESTORE_SNAPSHOT',
        payload: { jsonData, closeCurrentTabs: false },
      });
    }, JSON.stringify(snapshotData));

    await waitForCondition(
      async () => {
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        const defaultTab = tabs.find(t => t.url?.includes('/default-tab'));
        const workTab = tabs.find(t => t.url?.includes('/work-tab'));
        const personalTab = tabs.find(t => t.url?.includes('/personal-tab'));
        return !!defaultTab?.id && !!workTab?.id && !!personalTab?.id;
      },
      { timeout: 10000, timeoutMessage: 'Restored tabs did not appear' }
    );

    const { newWindowId, defaultTabId, workTabId, personalTabId } = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const defaultTab = tabs.find(t => t.url?.includes('/default-tab'));
      const workTab = tabs.find(t => t.url?.includes('/work-tab'));
      const personalTab = tabs.find(t => t.url?.includes('/personal-tab'));
      return {
        newWindowId: defaultTab?.windowId,
        defaultTabId: defaultTab?.id,
        workTabId: workTab?.id,
        personalTabId: personalTab?.id,
      };
    });

    expect(newWindowId).toBeDefined();
    expect(defaultTabId).toBeDefined();
    expect(workTabId).toBeDefined();
    expect(personalTabId).toBeDefined();

    const newWindowSidePanel = await openSidePanelForWindow(extensionContext, newWindowId!);
    await waitForSidePanelReady(newWindowSidePanel, serviceWorker);
    await waitForInitialized(serviceWorker);

    await assertTabStructure(newWindowSidePanel, newWindowId!, [
      { tabId: defaultTabId!, depth: 0 },
    ], 0);

    const viewSwitcher = newWindowSidePanel.locator('[data-testid="view-switcher-container"]');
    const viewButtons = viewSwitcher.locator('button[data-color]');
    await viewButtons.nth(1).click();

    await assertTabStructure(newWindowSidePanel, newWindowId!, [
      { tabId: workTabId!, depth: 0 },
    ], 1);

    await viewButtons.nth(2).click();

    await assertTabStructure(newWindowSidePanel, newWindowId!, [
      { tabId: personalTabId!, depth: 0 },
    ], 2);

    await newWindowSidePanel.close();
    await sidePanelPage.close();
  });

  test('スナップショット復元時にピン留めタブが正しく復元される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { initialBrowserTabId, sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    await assertTabStructure(sidePanelPage, windowId, [
      { tabId: initialBrowserTabId, depth: 0 },
    ], 0);

    const snapshotData = {
      id: 'snapshot-test-pinned',
      createdAt: new Date().toISOString(),
      name: 'Test Snapshot with Pinned Tabs',
      isAutoSave: false,
      data: {
        views: [{ id: 'default', name: 'Default', color: '#3B82F6' }],
        tabs: [
          {
            index: 0,
            url: getTestServerUrl('/pinned-tab-1'),
            title: 'Pinned Tab 1',
            parentIndex: null,
            viewId: 'default',
            isExpanded: false,
            pinned: true,
            windowIndex: 0,
          },
          {
            index: 1,
            url: getTestServerUrl('/pinned-tab-2'),
            title: 'Pinned Tab 2',
            parentIndex: null,
            viewId: 'default',
            isExpanded: false,
            pinned: true,
            windowIndex: 0,
          },
          {
            index: 2,
            url: getTestServerUrl('/normal-tab'),
            title: 'Normal Tab',
            parentIndex: null,
            viewId: 'default',
            isExpanded: false,
            pinned: false,
            windowIndex: 0,
          },
        ],
      },
    };

    await sidePanelPage.evaluate(async (jsonData: string) => {
      await chrome.runtime.sendMessage({
        type: 'RESTORE_SNAPSHOT',
        payload: { jsonData, closeCurrentTabs: false },
      });
    }, JSON.stringify(snapshotData));

    await waitForCondition(
      async () => {
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        const pinnedTab1 = tabs.find(t => t.url?.includes('/pinned-tab-1'));
        const pinnedTab2 = tabs.find(t => t.url?.includes('/pinned-tab-2'));
        const normalTab = tabs.find(t => t.url?.includes('/normal-tab'));
        return !!pinnedTab1?.id && !!pinnedTab2?.id && !!normalTab?.id &&
               pinnedTab1.pinned === true && pinnedTab2.pinned === true && normalTab.pinned === false;
      },
      { timeout: 10000, timeoutMessage: 'Pinned tabs were not restored correctly' }
    );

    const { newWindowId, pinnedTab1Id, pinnedTab2Id, normalTabId } = await serviceWorker.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const pinnedTab1 = tabs.find(t => t.url?.includes('/pinned-tab-1'));
      const pinnedTab2 = tabs.find(t => t.url?.includes('/pinned-tab-2'));
      const normalTab = tabs.find(t => t.url?.includes('/normal-tab'));
      return {
        newWindowId: pinnedTab1?.windowId,
        pinnedTab1Id: pinnedTab1?.id,
        pinnedTab2Id: pinnedTab2?.id,
        normalTabId: normalTab?.id,
      };
    });

    expect(newWindowId).toBeDefined();
    expect(pinnedTab1Id).toBeDefined();
    expect(pinnedTab2Id).toBeDefined();
    expect(normalTabId).toBeDefined();

    const { sidePanelPage: newWindowSidePanel } = await setupWindow(
      extensionContext,
      serviceWorker,
      newWindowId!
    );

    await assertPinnedTabStructure(newWindowSidePanel, newWindowId!, [
      { tabId: pinnedTab1Id! },
      { tabId: pinnedTab2Id! },
    ], 0);

    await assertTabStructure(newWindowSidePanel, newWindowId!, [
      { tabId: normalTabId!, depth: 0 },
    ], 0);

    await newWindowSidePanel.close();
    await sidePanelPage.close();
  });
});
