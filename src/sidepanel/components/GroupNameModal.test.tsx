import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GroupNameModal, getDefaultGroupTitle } from './GroupNameModal';

describe('GroupNameModal', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getDefaultGroupTitle', () => {
    it('タブが1つ以下の場合は「グループ」を返す', () => {
      expect(getDefaultGroupTitle([])).toBe('グループ');
      expect(getDefaultGroupTitle(['Tab 1'])).toBe('グループ');
    });

    it('共通単語がある場合はその単語を返す', () => {
      expect(getDefaultGroupTitle(['YouTube - Video 1', 'YouTube - Video 2'])).toBe('YouTube');
      expect(getDefaultGroupTitle(['GitHub - Issue', 'GitHub - PR'])).toBe('GitHub');
    });

    it('共通単語がない場合は「グループ」を返す', () => {
      expect(getDefaultGroupTitle(['Tab 1', 'Page 2', 'Site 3'])).toBe('グループ');
    });

    it('短い単語（2文字未満）は無視される', () => {
      expect(getDefaultGroupTitle(['A - Tab', 'A - Page'])).toBe('グループ');
    });
  });

  describe('モーダル表示', () => {
    it('isOpen=falseの場合は何も表示されない', () => {
      render(
        <GroupNameModal
          isOpen={false}
          tabTitles={['Tab 1', 'Tab 2']}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('group-name-modal')).not.toBeInTheDocument();
    });

    it('isOpen=trueの場合はモーダルが表示される', () => {
      render(
        <GroupNameModal
          isOpen={true}
          tabTitles={['Tab 1', 'Tab 2']}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('group-name-modal')).toBeInTheDocument();
      expect(screen.getByText('グループ名')).toBeInTheDocument();
    });

    it('デフォルトのグループ名が入力フィールドに表示される', () => {
      render(
        <GroupNameModal
          isOpen={true}
          tabTitles={['YouTube - Video 1', 'YouTube - Video 2']}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByTestId('group-name-input') as HTMLInputElement;
      expect(input.value).toBe('YouTube');
    });
  });

  describe('ユーザー操作', () => {
    it('グループ名を入力して保存できる', async () => {
      render(
        <GroupNameModal
          isOpen={true}
          tabTitles={['Tab 1', 'Tab 2']}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByTestId('group-name-input');
      fireEvent.change(input, { target: { value: 'My Custom Group' } });

      const saveButton = screen.getByTestId('group-name-save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('My Custom Group');
      });
    });

    it('キャンセルボタンでモーダルを閉じる', () => {
      render(
        <GroupNameModal
          isOpen={true}
          tabTitles={['Tab 1', 'Tab 2']}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByTestId('group-name-cancel-button');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
      expect(mockOnSave).not.toHaveBeenCalled();
    });

    it('Enterキーで保存できる', async () => {
      render(
        <GroupNameModal
          isOpen={true}
          tabTitles={['Tab 1', 'Tab 2']}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByTestId('group-name-input');
      fireEvent.change(input, { target: { value: 'Enter Group' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('Enter Group');
      });
    });

    it('Escapeキーでモーダルを閉じる', () => {
      render(
        <GroupNameModal
          isOpen={true}
          tabTitles={['Tab 1', 'Tab 2']}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByTestId('group-name-input');
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalled();
    });

    it('空の名前では保存できない（デフォルト値が使用される）', async () => {
      render(
        <GroupNameModal
          isOpen={true}
          tabTitles={['Tab 1', 'Tab 2']}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByTestId('group-name-input');
      fireEvent.change(input, { target: { value: '' } });

      const saveButton = screen.getByTestId('group-name-save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('グループ');
      });
    });

    it('空白のみの名前はトリムされてデフォルト値が使用される', async () => {
      render(
        <GroupNameModal
          isOpen={true}
          tabTitles={['Tab 1', 'Tab 2']}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const input = screen.getByTestId('group-name-input');
      fireEvent.change(input, { target: { value: '   ' } });

      const saveButton = screen.getByTestId('group-name-save-button');
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith('グループ');
      });
    });
  });
});
