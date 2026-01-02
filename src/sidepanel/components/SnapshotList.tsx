import React, { useRef } from 'react';
import type { Snapshot } from '@/types';

/**
 * SnapshotList コンポーネントのプロパティ
 */
interface SnapshotListProps {
  snapshots: Snapshot[];
  onRestore: (snapshotId: string) => void;
  onDelete: (snapshotId: string) => void;
  onExport: (snapshotId: string) => void;
  onImport: (jsonData: string) => void;
  processingSnapshotId?: string;
}

/**
 * スナップショット履歴管理コンポーネント
 *
 * スナップショット履歴管理
 * スナップショット一覧表示、削除、エクスポート/インポート機能
 *
 * 機能:
 * - スナップショット一覧の表示（新しいものから順に）
 * - 自動保存バッジの表示
 * - スナップショットの復元、削除、エクスポート
 * - JSONファイルからのインポート
 */
const SnapshotList: React.FC<SnapshotListProps> = ({
  snapshots,
  onRestore,
  onDelete,
  onExport,
  onImport,
  processingSnapshotId,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * インポートボタンクリック時の処理
   */
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  /**
   * ファイル選択時の処理
   */
  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      onImport(text);
      // ファイル入力をリセット
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to read file:', error);
    }
  };

  /**
   * 日付をフォーマット
   */
  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  // スナップショットが空の場合
  if (snapshots.length === 0) {
    return (
      <div className="snapshot-list p-4 bg-gray-900">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-100">スナップショット履歴</h2>
          <button
            onClick={handleImportClick}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
          >
            インポート
          </button>
        </div>
        <p className="text-gray-400 text-center py-8">
          スナップショットがありません
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
          data-testid="snapshot-import-input"
        />
      </div>
    );
  }

  return (
    <div className="snapshot-list p-4 bg-gray-900">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-100">スナップショット履歴</h2>
        <button
          onClick={handleImportClick}
          className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
        >
          インポート
        </button>
      </div>

      <ul className="space-y-3">
        {snapshots.map((snapshot) => {
          const isProcessing = processingSnapshotId === snapshot.id;

          return (
            <li
              key={snapshot.id}
              className="border border-gray-700 rounded-md p-3 bg-gray-800"
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-gray-100">
                      {snapshot.name}
                    </h3>
                    {snapshot.isAutoSave && (
                      <span className="px-2 py-0.5 bg-green-900 text-green-300 text-xs rounded">
                        自動保存
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400 mt-1">
                    {formatDate(snapshot.createdAt)}
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => onRestore(snapshot.id)}
                  disabled={isProcessing}
                  className={`px-3 py-1 rounded text-sm ${
                    isProcessing
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-500 text-white'
                  }`}
                >
                  復元
                </button>
                <button
                  onClick={() => onExport(snapshot.id)}
                  disabled={isProcessing}
                  className={`px-3 py-1 rounded text-sm ${
                    isProcessing
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white'
                  }`}
                >
                  エクスポート
                </button>
                <button
                  onClick={() => onDelete(snapshot.id)}
                  disabled={isProcessing}
                  className={`px-3 py-1 rounded text-sm ${
                    isProcessing
                      ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                      : 'bg-red-600 hover:bg-red-500 text-white'
                  }`}
                >
                  削除
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
        data-testid="snapshot-import-input"
      />
    </div>
  );
};

export default SnapshotList;
