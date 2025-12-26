import React, { useEffect, useState } from 'react';
import SnapshotList from './SnapshotList';
import type { Snapshot, IIndexedDBService } from '@/types';
import type { SnapshotManager } from '@/services/SnapshotManager';

/**
 * SnapshotManagement コンポーネントのプロパティ
 */
interface SnapshotManagementProps {
  snapshotManager: SnapshotManager;
  indexedDBService: IIndexedDBService;
  maxSnapshots?: number; // 最大保持スナップショット数（デフォルト: 10）
}

/**
 * スナップショット管理統合コンポーネント
 *
 * Task 14.3: スナップショット履歴管理
 * Requirements: 11.6 - スナップショット一覧表示、削除、エクスポート/インポート、古いスナップショット削除機能
 *
 * 機能:
 * - SnapshotManager を使用してスナップショットを管理
 * - SnapshotList コンポーネントで一覧表示
 * - 古いスナップショット削除機能（最新N件を保持）
 * - スナップショット数が上限を超えた場合の警告表示
 */
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

  /**
   * スナップショット一覧を読み込み
   */
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

  /**
   * 初期読み込み
   */
  useEffect(() => {
    loadSnapshots();
  }, []);

  /**
   * スナップショットを復元
   */
  const handleRestore = async (snapshotId: string) => {
    try {
      setProcessingSnapshotId(snapshotId);
      await snapshotManager.restoreSnapshot(snapshotId);
      // 復元成功後、必要に応じてUIを更新
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
    } finally {
      setProcessingSnapshotId(undefined);
    }
  };

  /**
   * スナップショットを削除
   */
  const handleDelete = async (snapshotId: string) => {
    try {
      setProcessingSnapshotId(snapshotId);
      await snapshotManager.deleteSnapshot(snapshotId);
      // 削除後、一覧を再読み込み
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    } finally {
      setProcessingSnapshotId(undefined);
    }
  };

  /**
   * スナップショットをエクスポート
   */
  const handleExport = async (snapshotId: string) => {
    try {
      setProcessingSnapshotId(snapshotId);
      const jsonData = await snapshotManager.exportSnapshot(snapshotId);

      // JSONファイルとしてダウンロード
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

  /**
   * スナップショットをインポート
   */
  const handleImport = async (jsonData: string) => {
    try {
      await snapshotManager.importSnapshot(jsonData);
      // インポート後、一覧を再読み込み
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to import snapshot:', error);
    }
  };

  /**
   * 古いスナップショットを削除
   * Requirements: 11.6 - 最新N件を保持、それ以外を削除
   */
  const handleCleanupOldSnapshots = async () => {
    try {
      await indexedDBService.deleteOldSnapshots(maxSnapshots);
      // 削除後、一覧を再読み込み
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
