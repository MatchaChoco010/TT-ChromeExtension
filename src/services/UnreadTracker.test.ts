import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnreadTracker } from './UnreadTracker';
import type { IStorageService } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

describe('UnreadTracker', () => {
  let mockStorageService: IStorageService;
  let unreadTracker: UnreadTracker;

  beforeEach(() => {
    // Mock StorageService
    mockStorageService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      onChange: vi.fn().mockReturnValue(() => {}),
    };

    unreadTracker = new UnreadTracker(mockStorageService);
  });

  describe('markAsUnread', () => {
    it('新しいタブを未読としてマークできる', async () => {
      const tabId = 1;
      // 起動完了を設定
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(tabId);

      expect(unreadTracker.isUnread(tabId)).toBe(true);
    });

    it('未読タブをストレージに永続化する', async () => {
      const tabId = 1;
      // 起動完了を設定
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(tabId);

      expect(mockStorageService.set).toHaveBeenCalledWith(
        STORAGE_KEYS.UNREAD_TABS,
        [tabId],
      );
    });

    it('複数のタブを未読としてマークできる', async () => {
      // 起動完了を設定
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);
      await unreadTracker.markAsUnread(2);
      await unreadTracker.markAsUnread(3);

      expect(unreadTracker.isUnread(1)).toBe(true);
      expect(unreadTracker.isUnread(2)).toBe(true);
      expect(unreadTracker.isUnread(3)).toBe(true);
      expect(unreadTracker.getUnreadCount()).toBe(3);
    });

    it('既に未読のタブを再度マークしても重複しない', async () => {
      // 起動完了を設定
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);
      await unreadTracker.markAsUnread(1);

      expect(unreadTracker.getUnreadCount()).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('未読タブを既読としてマークできる', async () => {
      // 起動完了を設定
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);
      expect(unreadTracker.isUnread(1)).toBe(true);

      await unreadTracker.markAsRead(1);

      expect(unreadTracker.isUnread(1)).toBe(false);
    });

    it('既読マーク後にストレージを更新する', async () => {
      // 起動完了を設定
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);
      await unreadTracker.markAsUnread(2);
      vi.clearAllMocks();

      await unreadTracker.markAsRead(1);

      expect(mockStorageService.set).toHaveBeenCalledWith(
        STORAGE_KEYS.UNREAD_TABS,
        [2],
      );
    });

    it('存在しないタブを既読にしてもエラーにならない', async () => {
      await expect(unreadTracker.markAsRead(999)).resolves.not.toThrow();
    });
  });

  describe('isUnread', () => {
    it('未読タブに対してtrueを返す', async () => {
      // 起動完了を設定
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);

      expect(unreadTracker.isUnread(1)).toBe(true);
    });

    it('既読タブに対してfalseを返す', () => {
      expect(unreadTracker.isUnread(1)).toBe(false);
    });
  });

  describe('getUnreadCount', () => {
    it('未読タブ数を返す', async () => {
      // 起動完了を設定
      unreadTracker.setInitialLoadComplete();

      expect(unreadTracker.getUnreadCount()).toBe(0);

      await unreadTracker.markAsUnread(1);
      expect(unreadTracker.getUnreadCount()).toBe(1);

      await unreadTracker.markAsUnread(2);
      expect(unreadTracker.getUnreadCount()).toBe(2);

      await unreadTracker.markAsRead(1);
      expect(unreadTracker.getUnreadCount()).toBe(1);
    });
  });

  describe('loadFromStorage', () => {
    it('ストレージから未読タブをロードできる', async () => {
      const savedTabs = [1, 2, 3];
      mockStorageService.get = vi.fn().mockResolvedValue(savedTabs);

      await unreadTracker.loadFromStorage();

      expect(unreadTracker.isUnread(1)).toBe(true);
      expect(unreadTracker.isUnread(2)).toBe(true);
      expect(unreadTracker.isUnread(3)).toBe(true);
      expect(unreadTracker.getUnreadCount()).toBe(3);
    });

    it('ストレージにデータがない場合は空の状態になる', async () => {
      mockStorageService.get = vi.fn().mockResolvedValue(null);

      await unreadTracker.loadFromStorage();

      expect(unreadTracker.getUnreadCount()).toBe(0);
    });
  });

  describe('clear', () => {
    it('すべての未読状態をクリアできる', async () => {
      // 起動完了を設定
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);
      await unreadTracker.markAsUnread(2);
      expect(unreadTracker.getUnreadCount()).toBe(2);

      await unreadTracker.clear();

      expect(unreadTracker.getUnreadCount()).toBe(0);
      expect(unreadTracker.isUnread(1)).toBe(false);
      expect(unreadTracker.isUnread(2)).toBe(false);
    });

    it('クリア後にストレージを更新する', async () => {
      // 起動完了を設定
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);
      vi.clearAllMocks();

      await unreadTracker.clear();

      expect(mockStorageService.set).toHaveBeenCalledWith(
        STORAGE_KEYS.UNREAD_TABS,
        [],
      );
    });
  });

  // Requirement 5.1, 5.2: 復元タブの未読インジケーター非表示
  describe('ブラウザ復元時の未読状態', () => {
    it('clear()でストレージの未読状態を全てクリアできる', async () => {
      // ストレージに前回セッションの未読タブがある状態をシミュレート
      mockStorageService.get = vi.fn().mockResolvedValue([1, 2, 3]);

      // ストレージから読み込み
      await unreadTracker.loadFromStorage();

      // 読み込み直後は未読状態がある
      expect(unreadTracker.isUnread(1)).toBe(true);
      expect(unreadTracker.isUnread(2)).toBe(true);
      expect(unreadTracker.isUnread(3)).toBe(true);

      // clear()を呼び出し
      await unreadTracker.clear();

      // 全ての未読状態がクリアされる
      expect(unreadTracker.isUnread(1)).toBe(false);
      expect(unreadTracker.isUnread(2)).toBe(false);
      expect(unreadTracker.isUnread(3)).toBe(false);
      expect(unreadTracker.getUnreadCount()).toBe(0);
    });

    it('起動時にclear()を呼び出すことで復元タブに未読を付けない', async () => {
      // シナリオ: ブラウザ起動時の初期化フロー
      // 1. ストレージに前回セッションの未読状態がある
      mockStorageService.get = vi.fn().mockResolvedValue([1, 2, 3]);

      // 2. ストレージからロード（loadFromStorageはevent-handlers.tsで呼ばれる）
      await unreadTracker.loadFromStorage();

      // 3. 起動完了前にclear()を呼び出してストレージの未読状態をクリア
      await unreadTracker.clear();

      // 4. この時点で全ての未読状態がクリアされている
      expect(unreadTracker.getUnreadCount()).toBe(0);

      // 5. 起動完了をマーク
      unreadTracker.setInitialLoadComplete();

      // 6. 以降は新規タブのみ未読になる
      await unreadTracker.markAsUnread(4); // 新規タブ
      expect(unreadTracker.isUnread(4)).toBe(true);
      expect(unreadTracker.isUnread(1)).toBe(false); // 復元タブは未読ではない
    });
  });

  // Requirements 13.1, 13.2, 13.3: 起動時の未読バッジ制御
  describe('initialLoadComplete', () => {
    it('初期状態ではisInitialLoadCompleteがfalseを返す', () => {
      expect(unreadTracker.isInitialLoadComplete()).toBe(false);
    });

    it('setInitialLoadCompleteを呼び出すとisInitialLoadCompleteがtrueを返す', () => {
      unreadTracker.setInitialLoadComplete();

      expect(unreadTracker.isInitialLoadComplete()).toBe(true);
    });

    it('起動完了前はmarkAsUnreadを呼び出しても未読状態にならない', async () => {
      // 起動完了前（初期状態）
      expect(unreadTracker.isInitialLoadComplete()).toBe(false);

      await unreadTracker.markAsUnread(1);

      // 起動完了前なので未読にならない
      expect(unreadTracker.isUnread(1)).toBe(false);
      expect(unreadTracker.getUnreadCount()).toBe(0);
    });

    it('起動完了後はmarkAsUnreadで正常に未読状態になる', async () => {
      // 起動完了をマーク
      unreadTracker.setInitialLoadComplete();
      expect(unreadTracker.isInitialLoadComplete()).toBe(true);

      await unreadTracker.markAsUnread(1);

      // 起動完了後なので未読になる
      expect(unreadTracker.isUnread(1)).toBe(true);
      expect(unreadTracker.getUnreadCount()).toBe(1);
    });

    it('起動完了前のタブは永続化されない', async () => {
      // 起動完了前
      await unreadTracker.markAsUnread(1);

      // persistStateが呼ばれない
      expect(mockStorageService.set).not.toHaveBeenCalled();
    });

    it('起動完了後のタブは永続化される', async () => {
      // 起動完了をマーク
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);

      // persistStateが呼ばれる
      expect(mockStorageService.set).toHaveBeenCalledWith(
        STORAGE_KEYS.UNREAD_TABS,
        [1],
      );
    });
  });
});
