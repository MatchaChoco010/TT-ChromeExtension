import type { View, IStorageService, TabNode, TreeState } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';
import type { TreeStateManager } from './TreeStateManager';

/**
 * ViewManager
 *
 * 複数ビュー（仮想ワークスペース）の管理を担当するサービス
 * Task 8.1: ViewManager サービスの実装
 * Requirements: 6.1, 6.2, 6.5
 *
 * 重要: タブは物理的に閉じず、各タブに viewId メタデータを付与して管理
 * UIレイヤーでは currentViewId に一致するタブのみを表示（フィルタリング）
 */
export class ViewManager {
  private views: Map<string, View> = new Map();
  private currentViewId: string = 'default-view';
  private treeStateManager: TreeStateManager | null = null;

  // デフォルトビュー
  private readonly defaultView: View = {
    id: 'default-view',
    name: 'Default',
    color: '#6b7280', // Tailwind gray-500
  };

  constructor(private storageService: IStorageService) {
    // デフォルトビューを初期化
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
   * Requirement 6.2: 新しいビューを作成する
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

    // ストレージに永続化（非同期だが待たない）
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
    // デフォルトビューは削除できない
    if (viewId === this.defaultView.id) {
      console.warn('ViewManager.deleteView: Cannot delete default view');
      return;
    }

    // 削除されたビューがカレントビューだった場合、デフォルトビューに切り替える
    if (this.currentViewId === viewId) {
      this.currentViewId = this.defaultView.id;
    }

    this.views.delete(viewId);

    // ストレージに永続化（非同期だが待たない）
    void this.persistState();
  }

  /**
   * ビューを切り替え
   * Requirement 6.3: ビュー切り替えUIを操作する
   *
   * @param viewId - 切り替え先のビューID
   */
  switchView(viewId: string): void {
    // 存在しないビューIDの場合は何もしない
    if (!this.views.has(viewId)) {
      console.warn(`ViewManager.switchView: View ${viewId} not found`);
      return;
    }

    this.currentViewId = viewId;

    // ストレージに永続化（非同期だが待たない）
    void this.persistState();
  }

  /**
   * ビューの情報を更新
   * Requirement 6.4: 各ビューに名前と色を割り当てる機能を提供する
   *
   * @param viewId - 更新するビューのID
   * @param updates - 更新内容
   */
  updateView(viewId: string, updates: Partial<Omit<View, 'id'>>): void {
    const view = this.views.get(viewId);

    if (!view) {
      console.warn(`ViewManager.updateView: View ${viewId} not found`);
      return;
    }

    // ビュー情報を更新
    const updatedView: View = {
      ...view,
      ...updates,
    };

    this.views.set(viewId, updatedView);

    // ストレージに永続化（非同期だが待たない）
    void this.persistState();
  }

  /**
   * 現在のビューを取得
   *
   * @returns 現在のビュー
   */
  getCurrentView(): View {
    const currentView = this.views.get(this.currentViewId);

    // currentViewIdが不正な場合はデフォルトビューを返す
    if (!currentView) {
      console.warn(
        `ViewManager.getCurrentView: Current view ${this.currentViewId} not found, returning default view`,
      );
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
    // デフォルトビューを除外してビューを返す
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
   * Requirement 6.5: タブを別のビューに移動する
   *
   * 注意: この実装は TreeStateManager と連携が必要です。
   * 現在は ViewManager 単体では TabNode を管理していないため、
   * TreeStateManager.getTree(viewId) を使用してタブを取得する必要があります。
   *
   * このメソッドはインターフェース定義のみで、実際の取得は
   * TreeStateManager に委譲されます。
   *
   * @param viewId - ビューID
   * @returns タブノードの配列
   */
  getTabsByView(viewId: string): TabNode[] {
    if (!this.treeStateManager) {
      console.warn(
        'ViewManager.getTabsByView: TreeStateManager is not set',
      );
      return [];
    }
    return this.treeStateManager.getTree(viewId);
  }

  /**
   * タブを別のビューに移動
   * Task 8.4: ビュー間のタブ移動
   * Requirement 6.5: ユーザーがタブを別のビューに移動する
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
    // 移動元と移動先が同じ場合は何もしない
    if (sourceViewId === targetViewId) {
      return;
    }

    // 移動先のビューが存在するか確認
    if (!this.views.has(targetViewId)) {
      console.warn(
        `ViewManager.moveTabToView: Target view ${targetViewId} not found`,
      );
      return;
    }

    // TreeStateManagerが設定されていない場合は何もしない
    if (!this.treeStateManager) {
      console.warn(
        'ViewManager.moveTabToView: TreeStateManager is not set',
      );
      return;
    }

    // TreeStateManagerにタブの移動を委譲
    await this.treeStateManager.moveSubtreeToView(tabId, targetViewId);
  }

  /**
   * ストレージに状態を永続化
   */
  private async persistState(): Promise<void> {
    try {
      // 現在のツリー状態を取得
      const currentTreeState =
        await this.storageService.get(STORAGE_KEYS.TREE_STATE);

      // ツリー状態を更新（ビュー情報とカレントビューIDのみ）
      const updatedTreeState: TreeState = {
        views: this.getAllViews(),
        currentViewId: this.currentViewId,
        nodes: currentTreeState?.nodes || {},
        tabToNode: currentTreeState?.tabToNode || {},
      };

      await this.storageService.set(STORAGE_KEYS.TREE_STATE, updatedTreeState);
    } catch (error) {
      console.error('ViewManager.persistState error:', error);
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

      // ビューを復元
      this.views.clear();
      this.views.set(this.defaultView.id, this.defaultView);

      if (treeState.views && Array.isArray(treeState.views)) {
        for (const view of treeState.views) {
          this.views.set(view.id, view);
        }
      }

      // カレントビューを復元
      if (treeState.currentViewId && this.views.has(treeState.currentViewId)) {
        this.currentViewId = treeState.currentViewId;
      }
    } catch (error) {
      console.error('ViewManager.loadState error:', error);
    }
  }
}
