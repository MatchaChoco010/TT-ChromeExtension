import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
  registerWebNavigationListeners,
} from './event-handlers';

import { testTreeStateManager, testTitlePersistence, testUnreadTracker } from './event-handlers';

import { SnapshotManager } from '@/services';
import { storageService, indexedDBService, STORAGE_KEYS } from '@/storage';
import type { UserSettings } from '@/types';

const snapshotManager = new SnapshotManager(indexedDBService, storageService);

/**
 * 古いタブデータをクリーンアップ
 * ブラウザ起動時に存在しないタブをツリーから削除
 */
async function cleanupStaleTabData(): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    const existingTabIds = tabs
      .filter((tab) => tab.id !== undefined)
      .map((tab) => tab.id!);

    await testTreeStateManager.cleanupStaleNodes(existingTabIds);

    testTitlePersistence.cleanup(existingTabIds);
  } catch (_error) {
    // エラーを無視（クリーンアップ失敗は致命的ではない）
  }
}

/**
 * 自動スナップショット機能を初期化
 * 設定に基づいてアラームを設定する
 */
async function initializeAutoSnapshot(): Promise<void> {
  try {
    const settings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    if (settings) {
      const interval = settings.autoSnapshotInterval ?? 0;
      const maxSnapshots = settings.maxSnapshots ?? 10;

      if (interval > 0) {
        snapshotManager.startAutoSnapshot(interval, maxSnapshots);
      }
    }
  } catch (_error) {
    // エラーを無視
  }
}

/**
 * 設定変更を監視し、自動スナップショット設定を再適用
 * 設定変更時にアラームを再設定する
 */
function registerSettingsChangeListener(): void {
  storageService.onChange((changes) => {
    if (changes[STORAGE_KEYS.USER_SETTINGS]) {
      const newSettings = changes[STORAGE_KEYS.USER_SETTINGS].newValue as UserSettings | undefined;
      if (newSettings) {
        const interval = newSettings.autoSnapshotInterval ?? 0;
        const maxSnapshots = newSettings.maxSnapshots ?? 10;
        snapshotManager.updateAutoSnapshotSettings(interval, maxSnapshots);
      }
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await testTreeStateManager.loadState();

  // 未読状態をクリア（ブラウザ起動時に復元されたタブには未読インジケーターを付けない）
  await testUnreadTracker.clear();

  // 古いタブデータをクリーンアップ（ストレージロード後、同期前）
  await cleanupStaleTabData();

  await testTreeStateManager.syncWithChromeTabs();

  await initializeAutoSnapshot();

  // 起動完了をマーク（ブラウザ起動時の既存タブには未読バッジを表示しない）
  // 以降に作成されるタブにのみ未読バッジを表示する
  testUnreadTracker.setInitialLoadComplete();
});

(async () => {
  try {
    await testTreeStateManager.loadState();

    // 未読状態をクリア（ブラウザ起動時に復元されたタブには未読インジケーターを付けない）
    await testUnreadTracker.clear();

    // 古いタブデータをクリーンアップ（ストレージロード後、同期前）
    await cleanupStaleTabData();

    await testTreeStateManager.syncWithChromeTabs();

    await initializeAutoSnapshot();

    // 起動完了をマーク（ブラウザ起動時の既存タブには未読バッジを表示しない）
    // 以降に作成されるタブにのみ未読バッジを表示する
    testUnreadTracker.setInitialLoadComplete();
  } catch (_error) {
    // エラーを無視
  }
})();

registerTabEventListeners();
registerWindowEventListeners();
registerWebNavigationListeners();
registerMessageListener();

registerSettingsChangeListener();

chrome.action.onClicked.addListener(async () => {
  try {
    const settingsUrl = chrome.runtime.getURL('settings.html');
    await chrome.tabs.create({ url: settingsUrl });
  } catch (_error) {
    // エラーを無視
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CREATE_SNAPSHOT') {
    (async () => {
      try {
        const timestamp = new Date().toLocaleString();
        const name = `Manual Snapshot - ${timestamp}`;
        await snapshotManager.createSnapshot(name, false);
        sendResponse({ success: true });
      } catch (error) {
        sendResponse({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    })();
    return true;
  }
});
