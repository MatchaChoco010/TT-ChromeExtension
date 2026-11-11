import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { GroupPage } from './GroupPage';

const mockSendMessage = vi.fn();
const mockGetCurrent = vi.fn();
const messageListeners = new Set<(message: { type: string }) => void>();
vi.mock('@/types', () => ({}));

beforeEach(() => {
  globalThis.chrome = {
    runtime: {
      sendMessage: mockSendMessage,
      onMessage: {
        addListener: (listener: (message: { type: string }) => void) => messageListeners.add(listener),
        removeListener: (listener: (message: { type: string }) => void) => messageListeners.delete(listener),
      },
    },
    tabs: {
      getCurrent: mockGetCurrent,
    },
  } as unknown as typeof chrome;

  mockGetCurrent.mockResolvedValue({ id: 123 });
});

afterEach(() => {
  vi.clearAllMocks();
  messageListeners.clear();
});

describe('GroupPage', () => {
  describe('ローディング表示', () => {
    it('グループ情報取得中にローディング表示を行うこと', async () => {
      mockSendMessage.mockReturnValue(new Promise(() => {}));

      render(<GroupPage />);

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

      await waitFor(() => {
        expect(screen.getByText('グループ情報の取得に失敗しました')).toBeInTheDocument();
      });

      const retryButton = screen.getByRole('button', { name: '再試行' });
      retryButton.click();

      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('テストグループ');
      });
    });
  });

  describe('状態変更の通知による更新', () => {
    it('STATE_UPDATEDの通知を受けるとグループ情報を取得し直すこと', async () => {
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

      await waitFor(() => {
        expect(screen.getAllByRole('listitem')).toHaveLength(1);
      });

      act(() => {
        messageListeners.forEach((listener) => listener({ type: 'STATE_UPDATED' }));
      });

      await waitFor(() => {
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
      });
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
