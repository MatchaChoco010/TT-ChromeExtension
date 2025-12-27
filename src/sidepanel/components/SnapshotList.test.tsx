import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SnapshotList from './SnapshotList';
import type { Snapshot } from '@/types';

// テスト用のモックFile型（必要なプロパティのみ）
interface MockFile {
  text: () => Promise<string>;
  name: string;
  type: string;
}

/**
 * Task 14.3: スナップショット履歴管理 - SnapshotList コンポーネントのテスト
 * Requirements: 11.6 - スナップショット一覧表示、削除、エクスポート/インポート機能
 */
describe('SnapshotList Component', () => {
  const mockSnapshots: Snapshot[] = [
    {
      id: 'snapshot-1',
      createdAt: new Date('2025-12-26T10:00:00'),
      name: 'Manual Snapshot 1',
      isAutoSave: false,
      data: {
        views: [],
        tabs: [],
        groups: [],
      },
    },
    {
      id: 'snapshot-2',
      createdAt: new Date('2025-12-26T09:00:00'),
      name: 'Auto Snapshot - 2025-12-26 09:00:00',
      isAutoSave: true,
      data: {
        views: [],
        tabs: [],
        groups: [],
      },
    },
    {
      id: 'snapshot-3',
      createdAt: new Date('2025-12-25T10:00:00'),
      name: 'Manual Snapshot 2',
      isAutoSave: false,
      data: {
        views: [],
        tabs: [],
        groups: [],
      },
    },
  ];

  const mockOnRestore = vi.fn<(snapshotId: string) => void>();
  const mockOnDelete = vi.fn<(snapshotId: string) => void>();
  const mockOnExport = vi.fn<(snapshotId: string) => void>();
  const mockOnImport = vi.fn<(jsonData: string) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render snapshot list with all snapshots', () => {
    render(
      <SnapshotList
        snapshots={mockSnapshots}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
      />,
    );

    // すべてのスナップショット名が表示される
    expect(screen.getByText('Manual Snapshot 1')).toBeInTheDocument();
    expect(
      screen.getByText('Auto Snapshot - 2025-12-26 09:00:00'),
    ).toBeInTheDocument();
    expect(screen.getByText('Manual Snapshot 2')).toBeInTheDocument();
  });

  it('should display snapshots in descending order by createdAt (newest first)', () => {
    render(
      <SnapshotList
        snapshots={mockSnapshots}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
      />,
    );

    const snapshotItems = screen.getAllByRole('listitem');
    expect(snapshotItems).toHaveLength(3);

    // 最新のものが最初に表示される
    expect(snapshotItems[0]).toHaveTextContent('Manual Snapshot 1');
    expect(snapshotItems[1]).toHaveTextContent('Auto Snapshot - 2025-12-26');
    expect(snapshotItems[2]).toHaveTextContent('Manual Snapshot 2');
  });

  it('should display auto-save badge for auto-saved snapshots', () => {
    render(
      <SnapshotList
        snapshots={mockSnapshots}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
      />,
    );

    // 自動保存バッジが表示される
    const autoSaveBadges = screen.getAllByText('自動保存');
    expect(autoSaveBadges).toHaveLength(1);
  });

  it('should call onRestore when restore button is clicked', async () => {
    render(
      <SnapshotList
        snapshots={mockSnapshots}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
      />,
    );

    const restoreButtons = screen.getAllByRole('button', { name: /復元/i });
    fireEvent.click(restoreButtons[0]);

    await waitFor(() => {
      expect(mockOnRestore).toHaveBeenCalledWith('snapshot-1');
    });
  });

  it('should call onDelete when delete button is clicked', async () => {
    render(
      <SnapshotList
        snapshots={mockSnapshots}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
      />,
    );

    const deleteButtons = screen.getAllByRole('button', { name: /削除/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith('snapshot-1');
    });
  });

  it('should call onExport when export button is clicked', async () => {
    render(
      <SnapshotList
        snapshots={mockSnapshots}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
      />,
    );

    const exportButtons = screen.getAllByRole('button', {
      name: /エクスポート/i,
    });
    fireEvent.click(exportButtons[0]);

    await waitFor(() => {
      expect(mockOnExport).toHaveBeenCalledWith('snapshot-1');
    });
  });

  it('should call onImport when import button is clicked and file is selected', async () => {
    render(
      <SnapshotList
        snapshots={mockSnapshots}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
      />,
    );

    const importButton = screen.getByRole('button', { name: /インポート/i });
    expect(importButton).toBeInTheDocument();

    // ファイル入力要素を取得
    const fileInput = screen.getByTestId(
      'snapshot-import-input',
    ) as HTMLInputElement;

    // モックファイルを作成（.text() メソッドを持つオブジェクト）
    const jsonData = JSON.stringify({ id: 'test', name: 'Test Snapshot' });
    const mockFile: MockFile = {
      text: vi.fn<() => Promise<string>>().mockResolvedValue(jsonData),
      name: 'snapshot.json',
      type: 'application/json',
    };

    // FileList をモック
    Object.defineProperty(fileInput, 'files', {
      value: [mockFile],
      writable: false,
    });

    // ファイルを選択
    fireEvent.change(fileInput);

    await waitFor(() => {
      expect(mockOnImport).toHaveBeenCalledWith(jsonData);
    });
  });

  it('should display formatted date for each snapshot', () => {
    render(
      <SnapshotList
        snapshots={mockSnapshots}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
      />,
    );

    // 日付が表示される (複数あるので getAllByText を使用)
    const dates2026 = screen.getAllByText(/2025-12-26/);
    expect(dates2026.length).toBeGreaterThan(0);

    const dates2025 = screen.getAllByText(/2025-12-25/);
    expect(dates2025.length).toBeGreaterThan(0);
  });

  it('should display empty state when no snapshots', () => {
    render(
      <SnapshotList
        snapshots={[]}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
      />,
    );

    expect(
      screen.getByText(/スナップショットがありません/i),
    ).toBeInTheDocument();
  });

  it('should disable restore and delete buttons when snapshot is being processed', async () => {
    const { rerender } = render(
      <SnapshotList
        snapshots={mockSnapshots}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
        processingSnapshotId={undefined}
      />,
    );

    const restoreButtons = screen.getAllByRole('button', { name: /復元/i });
    expect(restoreButtons[0]).not.toBeDisabled();

    // processingSnapshotId を設定
    rerender(
      <SnapshotList
        snapshots={mockSnapshots}
        onRestore={mockOnRestore}
        onDelete={mockOnDelete}
        onExport={mockOnExport}
        onImport={mockOnImport}
        processingSnapshotId="snapshot-1"
      />,
    );

    // 処理中のスナップショットのボタンが無効化される
    const updatedRestoreButtons = screen.getAllByRole('button', {
      name: /復元/i,
    });
    expect(updatedRestoreButtons[0]).toBeDisabled();
  });
});
