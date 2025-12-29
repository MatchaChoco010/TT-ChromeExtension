/**
 * PopupMenuコンポーネントのテスト
 * Task 9.2: ポップアップメニューを新規作成
 * Task 9.3: スナップショット取得ボタンを追加
 * Requirements: 20.2, 20.3, 20.4, 21.1, 21.2, 21.3
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PopupMenu } from './PopupMenu';

// Chrome APIのモック
const mockOpenOptionsPage = vi.fn();
const mockSendMessage = vi.fn();
const mockChrome = {
  runtime: {
    openOptionsPage: mockOpenOptionsPage,
    sendMessage: mockSendMessage,
  },
};

describe('PopupMenu', () => {
  beforeEach(() => {
    vi.stubGlobal('chrome', mockChrome);
    mockOpenOptionsPage.mockClear();
    mockSendMessage.mockClear();
    mockSendMessage.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('表示', () => {
    it('「設定を開く」ボタンが表示される', () => {
      render(<PopupMenu />);
      expect(screen.getByRole('button', { name: '設定を開く' })).toBeInTheDocument();
    });

    it('ポップアップメニューのコンテナが表示される', () => {
      render(<PopupMenu />);
      expect(screen.getByTestId('popup-menu')).toBeInTheDocument();
    });
  });

  describe('設定を開く機能', () => {
    it('「設定を開く」ボタンをクリックするとchrome.runtime.openOptionsPage()が呼ばれる', () => {
      render(<PopupMenu />);

      const settingsButton = screen.getByRole('button', { name: '設定を開く' });
      fireEvent.click(settingsButton);

      expect(mockOpenOptionsPage).toHaveBeenCalledTimes(1);
    });

    it('「設定を開く」ボタンにアイコンが表示される', () => {
      render(<PopupMenu />);

      const settingsButton = screen.getByRole('button', { name: '設定を開く' });
      // ボタン内にアイコンが含まれていることを確認
      expect(settingsButton.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('スタイリング', () => {
    it('ダークテーマのスタイルが適用される', () => {
      render(<PopupMenu />);

      const container = screen.getByTestId('popup-menu');
      expect(container).toHaveClass('bg-gray-900');
    });

    it('ボタンにホバースタイルが定義されている', () => {
      render(<PopupMenu />);

      const settingsButton = screen.getByRole('button', { name: '設定を開く' });
      expect(settingsButton).toHaveClass('hover:bg-gray-700');
    });
  });

  describe('スナップショット取得機能', () => {
    it('「スナップショットを取得」ボタンが表示される', () => {
      render(<PopupMenu />);
      expect(screen.getByRole('button', { name: 'スナップショットを取得' })).toBeInTheDocument();
    });

    it('「スナップショットを取得」ボタンにアイコンが表示される', () => {
      render(<PopupMenu />);

      const snapshotButton = screen.getByRole('button', { name: 'スナップショットを取得' });
      expect(snapshotButton.querySelector('svg')).toBeInTheDocument();
    });

    it('「スナップショットを取得」ボタンをクリックするとchrome.runtime.sendMessageが呼ばれる', async () => {
      render(<PopupMenu />);

      const snapshotButton = screen.getByRole('button', { name: 'スナップショットを取得' });
      fireEvent.click(snapshotButton);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({ type: 'CREATE_SNAPSHOT' });
      });
    });

    it('スナップショット取得中は「取得中...」と表示される', async () => {
      // sendMessageがresolveする前にボタンテキストを確認
      mockSendMessage.mockImplementation(() => new Promise(() => {})); // 永久にpending

      render(<PopupMenu />);

      const snapshotButton = screen.getByRole('button', { name: 'スナップショットを取得' });
      fireEvent.click(snapshotButton);

      await waitFor(() => {
        expect(screen.getByText('取得中...')).toBeInTheDocument();
      });
    });

    it('スナップショット取得成功時に「完了しました」と表示される', async () => {
      mockSendMessage.mockResolvedValue({ success: true });

      render(<PopupMenu />);

      const snapshotButton = screen.getByRole('button', { name: 'スナップショットを取得' });
      fireEvent.click(snapshotButton);

      await waitFor(() => {
        expect(screen.getByText('完了しました')).toBeInTheDocument();
      });
    });

    it('スナップショット取得失敗時に「失敗しました」と表示される', async () => {
      mockSendMessage.mockResolvedValue({ success: false, error: 'Error' });

      render(<PopupMenu />);

      const snapshotButton = screen.getByRole('button', { name: 'スナップショットを取得' });
      fireEvent.click(snapshotButton);

      await waitFor(() => {
        expect(screen.getByText('失敗しました')).toBeInTheDocument();
      });
    });

    it('スナップショット取得中はボタンが無効化される', async () => {
      mockSendMessage.mockImplementation(() => new Promise(() => {})); // 永久にpending

      render(<PopupMenu />);

      const snapshotButton = screen.getByRole('button', { name: 'スナップショットを取得' });
      fireEvent.click(snapshotButton);

      await waitFor(() => {
        // 取得中ボタンを探す
        const loadingButton = screen.getByText('取得中...').closest('button');
        expect(loadingButton).toBeDisabled();
      });
    });
  });
});
