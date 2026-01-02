import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NewTabButton from './NewTabButton';

// chrome API のモック
const mockChromeTabs = {
  create: vi.fn(),
};

// グローバルに chrome API をモック
vi.stubGlobal('chrome', {
  tabs: mockChromeTabs,
});

describe('NewTabButton', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // chrome.tabs.create のモックをリセット
    mockChromeTabs.create.mockResolvedValue({ id: 999, windowId: 1 });
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
      // w-full クラスが適用されていることを確認
      expect(button).toHaveClass('w-full');
    });

    it('プラスアイコンが表示されていること', () => {
      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');
      // プラスアイコン（+）がボタン内に含まれていることを確認
      expect(button.textContent).toContain('+');
    });

    it('ボタンは「+」アイコンのみを表示し、テキストラベルを表示しないこと', () => {
      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');
      // 「+」アイコンのみ表示、テキストラベルは表示しない
      // ボタンのテキストコンテンツは「+」のみであること
      expect(button.textContent?.trim()).toBe('+');
      // 「新規タブ」というテキストが含まれないこと
      expect(button.textContent).not.toContain('新規タブ');
    });
  });

  describe('クリック動作テスト', () => {
    it('クリック時にchrome.tabs.createが呼ばれること', async () => {
      const user = userEvent.setup();
      render(<NewTabButton />);

      const button = screen.getByTestId('new-tab-button');
      await user.click(button);

      expect(mockChromeTabs.create).toHaveBeenCalledTimes(1);
    });

    it('クリック時に新規タブがアクティブになるように作成されること', async () => {
      const user = userEvent.setup();
      render(<NewTabButton />);

      const button = screen.getByTestId('new-tab-button');
      await user.click(button);

      expect(mockChromeTabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          active: true,
        })
      );
    });

    // 新規タブのタイトルを「スタートページ」に修正
    // NewTabButtonがchrome://vivaldi-webui/startpageを開くことで、getDisplayTitleが「スタートページ」を表示
    it('クリック時にVivaldiスタートページが開かれること', async () => {
      const user = userEvent.setup();
      render(<NewTabButton />);

      const button = screen.getByTestId('new-tab-button');
      await user.click(button);

      expect(mockChromeTabs.create).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'chrome://vivaldi-webui/startpage',
        })
      );
    });

    it('onNewTabコールバックが提供された場合、新規タブ作成後に呼ばれること', async () => {
      const user = userEvent.setup();
      const onNewTab = vi.fn();
      render(<NewTabButton onNewTab={onNewTab} />);

      const button = screen.getByTestId('new-tab-button');
      await user.click(button);

      // Promise が解決されるまで待機
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
      // hover スタイルが適用されていることを確認
      expect(button.className).toMatch(/hover:/);
    });

    it('ボタンがカーソルポインターを持つこと', () => {
      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');
      expect(button).toHaveClass('cursor-pointer');
    });
  });

  describe('エラーハンドリングテスト', () => {
    it('chrome.tabs.createが失敗してもエラーがスローされないこと', async () => {
      const user = userEvent.setup();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockChromeTabs.create.mockRejectedValue(new Error('Tab creation failed'));

      render(<NewTabButton />);
      const button = screen.getByTestId('new-tab-button');

      // エラーがスローされずにクリックが完了することを確認
      await expect(user.click(button)).resolves.not.toThrow();

      consoleErrorSpy.mockRestore();
    });
  });
});
