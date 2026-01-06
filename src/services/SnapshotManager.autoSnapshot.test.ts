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

vi.stubGlobal('chrome', chromeMock);

/**
 * SnapshotManager 自動スナップショット機能のユニットテスト
 */
describe('SnapshotManager - Auto Snapshot', () => {
  let snapshotManager: SnapshotManager;
  let mockIndexedDBService: IIndexedDBService;
  let mockStorageService: IStorageService;

  const testViews: View[] = [
    { id: 'view-1', name: 'Work', color: '#ff0000' },
  ];

  const testGroups: Group[] = [
    { id: 'group-1', name: 'Research', color: '#0000ff', isExpanded: true },
  ];

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
    vi.useFakeTimers();
    vi.clearAllMocks();

    mockIndexedDBService = {
      saveSnapshot: vi.fn().mockResolvedValue(undefined),
      getSnapshot: vi.fn().mockResolvedValue(null),
      getAllSnapshots: vi.fn().mockResolvedValue([]),
      deleteSnapshot: vi.fn().mockResolvedValue(undefined),
      deleteOldSnapshots: vi.fn().mockResolvedValue(undefined),
    };

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
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      expect(chromeMock.alarms.create).toHaveBeenCalledWith(
        'auto-snapshot',
        {
          periodInMinutes: intervalMinutes,
        },
      );

      expect(chromeMock.alarms.onAlarm.addListener).toHaveBeenCalled();
    });

    it('should create snapshot when alarm fires', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      expect(mockIndexedDBService.saveSnapshot).toHaveBeenCalled();

      const saveSnapshotMock = vi.mocked(mockIndexedDBService.saveSnapshot);
      const savedSnapshot = saveSnapshotMock.mock.calls[0][0] as Snapshot;
      expect(savedSnapshot.isAutoSave).toBe(true);
      expect(savedSnapshot.name).toMatch(/Auto Snapshot/);
    });

    it('should not create snapshot for non-auto-snapshot alarms', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      await alarmListener({ name: 'other-alarm', scheduledTime: Date.now() });

      expect(mockIndexedDBService.saveSnapshot).not.toHaveBeenCalled();
    });

    it('should replace existing alarm when called multiple times', () => {
      snapshotManager.startAutoSnapshot(10);
      snapshotManager.startAutoSnapshot(20);

      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('auto-snapshot');

      expect(chromeMock.alarms.create).toHaveBeenLastCalledWith(
        'auto-snapshot',
        {
          periodInMinutes: 20,
        },
      );
    });

    it('should handle interval of 0 (disabled)', () => {
      snapshotManager.startAutoSnapshot(0);

      expect(chromeMock.alarms.create).not.toHaveBeenCalled();

      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('auto-snapshot');
    });
  });

  describe('stopAutoSnapshot', () => {
    it('should clear chrome alarm', async () => {
      snapshotManager.startAutoSnapshot(10);

      await snapshotManager.stopAutoSnapshot();

      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('auto-snapshot');
    });

    it('should remove alarm listener', async () => {
      snapshotManager.startAutoSnapshot(10);

      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      await snapshotManager.stopAutoSnapshot();

      expect(chromeMock.alarms.onAlarm.removeListener).toHaveBeenCalledWith(
        alarmListener,
      );
    });

    it('should not throw error when called without starting', async () => {
      await expect(snapshotManager.stopAutoSnapshot()).resolves.not.toThrow();
    });
  });

  describe('Auto-snapshot integration', () => {
    it('should create auto-snapshots with timestamp-based names', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      const mockDate = new Date('2024-01-01T12:00:00Z');
      vi.setSystemTime(mockDate);

      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      const saveSnapshotMock = vi.mocked(mockIndexedDBService.saveSnapshot);
      const savedSnapshot = saveSnapshotMock.mock.calls[0][0] as Snapshot;
      expect(savedSnapshot.name).toContain('2024-01-01');
    });

    it('should handle errors during auto-snapshot gracefully', async () => {
      mockIndexedDBService.saveSnapshot = vi
        .fn()
        .mockRejectedValue(new Error('Storage full'));

      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      await expect(alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() })).resolves.not.toThrow();
    });
  });

  describe('startAutoSnapshot with maxSnapshots', () => {
    it('should delete old snapshots when maxSnapshots is exceeded after auto-snapshot', async () => {
      const intervalMinutes = 10;
      const maxSnapshots = 5;

      snapshotManager.startAutoSnapshot(intervalMinutes, maxSnapshots);

      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      expect(mockIndexedDBService.deleteOldSnapshots).toHaveBeenCalledWith(maxSnapshots);
    });

    it('should not delete old snapshots when maxSnapshots is 0 (unlimited)', async () => {
      const intervalMinutes = 10;
      const maxSnapshots = 0;

      snapshotManager.startAutoSnapshot(intervalMinutes, maxSnapshots);

      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      expect(mockIndexedDBService.deleteOldSnapshots).not.toHaveBeenCalled();
    });

    it('should use default maxSnapshots when not provided', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      expect(mockIndexedDBService.deleteOldSnapshots).not.toHaveBeenCalled();
    });

    it('should handle deleteOldSnapshots error gracefully', async () => {
      mockIndexedDBService.deleteOldSnapshots = vi
        .fn()
        .mockRejectedValue(new Error('Delete failed'));

      const intervalMinutes = 10;
      const maxSnapshots = 5;

      snapshotManager.startAutoSnapshot(intervalMinutes, maxSnapshots);

      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[0][0];

      await expect(alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() })).resolves.not.toThrow();
    });
  });

  describe('updateAutoSnapshotSettings', () => {
    it('should restart auto-snapshot with new interval', () => {
      snapshotManager.startAutoSnapshot(10);

      snapshotManager.updateAutoSnapshotSettings(30, 10);

      expect(chromeMock.alarms.create).toHaveBeenLastCalledWith(
        'auto-snapshot',
        {
          periodInMinutes: 30,
        },
      );
    });

    it('should stop auto-snapshot when interval is 0', () => {
      snapshotManager.startAutoSnapshot(10);

      snapshotManager.updateAutoSnapshotSettings(0, 10);

      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('auto-snapshot');
      const createCalls = chromeMock.alarms.create.mock.calls;
      const lastCallPeriod = createCalls[createCalls.length - 1]?.[1]?.periodInMinutes;
      expect(lastCallPeriod).toBe(10);
    });

    it('should update maxSnapshots setting', async () => {
      snapshotManager.startAutoSnapshot(10, 5);

      snapshotManager.updateAutoSnapshotSettings(10, 20);

      type AlarmListener = (alarm: chrome.alarms.Alarm) => void;
      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[AlarmListener]>;
      const alarmListener = addListenerCalls[addListenerCalls.length - 1][0];

      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      expect(mockIndexedDBService.deleteOldSnapshots).toHaveBeenCalledWith(20);
    });
  });
});
