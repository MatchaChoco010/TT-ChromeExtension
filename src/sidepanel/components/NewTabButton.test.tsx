import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewTabButton from './NewTabButton';

const mockSendMessage = vi.fn();

vi.stubGlobal('chrome', {
  runtime: {
    sendMessage: mockSendMessage,
  },
});

describe('NewTabButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMessage.mockResolvedValue({ success: true });
  });

  describe('表示テスト', () => {
    it('新規タブ追加ボタンが表示されること', () => {
      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');
      expect(button).toBeInTheDocument();
    });

    it('ボタンにアクセシブルなラベルが設定されていること', () => {
      render(<NewTabButton />);
      const button = screen.getByRole('button', { name: /新規タブ|new tab/i });
      expect(button).toBeInTheDocument();
    });

    it('ボタンがツリービューの横幅いっぱいの幅を持つこと', () => {
      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');
      expect(button).toHaveClass('w-full');
    });

    it('プラスアイコンが表示されていること', () => {
      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');
      expect(button.textContent).toContain('+');
    });

    it('ボタンは「+」アイコンのみを表示し、テキストラベルを表示しないこと', () => {
      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');
      expect(button.textContent?.trim()).toBe('+');
      expect(button.textContent).not.toContain('新規タブ');
    });
  });

  describe('クリック動作テスト', () => {
    it('クリック時にchrome.runtime.sendMessageが呼ばれること', async () => {
      const user = userEvent.setup();
      render(<NewTabButton />);

      const button = screen.getByTestId('new-tab-button');
      await user.click(button);

      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });

    it('クリック時にCREATE_NEW_TABメッセージが送信されること', async () => {
      const user = userEvent.setup();
      render(<NewTabButton />);

      const button = screen.getByTestId('new-tab-button');
      await user.click(button);

      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'CREATE_NEW_TAB' });
    });

    it('onNewTabコールバックが提供された場合、新規タブ作成後に呼ばれること', async () => {
      const user = userEvent.setup();
      const onNewTab = vi.fn();
      render(<NewTabButton onNewTab={onNewTab} />);

      const button = screen.getByTestId('new-tab-button');
      await user.click(button);

      await vi.waitFor(() => {
        expect(onNewTab).toHaveBeenCalledTimes(1);
      });
    });

    it('クリックイベントが親要素に伝播しないこと', async () => {
      const user = userEvent.setup();
      const onParentClick = vi.fn();

      render(
        <div onClick={onParentClick}>
          <NewTabButton />
        </div>
      );

      const button = screen.getByTestId('new-tab-button');
      await user.click(button);

      expect(onParentClick).not.toHaveBeenCalled();
    });
  });

  describe('スタイルテスト', () => {
    it('ホバー時にスタイルが変化するクラスが適用されていること', () => {
      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');
      expect(button.className).toMatch(/hover:/);
    });

    it('ボタンがカーソルポインターを持つこと', () => {
      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');
      expect(button).toHaveClass('cursor-pointer');
    });
  });

  describe('エラーハンドリングテスト', () => {
    it('chrome.runtime.sendMessageが失敗してもエラーがスローされないこと', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockSendMessage.mockRejectedValue(new Error('Message sending failed'));

      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');

      await expect(user.click(button)).resolves.not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });
});
