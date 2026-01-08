import React, { useEffect, useState } from 'react';
import SnapshotList from './SnapshotList';
import type { Snapshot, IIndexedDBService } from '@/types';
import type { SnapshotManager } from '@/services/SnapshotManager';

interface SnapshotManagementProps {
  snapshotManager: SnapshotManager;
  indexedDBService: IIndexedDBService;
  maxSnapshots?: number;
}

const SnapshotManagement: React.FC<SnapshotManagementProps> = ({
  snapshotManager,
  indexedDBService,
  maxSnapshots = 10,
}) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingSnapshotId, setProcessingSnapshotId] = useState<
    string | undefined
  >(undefined);

  const loadSnapshots = async () => {
    try {
      setIsLoading(true);
      const allSnapshots = await snapshotManager.getSnapshots();
      setSnapshots(allSnapshots);
    } catch (error) {
      console.error('Failed to load snapshots:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSnapshots();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 初回マウント時のみ実行
  }, []);

  const handleRestore = async (snapshotId: string) => {
    try {
      setProcessingSnapshotId(snapshotId);
      await snapshotManager.restoreSnapshot(snapshotId);
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
    } finally {
      setProcessingSnapshotId(undefined);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    try {
      setProcessingSnapshotId(snapshotId);
      await snapshotManager.deleteSnapshot(snapshotId);
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    } finally {
      setProcessingSnapshotId(undefined);
    }
  };

  const handleExport = async (snapshotId: string) => {
    try {
      setProcessingSnapshotId(snapshotId);
      const jsonData = await snapshotManager.exportSnapshot(snapshotId);

      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `snapshot-${snapshotId}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export snapshot:', error);
    } finally {
      setProcessingSnapshotId(undefined);
    }
  };

  const handleImport = async (jsonData: string) => {
    try {
      await snapshotManager.importSnapshot(jsonData);
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to import snapshot:', error);
    }
  };

  const handleCleanupOldSnapshots = async () => {
    try {
      await indexedDBService.deleteOldSnapshots(maxSnapshots);
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to cleanup old snapshots:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="snapshot-management p-4">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  const isOverLimit = snapshots.length > maxSnapshots;

  return (
    <div className="snapshot-management">
      {isOverLimit && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 px-4 py-3 rounded mb-4">
          <p className="font-medium">
            スナップショット数が上限を超えています
          </p>
          <p className="text-sm mt-1">
            現在 {snapshots.length} 件のスナップショットがあります。最新{' '}
            {maxSnapshots} 件を保持することを推奨します。
          </p>
          <button
            onClick={handleCleanupOldSnapshots}
            className="mt-2 px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm"
          >
            古いスナップショットを削除（最新{maxSnapshots}件を保持）
          </button>
        </div>
      )}

      <SnapshotList
        snapshots={snapshots}
        onRestore={handleRestore}
        onDelete={handleDelete}
        onExport={handleExport}
        onImport={handleImport}
        processingSnapshotId={processingSnapshotId}
      />
    </div>
  );
};

export default SnapshotManagement;
