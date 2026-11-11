/**
 * E2EテストがService Workerの状態を検査・リセットするためにグローバルへ公開する関数と状態
 */
import { treeStateManager } from './background-services';
import { waitForPendingHandlers } from './handler-tracking';
import {
  pendingTabParents,
  pendingDuplicateSources,
  pendingLinkClicks,
  restoringTabIds,
  lastActiveTabByWindow,
  detachedPinnedTabsByWindow,
  snapshotRestoreState,
} from './pending-state';

/**
 * テスト間のリセット前に、起動時の初期化と実行中のハンドラーの完了を待ち、ハンドラー間の一時状態を破棄する
 * E2Eテストのリセット処理専用。タブ操作後の状態確認には使わず、assertTabStructure等のUI検証を使うこと
 */
async function prepareForReset(initialization: Promise<void>): Promise<void> {
  await initialization;
  await waitForPendingHandlers();
  snapshotRestoreState.inProgress = false;
  restoringTabIds.clear();
  lastActiveTabByWindow.clear();
  detachedPinnedTabsByWindow.clear();
}

/**
 * @param initialization - Service Worker起動時の初期化処理。リセットはこの完了後に行う
 */
export function exposeE2ETestHooks(initialization: Promise<void>): void {
  globalThis.treeStateManager = treeStateManager;
  globalThis.pendingTabParents = pendingTabParents;
  globalThis.pendingDuplicateSources = pendingDuplicateSources;
  globalThis.pendingLinkClicks = pendingLinkClicks;
  globalThis.prepareForReset = () => prepareForReset(initialization);
  globalThis.waitForHandlers = waitForPendingHandlers;
}
