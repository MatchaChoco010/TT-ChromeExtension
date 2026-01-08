import type {
  IStorageService,
  StorageKey,
  StorageSchema,
  StorageChanges,
} from '@/types';

export const STORAGE_KEYS = {
  TREE_STATE: 'tree_state' as const,
  USER_SETTINGS: 'user_settings' as const,
  UNREAD_TABS: 'unread_tabs' as const,
  GROUPS: 'groups' as const,
  TAB_TITLES: 'tab_titles' as const,
  TAB_FAVICONS: 'tab_favicons' as const,
} satisfies Record<string, StorageKey>;

/**
 * chrome.storage.local の型安全なラッパー
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
    } catch (_error) {
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
    await chrome.storage.local.set({ [key]: value });
  }

  /**
   * ストレージから値を削除
   * @param key - ストレージキー
   */
  async remove(key: StorageKey): Promise<void> {
    await chrome.storage.local.remove(key);
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

    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }
}

export const storageService = new StorageService();
