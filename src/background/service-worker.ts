// Service Worker for Vivaldi-TT
import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
} from './event-handlers';

// Get TreeStateManager instance for initialization
import { testTreeStateManager, testTitlePersistence, testUnreadTracker } from './event-handlers';

// Import services and storage for auto-snapshot
import { SnapshotManager } from '@/services';
import { storageService, indexedDBService, STORAGE_KEYS } from '@/storage';
import type { UserSettings } from '@/types';

// Task 9.2: SnapshotManagerインスタンスを作成
const snapshotManager = new SnapshotManager(indexedDBService, storageService);

/**
 * Task 1.1: 古いタブデータをクリーンアップ
 * Requirement 2.1, 2.2, 2.3: ブラウザ起動時に存在しないタブをツリーから削除
 */
async function cleanupStaleTabData(): Promise<void> {
  try {
    // 現在開いているタブ一覧を取得
    const tabs = await chrome.tabs.query({});
    const existingTabIds = tabs
      .filter((tab) => tab.id !== undefined)
      .map((tab) => tab.id!);

    // 存在しないタブをクリーンアップ
    await testTreeStateManager.cleanupStaleNodes(existingTabIds);

    // Requirement 5.4: 存在しないタブのタイトルデータもクリーンアップ
    testTitlePersistence.cleanup(existingTabIds);
  } catch (_error) {
    // Failed to cleanup stale tab data silently
  }
}

/**
 * Task 9.2: 自動スナップショット機能を初期化
 * Requirement 6.4: 設定に基づいてアラームを設定する
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
    // Failed to initialize auto-snapshot silently
  }
}

/**
 * Task 9.2: 設定変更を監視し、自動スナップショット設定を再適用
 * Requirement 6.4: 設定変更時にアラームを再設定する
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

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  // Load state from storage
  await testTreeStateManager.loadState();

  // Task 5.2 (Requirements 5.1, 5.2): 未読状態をクリア
  // ブラウザ起動時に復元されたタブには未読インジケーターを付けない
  await testUnreadTracker.clear();

  // Task 1.1: 古いタブデータをクリーンアップ（ストレージロード後、同期前）
  await cleanupStaleTabData();

  // Sync with existing Chrome tabs
  await testTreeStateManager.syncWithChromeTabs();

  // Task 9.2: 自動スナップショットを初期化
  await initializeAutoSnapshot();

  // Task 1.3 (Requirements 13.1, 13.2, 13.3): 起動完了をマーク
  // ブラウザ起動時の既存タブには未読バッジを表示しない
  // 以降に作成されるタブにのみ未読バッジを表示する
  testUnreadTracker.setInitialLoadComplete();
});

// Initialize on service worker startup
(async () => {
  try {
    // Load existing state
    await testTreeStateManager.loadState();

    // Task 5.2 (Requirements 5.1, 5.2): 未読状態をクリア
    // ブラウザ起動時に復元されたタブには未読インジケーターを付けない
    await testUnreadTracker.clear();

    // Task 1.1: 古いタブデータをクリーンアップ（ストレージロード後、同期前）
    await cleanupStaleTabData();

    // Sync with current Chrome tabs
    await testTreeStateManager.syncWithChromeTabs();

    // Task 9.2: 自動スナップショットを初期化
    await initializeAutoSnapshot();

    // Task 1.3 (Requirements 13.1, 13.2, 13.3): 起動完了をマーク
    // ブラウザ起動時の既存タブには未読バッジを表示しない
    // 以降に作成されるタブにのみ未読バッジを表示する
    testUnreadTracker.setInitialLoadComplete();
  } catch (_error) {
    // Failed to initialize TreeStateManager silently
  }
})();

// Register all event listeners
registerTabEventListeners();
registerWindowEventListeners();
registerMessageListener();

// Task 9.2: 設定変更監視を登録
registerSettingsChangeListener();

// Task 8.2: 拡張機能アイコンクリック時に設定画面を開く
// Requirement 5.4: ブラウザのツールバーにある拡張機能アイコンをクリックした場合、設定画面を開くオプションを含むメニューを表示する
chrome.action.onClicked.addListener(async () => {
  try {
    const settingsUrl = chrome.runtime.getURL('settings.html');
    await chrome.tabs.create({ url: settingsUrl });
  } catch (_error) {
    // Failed to open settings page silently
  }
});

/**
 * Task 9.3: ポップアップからスナップショット取得
 * Requirement 21.1, 21.2, 21.3: ポップアップメニューからスナップショットを取得
 */
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
    return true; // 非同期応答を示す
  }
});
