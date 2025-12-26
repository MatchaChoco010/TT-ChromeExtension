import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewManager } from './ViewManager';
import type { IStorageService, View } from '@/types';
import type { TreeStateManager } from './TreeStateManager';

/**
 * ViewManager のユニットテスト
 * Task 8.1: ViewManager サービスの実装
 * Requirements: 6.1, 6.2, 6.5
 */
describe('ViewManager', () => {
  let viewManager: ViewManager;
  let mockStorageService: IStorageService;
  let mockTreeStateManager: Partial<TreeStateManager>;

  beforeEach(() => {
    // モックのストレージサービスを作成
    mockStorageService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      onChange: vi.fn().mockReturnValue(() => {}),
    };

    // モックのTreeStateManagerを作成
    mockTreeStateManager = {
      getTree: vi.fn().mockReturnValue([]),
      moveSubtreeToView: vi.fn().mockResolvedValue(undefined),
    };

    viewManager = new ViewManager(mockStorageService);
    viewManager.setTreeStateManager(mockTreeStateManager as TreeStateManager);
  });

  describe('createView', () => {
    it('新しいビューを作成できる', () => {
      // Requirement 6.2: 新しいビューを作成する
      const view = viewManager.createView('Work', '#ff0000');

      expect(view).toBeDefined();
      expect(view.name).toBe('Work');
      expect(view.color).toBe('#ff0000');
      expect(view.id).toBeTruthy();
    });

    it('作成されたビューがビューリストに追加される', () => {
      const view1 = viewManager.createView('Work', '#ff0000');
      const view2 = viewManager.createView('Personal', '#00ff00');

      const views = viewManager.getViews();
      expect(views).toHaveLength(2);
      expect(views).toContainEqual(view1);
      expect(views).toContainEqual(view2);
    });

    it('ビュー作成時にストレージに永続化される', async () => {
      viewManager.createView('Work', '#ff0000');

      // 非同期処理が完了するまで待機
      await new Promise(resolve => setTimeout(resolve, 10));

      // ストレージのsetが呼ばれることを確認
      expect(mockStorageService.set).toHaveBeenCalled();
    });

    it('カスタムアイコンURLを指定してビューを作成できる', () => {
      const view = viewManager.createView('Work', '#ff0000', 'https://example.com/icon.png');

      expect(view.icon).toBe('https://example.com/icon.png');
    });
  });

  describe('getViews', () => {
    it('空のビューリストを取得できる', () => {
      const views = viewManager.getViews();
      expect(views).toEqual([]);
    });

    it('すべてのビューを取得できる', () => {
      viewManager.createView('Work', '#ff0000');
      viewManager.createView('Personal', '#00ff00');

      const views = viewManager.getViews();
      expect(views).toHaveLength(2);
    });
  });

  describe('getCurrentView', () => {
    it('初期状態ではデフォルトビューが返される', () => {
      const currentView = viewManager.getCurrentView();
      expect(currentView).toBeDefined();
      expect(currentView.id).toBe('default-view');
    });

    it('ビューを切り替えた後は切り替えたビューが返される', () => {
      const view = viewManager.createView('Work', '#ff0000');
      viewManager.switchView(view.id);

      const currentView = viewManager.getCurrentView();
      expect(currentView.id).toBe(view.id);
    });
  });

  describe('switchView', () => {
    it('ビューを切り替えられる', () => {
      // Requirement 6.3: ビュー切り替えUIを操作する
      const view1 = viewManager.createView('Work', '#ff0000');
      const view2 = viewManager.createView('Personal', '#00ff00');

      viewManager.switchView(view1.id);
      expect(viewManager.getCurrentView().id).toBe(view1.id);

      viewManager.switchView(view2.id);
      expect(viewManager.getCurrentView().id).toBe(view2.id);
    });

    it('存在しないビューIDを指定した場合はエラーをスローしない（現在のビューを維持）', () => {
      const view = viewManager.createView('Work', '#ff0000');
      viewManager.switchView(view.id);

      const beforeSwitch = viewManager.getCurrentView();

      // 存在しないビューIDで切り替えを試みる
      viewManager.switchView('non-existent-view-id');

      // 現在のビューは変更されない
      expect(viewManager.getCurrentView().id).toBe(beforeSwitch.id);
    });

    it('ビュー切り替え時にストレージに永続化される', async () => {
      const view = viewManager.createView('Work', '#ff0000');

      viewManager.switchView(view.id);

      // 非同期処理が完了するまで待機
      await new Promise(resolve => setTimeout(resolve, 10));

      // ストレージのsetが呼ばれることを確認
      expect(mockStorageService.set).toHaveBeenCalled();
    });
  });

  describe('deleteView', () => {
    it('ビューを削除できる', () => {
      const view = viewManager.createView('Work', '#ff0000');
      expect(viewManager.getViews()).toHaveLength(1);

      viewManager.deleteView(view.id);
      expect(viewManager.getViews()).toHaveLength(0);
    });

    it('デフォルトビューは削除できない', () => {
      const viewsBefore = viewManager.getViews();

      viewManager.deleteView('default-view');

      const viewsAfter = viewManager.getViews();
      expect(viewsAfter.length).toBe(viewsBefore.length);
    });

    it('削除されたビューがカレントビューだった場合、デフォルトビューに切り替わる', () => {
      const view = viewManager.createView('Work', '#ff0000');
      viewManager.switchView(view.id);

      expect(viewManager.getCurrentView().id).toBe(view.id);

      viewManager.deleteView(view.id);

      expect(viewManager.getCurrentView().id).toBe('default-view');
    });

    it('ビュー削除時にストレージに永続化される', async () => {
      const view = viewManager.createView('Work', '#ff0000');

      viewManager.deleteView(view.id);

      // 非同期処理が完了するまで待機
      await new Promise(resolve => setTimeout(resolve, 10));

      // ストレージのsetが呼ばれることを確認
      expect(mockStorageService.set).toHaveBeenCalled();
    });
  });

  describe('updateView', () => {
    it('ビューの名前を更新できる', () => {
      const view = viewManager.createView('Work', '#ff0000');

      viewManager.updateView(view.id, { name: 'Updated Work' });

      const updatedView = viewManager.getViews().find(v => v.id === view.id);
      expect(updatedView?.name).toBe('Updated Work');
    });

    it('ビューの色を更新できる', () => {
      const view = viewManager.createView('Work', '#ff0000');

      viewManager.updateView(view.id, { color: '#0000ff' });

      const updatedView = viewManager.getViews().find(v => v.id === view.id);
      expect(updatedView?.color).toBe('#0000ff');
    });

    it('ビューのアイコンを更新できる', () => {
      const view = viewManager.createView('Work', '#ff0000');

      viewManager.updateView(view.id, { icon: 'https://example.com/new-icon.png' });

      const updatedView = viewManager.getViews().find(v => v.id === view.id);
      expect(updatedView?.icon).toBe('https://example.com/new-icon.png');
    });

    it('ビュー更新時にストレージに永続化される', async () => {
      const view = viewManager.createView('Work', '#ff0000');

      viewManager.updateView(view.id, { name: 'Updated Work' });

      // 非同期処理が完了するまで待機
      await new Promise(resolve => setTimeout(resolve, 10));

      // ストレージのsetが呼ばれることを確認
      expect(mockStorageService.set).toHaveBeenCalled();
    });

    it('存在しないビューIDを指定した場合は何も変更されない', () => {
      const view = viewManager.createView('Work', '#ff0000');
      const viewsBefore = [...viewManager.getViews()];

      viewManager.updateView('non-existent-view-id', { name: 'Should not update' });

      const viewsAfter = viewManager.getViews();
      expect(viewsAfter).toEqual(viewsBefore);
    });
  });

  describe('loadState', () => {
    it('ストレージから状態を復元できる', async () => {
      const mockViews: View[] = [
        { id: 'view-1', name: 'Work', color: '#ff0000' },
        { id: 'view-2', name: 'Personal', color: '#00ff00' },
      ];

      mockStorageService.get = vi.fn().mockResolvedValue({
        views: mockViews,
        currentViewId: 'view-1',
        nodes: {},
        tabToNode: {},
      });

      await viewManager.loadState();

      const views = viewManager.getViews();
      expect(views).toHaveLength(2);
      expect(viewManager.getCurrentView().id).toBe('view-1');
    });

    it('ストレージにデータがない場合はデフォルト状態を維持', async () => {
      mockStorageService.get = vi.fn().mockResolvedValue(null);

      await viewManager.loadState();

      const currentView = viewManager.getCurrentView();
      expect(currentView.id).toBe('default-view');
    });
  });

  describe('moveTabToView', () => {
    // Task 8.4: ビュー間のタブ移動
    // Requirement 6.5: ユーザーがタブを別のビューに移動する
    it('タブを別のビューに移動できる', async () => {
      const view1 = viewManager.createView('Work', '#ff0000');
      const view2 = viewManager.createView('Personal', '#00ff00');

      // moveTabToView メソッドを呼び出す
      await viewManager.moveTabToView(1, view1.id, view2.id);

      // TreeStateManager.moveSubtreeToView が呼ばれることを確認
      expect(mockTreeStateManager.moveSubtreeToView).toHaveBeenCalledWith(1, view2.id);
    });

    it('移動元と移動先が同じ場合は何もしない', async () => {
      const view = viewManager.createView('Work', '#ff0000');

      await viewManager.moveTabToView(1, view.id, view.id);

      // TreeStateManager.moveSubtreeToView が呼ばれないことを確認
      expect(mockTreeStateManager.moveSubtreeToView).not.toHaveBeenCalled();
    });

    it('存在しないビューIDを指定した場合は何もしない', async () => {
      const view = viewManager.createView('Work', '#ff0000');

      // 存在しないビューIDで移動を試みる
      await viewManager.moveTabToView(1, view.id, 'non-existent-view-id');

      // TreeStateManager.moveSubtreeToView が呼ばれないことを確認
      expect(mockTreeStateManager.moveSubtreeToView).not.toHaveBeenCalled();
    });
  });

  describe('getTabsByView', () => {
    it('指定されたビューのタブを取得できる', () => {
      const view = viewManager.createView('Work', '#ff0000');

      viewManager.getTabsByView(view.id);

      // TreeStateManager.getTree が呼ばれることを確認
      expect(mockTreeStateManager.getTree).toHaveBeenCalledWith(view.id);
    });
  });
});
