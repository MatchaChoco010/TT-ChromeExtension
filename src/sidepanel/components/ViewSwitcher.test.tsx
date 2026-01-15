import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

      expect(screen.getByRole('button', { name: 'Switch to Work view' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Switch to Personal view' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Switch to Research view' })).toBeInTheDocument();
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

      const workButton = screen.getByRole('button', {
        name: 'Switch to Work view',
      });

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

      const personalButton = screen.getByRole('button', {
        name: 'Switch to Personal view',
      });
      const researchButton = screen.getByRole('button', {
        name: 'Switch to Research view',
      });

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

      const personalButton = screen.getByRole('button', {
        name: 'Switch to Personal view',
      });
      fireEvent.click(personalButton);

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

      const workButton = screen.getByRole('button', {
        name: 'Switch to Work view',
      });
      fireEvent.click(workButton);

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

      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);

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

      const viewSwitcherContainer = container.querySelector('[data-testid="view-switcher-container"]');
      expect(viewSwitcherContainer).toBeInTheDocument();

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

      manyViews.forEach((view) => {
        const button = screen.getByRole('button', { name: `Switch to ${view.name} view` });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('title', view.name);
      });
    });
  });

  describe('ビュー切り替えUIを操作する', () => {
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

      const researchButton = screen.getByRole('button', {
        name: 'Switch to Research view',
      });
      fireEvent.click(researchButton);

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

  describe('ファビコンサイズアイコンボタンへの改修', () => {
    describe('ファビコンサイズのボタンでビュー切り替え', () => {
      it('各ビューがファビコンサイズのアイコンボタンとして表示される', () => {
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

        const viewButtons = screen.getAllByRole('button', { name: /switch to .* view/i });
        expect(viewButtons.length).toBe(mockViews.length);

        viewButtons.forEach((button) => {
          expect(button).toHaveClass('w-8', 'h-8');
        });
      });

      it('アイコンが設定されていないビューはカラーサークルを表示する', () => {
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

        const colorCircles = document.querySelectorAll('[data-testid="view-color-circle"]');
        expect(colorCircles.length).toBe(mockViews.length);
      });

      it('アイコンURLが設定されているビューはアイコン画像を表示する', () => {
        const viewsWithIcon: View[] = [
          { id: 'view-1', name: 'Work', color: '#ef4444', icon: 'https://example.com/icon.png' },
          { id: 'view-2', name: 'Personal', color: '#3b82f6' },
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

        const iconImage = screen.getByRole('img', { name: /work/i });
        expect(iconImage).toBeInTheDocument();
        expect(iconImage).toHaveAttribute('src', 'https://example.com/icon.png');

        const allColorCircles = document.querySelectorAll('[data-testid="view-color-circle"]');
        const visibleColorCircles = Array.from(allColorCircles).filter(
          (circle) => !circle.classList.contains('hidden')
        );
        expect(visibleColorCircles.length).toBe(1);
      });
    });

    describe('ビューごとにファビコンサイズのアイコンを設定可能', () => {
      it('アイコン付きビューとアイコンなしビューが混在する場合、それぞれ適切に表示される', () => {
        const mixedViews: View[] = [
          { id: 'view-1', name: 'With Icon', color: '#ef4444', icon: 'https://example.com/icon1.png' },
          { id: 'view-2', name: 'No Icon', color: '#3b82f6' },
          { id: 'view-3', name: 'Another Icon', color: '#10b981', icon: 'https://example.com/icon2.png' },
        ];

        render(
          <ViewSwitcher
            views={mixedViews}
            currentViewId="view-1"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const iconImages = screen.getAllByRole('img');
        expect(iconImages.length).toBe(2);

        const allColorCircles = document.querySelectorAll('[data-testid="view-color-circle"]');
        const visibleColorCircles = Array.from(allColorCircles).filter(
          (circle) => !circle.classList.contains('hidden')
        );
        expect(visibleColorCircles.length).toBe(1);
      });
    });

    describe('鉛筆ボタンによる編集UIを削除', () => {
      it('鉛筆ボタン(編集ボタン)が表示されない', () => {
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

        const editButtons = screen.queryAllByLabelText(/edit view/i);
        expect(editButtons.length).toBe(0);
      });

      it('インライン編集フォームが表示されない', () => {
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

        expect(screen.queryByTestId('view-edit-form')).not.toBeInTheDocument();
      });
    });

    describe('アクティブビューの視覚的フィードバック', () => {
      it('アクティブなビューボタンには視覚的な区別がある', () => {
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

        const activeButton = screen.getByRole('button', { name: /switch to work view/i });
        expect(activeButton).toHaveAttribute('data-active', 'true');
        expect(activeButton).toHaveClass('ring-2');
      });
    });

    describe('ツールチップ表示', () => {
      it('各ビューボタンにはビュー名を示すtitle属性がある', () => {
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

        const workButton = screen.getByRole('button', { name: /switch to work view/i });
        expect(workButton).toHaveAttribute('title', 'Work');
      });
    });
  });

  describe('ビューボタンの右クリックコンテキストメニュー', () => {
    describe('右クリックでコンテキストメニュー表示', () => {
      it('ビューボタンを右クリックするとコンテキストメニューが表示される', () => {
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

        const workButton = screen.getByRole('button', { name: /switch to work view/i });
        fireEvent.contextMenu(workButton);

        expect(screen.getByTestId('view-context-menu')).toBeInTheDocument();
      });

      it('コンテキストメニューに「ビューの編集」オプションが表示される', () => {
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

        const workButton = screen.getByRole('button', { name: /switch to work view/i });
        fireEvent.contextMenu(workButton);

        expect(screen.getByRole('menuitem', { name: /ビューを編集/i })).toBeInTheDocument();
      });

      it('コンテキストメニューに「ビューの削除」オプションが表示される', () => {
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

        const workButton = screen.getByRole('button', { name: /switch to work view/i });
        fireEvent.contextMenu(workButton);

        expect(screen.getByRole('menuitem', { name: /ビューを削除/i })).toBeInTheDocument();
      });
    });

    describe('ビューの編集モーダルを開く', () => {
      it('「ビューの編集」をクリックするとモーダルが表示される', () => {
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

        const workButton = screen.getByRole('button', { name: /switch to work view/i });
        fireEvent.contextMenu(workButton);

        const editMenuItem = screen.getByRole('menuitem', { name: /ビューを編集/i });
        fireEvent.click(editMenuItem);

        expect(screen.getByTestId('view-edit-modal')).toBeInTheDocument();
      });

      it('モーダルで保存すると onViewUpdate が呼ばれる', async () => {
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

        const workButton = screen.getByRole('button', { name: /switch to work view/i });
        fireEvent.contextMenu(workButton);

        const editMenuItem = screen.getByRole('menuitem', { name: /ビューを編集/i });
        fireEvent.click(editMenuItem);

        await waitFor(() => {
          expect(screen.getByLabelText('View Name')).toHaveValue('Work');
        });

        const saveButton = screen.getByRole('button', { name: /save/i });
        fireEvent.click(saveButton);

        expect(mockOnViewUpdate).toHaveBeenCalled();
      });
    });

    describe('ビューの削除', () => {
      it('「ビューの削除」をクリックすると onViewDelete が呼ばれる', () => {
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

        const workButton = screen.getByRole('button', { name: /switch to work view/i });
        fireEvent.contextMenu(workButton);

        const deleteMenuItem = screen.getByRole('menuitem', { name: /ビューを削除/i });
        fireEvent.click(deleteMenuItem);

        expect(mockOnViewDelete).toHaveBeenCalledWith('view-1');
      });

      it('ビューが1つだけの場合、削除オプションは無効になる', () => {
        const singleView: View[] = [{ id: 'view-1', name: 'Work', color: '#ef4444' }];

        render(
          <ViewSwitcher
            views={singleView}
            currentViewId="view-1"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const workButton = screen.getByRole('button', { name: /switch to work view/i });
        fireEvent.contextMenu(workButton);

        const deleteMenuItem = screen.getByRole('menuitem', { name: /ビューを削除/i });
        expect(deleteMenuItem).toBeDisabled();
      });
    });

    describe('コンテキストメニューのクローズ動作', () => {
      it('メニュー外をクリックするとコンテキストメニューが閉じる', async () => {
        const { container } = render(
          <div>
            <div data-testid="outside">Outside</div>
            <ViewSwitcher
              views={mockViews}
              currentViewId={mockCurrentViewId}
              onViewSwitch={mockOnViewSwitch}
              onViewCreate={mockOnViewCreate}
              onViewDelete={mockOnViewDelete}
              onViewUpdate={mockOnViewUpdate}
            />
          </div>
        );

        const workButton = screen.getByRole('button', { name: /switch to work view/i });
        fireEvent.contextMenu(workButton);

        expect(screen.getByTestId('view-context-menu')).toBeInTheDocument();

        await new Promise((resolve) => setTimeout(resolve, 10));

        const outsideElement = container.querySelector('[data-testid="outside"]');
        fireEvent.mouseDown(outsideElement!);

        expect(screen.queryByTestId('view-context-menu')).not.toBeInTheDocument();
      });

      it('Escapeキーを押すとコンテキストメニューが閉じる', () => {
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

        const workButton = screen.getByRole('button', { name: /switch to work view/i });
        fireEvent.contextMenu(workButton);

        expect(screen.getByTestId('view-context-menu')).toBeInTheDocument();

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(screen.queryByTestId('view-context-menu')).not.toBeInTheDocument();
      });
    });
  });

  describe('ビューのタブ数表示機能', () => {
    describe('各ビューのファビコン上にタブ数を小さく表示', () => {
      it('タブ数バッジが各ビューに表示される', () => {
        const tabCounts = {
          'view-1': 5,
          'view-2': 3,
          'view-3': 10,
        };

        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            tabCounts={tabCounts}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        expect(screen.getByTestId('tab-count-badge-view-1')).toHaveTextContent('5');
        expect(screen.getByTestId('tab-count-badge-view-2')).toHaveTextContent('3');
        expect(screen.getByTestId('tab-count-badge-view-3')).toHaveTextContent('10');
      });

      it('タブ数が0の場合はバッジを表示しない', () => {
        const tabCounts = {
          'view-1': 0,
          'view-2': 5,
          'view-3': 0,
        };

        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            tabCounts={tabCounts}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        expect(screen.queryByTestId('tab-count-badge-view-1')).not.toBeInTheDocument();
        expect(screen.getByTestId('tab-count-badge-view-2')).toHaveTextContent('5');
        expect(screen.queryByTestId('tab-count-badge-view-3')).not.toBeInTheDocument();
      });
    });

    describe('ファビコンのサイズを維持したままタブ数を表示', () => {
      it('ビューボタンのサイズは変わらない (w-8, h-8)', () => {
        const tabCounts = {
          'view-1': 100,
          'view-2': 999,
          'view-3': 1,
        };

        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            tabCounts={tabCounts}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const viewButtons = screen.getAllByRole('button', { name: /switch to .* view/i });
        viewButtons.forEach((button) => {
          expect(button).toHaveClass('w-8', 'h-8');
        });
      });

      it('タブ数バッジは小さく表示される', () => {
        const tabCounts = {
          'view-1': 5,
          'view-2': 3,
          'view-3': 10,
        };

        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            tabCounts={tabCounts}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const badge = screen.getByTestId('tab-count-badge-view-1');
        expect(badge).toHaveClass('text-xs');
      });
    });

    describe('ビュー内のタブ数が変化した場合、表示を即座に更新', () => {
      it('タブ数プロップが変更されると表示が更新される', () => {
        const initialTabCounts = {
          'view-1': 5,
          'view-2': 3,
          'view-3': 10,
        };

        const { rerender } = render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            tabCounts={initialTabCounts}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        expect(screen.getByTestId('tab-count-badge-view-1')).toHaveTextContent('5');

        const updatedTabCounts = {
          'view-1': 8,
          'view-2': 3,
          'view-3': 10,
        };

        rerender(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            tabCounts={updatedTabCounts}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        expect(screen.getByTestId('tab-count-badge-view-1')).toHaveTextContent('8');
      });
    });

    describe('tabCountsが未定義の場合', () => {
      it('tabCountsが未定義でもクラッシュしない', () => {
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

        expect(screen.getByRole('button', { name: 'Switch to Work view' })).toBeInTheDocument();
        expect(screen.queryByTestId('tab-count-badge-view-1')).not.toBeInTheDocument();
      });
    });

    describe('タブ数バッジの視認性向上', () => {
      it('タブ数バッジはmin-w-[20px]で数字が見切れない', () => {
        const tabCounts = {
          'view-1': 99,
          'view-2': 3,
          'view-3': 100,
        };

        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            tabCounts={tabCounts}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const badge = screen.getByTestId('tab-count-badge-view-1');
        expect(badge).toHaveClass('min-w-[20px]');
      });

      it('タブ数バッジは右上角ではなく内側に配置される', () => {
        const tabCounts = {
          'view-1': 5,
        };

        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId={mockCurrentViewId}
            tabCounts={tabCounts}
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const badge = screen.getByTestId('tab-count-badge-view-1');
        expect(badge).toHaveClass('-top-0.5');
        expect(badge).toHaveClass('-right-0.5');
      });
    });
  });

  describe('ビューのスクロール切り替え機能', () => {
    describe('マウスホイール上スクロールで前のビューに切り替え', () => {
      it('ビューリスト上でマウスホイールを上にスクロールすると前のビューに切り替わる', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId="view-2"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const container = screen.getByTestId('view-switcher-container');

        fireEvent.wheel(container, { deltaY: -100 });

        expect(mockOnViewSwitch).toHaveBeenCalledWith('view-1');
        expect(mockOnViewSwitch).toHaveBeenCalledTimes(1);
      });
    });

    describe('マウスホイール下スクロールで次のビューに切り替え', () => {
      it('ビューリスト上でマウスホイールを下にスクロールすると次のビューに切り替わる', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId="view-2"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const container = screen.getByTestId('view-switcher-container');

        fireEvent.wheel(container, { deltaY: 100 });

        expect(mockOnViewSwitch).toHaveBeenCalledWith('view-3');
        expect(mockOnViewSwitch).toHaveBeenCalledTimes(1);
      });
    });

    describe('最初/最後のビューでループせずに停止', () => {
      it('最初のビューで上スクロールしても切り替わらない', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId="view-1"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const container = screen.getByTestId('view-switcher-container');

        fireEvent.wheel(container, { deltaY: -100 });

        expect(mockOnViewSwitch).not.toHaveBeenCalled();
      });

      it('最後のビューで下スクロールしても切り替わらない', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId="view-3"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const container = screen.getByTestId('view-switcher-container');

        fireEvent.wheel(container, { deltaY: 100 });

        expect(mockOnViewSwitch).not.toHaveBeenCalled();
      });
    });

    describe('スクロール切り替えの連続操作', () => {
      it('連続したスクロール操作が正しく処理される', () => {
        const { rerender } = render(
          <ViewSwitcher
            views={mockViews}
            currentViewId="view-1"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const container = screen.getByTestId('view-switcher-container');

        fireEvent.wheel(container, { deltaY: 100 });
        expect(mockOnViewSwitch).toHaveBeenCalledWith('view-2');

        rerender(
          <ViewSwitcher
            views={mockViews}
            currentViewId="view-2"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        fireEvent.wheel(container, { deltaY: 100 });
        expect(mockOnViewSwitch).toHaveBeenCalledWith('view-3');
      });
    });

    describe('ビューが1つだけの場合', () => {
      it('ビューが1つだけの場合はスクロールしても切り替わらない', () => {
        const singleView: View[] = [{ id: 'view-1', name: 'Work', color: '#ef4444' }];

        render(
          <ViewSwitcher
            views={singleView}
            currentViewId="view-1"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const container = screen.getByTestId('view-switcher-container');

        fireEvent.wheel(container, { deltaY: -100 });
        expect(mockOnViewSwitch).not.toHaveBeenCalled();

        fireEvent.wheel(container, { deltaY: 100 });
        expect(mockOnViewSwitch).not.toHaveBeenCalled();
      });
    });

    describe('スクロール方向のdeltaYしきい値', () => {
      it('deltaYが0の場合は切り替わらない', () => {
        render(
          <ViewSwitcher
            views={mockViews}
            currentViewId="view-2"
            onViewSwitch={mockOnViewSwitch}
            onViewCreate={mockOnViewCreate}
            onViewDelete={mockOnViewDelete}
            onViewUpdate={mockOnViewUpdate}
          />
        );

        const container = screen.getByTestId('view-switcher-container');

        fireEvent.wheel(container, { deltaY: 0 });
        expect(mockOnViewSwitch).not.toHaveBeenCalled();
      });
    });
  });
});
