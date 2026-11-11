/**
 * 設定を保存する要求の処理
 */
import { storageService } from '../background-services';
import { STORAGE_KEYS } from '@/storage/StorageService';
import type { UserSettings } from '@/types';

export async function handleSaveUserSettings(settings: UserSettings): Promise<void> {
  await storageService.set(STORAGE_KEYS.USER_SETTINGS, settings);
}
