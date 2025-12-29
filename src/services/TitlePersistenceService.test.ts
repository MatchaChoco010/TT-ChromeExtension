import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TitlePersistenceService } from './TitlePersistenceService';
import type { IStorageService, StorageSchema } from '@/types';

/**
 * TitlePersistenceService のユニットテスト
 * Requirement 5.1, 5.2, 5.3, 5.4: タブタイトル永続化サービス
 */

// モックStorageService
function createMockStorageService(): IStorageService & {
  mockData: Record<string, unknown>;
} {
  const mockData: Record<string, unknown> = {};
  return {
    mockData,
    get: vi.fn().mockImplementation(async (key: keyof StorageSchema) => {
      return mockData[key] ?? null;
    }),
    set: vi.fn().mockImplementation(async (key: keyof StorageSchema, value: StorageSchema[keyof StorageSchema]) => {
      mockData[key] = value;
    }),
    remove: vi.fn().mockImplementation(async (key: string) => {
      delete mockData[key];
    }),
    onChange: vi.fn(() => () => {}),
  };
}

describe('TitlePersistenceService', () => {
  let service: TitlePersistenceService;
  let mockStorage: ReturnType<typeof createMockStorageService>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockStorage = createMockStorageService();
    service = new TitlePersistenceService(mockStorage);
  });

  describe('saveTitle', () => {
    it('Requirement 5.1: タブのタイトルが確定した場合、タイトルをストレージに永続化する', async () => {
      // Arrange
      const tabId = 123;
      const title = 'Test Page Title';

      // Act
      service.saveTitle(tabId, title);

      // デバウンスを待機
      await vi.runAllTimersAsync();

      // Assert
      expect(mockStorage.set).toHaveBeenCalledWith('tab_titles', { [tabId]: title });
    });

    it('複数のタブのタイトルを保存できる', async () => {
      // Arrange
      const tabId1 = 123;
      const title1 = 'Page 1';
      const tabId2 = 456;
      const title2 = 'Page 2';

      // Act
      service.saveTitle(tabId1, title1);
      await vi.runAllTimersAsync();
      service.saveTitle(tabId2, title2);
      await vi.runAllTimersAsync();

      // Assert
      expect(mockStorage.set).toHaveBeenLastCalledWith('tab_titles', {
        [tabId1]: title1,
        [tabId2]: title2,
      });
    });

    it('デバウンス内の連続した保存はまとめて実行される', async () => {
      // Arrange
      const tabId = 123;

      // Act
      service.saveTitle(tabId, 'Title 1');
      service.saveTitle(tabId, 'Title 2');
      service.saveTitle(tabId, 'Final Title');

      // デバウンスを待機
      await vi.runAllTimersAsync();

      // Assert - 1回のみ保存される
      expect(mockStorage.set).toHaveBeenCalledTimes(1);
      expect(mockStorage.set).toHaveBeenCalledWith('tab_titles', { [tabId]: 'Final Title' });
    });

    it('Requirement 5.3: タブが再読み込みされ新しいタイトルが取得された場合、永続化データを上書きする', async () => {
      // Arrange - 既存のタイトルを設定
      service.saveTitle(123, 'Old Title');
      await vi.runAllTimersAsync();

      // Act - 新しいタイトルで上書き
      service.saveTitle(123, 'New Title');
      await vi.runAllTimersAsync();

      // Assert
      expect(mockStorage.set).toHaveBeenLastCalledWith('tab_titles', { 123: 'New Title' });
    });
  });

  describe('getTitle', () => {
    it('Requirement 5.2: 永続化されたタイトルを取得できる', async () => {
      // Arrange
      service.saveTitle(123, 'Stored Title');
      await vi.runAllTimersAsync();

      // Act
      const title = service.getTitle(123);

      // Assert
      expect(title).toBe('Stored Title');
    });

    it('存在しないタブIDの場合はundefinedを返す', () => {
      // Act
      const title = service.getTitle(999);

      // Assert
      expect(title).toBeUndefined();
    });
  });

  describe('getAllTitles', () => {
    it('Requirement 5.2: すべての永続化タイトルを取得できる', async () => {
      // Arrange
      service.saveTitle(123, 'Title 1');
      service.saveTitle(456, 'Title 2');
      await vi.runAllTimersAsync();

      // Act
      const titles = service.getAllTitles();

      // Assert
      expect(titles).toEqual({
        123: 'Title 1',
        456: 'Title 2',
      });
    });
  });

  describe('removeTitle', () => {
    it('Requirement 5.4: タブが閉じられた際に該当タブのタイトルデータを削除する', async () => {
      // Arrange
      service.saveTitle(123, 'Title to Remove');
      service.saveTitle(456, 'Title to Keep');
      await vi.runAllTimersAsync();

      // Act
      service.removeTitle(123);
      await vi.runAllTimersAsync();

      // Assert
      expect(service.getTitle(123)).toBeUndefined();
      expect(service.getTitle(456)).toBe('Title to Keep');
    });
  });

  describe('cleanup', () => {
    it('存在しないタブのタイトルをクリーンアップする', async () => {
      // Arrange
      service.saveTitle(123, 'Title 1');
      service.saveTitle(456, 'Title 2');
      service.saveTitle(789, 'Title 3');
      await vi.runAllTimersAsync();

      // Act - タブ456のみが存在すると仮定
      service.cleanup([456]);
      await vi.runAllTimersAsync();

      // Assert
      expect(service.getTitle(123)).toBeUndefined();
      expect(service.getTitle(456)).toBe('Title 2');
      expect(service.getTitle(789)).toBeUndefined();
    });
  });

  describe('loadFromStorage', () => {
    it('Requirement 5.2: ブラウザ起動時に永続化されたタイトルを復元する', async () => {
      // Arrange - ストレージに既存データがある状態をシミュレート
      mockStorage.mockData['tab_titles'] = {
        123: 'Persisted Title 1',
        456: 'Persisted Title 2',
      };

      // Act
      await service.loadFromStorage();

      // Assert
      expect(service.getTitle(123)).toBe('Persisted Title 1');
      expect(service.getTitle(456)).toBe('Persisted Title 2');
    });

    it('ストレージにデータがない場合は空の状態を維持する', async () => {
      // Act
      await service.loadFromStorage();

      // Assert
      expect(service.getAllTitles()).toEqual({});
    });
  });
});
