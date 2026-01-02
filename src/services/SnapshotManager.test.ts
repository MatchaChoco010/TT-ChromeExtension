import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SnapshotManager } from './SnapshotManager';
import type {
  IIndexedDBService,
  IStorageService,
  Snapshot,
  View,
  Group,
  TabNode,
} from '@/types';

/**
 * SnapshotManager のユニットテスト
 */
describe('SnapshotManager', () => {
  let snapshotManager: SnapshotManager;
  let mockIndexedDBService: IIndexedDBService;
  let mockStorageService: IStorageService;

  // テスト用のビューデータ
  const testViews: View[] = [
    { id: 'view-1', name: 'Work', color: '#ff0000' },
    { id: 'view-2', name: 'Personal', color: '#00ff00' },
  ];

  // テスト用のグループデータ
  const testGroups: Group[] = [
    { id: 'group-1', name: 'Research', color: '#0000ff', isExpanded: true },
  ];

  // テスト用のタブノードデータ
  const testNodes: Record<string, TabNode> = {
    'node-1': {
      id: 'node-1',
      tabId: 1,
      parentId: null,
      children: [],
      isExpanded: true,
      depth: 0,
      viewId: 'view-1',
    },
    'node-2': {
      id: 'node-2',
      tabId: 2,
      parentId: 'node-1',
      children: [],
      isExpanded: true,
      depth: 1,
      viewId: 'view-1',
    },
  };

  beforeEach(() => {
    // IndexedDBServiceのモック
    mockIndexedDBService = {
      saveSnapshot: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn().mockResolvedValue(null),
      getAllSnapshots: vi.fn().mockResolvedValue([]),
      deleteSnapshot: vi.fn().mockResolvedValue(undefined),
      deleteOldSnapshots: vi.fn().mockResolvedValue(undefined),
    };

    // StorageServiceのモック
    mockStorageService = {
      get: vi.fn().mockImplementation((key) => {
        if (key === 'tree_state') {
          return Promise.resolve({
            views: testViews,
            currentViewId: 'view-1',
            nodes: testNodes,
            tabToNode: { 1: 'node-1', 2: 'node-2' },
          });
        }
        if (key === 'groups') {
          return Promise.resolve({
            'group-1': testGroups[0],
          });
        }
        return Promise.resolve(null);
      }),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      onChange: vi.fn().mockReturnValue(() => {}),
    };

    // Mock chrome.tabs API（vi.stubGlobalを使用）
    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 1,
            url: 'https://example.com/page1',
            title: 'Page 1',
          },
          {
            id: 2,
            url: 'https://example.com/page2',
            title: 'Page 2',
          },
        ]),
        create: vi.fn().mockResolvedValue({ id: 100 }),
      },
    });

    snapshotManager = new SnapshotManager(
      mockIndexedDBService,
      mockStorageService,
    );
  });

  describe('createSnapshot', () => {
    it('should create a snapshot with current state', async () => {
      // スナップショットコマンドを実行する
      const snapshot = await snapshotManager.createSnapshot('Test Snapshot');

      // スナップショットが作成されることを確認
      expect(snapshot).toBeDefined();
      expect(snapshot.id).toMatch(/^snapshot-/);
      expect(snapshot.name).toBe('Test Snapshot');
      expect(snapshot.isAutoSave).toBe(false);
      expect(snapshot.createdAt).toBeInstanceOf(Date);

      // スナップショットデータが正しく含まれることを確認
      expect(snapshot.data.views).toEqual(testViews);
      expect(snapshot.data.groups).toEqual(testGroups);
      expect(snapshot.data.tabs).toHaveLength(2);

      // タブのURL、タイトル、親子関係、グループ情報を含む
      // chrome.tabsモックが必要だが、今はタブの構造だけ確認
      expect(snapshot.data.tabs[0]).toHaveProperty('url');
      expect(snapshot.data.tabs[0]).toHaveProperty('title');
      expect(snapshot.data.tabs[0]).toHaveProperty('parentId');
      expect(snapshot.data.tabs[0]).toHaveProperty('viewId');

      // IndexedDBに保存されることを確認
      expect(mockIndexedDBService.saveSnapshot).toHaveBeenCalledWith(snapshot);
    });

    it('should create auto-save snapshots when specified', async () => {
      const snapshot = await snapshotManager.createSnapshot('Auto', true);

      expect(snapshot.isAutoSave).toBe(true);
    });
  });

  describe('restoreSnapshot', () => {
    it('should restore snapshot from IndexedDB', async () => {
      // スナップショットをインポートする
      const mockSnapshot: Snapshot = {
        id: 'snapshot-123',
        createdAt: new Date('2024-01-01'),
        name: 'Saved Session',
        isAutoSave: false,
        data: {
          views: testViews,
          groups: testGroups,
          tabs: [
            {
              url: 'https://example.com',
              title: 'Example',
              parentId: null,
              viewId: 'view-1',
            },
          ],
        },
      };

      mockIndexedDBService.getSnapshot = vi
        .fn()
        .mockResolvedValue(mockSnapshot);

      await snapshotManager.restoreSnapshot('snapshot-123');

      // スナップショットが取得されることを確認
      expect(mockIndexedDBService.getSnapshot).toHaveBeenCalledWith(
        'snapshot-123',
      );

      // タブが作成されることを確認
      expect(global.chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://example.com',
        active: false,
      });
    });

    it('should throw error if snapshot not found', async () => {
      mockIndexedDBService.getSnapshot = vi.fn().mockResolvedValue(null);

      await expect(
        snapshotManager.restoreSnapshot('non-existent'),
      ).rejects.toThrow('Snapshot not found');
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete snapshot by ID', async () => {
      await snapshotManager.deleteSnapshot('snapshot-123');

      expect(mockIndexedDBService.deleteSnapshot).toHaveBeenCalledWith(
        'snapshot-123',
      );
    });
  });

  describe('getSnapshots', () => {
    it('should return all snapshots from IndexedDB', async () => {
      const mockSnapshots: Snapshot[] = [
        {
          id: 'snapshot-1',
          createdAt: new Date('2024-01-01'),
          name: 'Snapshot 1',
          isAutoSave: false,
          data: { views: [], tabs: [], groups: [] },
        },
        {
          id: 'snapshot-2',
          createdAt: new Date('2024-01-02'),
          name: 'Snapshot 2',
          isAutoSave: true,
          data: { views: [], tabs: [], groups: [] },
        },
      ];

      mockIndexedDBService.getAllSnapshots = vi
        .fn()
        .mockResolvedValue(mockSnapshots);

      const snapshots = await snapshotManager.getSnapshots();

      expect(snapshots).toEqual(mockSnapshots);
      expect(mockIndexedDBService.getAllSnapshots).toHaveBeenCalled();
    });
  });

  describe('exportSnapshot', () => {
    it('should export snapshot as JSON string', async () => {
      const mockSnapshot: Snapshot = {
        id: 'snapshot-123',
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        name: 'Export Test',
        isAutoSave: false,
        data: {
          views: testViews,
          groups: testGroups,
          tabs: [
            {
              url: 'https://example.com',
              title: 'Example',
              parentId: null,
              viewId: 'view-1',
            },
          ],
        },
      };

      mockIndexedDBService.getSnapshot = vi
        .fn()
        .mockResolvedValue(mockSnapshot);

      const jsonString = await snapshotManager.exportSnapshot('snapshot-123');

      // JSON文字列として返されることを確認
      expect(typeof jsonString).toBe('string');

      // パース可能であることを確認
      const parsed = JSON.parse(jsonString);
      expect(parsed.id).toBe('snapshot-123');
      expect(parsed.name).toBe('Export Test');
      expect(parsed.data.views).toEqual(testViews);
    });
  });

  describe('importSnapshot', () => {
    it('should import snapshot from JSON string', async () => {
      const snapshotData = {
        id: 'snapshot-456',
        createdAt: new Date('2024-01-01T00:00:00.000Z').toISOString(),
        name: 'Imported',
        isAutoSave: false,
        data: {
          views: testViews,
          groups: testGroups,
          tabs: [
            {
              url: 'https://example.com',
              title: 'Example',
              parentId: null,
              viewId: 'view-1',
            },
          ],
        },
      };

      const jsonString = JSON.stringify(snapshotData);

      const snapshot = await snapshotManager.importSnapshot(jsonString);

      // スナップショットが正しくインポートされることを確認
      expect(snapshot.id).toBe('snapshot-456');
      expect(snapshot.name).toBe('Imported');
      expect(snapshot.createdAt).toBeInstanceOf(Date);
      expect(snapshot.data.views).toEqual(testViews);

      // IndexedDBに保存されることを確認
      expect(mockIndexedDBService.saveSnapshot).toHaveBeenCalled();
    });

    it('should throw error for invalid JSON', async () => {
      await expect(
        snapshotManager.importSnapshot('invalid json'),
      ).rejects.toThrow();
    });
  });
});
