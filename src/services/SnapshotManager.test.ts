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
    views: {
      'default': {
        info: { id: 'default', name: 'Default', color: '#3B82F6' },
        rootNodeIds: ['node-1'],
        nodes: {
          'node-1': {
            id: 'node-1',
            tabId: 1,
            parentId: null,
            children: [],
            isExpanded: true,
            depth: 0,
          },
        },
      },
    },
    viewOrder: ['default'],
    currentViewId: 'default',
    tabToNode: { 1: { viewId: 'default', nodeId: 'node-1' } },
    treeStructure: [],
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
          { id: 1, url: 'https://example.com', title: 'Example' },
        ]),
        create: vi.fn().mockResolvedValue({ id: 2 }),
      },
      alarms: {
        create: vi.fn(),
        clear: vi.fn(),
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

  describe('restoreFromJson', () => {
    it('JSON文字列からタブを復元する', async () => {
      const snapshotJson = JSON.stringify({
        id: 'snapshot-123',
        createdAt: new Date().toISOString(),
        name: 'Test Snapshot',
        isAutoSave: false,
        data: {
          views: [{ id: 'default', name: 'Default', color: '#3B82F6' }],
          tabs: [
            { url: 'https://example.com', title: 'Example', parentId: null, viewId: 'default' },
          ],
          groups: [],
        },
      });

      await snapshotManager.restoreFromJson(snapshotJson);

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://example.com',
        active: false,
      });
    });
  });

  describe('startAutoSnapshot', () => {
    it('間隔が0の場合はアラームを設定しない', () => {
      snapshotManager.startAutoSnapshot(0);

      expect(chrome.alarms.create).not.toHaveBeenCalled();
    });

    it('間隔が指定されている場合はアラームを設定する', () => {
      snapshotManager.startAutoSnapshot(10);

      expect(chrome.alarms.create).toHaveBeenCalledWith('auto-snapshot', {
        periodInMinutes: 10,
      });
    });
  });

  describe('stopAutoSnapshot', () => {
    it('アラームをクリアする', async () => {
      await snapshotManager.stopAutoSnapshot();

      expect(chrome.alarms.clear).toHaveBeenCalledWith('auto-snapshot');
    });
  });
});
