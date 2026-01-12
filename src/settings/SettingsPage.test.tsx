/**
 * 設定ページのテスト
 */
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

const { mockStorageService } = vi.hoisted(() => ({
  mockStorageService: {
    get: vi.fn(),
    set: vi.fn(),
    onChange: vi.fn(() => () => {}),
  },
}));

vi.mock('@/storage/StorageService', () => ({
  storageService: mockStorageService,
}));

import { SettingsPage } from './SettingsPage';

describe('SettingsPage', () => {
  const defaultSettings = {
    fontSize: 14,
    fontFamily: 'system-ui, sans-serif',
    customCSS: '',
    newTabPosition: 'child' as const,
    closeWarningThreshold: 3,
    showUnreadIndicator: true,
    autoSnapshotInterval: 0,
    childTabBehavior: 'promote' as const,
    snapshotSubfolder: 'TT-Snapshots',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageService.get.mockResolvedValue(defaultSettings);
    mockStorageService.set.mockResolvedValue(undefined);
  });

  it('設定ページがレンダリングされる', async () => {
    render(<SettingsPage />);

    // 設定見出しが表示されることを確認
    await waitFor(() => {
      expect(screen.getByText('設定')).toBeInTheDocument();
    });
  });

  it('設定パネルコンポーネントが含まれる', async () => {
    render(<SettingsPage />);

    // SettingsPanelの要素が含まれていることを確認
    await waitFor(() => {
      expect(screen.getByText('外観のカスタマイズ')).toBeInTheDocument();
      expect(screen.getByText('タブの動作')).toBeInTheDocument();
    });
  });

  it('全幅レイアウトが適用されている', async () => {
    const { container } = render(<SettingsPage />);

    await waitFor(() => {
      // レイアウト用のコンテナが存在することを確認
      const layoutContainer = container.querySelector('.settings-page-container');
      expect(layoutContainer).toBeInTheDocument();
    });
  });

  it('ストレージから設定を読み込む', async () => {
    render(<SettingsPage />);

    await waitFor(() => {
      expect(mockStorageService.get).toHaveBeenCalledWith('user_settings');
    });
  });

  it('読み込み中に読み込み中表示を行う', async () => {
    // 遅延をシミュレート
    mockStorageService.get.mockImplementation(() => new Promise(() => {}));

    render(<SettingsPage />);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('ストレージが空の場合はデフォルト設定を使用する', async () => {
    mockStorageService.get.mockResolvedValue(null);

    render(<SettingsPage />);

    await waitFor(() => {
      // デフォルト設定で設定パネルが表示されることを確認
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('設定');
    });
  });

  describe('スナップショット設定', () => {
    it('スナップショット設定セクションが表示される', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByText('スナップショット設定')).toBeInTheDocument();
      });
    });

    it('自動保存トグルが表示される', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText('自動保存を有効にする')).toBeInTheDocument();
      });
    });

    it('自動保存間隔入力が表示される', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/自動保存の間隔/)).toBeInTheDocument();
      });
    });

    it('保存先フォルダ入力が表示される', async () => {
      render(<SettingsPage />);

      await waitFor(() => {
        expect(screen.getByLabelText(/保存先フォルダ/)).toBeInTheDocument();
      });
    });
  });
});
