import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SnapshotManager } from './SnapshotManager';
import type {
  IIndexedDBService,
  IStorageService,
  View,
  Group,
  TabNode,
} from '@/types';

/**
 * SnapshotManager 自動スナップショット機能のユニットテスト
 * Task 14.2: 自動スナップショット機能
 * Requirements: 11.4, 11.5
 */
describe('SnapshotManager - Auto Snapshot', () => {
  let snapshotManager: SnapshotManager;
  let mockIndexedDBService: IIndexedDBService;
  let mockStorageService: IStorageService;

  // テスト用のビューデータ
  const testViews: View[] = [
    { id: 'view-1', name: 'Work', color: '#ff0000' },
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
  };

  beforeEach(() => {
    // タイマーのモック化
    vi.useFakeTimers();

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
            tabToNode: { 1: 'node-1' },
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

    // Mock chrome.tabs API
    global.chrome = {
      tabs: {
        query: vi.fn().mockResolvedValue([
          {
            id: 1,
            url: 'https://example.com/page1',
            title: 'Page 1',
          },
        ]),
        create: vi.fn().mockResolvedValue({ id: 100 }),
      },
      alarms: {
        create: vi.fn(),
        clear: vi.fn().mockResolvedValue(true),
        onAlarm: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    } as any;

    snapshotManager = new SnapshotManager(
      mockIndexedDBService,
      mockStorageService,
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startAutoSnapshot', () => {
    it('should create chrome alarm with correct interval', () => {
      // Requirement 11.4, 11.5: 定期的な自動スナップショット機能を提供する
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      // chrome.alarms.createが正しい設定で呼ばれることを確認
      expect(global.chrome.alarms.create).toHaveBeenCalledWith(
        'auto-snapshot',
        {
          periodInMinutes: intervalMinutes,
        },
      );

      // アラームリスナーが登録されることを確認
      expect(global.chrome.alarms.onAlarm.addListener).toHaveBeenCalled();
    });

    it('should create snapshot when alarm fires', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      // アラームリスナーを取得
      const alarmListener = (global.chrome.alarms.onAlarm.addListener as any)
        .mock.calls[0][0];

      // アラームを発火
      await alarmListener({ name: 'auto-snapshot' });

      // Requirement 11.5: 自動的にスナップショットを保存する
      // スナップショットが作成されることを確認
      expect(mockIndexedDBService.saveSnapshot).toHaveBeenCalled();

      // 保存されたスナップショットが自動保存フラグを持つことを確認
      const savedSnapshot = (mockIndexedDBService.saveSnapshot as any).mock
        .calls[0][0];
      expect(savedSnapshot.isAutoSave).toBe(true);
      expect(savedSnapshot.name).toMatch(/Auto Snapshot/);
    });

    it('should not create snapshot for non-auto-snapshot alarms', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      // アラームリスナーを取得
      const alarmListener = (global.chrome.alarms.onAlarm.addListener as any)
        .mock.calls[0][0];

      // 別のアラームを発火
      await alarmListener({ name: 'other-alarm' });

      // スナップショットが作成されないことを確認
      expect(mockIndexedDBService.saveSnapshot).not.toHaveBeenCalled();
    });

    it('should replace existing alarm when called multiple times', () => {
      snapshotManager.startAutoSnapshot(10);
      snapshotManager.startAutoSnapshot(20);

      // 2回目の呼び出しで前のアラームがクリアされることを確認
      expect(global.chrome.alarms.clear).toHaveBeenCalledWith('auto-snapshot');

      // 新しいアラームが作成されることを確認
      expect(global.chrome.alarms.create).toHaveBeenLastCalledWith(
        'auto-snapshot',
        {
          periodInMinutes: 20,
        },
      );
    });

    it('should handle interval of 0 (disabled)', () => {
      snapshotManager.startAutoSnapshot(0);

      // intervalが0の場合、アラームが作成されないことを確認
      expect(global.chrome.alarms.create).not.toHaveBeenCalled();

      // 既存のアラームがクリアされることを確認
      expect(global.chrome.alarms.clear).toHaveBeenCalledWith('auto-snapshot');
    });
  });

  describe('stopAutoSnapshot', () => {
    it('should clear chrome alarm', async () => {
      // アラームを開始
      snapshotManager.startAutoSnapshot(10);

      // アラームを停止
      await snapshotManager.stopAutoSnapshot();

      // chrome.alarms.clearが呼ばれることを確認
      expect(global.chrome.alarms.clear).toHaveBeenCalledWith('auto-snapshot');
    });

    it('should remove alarm listener', async () => {
      // アラームを開始
      snapshotManager.startAutoSnapshot(10);

      // リスナーを取得
      const alarmListener = (global.chrome.alarms.onAlarm.addListener as any)
        .mock.calls[0][0];

      // アラームを停止
      await snapshotManager.stopAutoSnapshot();

      // リスナーが削除されることを確認
      expect(global.chrome.alarms.onAlarm.removeListener).toHaveBeenCalledWith(
        alarmListener,
      );
    });

    it('should not throw error when called without starting', async () => {
      // アラームを開始せずに停止
      await expect(snapshotManager.stopAutoSnapshot()).resolves.not.toThrow();
    });
  });

  describe('Auto-snapshot integration', () => {
    it('should create auto-snapshots with timestamp-based names', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      // アラームリスナーを取得
      const alarmListener = (global.chrome.alarms.onAlarm.addListener as any)
        .mock.calls[0][0];

      // 現在時刻を固定
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      // アラームを発火
      await alarmListener({ name: 'auto-snapshot' });

      // スナップショット名にタイムスタンプが含まれることを確認
      const savedSnapshot = (mockIndexedDBService.saveSnapshot as any).mock
        .calls[0][0];
      expect(savedSnapshot.name).toContain('2024-01-01');
    });

    it('should handle errors during auto-snapshot gracefully', async () => {
      // エラーをスローするようにモックを設定
      mockIndexedDBService.saveSnapshot = vi
        .fn()
        .mockRejectedValue(new Error('Storage full'));

      const intervalMinutes = 10;
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation();

      snapshotManager.startAutoSnapshot(intervalMinutes);

      // アラームリスナーを取得
      const alarmListener = (global.chrome.alarms.onAlarm.addListener as any)
        .mock.calls[0][0];

      // アラームを発火
      await alarmListener({ name: 'auto-snapshot' });

      // エラーがログに記録されることを確認
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-snapshot failed'),
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
