import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UnreadTracker } from './UnreadTracker';
import type { IStorageService } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

describe('UnreadTracker', () => {
  let mockStorageService: IStorageService;
  let unreadTracker: UnreadTracker;

  beforeEach(() => {
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
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(tabId);

      expect(unreadTracker.isUnread(tabId)).toBe(true);
    });

    it('未読タブをストレージに永続化する', async () => {
      const tabId = 1;
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(tabId);

      expect(mockStorageService.set).toHaveBeenCalledWith(
        STORAGE_KEYS.UNREAD_TABS,
        [tabId],
      );
    });

    it('複数のタブを未読としてマークできる', async () => {
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
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);
      await unreadTracker.markAsUnread(1);

      expect(unreadTracker.getUnreadCount()).toBe(1);
    });
  });

  describe('markAsRead', () => {
    it('未読タブを既読としてマークできる', async () => {
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);
      expect(unreadTracker.isUnread(1)).toBe(true);

      await unreadTracker.markAsRead(1);

      expect(unreadTracker.isUnread(1)).toBe(false);
    });

    it('既読マーク後にストレージを更新する', async () => {
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

  describe('ブラウザ復元時の未読状態', () => {
    it('clear()でストレージの未読状態を全てクリアできる', async () => {
      mockStorageService.get = vi.fn().mockResolvedValue([1, 2, 3]);

      await unreadTracker.loadFromStorage();

      expect(unreadTracker.isUnread(1)).toBe(true);
      expect(unreadTracker.isUnread(2)).toBe(true);
      expect(unreadTracker.isUnread(3)).toBe(true);

      await unreadTracker.clear();

      expect(unreadTracker.isUnread(1)).toBe(false);
      expect(unreadTracker.isUnread(2)).toBe(false);
      expect(unreadTracker.isUnread(3)).toBe(false);
      expect(unreadTracker.getUnreadCount()).toBe(0);
    });

    it('起動時にclear()を呼び出すことで復元タブに未読を付けない', async () => {
      mockStorageService.get = vi.fn().mockResolvedValue([1, 2, 3]);

      await unreadTracker.loadFromStorage();

      await unreadTracker.clear();

      expect(unreadTracker.getUnreadCount()).toBe(0);

      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(4);
      expect(unreadTracker.isUnread(4)).toBe(true);
      expect(unreadTracker.isUnread(1)).toBe(false);
    });
  });

  describe('initialLoadComplete', () => {
    it('初期状態ではisInitialLoadCompleteがfalseを返す', () => {
      expect(unreadTracker.isInitialLoadComplete()).toBe(false);
    });

    it('setInitialLoadCompleteを呼び出すとisInitialLoadCompleteがtrueを返す', () => {
      unreadTracker.setInitialLoadComplete();

      expect(unreadTracker.isInitialLoadComplete()).toBe(true);
    });

    it('起動完了前はmarkAsUnreadを呼び出しても未読状態にならない', async () => {
      expect(unreadTracker.isInitialLoadComplete()).toBe(false);

      await unreadTracker.markAsUnread(1);

      expect(unreadTracker.isUnread(1)).toBe(false);
      expect(unreadTracker.getUnreadCount()).toBe(0);
    });

    it('起動完了後はmarkAsUnreadで正常に未読状態になる', async () => {
      unreadTracker.setInitialLoadComplete();
      expect(unreadTracker.isInitialLoadComplete()).toBe(true);

      await unreadTracker.markAsUnread(1);

      expect(unreadTracker.isUnread(1)).toBe(true);
      expect(unreadTracker.getUnreadCount()).toBe(1);
    });

    it('起動完了前のタブは永続化されない', async () => {
      await unreadTracker.markAsUnread(1);

      expect(mockStorageService.set).not.toHaveBeenCalled();
    });

    it('起動完了後のタブは永続化される', async () => {
      unreadTracker.setInitialLoadComplete();

      await unreadTracker.markAsUnread(1);

      expect(mockStorageService.set).toHaveBeenCalledWith(
        STORAGE_KEYS.UNREAD_TABS,
        [1],
      );
    });
  });
});
