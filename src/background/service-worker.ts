import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
  registerWebNavigationListeners,
  trackHandler,
} from './event-handlers';

import { testTreeStateManager, testTitlePersistence, testUnreadTracker, testSnapshotManager } from './event-handlers';

import { storageService, STORAGE_KEYS } from '@/storage';
import type { UserSettings } from '@/types';

const snapshotManager = testSnapshotManager;

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
  } catch {
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

      if (interval > 0) {
        snapshotManager.startAutoSnapshot(interval);
      }
    }
  } catch {
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
        snapshotManager.updateAutoSnapshotSettings(interval);
      }
    }
  });
}

const PERIODIC_PERSIST_ALARM_NAME = 'periodic-tree-state-persist';

/**
 * 定期的なツリー状態の永続化を開始
 * 15秒おきにツリー状態を保存し、ブラウザクラッシュ時のデータロスを最小化
 */
function startPeriodicPersist(): void {
  chrome.alarms.create(PERIODIC_PERSIST_ALARM_NAME, {
    periodInMinutes: 0.25, // 15秒 = 0.25分
  });

  chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === PERIODIC_PERSIST_ALARM_NAME) {
      try {
        // refreshTreeStructureは内部でloadStateとpersistStateを呼び出す
        await testTreeStateManager.refreshTreeStructure();
      } catch {
        // 永続化失敗は無視
      }
    }
  });
}

chrome.runtime.onInstalled.addListener(async () => {
  await testTreeStateManager.loadState();

  // 未読状態をクリア（ブラウザ起動時に復元されたタブには未読インジケーターを付けない）
  await testUnreadTracker.clear();

  // ユーザー設定を取得してsyncWithChromeTabsに渡す
  // これにより同期中に作成された新規タブも正しい位置に配置される
  const userSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
  const syncSettings = {
    newTabPositionManual: userSettings?.newTabPositionManual ?? 'end' as const,
  };

  // URLベースの同期を先に実行（タブIDが変わっていても復元可能）
  await testTreeStateManager.syncWithChromeTabs(syncSettings);

  // 同期後に存在しないタブをクリーンアップ（同期で使われなかった古いタブのみ削除）
  await cleanupStaleTabData();

  await initializeAutoSnapshot();

  // 定期的なツリー状態の永続化を開始
  startPeriodicPersist();

  // 起動完了をマーク（ブラウザ起動時の既存タブには未読バッジを表示しない）
  // 以降に作成されるタブにのみ未読バッジを表示する
  testUnreadTracker.setInitialLoadComplete();

  // UIサイドに初期化完了を通知（未読状態をリフレッシュさせる）
  chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
});

(async () => {
  try {
    await testTreeStateManager.loadState();

    // 未読状態をクリア（ブラウザ起動時に復元されたタブには未読インジケーターを付けない）
    await testUnreadTracker.clear();

    // ユーザー設定を取得してsyncWithChromeTabsに渡す
    // これにより同期中に作成された新規タブも正しい位置に配置される
    const userSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const syncSettings = {
      newTabPositionManual: userSettings?.newTabPositionManual ?? 'end' as const,
    };

    // URLベースの同期を先に実行（タブIDが変わっていても復元可能）
    await testTreeStateManager.syncWithChromeTabs(syncSettings);

    // 同期後に存在しないタブをクリーンアップ（同期で使われなかった古いタブのみ削除）
    await cleanupStaleTabData();

    await initializeAutoSnapshot();

    // 定期的なツリー状態の永続化を開始
    startPeriodicPersist();

    // 起動完了をマーク（ブラウザ起動時の既存タブには未読バッジを表示しない）
    // 以降に作成されるタブにのみ未読バッジを表示する
    testUnreadTracker.setInitialLoadComplete();

    // UIサイドに初期化完了を通知（未読状態をリフレッシュさせる）
    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch {
    // エラーを無視
  }
})();

registerTabEventListeners();
registerWindowEventListeners();
registerWebNavigationListeners();
registerMessageListener();

registerSettingsChangeListener();

chrome.action.onClicked.addListener(() => {
  trackHandler(async () => {
    try {
      const settingsUrl = chrome.runtime.getURL('settings.html');
      await chrome.tabs.create({ url: settingsUrl });
    } catch {
      // エラーを無視
    }
  });
});

