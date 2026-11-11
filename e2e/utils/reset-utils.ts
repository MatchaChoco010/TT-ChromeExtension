import type { BrowserContext, Worker } from '@playwright/test';
import { waitForWindowClosed } from './polling-utils';

/**
 * リセット処理の各ステップをタイムアウト付きで待つ
 * @throws 時間内に完了しない場合
 */
async function withTimeout<T>(step: Promise<T>, timeoutMs: number, stepName: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`Step "${stepName}" timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  try {
    return await Promise.race([step, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * テスト間で拡張機能の状態をリセットする
 *
 * sidePanelPageは作成せず、クリーンアップ処理のみを行う。
 * リセット後の状態: 1ウィンドウ、initialTabのみ（sidePanelTabなし）
 *
 * 各テストはsetupWindow()を呼び出してsidePanelPageを作成する。
 */
export async function resetExtensionState(
  serviceWorker: Worker,
  _extensionContext: BrowserContext
): Promise<void> {
  // Step 1: 前のテストからのリセット準備（ハンドラー待機）
  await withTimeout(
    serviceWorker.evaluate(async () => {
      await globalThis.prepareForReset();
    }),
    10000,
    'prepareForReset'
  );

  // Step 2: ストレージをクリア
  await withTimeout(
    serviceWorker.evaluate(async () => {
      await chrome.storage.local.clear();

      if (chrome.storage.session) {
        await chrome.storage.session.clear();
      }
    }),
    10000,
    'clearStorage'
  );

  // Step 3: メモリ上の状態をクリアし、initialized = trueにする
  // resetForTesting()を使用することで、通常のイベントハンドリングが有効になり、
  // 後続のウィンドウ/タブ作成時にhandleTabCreatedでTreeStateにタブが追加される
  await withTimeout(
    serviceWorker.evaluate(async () => {
      globalThis.treeStateManager.resetForTesting();

      globalThis.pendingTabParents.clear();
      globalThis.pendingDuplicateSources.clear();
      globalThis.pendingLinkClicks.clear();
    }),
    10000,
    'clearMemoryState'
  );

  // Step 4: 新しいクリーンなウィンドウを作成
  // initialized = trueなので、handleWindowCreatedとhandleTabCreatedが通常通り動作し、
  // TreeStateにウィンドウとタブが追加される
  const newWindowId = await withTimeout(
    serviceWorker.evaluate(async () => {
      const newWindow = await chrome.windows.create({ focused: true });
      if (newWindow?.id === undefined) {
        throw new Error('Failed to create window');
      }
      return newWindow.id;
    }),
    10000,
    'createCleanWindow'
  );

  // Step 5: 新しいウィンドウ以外のすべてのウィンドウを閉じる
  const windowsToClose = await withTimeout(
    serviceWorker.evaluate(async (keepWindowId: number) => {
      const windows = await chrome.windows.getAll();
      const closeIds: number[] = [];
      for (const window of windows) {
        if (window.id !== keepWindowId) {
          closeIds.push(window.id!);
          await chrome.windows.remove(window.id!).catch((error: unknown) => {
            // 他のウィンドウを閉じた影響で既に閉じられている場合がある
            if (!(error instanceof Error && error.message.startsWith('No window with id'))) {
              throw error;
            }
          });
        }
      }
      return closeIds;
    }, newWindowId),
    10000,
    'closeOtherWindows'
  );

  for (const windowId of windowsToClose) {
    await waitForWindowClosed(serviceWorker, windowId, { timeout: 5000 });
  }

  // Step 6: タブ・ウィンドウ削除のハンドラー完了を待機
  await withTimeout(
    serviceWorker.evaluate(async () => {
      await globalThis.prepareForReset();
    }),
    10000,
    'prepareForReset2'
  );

  // Step 7: デフォルト設定を書き込む
  await withTimeout(
    serviceWorker.evaluate(async () => {
      await chrome.storage.local.set({
        user_settings: {
          fontSize: 14,
          fontFamily: 'system-ui, -apple-system, sans-serif',
          customCSS: '',
          newTabPosition: 'end',
          newTabPositionManual: 'end',
          newTabPositionFromLink: 'child',
          duplicateTabPosition: 'sibling',
          closeWarningThreshold: 10,
          showUnreadIndicator: true,
          autoSnapshotInterval: 0,
          childTabBehavior: 'promote',
        },
      });
    }),
    10000,
    'setDefaultSettings'
  );

  // Step 8: initializedがtrueであることを検証
  const initStatus = await withTimeout(
    serviceWorker.evaluate(async () => {
      const treeStateManager = globalThis.treeStateManager;
      return {
        initialized: treeStateManager?.isInitialized() ?? false,
        initializationInProgress: treeStateManager?.isInitializationInProgress() ?? false,
      };
    }),
    5000,
    'verifyInitialized'
  );

  if (!initStatus.initialized) {
    throw new Error(
      `Reset failed: initialized is false. ` +
      `initializationInProgress: ${initStatus.initializationInProgress}. ` +
      `This will cause handleTabCreated to timeout waiting for initialization.`
    );
  }

  // Step 9: リセット後の状態を検証（新しいウィンドウのタブのみ存在すること）
  const remainingTabCount = await serviceWorker.evaluate(async () => {
    const tabs = await chrome.tabs.query({});
    return tabs.length;
  });

  if (remainingTabCount !== 1) {
    throw new Error(
      `Reset failed: Expected 1 tab after reset, but found ${remainingTabCount} tabs`
    );
  }
}
