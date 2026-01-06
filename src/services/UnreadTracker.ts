import type { IStorageService, IUnreadTracker } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

export class UnreadTracker implements IUnreadTracker {
  private unreadTabIds: Set<number> = new Set();
  private initialLoadComplete: boolean = false;

  constructor(private storageService: IStorageService) {}

  /**
   * ブラウザ起動時は既存のすべてのタブに未読バッジを表示しない
   */
  async markAsUnread(tabId: number): Promise<void> {
    if (!this.initialLoadComplete) {
      return;
    }
    this.unreadTabIds.add(tabId);
    await this.persistState();
  }

  async markAsRead(tabId: number): Promise<void> {
    this.unreadTabIds.delete(tabId);
    await this.persistState();
  }

  isUnread(tabId: number): boolean {
    return this.unreadTabIds.has(tabId);
  }

  getUnreadCount(): number {
    return this.unreadTabIds.size;
  }

  async loadFromStorage(): Promise<void> {
    const unreadTabs = await this.storageService.get(STORAGE_KEYS.UNREAD_TABS);
    if (unreadTabs) {
      this.unreadTabIds = new Set(unreadTabs);
    } else {
      this.unreadTabIds = new Set();
    }
  }

  async clear(): Promise<void> {
    this.unreadTabIds.clear();
    await this.persistState();
  }

  /**
   * ブラウザ起動後に新しいタブが開かれた場合にそのタブに未読バッジを表示する
   */
  setInitialLoadComplete(): void {
    this.initialLoadComplete = true;
  }

  /**
   * 起動完了後に開かれたタブを「新規タブ」として識別する
   */
  isInitialLoadComplete(): boolean {
    return this.initialLoadComplete;
  }

  private async persistState(): Promise<void> {
    await this.storageService.set(
      STORAGE_KEYS.UNREAD_TABS,
      Array.from(this.unreadTabIds),
    );
  }
}
