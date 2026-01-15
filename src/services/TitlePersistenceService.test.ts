import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TitlePersistenceService } from './TitlePersistenceService';
import type { IStorageService, StorageSchema } from '@/types';

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
    it('タブのタイトルが確定した場合、タイトルをストレージに永続化する', async () => {
      const tabId = 123;
      const title = 'Test Page Title';

      service.saveTitle(tabId, title);

      await vi.runAllTimersAsync();

      expect(mockStorage.set).toHaveBeenCalledWith('tab_titles', { [tabId]: title });
    });

    it('複数のタブのタイトルを保存できる', async () => {
      const tabId1 = 123;
      const title1 = 'Page 1';
      const tabId2 = 456;
      const title2 = 'Page 2';

      service.saveTitle(tabId1, title1);
      await vi.runAllTimersAsync();
      service.saveTitle(tabId2, title2);
      await vi.runAllTimersAsync();

      expect(mockStorage.set).toHaveBeenLastCalledWith('tab_titles', {
        [tabId1]: title1,
        [tabId2]: title2,
      });
    });

    it('デバウンス内の連続した保存はまとめて実行される', async () => {
      const tabId = 123;

      service.saveTitle(tabId, 'Title 1');
      service.saveTitle(tabId, 'Title 2');
      service.saveTitle(tabId, 'Final Title');

      await vi.runAllTimersAsync();

      expect(mockStorage.set).toHaveBeenCalledTimes(1);
      expect(mockStorage.set).toHaveBeenCalledWith('tab_titles', { [tabId]: 'Final Title' });
    });

    it('タブが再読み込みされ新しいタイトルが取得された場合、永続化データを上書きする', async () => {
      service.saveTitle(123, 'Old Title');
      await vi.runAllTimersAsync();

      service.saveTitle(123, 'New Title');
      await vi.runAllTimersAsync();

      expect(mockStorage.set).toHaveBeenLastCalledWith('tab_titles', { 123: 'New Title' });
    });
  });

  describe('getTitle', () => {
    it('永続化されたタイトルを取得できる', async () => {
      service.saveTitle(123, 'Stored Title');
      await vi.runAllTimersAsync();

      const title = service.getTitle(123);

      expect(title).toBe('Stored Title');
    });

    it('存在しないタブIDの場合はundefinedを返す', () => {
      const title = service.getTitle(999);

      expect(title).toBeUndefined();
    });
  });

  describe('getAllTitles', () => {
    it('すべての永続化タイトルを取得できる', async () => {
      service.saveTitle(123, 'Title 1');
      service.saveTitle(456, 'Title 2');
      await vi.runAllTimersAsync();

      const titles = service.getAllTitles();

      expect(titles).toEqual({
        123: 'Title 1',
        456: 'Title 2',
      });
    });
  });

  describe('removeTitle', () => {
    it('タブが閉じられた際に該当タブのタイトルデータを削除する', async () => {
      service.saveTitle(123, 'Title to Remove');
      service.saveTitle(456, 'Title to Keep');
      await vi.runAllTimersAsync();

      service.removeTitle(123);
      await vi.runAllTimersAsync();

      expect(service.getTitle(123)).toBeUndefined();
      expect(service.getTitle(456)).toBe('Title to Keep');
    });
  });

  describe('cleanup', () => {
    it('存在しないタブのタイトルをクリーンアップする', async () => {
      service.saveTitle(123, 'Title 1');
      service.saveTitle(456, 'Title 2');
      service.saveTitle(789, 'Title 3');
      await vi.runAllTimersAsync();

      service.cleanup([456]);
      await vi.runAllTimersAsync();

      expect(service.getTitle(123)).toBeUndefined();
      expect(service.getTitle(456)).toBe('Title 2');
      expect(service.getTitle(789)).toBeUndefined();
    });
  });

  describe('loadFromStorage', () => {
    it('ブラウザ起動時に永続化されたタイトルを復元する', async () => {
      mockStorage.mockData['tab_titles'] = {
        123: 'Persisted Title 1',
        456: 'Persisted Title 2',
      };

      await service.loadFromStorage();

      expect(service.getTitle(123)).toBe('Persisted Title 1');
      expect(service.getTitle(456)).toBe('Persisted Title 2');
    });

    it('ストレージにデータがない場合は空の状態を維持する', async () => {
      await service.loadFromStorage();

      expect(service.getAllTitles()).toEqual({});
    });
  });
});
