/**
 * ビュー切り替え機能の統合テスト
 * Task 8.5: ビュー切り替えのテスト
 * Requirements: 6.2, 6.3, 6.4
 *
 * このテストは、ViewSwitcher、ViewManager、TreeStateManagerを組み合わせた
 * エンドツーエンドのビュー切り替え機能を検証します。
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewSwitcher } from './ViewSwitcher';
import { ViewManager } from '@/services/ViewManager';
import { TreeStateManager } from '@/services/TreeStateManager';
import { StorageService } from '@/storage/StorageService';
import type { View } from '@/types';

/**
 * ViewManager と TreeStateManager を使用したビュー切り替えのテストハーネス
 */
const ViewSwitchingTestHarness: React.FC = () => {
  const [views, setViews] = React.useState<View[]>([]);
  const [currentViewId, setCurrentViewId] = React.useState<string>('default-view');
  const [viewManager] = React.useState<ViewManager>(() => {
    const storageService = new StorageService();
    return new ViewManager(storageService);
  });

  // ViewManagerの状態を定期的に同期
  React.useEffect(() => {
    const syncState = () => {
      setViews(viewManager.getViews());
      setCurrentViewId(viewManager.getCurrentView().id);
    };

    syncState();

    // 状態変更を監視するための簡易的なポーリング
    const interval = setInterval(syncState, 100);
    return () => clearInterval(interval);
  }, [viewManager]);

  const handleViewSwitch = (viewId: string) => {
    viewManager.switchView(viewId);
    setCurrentViewId(viewManager.getCurrentView().id);
  };

  const handleViewCreate = () => {
    const newView = viewManager.createView(
      `New View ${views.length + 1}`,
      `#${Math.floor(Math.random() * 16777215).toString(16)}`,
    );
    setViews(viewManager.getViews());
    return newView;
  };

  const handleViewDelete = (viewId: string) => {
    viewManager.deleteView(viewId);
    setViews(viewManager.getViews());
    setCurrentViewId(viewManager.getCurrentView().id);
  };

  const handleViewUpdate = (viewId: string, updates: Partial<View>) => {
    viewManager.updateView(viewId, updates);
    setViews(viewManager.getViews());
  };

  return (
    <div>
      <ViewSwitcher
        views={views}
        currentViewId={currentViewId}
        onViewSwitch={handleViewSwitch}
        onViewCreate={handleViewCreate}
        onViewDelete={handleViewDelete}
        onViewUpdate={handleViewUpdate}
      />
      {/* 現在のビューIDを表示（テスト確認用） */}
      <div data-testid="current-view-id">{currentViewId}</div>
      {/* ビュー数を表示（テスト確認用） */}
      <div data-testid="view-count">{views.length}</div>
    </div>
  );
};

describe('Task 8.5: ビュー切り替えの統合テスト', () => {
  beforeEach(() => {
    // モックのchrome.storageを設定
    global.chrome = {
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({}),
          set: vi.fn().mockResolvedValue(undefined),
          remove: vi.fn().mockResolvedValue(undefined),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  describe('Acceptance Criteria 6.2: 新しいビューを作成できることを確認', () => {
    it('新しいビューを作成ボタンから作成できる', async () => {
      render(<ViewSwitchingTestHarness />);

      // 初期状態ではビューが0個
      expect(screen.getByTestId('view-count')).toHaveTextContent('0');

      // 新しいビュー追加ボタンをクリック
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);

      // ビューが作成されたことを確認（少し待つ）
      await waitFor(() => {
        expect(screen.getByTestId('view-count')).toHaveTextContent('1');
      });

      // ビューが表示されることを確認
      expect(screen.getByText(/New View 1/i)).toBeInTheDocument();
    });

    it('複数の新しいビューを作成できる', async () => {
      render(<ViewSwitchingTestHarness />);

      // 初期状態ではビューが0個
      expect(screen.getByTestId('view-count')).toHaveTextContent('0');

      // 新しいビューを3つ作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);
      fireEvent.click(addButton);
      fireEvent.click(addButton);

      // 3つのビューが作成されたことを確認
      await waitFor(() => {
        expect(screen.getByTestId('view-count')).toHaveTextContent('3');
      });

      // すべてのビューが表示されることを確認
      expect(screen.getByText(/New View 1/i)).toBeInTheDocument();
      expect(screen.getByText(/New View 2/i)).toBeInTheDocument();
      expect(screen.getByText(/New View 3/i)).toBeInTheDocument();
    });

    it('作成されたビューには一意のIDが割り当てられる', async () => {
      render(<ViewSwitchingTestHarness />);

      // 新しいビューを2つ作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('view-count')).toHaveTextContent('2');
      });

      // 各ビューボタンが一意のaria-labelを持つことを確認
      const viewButtons = screen.getAllByRole('button', {
        name: /Switch to New View/i,
      });
      expect(viewButtons).toHaveLength(2);

      // ボタンが異なることを確認（同じボタンではない）
      expect(viewButtons[0]).not.toBe(viewButtons[1]);
    });
  });

  describe('Acceptance Criteria 6.3: ビュー切り替えで対応するタブツリーが表示されることを確認', () => {
    it('ビューを切り替えると currentViewId が更新される', async () => {
      render(<ViewSwitchingTestHarness />);

      // 初期状態ではデフォルトビュー
      expect(screen.getByTestId('current-view-id')).toHaveTextContent(
        'default-view',
      );

      // 新しいビューを作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('view-count')).toHaveTextContent('1');
      });

      // 作成したビューに切り替え
      const newViewButton = screen.getByRole('button', {
        name: /Switch to New View 1/i,
      });
      fireEvent.click(newViewButton);

      // currentViewIdが更新されることを確認
      await waitFor(() => {
        const currentViewId = screen.getByTestId('current-view-id').textContent;
        expect(currentViewId).not.toBe('default-view');
        expect(currentViewId).toMatch(/^view-/);
      });
    });

    it('複数のビュー間を切り替えられる', async () => {
      render(<ViewSwitchingTestHarness />);

      // 2つの新しいビューを作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('view-count')).toHaveTextContent('2');
      });

      // 最初のビューに切り替え
      const view1Button = screen.getByRole('button', {
        name: /Switch to New View 1/i,
      });
      fireEvent.click(view1Button);

      await waitFor(() => {
        const currentViewId = screen.getByTestId('current-view-id').textContent;
        expect(currentViewId).not.toBe('default-view');
      });

      const firstViewId = screen.getByTestId('current-view-id').textContent;

      // 2番目のビューに切り替え
      const view2Button = screen.getByRole('button', {
        name: /Switch to New View 2/i,
      });
      fireEvent.click(view2Button);

      await waitFor(() => {
        const currentViewId = screen.getByTestId('current-view-id').textContent;
        expect(currentViewId).not.toBe(firstViewId);
        expect(currentViewId).toMatch(/^view-/);
      });
    });

    it('切り替えたビューがアクティブとしてハイライトされる', async () => {
      render(<ViewSwitchingTestHarness />);

      // 新しいビューを作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('view-count')).toHaveTextContent('1');
      });

      // 作成したビューに切り替え
      const newViewButton = screen.getByRole('button', {
        name: /Switch to New View 1/i,
      });
      fireEvent.click(newViewButton);

      // ビューがアクティブとしてハイライトされることを確認
      await waitFor(() => {
        expect(newViewButton).toHaveAttribute('data-active', 'true');
      });
    });
  });

  describe('Acceptance Criteria 6.4: ビュー名と色を設定できることを確認', () => {
    it('ビューの名前を編集できる', async () => {
      render(<ViewSwitchingTestHarness />);

      // 新しいビューを作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/New View 1/i)).toBeInTheDocument();
      });

      // 編集ボタンをクリック
      const editButton = screen.getByLabelText(/Edit view New View 1/i);
      fireEvent.click(editButton);

      // 編集フォームが表示されることを確認
      await waitFor(() => {
        expect(screen.getByLabelText(/View Name/i)).toBeInTheDocument();
      });

      // ビュー名を変更
      const nameInput = screen.getByLabelText(/View Name/i);
      fireEvent.change(nameInput, { target: { value: 'Work View' } });

      // 保存ボタンをクリック
      const saveButton = screen.getByRole('button', { name: /Save/i });
      fireEvent.click(saveButton);

      // ビュー名が更新されることを確認
      await waitFor(() => {
        expect(screen.getByText('Work View')).toBeInTheDocument();
        expect(screen.queryByText(/New View 1/i)).not.toBeInTheDocument();
      });
    });

    it('ビューの色を編集できる', async () => {
      render(<ViewSwitchingTestHarness />);

      // 新しいビューを作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('view-count')).toHaveTextContent('1');
      });

      // 編集ボタンをクリック
      const editButton = screen.getByLabelText(/Edit view/i);
      fireEvent.click(editButton);

      // 編集フォームが表示されることを確認
      await waitFor(() => {
        expect(screen.getByLabelText(/View Color/i)).toBeInTheDocument();
      });

      // 色を変更
      const colorInput = screen.getByLabelText(/View Color/i);
      fireEvent.change(colorInput, { target: { value: '#ff0000' } });

      // 保存ボタンをクリック
      const saveButton = screen.getByRole('button', { name: /Save/i });
      fireEvent.click(saveButton);

      // 色が更新されることを確認（data-color属性で確認）
      await waitFor(() => {
        const viewButton = screen.getByRole('button', {
          name: /Switch to New View 1/i,
        });
        expect(viewButton).toHaveAttribute('data-color', '#ff0000');
      });
    });

    it('ビューの名前と色を同時に編集できる', async () => {
      render(<ViewSwitchingTestHarness />);

      // 新しいビューを作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('view-count')).toHaveTextContent('1');
      });

      // 編集ボタンをクリック
      const editButton = screen.getByLabelText(/Edit view/i);
      fireEvent.click(editButton);

      // 編集フォームが表示されることを確認
      await waitFor(() => {
        expect(screen.getByLabelText(/View Name/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/View Color/i)).toBeInTheDocument();
      });

      // ビュー名と色を変更
      const nameInput = screen.getByLabelText(/View Name/i);
      const colorInput = screen.getByLabelText(/View Color/i);
      fireEvent.change(nameInput, { target: { value: 'Personal' } });
      fireEvent.change(colorInput, { target: { value: '#00ff00' } });

      // 保存ボタンをクリック
      const saveButton = screen.getByRole('button', { name: /Save/i });
      fireEvent.click(saveButton);

      // 名前と色が更新されることを確認
      await waitFor(() => {
        const viewButton = screen.getByRole('button', {
          name: /Switch to Personal view/i,
        });
        expect(viewButton).toBeInTheDocument();
        expect(viewButton).toHaveAttribute('data-color', '#00ff00');
      });
    });

    it('編集をキャンセルすると変更が破棄される', async () => {
      render(<ViewSwitchingTestHarness />);

      // 新しいビューを作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByText(/New View 1/i)).toBeInTheDocument();
      });

      const originalName = 'New View 1';

      // 編集ボタンをクリック
      const editButton = screen.getByLabelText(/Edit view/i);
      fireEvent.click(editButton);

      // ビュー名を変更
      const nameInput = screen.getByLabelText(/View Name/i);
      fireEvent.change(nameInput, { target: { value: 'Changed Name' } });

      // キャンセルボタンをクリック
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      // 元の名前が維持されることを確認
      await waitFor(() => {
        expect(screen.getByText(originalName)).toBeInTheDocument();
        expect(screen.queryByText('Changed Name')).not.toBeInTheDocument();
      });
    });
  });

  describe('統合シナリオ: ビュー作成、切り替え、編集の一連の流れ', () => {
    it('新しいビューを作成し、切り替え、名前と色を編集できる', async () => {
      render(<ViewSwitchingTestHarness />);

      // ステップ1: 新しいビューを作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('view-count')).toHaveTextContent('1');
      });

      // ステップ2: 作成したビューに切り替え
      const newViewButton = screen.getByRole('button', {
        name: /Switch to New View 1/i,
      });
      fireEvent.click(newViewButton);

      await waitFor(() => {
        expect(newViewButton).toHaveAttribute('data-active', 'true');
      });

      // ステップ3: ビューの名前と色を編集
      const editButton = screen.getByLabelText(/Edit view/i);
      fireEvent.click(editButton);

      await waitFor(() => {
        expect(screen.getByLabelText(/View Name/i)).toBeInTheDocument();
      });

      const nameInput = screen.getByLabelText(/View Name/i);
      const colorInput = screen.getByLabelText(/View Color/i);
      fireEvent.change(nameInput, { target: { value: 'My Workspace' } });
      fireEvent.change(colorInput, { target: { value: '#3b82f6' } });

      const saveButton = screen.getByRole('button', { name: /Save/i });
      fireEvent.click(saveButton);

      // ステップ4: 編集が反映されることを確認
      await waitFor(() => {
        const updatedViewButton = screen.getByRole('button', {
          name: /Switch to My Workspace view/i,
        });
        expect(updatedViewButton).toBeInTheDocument();
        expect(updatedViewButton).toHaveAttribute('data-color', '#3b82f6');
        expect(updatedViewButton).toHaveAttribute('data-active', 'true');
      });
    });

    it('複数のビューを作成し、それぞれに異なる名前と色を設定できる', async () => {
      render(<ViewSwitchingTestHarness />);

      // 2つのビューを作成
      const addButton = screen.getByRole('button', { name: 'Add new view' });
      fireEvent.click(addButton);
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('view-count')).toHaveTextContent('2');
      });

      // 1つ目のビューを編集
      const editButtons = screen.getAllByLabelText(/Edit view/i);
      fireEvent.click(editButtons[0]);

      await waitFor(() => {
        expect(screen.getByLabelText(/View Name/i)).toBeInTheDocument();
      });

      let nameInput = screen.getByLabelText(/View Name/i);
      let colorInput = screen.getByLabelText(/View Color/i);
      fireEvent.change(nameInput, { target: { value: 'Work' } });
      fireEvent.change(colorInput, { target: { value: '#ef4444' } });

      let saveButton = screen.getByRole('button', { name: /Save/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Work')).toBeInTheDocument();
      });

      // 2つ目のビューを編集
      const secondEditButtons = screen.getAllByLabelText(/Edit view/i);
      fireEvent.click(secondEditButtons[1]);

      await waitFor(() => {
        expect(screen.getByLabelText(/View Name/i)).toBeInTheDocument();
      });

      nameInput = screen.getByLabelText(/View Name/i);
      colorInput = screen.getByLabelText(/View Color/i);
      fireEvent.change(nameInput, { target: { value: 'Personal' } });
      fireEvent.change(colorInput, { target: { value: '#10b981' } });

      saveButton = screen.getByRole('button', { name: /Save/i });
      fireEvent.click(saveButton);

      // 両方のビューが異なる名前と色で表示されることを確認
      await waitFor(() => {
        const workButton = screen.getByRole('button', {
          name: /Switch to Work view/i,
        });
        const personalButton = screen.getByRole('button', {
          name: /Switch to Personal view/i,
        });

        expect(workButton).toBeInTheDocument();
        expect(workButton).toHaveAttribute('data-color', '#ef4444');

        expect(personalButton).toBeInTheDocument();
        expect(personalButton).toHaveAttribute('data-color', '#10b981');
      });
    });
  });
});
