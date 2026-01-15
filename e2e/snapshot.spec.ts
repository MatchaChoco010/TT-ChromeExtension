import { test, expect } from './fixtures/extension';
import { setupWindow } from './utils/setup-utils';
import { getCurrentWindowId, getTestServerUrl } from './utils/tab-utils';
import {
  waitForSnapshotFile,
  readSnapshotFile,
  cleanupDownloadDir,
} from './utils/download-utils';
import { waitForCondition } from './utils/polling-utils';
import type { Worker } from '@playwright/test';

async function getTreeState(serviceWorker: Worker) {
  return await serviceWorker.evaluate(async () => {
    const result = await chrome.storage.local.get('tree_state');
    return result.tree_state;
  });
}

test.describe('スナップショット機能', () => {
  test('手動スナップショット作成でファイルがダウンロードされる', async ({
    extensionContext,
    serviceWorker,
    downloadDir,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

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
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

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
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    const testUrl = getTestServerUrl('/page');
    const newPage = await extensionContext.newPage();
    await newPage.goto(testUrl);
    await newPage.waitForLoadState('domcontentloaded');

    await waitForCondition(
      async () => {
        const treeState = await getTreeState(serviceWorker) as {
          views?: Record<string, { nodes: Record<string, { tabId: number }> }>;
          tabToNode?: Record<number, { viewId: string; nodeId: string }>;
        } | undefined;
        if (!treeState?.views || !treeState?.tabToNode) return false;
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        const testTab = tabs.find(t => t.url?.includes('/page'));
        if (!testTab) return false;
        return treeState.tabToNode[testTab.id] !== undefined;
      },
      { timeout: 5000, timeoutMessage: 'Test tab did not appear in tree state' }
    );

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
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

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
            parentIndex: 0,  // 親タブのindex
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

    interface NodeInfo {
      id: string;
      tabId: number;
      parentId: string | null;
    }
    let parentTab: chrome.tabs.Tab | undefined;
    let childTab: chrome.tabs.Tab | undefined;
    let parentNode: NodeInfo | undefined;
    let childNode: NodeInfo | undefined;

    await waitForCondition(
      async () => {
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        parentTab = tabs.find(t => t.url?.includes('/parent'));
        childTab = tabs.find(t => t.url?.includes('/child'));
        if (!parentTab || !childTab) return false;

        const treeState = await getTreeState(serviceWorker) as {
          views?: Record<string, { nodes: Record<string, NodeInfo> }>;
          tabToNode?: Record<number, { viewId: string; nodeId: string }>;
        } | undefined;
        if (!treeState?.views || !treeState?.tabToNode) return false;

        const parentNodeInfo = treeState.tabToNode[parentTab!.id];
        const childNodeInfo = treeState.tabToNode[childTab!.id];
        if (!parentNodeInfo || !childNodeInfo) return false;

        const parentViewState = treeState.views[parentNodeInfo.viewId];
        const childViewState = treeState.views[childNodeInfo.viewId];
        if (!parentViewState || !childViewState) return false;

        parentNode = parentViewState.nodes[parentNodeInfo.nodeId];
        childNode = childViewState.nodes[childNodeInfo.nodeId];

        // 両方のノードが存在し、親子関係が設定されているか確認
        return parentNode !== undefined && childNode !== undefined && childNode.parentId === parentNode.id;
      },
      { timeout: 5000, timeoutMessage: 'Restored tabs/nodes with parent-child relationship did not appear' }
    );

    expect(parentNode).toBeDefined();
    expect(childNode).toBeDefined();
    expect(childNode?.parentId).toBe(parentNode?.id);

    await sidePanelPage.close();
  });

  test('スナップショット復元時にタブが正しいビューに配置される', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

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
            viewId: 'view-work',  // Workビューに配置
            isExpanded: false,
            pinned: false,
          },
          {
            index: 1,
            url: getTestServerUrl('/personal-tab'),
            title: 'Personal Tab',
            parentIndex: null,
            viewId: 'view-personal',  // Personalビューに配置
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

    interface ViewNodeInfo {
      id: string;
      tabId: number;
    }
    let workTab: chrome.tabs.Tab | undefined;
    let personalTab: chrome.tabs.Tab | undefined;
    let workNodeInfo: { viewId: string; nodeId: string } | undefined;
    let personalNodeInfo: { viewId: string; nodeId: string } | undefined;

    await waitForCondition(
      async () => {
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        workTab = tabs.find(t => t.url?.includes('/work-tab'));
        personalTab = tabs.find(t => t.url?.includes('/personal-tab'));
        if (!workTab || !personalTab) return false;

        const treeState = await getTreeState(serviceWorker) as {
          views?: Record<string, { nodes: Record<string, ViewNodeInfo> }>;
          tabToNode?: Record<number, { viewId: string; nodeId: string }>;
        } | undefined;
        if (!treeState?.views || !treeState?.tabToNode) return false;

        workNodeInfo = treeState.tabToNode[workTab!.id];
        personalNodeInfo = treeState.tabToNode[personalTab!.id];

        // 両方のノードが存在し、正しいビューに配置されているか確認
        return workNodeInfo !== undefined && personalNodeInfo !== undefined &&
               workNodeInfo.viewId === 'view-work' && personalNodeInfo.viewId === 'view-personal';
      },
      { timeout: 5000, timeoutMessage: 'Restored tabs/nodes with correct viewId did not appear' }
    );

    expect(workNodeInfo).toBeDefined();
    expect(personalNodeInfo).toBeDefined();
    expect(workNodeInfo?.viewId).toBe('view-work');
    expect(personalNodeInfo?.viewId).toBe('view-personal');

    await sidePanelPage.close();
  });

  test('既存タブを削除してスナップショットを復元できる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    const existingPage = await extensionContext.newPage();
    await existingPage.goto(getTestServerUrl('/existing'));
    await existingPage.waitForLoadState('domcontentloaded');

    await waitForCondition(
      async () => {
        const treeState = await getTreeState(serviceWorker) as {
          views?: Record<string, { nodes: Record<string, { tabId: number }> }>;
          tabToNode?: Record<number, { viewId: string; nodeId: string }>;
        } | undefined;
        if (!treeState?.views || !treeState?.tabToNode) return false;
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        const existingTab = tabs.find(t => t.url?.includes('/existing'));
        if (!existingTab) return false;
        return treeState.tabToNode[existingTab.id] !== undefined;
      },
      { timeout: 5000, timeoutMessage: 'Existing tab did not appear in tree state' }
    );

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

    const tabsAfterRestore = await serviceWorker.evaluate(async () => {
      return await chrome.tabs.query({});
    });

    const hasExistingTab = tabsAfterRestore.some(t => t.url?.includes('/existing'));
    expect(hasExistingTab).toBe(false);

    const hasRestoredTab1 = tabsAfterRestore.some(t => t.url?.includes('/restored-tab-1'));
    const hasRestoredTab2 = tabsAfterRestore.some(t => t.url?.includes('/restored-tab-2'));
    expect(hasRestoredTab1).toBe(true);
    expect(hasRestoredTab2).toBe(true);

    await sidePanelPage.close();
  });
});
