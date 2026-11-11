/**
 * Chrome拡張APIが返すエラーの判別
 */

const MISSING_TAB_OR_WINDOW_PATTERN = /^No (tab|window) with id: -?\d+\.?$/;
const NO_MESSAGE_RECEIVER_MESSAGE = 'Could not establish connection. Receiving end does not exist.';

/**
 * 操作対象のタブまたはウィンドウが既に存在しないことによるエラーかを判定する
 * タブやウィンドウはユーザー操作でいつでも閉じられるため、このエラーは通常の状態遷移として起こりうる
 */
export function isMissingTabOrWindowError(error: unknown): boolean {
  return error instanceof Error && MISSING_TAB_OR_WINDOW_PATTERN.test(error.message);
}

/**
 * メッセージの受信側（サイドパネル等の拡張ページ）が開かれていないことによるエラーかを判定する
 */
export function isNoMessageReceiverError(error: unknown): boolean {
  return error instanceof Error && error.message === NO_MESSAGE_RECEIVER_MESSAGE;
}

/**
 * タブまたはウィンドウへの操作を実行し、対象が既に存在しない場合はundefinedを返す
 * @throws 対象が存在しないこと以外の理由で操作が失敗した場合
 */
export async function ignoreMissingTabOrWindow<T>(operation: Promise<T>): Promise<T | undefined> {
  try {
    return await operation;
  } catch (error) {
    if (isMissingTabOrWindowError(error)) {
      return undefined;
    }
    throw error;
  }
}

/**
 * 拡張ページへメッセージを送信する。受信側が開かれていない場合は何もしない
 * @throws 受信側がいないこと以外の理由で送信が失敗した場合
 */
export async function sendMessageToExtensionPages(message: unknown): Promise<void> {
  try {
    await chrome.runtime.sendMessage(message);
  } catch (error) {
    if (!isNoMessageReceiverError(error)) {
      throw error;
    }
  }
}
