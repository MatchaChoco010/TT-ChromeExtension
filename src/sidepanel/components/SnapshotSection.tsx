import React, { useState, useRef, useEffect } from 'react';
import type { Snapshot, IIndexedDBService, IStorageService } from '@/types';
import { SnapshotManager } from '@/services/SnapshotManager';

interface SnapshotSectionProps {
  indexedDBService: IIndexedDBService;
  storageService: IStorageService;
}

const SnapshotSection: React.FC<SnapshotSectionProps> = ({
  indexedDBService,
  storageService,
}) => {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newSnapshotName, setNewSnapshotName] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showRestoreOptions, setShowRestoreOptions] = useState<string | null>(
    null
  );
  const [isExpanded, setIsExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const snapshotManager = new SnapshotManager(indexedDBService, storageService);

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
  }, []);

  const handleCreate = async () => {
    if (!newSnapshotName.trim()) return;

    try {
      setProcessingId('creating');
      await snapshotManager.createSnapshot(newSnapshotName.trim(), false);
      setNewSnapshotName('');
      setIsCreating(false);
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to create snapshot:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    } else if (e.key === 'Escape') {
      setIsCreating(false);
      setNewSnapshotName('');
    }
  };

  const handleRestore = async (snapshotId: string, closeCurrentTabs: boolean) => {
    try {
      setProcessingId(snapshotId);
      setShowRestoreOptions(null);

      if (closeCurrentTabs) {
        const tabs = await chrome.tabs.query({});
        const tabIds = tabs
          .filter((t) => t.id !== undefined)
          .map((t) => t.id as number);
        if (tabIds.length > 0) {
          const tabsToClose = tabIds.slice(1);
          if (tabsToClose.length > 0) {
            await chrome.tabs.remove(tabsToClose);
          }
        }
      }

      await snapshotManager.restoreSnapshot(snapshotId);
    } catch (error) {
      console.error('Failed to restore snapshot:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (snapshotId: string) => {
    try {
      setProcessingId(snapshotId);
      await snapshotManager.deleteSnapshot(snapshotId);
      await loadSnapshots();
    } catch (error) {
      console.error('Failed to delete snapshot:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleExport = async (snapshotId: string) => {
    try {
      setProcessingId(snapshotId);
      const jsonData = await snapshotManager.exportSnapshot(snapshotId);

      const snapshot = snapshots.find((s) => s.id === snapshotId);
      const fileName = `snapshot-${snapshot?.name || snapshotId}.json`;

      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export snapshot:', error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      await snapshotManager.importSnapshot(text);
      await loadSnapshots();

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to import snapshot:', error);
    }
  };

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  return (
    <div data-testid="snapshot-section" className="border-b border-gray-200">
      <button
        className="w-full px-3 py-2 flex items-center justify-between bg-gray-50 hover:bg-gray-100"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-sm font-medium text-gray-700">Snapshots</span>
        <span className="text-xs text-gray-500">
          {isExpanded ? '[-]' : '[+]'}
        </span>
      </button>

      {isExpanded && (
        <div className="p-2">
          <div className="flex gap-2 mb-2">
            <button
              data-testid="create-snapshot-button"
              onClick={() => setIsCreating(true)}
              className="flex-1 px-2 py-1 text-xs bg-blue-500 hover:bg-blue-600 text-white rounded"
              disabled={isCreating}
            >
              Create
            </button>
            <button
              data-testid="snapshot-import-button"
              onClick={handleImportClick}
              className="px-2 py-1 text-xs bg-gray-500 hover:bg-gray-600 text-white rounded"
            >
              Import
            </button>
          </div>

          {isCreating && (
            <div className="mb-2">
              <input
                data-testid="snapshot-name-input"
                type="text"
                value={newSnapshotName}
                onChange={(e) => setNewSnapshotName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Snapshot name..."
                className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>
          )}

          {isLoading && (
            <p className="text-xs text-gray-500 text-center py-2">
              Loading...
            </p>
          )}

          {!isLoading && (
            <div data-testid="snapshot-list" className="space-y-1">
              {snapshots.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-2">
                  No snapshots
                </p>
              ) : (
                snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    data-testid="snapshot-item"
                    className="border border-gray-200 rounded p-2 bg-white"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-medium text-gray-800 truncate max-w-[120px]">
                          {snapshot.name}
                        </span>
                        {snapshot.isAutoSave && (
                          <span
                            data-testid="snapshot-auto-badge"
                            className="px-1 py-0.5 text-[10px] bg-green-100 text-green-700 rounded"
                          >
                            Auto
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-500 mb-1">
                      {formatDate(snapshot.createdAt)}
                    </div>

                    {showRestoreOptions === snapshot.id && (
                      <div className="mb-2 p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-xs text-gray-600 mb-2">
                          Restore options:
                        </p>
                        <div className="flex gap-1">
                          <button
                            data-testid="restore-option-close"
                            onClick={() => handleRestore(snapshot.id, true)}
                            className="flex-1 px-2 py-1 text-[10px] bg-red-100 hover:bg-red-200 text-red-700 rounded"
                            disabled={processingId === snapshot.id}
                          >
                            Close tabs
                          </button>
                          <button
                            data-testid="restore-option-keep"
                            onClick={() => handleRestore(snapshot.id, false)}
                            className="flex-1 px-2 py-1 text-[10px] bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                            disabled={processingId === snapshot.id}
                          >
                            Keep tabs
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-1">
                      <button
                        data-testid="snapshot-restore-button"
                        onClick={() => setShowRestoreOptions(snapshot.id)}
                        className="px-2 py-0.5 text-[10px] bg-green-500 hover:bg-green-600 text-white rounded"
                        disabled={processingId === snapshot.id}
                      >
                        Restore
                      </button>
                      <button
                        data-testid="snapshot-export-button"
                        onClick={() => handleExport(snapshot.id)}
                        className="px-2 py-0.5 text-[10px] bg-blue-500 hover:bg-blue-600 text-white rounded"
                        disabled={processingId === snapshot.id}
                      >
                        Export
                      </button>
                      <button
                        data-testid="snapshot-delete-button"
                        onClick={() => handleDelete(snapshot.id)}
                        className="px-2 py-0.5 text-[10px] bg-red-500 hover:bg-red-600 text-white rounded"
                        disabled={processingId === snapshot.id}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
            data-testid="snapshot-import-input"
          />
        </div>
      )}
    </div>
  );
};

export default SnapshotSection;
