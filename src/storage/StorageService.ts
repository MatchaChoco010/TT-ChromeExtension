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
  async get<K extends StorageKey>(
    key: K,
  ): Promise<StorageSchema[K] | null> {
    try {
      const result = await chrome.storage.local.get(key);
      return (result[key] as StorageSchema[K] | undefined) ?? null;
    } catch {
      return null;
    }
  }

  async set<K extends StorageKey>(
    key: K,
    value: StorageSchema[K],
  ): Promise<void> {
    await chrome.storage.local.set({ [key]: value });
  }

  async remove(key: StorageKey): Promise<void> {
    await chrome.storage.local.remove(key);
  }

  /** @returns リスナーを解除する関数 */
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
