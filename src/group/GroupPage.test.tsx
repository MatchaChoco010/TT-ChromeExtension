/**
 * GroupPage コンポーネントのテスト
 * Task 15.1: グループタブ専用ページの作成
 * Requirements: 5.4, 5.5, 5.8, 5.9, 5.10
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { GroupPage } from './GroupPage';

// chrome.runtime をモック
const mockSendMessage = vi.fn();
vi.mock('@/types', () => ({}));

// chrome.runtime.sendMessage のモック
beforeEach(() => {
  // chrome API のモック
  globalThis.chrome = {
    runtime: {
      sendMessage: mockSendMessage,
    },
  } as unknown as typeof chrome;

  // location.search のモック
  Object.defineProperty(window, 'location', {
    value: { search: '?tabId=123' },
    writable: true,
  });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('GroupPage', () => {
  describe('ローディング表示', () => {
    it('グループ情報取得中にローディング表示を行うこと', async () => {
      // 遅延するPromiseを返す
      mockSendMessage.mockReturnValue(new Promise(() => {}));

      render(<GroupPage />);

      // ローディング表示を確認
      expect(screen.getByText('読み込み中...')).toBeInTheDocument();
    });
  });

  describe('グループ情報表示', () => {
    it('グループ名をh1要素で表示すること', async () => {
      const groupInfo = {
        name: 'テストグループ',
        children: [
          { tabId: 1, title: 'タブ1', url: 'https://example.com/1' },
          { tabId: 2, title: 'タブ2', url: 'https://example.com/2' },
        ],
      };

      mockSendMessage.mockResolvedValue({ success: true, data: groupInfo });

      render(<GroupPage />);

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1 });
        expect(heading).toHaveTextContent('テストグループ');
      });
    });

    it('子タブをリスト（ul/li）で表示すること', async () => {
      const groupInfo = {
        name: 'テストグループ',
        children: [
          { tabId: 1, title: 'タブ1', url: 'https://example.com/1' },
          { tabId: 2, title: 'タブ2', url: 'https://example.com/2' },
        ],
      };

      mockSendMessage.mockResolvedValue({ success: true, data: groupInfo });

      render(<GroupPage />);

      await waitFor(() => {
        const listItems = screen.getAllByRole('listitem');
        expect(listItems).toHaveLength(2);
        expect(listItems[0]).toHaveTextContent('タブ1');
        expect(listItems[1]).toHaveTextContent('タブ2');
      });
    });

    it('子タブが空の場合に適切なメッセージを表示すること', async () => {
      const groupInfo = {
        name: 'テストグループ',
        children: [],
      };

      mockSendMessage.mockResolvedValue({ success: true, data: groupInfo });

      render(<GroupPage />);

      await waitFor(() => {
        expect(screen.getByText('このグループにはタブがありません')).toBeInTheDocument();
      });
    });
  });

  describe('エラー/リトライUI', () => {
    it('グループ情報が取得できない場合にエラーUIを表示すること', async () => {
      mockSendMessage.mockResolvedValue({ success: false, error: 'Group not found' });

      render(<GroupPage />);

      await waitFor(() => {
        expect(screen.getByText('グループ情報の取得に失敗しました')).toBeInTheDocument();
      });
    });

    it('リトライボタンをクリックすると再取得を試みること', async () => {
      mockSendMessage
        .mockResolvedValueOnce({ success: false, error: 'Group not found' })
        .mockResolvedValueOnce({
          success: true,
          data: {
            name: 'テストグループ',
            children: [],
          },
        });

      render(<GroupPage />);

      // エラー表示を待つ
      await waitFor(() => {
        expect(screen.getByText('グループ情報の取得に失敗しました')).toBeInTheDocument();
      });

      // リトライボタンをクリック
      const retryButton = screen.getByRole('button', { name: '再試行' });
      retryButton.click();

      // グループ情報が表示されることを確認
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('テストグループ');
      });
    });
  });

  describe('ポーリングによる更新', () => {
    it('ポーリングによりツリー状態の更新を監視すること', async () => {
      vi.useFakeTimers();

      const initialGroupInfo = {
        name: 'テストグループ',
        children: [
          { tabId: 1, title: 'タブ1', url: 'https://example.com/1' },
        ],
      };

      const updatedGroupInfo = {
        name: 'テストグループ',
        children: [
          { tabId: 1, title: 'タブ1', url: 'https://example.com/1' },
          { tabId: 2, title: 'タブ2', url: 'https://example.com/2' },
        ],
      };

      mockSendMessage
        .mockResolvedValueOnce({ success: true, data: initialGroupInfo })
        .mockResolvedValue({ success: true, data: updatedGroupInfo });

      render(<GroupPage />);

      // 初期表示を確認（Promiseを解決するために手動でタイマーを進める）
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(screen.getAllByRole('listitem')).toHaveLength(1);

      // ポーリング間隔を経過させる (2秒)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });

      // 更新された情報が表示されることを確認
      expect(screen.getAllByRole('listitem')).toHaveLength(2);

      vi.useRealTimers();
    });
  });

  describe('メッセージ送信', () => {
    it('GET_GROUP_INFOメッセージでグループ情報を取得すること', async () => {
      const groupInfo = {
        name: 'テストグループ',
        children: [],
      };

      mockSendMessage.mockResolvedValue({ success: true, data: groupInfo });

      render(<GroupPage />);

      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalledWith({
          type: 'GET_GROUP_INFO',
          payload: { tabId: 123 },
        });
      });
    });
  });
});
