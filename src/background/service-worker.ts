import {
  registerTabEventListeners,
  registerWindowEventListeners,
  registerMessageListener,
  registerWebNavigationListeners,
} from './event-handlers';

import { testTreeStateManager, testUnreadTracker, testSnapshotManager } from './event-handlers';

import { storageService, STORAGE_KEYS } from '@/storage';
import type { UserSettings } from '@/types';
import { sendMessageToExtensionPages } from '@/utils/chrome-errors';

const snapshotManager = testSnapshotManager;

async function initializeAutoSnapshot(): Promise<void> {
  const settings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
  const interval = settings?.autoSnapshotInterval ?? 0;
  if (interval > 0) {
    snapshotManager.startAutoSnapshot(interval);
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
      testTreeStateManager.refreshTreeStructure().catch((error: unknown) => {
        console.error('[service-worker] Periodic persist failed:', error);
      });
    }
  });
}

const BROWSER_SESSION_MARKER_KEY = 'tree_state_browser_session_active';

/**
 * 現在のブラウザセッションで既に初期化を完了しているかを返す
 * chrome.storage.sessionはService Workerの再起動では保持され、ブラウザ再起動で消去される
 */
async function isInitializedInCurrentBrowserSession(): Promise<boolean> {
  const result = await chrome.storage.session.get(BROWSER_SESSION_MARKER_KEY);
  return result[BROWSER_SESSION_MARKER_KEY] === true;
}

async function markInitializedInCurrentBrowserSession(): Promise<void> {
  await chrome.storage.session.set({ [BROWSER_SESSION_MARKER_KEY]: true });
}

(async () => {
  try {
    const hasExistingState = await testTreeStateManager.hasPersistedState();

    if (!hasExistingState) {
      // 新規インストール時: ChromeタブからTreeStateを初期化
      // 設計原則として Chrome → TreeStateManager への同期は禁止だが、
      // 新規インストール時は既存タブを取り込むためこの方向の同期が必要
      await testTreeStateManager.initializeFromChromeTabs();
      await markInitializedInCurrentBrowserSession();
      testUnreadTracker.setInitialLoadComplete();
      testTreeStateManager.notifyStateChanged();
      await initializeAutoSnapshot();
      startPeriodicPersist();
      await sendMessageToExtensionPages({ type: 'STATE_UPDATED' });
      return;
    }

    if (await isInitializedInCurrentBrowserSession()) {
      await testUnreadTracker.loadFromStorage();
      await testTreeStateManager.resumeAfterServiceWorkerRestart();
    } else {
      await testUnreadTracker.clear();

      const userSettings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
      const syncSettings = {
        newTabPositionManual: userSettings?.newTabPositionManual ?? 'end' as const,
      };

      await testTreeStateManager.restoreStateAfterRestart(syncSettings);
      await markInitializedInCurrentBrowserSession();
    }

    await initializeAutoSnapshot();

    startPeriodicPersist();

    testUnreadTracker.setInitialLoadComplete();

    await sendMessageToExtensionPages({ type: 'STATE_UPDATED' });
  } catch (error) {
    console.error('[service-worker] Initialization failed:', error);
  }
})();

registerTabEventListeners();
registerWindowEventListeners();
registerWebNavigationListeners();
registerMessageListener();

registerSettingsChangeListener();
