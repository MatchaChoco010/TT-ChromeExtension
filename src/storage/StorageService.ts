import type {
  IStorageService,
  StorageKey,
  StorageSchema,
  StorageChanges,
} from '@/types';

/**
 * ストレージキーの定数定義
 */
export const STORAGE_KEYS = {
  TREE_STATE: 'tree_state' as const,
  USER_SETTINGS: 'user_settings' as const,
  UNREAD_TABS: 'unread_tabs' as const,
  GROUPS: 'groups' as const,
} satisfies Record<string, StorageKey>;

/**
 * chrome.storage.local の型安全なラッパー
 * ストレージキーと値の型を厳密に管理し、get/set/remove/onChange 操作を提供する
 */
export class StorageService implements IStorageService {
  /**
   * ストレージから値を取得
   * @param key - ストレージキー
   * @returns 値または null（存在しない場合）
   */
  async get<K extends StorageKey>(
    key: K,
  ): Promise<StorageSchema[K] | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key] ?? null;
    } catch (error) {
      console.error(`StorageService.get error for key "${key}":`, error);
      return null;
    }
  }

  /**
   * ストレージに値を保存
   * @param key - ストレージキー
   * @param value - 保存する値
   */
  async set<K extends StorageKey>(
    key: K,
    value: StorageSchema[K],
  ): Promise<void> {
    try {
      await chrome.storage.local.set({ [key]: value });
    } catch (error) {
      console.error(`StorageService.set error for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * ストレージから値を削除
   * @param key - ストレージキー
   */
  async remove(key: StorageKey): Promise<void> {
    try {
      await chrome.storage.local.remove(key);
    } catch (error) {
      console.error(`StorageService.remove error for key "${key}":`, error);
      throw error;
    }
  }

  /**
   * ストレージの変更を監視
   * @param callback - 変更時に呼び出されるコールバック
   * @returns リスナーを解除する関数
   */
  onChange(callback: (changes: StorageChanges) => void): () => void {
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string,
    ) => {
      // local ストレージの変更のみを処理
      if (areaName !== 'local') return;

      const storageChanges: StorageChanges = {};
      for (const [key, change] of Object.entries(changes)) {
        storageChanges[key] = {
          oldValue: change.oldValue,
          newValue: change.newValue,
        };
      }

      callback(storageChanges);
    };

    chrome.storage.onChanged.addListener(listener);

    // リスナーを解除する関数を返す
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }
}

/**
 * StorageService のシングルトンインスタンス
 */
export const storageService = new StorageService();
