/**
 * Service Workerのエントリーポイント
 * Chromeはイベントで起こしたService Workerに対し、スクリプトの評価中に同期的に登録されたリスナーにだけイベントを届ける。
 * そのため、リスナーはすべてトップレベルで登録し、状態の読み込みは非同期の初期化処理で行う
 */
import { snapshotManager, storageService, titlePersistence, treeStateManager, unreadTracker } from './background-services';
import { exposeE2ETestHooks } from './e2e-test-hooks';
import { runEventHandler } from './handler-tracking';
import { registerRequestListener } from './requests/request-router';
import { registerTabEventListeners, registerWebNavigationListeners } from './tab-event-handlers';
import { registerWindowEventListeners } from './window-event-handlers';
import { STORAGE_KEYS } from '@/storage/StorageService';
import type { UserSettings } from '@/types';

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

async function restoreTreeState(): Promise<void> {
  if (!(await treeStateManager.hasPersistedState())) {
    // 設計原則として Chrome → TreeStateManager への同期は禁止だが、
    // 新規インストール時は既存タブを取り込むためこの方向の同期が必要
    await treeStateManager.initializeFromChromeTabs();
    await markInitializedInCurrentBrowserSession();
    return;
  }

  if (await isInitializedInCurrentBrowserSession()) {
    await unreadTracker.loadFromStorage();
    await treeStateManager.resumeAfterServiceWorkerRestart();
    return;
  }

  await unreadTracker.clear();
  await treeStateManager.restoreStateAfterRestart();
  await markInitializedInCurrentBrowserSession();
}

async function initialize(): Promise<void> {
  await titlePersistence.loadFromStorage();
  await restoreTreeState();
  unreadTracker.setInitialLoadComplete();
  treeStateManager.notifyStateChanged();

  const settings = await storageService.get(STORAGE_KEYS.USER_SETTINGS);
  await snapshotManager.scheduleAutoSnapshot(settings?.autoSnapshotInterval ?? 0);
}

function registerSettingsChangeListener(): void {
  storageService.onChange((changes) => {
    const newSettings = changes[STORAGE_KEYS.USER_SETTINGS]?.newValue as UserSettings | undefined;
    if (newSettings) {
      runEventHandler('storage.onChanged(user_settings)', () =>
        snapshotManager.scheduleAutoSnapshot(newSettings.autoSnapshotInterval ?? 0),
      );
    }
  });
}

function registerAlarmListener(): void {
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (snapshotManager.isAutoSnapshotAlarm(alarm)) {
      runEventHandler('alarms.onAlarm(auto-snapshot)', async () => {
        await snapshotManager.createAutoSnapshot();
      });
    }
  });
}

exposeE2ETestHooks();
registerTabEventListeners();
registerWindowEventListeners();
registerWebNavigationListeners();
registerRequestListener();
registerSettingsChangeListener();
registerAlarmListener();

initialize().catch((error: unknown) => {
  console.error('[service-worker] Initialization failed:', error);
});
