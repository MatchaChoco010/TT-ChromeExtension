import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
  registerWebNavigationListeners,
  trackHandler,
} from './event-handlers';

import { testTreeStateManager, testUnreadTracker, testSnapshotManager } from './event-handlers';

import { storageService, STORAGE_KEYS } from '@/storage';
import type { UserSettings } from '@/types';

const snapshotManager = testSnapshotManager;

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
    // 初期化失敗時は自動スナップショット機能が動作しないだけで致命的ではない
  }
}

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

function startPeriodicPersist(): void {
  chrome.alarms.create(PERIODIC_PERSIST_ALARM_NAME, {
    periodInMinutes: 0.25, // 15秒 = 0.25分
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === PERIODIC_PERSIST_ALARM_NAME) {
      testTreeStateManager.refreshTreeStructure().catch(() => {
        // 定期永続化失敗は次回のアラームで再試行されるため無視
      });
    }
  });
}

// 全ての初期化処理はSW IIFEで行う（競合状態を防ぐため）
chrome.runtime.onInstalled.addListener((_details) => {
});

(async () => {
  // Chrome再起動時、セッション復元で作成されたタブのonCreatedイベントを抑制するため、
  // awaitより前に復元中フラグを設定する
  testTreeStateManager.setRestoringState(true);

  try {
    const hasExistingState = await testTreeStateManager.hasPersistedState();

    if (!hasExistingState) {
      // 新規インストール時: ChromeタブからTreeStateを初期化
      // 設計原則として Chrome → TreeStateManager への同期は禁止だが、
      // 新規インストール時は既存タブを取り込むためこの方向の同期が必要
      testTreeStateManager.setRestoringState(false);
      await testTreeStateManager.initializeFromChromeTabs();
      testUnreadTracker.setInitialLoadComplete();
      testTreeStateManager.notifyStateChanged();
      await initializeAutoSnapshot();
      startPeriodicPersist();
      chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
      return;
    }

    await testTreeStateManager.loadState();

    await testUnreadTracker.clear();

    const userSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const syncSettings = {
      newTabPositionManual: userSettings?.newTabPositionManual ?? 'end' as const,
    };

    await testTreeStateManager.restoreStateAfterRestart(syncSettings);

    testTreeStateManager.setRestoringState(false);

    await initializeAutoSnapshot();

    startPeriodicPersist();

    testUnreadTracker.setInitialLoadComplete();

    chrome.runtime.sendMessage({ type: 'STATE_UPDATED' }).catch(() => {});
  } catch {
    testTreeStateManager.setRestoringState(false);
    // 初期化エラーは致命的だが、ここで処理できることはない
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
      // タブ作成失敗時はユーザーに設定画面が開かないだけで致命的ではない
    }
  });
});

