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
import { StorageService } from '@/storage/StorageService';
import type { View } from '@/types';
import type { MockChrome, MockStorageLocal, MockStorage } from '@/test/test-types';

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
    const mockStorageLocal: MockStorageLocal = {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    const mockStorage: MockStorage = {
      local: mockStorageLocal,
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    };

    const mockChrome: Partial<MockChrome> = {
      storage: mockStorage,
    };

    global.chrome = mockChrome as unknown as typeof chrome;
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

      // Task 7.1: ビューがファビコンサイズアイコンボタンとして表示されることを確認
      // ビュー名はaria-labelで確認（テキスト表示はなくなった）
      expect(screen.getByRole('button', { name: /Switch to New View 1/i })).toBeInTheDocument();
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

      // Task 7.1: すべてのビューがファビコンサイズアイコンボタンとして表示されることを確認
      // ビュー名はaria-labelで確認（テキスト表示はなくなった）
      expect(screen.getByRole('button', { name: /Switch to New View 1/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Switch to New View 2/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Switch to New View 3/i })).toBeInTheDocument();
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

});
