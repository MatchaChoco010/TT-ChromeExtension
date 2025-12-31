/**
 * ViewEditModal コンポーネントのテスト
 * Task 7.2: ビュー編集モーダルダイアログの実装
 * Requirements: 3.4
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { View } from '@/types';
import { ViewEditModal } from './ViewEditModal';

describe('ViewEditModal', () => {
  const mockView: View = {
    id: 'view-1',
    name: 'Work',
    color: '#ef4444',
  };

  const mockViewWithIcon: View = {
    id: 'view-2',
    name: 'Personal',
    color: '#3b82f6',
    icon: 'https://example.com/icon.png',
  };

  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本的な表示', () => {
    it('isOpen=trueの場合モーダルが表示される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('view-edit-modal')).toBeInTheDocument();
    });

    it('isOpen=falseの場合モーダルが表示されない', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={false}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('view-edit-modal')).not.toBeInTheDocument();
    });

    it('モーダルヘッダーに"Edit View"が表示される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Edit View')).toBeInTheDocument();
    });

    it('オーバーレイが表示される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    });
  });

  describe('フォーム入力フィールド', () => {
    it('ビュー名入力フィールドが表示される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const nameInput = screen.getByLabelText('View Name');
      expect(nameInput).toBeInTheDocument();
      expect(nameInput).toHaveValue('Work');
    });

    it('色選択フィールドが表示される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const colorInput = screen.getByLabelText('Color');
      expect(colorInput).toBeInTheDocument();
      expect(colorInput).toHaveValue('#ef4444');
    });

    it('アイコン選択ボタンが表示される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const iconSelectButton = screen.getByTestId('icon-select-button');
      expect(iconSelectButton).toBeInTheDocument();
    });

    it('アイコンURLがある場合はプレビューが表示される', async () => {
      render(
        <ViewEditModal
          view={mockViewWithIcon}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // queueMicrotaskによる状態更新を待つ
      await waitFor(() => {
        const iconPreview = screen.getByTestId('icon-preview');
        expect(iconPreview).toBeInTheDocument();
        expect(iconPreview).toHaveAttribute('src', 'https://example.com/icon.png');
      });
    });
  });

  describe('フォーム編集', () => {
    it('ビュー名を変更できる', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const nameInput = screen.getByLabelText('View Name');
      fireEvent.change(nameInput, { target: { value: 'Updated Work' } });

      expect(nameInput).toHaveValue('Updated Work');
    });

    it('色を変更できる', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const colorInput = screen.getByLabelText('Color');
      fireEvent.change(colorInput, { target: { value: '#10b981' } });

      expect(colorInput).toHaveValue('#10b981');
    });

    it('IconPickerでアイコンを選択して変更できる (即時反映)', () => {
      const mockOnImmediateUpdate = vi.fn();
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
          onImmediateUpdate={mockOnImmediateUpdate}
        />
      );

      // IconPickerを開く
      const iconSelectButton = screen.getByTestId('icon-select-button');
      fireEvent.click(iconSelectButton);

      // アイコンを選択 - 即座に選択が確定される（Selectボタン不要）
      const briefcaseButton = screen.getByTestId('icon-button-briefcase');
      fireEvent.click(briefcaseButton);

      // onImmediateUpdateが呼ばれる（即時反映）
      expect(mockOnImmediateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'briefcase',
        })
      );

      // IconPickerが閉じる
      expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();
    });
  });

  describe('保存操作', () => {
    it('SaveボタンをクリックするとonSaveが呼ばれる', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    it('編集後にSaveボタンをクリックすると変更された値でonSaveが呼ばれる', () => {
      const mockOnImmediateUpdate = vi.fn();
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
          onImmediateUpdate={mockOnImmediateUpdate}
        />
      );

      // 値を変更
      const nameInput = screen.getByLabelText('View Name');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      const colorInput = screen.getByLabelText('Color');
      fireEvent.change(colorInput, { target: { value: '#22c55e' } });

      // IconPickerを開いてアイコンを選択
      const iconSelectButton = screen.getByTestId('icon-select-button');
      fireEvent.click(iconSelectButton);

      // briefcaseアイコンを選択 - 即座に選択が確定される
      const briefcaseButton = screen.getByTestId('icon-button-briefcase');
      fireEvent.click(briefcaseButton);

      // onImmediateUpdateが呼ばれる（IconPicker選択時の即時反映）
      expect(mockOnImmediateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'briefcase',
        })
      );

      // 保存ボタンでも保存できる（名前や色が後から変更された場合用）
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith({
        id: 'view-1',
        name: 'Updated Name',
        color: '#22c55e',
        icon: 'briefcase',
      });
    });

    it('アイコンをクリアした場合はiconプロパティがundefinedになる', async () => {
      render(
        <ViewEditModal
          view={mockViewWithIcon}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // queueMicrotaskによる状態更新を待つ
      await waitFor(() => {
        expect(screen.getByTestId('icon-clear-button')).toBeInTheDocument();
      });

      // アイコンクリアボタンをクリック
      const clearButton = screen.getByTestId('icon-clear-button');
      fireEvent.click(clearButton);

      // 保存
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith({
        id: 'view-2',
        name: 'Personal',
        color: '#3b82f6',
        icon: undefined,
      });
    });

    it('ビュー名が空の場合は保存できない', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // ビュー名を空にする
      const nameInput = screen.getByLabelText('View Name');
      fireEvent.change(nameInput, { target: { value: '' } });

      // 保存ボタンをクリック
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // onSaveは呼ばれない
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('キャンセル操作', () => {
    it('CancelボタンをクリックするとonCloseが呼ばれる', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('キャンセル時にonSaveは呼ばれない', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // 値を変更
      const nameInput = screen.getByLabelText('View Name');
      fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

      // キャンセル
      const cancelButton = screen.getByRole('button', { name: /cancel/i });
      fireEvent.click(cancelButton);

      expect(mockOnSave).not.toHaveBeenCalled();
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('オーバーレイをクリックするとonCloseが呼ばれる', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const overlay = screen.getByTestId('modal-overlay');
      fireEvent.click(overlay);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('モーダルコンテンツをクリックしてもonCloseは呼ばれない', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const modalContent = screen.getByTestId('modal-content');
      fireEvent.click(modalContent);

      expect(mockOnClose).not.toHaveBeenCalled();
    });
  });

  describe('Escapeキーによるクローズ', () => {
    it('Escapeキーを押すとonCloseが呼ばれる', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('viewがnullの場合', () => {
    it('viewがnullの場合は何も表示されない', () => {
      render(
        <ViewEditModal
          view={null}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('view-edit-modal')).not.toBeInTheDocument();
    });
  });

  describe('プリセットカラー選択', () => {
    it('プリセットカラーボタンが表示される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // プリセットカラーボタンが存在することを確認
      const colorButtons = screen.getAllByTestId(/^preset-color-/);
      expect(colorButtons.length).toBeGreaterThan(0);
    });

    it('プリセットカラーをクリックすると色が変更される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // 2番目のプリセットカラー（オレンジ: #f97316）をクリック
      // 注: mockViewの色は#ef4444（赤）なので、異なる色を選択
      const colorButtons = screen.getAllByTestId(/^preset-color-/);
      fireEvent.click(colorButtons[1]); // 2番目（オレンジ）を選択

      // 保存して色が変更されていることを確認
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // onSaveの呼び出しで色が変更されている
      expect(mockOnSave).toHaveBeenCalledTimes(1);
      const savedView = mockOnSave.mock.calls[0][0] as View;
      expect(savedView.color).toBe('#f97316'); // オレンジ色に変更される
    });
  });

  describe('アイコンプレビュー', () => {
    it('有効なアイコンURLが入力されるとプレビューが表示される', async () => {
      render(
        <ViewEditModal
          view={mockViewWithIcon}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // queueMicrotaskによる状態更新を待つ
      await waitFor(() => {
        const iconPreview = screen.getByTestId('icon-preview');
        expect(iconPreview).toBeInTheDocument();
        expect(iconPreview).toHaveAttribute('src', 'https://example.com/icon.png');
      });
    });

    it('アイコンURLが空の場合はプレビューが表示されない', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('icon-preview')).not.toBeInTheDocument();
    });
  });

  describe('アクセシビリティ', () => {
    it('モーダルにはrole="dialog"がある', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('モーダルにはaria-labelledbyがある', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-labelledby');
    });

    it('モーダルにはaria-modal="true"がある', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
    });
  });

  describe('Task 8.2: IconPicker統合', () => {
    it('アイコン選択ボタンが表示される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // アイコン選択ボタン（Icon URL入力の代わりにIconPickerを開くボタン）
      expect(screen.getByTestId('icon-select-button')).toBeInTheDocument();
    });

    it('アイコン選択ボタンをクリックするとIconPickerが表示される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      const iconSelectButton = screen.getByTestId('icon-select-button');
      fireEvent.click(iconSelectButton);

      // IconPickerが表示される
      expect(screen.getByTestId('icon-picker')).toBeInTheDocument();
    });

    it('IconPickerでアイコンを選択すると選択が反映される (即時反映)', () => {
      const mockOnImmediateUpdate = vi.fn();
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
          onImmediateUpdate={mockOnImmediateUpdate}
        />
      );

      // IconPickerを開く
      const iconSelectButton = screen.getByTestId('icon-select-button');
      fireEvent.click(iconSelectButton);

      // アイコンを選択 - 即座に選択が確定される（Selectボタン不要）
      const iconGrid = screen.getByTestId('icon-grid');
      const firstIconButton = iconGrid.querySelector('[data-testid^="icon-button-"]');
      expect(firstIconButton).toBeInTheDocument();
      fireEvent.click(firstIconButton!);

      // onImmediateUpdateが呼ばれる（即時反映）
      expect(mockOnImmediateUpdate).toHaveBeenCalled();

      // IconPickerが閉じる
      expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();
    });

    it('IconPickerで選択したアイコンが即時反映される', () => {
      const mockOnImmediateUpdate = vi.fn();
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
          onImmediateUpdate={mockOnImmediateUpdate}
        />
      );

      // IconPickerを開く
      const iconSelectButton = screen.getByTestId('icon-select-button');
      fireEvent.click(iconSelectButton);

      // briefcaseアイコンを選択 - 即座に選択が確定される
      const briefcaseButton = screen.getByTestId('icon-button-briefcase');
      fireEvent.click(briefcaseButton);

      // onImmediateUpdateが即座に呼ばれ、iconがbriefcaseになっている
      expect(mockOnImmediateUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'briefcase',
        })
      );

      // IconPickerが閉じる
      expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();
    });

    it('IconPickerをキャンセルすると何も選択せずに閉じる', async () => {
      render(
        <ViewEditModal
          view={mockViewWithIcon}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // queueMicrotaskによる状態更新を待つ
      await waitFor(() => {
        expect(screen.getByTestId('icon-select-button')).toBeInTheDocument();
      });

      // IconPickerを開く
      const iconSelectButton = screen.getByTestId('icon-select-button');
      fireEvent.click(iconSelectButton);

      // IconPicker内のキャンセルボタンをクリック（アイコンを選択せずにキャンセル）
      const iconPicker = screen.getByTestId('icon-picker');
      // Cancelボタンはフッターの最初のボタン
      const cancelButtons = Array.from(iconPicker.querySelectorAll('button')).filter(
        (btn) => btn.textContent === 'Cancel'
      );
      expect(cancelButtons.length).toBe(1);
      fireEvent.click(cancelButtons[0]);

      // IconPickerが閉じる
      expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();

      // モーダルの保存ボタンをクリック
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // onSaveが呼ばれ、iconは元のURL（変更されていない）
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: 'https://example.com/icon.png',
        })
      );
    });

    it('現在のアイコンがカスタムアイコン名の場合、プレビューに表示される', async () => {
      const mockViewWithCustomIcon: View = {
        id: 'view-3',
        name: 'Dev',
        color: '#22c55e',
        icon: 'code',
      };

      render(
        <ViewEditModal
          view={mockViewWithCustomIcon}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // queueMicrotaskによる状態更新を待つ
      await waitFor(() => {
        // カスタムアイコンのプレビューが表示される
        expect(screen.getByTestId('custom-icon-preview')).toBeInTheDocument();
      });
    });

    it('アイコンをクリアできる', async () => {
      render(
        <ViewEditModal
          view={mockViewWithIcon}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // queueMicrotaskによる状態更新を待つ
      await waitFor(() => {
        expect(screen.getByTestId('icon-clear-button')).toBeInTheDocument();
      });

      // アイコンクリアボタンをクリック
      const clearButton = screen.getByTestId('icon-clear-button');
      fireEvent.click(clearButton);

      // モーダルの保存ボタンをクリック
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      // onSaveが呼ばれ、iconがundefined
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          icon: undefined,
        })
      );
    });
  });

  describe('Requirement 3.4: ビュー編集用のモーダルダイアログ', () => {
    it('ビュー編集モーダルでビュー名・色・アイコンを編集できる', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // ビュー名を編集
      const nameInput = screen.getByLabelText('View Name');
      fireEvent.change(nameInput, { target: { value: 'New View Name' } });

      // 色を編集
      const colorInput = screen.getByLabelText('Color');
      fireEvent.change(colorInput, { target: { value: '#8b5cf6' } });

      // IconPickerを開いてアイコンを選択
      const iconSelectButton = screen.getByTestId('icon-select-button');
      fireEvent.click(iconSelectButton);

      // codeアイコンを選択 - 即座に選択が確定される
      const devTab = screen.getByRole('tab', { name: /dev/i });
      fireEvent.click(devTab);
      const codeButton = screen.getByTestId('icon-button-code');
      fireEvent.click(codeButton);

      // IconPickerが閉じる（即時選択のため）
      expect(screen.queryByTestId('icon-picker')).not.toBeInTheDocument();

      // 保存
      const saveButton = screen.getByRole('button', { name: /save/i });
      fireEvent.click(saveButton);

      expect(mockOnSave).toHaveBeenCalledWith({
        id: 'view-1',
        name: 'New View Name',
        color: '#8b5cf6',
        icon: 'code',
      });
    });

    it('モーダルオーバーレイで表示される', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // オーバーレイが背景を覆っている
      const overlay = screen.getByTestId('modal-overlay');
      expect(overlay).toHaveClass('fixed', 'inset-0');
    });

    it('保存/キャンセル操作が可能', () => {
      render(
        <ViewEditModal
          view={mockView}
          isOpen={true}
          onSave={mockOnSave}
          onClose={mockOnClose}
        />
      );

      // 保存ボタンが存在
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
      // キャンセルボタンが存在
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });
  });
});
