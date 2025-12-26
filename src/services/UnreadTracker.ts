import type { IStorageService, IUnreadTracker } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

/**
 * UnreadTracker
 *
 * タブの未読状態を追跡するサービス
 * Requirements: 7.1, 7.2
 */
export class UnreadTracker implements IUnreadTracker {
  private unreadTabIds: Set<number> = new Set();

  constructor(private storageService: IStorageService) {}

  /**
   * タブを未読としてマーク
   * @param tabId - タブID
   */
  async markAsUnread(tabId: number): Promise<void> {
    this.unreadTabIds.add(tabId);
    await this.persistState();
  }

  /**
   * タブを既読としてマーク
   * @param tabId - タブID
   */
  async markAsRead(tabId: number): Promise<void> {
    this.unreadTabIds.delete(tabId);
    await this.persistState();
  }

  /**
   * タブが未読かどうかを確認
   * @param tabId - タブID
   * @returns 未読の場合true
   */
  isUnread(tabId: number): boolean {
    return this.unreadTabIds.has(tabId);
  }

  /**
   * 未読タブの数を取得
   * @returns 未読タブ数
   */
  getUnreadCount(): number {
    return this.unreadTabIds.size;
  }

  /**
   * ストレージから未読タブ状態をロード
   */
  async loadFromStorage(): Promise<void> {
    const unreadTabs = await this.storageService.get(STORAGE_KEYS.UNREAD_TABS);
    if (unreadTabs) {
      this.unreadTabIds = new Set(unreadTabs);
    } else {
      this.unreadTabIds = new Set();
    }
  }

  /**
   * すべての未読状態をクリア
   */
  async clear(): Promise<void> {
    this.unreadTabIds.clear();
    await this.persistState();
  }

  /**
   * 状態をストレージに永続化
   */
  private async persistState(): Promise<void> {
    await this.storageService.set(
      STORAGE_KEYS.UNREAD_TABS,
      Array.from(this.unreadTabIds),
    );
  }
}
