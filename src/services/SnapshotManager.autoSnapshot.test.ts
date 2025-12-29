import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SnapshotManager } from './SnapshotManager';
import type {
  IIndexedDBService,
  IStorageService,
  View,
  Group,
  TabNode,
  Snapshot,
} from '@/types';

// Chrome mock（モジュールレベルで定義してテスト内から参照可能にする）
const chromeMock = {
  tabs: {
    query: vi.fn(),
    create: vi.fn(),
  },
  alarms: {
    create: vi.fn(),
    clear: vi.fn(),
    onAlarm: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    },
  },
};

// グローバルchromeオブジェクトをモック（vi.stubGlobalを使用）
vi.stubGlobal('chrome', chromeMock);

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

    // chromeMockのリセット
    vi.clearAllMocks();

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

    // chromeMockの初期化
    chromeMock.tabs.query.mockResolvedValue([
      {
        id: 1,
        url: 'https://example.com/page1',
        title: 'Page 1',
      },
    ]);
    chromeMock.tabs.create.mockResolvedValue({ id: 100 });
    chromeMock.alarms.clear.mockResolvedValue(true);

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
      expect(chromeMock.alarms.create).toHaveBeenCalledWith(
        'auto-snapshot',
        {
          periodInMinutes: intervalMinutes,
        },
      );

      // アラームリスナーが登録されることを確認
      expect(chromeMock.alarms.onAlarm.addListener).toHaveBeenCalled();
    });

    it('should create snapshot when alarm fires', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      // アラームリスナーを取得
      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      // アラームを発火
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      // Requirement 11.5: 自動的にスナップショットを保存する
      // スナップショットが作成されることを確認
      expect(mockIndexedDBService.saveSnapshot).toHaveBeenCalled();

      // 保存されたスナップショットが自動保存フラグを持つことを確認
      const saveSnapshotMock = vi.mocked(mockIndexedDBService.saveSnapshot);
      const savedSnapshot = saveSnapshotMock.mock.calls[0][0] as Snapshot;
      expect(savedSnapshot.isAutoSave).toBe(true);
      expect(savedSnapshot.name).toMatch(/Auto Snapshot/);
    });

    it('should not create snapshot for non-auto-snapshot alarms', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      // アラームリスナーを取得
      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      // 別のアラームを発火
      await alarmListener({ name: 'other-alarm', scheduledTime: Date.now() });

      // スナップショットが作成されないことを確認
      expect(mockIndexedDBService.saveSnapshot).not.toHaveBeenCalled();
    });

    it('should replace existing alarm when called multiple times', () => {
      snapshotManager.startAutoSnapshot(10);
      snapshotManager.startAutoSnapshot(20);

      // 2回目の呼び出しで前のアラームがクリアされることを確認
      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('auto-snapshot');

      // 新しいアラームが作成されることを確認
      expect(chromeMock.alarms.create).toHaveBeenLastCalledWith(
        'auto-snapshot',
        {
          periodInMinutes: 20,
        },
      );
    });

    it('should handle interval of 0 (disabled)', () => {
      snapshotManager.startAutoSnapshot(0);

      // intervalが0の場合、アラームが作成されないことを確認
      expect(chromeMock.alarms.create).not.toHaveBeenCalled();

      // 既存のアラームがクリアされることを確認
      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('auto-snapshot');
    });
  });

  describe('stopAutoSnapshot', () => {
    it('should clear chrome alarm', async () => {
      // アラームを開始
      snapshotManager.startAutoSnapshot(10);

      // アラームを停止
      await snapshotManager.stopAutoSnapshot();

      // chrome.alarms.clearが呼ばれることを確認
      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('auto-snapshot');
    });

    it('should remove alarm listener', async () => {
      // アラームを開始
      snapshotManager.startAutoSnapshot(10);

      // リスナーを取得
      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      // アラームを停止
      await snapshotManager.stopAutoSnapshot();

      // リスナーが削除されることを確認
      expect(chromeMock.alarms.onAlarm.removeListener).toHaveBeenCalledWith(
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
      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      // 現在時刻を固定
      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      // アラームを発火
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      // スナップショット名にタイムスタンプが含まれることを確認
      const saveSnapshotMock = vi.mocked(mockIndexedDBService.saveSnapshot);
      const savedSnapshot = saveSnapshotMock.mock.calls[0][0] as Snapshot;
      expect(savedSnapshot.name).toContain('2024-01-01');
    });

    it('should handle errors during auto-snapshot gracefully', async () => {
      // エラーをスローするようにモックを設定
      mockIndexedDBService.saveSnapshot = vi
        .fn()
        .mockRejectedValue(new Error('Storage full'));

      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      // アラームリスナーを取得
      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      // アラームを発火 - エラーがスローされないことを確認
      await expect(alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() })).resolves.not.toThrow();
    });
  });

  /**
   * Task 9.2: スナップショット自動保存バックグラウンド処理の追加テスト
   * - maxSnapshots超過時の古いスナップショット自動削除
   * - 設定変更時のアラーム再設定
   */
  describe('startAutoSnapshot with maxSnapshots', () => {
    it('should delete old snapshots when maxSnapshots is exceeded after auto-snapshot', async () => {
      // Requirement 6.5: 最大保持数を超えた古いスナップショットを自動削除する
      const intervalMinutes = 10;
      const maxSnapshots = 5;

      snapshotManager.startAutoSnapshot(intervalMinutes, maxSnapshots);

      // アラームリスナーを取得
      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      // アラームを発火
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      // スナップショット作成後に古いスナップショットが削除されることを確認
      expect(mockIndexedDBService.deleteOldSnapshots).toHaveBeenCalledWith(maxSnapshots);
    });

    it('should not delete old snapshots when maxSnapshots is 0 (unlimited)', async () => {
      const intervalMinutes = 10;
      const maxSnapshots = 0; // 無制限

      snapshotManager.startAutoSnapshot(intervalMinutes, maxSnapshots);

      // アラームリスナーを取得
      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      // アラームを発火
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      // maxSnapshotsが0の場合、deleteOldSnapshotsは呼ばれない
      expect(mockIndexedDBService.deleteOldSnapshots).not.toHaveBeenCalled();
    });

    it('should use default maxSnapshots when not provided', async () => {
      const intervalMinutes = 10;

      // maxSnapshotsを指定しない
      snapshotManager.startAutoSnapshot(intervalMinutes);

      // アラームリスナーを取得
      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      // アラームを発火
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      // maxSnapshotsが指定されていない場合はdeleteOldSnapshotsを呼ばない
      expect(mockIndexedDBService.deleteOldSnapshots).not.toHaveBeenCalled();
    });

    it('should handle deleteOldSnapshots error gracefully', async () => {
      // deleteOldSnapshotsがエラーをスローするようにモック
      mockIndexedDBService.deleteOldSnapshots = vi
        .fn()
        .mockRejectedValue(new Error('Delete failed'));

      const intervalMinutes = 10;
      const maxSnapshots = 5;

      snapshotManager.startAutoSnapshot(intervalMinutes, maxSnapshots);

      // アラームリスナーを取得
      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      // アラームを発火 - エラーがスローされないことを確認
      await expect(alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() })).resolves.not.toThrow();
    });
  });

  describe('updateAutoSnapshotSettings', () => {
    it('should restart auto-snapshot with new interval', () => {
      // Requirement 6.4: 設定変更時にアラームを再設定する
      snapshotManager.startAutoSnapshot(10);

      // 設定を変更
      snapshotManager.updateAutoSnapshotSettings(30, 10);

      // 新しいアラームが作成されることを確認
      expect(chromeMock.alarms.create).toHaveBeenLastCalledWith(
        'auto-snapshot',
        {
          periodInMinutes: 30,
        },
      );
    });

    it('should stop auto-snapshot when interval is 0', () => {
      snapshotManager.startAutoSnapshot(10);

      // 自動保存を無効化
      snapshotManager.updateAutoSnapshotSettings(0, 10);

      // アラームがクリアされ、新しいアラームが作成されないことを確認
      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('auto-snapshot');
      // 最後のcreate呼び出しはinterval: 10のもの（0では呼ばれない）
      const createCalls = chromeMock.alarms.create.mock.calls;
      const lastCallPeriod = createCalls[createCalls.length - 1]?.[1]?.periodInMinutes;
      expect(lastCallPeriod).toBe(10);
    });

    it('should update maxSnapshots setting', async () => {
      snapshotManager.startAutoSnapshot(10, 5);

      // maxSnapshotsを変更
      snapshotManager.updateAutoSnapshotSettings(10, 20);

      // アラームリスナーを取得（最後に登録されたもの）
      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[addListenerCalls.length - 1][0];

      // アラームを発火
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      // 新しいmaxSnapshotsが適用されることを確認
      expect(mockIndexedDBService.deleteOldSnapshots).toHaveBeenCalledWith(20);
    });
  });
});
