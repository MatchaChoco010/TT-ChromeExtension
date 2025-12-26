import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { IndexedDBService } from './IndexedDBService';
import type { Snapshot } from '@/types';

describe('IndexedDBService', () => {
  let service: IndexedDBService;

  beforeEach(() => {
    service = new IndexedDBService();
  });

  afterEach(async () => {
    // Clean up: delete all snapshots
    const allSnapshots = await service.getAllSnapshots();
    for (const snapshot of allSnapshots) {
      await service.deleteSnapshot(snapshot.id);
    }
  });

  describe('saveSnapshot', () => {
    it('should save a snapshot to IndexedDB', async () => {
      const snapshot: Snapshot = {
        id: 'test-snapshot-1',
        createdAt: new Date('2025-12-25T00:00:00Z'),
        name: 'Test Snapshot',
        isAutoSave: false,
        data: {
          views: [],
          tabs: [],
          groups: [],
        },
      };

      await service.saveSnapshot(snapshot);

      const retrieved = await service.getSnapshot(snapshot.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(snapshot.id);
      expect(retrieved?.name).toBe(snapshot.name);
      expect(retrieved?.isAutoSave).toBe(snapshot.isAutoSave);
    });

    it('should update an existing snapshot with the same id', async () => {
      const snapshot: Snapshot = {
        id: 'test-snapshot-2',
        createdAt: new Date('2025-12-25T00:00:00Z'),
        name: 'Initial Name',
        isAutoSave: false,
        data: {
          views: [],
          tabs: [],
          groups: [],
        },
      };

      await service.saveSnapshot(snapshot);

      const updated: Snapshot = {
        ...snapshot,
        name: 'Updated Name',
      };

      await service.saveSnapshot(updated);

      const retrieved = await service.getSnapshot(snapshot.id);
      expect(retrieved?.name).toBe('Updated Name');
    });
  });

  describe('getSnapshot', () => {
    it('should retrieve a snapshot by id', async () => {
      const snapshot: Snapshot = {
        id: 'test-snapshot-3',
        createdAt: new Date('2025-12-25T00:00:00Z'),
        name: 'Test Snapshot',
        isAutoSave: false,
        data: {
          views: [{ id: 'view-1', name: 'View 1', color: '#ff0000' }],
          tabs: [],
          groups: [],
        },
      };

      await service.saveSnapshot(snapshot);

      const retrieved = await service.getSnapshot(snapshot.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(snapshot.id);
      expect(retrieved?.data.views).toHaveLength(1);
      expect(retrieved?.data.views[0].name).toBe('View 1');
    });

    it('should return null for non-existent snapshot', async () => {
      const retrieved = await service.getSnapshot('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getAllSnapshots', () => {
    it('should retrieve all snapshots', async () => {
      const snapshot1: Snapshot = {
        id: 'test-snapshot-4',
        createdAt: new Date('2025-12-25T00:00:00Z'),
        name: 'Snapshot 1',
        isAutoSave: false,
        data: { views: [], tabs: [], groups: [] },
      };

      const snapshot2: Snapshot = {
        id: 'test-snapshot-5',
        createdAt: new Date('2025-12-25T01:00:00Z'),
        name: 'Snapshot 2',
        isAutoSave: true,
        data: { views: [], tabs: [], groups: [] },
      };

      await service.saveSnapshot(snapshot1);
      await service.saveSnapshot(snapshot2);

      const allSnapshots = await service.getAllSnapshots();
      expect(allSnapshots).toHaveLength(2);
    });

    it('should return empty array when no snapshots exist', async () => {
      const allSnapshots = await service.getAllSnapshots();
      expect(allSnapshots).toEqual([]);
    });

    it('should return snapshots sorted by createdAt descending', async () => {
      const snapshot1: Snapshot = {
        id: 'test-snapshot-6',
        createdAt: new Date('2025-12-25T00:00:00Z'),
        name: 'Older Snapshot',
        isAutoSave: false,
        data: { views: [], tabs: [], groups: [] },
      };

      const snapshot2: Snapshot = {
        id: 'test-snapshot-7',
        createdAt: new Date('2025-12-25T02:00:00Z'),
        name: 'Newer Snapshot',
        isAutoSave: false,
        data: { views: [], tabs: [], groups: [] },
      };

      await service.saveSnapshot(snapshot1);
      await service.saveSnapshot(snapshot2);

      const allSnapshots = await service.getAllSnapshots();
      expect(allSnapshots[0].id).toBe('test-snapshot-7'); // Newer first
      expect(allSnapshots[1].id).toBe('test-snapshot-6');
    });
  });

  describe('deleteSnapshot', () => {
    it('should delete a snapshot by id', async () => {
      const snapshot: Snapshot = {
        id: 'test-snapshot-8',
        createdAt: new Date('2025-12-25T00:00:00Z'),
        name: 'To Be Deleted',
        isAutoSave: false,
        data: { views: [], tabs: [], groups: [] },
      };

      await service.saveSnapshot(snapshot);
      expect(await service.getSnapshot(snapshot.id)).not.toBeNull();

      await service.deleteSnapshot(snapshot.id);
      expect(await service.getSnapshot(snapshot.id)).toBeNull();
    });

    it('should not throw error when deleting non-existent snapshot', async () => {
      await expect(
        service.deleteSnapshot('non-existent-id'),
      ).resolves.toBeUndefined();
    });
  });

  describe('deleteOldSnapshots', () => {
    it('should keep only the specified number of most recent snapshots', async () => {
      const snapshots: Snapshot[] = [
        {
          id: 'snapshot-1',
          createdAt: new Date('2025-12-25T00:00:00Z'),
          name: 'Oldest',
          isAutoSave: false,
          data: { views: [], tabs: [], groups: [] },
        },
        {
          id: 'snapshot-2',
          createdAt: new Date('2025-12-25T01:00:00Z'),
          name: 'Middle',
          isAutoSave: false,
          data: { views: [], tabs: [], groups: [] },
        },
        {
          id: 'snapshot-3',
          createdAt: new Date('2025-12-25T02:00:00Z'),
          name: 'Newest',
          isAutoSave: false,
          data: { views: [], tabs: [], groups: [] },
        },
      ];

      for (const snapshot of snapshots) {
        await service.saveSnapshot(snapshot);
      }

      await service.deleteOldSnapshots(2);

      const remaining = await service.getAllSnapshots();
      expect(remaining).toHaveLength(2);
      expect(remaining[0].id).toBe('snapshot-3'); // Newest
      expect(remaining[1].id).toBe('snapshot-2'); // Middle
      expect(await service.getSnapshot('snapshot-1')).toBeNull(); // Oldest deleted
    });

    it('should not delete any snapshots if count is greater than existing snapshots', async () => {
      const snapshot: Snapshot = {
        id: 'snapshot-4',
        createdAt: new Date('2025-12-25T00:00:00Z'),
        name: 'Only Snapshot',
        isAutoSave: false,
        data: { views: [], tabs: [], groups: [] },
      };

      await service.saveSnapshot(snapshot);
      await service.deleteOldSnapshots(10);

      const remaining = await service.getAllSnapshots();
      expect(remaining).toHaveLength(1);
    });

    it('should handle keepCount of 0 by deleting all snapshots', async () => {
      const snapshot: Snapshot = {
        id: 'snapshot-5',
        createdAt: new Date('2025-12-25T00:00:00Z'),
        name: 'To Be Deleted',
        isAutoSave: false,
        data: { views: [], tabs: [], groups: [] },
      };

      await service.saveSnapshot(snapshot);
      await service.deleteOldSnapshots(0);

      const remaining = await service.getAllSnapshots();
      expect(remaining).toHaveLength(0);
    });
  });
});
