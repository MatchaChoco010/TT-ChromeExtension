import type {
  TabNode,
  TreeState,
  IStorageService,
  ViewState,
  WindowState,
  GroupInfo,
} from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

/**
 * ノード検索結果
 */
interface NodeSearchResult {
  windowState: WindowState;
  viewState: ViewState;
  viewIndex: number;
  node: TabNode;
  parent: TabNode | null;
  nodeIndex: number;
}

/**
 * TreeStateManager
 *
 * タブツリー状態の集中管理と永続化を担当するサービス
 * 新アーキテクチャ: Window → View → Tab の階層構造
 */
export class TreeStateManager {
  private windows: WindowState[] = [];
  private initializationInProgress: boolean = false;
  private initialized: boolean = false;
  private initializationResolvers: (() => void)[] = [];
  private isSyncingToChrome: boolean = false;
  private _isRestoringState: boolean = false;

  constructor(private storageService: IStorageService) {}

  get isRestoringState(): boolean {
    return this._isRestoringState;
  }

  setRestoringState(value: boolean): void {
    this._isRestoringState = value;
  }

  // ========================================
  // 初期化管理
  // ========================================

  isInitialized(): boolean {
    return this.initialized;
  }

  isInitializationInProgress(): boolean {
    return this.initializationInProgress;
  }

  async waitForInitialization(timeoutMs: number = 5000): Promise<boolean> {
    if (this.initialized) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        const index = this.initializationResolvers.indexOf(resolver);
        if (index !== -1) {
          this.initializationResolvers.splice(index, 1);
        }
        resolve(false);
      }, timeoutMs);

      const resolver = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };

      this.initializationResolvers.push(resolver);
    });
  }

  private notifyInitializationComplete(): void {
    const resolvers = this.initializationResolvers;
    this.initializationResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }

  resetForTesting(): void {
    this.windows = [];
    this.initializationInProgress = false;
    this.initialized = true;
    this.notifyInitializationComplete();
  }

  prepareForInitializationReset(): void {
    this.notifyInitializationComplete();
    this.initializationResolvers = [];
    this.initialized = false;
    this.initializationInProgress = false;
  }

  /**
   * 全てのウィンドウ状態をクリアする（E2Eテストのリセット用）
   */
  clearAllWindows(): void {
    this.windows = [];
  }

  // ========================================
  // ノード検索
  // ========================================

  /**
   * tabIdからノードを検索
   */
  private findNodeByTabId(tabId: number): NodeSearchResult | null {
    for (const windowState of this.windows) {
      for (let viewIndex = 0; viewIndex < windowState.views.length; viewIndex++) {
        const viewState = windowState.views[viewIndex];

        const searchInNodes = (
          nodes: TabNode[],
          parent: TabNode | null
        ): { node: TabNode; parent: TabNode | null; nodeIndex: number } | null => {
          for (let i = 0; i < nodes.length; i++) {
            const node = nodes[i];
            if (node.tabId === tabId) {
              return { node, parent, nodeIndex: i };
            }
            const found = searchInNodes(node.children, node);
            if (found) return found;
          }
          return null;
        };

        const found = searchInNodes(viewState.rootNodes, null);
        if (found) {
          return {
            windowState,
            viewState,
            viewIndex,
            ...found,
          };
        }
      }
    }
    return null;
  }

  /**
   * windowIdからWindowStateを取得
   */
  private getWindowState(windowId: number): WindowState | null {
    return this.windows.find((w) => w.windowId === windowId) ?? null;
  }

  /**
   * ノードの総数を再帰的にカウント
   */
  private countNodes(nodes: TabNode[]): number {
    return nodes.reduce((sum, node) => sum + 1 + this.countNodes(node.children), 0);
  }

  /**
   * windowIdからWindowStateを取得、なければ作成
   */
  private getOrCreateWindowState(windowId: number): WindowState {
    let windowState = this.windows.find((w) => w.windowId === windowId);
    if (!windowState) {
      windowState = {
        windowId,
        views: [
          {
            name: 'Default',
            color: '#3B82F6',
            rootNodes: [],
            pinnedTabIds: [],
          },
        ],
        activeViewIndex: 0,
      };
      this.windows.push(windowState);
    }
    return windowState;
  }

  // ========================================
  // ツリー取得
  // ========================================

  /**
   * 指定ウィンドウ・ビューのタブツリーを取得
   */
  getTree(windowId: number, viewIndex?: number): TabNode[] {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return [];

    const vi = viewIndex ?? windowState.activeViewIndex;
    const viewState = windowState.views[vi];
    if (!viewState) return [];

    return viewState.rootNodes;
  }

  /**
   * tabIdからTabNodeを取得
   */
  getNodeByTabId(
    tabId: number
  ): { windowId: number; viewIndex: number; node: TabNode } | null {
    const result = this.findNodeByTabId(tabId);
    if (!result) return null;

    return {
      windowId: result.windowState.windowId,
      viewIndex: result.viewIndex,
      node: result.node,
    };
  }

  /**
   * タブの親タブIDを取得
   */
  getParentTabId(tabId: number): number | null {
    const result = this.findNodeByTabId(tabId);
    if (!result || !result.parent) return null;
    return result.parent.tabId;
  }

  /**
   * タブの最後の兄弟ノードのtabIdを取得
   */
  getLastSiblingTabId(tabId: number): number | undefined {
    const result = this.findNodeByTabId(tabId);
    if (!result) return undefined;

    const siblings = result.parent
      ? result.parent.children
      : result.viewState.rootNodes;
    if (siblings.length === 0) return undefined;
    return siblings[siblings.length - 1].tabId;
  }

  /**
   * タブの兄弟内インデックスを取得
   */
  getSiblingIndex(tabId: number): number {
    const result = this.findNodeByTabId(tabId);
    if (!result) return -1;
    return result.nodeIndex;
  }

  // ========================================
  // タブ操作
  // ========================================

  /**
   * 新しいタブを追加
   */
  async addTab(
    tab: chrome.tabs.Tab,
    parentTabId: number | null,
    windowId: number,
    viewIndex?: number,
    insertAfterTabId?: number
  ): Promise<void> {
    if (!tab.id) {
      throw new Error('Tab ID is required');
    }

    const windowState = this.getOrCreateWindowState(windowId);
    const vi = viewIndex ?? windowState.activeViewIndex;

    if (vi >= windowState.views.length) {
      windowState.views.push({
        name: 'View',
        color: '#3B82F6',
        rootNodes: [],
        pinnedTabIds: [],
      });
    }

    const viewState = windowState.views[vi];

    const newNode: TabNode = {
      tabId: tab.id,
      isExpanded: true,
      children: [],
    };

    if (parentTabId !== null) {
      const parentResult = this.findNodeByTabId(parentTabId);
      if (parentResult && parentResult.windowState.windowId === windowId) {
        if (insertAfterTabId !== undefined) {
          const insertIndex = parentResult.node.children.findIndex(
            (c) => c.tabId === insertAfterTabId
          );
          if (insertIndex !== -1) {
            parentResult.node.children.splice(insertIndex + 1, 0, newNode);
          } else {
            parentResult.node.children.push(newNode);
          }
        } else {
          parentResult.node.children.push(newNode);
        }
      } else {
        viewState.rootNodes.push(newNode);
      }
    } else {
      if (insertAfterTabId !== undefined) {
        const insertIndex = viewState.rootNodes.findIndex(
          (n) => n.tabId === insertAfterTabId
        );
        if (insertIndex !== -1) {
          viewState.rootNodes.splice(insertIndex + 1, 0, newNode);
        } else {
          viewState.rootNodes.push(newNode);
        }
      } else {
        viewState.rootNodes.push(newNode);
      }
    }

    await this.persistState();
  }

  /**
   * タブを削除（内部用、永続化なし）
   */
  private removeTabFromTree(
    tabId: number,
    childTabBehavior: 'promote' | 'close_all' = 'promote'
  ): number[] {
    const result = this.findNodeByTabId(tabId);
    if (!result) return [];

    const { viewState, node, parent, nodeIndex } = result;
    const closedTabIds: number[] = [tabId];

    if (childTabBehavior === 'promote') {
      const siblings = parent ? parent.children : viewState.rootNodes;
      siblings.splice(nodeIndex, 1, ...node.children);
    } else if (childTabBehavior === 'close_all') {
      const collectTabIds = (n: TabNode): number[] => {
        return [n.tabId, ...n.children.flatMap(collectTabIds)];
      };
      closedTabIds.push(...node.children.flatMap(collectTabIds));
      const siblings = parent ? parent.children : viewState.rootNodes;
      siblings.splice(nodeIndex, 1);
    }

    return closedTabIds;
  }

  /**
   * タブを削除
   */
  async removeTab(
    tabId: number,
    childTabBehavior: 'promote' | 'close_all' = 'promote'
  ): Promise<number[]> {
    const closedTabIds = this.removeTabFromTree(tabId, childTabBehavior);

    await this.persistState();
    return closedTabIds;
  }

  /**
   * ノードを移動
   */
  async moveNode(
    tabId: number,
    newParentTabId: number | null,
    newIndex: number
  ): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    if (!result) return;

    const { viewState, node, parent, nodeIndex } = result;

    // 現在の位置から削除
    const siblings = parent ? parent.children : viewState.rootNodes;
    siblings.splice(nodeIndex, 1);

    // 新しい位置に挿入
    if (newParentTabId !== null) {
      const newParentResult = this.findNodeByTabId(newParentTabId);
      if (newParentResult) {
        newParentResult.node.children.splice(newIndex, 0, node);
      }
    } else {
      viewState.rootNodes.splice(newIndex, 0, node);
    }

    await this.persistState();
  }

  /**
   * タブをルートの最後尾に移動
   * targetWindowIdが指定された場合、そのウィンドウに移動する
   */
  async moveTabToRootEnd(tabId: number, targetWindowId?: number): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    if (!result) {
      return;
    }

    const { viewState, node, parent, nodeIndex } = result;

    // 現在の位置から削除
    const siblings = parent ? parent.children : viewState.rootNodes;
    siblings.splice(nodeIndex, 1);

    if (targetWindowId !== undefined) {
      // 新しいウィンドウに移動
      const targetWindowState = this.getOrCreateWindowState(targetWindowId);
      const targetViewState = targetWindowState.views[targetWindowState.activeViewIndex];
      if (targetViewState) {
        targetViewState.rootNodes.push(node);
      }
    } else {
      // 同じビューのルートの最後に追加
      viewState.rootNodes.push(node);
    }

    await this.persistState();
  }

  /**
   * ノードの展開状態を切り替え
   */
  async toggleExpand(tabId: number): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    if (!result) return;

    result.node.isExpanded = !result.node.isExpanded;
    await this.persistState();
  }

  /**
   * ノードを展開
   */
  async expandNode(tabId: number): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    if (!result) return;

    if (result.node.isExpanded) return;

    result.node.isExpanded = true;
    await this.persistState();
  }

  /**
   * tabIdを置き換える
   */
  async replaceTabId(oldTabId: number, newTabId: number): Promise<void> {
    const result = this.findNodeByTabId(oldTabId);
    if (!result) {
      return;
    }

    result.node.tabId = newTabId;
    await this.persistState();
  }

  // ========================================
  // サブツリー操作
  // ========================================

  /**
   * サブツリーのノード数を取得
   */
  getSubtreeSize(tabId: number): number {
    const result = this.findNodeByTabId(tabId);
    if (!result) return 0;

    const countNodes = (node: TabNode): number => {
      return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
    };
    return countNodes(result.node);
  }

  /**
   * サブツリーの全ノードを取得
   */
  getSubtree(tabId: number): TabNode[] {
    const result = this.findNodeByTabId(tabId);
    if (!result) return [];

    const collectNodes = (node: TabNode): TabNode[] => {
      return [node, ...node.children.flatMap(collectNodes)];
    };
    return collectNodes(result.node);
  }

  /**
   * サブツリーを別のビューに移動
   */
  async moveSubtreeToView(
    tabId: number,
    targetWindowId: number,
    targetViewIndex: number
  ): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    if (!result) return;

    const { viewState, node, parent, nodeIndex } = result;

    // 元の位置から削除
    const siblings = parent ? parent.children : viewState.rootNodes;
    siblings.splice(nodeIndex, 1);

    // 移動先のウィンドウ・ビューを取得
    const targetWindowState = this.getOrCreateWindowState(targetWindowId);
    while (targetWindowState.views.length <= targetViewIndex) {
      targetWindowState.views.push({
        name: 'View',
        color: '#3B82F6',
        rootNodes: [],
        pinnedTabIds: [],
      });
    }
    const targetViewState = targetWindowState.views[targetViewIndex];

    // 移動先のルートに追加
    targetViewState.rootNodes.push(node);

    await this.persistState();
  }

  // ========================================
  // ビュー操作
  // ========================================

  private static readonly VIEW_COLOR_PALETTE = [
    '#3B82F6', // blue (default)
    '#10B981', // green
    '#F59E0B', // yellow
    '#EF4444', // red
    '#8B5CF6', // purple
    '#EC4899', // pink
    '#06B6D4', // cyan
    '#F97316', // orange
  ];

  /**
   * 全てのビュー情報を取得
   */
  getAllViews(windowId: number): Array<{ name: string; color: string; icon?: string }> {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return [];

    return windowState.views.map((v) => ({
      name: v.name,
      color: v.color,
      icon: v.icon,
    }));
  }

  /**
   * ビューの順序を取得
   */
  getViewOrder(windowId: number): number[] {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return [];
    return windowState.views.map((_, i) => i);
  }

  /**
   * 新しいビューを作成（名前と色を指定）
   */
  async createView(windowId: number, name: string, color: string): Promise<number> {
    const windowState = this.getOrCreateWindowState(windowId);

    const newView: ViewState = {
      name,
      color,
      rootNodes: [],
      pinnedTabIds: [],
    };
    windowState.views.push(newView);

    const newViewIndex = windowState.views.length - 1;
    await this.persistState();
    return newViewIndex;
  }

  /**
   * 新しいビューを作成（自動カラー選択）
   */
  async createViewWithAutoColor(windowId: number): Promise<number> {
    const windowState = this.getOrCreateWindowState(windowId);
    const viewCount = windowState.views.length;
    const colorIndex = viewCount % TreeStateManager.VIEW_COLOR_PALETTE.length;
    const newColor = TreeStateManager.VIEW_COLOR_PALETTE[colorIndex];

    return this.createView(windowId, 'View', newColor);
  }

  /**
   * ビューを削除
   */
  async deleteView(windowId: number, viewIndex: number): Promise<void> {
    const windowState = this.getWindowState(windowId);
    if (!windowState) {
      return;
    }
    if (viewIndex === 0) {
      return;
    }
    if (viewIndex >= windowState.views.length) {
      return;
    }

    const deletedView = windowState.views[viewIndex];
    windowState.views.splice(viewIndex, 1);

    // 削除されたビューのタブを一つ前のビューに移動
    const targetViewIndex = viewIndex - 1;
    windowState.views[targetViewIndex].rootNodes.push(...deletedView.rootNodes);

    // アクティブビューの調整
    if (windowState.activeViewIndex >= viewIndex) {
      windowState.activeViewIndex = Math.max(0, windowState.activeViewIndex - 1);
    }

    await this.persistState();
  }

  /**
   * ビュー情報を更新
   */
  async updateView(
    windowId: number,
    viewIndex: number,
    updates: Partial<{ name: string; color: string; icon: string }>
  ): Promise<void> {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return;
    if (viewIndex >= windowState.views.length) return;

    const viewState = windowState.views[viewIndex];
    if (updates.name !== undefined) viewState.name = updates.name;
    if (updates.color !== undefined) viewState.color = updates.color;
    if (updates.icon !== undefined) viewState.icon = updates.icon;

    await this.persistState();
  }

  /**
   * ビューを切り替え
   */
  async switchView(windowId: number, viewIndex: number): Promise<void> {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return;
    if (viewIndex >= windowState.views.length) return;

    windowState.activeViewIndex = viewIndex;
    await this.persistState();
  }

  /**
   * タブを別のビューに移動
   */
  async moveTabsToViewInternal(
    tabIds: number[],
    targetWindowId: number,
    targetViewIndex: number
  ): Promise<void> {
    const targetWindowState = this.getOrCreateWindowState(targetWindowId);
    while (targetWindowState.views.length <= targetViewIndex) {
      targetWindowState.views.push({
        name: 'View',
        color: '#3B82F6',
        rootNodes: [],
        pinnedTabIds: [],
      });
    }
    const targetViewState = targetWindowState.views[targetViewIndex];

    // ピン留めタブの移動処理
    for (const tabId of tabIds) {
      for (let i = 0; i < targetWindowState.views.length; i++) {
        if (i === targetViewIndex) continue;
        const viewState = targetWindowState.views[i];
        const pinnedIndex = viewState.pinnedTabIds.indexOf(tabId);
        if (pinnedIndex !== -1) {
          // 元のビューから削除
          viewState.pinnedTabIds.splice(pinnedIndex, 1);
          // 移動先のビューに追加（重複チェック）
          if (!targetViewState.pinnedTabIds.includes(tabId)) {
            targetViewState.pinnedTabIds.push(tabId);
          }
          break;
        }
      }
    }

    // 親が選択されているタブは移動対象から除外（親の移動で一緒に移動するため）
    const tabIdSet = new Set(tabIds);
    const topLevelTabIds: number[] = [];
    for (const tabId of tabIds) {
      const result = this.findNodeByTabId(tabId);
      if (!result) continue;

      const hasSelectedParent = (_node: TabNode, parent: TabNode | null): boolean => {
        if (!parent) return false;
        if (tabIdSet.has(parent.tabId)) return true;
        return false;
      };

      if (!hasSelectedParent(result.node, result.parent)) {
        topLevelTabIds.push(tabId);
      }
    }

    for (const tabId of topLevelTabIds) {
      const result = this.findNodeByTabId(tabId);
      if (!result) continue;

      // 元の位置から削除
      const siblings = result.parent
        ? result.parent.children
        : result.viewState.rootNodes;
      const nodeIndex = siblings.findIndex((n) => n.tabId === tabId);
      if (nodeIndex !== -1) {
        siblings.splice(nodeIndex, 1);
      }

      // 移動先に追加
      targetViewState.rootNodes.push(result.node);
    }

    await this.persistState();
  }

  // ========================================
  // ウィンドウ操作
  // ========================================

  /**
   * 全ウィンドウの状態を取得
   */
  getAllWindowStates(): WindowState[] {
    return this.windows;
  }

  /**
   * ウィンドウを追加
   */
  addWindow(windowId: number): void {
    if (this.windows.some((w) => w.windowId === windowId)) {
      return;
    }

    this.windows.push({
      windowId,
      views: [
        {
          name: 'Default',
          color: '#3B82F6',
          rootNodes: [],
          pinnedTabIds: [],
        },
      ],
      activeViewIndex: 0,
    });
  }

  /**
   * ウィンドウを削除
   */
  async removeWindow(windowId: number): Promise<void> {
    const index = this.windows.findIndex((w) => w.windowId === windowId);
    if (index !== -1) {
      this.windows.splice(index, 1);
      await this.persistState();
    }
  }

  /**
   * 単一タブで新しいウィンドウを作成
   */
  async createWindowWithTab(tabId: number): Promise<number | undefined> {
    const result = this.findNodeByTabId(tabId);
    if (!result) return undefined;

    // 元の位置から削除
    const siblings = result.parent
      ? result.parent.children
      : result.viewState.rootNodes;
    const nodeIndex = siblings.findIndex((n) => n.tabId === tabId);
    if (nodeIndex !== -1) {
      siblings.splice(nodeIndex, 1);
    }

    // 新しいウィンドウを作成
    const newWindow = await chrome.windows.create({ tabId });
    if (!newWindow || newWindow.id === undefined) return undefined;

    // 新しいウィンドウ状態を作成
    const newWindowState: WindowState = {
      windowId: newWindow.id,
      views: [
        {
          name: 'Default',
          color: '#3B82F6',
          rootNodes: [result.node],
          pinnedTabIds: [],
        },
      ],
      activeViewIndex: 0,
    };
    this.windows.push(newWindowState);

    await this.persistState();
    await this.syncTreeStateToChromeTabs();
    return newWindow.id;
  }

  /**
   * サブツリーで新しいウィンドウを作成
   */
  async createWindowWithSubtree(tabId: number): Promise<number | undefined> {
    const result = this.findNodeByTabId(tabId);
    if (!result) return undefined;

    const subtree = this.getSubtree(tabId);
    if (subtree.length === 0) return undefined;

    // 元の位置から削除
    const siblings = result.parent
      ? result.parent.children
      : result.viewState.rootNodes;
    const nodeIndex = siblings.findIndex((n) => n.tabId === tabId);
    if (nodeIndex !== -1) {
      siblings.splice(nodeIndex, 1);
    }

    // 新しいウィンドウを作成
    const newWindow = await chrome.windows.create({ tabId });
    if (!newWindow || newWindow.id === undefined) return undefined;

    // 子タブも移動
    for (const node of subtree.slice(1)) {
      try {
        await chrome.tabs.move(node.tabId, { windowId: newWindow.id, index: -1 });
      } catch {
        // 移動失敗は無視
      }
    }

    // 新しいウィンドウ状態を作成
    const newWindowState: WindowState = {
      windowId: newWindow.id,
      views: [
        {
          name: 'Default',
          color: '#3B82F6',
          rootNodes: [result.node],
          pinnedTabIds: [],
        },
      ],
      activeViewIndex: 0,
    };
    this.windows.push(newWindowState);

    await this.persistState();
    await this.syncTreeStateToChromeTabs(newWindow.id);
    return newWindow.id;
  }

  /**
   * サブツリーを別のウィンドウに移動
   */
  async moveSubtreeToWindow(tabId: number, targetWindowId: number): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    if (!result) return;

    const subtree = this.getSubtree(tabId);
    if (subtree.length === 0) return;

    // 元の位置から削除
    const siblings = result.parent
      ? result.parent.children
      : result.viewState.rootNodes;
    const nodeIndex = siblings.findIndex((n) => n.tabId === tabId);
    if (nodeIndex !== -1) {
      siblings.splice(nodeIndex, 1);
    }

    // タブを移動
    for (const node of subtree) {
      try {
        await chrome.tabs.move(node.tabId, { windowId: targetWindowId, index: -1 });
      } catch {
        // 移動失敗は無視
      }
    }

    // 移動先ウィンドウのアクティブビューに追加
    const targetWindowState = this.getOrCreateWindowState(targetWindowId);
    const targetViewState = targetWindowState.views[targetWindowState.activeViewIndex];
    targetViewState.rootNodes.push(result.node);

    await this.persistState();
    await this.syncTreeStateToChromeTabs(targetWindowId);
  }

  /**
   * 複数タブで新しいウィンドウを作成
   */
  async moveTabsToNewWindow(tabIds: number[]): Promise<number | undefined> {
    if (tabIds.length === 0) return undefined;

    const nodesToMove: TabNode[] = [];
    const tabIdSet = new Set(tabIds);

    // 親が選択されているタブは移動対象から除外
    for (const tabId of tabIds) {
      const result = this.findNodeByTabId(tabId);
      if (!result) continue;
      if (result.parent && tabIdSet.has(result.parent.tabId)) continue;

      // 元の位置から削除
      const siblings = result.parent
        ? result.parent.children
        : result.viewState.rootNodes;
      const nodeIndex = siblings.findIndex((n) => n.tabId === tabId);
      if (nodeIndex !== -1) {
        siblings.splice(nodeIndex, 1);
        nodesToMove.push(result.node);
      }
    }

    if (nodesToMove.length === 0) return undefined;

    // 新しいウィンドウを作成（最初のタブで）
    const newWindow = await chrome.windows.create({ tabId: nodesToMove[0].tabId });
    if (!newWindow || newWindow.id === undefined) return undefined;

    const collectTabIds = (node: TabNode): number[] => {
      return [node.tabId, ...node.children.flatMap(collectTabIds)];
    };

    // 全ノードのタブを移動
    for (let i = 0; i < nodesToMove.length; i++) {
      // 最初のノードは子のみ移動（自身はwindows.createで移動済み）
      // 残りのノードは自身と子を全て移動
      const tabIdsToMove =
        i === 0
          ? nodesToMove[0].children.flatMap(collectTabIds)
          : collectTabIds(nodesToMove[i]);
      for (const tid of tabIdsToMove) {
        try {
          await chrome.tabs.move(tid, { windowId: newWindow.id, index: -1 });
        } catch {
          // 移動失敗は無視
        }
      }
    }

    // 新しいウィンドウ状態を作成
    const newWindowState: WindowState = {
      windowId: newWindow.id,
      views: [
        {
          name: 'Default',
          color: '#3B82F6',
          rootNodes: nodesToMove,
          pinnedTabIds: [],
        },
      ],
      activeViewIndex: 0,
    };
    this.windows.push(newWindowState);

    await this.persistState();
    await this.syncTreeStateToChromeTabs(newWindow.id);
    return newWindow.id;
  }

  /**
   * タブを別のウィンドウに移動
   */
  async moveTabToWindow(tabId: number, targetWindowId: number): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    if (!result) return;

    // 元の位置から削除
    const siblings = result.parent
      ? result.parent.children
      : result.viewState.rootNodes;
    const nodeIndex = siblings.findIndex((n) => n.tabId === tabId);
    if (nodeIndex !== -1) {
      siblings.splice(nodeIndex, 1);
    }

    // 移動先ウィンドウのアクティブビューに追加
    const targetWindowState = this.getOrCreateWindowState(targetWindowId);
    const targetViewState = targetWindowState.views[targetWindowState.activeViewIndex];
    targetViewState.rootNodes.push(result.node);

    // Chromeタブも移動
    try {
      await chrome.tabs.move(tabId, { windowId: targetWindowId, index: -1 });
    } catch {
      // タブが存在しない場合は無視
    }

    await this.persistState();
    await this.syncTreeStateToChromeTabs(targetWindowId);
  }

  // ========================================
  // ピン留め操作
  // ========================================

  /**
   * ピン留めタブIDリストを取得
   * viewIndexを指定した場合はそのビューのピン留めタブを返す
   * viewIndexを省略した場合はアクティブビューのピン留めタブを返す
   */
  getPinnedTabIds(windowId: number, viewIndex?: number): number[] {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return [];
    const vi = viewIndex ?? windowState.activeViewIndex;
    const viewState = windowState.views[vi];
    return viewState?.pinnedTabIds ?? [];
  }

  /**
   * タブをピン留め
   * pinnedTabIdsに追加し、rootNodesから削除する
   */
  async pinTabs(tabIds: number[], windowId: number, viewIndex?: number): Promise<void> {
    const windowState = this.getOrCreateWindowState(windowId);
    const vi = viewIndex ?? windowState.activeViewIndex;
    const viewState = windowState.views[vi];
    if (!viewState) return;

    for (const tabId of tabIds) {
      if (!viewState.pinnedTabIds.includes(tabId)) {
        viewState.pinnedTabIds.push(tabId);
      }
      // rootNodesから削除（子ノードは昇格させる）
      this.removeTabFromTree(tabId, 'promote');
    }

    await this.persistState();
  }

  /**
   * タブのピン留めを解除
   */
  async unpinTabs(tabIds: number[], windowId: number, viewIndex?: number): Promise<void> {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return;

    const vi = viewIndex ?? windowState.activeViewIndex;
    const viewState = windowState.views[vi];
    if (!viewState) return;

    const tabIdSet = new Set(tabIds);
    const unpinnedTabIds = viewState.pinnedTabIds.filter((id) =>
      tabIdSet.has(id)
    );
    viewState.pinnedTabIds = viewState.pinnedTabIds.filter(
      (id) => !tabIdSet.has(id)
    );

    // ピン留め解除されたタブをrootNodesに追加
    for (const tabId of unpinnedTabIds) {
      const newNode: TabNode = {
        tabId,
        isExpanded: true,
        children: [],
      };
      viewState.rootNodes.push(newNode);
    }

    await this.persistState();
  }

  /**
   * ピン留めタブの順序を変更
   */
  async reorderPinnedTab(
    tabId: number,
    newIndex: number,
    windowId: number,
    viewIndex?: number
  ): Promise<void> {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return;

    const vi = viewIndex ?? windowState.activeViewIndex;
    const viewState = windowState.views[vi];
    if (!viewState) return;

    const currentIndex = viewState.pinnedTabIds.indexOf(tabId);
    if (currentIndex === -1) return;
    if (newIndex < 0 || newIndex >= viewState.pinnedTabIds.length) return;
    if (currentIndex === newIndex) return;

    viewState.pinnedTabIds.splice(currentIndex, 1);
    viewState.pinnedTabIds.splice(newIndex, 0, tabId);

    await this.persistState();
  }

  /**
   * 指定したタブがピン留めタブかどうかを確認
   * viewIndexを省略した場合はアクティブビューで確認
   */
  isPinnedTab(tabId: number, windowId: number, viewIndex?: number): boolean {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return false;
    const vi = viewIndex ?? windowState.activeViewIndex;
    const viewState = windowState.views[vi];
    if (!viewState) return false;
    return viewState.pinnedTabIds.includes(tabId);
  }

  /**
   * 指定したタブがどこかのビューでピン留めされているか確認
   */
  isPinnedTabInAnyView(tabId: number, windowId: number): boolean {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return false;
    for (const viewState of windowState.views) {
      if (viewState.pinnedTabIds.includes(tabId)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Chromeイベントからのピン留め状態変更を反映
   * 同期中は無視（無限ループ防止）
   */
  updatePinnedStateFromChromeEvent(
    tabId: number,
    windowId: number,
    isPinned: boolean
  ): void {
    // 同期中は無視（syncTreeStateToChromeTabs → onUpdated → ここ → ... の無限ループを防ぐ）
    if (this.isSyncingToChrome) {
      return;
    }

    const windowState = this.getOrCreateWindowState(windowId);
    const viewState = windowState.views[windowState.activeViewIndex];
    if (!viewState) return;

    const isInList = viewState.pinnedTabIds.includes(tabId);

    if (isPinned && !isInList) {
      viewState.pinnedTabIds.push(tabId);
      // rootNodesから削除（子ノードは昇格させる）
      this.removeTabFromTree(tabId, 'promote');
    } else if (!isPinned && isInList) {
      viewState.pinnedTabIds = viewState.pinnedTabIds.filter(
        (id) => id !== tabId
      );

      // ピン留め解除されたタブをアクティブビューのrootNodesに追加
      const newNode: TabNode = {
        tabId,
        isExpanded: true,
        children: [],
      };
      viewState.rootNodes.push(newNode);
    }
  }

  // ========================================
  // グループ操作
  // ========================================

  /**
   * グループを作成
   * @param contextMenuTabId コンテキストメニューを開いたタブのID（グループの挿入位置を決定）
   */
  async createGroupWithRealTab(
    groupTabId: number,
    tabIds: number[],
    groupName: string = '新しいグループ',
    windowId: number,
    contextMenuTabId?: number
  ): Promise<void> {
    if (tabIds.length === 0) {
      throw new Error('No tabs specified for grouping');
    }

    const windowState = this.getOrCreateWindowState(windowId);
    const viewState = windowState.views[windowState.activeViewIndex];

    // グループノードを作成
    const groupNode: TabNode = {
      tabId: groupTabId,
      isExpanded: true,
      groupInfo: {
        name: groupName,
        color: '#f59e0b',
      },
      children: [],
    };

    // コンテキストメニューを開いたタブの位置を特定
    // 親が選択されている場合は、最上位の選択タブを使用
    const tabIdSet = new Set(tabIds);
    let targetTabId = contextMenuTabId ?? tabIds[0];
    let targetResult = this.findNodeByTabId(targetTabId);
    while (targetResult?.parent && tabIdSet.has(targetResult.parent.tabId)) {
      targetTabId = targetResult.parent.tabId;
      targetResult = this.findNodeByTabId(targetTabId);
    }
    let insertParent: TabNode | null = null;
    let insertAtIndex: number | null = null;
    let insertParentChildren: TabNode[] | null = null;

    if (targetResult) {
      insertParent = targetResult.parent;
      insertParentChildren = targetResult.parent
        ? targetResult.parent.children
        : targetResult.viewState.rootNodes;
      insertAtIndex = insertParentChildren.findIndex((n) => n.tabId === targetTabId);
    }

    // 選択されたタブをグループの子として追加
    const nodesToMove: TabNode[] = [];

    // 親が選択されていないタブのみ移動対象
    for (const tabId of tabIds) {
      const result = this.findNodeByTabId(tabId);
      if (!result) continue;
      if (result.parent && tabIdSet.has(result.parent.tabId)) continue;

      // 元の位置から削除
      const siblings = result.parent
        ? result.parent.children
        : result.viewState.rootNodes;
      const nodeIndex = siblings.findIndex((n) => n.tabId === tabId);
      if (nodeIndex !== -1) {
        siblings.splice(nodeIndex, 1);
        nodesToMove.push(result.node);
        // 削除によってインデックスがずれるので調整
        if (insertParentChildren === siblings && insertAtIndex !== null && nodeIndex < insertAtIndex) {
          insertAtIndex--;
        }
      }
    }

    // グループの子として追加
    groupNode.children = nodesToMove;

    // グループを記録した位置に挿入（なければ末尾に追加）
    if (insertAtIndex !== null && insertParentChildren !== null && insertAtIndex >= 0) {
      insertParentChildren.splice(insertAtIndex, 0, groupNode);
    } else if (insertParent !== null) {
      insertParent.children.push(groupNode);
    } else {
      viewState.rootNodes.push(groupNode);
    }

    await this.persistState();
  }

  /**
   * グループを解除
   */
  async dissolveGroup(tabId: number): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    if (!result) throw new Error('Tab not found');

    let groupNode: TabNode;
    let groupParent: TabNode | null;
    let groupNodeIndex: number;

    if (result.node.groupInfo) {
      groupNode = result.node;
      groupParent = result.parent;
      groupNodeIndex = result.nodeIndex;
    } else if (result.parent?.groupInfo) {
      groupNode = result.parent;
      // 親のグループノードの親を探す
      const grandparentResult = this.findNodeByTabId(groupNode.tabId);
      if (!grandparentResult) throw new Error('Group not found');
      groupParent = grandparentResult.parent;
      groupNodeIndex = grandparentResult.nodeIndex;
    } else {
      throw new Error('Group not found');
    }

    // グループの子を昇格
    const siblings = groupParent
      ? groupParent.children
      : result.viewState.rootNodes;
    siblings.splice(groupNodeIndex, 1, ...groupNode.children);

    await this.persistState();
  }

  /**
   * グループ情報を取得
   */
  async getGroupInfo(tabId: number): Promise<{
    name: string;
    children: Array<{ tabId: number; title: string; url: string }>;
  }> {
    const result = this.findNodeByTabId(tabId);
    if (!result) throw new Error('Group not found');
    if (!result.node.groupInfo) throw new Error('Not a group tab');

    const children: Array<{ tabId: number; title: string; url: string }> = [];
    for (const child of result.node.children) {
      try {
        const tab = await chrome.tabs.get(child.tabId);
        children.push({
          tabId: child.tabId,
          title: tab.title || '',
          url: tab.url || '',
        });
      } catch {
        // タブが存在しない場合は無視
      }
    }

    return {
      name: result.node.groupInfo.name,
      children,
    };
  }

  /**
   * グループ名を更新
   */
  async updateGroupName(tabId: number, name: string): Promise<boolean> {
    const result = this.findNodeByTabId(tabId);
    if (!result || !result.node.groupInfo) return false;

    result.node.groupInfo.name = name;
    await this.persistState();
    return true;
  }

  /**
   * タブをグループに追加
   */
  async addTabToTreeGroup(
    tabId: number,
    targetGroupTabId: number
  ): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    const groupResult = this.findNodeByTabId(targetGroupTabId);
    if (!result || !groupResult) return;

    // 元の位置から削除
    const siblings = result.parent
      ? result.parent.children
      : result.viewState.rootNodes;
    const nodeIndex = siblings.findIndex((n) => n.tabId === tabId);
    if (nodeIndex !== -1) {
      siblings.splice(nodeIndex, 1);
    }

    // グループに追加
    groupResult.node.children.push(result.node);

    await this.persistState();
  }

  /**
   * タブをグループから削除
   */
  async removeTabFromTreeGroup(tabId: number): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    if (!result || !result.parent?.groupInfo) return;

    // グループから削除
    const nodeIndex = result.parent.children.findIndex(
      (n) => n.tabId === tabId
    );
    if (nodeIndex !== -1) {
      result.parent.children.splice(nodeIndex, 1);
    }

    // ルートに移動
    result.viewState.rootNodes.push(result.node);

    await this.persistState();
  }

  // ========================================
  // D&D操作
  // ========================================

  /**
   * ノードを親の子として移動
   * targetParentTabIdがnullの場合はルートに移動
   */
  async moveNodeToParent(
    tabId: number,
    targetParentTabId: number | null,
    selectedTabIds: number[]
  ): Promise<void> {
    const isSelected = selectedTabIds.includes(tabId);
    const tabIdsToMove = isSelected ? selectedTabIds : [tabId];
    const tabIdSet = new Set(tabIdsToMove);

    // ルートへの移動
    if (targetParentTabId === null) {
      // 親が選択されているタブは移動対象から除外
      const topLevelTabIds = tabIdsToMove.filter((id) => {
        const result = this.findNodeByTabId(id);
        if (!result || !result.parent) return true;
        return !tabIdSet.has(result.parent.tabId);
      });

      for (const id of topLevelTabIds) {
        const result = this.findNodeByTabId(id);
        if (!result) continue;

        // 元の位置から削除
        const siblings = result.parent
          ? result.parent.children
          : result.viewState.rootNodes;
        const nodeIndex = siblings.findIndex((n) => n.tabId === id);
        if (nodeIndex !== -1) {
          siblings.splice(nodeIndex, 1);
        }

        // ルートに追加
        result.viewState.rootNodes.push(result.node);
      }

      await this.persistState();
      return;
    }

    const targetResult = this.findNodeByTabId(targetParentTabId);
    if (!targetResult) return;

    // 自身の子孫への移動を防ぐ
    for (const id of tabIdsToMove) {
      const result = this.findNodeByTabId(id);
      if (result) {
        const isDescendant = (node: TabNode, targetId: number): boolean => {
          if (node.tabId === targetId) return true;
          return node.children.some((c) => isDescendant(c, targetId));
        };
        if (isDescendant(result.node, targetParentTabId)) return;
      }
    }

    // 親が選択されているタブは移動対象から除外
    const topLevelTabIds = tabIdsToMove.filter((id) => {
      const result = this.findNodeByTabId(id);
      if (!result || !result.parent) return true;
      return !tabIdSet.has(result.parent.tabId);
    });

    for (const id of topLevelTabIds) {
      const result = this.findNodeByTabId(id);
      if (!result) continue;

      // 元の位置から削除
      const siblings = result.parent
        ? result.parent.children
        : result.viewState.rootNodes;
      const nodeIndex = siblings.findIndex((n) => n.tabId === id);
      if (nodeIndex !== -1) {
        siblings.splice(nodeIndex, 1);
      }

      // ターゲットの子として追加
      targetResult.node.children.push(result.node);
    }

    targetResult.node.isExpanded = true;
    await this.persistState();
  }

  /**
   * ノードを兄弟として移動
   */
  async moveNodeAsSibling(
    tabId: number,
    aboveTabId: number | undefined,
    belowTabId: number | undefined,
    selectedTabIds: number[]
  ): Promise<void> {
    const isSelected = selectedTabIds.includes(tabId);
    const tabIdsToMove = isSelected ? selectedTabIds : [tabId];
    const tabIdSet = new Set(tabIdsToMove);

    // 挿入先の親を決定
    let targetParent: TabNode | null = null;
    let targetViewState: ViewState | null = null;

    if (belowTabId !== undefined) {
      const belowResult = this.findNodeByTabId(belowTabId);
      if (belowResult) {
        targetParent = belowResult.parent;
        targetViewState = belowResult.viewState;
      }
    } else if (aboveTabId !== undefined) {
      const aboveResult = this.findNodeByTabId(aboveTabId);
      if (aboveResult) {
        targetParent = aboveResult.parent;
        targetViewState = aboveResult.viewState;
      }
    }

    if (!targetViewState) return;

    // 親が選択されているタブは移動対象から除外
    const topLevelTabIds = tabIdsToMove.filter((id) => {
      const result = this.findNodeByTabId(id);
      if (!result || !result.parent) return true;
      return !tabIdSet.has(result.parent.tabId);
    });

    // 移動するノードを収集しつつ、元の位置から削除
    const nodesToMove: TabNode[] = [];
    for (const id of topLevelTabIds) {
      const result = this.findNodeByTabId(id);
      if (!result) continue;

      const siblings = result.parent
        ? result.parent.children
        : result.viewState.rootNodes;
      const nodeIndex = siblings.findIndex((n) => n.tabId === id);
      if (nodeIndex !== -1) {
        siblings.splice(nodeIndex, 1);
        nodesToMove.push(result.node);
      }
    }

    // 挿入先を決定
    const targetSiblings = targetParent
      ? targetParent.children
      : targetViewState.rootNodes;

    if (belowTabId !== undefined) {
      const insertIndex = targetSiblings.findIndex((n) => n.tabId === belowTabId);
      if (insertIndex !== -1) {
        targetSiblings.splice(insertIndex, 0, ...nodesToMove);
      } else {
        targetSiblings.push(...nodesToMove);
      }
    } else if (aboveTabId !== undefined) {
      const insertIndex = targetSiblings.findIndex((n) => n.tabId === aboveTabId);
      if (insertIndex !== -1) {
        targetSiblings.splice(insertIndex + 1, 0, ...nodesToMove);
      } else {
        targetSiblings.push(...nodesToMove);
      }
    } else {
      targetSiblings.push(...nodesToMove);
    }

    await this.persistState();
  }

  // ========================================
  // Chrome同期
  // ========================================

  /**
   * 拡張機能の新規インストール時にChromeタブからTreeStateを初期化
   * 設計原則として Chrome → TreeStateManager への同期は通常禁止だが、
   * 新規インストール時のみ許可される唯一の例外
   */
  async initializeFromChromeTabs(): Promise<void> {
    const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });

    for (const window of windows) {
      if (window.id === undefined) continue;

      const windowState = this.getOrCreateWindowState(window.id);
      const viewState = windowState.views[0];

      const tabs = await chrome.tabs.query({ windowId: window.id });
      const sortedTabs = tabs
        .filter((t) => t.id !== undefined)
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      for (const tab of sortedTabs) {
        if (tab.id === undefined) continue;

        if (tab.pinned) {
          viewState.pinnedTabIds.push(tab.id);
        } else {
          viewState.rootNodes.push({
            tabId: tab.id,
            isExpanded: true,
            children: [],
          });
        }
      }
    }

    await this.persistState();

    this.initialized = true;
    this.notifyInitializationComplete();
  }

  /**
   * ブラウザ再起動後の状態復元
   */
  async restoreStateAfterRestart(_userSettings?: {
    newTabPositionManual?: 'child' | 'nextSibling' | 'lastSibling' | 'end';
  }): Promise<void> {
    if (this.initializationInProgress || this.initialized) {
      return;
    }
    this.initializationInProgress = true;

    try {
      await this.loadState();

      const windows = await chrome.windows.getAll({ windowTypes: ['normal'] });

      // ウィンドウIDの対応付け
      // ブラウザ再起動でwindowIdが変わるため、配列順序でマッチング
      const chromeWindowIds = windows
        .filter((w) => w.id !== undefined)
        .map((w) => w.id!)
        .sort((a, b) => a - b);

      const minLength = Math.min(this.windows.length, chromeWindowIds.length);
      for (let i = 0; i < minLength; i++) {
        this.windows[i].windowId = chromeWindowIds[i];
      }

      // 新しいウィンドウを追加
      for (const windowId of chromeWindowIds) {
        if (!this.windows.some((w) => w.windowId === windowId)) {
          this.addWindow(windowId);
        }
      }

      // 存在しないウィンドウを削除
      this.windows = this.windows.filter((w) =>
        chromeWindowIds.includes(w.windowId)
      );

      // グループタブの再作成（足りないグループタブを正しい位置に作成）
      await this.restoreGroupTabs();

      // tabIdのマッチング（tabIdのみを更新、タブの追加・削除は行わない）
      // pinnedTabIdsのマッチングもここで行う
      await this.rebuildTabIds();

      await this.persistState();
      await this.syncTreeStateToChromeTabs();

      this.initialized = true;
      this.notifyInitializationComplete();
    } catch {
      this.initialized = true;
      this.notifyInitializationComplete();
    } finally {
      this.initializationInProgress = false;
    }
  }

  /**
   * グループタブを復元
   * TreeStateを深さ優先で走査し、Chromeタブと前から順番に突き合わせながら、
   * TreeStateにグループノードがあるがChrome側に対応するタブがない場合はその位置にグループタブを作成する
   */
  private async restoreGroupTabs(): Promise<void> {
    const groupTabUrl = `chrome-extension://${chrome.runtime.id}/group.html`;

    for (const windowState of this.windows) {
      let windowTabs = await chrome.tabs.query({ windowId: windowState.windowId });

      windowTabs = windowTabs
        .filter((t) => t.id !== undefined && !t.pinned)
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      const flattenNodes: TabNode[] = [];
      const flattenInNodes = (nodes: TabNode[]): void => {
        for (const node of nodes) {
          flattenNodes.push(node);
          flattenInNodes(node.children);
        }
      };
      for (const viewState of windowState.views) {
        flattenInNodes(viewState.rootNodes);
      }

      let chromeIndex = 0;
      for (let treeIndex = 0; treeIndex < flattenNodes.length; treeIndex++) {
        const node = flattenNodes[treeIndex];

        if (node.groupInfo) {
          const chromeTab = windowTabs[chromeIndex];

          if (chromeTab && chromeTab.url?.startsWith(groupTabUrl)) {
            chromeIndex++;
          } else {
            try {
              const insertIndex = chromeTab?.index ?? windowTabs.length;
              await chrome.tabs.create({
                url: groupTabUrl,
                windowId: windowState.windowId,
                index: insertIndex,
                active: false,
              });

              windowTabs = await chrome.tabs.query({ windowId: windowState.windowId });
              windowTabs = windowTabs
                .filter((t) => t.id !== undefined && !t.pinned)
                .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
              chromeIndex++;
            } catch {
              // ウィンドウが存在しない場合は無視
            }
          }
        } else {
          chromeIndex++;
        }
      }
    }
  }

  /**
   * tabIdを再構築
   * ブラウザ再起動後はtabIdが変わるため、インデックスベースでマッチングを行う
   */
  private async rebuildTabIds(): Promise<void> {
    // サイドパネルURLを除外するためのプレフィックス
    // サイドパネルはUIパネルであり、TreeStateには含めない
    const sidePanelUrlPrefix = `chrome-extension://${chrome.runtime.id}/sidepanel.html`;

    const isSidePanelTab = (tab: chrome.tabs.Tab): boolean => {
      const url = tab.url || tab.pendingUrl || '';
      return url === sidePanelUrlPrefix || url.startsWith(`${sidePanelUrlPrefix}?`);
    };

    for (const windowState of this.windows) {
      const windowTabs = await chrome.tabs.query({ windowId: windowState.windowId });

      // ピン留めタブのtabIdマッチング（インデックスベース）
      // サイドパネルタブは除外
      const chromePinnedTabs = windowTabs
        .filter((t) => t.id !== undefined && t.pinned && !isSidePanelTab(t))
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      // 全ビューのpinnedTabIdsをビュー順序でフラット化
      const orderedOldPinnedIds: number[] = [];
      for (const viewState of windowState.views) {
        for (const id of viewState.pinnedTabIds) {
          orderedOldPinnedIds.push(id);
        }
      }

      // ピン留めタブのマッピング表作成
      const pinnedIdMap = new Map<number, number>();
      for (let i = 0; i < orderedOldPinnedIds.length && i < chromePinnedTabs.length; i++) {
        pinnedIdMap.set(orderedOldPinnedIds[i], chromePinnedTabs[i].id!);
      }

      // 各ビューのpinnedTabIdsを新しいtabIdで更新
      for (const viewState of windowState.views) {
        viewState.pinnedTabIds = viewState.pinnedTabIds
          .map((id) => pinnedIdMap.get(id))
          .filter((id): id is number => id !== undefined);
      }

      // 全Chromeタブ（ピン留め除く、sidepanel含む）をインデックス順にソート
      const chromeAllNonPinned = windowTabs
        .filter((t) => t.id !== undefined && !t.pinned)
        .sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

      // TreeStateのノードを深さ優先でフラット化
      const flattenNodes: TabNode[] = [];
      const flattenInNodes = (nodes: TabNode[]): void => {
        for (const node of nodes) {
          flattenNodes.push(node);
          flattenInNodes(node.children);
        }
      };
      for (const viewState of windowState.views) {
        flattenInNodes(viewState.rootNodes);
      }


      // Step 1: sidepanelタブに対応するノードを特定して削除
      // TreeStateノードとChromeタブをインデックスベースで照合し、
      // sidepanelタブに対応するノードをTreeStateから削除する
      const sidepanelNodeTabIds: number[] = [];
      for (let i = 0; i < flattenNodes.length && i < chromeAllNonPinned.length; i++) {
        const chromeTab = chromeAllNonPinned[i];
        if (isSidePanelTab(chromeTab)) {
          sidepanelNodeTabIds.push(flattenNodes[i].tabId);
        }
      }

      // sidepanelノードをTreeStateから削除
      for (const tabId of sidepanelNodeTabIds) {
        this.removeTabFromTree(tabId, 'close_all');
      }

      // Step 2: 削除後のTreeStateを再度フラット化
      const cleanFlattenNodes: TabNode[] = [];
      const flattenClean = (nodes: TabNode[]): void => {
        for (const node of nodes) {
          cleanFlattenNodes.push(node);
          flattenClean(node.children);
        }
      };
      for (const viewState of windowState.views) {
        flattenClean(viewState.rootNodes);
      }

      // sidepanel除外後のChromeタブ
      const chromeNonPinnedTabs = chromeAllNonPinned.filter((t) => !isSidePanelTab(t));

      // インデックスベースでマッチング
      for (let i = 0; i < cleanFlattenNodes.length && i < chromeNonPinnedTabs.length; i++) {
        const newTabId = chromeNonPinnedTabs[i].id!;
        cleanFlattenNodes[i].tabId = newTabId;
      }
    }
  }

  /**
   * TreeStateの状態をChromeタブに同期
   */
  async syncTreeStateToChromeTabs(windowId?: number): Promise<void> {
    this.isSyncingToChrome = true;
    try {
      const queryOptions = windowId !== undefined ? { windowId } : {};
      const currentTabs = await chrome.tabs.query(queryOptions);

      const windowIds =
        windowId !== undefined
          ? [windowId]
          : [
              ...new Set(
                currentTabs
                  .map((t) => t.windowId)
                  .filter((id): id is number => id !== undefined)
              ),
            ];

      for (const wid of windowIds) {
        await this.syncPinnedStateForWindow(wid, currentTabs);
      }

      const refreshedTabs = await chrome.tabs.query(queryOptions);
      const pinnedSet = new Set<number>();
      for (const tab of refreshedTabs) {
        if (tab.id !== undefined && tab.pinned) {
          pinnedSet.add(tab.id);
        }
      }

      for (const wid of windowIds) {
        await this.syncTabOrderForWindow(wid, pinnedSet);
      }

      await this.closeEmptyWindows();
    } finally {
      this.isSyncingToChrome = false;
    }
  }

  /**
   * ピン留め状態を同期
   * すべてのビューのピン留めタブをChromeに同期
   */
  private async syncPinnedStateForWindow(
    windowId: number,
    currentTabs: chrome.tabs.Tab[]
  ): Promise<void> {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return;

    // すべてのビューのpinnedTabIdsをビュー順序で集約
    const expectedPinnedIds = new Set<number>();
    const orderedPinnedIds: number[] = [];

    for (const viewState of windowState.views) {
      for (const tabId of viewState.pinnedTabIds) {
        orderedPinnedIds.push(tabId);
        expectedPinnedIds.add(tabId);
      }
    }

    const windowTabs = currentTabs.filter((t) => t.windowId === windowId);

    const actuallyPinnedIds = new Set<number>();
    for (const tab of windowTabs) {
      if (tab.id !== undefined && tab.pinned) {
        actuallyPinnedIds.add(tab.id);
      }
    }

    // ピン留めすべきタブをピン留め
    for (const tabId of expectedPinnedIds) {
      if (!actuallyPinnedIds.has(tabId)) {
        try {
          await chrome.tabs.update(tabId, { pinned: true });
        } catch {
          // タブが存在しない場合は無視
        }
      }
    }

    // ピン留め解除すべきタブを解除
    for (const tabId of actuallyPinnedIds) {
      if (!expectedPinnedIds.has(tabId)) {
        try {
          await chrome.tabs.update(tabId, { pinned: false });
        } catch {
          // タブが存在しない場合は無視
        }
      }
    }

    // ピン留めタブの順序を同期（ビュー順序で）
    // 現在のインデックスマップを作成
    const currentIndexMap = new Map<number, number>();
    for (const tab of windowTabs) {
      if (tab.id !== undefined) {
        currentIndexMap.set(tab.id, tab.index);
      }
    }

    for (let i = 0; i < orderedPinnedIds.length; i++) {
      const tabId = orderedPinnedIds[i];
      const currentIndex = currentIndexMap.get(tabId);
      // 既に正しい位置にいる場合は移動しない
      if (currentIndex !== undefined && currentIndex !== i) {
        try {
          await chrome.tabs.move(tabId, { index: i });
          // 移動後にインデックスマップを更新
          const updatedTabs = await chrome.tabs.query({ windowId });
          currentIndexMap.clear();
          for (const tab of updatedTabs) {
            if (tab.id !== undefined) {
              currentIndexMap.set(tab.id, tab.index);
            }
          }
        } catch {
          // タブが存在しない場合は無視
        }
      }
    }
  }

  /**
   * タブの順序を同期
   */
  private async syncTabOrderForWindow(
    windowId: number,
    pinnedSet: Set<number>
  ): Promise<void> {
    const currentTabs = await chrome.tabs.query({ windowId });
    const currentWindowTabIds = new Set<number>();
    for (const tab of currentTabs) {
      if (tab.id !== undefined) {
        currentWindowTabIds.add(tab.id);
      }
    }

    const windowState = this.getWindowState(windowId);
    if (!windowState) return;

    // 深さ優先でタブIDを収集
    const orderedTabIds: number[] = [];
    const traverse = (node: TabNode): void => {
      if (!pinnedSet.has(node.tabId) && currentWindowTabIds.has(node.tabId)) {
        orderedTabIds.push(node.tabId);
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    for (const viewState of windowState.views) {
      for (const rootNode of viewState.rootNodes) {
        traverse(rootNode);
      }
    }

    const pinnedCount = currentTabs.filter((t) => t.pinned).length;

    const currentIndexMap = new Map<number, number>();
    for (const tab of currentTabs) {
      if (tab.id !== undefined) {
        currentIndexMap.set(tab.id, tab.index);
      }
    }

    for (let i = 0; i < orderedTabIds.length; i++) {
      const tabId = orderedTabIds[i];
      const expectedIndex = pinnedCount + i;
      const currentIndex = currentIndexMap.get(tabId);

      if (currentIndex !== undefined && currentIndex !== expectedIndex) {
        try {
          await chrome.tabs.move(tabId, { index: expectedIndex });
          const updatedTabs = await chrome.tabs.query({ windowId });
          currentIndexMap.clear();
          for (const tab of updatedTabs) {
            if (tab.id !== undefined) {
              currentIndexMap.set(tab.id, tab.index);
            }
          }
        } catch {
          // タブが存在しない場合は無視
        }
      }
    }
  }

  /**
   * 空ウィンドウを閉じる
   */
  private async closeEmptyWindows(): Promise<void> {
    try {
      const allWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
      if (allWindows.length <= 1) return;

      for (const window of allWindows) {
        if (window.id === undefined) continue;
        const tabs = await chrome.tabs.query({ windowId: window.id });
        if (tabs.length === 0) {
          const currentWindows = await chrome.windows.getAll({
            windowTypes: ['normal'],
          });
          if (currentWindows.length > 1) {
            await chrome.windows.remove(window.id);
          }
        }
      }
    } catch {
      // ウィンドウクローズ失敗は無視
    }
  }

  async refreshTreeStructure(): Promise<void> {
    try {
      await this.persistState();
    } catch {
      // 永続化失敗は無視
    }
  }

  /**
   * アクティブビューのインデックスを取得
   */
  getActiveViewIndex(windowId: number): number {
    const windowState = this.getWindowState(windowId);
    return windowState?.activeViewIndex ?? 0;
  }

  /**
   * スナップショットからツリー状態を復元
   */
  async restoreTreeStateFromSnapshot(
    snapshotViews: Array<{ id: string; name: string; color: string; icon?: string }>,
    indexToNewTabId: Map<number, number>,
    indexToSnapshot: Map<number, {
      index: number;
      url: string;
      title: string;
      parentIndex: number | null;
      viewId: string;
      isExpanded: boolean;
      pinned: boolean;
      windowIndex?: number;
      groupInfo?: GroupInfo;
    }>,
    closeCurrentTabs: boolean,
    windowIndexToNewWindowId: Map<number, number>
  ): Promise<void> {
    // windowIndexごとにウィンドウ状態を構築
    const windowIndexSet = new Set<number>();
    for (const [, snapshot] of indexToSnapshot) {
      windowIndexSet.add(snapshot.windowIndex ?? 0);
    }

    // 既存ウィンドウをクリア（closeCurrentTabsの場合）
    if (closeCurrentTabs) {
      this.windows = [];
    }

    // ビューIDからビュー情報のマップを構築
    const viewIdToView = new Map<string, { name: string; color: string; icon?: string }>();
    for (const view of snapshotViews) {
      viewIdToView.set(view.id, { name: view.name, color: view.color, icon: view.icon });
    }

    // 各ウィンドウのツリーを構築
    for (const [windowIndex, windowId] of windowIndexToNewWindowId) {
      const windowState = this.getOrCreateWindowState(windowId);

      // ウィンドウ内のビューを構築（ピン留めタブも含める）
      const viewIdSet = new Set<string>();
      for (const [, snapshot] of indexToSnapshot) {
        if ((snapshot.windowIndex ?? 0) === windowIndex) {
          viewIdSet.add(snapshot.viewId);
        }
      }

      // 既存のビューをクリアして再構築
      windowState.views = [];
      for (const viewId of viewIdSet) {
        const viewInfo = viewIdToView.get(viewId);
        windowState.views.push({
          name: viewInfo?.name ?? 'View',
          color: viewInfo?.color ?? '#3B82F6',
          icon: viewInfo?.icon,
          rootNodes: [],
          pinnedTabIds: [],
        });
      }
      if (windowState.views.length === 0) {
        windowState.views.push({
          name: 'Default',
          color: '#3B82F6',
          rootNodes: [],
          pinnedTabIds: [],
        });
      }

      // viewIdからviewIndexへのマッピング
      const viewIdToIndex = new Map<string, number>();
      let vi = 0;
      for (const viewId of viewIdSet) {
        viewIdToIndex.set(viewId, vi);
        vi++;
      }

      // indexToNewTabIdをparentIndexでソート（親が先に処理されるよう）
      const sortedEntries = [...indexToSnapshot.entries()].sort(([indexA], [indexB]) => {
        const snapshotA = indexToSnapshot.get(indexA)!;
        const snapshotB = indexToSnapshot.get(indexB)!;
        // 親がないタブを先に
        if (snapshotA.parentIndex === null && snapshotB.parentIndex !== null) return -1;
        if (snapshotA.parentIndex !== null && snapshotB.parentIndex === null) return 1;
        return indexA - indexB;
      });

      // タブノードを構築
      const indexToNode = new Map<number, TabNode>();

      for (const [index, snapshot] of sortedEntries) {
        if ((snapshot.windowIndex ?? 0) !== windowIndex) continue;

        const newTabId = indexToNewTabId.get(index);
        if (newTabId === undefined) continue;

        const viewIndex = viewIdToIndex.get(snapshot.viewId) ?? 0;

        if (snapshot.pinned) {
          const viewState = windowState.views[viewIndex];
          if (viewState) {
            viewState.pinnedTabIds.push(newTabId);
          }
          continue;
        }

        const node: TabNode = {
          tabId: newTabId,
          isExpanded: snapshot.isExpanded,
          groupInfo: snapshot.groupInfo,
          children: [],
        };
        indexToNode.set(index, node);

        if (snapshot.parentIndex !== null) {
          const parentNode = indexToNode.get(snapshot.parentIndex);
          if (parentNode) {
            parentNode.children.push(node);
            continue;
          }
        }

        // ルートノードとして追加
        if (viewIndex < windowState.views.length) {
          windowState.views[viewIndex].rootNodes.push(node);
        }
      }
    }

    await this.persistState();
  }

  /**
   * ツリーグループを削除（グループタブを閉じ、子を昇格）
   */
  async deleteTreeGroup(tabId: number): Promise<void> {
    const result = this.findNodeByTabId(tabId);
    if (!result || !result.node.groupInfo) return;

    // グループタブを閉じる
    try {
      await chrome.tabs.remove(tabId);
    } catch {
      // タブが存在しない場合は無視
    }

    // 子を昇格
    const siblings = result.parent
      ? result.parent.children
      : result.viewState.rootNodes;
    const nodeIndex = siblings.findIndex((n) => n.tabId === tabId);
    if (nodeIndex !== -1) {
      siblings.splice(nodeIndex, 1, ...result.node.children);
    }

    await this.persistState();
  }

  // ========================================
  // 永続化
  // ========================================

  /**
   * 状態をシリアライズ
   */
  toJSON(): TreeState {
    return {
      windows: this.windows.map((w) => ({
        windowId: w.windowId,
        views: w.views.map((v) => ({
          name: v.name,
          color: v.color,
          icon: v.icon,
          rootNodes: this.serializeNodes(v.rootNodes),
          pinnedTabIds: [...v.pinnedTabIds],
        })),
        activeViewIndex: w.activeViewIndex,
      })),
    };
  }

  /**
   * ノードをシリアライズ
   */
  private serializeNodes(nodes: TabNode[]): TabNode[] {
    return nodes.map((n) => ({
      tabId: n.tabId,
      isExpanded: n.isExpanded,
      groupInfo: n.groupInfo ? { ...n.groupInfo } : undefined,
      children: this.serializeNodes(n.children),
    }));
  }

  /**
   * 状態変更を通知
   */
  notifyStateChanged(): void {
    const payload = this.toJSON();
    chrome.runtime
      .sendMessage({
        type: 'STATE_UPDATED',
        payload,
      })
      .catch(() => {
        // メッセージ送信失敗は無視
      });
  }

  /**
   * ストレージに永続化
   */
  private async persistState(): Promise<void> {
    const treeState = this.toJSON();
    await this.storageService.set(STORAGE_KEYS.TREE_STATE, treeState);
  }

  /**
   * ストレージに保存されたstateが存在するかチェック
   */
  async hasPersistedState(): Promise<boolean> {
    try {
      const state = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
      return !!(state && state.windows && state.windows.length > 0);
    } catch {
      return false;
    }
  }

  /**
   * ストレージから復元
   */
  async loadState(): Promise<void> {
    try {
      const state = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
      if (!state || !state.windows) {
        return;
      }


      this.windows = state.windows.map((w) => ({
        windowId: w.windowId,
        views: w.views.map((v) => ({
          name: v.name,
          color: v.color,
          icon: v.icon,
          rootNodes: this.deserializeNodes(v.rootNodes),
          pinnedTabIds: [...(v.pinnedTabIds || [])],
        })),
        activeViewIndex: w.activeViewIndex,
      }));
    } catch {
      // 復元失敗は無視
    }
  }

  private deserializeNodes(nodes: TabNode[]): TabNode[] {
    if (!nodes || !Array.isArray(nodes)) return [];
    return nodes.map((n) => ({
      tabId: n.tabId,
      isExpanded: n.isExpanded ?? true,
      groupInfo: n.groupInfo ? { ...n.groupInfo } : undefined,
      children: this.deserializeNodes(n.children || []),
    }));
  }
}
