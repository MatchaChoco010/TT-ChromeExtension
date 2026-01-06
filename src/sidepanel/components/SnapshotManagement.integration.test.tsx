import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SnapshotManagement from './SnapshotManagement';
import type { Snapshot, IIndexedDBService } from '@/types';
import type { SnapshotManager } from '@/services/SnapshotManager';
import type { MockSnapshotManager, MockIndexedDBService } from '@/test/test-types';

/**
 * スナップショット履歴管理の統合テスト
 * 古いスナップショット削除機能（例: 最新10件を保持）
 */
describe('SnapshotManagement Integration', () => {
  let mockSnapshotManager: MockSnapshotManager;
  let mockIndexedDBService: MockIndexedDBService;

  const mockSnapshots: Snapshot[] = Array.from({ length: 15 }, (_, i) => ({
    id: `snapshot-${i}`,
    createdAt: new Date(2025, 11, 26 - i),
    name: `Snapshot ${i}`,
    isAutoSave: i % 2 === 0,
    data: {
      views: [],
      tabs: [],
      groups: [],
    },
  }));

  beforeEach(() => {
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();

    mockSnapshotManager = {
      getSnapshots: vi.fn().mockResolvedValue(mockSnapshots),
      createSnapshot: vi.fn(),
      restoreSnapshot: vi.fn(),
      deleteSnapshot: vi.fn(),
      exportSnapshot: vi.fn().mockResolvedValue(JSON.stringify({})),
      importSnapshot: vi.fn(),
    };

    mockIndexedDBService = {
      deleteOldSnapshots: vi.fn(),
    };
  });

  it('should load and display all snapshots on mount', async () => {
    render(
      <SnapshotManagement
        snapshotManager={mockSnapshotManager as unknown as SnapshotManager}
        indexedDBService={mockIndexedDBService as IIndexedDBService}
      />,
    );

    await waitFor(() => {
      expect(mockSnapshotManager.getSnapshots).toHaveBeenCalled();
    });

    expect(screen.getByText('Snapshot 0')).toBeInTheDocument();
    expect(screen.getByText('Snapshot 14')).toBeInTheDocument();
  });

  it('should restore snapshot when restore button is clicked', async () => {
    mockSnapshotManager.restoreSnapshot.mockResolvedValue(undefined);

    render(
      <SnapshotManagement
        snapshotManager={mockSnapshotManager as unknown as SnapshotManager}
        indexedDBService={mockIndexedDBService as IIndexedDBService}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Snapshot 0')).toBeInTheDocument();
    });

    const restoreButtons = screen.getAllByRole('button', { name: /復元/i });
    fireEvent.click(restoreButtons[0]);

    await waitFor(() => {
      expect(mockSnapshotManager.restoreSnapshot).toHaveBeenCalledWith(
        'snapshot-0',
      );
    });
  });

  it('should delete snapshot when delete button is clicked', async () => {
    mockSnapshotManager.deleteSnapshot.mockResolvedValue(undefined);
    mockSnapshotManager.getSnapshots.mockResolvedValueOnce(mockSnapshots);
    mockSnapshotManager.getSnapshots.mockResolvedValueOnce([]);

    render(
      <SnapshotManagement
        snapshotManager={mockSnapshotManager as unknown as SnapshotManager}
        indexedDBService={mockIndexedDBService as IIndexedDBService}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Snapshot 0')).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole('button', { name: /削除/i });
    const firstDeleteButton = deleteButtons.find((button) => {
      const listItem = button.closest('li');
      return listItem?.textContent?.includes('Snapshot 0');
    });

    if (firstDeleteButton) {
      fireEvent.click(firstDeleteButton);

      await waitFor(
        () => {
          expect(mockSnapshotManager.deleteSnapshot).toHaveBeenCalledWith(
            'snapshot-0',
          );
        },
        { timeout: 3000 },
      );

      await waitFor(
        () => {
          expect(mockSnapshotManager.getSnapshots).toHaveBeenCalledTimes(2);
        },
        { timeout: 3000 },
      );
    }
  });

  it('should export snapshot when export button is clicked', async () => {
    const mockExportData = JSON.stringify({ id: 'snapshot-0', name: 'Test' });
    mockSnapshotManager.exportSnapshot.mockResolvedValue(mockExportData);

    const mockLink: Partial<HTMLAnchorElement> = {
      href: '',
      download: '',
      click: vi.fn(),
      style: {} as CSSStyleDeclaration,
    };
    const originalCreateElement = document.createElement.bind(document);
    const createElementSpy = vi
      .spyOn(document, 'createElement')
      .mockImplementation((tagName: string) => {
        if (tagName === 'a') {
          return mockLink as HTMLAnchorElement;
        }
        return originalCreateElement(tagName);
      });

    render(
      <SnapshotManagement
        snapshotManager={mockSnapshotManager as unknown as SnapshotManager}
        indexedDBService={mockIndexedDBService as IIndexedDBService}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Snapshot 0')).toBeInTheDocument();
    });

    const exportButtons = screen.getAllByRole('button', {
      name: /エクスポート/i,
    });
    const firstExportButton = exportButtons.find((button) => {
      const listItem = button.closest('li');
      return listItem?.textContent?.includes('Snapshot 0');
    });

    if (firstExportButton) {
      fireEvent.click(firstExportButton);

      await waitFor(
        () => {
          expect(mockSnapshotManager.exportSnapshot).toHaveBeenCalledWith(
            'snapshot-0',
          );
        },
        { timeout: 3000 },
      );
    }

    createElementSpy.mockRestore();
  });

  it('should import snapshot when file is selected', async () => {
    mockSnapshotManager.importSnapshot.mockResolvedValue({
      id: 'imported-snapshot',
      name: 'Imported',
      createdAt: new Date(),
      isAutoSave: false,
      data: { views: [], tabs: [], groups: [] },
    });

    render(
      <SnapshotManagement
        snapshotManager={mockSnapshotManager as unknown as SnapshotManager}
        indexedDBService={mockIndexedDBService as IIndexedDBService}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Snapshot 0')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId(
      'snapshot-import-input',
    ) as HTMLInputElement;

    const jsonData = JSON.stringify({ id: 'test', name: 'Test' });
    const mockFile = {
      text: vi.fn().mockResolvedValue(jsonData),
      name: 'snapshot.json',
      type: 'application/json',
    } as unknown as File;

    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false,
    });

    fireEvent.change(fileInput);

    await waitFor(
      () => {
        expect(mockSnapshotManager.importSnapshot).toHaveBeenCalledWith(
          jsonData,
        );
      },
      { timeout: 3000 },
    );

    await waitFor(
      () => {
        expect(mockSnapshotManager.getSnapshots).toHaveBeenCalledTimes(2);
      },
      { timeout: 3000 },
    );
  });

  it('should delete old snapshots when cleanup button is clicked', async () => {
    mockIndexedDBService.deleteOldSnapshots.mockResolvedValue(undefined);

    render(
      <SnapshotManagement
        snapshotManager={mockSnapshotManager as unknown as SnapshotManager}
        indexedDBService={mockIndexedDBService as IIndexedDBService}
        maxSnapshots={10}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Snapshot 0')).toBeInTheDocument();
    });

    const cleanupButton = screen.getByRole('button', {
      name: /古いスナップショットを削除/i,
    });
    fireEvent.click(cleanupButton);

    await waitFor(() => {
      expect(mockIndexedDBService.deleteOldSnapshots).toHaveBeenCalledWith(10);
    });

    await waitFor(() => {
      expect(mockSnapshotManager.getSnapshots).toHaveBeenCalledTimes(2);
    });
  });

  it('should display warning when snapshot count exceeds maximum', async () => {
    render(
      <SnapshotManagement
        snapshotManager={mockSnapshotManager as unknown as SnapshotManager}
        indexedDBService={mockIndexedDBService as IIndexedDBService}
        maxSnapshots={10}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Snapshot 0')).toBeInTheDocument();
    });

    expect(
      screen.getByText(/スナップショット数が上限を超えています/i),
    ).toBeInTheDocument();
  });

  it('should not display warning when snapshot count is within limit', async () => {
    const fewSnapshots = mockSnapshots.slice(0, 5);
    mockSnapshotManager.getSnapshots.mockResolvedValue(fewSnapshots);

    render(
      <SnapshotManagement
        snapshotManager={mockSnapshotManager as unknown as SnapshotManager}
        indexedDBService={mockIndexedDBService as IIndexedDBService}
        maxSnapshots={10}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Snapshot 0')).toBeInTheDocument();
    });

    expect(
      screen.queryByText(/スナップショット数が上限を超えています/i),
    ).not.toBeInTheDocument();
  });
});
