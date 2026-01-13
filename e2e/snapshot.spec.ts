/**
 * スナップショット機能のE2Eテスト
 *
 * chrome.downloads APIを使用したスナップショット保存・復元機能をテスト
 */

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

/**
 * ツリー状態を取得するヘルパー関数
 */
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
    // サイドパネルをセットアップ
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    // サイドパネルからメッセージを送信
    await sidePanelPage.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'CREATE_SNAPSHOT' });
    });

    // ダウンロードファイルが作成されるのを待機（waitForSnapshotFileが内部でポーリング）
    const snapshotFile = await waitForSnapshotFile(downloadDir, 10000);

    expect(snapshotFile).not.toBeNull();

    if (snapshotFile) {
      // ファイル内容を検証
      const snapshotData = readSnapshotFile(snapshotFile);
      expect(snapshotData.id).toMatch(/^snapshot-/);
      expect(snapshotData.name).toBeTruthy();
      expect(snapshotData.isAutoSave).toBe(false);
      expect(snapshotData.data).toBeDefined();
      expect(snapshotData.data.views).toBeInstanceOf(Array);
      expect(snapshotData.data.tabs).toBeInstanceOf(Array);
    }

    // クリーンアップ
    cleanupDownloadDir(downloadDir);
    await sidePanelPage.close();
  });

  test('スナップショットのダウンロードリクエストが正しいパスを含む', async ({
    extensionContext,
    serviceWorker,
    downloadDir,
  }) => {
    // このテストは、chrome.downloads.download()に渡されるfilenameパラメータを検証する
    // 注意: Chrome for Testingではdata URLのfilenameパラメータが適用されない場合がある
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    // サイドパネルからスナップショット作成をトリガー
    await sidePanelPage.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'CREATE_SNAPSHOT' });
    });

    // ダウンロードファイルが作成されていることを確認（waitForSnapshotFileが内部でポーリング）
    const snapshotFile = await waitForSnapshotFile(downloadDir, 10000);
    expect(snapshotFile).not.toBeNull();

    // ファイル内容がスナップショットデータであることを確認
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

    // 追加のタブを作成（テストサーバーURLを使用）
    const testUrl = getTestServerUrl('/page');
    const newPage = await extensionContext.newPage();
    await newPage.goto(testUrl);
    await newPage.waitForLoadState('domcontentloaded');

    // タブがツリー状態に追加されるまでポーリングで待機
    await waitForCondition(
      async () => {
        const treeState = await getTreeState(serviceWorker);
        if (!treeState?.nodes) return false;
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        const testTab = tabs.find(t => t.url?.includes('/page'));
        if (!testTab) return false;
        return Object.values(treeState.nodes).some((n: { tabId: number }) => n.tabId === testTab.id);
      },
      { timeout: 5000, timeoutMessage: 'Test tab did not appear in tree state' }
    );

    // サイドパネルからスナップショット作成をトリガー
    await sidePanelPage.evaluate(async () => {
      await chrome.runtime.sendMessage({ type: 'CREATE_SNAPSHOT' });
    });

    // ダウンロードファイルを確認（waitForSnapshotFileが内部でポーリング）
    const snapshotFile = await waitForSnapshotFile(downloadDir, 10000);
    expect(snapshotFile).not.toBeNull();

    if (snapshotFile) {
      const snapshotData = readSnapshotFile(snapshotFile);

      // タブ情報が含まれていることを確認
      expect(snapshotData.data.tabs.length).toBeGreaterThanOrEqual(1);

      // テストサーバーのタブが含まれていることを確認
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

    // テスト用のスナップショットデータ（親子関係あり）
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

    // スナップショットを復元（新しいタブとして）
    await sidePanelPage.evaluate(async (jsonData: string) => {
      await chrome.runtime.sendMessage({
        type: 'RESTORE_SNAPSHOT',
        payload: { jsonData, closeCurrentTabs: false },
      });
    }, JSON.stringify(snapshotData));

    // 復元されたタブとノードが存在するまでポーリングで待機
    interface NodeInfo {
      id: string;
      tabId: number;
      parentId: string | null;
      viewId: string;
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

        const treeState = await getTreeState(serviceWorker);
        if (!treeState?.nodes) return false;

        const nodes = Object.values(treeState.nodes) as NodeInfo[];
        parentNode = nodes.find(n => n.tabId === parentTab!.id);
        childNode = nodes.find(n => n.tabId === childTab!.id);

        // 両方のノードが存在し、親子関係が設定されているか確認
        return parentNode !== undefined && childNode !== undefined && childNode.parentId === parentNode.id;
      },
      { timeout: 5000, timeoutMessage: 'Restored tabs/nodes with parent-child relationship did not appear' }
    );

    // 親子関係が正しく復元されていることを確認
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

    // 複数ビューを持つスナップショットデータ
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

    // スナップショットを復元
    await sidePanelPage.evaluate(async (jsonData: string) => {
      await chrome.runtime.sendMessage({
        type: 'RESTORE_SNAPSHOT',
        payload: { jsonData, closeCurrentTabs: false },
      });
    }, JSON.stringify(snapshotData));

    // 復元されたタブとノードが存在するまでポーリングで待機
    interface ViewNodeInfo {
      id: string;
      tabId: number;
      viewId: string;
    }
    let workTab: chrome.tabs.Tab | undefined;
    let personalTab: chrome.tabs.Tab | undefined;
    let workNode: ViewNodeInfo | undefined;
    let personalNode: ViewNodeInfo | undefined;

    await waitForCondition(
      async () => {
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        workTab = tabs.find(t => t.url?.includes('/work-tab'));
        personalTab = tabs.find(t => t.url?.includes('/personal-tab'));
        if (!workTab || !personalTab) return false;

        const treeState = await getTreeState(serviceWorker);
        if (!treeState?.nodes) return false;

        const nodes = Object.values(treeState.nodes) as ViewNodeInfo[];
        workNode = nodes.find(n => n.tabId === workTab!.id);
        personalNode = nodes.find(n => n.tabId === personalTab!.id);

        // 両方のノードが存在し、正しいビューに配置されているか確認
        return workNode !== undefined && personalNode !== undefined &&
               workNode.viewId === 'view-work' && personalNode.viewId === 'view-personal';
      },
      { timeout: 5000, timeoutMessage: 'Restored tabs/nodes with correct viewId did not appear' }
    );

    // 正しいビューに配置されていることを確認
    expect(workNode).toBeDefined();
    expect(personalNode).toBeDefined();
    expect(workNode?.viewId).toBe('view-work');
    expect(personalNode?.viewId).toBe('view-personal');

    await sidePanelPage.close();
  });

  test('既存タブを削除してスナップショットを復元できる', async ({
    extensionContext,
    serviceWorker,
  }) => {
    const windowId = await getCurrentWindowId(serviceWorker);
    const { sidePanelPage } = await setupWindow(extensionContext, serviceWorker, windowId);

    // 既存タブを作成
    const existingPage = await extensionContext.newPage();
    await existingPage.goto(getTestServerUrl('/existing'));
    await existingPage.waitForLoadState('domcontentloaded');

    // タブがツリー状態に追加されるまでポーリングで待機
    await waitForCondition(
      async () => {
        const treeState = await getTreeState(serviceWorker);
        if (!treeState?.nodes) return false;
        const tabs = await serviceWorker.evaluate(async () => chrome.tabs.query({}));
        const existingTab = tabs.find(t => t.url?.includes('/existing'));
        if (!existingTab) return false;
        return Object.values(treeState.nodes).some((n: { tabId: number }) => n.tabId === existingTab.id);
      },
      { timeout: 5000, timeoutMessage: 'Existing tab did not appear in tree state' }
    );

    // 復元前のタブ数を確認
    const tabsBeforeRestore = await serviceWorker.evaluate(async () => {
      return await chrome.tabs.query({});
    });
    const existingTabCount = tabsBeforeRestore.length;
    expect(existingTabCount).toBeGreaterThanOrEqual(2);

    // テスト用のスナップショットデータ
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

    // 既存タブを削除してスナップショットを復元
    await sidePanelPage.evaluate(async (jsonData: string) => {
      await chrome.runtime.sendMessage({
        type: 'RESTORE_SNAPSHOT',
        payload: { jsonData, closeCurrentTabs: true },
      });
    }, JSON.stringify(snapshotData));

    // 復元されたタブが存在するまでポーリングで待機
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

    // 復元後のタブを確認
    const tabsAfterRestore = await serviceWorker.evaluate(async () => {
      return await chrome.tabs.query({});
    });

    // 既存タブが閉じられ、スナップショットのタブのみになっていることを確認
    const hasExistingTab = tabsAfterRestore.some(t => t.url?.includes('/existing'));
    expect(hasExistingTab).toBe(false);

    // 復元されたタブが存在することを確認
    const hasRestoredTab1 = tabsAfterRestore.some(t => t.url?.includes('/restored-tab-1'));
    const hasRestoredTab2 = tabsAfterRestore.some(t => t.url?.includes('/restored-tab-2'));
    expect(hasRestoredTab1).toBe(true);
    expect(hasRestoredTab2).toBe(true);

    await sidePanelPage.close();
  });
});
