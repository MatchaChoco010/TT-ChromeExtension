import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IconPicker } from './IconPicker';

describe('IconPicker', () => {
  const mockOnSelect = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('レンダリング', () => {
    it('コンポーネントが正しくレンダリングされる', () => {
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('icon-picker')).toBeInTheDocument();
    });

    it('カテゴリタブが表示される', () => {
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('tab', { name: /work/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /hobby/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /social/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /dev/i })).toBeInTheDocument();
      expect(screen.getByRole('tab', { name: /general/i })).toBeInTheDocument();
    });

    it('アイコングリッドが表示される', () => {
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByTestId('icon-grid')).toBeInTheDocument();
    });

    it('保存とキャンセルボタンが表示される', () => {
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('button', { name: /select/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });

  describe('カテゴリ切り替え', () => {
    it('カテゴリタブをクリックするとカテゴリが切り替わる', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const workTab = screen.getByRole('tab', { name: /work/i });
      expect(workTab).toHaveAttribute('aria-selected', 'true');

      const hobbyTab = screen.getByRole('tab', { name: /hobby/i });
      await user.click(hobbyTab);

      expect(hobbyTab).toHaveAttribute('aria-selected', 'true');
      expect(workTab).toHaveAttribute('aria-selected', 'false');
    });

    it('各カテゴリに対応するアイコンが表示される', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const iconGrid = screen.getByTestId('icon-grid');
      const iconButtons = iconGrid.querySelectorAll('[data-testid^="icon-button-"]');
      expect(iconButtons.length).toBeGreaterThan(0);

      const devTab = screen.getByRole('tab', { name: /dev/i });
      await user.click(devTab);

      const newIconButtons = iconGrid.querySelectorAll('[data-testid^="icon-button-"]');
      expect(newIconButtons.length).toBeGreaterThan(0);
    });
  });

  describe('アイコン選択', () => {
    it('アイコンをクリックすると選択状態になる', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const iconGrid = screen.getByTestId('icon-grid');
      const firstIconButton = iconGrid.querySelector('[data-testid^="icon-button-"]');
      expect(firstIconButton).toBeInTheDocument();

      await user.click(firstIconButton!);

      expect(firstIconButton).toHaveAttribute('aria-selected', 'true');
    });

    it('別のアイコンをクリックすると選択が切り替わる', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const iconGrid = screen.getByTestId('icon-grid');
      const iconButtons = iconGrid.querySelectorAll('[data-testid^="icon-button-"]');
      expect(iconButtons.length).toBeGreaterThan(1);

      await user.click(iconButtons[0]);
      expect(iconButtons[0]).toHaveAttribute('aria-selected', 'true');

      await user.click(iconButtons[1]);
      expect(iconButtons[1]).toHaveAttribute('aria-selected', 'true');
      expect(iconButtons[0]).toHaveAttribute('aria-selected', 'false');
    });

    it('currentIconが指定されている場合、そのアイコンが初期選択される', () => {
      render(
        <IconPicker
          currentIcon="briefcase"
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const selectedIcon = screen.getByTestId('icon-button-briefcase');
      expect(selectedIcon).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('プレビュー表示', () => {
    it('アイコンを選択するとプレビューが表示される', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const iconGrid = screen.getByTestId('icon-grid');
      const firstIconButton = iconGrid.querySelector('[data-testid^="icon-button-"]');
      await user.click(firstIconButton!);

      expect(screen.getByTestId('icon-preview')).toBeInTheDocument();
    });

    it('何も選択されていない場合、プレビューは空の状態を表示する', () => {
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const preview = screen.getByTestId('icon-preview');
      expect(preview).toBeInTheDocument();
      expect(screen.getByText(/select an icon/i)).toBeInTheDocument();
    });
  });

  describe('選択確定', () => {
    it('アイコンをクリックすると即座にonSelectが呼ばれる', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const iconGrid = screen.getByTestId('icon-grid');
      const firstIconButton = iconGrid.querySelector('[data-testid^="icon-button-"]');
      await user.click(firstIconButton!);

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith(expect.any(String));
    });

    it('Selectボタンをクリックしても追加でonSelectが呼ばれる', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const iconGrid = screen.getByTestId('icon-grid');
      const firstIconButton = iconGrid.querySelector('[data-testid^="icon-button-"]');
      await user.click(firstIconButton!);
      expect(mockOnSelect).toHaveBeenCalledTimes(1);

      const selectButton = screen.getByRole('button', { name: /select/i });
      await user.click(selectButton);

      expect(mockOnSelect).toHaveBeenCalledTimes(2);
    });

    it('何も選択せずにSelectボタンをクリックした場合、onSelectは呼ばれない', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const selectButton = screen.getByRole('button', { name: /select/i });
      await user.click(selectButton);

      expect(mockOnSelect).not.toHaveBeenCalled();
    });
  });

  describe('キャンセル', () => {
    it('CancelボタンをクリックするとonCancelが呼ばれる', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      await user.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('URL入力オプション', () => {
    it('URL入力フィールドが表示される', () => {
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByPlaceholderText(/enter icon url/i)).toBeInTheDocument();
    });

    it('URLを入力するとそのURLがプレビューに表示される', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const urlInput = screen.getByPlaceholderText(/enter icon url/i);
      await user.type(urlInput, 'https://example.com/icon.png');

      const previewImage = screen.getByTestId('icon-preview-image');
      expect(previewImage).toHaveAttribute('src', 'https://example.com/icon.png');
    });

    it('URLを入力してSelectボタンをクリックするとURLがonSelectに渡される', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      const urlInput = screen.getByPlaceholderText(/enter icon url/i);
      await user.type(urlInput, 'https://example.com/icon.png');

      const selectButton = screen.getByRole('button', { name: /select/i });
      await user.click(selectButton);

      expect(mockOnSelect).toHaveBeenCalledWith('https://example.com/icon.png');
    });
  });

  describe('アクセシビリティ', () => {
    it('キーボードでカテゴリを切り替えられる', async () => {
      const user = userEvent.setup();
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('tablist')).toBeInTheDocument();
      const tabs = screen.getAllByRole('tab');

      tabs[0].focus();
      expect(document.activeElement).toBe(tabs[0]);

      await user.keyboard('{ArrowRight}');
      expect(document.activeElement).toBe(tabs[1]);
    });

    it('アイコングリッドはgrid roleを持つ', () => {
      render(
        <IconPicker
          currentIcon={undefined}
          onSelect={mockOnSelect}
          onCancel={mockOnCancel}
        />
      );

      expect(screen.getByRole('grid')).toBeInTheDocument();
    });
  });
});
