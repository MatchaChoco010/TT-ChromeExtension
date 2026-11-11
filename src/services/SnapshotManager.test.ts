import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SnapshotManager } from './SnapshotManager';
import type { IDownloadService, IStorageService, TreeState, UserSettings } from '@/types';

const createMockDownloadService = (): IDownloadService => ({
  downloadSnapshot: vi.fn().mockResolvedValue(1),
});

const createMockStorageService = (): IStorageService => ({
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  onChange: vi.fn().mockReturnValue(() => {}),
});

describe('SnapshotManager', () => {
  let downloadService: IDownloadService;
  let storageService: IStorageService;
  let snapshotManager: SnapshotManager;

  const mockTreeState: TreeState = {
    windows: [
      {
        windowId: 1,
        views: [
          {
            name: 'Default',
            color: '#3B82F6',
            rootNodes: [
              {
                tabId: 1,
                isExpanded: true,
                children: [],
              },
            ],
            pinnedTabIds: [],
          },
        ],
        activeViewIndex: 0,
      },
    ],
  };

  const mockSettings: UserSettings = {
    fontSize: 14,
    fontFamily: 'system-ui',
    customCSS: '',
    newTabPosition: 'child',
    closeWarningThreshold: 10,
    showUnreadIndicator: true,
    autoSnapshotInterval: 0,
    childTabBehavior: 'promote',
    snapshotSubfolder: 'TT-Snapshots',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    downloadService = createMockDownloadService();
    storageService = createMockStorageService();
    snapshotManager = new SnapshotManager(downloadService, storageService);

    (storageService.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
      if (key === 'tree_state') return Promise.resolve(mockTreeState);
      if (key === 'user_settings') return Promise.resolve(mockSettings);
      if (key === 'groups') return Promise.resolve({});
      return Promise.resolve(null);
    });

    vi.stubGlobal('chrome', {
      tabs: {
        query: vi.fn().mockResolvedValue([
          { id: 1, url: 'https://example.com', title: 'Example', windowId: 1 },
        ]),
        create: vi.fn().mockResolvedValue({ id: 2 }),
      },
      windows: {
        create: vi.fn().mockResolvedValue({ id: 2, tabs: [{ id: 100 }] }),
      },
      alarms: {
        create: vi.fn(),
        clear: vi.fn(),
        get: vi.fn(),
        onAlarm: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    });
  });

  describe('createSnapshot', () => {
    it('スナップショットを作成してダウンロードする', async () => {
      const snapshot = await snapshotManager.createSnapshot('Test Snapshot', false);

      expect(snapshot.name).toBe('Test Snapshot');
      expect(snapshot.isAutoSave).toBe(false);
      expect(snapshot.data.views).toHaveLength(1);
      expect(snapshot.data.tabs).toHaveLength(1);
      expect(downloadService.downloadSnapshot).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('vivaldi-tt-snapshot-'),
        'TT-Snapshots'
      );
    });

    it('自動保存フラグが正しく設定される', async () => {
      const snapshot = await snapshotManager.createSnapshot('Auto Snapshot', true);

      expect(snapshot.isAutoSave).toBe(true);
      expect(downloadService.downloadSnapshot).toHaveBeenCalledWith(
        expect.any(String),
        expect.stringContaining('-auto-'),
        'TT-Snapshots'
      );
    });

    it('tree_stateがない場合はエラーをスローする', async () => {
      (storageService.get as ReturnType<typeof vi.fn>).mockImplementation((key: string) => {
        if (key === 'tree_state') return Promise.resolve(null);
        if (key === 'user_settings') return Promise.resolve(mockSettings);
        return Promise.resolve(null);
      });

      await expect(snapshotManager.createSnapshot('Test', false)).rejects.toThrow('Tree state not found');
    });
  });

  describe('scheduleAutoSnapshot', () => {
    const mockExistingAlarm = (alarm: chrome.alarms.Alarm | undefined): void => {
      vi.mocked(chrome.alarms.get as (name: string) => Promise<chrome.alarms.Alarm | undefined>).mockResolvedValue(alarm);
    };

    it('間隔が0の場合、既存のアラームを止める', async () => {
      mockExistingAlarm({ name: 'auto-snapshot', scheduledTime: 0, periodInMinutes: 10, persistAcrossSessions: false });

      await snapshotManager.scheduleAutoSnapshot(0);

      expect(chrome.alarms.clear).toHaveBeenCalledWith('auto-snapshot');
      expect(chrome.alarms.create).not.toHaveBeenCalled();
    });

    it('アラームがない場合は指定した間隔で作成する', async () => {
      mockExistingAlarm(undefined);

      await snapshotManager.scheduleAutoSnapshot(10);

      expect(chrome.alarms.create).toHaveBeenCalledWith('auto-snapshot', { periodInMinutes: 10 });
    });

    it('同じ間隔のアラームが既にある場合は作り直さない', async () => {
      mockExistingAlarm({ name: 'auto-snapshot', scheduledTime: 0, periodInMinutes: 10, persistAcrossSessions: false });

      await snapshotManager.scheduleAutoSnapshot(10);

      expect(chrome.alarms.create).not.toHaveBeenCalled();
      expect(chrome.alarms.clear).not.toHaveBeenCalled();
    });

    it('間隔が変わった場合は作り直す', async () => {
      mockExistingAlarm({ name: 'auto-snapshot', scheduledTime: 0, periodInMinutes: 10, persistAcrossSessions: false });

      await snapshotManager.scheduleAutoSnapshot(30);

      expect(chrome.alarms.create).toHaveBeenCalledWith('auto-snapshot', { periodInMinutes: 30 });
    });
  });

  describe('isAutoSnapshotAlarm', () => {
    it('自動スナップショットのアラームだけを判定する', () => {
      expect(snapshotManager.isAutoSnapshotAlarm({ name: 'auto-snapshot', scheduledTime: 0, persistAcrossSessions: false })).toBe(true);
      expect(snapshotManager.isAutoSnapshotAlarm({ name: 'other', scheduledTime: 0, persistAcrossSessions: false })).toBe(false);
    });
  });
});
