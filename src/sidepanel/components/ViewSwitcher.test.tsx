/**
 * ViewSwitcher コンポーネントのテスト
 * Task 8.2: ViewSwitcher UI コンポーネントの実装
 * Requirements: 6.3
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { View } from '@/types';
import { ViewSwitcher } from './ViewSwitcher';

describe('ViewSwitcher', () => {
  const mockViews: View[] = [
    { id: 'view-1', name: 'Work', color: '#ef4444' },
    { id: 'view-2', name: 'Personal', color: '#3b82f6' },
    { id: 'view-3', name: 'Research', color: '#10b981' },
  ];

  const mockCurrentViewId = 'view-1';
  const mockOnViewSwitch = vi.fn();
  const mockOnViewCreate = vi.fn();
  const mockOnViewDelete = vi.fn();
  const mockOnViewUpdate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本的な表示', () => {
    it('すべてのビューを表示する', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // すべてのビューが表示されることを確認
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.getByText('Research')).toBeInTheDocument();
    });

    it('新しいビュー追加ボタンを表示する', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // 新しいビュー追加ボタンが表示されることを確認
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      expect(addButton).toBeInTheDocument();
    });

    it('ビューがない場合でも新しいビュー追加ボタンを表示する', () => {
      render(
        <ViewSwitcher
          views={[]}
          currentViewId="default"
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // 新しいビュー追加ボタンが表示されることを確認
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      expect(addButton).toBeInTheDocument();
    });
  });

  describe('アクティブビューのハイライト', () => {
    it('現在のビューをハイライト表示する', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // アクティブなビューのボタンを取得（Switch to Work view を指定）
      const workButton = screen.getByRole('button', {
        name: 'Switch to Work view',
      });

      // アクティブなビューがハイライトされていることを確認
      // data-active 属性で判定
      expect(workButton).toHaveAttribute('data-active', 'true');
    });

    it('アクティブでないビューはハイライトされない', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // アクティブでないビューのボタンを取得
      const personalButton = screen.getByRole('button', {
        name: 'Switch to Personal view',
      });
      const researchButton = screen.getByRole('button', {
        name: 'Switch to Research view',
      });

      // アクティブでないビューがハイライトされていないことを確認
      expect(personalButton).toHaveAttribute('data-active', 'false');
      expect(researchButton).toHaveAttribute('data-active', 'false');
    });
  });

  describe('ビュー切り替え機能', () => {
    it('ビューをクリックすると onViewSwitch が呼ばれる', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // Personal ビューをクリック
      const personalButton = screen.getByRole('button', {
        name: 'Switch to Personal view',
      });
      fireEvent.click(personalButton);

      // onViewSwitch が正しいIDで呼ばれることを確認
      expect(mockOnViewSwitch).toHaveBeenCalledWith('view-2');
      expect(mockOnViewSwitch).toHaveBeenCalledTimes(1);
    });

    it('現在のビューをクリックしても onViewSwitch が呼ばれる', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // 現在アクティブな Work ビューをクリック
      const workButton = screen.getByRole('button', {
        name: 'Switch to Work view',
      });
      fireEvent.click(workButton);

      // onViewSwitch が呼ばれることを確認
      expect(mockOnViewSwitch).toHaveBeenCalledWith('view-1');
    });
  });

  describe('新しいビュー追加機能', () => {
    it('追加ボタンをクリックすると onViewCreate が呼ばれる', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // 新しいビュー追加ボタンをクリック
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);

      // onViewCreate が呼ばれることを確認
      expect(mockOnViewCreate).toHaveBeenCalledTimes(1);
    });
  });

  describe('ビューの色表示', () => {
    it('各ビューの色がスタイルに反映される', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      const workButton = screen.getByRole('button', {
        name: 'Switch to Work view',
      });

      // ビューの色がスタイルに含まれることを確認
      // data-color 属性で色を管理
      expect(workButton).toHaveAttribute('data-color', '#ef4444');
    });
  });

  describe('横スクロール可能なUI', () => {
    it('ビューが横並びで表示される', () => {
      const { container } = render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // ビューコンテナが存在することを確認
      const viewSwitcherContainer = container.querySelector('[data-testid="view-switcher-container"]');
      expect(viewSwitcherContainer).toBeInTheDocument();

      // 子要素のビューリストコンテナに overflow-x-auto クラスが設定されていることを確認
      const viewListContainer = viewSwitcherContainer?.querySelector('.overflow-x-auto');
      expect(viewListContainer).toBeInTheDocument();
      expect(viewListContainer).toHaveClass('overflow-x-auto');
    });

    it('多数のビューがある場合でも表示できる', () => {
      const manyViews: View[] = Array.from({ length: 20 }, (_, i) => ({
        id: `view-${i}`,
        name: `View ${i}`,
        color: '#3b82f6',
      }));

      render(
        <ViewSwitcher
          views={manyViews}
          currentViewId="view-0"
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // すべてのビューが表示されることを確認
      manyViews.forEach((view) => {
        expect(screen.getByText(view.name)).toBeInTheDocument();
      });
    });
  });

  describe('Requirement 6.3: ビュー切り替えUIを操作する', () => {
    it('ユーザーがビュー切り替えUIを操作すると、選択されたビューに対応するタブツリーが表示される', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      // Research ビューに切り替え
      const researchButton = screen.getByRole('button', {
        name: 'Switch to Research view',
      });
      fireEvent.click(researchButton);

      // onViewSwitch が正しく呼ばれることを確認（実際のタブツリー表示は TreeStateProvider が担当）
      expect(mockOnViewSwitch).toHaveBeenCalledWith('view-3');
    });
  });

  describe('アクセシビリティ', () => {
    it('ビューボタンに適切な aria-label がある', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      const workButton = screen.getByRole('button', {
        name: 'Switch to Work view',
      });
      expect(workButton).toHaveAttribute('aria-label');
    });

    it('現在のビューに aria-current="true" がある', () => {
      render(
        <ViewSwitcher
          views={mockViews}
          currentViewId={mockCurrentViewId}
          onViewSwitch={mockOnViewSwitch}
          onViewCreate={mockOnViewCreate}
          onViewDelete={mockOnViewDelete}
          onViewUpdate={mockOnViewUpdate}
        />
      );

      const workButton = screen.getByRole('button', {
        name: 'Switch to Work view',
      });
      expect(workButton).toHaveAttribute('aria-current', 'true');
    });
  });

  describe('Task 8.3: ビューのカスタマイズ機能', () => {
    describe('Requirement 6.4: ビュー名と色の編集', () => {
      it('ビューの編集ボタンをクリックすると編集モードになる', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        // 編集ボタンを探す
        const editButtons = screen.getAllByLabelText(/edit view/i);
        expect(editButtons.length).toBeGreaterThan(0);

        // 最初のビューの編集ボタンをクリック
        fireEvent.click(editButtons[0]);

        // 編集フォームが表示されることを確認
        expect(screen.getByLabelText(/view name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/view color/i)).toBeInTheDocument();
      });

      it('ビュー名を編集して保存すると onViewUpdate が呼ばれる', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        // 編集ボタンをクリック
        const editButtons = screen.getAllByLabelText(/edit view/i);
        fireEvent.click(editButtons[0]);

        // ビュー名を変更
        const nameInput = screen.getByLabelText(/view name/i);
        fireEvent.change(nameInput, { target: { value: 'Updated Work' } });

        // 保存ボタンをクリック
        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        // onViewUpdate が正しいパラメータで呼ばれることを確認
        expect(mockOnViewUpdate).toHaveBeenCalledWith('view-1', {
          name: 'Updated Work',
        });
      });

      it('ビューの色を編集して保存すると onViewUpdate が呼ばれる', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        // 編集ボタンをクリック
        const editButtons = screen.getAllByLabelText(/edit view/i);
        fireEvent.click(editButtons[0]);

        // 色を変更
        const colorInput = screen.getByLabelText(/view color/i);
        fireEvent.change(colorInput, { target: { value: '#ff6600' } });

        // 保存ボタンをクリック
        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        // onViewUpdate が正しいパラメータで呼ばれることを確認
        expect(mockOnViewUpdate).toHaveBeenCalledWith('view-1', {
          color: '#ff6600',
        });
      });

      it('ビュー名と色の両方を編集して保存すると onViewUpdate が呼ばれる', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        // 編集ボタンをクリック
        const editButtons = screen.getAllByLabelText(/edit view/i);
        fireEvent.click(editButtons[0]);

        // ビュー名と色を変更
        const nameInput = screen.getByLabelText(/view name/i);
        const colorInput = screen.getByLabelText(/view color/i);
        fireEvent.change(nameInput, { target: { value: 'New Work' } });
        fireEvent.change(colorInput, { target: { value: '#00ff00' } });

        // 保存ボタンをクリック
        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        // onViewUpdate が正しいパラメータで呼ばれることを確認
        expect(mockOnViewUpdate).toHaveBeenCalledWith('view-1', {
          name: 'New Work',
          color: '#00ff00',
        });
      });

      it('編集をキャンセルすると onViewUpdate は呼ばれない', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        // 編集ボタンをクリック
        const editButtons = screen.getAllByLabelText(/edit view/i);
        fireEvent.click(editButtons[0]);

        // ビュー名を変更
        const nameInput = screen.getByLabelText(/view name/i);
        fireEvent.change(nameInput, { target: { value: 'Changed' } });

        // キャンセルボタンをクリック
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);

        // onViewUpdate が呼ばれないことを確認
        expect(mockOnViewUpdate).not.toHaveBeenCalled();
      });
    });

    describe('カスタムアイコンURL設定（オプション）', () => {
      it('カスタムアイコンURLを設定できる', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        // 編集ボタンをクリック
        const editButtons = screen.getAllByLabelText(/edit view/i);
        fireEvent.click(editButtons[0]);

        // アイコンURLを設定
        const iconInput = screen.getByLabelText(/icon url/i);
        fireEvent.change(iconInput, {
          target: { value: 'https://example.com/icon.png' },
        });

        // 保存ボタンをクリック
        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        // onViewUpdate が正しいパラメータで呼ばれることを確認
        expect(mockOnViewUpdate).toHaveBeenCalledWith('view-1', {
          icon: 'https://example.com/icon.png',
        });
      });

      it('カスタムアイコンURLを空にすると icon プロパティが削除される', () => {
        const viewsWithIcon: View[] = [
          {
            id: 'view-1',
            name: 'Work',
            color: '#ef4444',
            icon: 'https://example.com/icon.png',
          },
        ];

        render(
          <ViewSwitcher
            views={viewsWithIcon}
            currentViewId="view-1"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        // 編集ボタンをクリック
        const editButton = screen.getByLabelText(/edit view/i);
        fireEvent.click(editButton);

        // アイコンURLを空にする
        const iconInput = screen.getByLabelText(/icon url/i);
        fireEvent.change(iconInput, { target: { value: '' } });

        // 保存ボタンをクリック
        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        // onViewUpdate が呼ばれ、icon が undefined であることを確認
        expect(mockOnViewUpdate).toHaveBeenCalledWith('view-1', {
          icon: undefined,
        });
      });
    });

    describe('編集UI の表示/非表示', () => {
      it('初期状態では編集フォームは表示されない', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        // 編集フォームが表示されていないことを確認
        expect(screen.queryByLabelText(/view name/i)).not.toBeInTheDocument();
        expect(screen.queryByLabelText(/view color/i)).not.toBeInTheDocument();
      });

      it('保存後に編集フォームが閉じる', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        // 編集ボタンをクリック
        const editButtons = screen.getAllByLabelText(/edit view/i);
        fireEvent.click(editButtons[0]);

        // 編集フォームが表示されることを確認
        expect(screen.getByLabelText(/view name/i)).toBeInTheDocument();

        // 保存ボタンをクリック
        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        // 編集フォームが閉じることを確認
        expect(screen.queryByLabelText(/view name/i)).not.toBeInTheDocument();
      });

      it('キャンセル後に編集フォームが閉じる', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        // 編集ボタンをクリック
        const editButtons = screen.getAllByLabelText(/edit view/i);
        fireEvent.click(editButtons[0]);

        // 編集フォームが表示されることを確認
        expect(screen.getByLabelText(/view name/i)).toBeInTheDocument();

        // キャンセルボタンをクリック
        const cancelButton = screen.getByRole('button', { name: /cancel/i });
        fireEvent.click(cancelButton);

        // 編集フォームが閉じることを確認
        expect(screen.queryByLabelText(/view name/i)).not.toBeInTheDocument();
      });
    });
  });
});
