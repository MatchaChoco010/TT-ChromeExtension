import type { IStorageService, IUnreadTracker } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

/**
 * UnreadTracker
 *
 * タブの未読状態を追跡するサービス
 * Requirements: 7.1, 7.2, 13.1, 13.2, 13.3
 */
export class UnreadTracker implements IUnreadTracker {
  private unreadTabIds: Set<number> = new Set();
  /** 起動完了フラグ - Requirements 13.1, 13.2, 13.3 */
  private initialLoadComplete: boolean = false;

  constructor(private storageService: IStorageService) {}

  /**
   * タブを未読としてマーク
   * @param tabId - タブID
   * Requirements 13.1: ブラウザ起動時は既存のすべてのタブに未読バッジを表示しない
   */
  async markAsUnread(tabId: number): Promise<void> {
    // Requirement 13.1: 起動完了前は未読マークをスキップ
    if (!this.initialLoadComplete) {
      return;
    }
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
   * 起動完了フラグを設定
   * Requirement 13.2: ブラウザ起動後に新しいタブが開かれた場合にそのタブに未読バッジを表示する
   */
  setInitialLoadComplete(): void {
    this.initialLoadComplete = true;
  }

  /**
   * 起動完了かどうかを取得
   * Requirement 13.3: 起動完了後に開かれたタブを「新規タブ」として識別する
   */
  isInitialLoadComplete(): boolean {
    return this.initialLoadComplete;
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
