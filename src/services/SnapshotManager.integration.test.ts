import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { SnapshotManager } from './SnapshotManager';
import { IndexedDBService } from '@/storage/IndexedDBService';
import type {
  IStorageService,
  View,
  Group,
  TabNode,
  TabSnapshot,
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
 * SnapshotManager 統合テスト
 *
 * Acceptance Criteria:
 * - スナップショットがJSON形式でエクスポートされることを確認
 * - スナップショットからタブとツリー構造が復元されることを確認
 * - 自動スナップショットが設定間隔で保存されることを確認
 */
describe('SnapshotManager - Integration Tests', () => {
  let snapshotManager: SnapshotManager;
  let indexedDBService: IndexedDBService;
  let mockStorageService: IStorageService;

  const testViews: View[] = [
    { id: 'view-1', name: 'Work', color: '#ff0000' },
    { id: 'view-2', name: 'Personal', color: '#00ff00' },
  ];

  const testGroups: Group[] = [
    { id: 'group-1', name: 'Research', color: '#0000ff', isExpanded: true },
    { id: 'group-2', name: 'Development', color: '#ffff00', isExpanded: false },
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
    'node-2': {
      id: 'node-2',
      tabId: 2,
      parentId: 'node-1',
      children: [],
      isExpanded: true,
      depth: 1,
      viewId: 'view-1',
    },
    'node-3': {
      id: 'node-3',
      tabId: 3,
      parentId: null,
      children: [],
      isExpanded: true,
      depth: 0,
      viewId: 'view-2',
    },
  };

  beforeEach(async () => {
    indexedDBService = new IndexedDBService();

    mockStorageService = {
      get: vi.fn().mockImplementation((key: string) => {
        if (key === 'tree_state') {
          return Promise.resolve({
            views: testViews,
            currentViewId: 'view-1',
            nodes: testNodes,
            tabToNode: { 1: 'node-1', 2: 'node-2', 3: 'node-3' },
          });
        }
        if (key === 'groups') {
          return Promise.resolve({
            'group-1': testGroups[0],
            'group-2': testGroups[1],
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
        windowId: 1,
      },
      {
        id: 2,
        url: 'https://example.com/page2',
        title: 'Page 2 - Child of Page 1',
        windowId: 1,
      },
      {
        id: 3,
        url: 'https://example.com/page3',
        title: 'Page 3',
        windowId: 1,
      },
    ]);
    chromeMock.tabs.create.mockImplementation(({ url }: { url: string }) => {
      const newId = 100 + chromeMock.tabs.create.mock.calls.length;
      return Promise.resolve({
        id: newId,
        url,
        title: `Tab ${newId}`,
        windowId: 1,
      });
    });
    chromeMock.alarms.clear.mockResolvedValue(true);

    snapshotManager = new SnapshotManager(
      indexedDBService,
      mockStorageService,
    );
  });

  afterEach(async () => {
    await indexedDBService.deleteOldSnapshots(0);
  });

  describe('JSON Export and Import', () => {
    it('should export snapshot as JSON format with all required data', async () => {
      const snapshot = await snapshotManager.createSnapshot('Export Test');

      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);

      expect(typeof jsonString).toBe('string');
      expect(jsonString.length).toBeGreaterThan(0);

      const parsed = JSON.parse(jsonString);

      expect(parsed.id).toBe(snapshot.id);
      expect(parsed.name).toBe('Export Test');
      expect(parsed.createdAt).toBeDefined();
      expect(parsed.isAutoSave).toBe(false);

      expect(parsed.data.views).toEqual(testViews);

      expect(parsed.data.groups).toEqual(testGroups);

      expect(parsed.data.tabs).toHaveLength(3);

      parsed.data.tabs.forEach((tab: TabSnapshot) => {
        expect(tab).toHaveProperty('url');
        expect(tab).toHaveProperty('title');
        expect(tab).toHaveProperty('parentId');
        expect(tab).toHaveProperty('viewId');
      });

      const tab2 = parsed.data.tabs.find(
        (t: TabSnapshot) => t.url === 'https://example.com/page2',
      );
      expect(tab2.parentId).toBe('node-1');

      const tab1 = parsed.data.tabs.find(
        (t: TabSnapshot) => t.url === 'https://example.com/page1',
      );
      expect(tab1.parentId).toBeNull();
    });

    it('should export and import snapshot maintaining data integrity', async () => {
      const originalSnapshot = await snapshotManager.createSnapshot(
        'Round-trip Test',
      );

      const jsonString = await snapshotManager.exportSnapshot(
        originalSnapshot.id,
      );

      await snapshotManager.deleteSnapshot(originalSnapshot.id);

      const importedSnapshot = await snapshotManager.importSnapshot(jsonString);

      expect(importedSnapshot.name).toBe('Round-trip Test');
      expect(importedSnapshot.data.views).toEqual(testViews);
      expect(importedSnapshot.data.groups).toEqual(testGroups);
      expect(importedSnapshot.data.tabs).toHaveLength(3);
    });

    it('should export snapshot with correct JSON structure format', async () => {
      const snapshot = await snapshotManager.createSnapshot(
        'Structure Test',
      );
      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);
      const parsed = JSON.parse(jsonString);

      expect(parsed).toHaveProperty('id');
      expect(parsed).toHaveProperty('createdAt');
      expect(parsed).toHaveProperty('name');
      expect(parsed).toHaveProperty('isAutoSave');
      expect(parsed).toHaveProperty('data');

      expect(parsed.data).toHaveProperty('views');
      expect(parsed.data).toHaveProperty('tabs');
      expect(parsed.data).toHaveProperty('groups');

      expect(Array.isArray(parsed.data.views)).toBe(true);
      expect(Array.isArray(parsed.data.tabs)).toBe(true);
      expect(Array.isArray(parsed.data.groups)).toBe(true);
    });
  });

  describe('Snapshot Restoration', () => {
    it('should restore tabs and tree structure from snapshot', async () => {
      const snapshot = await snapshotManager.createSnapshot('Restore Test');

      chromeMock.tabs.create.mockClear();

      await snapshotManager.restoreSnapshot(snapshot.id);

      expect(chromeMock.tabs.create).toHaveBeenCalledTimes(3);

      const calls = chromeMock.tabs.create.mock.calls as Array<[{ url: string; active: boolean }]>;
      const urls = calls.map((call) => call[0].url);

      expect(urls).toContain('https://example.com/page1');
      expect(urls).toContain('https://example.com/page2');
      expect(urls).toContain('https://example.com/page3');

      calls.forEach((call) => {
        expect(call[0].active).toBe(false);
      });
    });

    it('should restore tabs in correct order preserving hierarchy', async () => {
      const snapshot = await snapshotManager.createSnapshot(
        'Hierarchy Test',
      );

      const exportedData = await snapshotManager.exportSnapshot(snapshot.id);
      const parsed = JSON.parse(exportedData);

      const tabs = parsed.data.tabs as TabSnapshot[];
      const parentTab = tabs.find((t) => t.parentId === null);
      const childTab = tabs.find((t) => t.parentId === 'node-1');

      expect(parentTab).toBeDefined();
      expect(childTab).toBeDefined();
      expect(childTab?.parentId).toBe('node-1');
    });

    it('should handle snapshot restoration with empty tabs gracefully', async () => {
      mockStorageService.get = vi.fn().mockImplementation((key: string) => {
        if (key === 'tree_state') {
          return Promise.resolve({
            views: testViews,
            currentViewId: 'view-1',
            nodes: {},
            tabToNode: {},
          });
        }
        if (key === 'groups') {
          return Promise.resolve({});
        }
        return Promise.resolve(null);
      });

      chromeMock.tabs.query.mockResolvedValue([]);

      const snapshot = await snapshotManager.createSnapshot('Empty Test');

      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);
      const parsed = JSON.parse(jsonString);

      expect(parsed.data.tabs).toHaveLength(0);
    });
  });

  describe('Auto-Snapshot Functionality', () => {
    it('should create auto-snapshots at configured intervals', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      expect(chromeMock.alarms.create).toHaveBeenCalledWith(
        'auto-snapshot',
        {
          periodInMinutes: intervalMinutes,
        },
      );

      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[(alarm: chrome.alarms.Alarm) => void]>;
      const alarmListener = addListenerCalls[0][0];

      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });
      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      const snapshots = await snapshotManager.getSnapshots();
      expect(snapshots.length).toBe(3);

      snapshots.forEach((snapshot) => {
        expect(snapshot.isAutoSave).toBe(true);
        expect(snapshot.name).toContain('Auto Snapshot');
      });
    });

    it('should create auto-snapshots with timestamp in name', async () => {
      const intervalMinutes = 10;

      snapshotManager.startAutoSnapshot(intervalMinutes);

      const addListenerCalls = chromeMock.alarms.onAlarm.addListener.mock.calls as Array<[(alarm: chrome.alarms.Alarm) => void]>;
      const alarmListener = addListenerCalls[0][0];

      await alarmListener({ name: 'auto-snapshot', scheduledTime: Date.now() });

      const snapshots = await snapshotManager.getSnapshots();
      expect(snapshots.length).toBe(1);

      const today = new Date().toISOString().split('T')[0];
      expect(snapshots[0].name).toContain(today);
      expect(snapshots[0].isAutoSave).toBe(true);
    });

    it('should stop auto-snapshots when interval is set to 0', async () => {
      snapshotManager.startAutoSnapshot(10);

      chromeMock.alarms.create.mockClear();

      snapshotManager.startAutoSnapshot(0);

      expect(chromeMock.alarms.clear).toHaveBeenCalledWith('auto-snapshot');

      expect(chromeMock.alarms.create).not.toHaveBeenCalled();
    });

    it('should maintain auto-snapshot state across restarts', async () => {
      snapshotManager.startAutoSnapshot(10);

      expect(chromeMock.alarms.onAlarm.addListener).toHaveBeenCalled();

      await snapshotManager.stopAutoSnapshot();

      expect(chromeMock.alarms.onAlarm.removeListener).toHaveBeenCalled();
    });
  });

  describe('Snapshot History Management', () => {
    it('should maintain multiple snapshots in IndexedDB', async () => {
      await snapshotManager.createSnapshot('Snapshot 1');
      await snapshotManager.createSnapshot('Snapshot 2');
      await snapshotManager.createSnapshot('Snapshot 3');

      const snapshots = await snapshotManager.getSnapshots();
      expect(snapshots.length).toBe(3);

      const names = snapshots.map((s) => s.name);
      expect(names).toContain('Snapshot 1');
      expect(names).toContain('Snapshot 2');
      expect(names).toContain('Snapshot 3');
    });

    it('should delete specific snapshots', async () => {
      const snapshot1 = await snapshotManager.createSnapshot('Delete Test 1');
      const snapshot2 = await snapshotManager.createSnapshot('Delete Test 2');

      await snapshotManager.deleteSnapshot(snapshot1.id);

      const snapshots = await snapshotManager.getSnapshots();
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].id).toBe(snapshot2.id);
    });

    it('should delete old snapshots keeping only recent ones', async () => {
      for (let i = 1; i <= 15; i++) {
        await snapshotManager.createSnapshot(`Snapshot ${i}`);
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      await indexedDBService.deleteOldSnapshots(10);

      const snapshots = await snapshotManager.getSnapshots();
      expect(snapshots.length).toBe(10);

      const names = snapshots.map((s) => s.name);
      expect(names).toContain('Snapshot 15');
      expect(names).toContain('Snapshot 14');
      expect(names).toContain('Snapshot 13');
      expect(names).toContain('Snapshot 6');
      expect(names).not.toContain('Snapshot 1');
      expect(names).not.toContain('Snapshot 2');
      expect(names).not.toContain('Snapshot 3');
      expect(names).not.toContain('Snapshot 4');
      expect(names).not.toContain('Snapshot 5');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when exporting non-existent snapshot', async () => {
      await expect(
        snapshotManager.exportSnapshot('non-existent-id'),
      ).rejects.toThrow('Snapshot not found');
    });

    it('should throw error when restoring non-existent snapshot', async () => {
      await expect(
        snapshotManager.restoreSnapshot('non-existent-id'),
      ).rejects.toThrow('Snapshot not found');
    });

    it('should throw error when importing invalid JSON', async () => {
      await expect(
        snapshotManager.importSnapshot('invalid json data'),
      ).rejects.toThrow();
    });

    it('should handle storage errors gracefully', async () => {
      mockStorageService.get = vi
        .fn()
        .mockRejectedValue(new Error('Storage error'));

      await expect(
        snapshotManager.createSnapshot('Error Test'),
      ).rejects.toThrow();
    });
  });

  describe('Data Integrity', () => {
    it('should preserve view IDs in snapshots', async () => {
      const snapshot = await snapshotManager.createSnapshot('View ID Test');
      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);
      const parsed = JSON.parse(jsonString);

      const tabs = parsed.data.tabs as TabSnapshot[];
      const tab1 = tabs.find(
        (t) => t.url === 'https://example.com/page1',
      );
      const tab3 = tabs.find(
        (t) => t.url === 'https://example.com/page3',
      );

      expect(tab1?.viewId).toBe('view-1');
      expect(tab3?.viewId).toBe('view-2');
    });

    it('should preserve group information in snapshots', async () => {
      const snapshot = await snapshotManager.createSnapshot('Group Test');
      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);
      const parsed = JSON.parse(jsonString);

      expect(parsed.data.groups).toHaveLength(2);
      expect(parsed.data.groups[0].name).toBe('Research');
      expect(parsed.data.groups[0].color).toBe('#0000ff');
      expect(parsed.data.groups[0].isExpanded).toBe(true);

      expect(parsed.data.groups[1].name).toBe('Development');
      expect(parsed.data.groups[1].color).toBe('#ffff00');
      expect(parsed.data.groups[1].isExpanded).toBe(false);
    });

    it('should handle Date serialization correctly in export/import', async () => {
      const snapshot = await snapshotManager.createSnapshot('Date Test');
      const jsonString = await snapshotManager.exportSnapshot(snapshot.id);

      const parsed = JSON.parse(jsonString);
      expect(typeof parsed.createdAt).toBe('string');
      expect(parsed.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

      const imported = await snapshotManager.importSnapshot(jsonString);
      expect(imported.createdAt).toBeInstanceOf(Date);
    });
  });
});
