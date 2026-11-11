/**
 * Service Workerのイベント・メッセージハンドラーの実行管理
 *
 * Chromeはイベントリスナーのコールバック完了を待たない。
 * E2Eテストのリセット処理が実行中のハンドラーの完了を待てるよう、
 * Service Workerの非同期ハンドラーはすべてtrackHandler()を経由して実行する。
 */
import { treeStateManager } from './background-services';

const INITIALIZATION_TIMEOUT_MS = 15000;

let pendingHandlerCount = 0;
let pendingHandlerResolvers: (() => void)[] = [];

/**
 * 非同期ハンドラーを実行し、完了を追跡する
 */
export async function trackHandler<T>(fn: () => Promise<T>): Promise<T> {
  pendingHandlerCount++;
  try {
    return await fn();
  } finally {
    pendingHandlerCount--;
    if (pendingHandlerCount === 0) {
      const resolvers = pendingHandlerResolvers;
      pendingHandlerResolvers = [];
      resolvers.forEach((resolve) => resolve());
    }
  }
}

/**
 * TreeStateManagerの初期化完了を待つ
 * Service Workerを起動したイベントは、保存済み状態の読み込み完了前に届く。
 * 読み込み前の状態を変更・永続化すると保存済みのツリーを上書きするため、状態に触れるハンドラーは必ずこれを待つこと。
 * @param eventName - タイムアウト時のエラーメッセージに含めるイベント名
 * @throws 初期化が時間内に完了しない場合
 */
export async function waitForTreeStateInitialization(eventName: string): Promise<void> {
  if (treeStateManager.isInitialized()) {
    return;
  }
  const completed = await treeStateManager.waitForInitialization(INITIALIZATION_TIMEOUT_MS);
  if (!completed) {
    throw new Error(`Initialization did not complete within timeout for ${eventName}`);
  }
}

/**
 * TreeStateManagerの初期化完了後にハンドラーを実行し、完了を追跡する
 */
export function trackHandlerAfterInitialization<T>(eventName: string, fn: () => Promise<T>): Promise<T> {
  return trackHandler(async () => {
    await waitForTreeStateInitialization(eventName);
    return fn();
  });
}

/**
 * Chromeイベントのハンドラーを初期化完了後に実行する
 * Chromeはリスナーの戻り値を扱わないため、失敗はここでイベント名とともに記録する
 */
export function runEventHandler(eventName: string, fn: () => Promise<void>): void {
  trackHandlerAfterInitialization(eventName, fn).catch((error: unknown) => {
    console.error(`[${eventName}] Handler failed:`, error);
  });
}

/**
 * 実行中のハンドラーがすべて完了するまで待つ（E2Eテストのリセット専用）
 * @throws 時間内に完了しない場合
 */
export async function waitForPendingHandlers(timeoutMs: number = 5000): Promise<void> {
  if (pendingHandlerCount === 0) {
    return;
  }

  return new Promise<void>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      pendingHandlerResolvers = pendingHandlerResolvers.filter((r) => r !== wrappedResolve);
      reject(new Error(
        `waitForPendingHandlers timed out after ${timeoutMs}ms. ` +
        `${pendingHandlerCount} handler(s) still running.`
      ));
    }, timeoutMs);

    const wrappedResolve = (): void => {
      clearTimeout(timeoutId);
      resolve();
    };

    pendingHandlerResolvers.push(wrappedResolve);
  });
}
