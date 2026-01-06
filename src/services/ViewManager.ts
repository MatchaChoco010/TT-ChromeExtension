import type { View, IStorageService, TabNode, TreeState } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';
import type { TreeStateManager } from './TreeStateManager';

/**
 * ViewManager
 *
 * 複数ビュー（仮想ワークスペース）の管理を担当するサービス
 *
 * 重要: タブは物理的に閉じず、各タブに viewId メタデータを付与して管理
 * UIレイヤーでは currentViewId に一致するタブのみを表示（フィルタリング）
 */
export class ViewManager {
  private views: Map<string, View> = new Map();
  private currentViewId: string = 'default-view';
  private treeStateManager: TreeStateManager | null = null;

  private readonly defaultView: View = {
    id: 'default-view',
    name: 'Default',
    color: '#6b7280', // Tailwind gray-500
  };

  constructor(private storageService: IStorageService) {
    this.views.set(this.defaultView.id, this.defaultView);
  }

  /**
   * TreeStateManagerへの参照を設定
   * 依存性注入のために使用
   *
   * @param treeStateManager - TreeStateManagerのインスタンス
   */
  setTreeStateManager(treeStateManager: TreeStateManager): void {
    this.treeStateManager = treeStateManager;
  }

  /**
   * 新しいビューを作成
   *
   * @param name - ビュー名
   * @param color - ビューの色（例: #ff0000）
   * @param icon - カスタムアイコンURL（オプション）
   * @returns 作成されたビュー
   */
  createView(name: string, color: string, icon?: string): View {
    const viewId = `view-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newView: View = {
      id: viewId,
      name,
      color,
      ...(icon && { icon }),
    };

    this.views.set(viewId, newView);

    void this.persistState();

    return newView;
  }

  /**
   * ビューを削除
   * 注意: デフォルトビューは削除できない
   *
   * @param viewId - 削除するビューのID
   */
  deleteView(viewId: string): void {
    if (viewId === this.defaultView.id) {
      return;
    }

    if (this.currentViewId === viewId) {
      this.currentViewId = this.defaultView.id;
    }

    this.views.delete(viewId);

    void this.persistState();
  }

  /**
   * ビューを切り替え
   *
   * @param viewId - 切り替え先のビューID
   */
  switchView(viewId: string): void {
    if (!this.views.has(viewId)) {
      return;
    }

    this.currentViewId = viewId;

    void this.persistState();
  }

  /**
   * ビューの情報を更新
   * 各ビューに名前と色を割り当てる機能を提供する
   *
   * @param viewId - 更新するビューのID
   * @param updates - 更新内容
   */
  updateView(viewId: string, updates: Partial<Omit<View, 'id'>>): void {
    const view = this.views.get(viewId);

    if (!view) {
      return;
    }

    const updatedView: View = {
      ...view,
      ...updates,
    };

    this.views.set(viewId, updatedView);

    void this.persistState();
  }

  /**
   * 現在のビューを取得
   *
   * @returns 現在のビュー
   */
  getCurrentView(): View {
    const currentView = this.views.get(this.currentViewId);

    if (!currentView) {
      return this.defaultView;
    }

    return currentView;
  }

  /**
   * すべてのビューを取得
   *
   * @returns ビューの配列（デフォルトビューを除く）
   */
  getViews(): View[] {
    return Array.from(this.views.values()).filter(
      (view) => view.id !== this.defaultView.id,
    );
  }

  /**
   * すべてのビュー（デフォルトビューを含む）を取得
   * 内部使用およびストレージ永続化用
   *
   * @returns すべてのビューの配列
   */
  getAllViews(): View[] {
    return Array.from(this.views.values());
  }

  /**
   * 指定ビューのタブを取得
   *
   * @param viewId - ビューID
   * @returns タブノードの配列
   */
  getTabsByView(viewId: string): TabNode[] {
    if (!this.treeStateManager) {
      return [];
    }
    return this.treeStateManager.getTree(viewId);
  }

  /**
   * タブを別のビューに移動
   *
   * @param tabId - 移動するタブのID
   * @param sourceViewId - 移動元のビューID
   * @param targetViewId - 移動先のビューID
   */
  async moveTabToView(
    tabId: number,
    sourceViewId: string,
    targetViewId: string,
  ): Promise<void> {
    if (sourceViewId === targetViewId) {
      return;
    }

    if (!this.views.has(targetViewId)) {
      return;
    }

    if (!this.treeStateManager) {
      return;
    }

    await this.treeStateManager.moveSubtreeToView(tabId, targetViewId);
  }

  /**
   * ストレージに状態を永続化
   */
  private async persistState(): Promise<void> {
    try {
      const currentTreeState =
        await this.storageService.get(STORAGE_KEYS.TREE_STATE);

      const updatedTreeState: TreeState = {
        views: this.getAllViews(),
        currentViewId: this.currentViewId,
        nodes: currentTreeState?.nodes || {},
        tabToNode: currentTreeState?.tabToNode || {},
      };

      await this.storageService.set(STORAGE_KEYS.TREE_STATE, updatedTreeState);
    } catch (_error) {
      // Persist state failed silently
    }
  }

  /**
   * ストレージから状態を復元
   */
  async loadState(): Promise<void> {
    try {
      const treeState = await this.storageService.get(STORAGE_KEYS.TREE_STATE);

      if (!treeState) {
        return;
      }

      this.views.clear();
      this.views.set(this.defaultView.id, this.defaultView);

      if (treeState.views && Array.isArray(treeState.views)) {
        for (const view of treeState.views) {
          this.views.set(view.id, view);
        }
      }

      if (treeState.currentViewId && this.views.has(treeState.currentViewId)) {
        this.currentViewId = treeState.currentViewId;
      }
    } catch (_error) {
      // Load state failed silently
    }
  }
}
