import type { TabNode, TreeState, TreeStructureEntry, IStorageService, ViewState, View } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

/**
 * TreeStateManager
 *
 * タブツリー状態の集中管理と永続化を担当するサービス
 * ビュー毎にタブツリーを管理し、親子関係のビュー不整合を構造的に防止
 */
export class TreeStateManager {
  private views: Map<string, ViewState> = new Map();
  private viewOrder: string[] = [];
  private tabToNode: Map<number, { viewId: string; nodeId: string }> = new Map();
  private currentViewId: string = 'default';
  private currentViewByWindowId: Record<number, string> = {};
  /**
   * ウィンドウ毎のピン留めタブIDリスト（順序付き）
   * TreeStateManagerがピン留め状態のSingle Source of Truth
   */
  private pinnedTabIdsByWindow: Map<number, number[]> = new Map();
  private syncInProgress: boolean = false;
  private syncCompleted: boolean = false;
  private syncCompletedResolvers: (() => void)[] = [];

  constructor(private storageService: IStorageService) {}

  /**
   * 同期が完了しているかどうかを返す
   */
  isSyncCompleted(): boolean {
    return this.syncCompleted;
  }

  /**
   * 同期中かどうかを返す
   */
  isSyncInProgress(): boolean {
    return this.syncInProgress;
  }

  /**
   * 同期が完了するまで待機する
   * タイムアウトを指定可能（デフォルト5秒）
   * @returns 同期が完了したらtrue、タイムアウトしたらfalse
   */
  async waitForSyncComplete(timeoutMs: number = 5000): Promise<boolean> {
    if (this.syncCompleted) {
      return true;
    }

    return new Promise<boolean>((resolve) => {
      const timeoutId = setTimeout(() => {
        const index = this.syncCompletedResolvers.indexOf(resolver);
        if (index !== -1) {
          this.syncCompletedResolvers.splice(index, 1);
        }
        resolve(false);
      }, timeoutMs);

      const resolver = () => {
        clearTimeout(timeoutId);
        resolve(true);
      };

      this.syncCompletedResolvers.push(resolver);
    });
  }

  /**
   * 同期完了を待機しているハンドラーに通知する
   */
  private notifySyncComplete(): void {
    const resolvers = this.syncCompletedResolvers;
    this.syncCompletedResolvers = [];
    resolvers.forEach(resolve => resolve());
  }

  /**
   * テスト用: 内部状態をリセットし、syncCompletedをtrueに設定
   * 本番コードでは使用しない
   */
  resetForTesting(): void {
    this.views.clear();
    this.tabToNode.clear();
    this.syncInProgress = false;
    this.syncCompleted = true;
    this.notifySyncComplete();
  }

  /**
   * E2Eテスト用: 同期状態をリセット前の準備状態にする
   *
   * 【目的】
   * E2Eテストのリセット処理で、次のsyncWithChromeTabsが確実に実行されるよう
   * 同期状態をクリーンにする。
   *
   * 【処理内容】
   * 1. 待機中のウェイター（syncCompletedResolvers）をすべて解決
   *    - これにより、前のテストからの古いウェイターがタイムアウトするのを防ぐ
   * 2. syncCompleted と syncInProgress を false にリセット
   *    - これにより、次のsyncWithChromeTabsが早期リターンせずに実行される
   */
  prepareForSyncReset(): void {
    this.notifySyncComplete();
    this.syncCompletedResolvers = [];
    this.syncCompleted = false;
    this.syncInProgress = false;
  }

  /**
   * 指定されたviewIdのタブツリーを取得
   * @param viewId - ビューID
   * @returns ルートノードの配列
   */
  getTree(viewId: string): TabNode[] {
    const viewState = this.views.get(viewId);
    if (!viewState) return [];

    return viewState.rootNodeIds
      .map((id) => viewState.nodes[id])
      .filter((node): node is TabNode => node !== undefined && node.parentId === null);
  }

  /**
   * tabIdからTabNodeとviewIdを取得
   * @param tabId - タブID
   * @returns { viewId, node } またはnull
   */
  getNodeByTabId(tabId: number): { viewId: string; node: TabNode } | null {
    const mapping = this.tabToNode.get(tabId);
    if (!mapping) return null;

    const viewState = this.views.get(mapping.viewId);
    if (!viewState) return null;

    const node = viewState.nodes[mapping.nodeId];
    if (!node) return null;

    return { viewId: mapping.viewId, node };
  }

  /**
   * nodeIdからTabNodeとviewIdを取得
   * @param nodeId - ノードID
   * @returns { viewId, node } またはnull
   */
  getNodeById(nodeId: string): { viewId: string; node: TabNode } | null {
    for (const [viewId, viewState] of this.views) {
      const node = viewState.nodes[nodeId];
      if (node) {
        return { viewId, node };
      }
    }
    return null;
  }

  /**
   * 指定されたタブの最後の兄弟ノードIDを取得
   * - 親タブがある場合: 同じ親を持つ最後の子のID
   * - ルートレベルの場合: 最後のルートノードのID
   */
  getLastSiblingNodeId(tabId: number): string | undefined {
    const result = this.getNodeByTabId(tabId);
    if (!result) return undefined;

    const { viewId, node } = result;
    const viewState = this.views.get(viewId);
    if (!viewState) return undefined;

    if (node.parentId) {
      const parentNode = viewState.nodes[node.parentId];
      if (!parentNode || parentNode.children.length === 0) return undefined;
      return parentNode.children[parentNode.children.length - 1].id;
    } else {
      if (viewState.rootNodeIds.length === 0) return undefined;
      return viewState.rootNodeIds[viewState.rootNodeIds.length - 1];
    }
  }

  /**
   * ビューを作成
   */
  createView(info: View): void {
    if (this.views.has(info.id)) return;

    this.views.set(info.id, {
      info,
      rootNodeIds: [],
      nodes: {},
    });
    if (!this.viewOrder.includes(info.id)) {
      this.viewOrder.push(info.id);
    }
  }

  /**
   * ビューの順序を取得
   */
  getViewOrder(): string[] {
    return [...this.viewOrder];
  }

  /**
   * ビューの順序を変更
   */
  reorderViews(newOrder: string[]): void {
    this.viewOrder = newOrder.filter(id => this.views.has(id));
    for (const [viewId] of this.views) {
      if (!this.viewOrder.includes(viewId)) {
        this.viewOrder.push(viewId);
      }
    }
  }

  /**
   * ビューを削除
   * ビュー内のタブは指定されたターゲットビューに移動
   */
  async deleteView(viewId: string, targetViewId: string): Promise<void> {
    if (viewId === 'default') return;

    const viewState = this.views.get(viewId);
    if (!viewState) return;

    const targetView = this.views.get(targetViewId);
    if (!targetView) return;

    for (const nodeId of Object.keys(viewState.nodes)) {
      const node = viewState.nodes[nodeId];
      if (node) {
        node.parentId = null;
        node.depth = 0;
        targetView.nodes[nodeId] = node;
        targetView.rootNodeIds.push(nodeId);

        const mapping = this.tabToNode.get(node.tabId);
        if (mapping) {
          this.tabToNode.set(node.tabId, { viewId: targetViewId, nodeId });
        }
      }
    }

    this.views.delete(viewId);
    this.viewOrder = this.viewOrder.filter(id => id !== viewId);

    for (const windowId of Object.keys(this.currentViewByWindowId)) {
      if (this.currentViewByWindowId[Number(windowId)] === viewId) {
        this.currentViewByWindowId[Number(windowId)] = targetViewId;
      }
    }

    if (this.currentViewId === viewId) {
      this.currentViewId = targetViewId;
    }

    await this.persistState();
  }

  /**
   * ビュー情報を更新
   */
  async updateView(viewId: string, updates: Partial<View>): Promise<void> {
    const viewState = this.views.get(viewId);
    if (!viewState) return;

    viewState.info = { ...viewState.info, ...updates };
    await this.persistState();
  }

  /**
   * 新しいタブを追加
   * @param tab - Chrome タブオブジェクト
   * @param parentId - 親ノードID（nullの場合はルートノード）
   * @param viewId - ビューID
   * @param insertAfterNodeId - このノードの直後に挿入（兄弟配置時に使用）
   */
  async addTab(
    tab: chrome.tabs.Tab,
    parentId: string | null,
    viewId: string,
    insertAfterNodeId?: string,
  ): Promise<void> {
    if (!tab.id) {
      throw new Error('Tab ID is required');
    }

    if (!this.views.has(viewId)) {
      this.createView({
        id: viewId,
        name: viewId === 'default' ? 'Default' : 'View',
        color: '#3B82F6',
      });
    }

    const viewState = this.views.get(viewId)!;
    const nodeId = `node-${tab.id}`;
    const parentNode = parentId ? viewState.nodes[parentId] : null;
    const depth = parentNode ? parentNode.depth + 1 : 0;

    const newNode: TabNode = {
      id: nodeId,
      tabId: tab.id,
      parentId,
      children: [],
      isExpanded: true,
      depth,
      groupId: undefined,
    };

    viewState.nodes[nodeId] = newNode;
    this.tabToNode.set(tab.id, { viewId, nodeId });

    if (!parentId) {
      if (insertAfterNodeId) {
        const insertAfterIndex = viewState.rootNodeIds.indexOf(insertAfterNodeId);
        if (insertAfterIndex !== -1) {
          viewState.rootNodeIds.splice(insertAfterIndex + 1, 0, nodeId);
        } else {
          viewState.rootNodeIds.push(nodeId);
        }
      } else {
        viewState.rootNodeIds.push(nodeId);
      }
    } else {
      if (parentNode) {
        if (insertAfterNodeId) {
          const insertAfterIndex = parentNode.children.findIndex(
            (child) => child.id === insertAfterNodeId
          );
          if (insertAfterIndex !== -1) {
            parentNode.children.splice(insertAfterIndex + 1, 0, newNode);
          } else {
            parentNode.children.push(newNode);
          }
        } else {
          parentNode.children.push(newNode);
        }
      }
    }

    await this.persistState();
  }

  /**
   * タブの親タブIDを取得
   * @param tabId - タブID
   * @returns 親タブID（ルートタブの場合はnull）
   */
  getParentTabId(tabId: number): number | null {
    const mapping = this.tabToNode.get(tabId);
    if (!mapping) return null;

    const viewState = this.views.get(mapping.viewId);
    if (!viewState) return null;

    const node = viewState.nodes[mapping.nodeId];
    if (!node || !node.parentId) return null;

    const parentNode = viewState.nodes[node.parentId];
    return parentNode?.tabId ?? null;
  }

  /**
   * タブを削除
   * @param tabId - タブID
   * @param childTabBehavior - 子タブの処理方法 ('promote' | 'close_all')
   * @returns 閉じられたタブIDの配列（close_allの場合）
   */
  async removeTab(
    tabId: number,
    childTabBehavior: 'promote' | 'close_all' = 'promote',
  ): Promise<number[]> {
    const mapping = this.tabToNode.get(tabId);
    if (!mapping) return [];

    const viewState = this.views.get(mapping.viewId);
    if (!viewState) return [];

    const node = viewState.nodes[mapping.nodeId];
    if (!node) return [];

    const closedTabIds: number[] = [tabId];

    if (childTabBehavior === 'promote') {
      this.promoteChildren(viewState, node);
    } else if (childTabBehavior === 'close_all') {
      const childTabIds = this.removeChildrenRecursively(viewState, node);
      closedTabIds.push(...childTabIds);
    }

    if (node.parentId) {
      const parentNode = viewState.nodes[node.parentId];
      if (parentNode) {
        parentNode.children = parentNode.children.filter((child) => child.id !== node.id);
      }
    } else {
      viewState.rootNodeIds = viewState.rootNodeIds.filter((id) => id !== node.id);
    }

    delete viewState.nodes[node.id];
    this.tabToNode.delete(tabId);

    await this.persistState();

    return closedTabIds;
  }

  /**
   * ノードを同一ビュー内で移動
   */
  async moveNode(
    nodeId: string,
    newParentId: string | null,
    index: number,
  ): Promise<void> {
    const result = this.getNodeById(nodeId);
    if (!result) return;

    const { viewId, node } = result;
    const viewState = this.views.get(viewId);
    if (!viewState) return;

    // 自分自身の子孫には移動できない
    if (newParentId && this.isDescendant(viewState, nodeId, newParentId)) {
      return;
    }

    if (newParentId === nodeId) {
      return;
    }

    if (node.parentId) {
      const oldParent = viewState.nodes[node.parentId];
      if (oldParent) {
        oldParent.children = oldParent.children.filter((child) => child.id !== nodeId);
      }
    } else {
      viewState.rootNodeIds = viewState.rootNodeIds.filter((id) => id !== nodeId);
    }

    node.parentId = newParentId;
    node.depth = newParentId ? (viewState.nodes[newParentId]?.depth || 0) + 1 : 0;

    this.updateChildrenDepth(node);

    if (newParentId) {
      const newParent = viewState.nodes[newParentId];
      if (newParent) {
        newParent.children.splice(index, 0, node);
      }
    } else {
      viewState.rootNodeIds.splice(index, 0, nodeId);
    }

    await this.persistState();
  }

  /**
   * タブノードをルートノードの最後尾に移動
   * ウィンドウ間移動時に使用（移動先ウィンドウの最後尾に表示するため）
   */
  async moveTabToRootEnd(tabId: number): Promise<void> {
    const mapping = this.tabToNode.get(tabId);
    if (!mapping) return;

    const viewState = this.views.get(mapping.viewId);
    if (!viewState) return;

    const node = viewState.nodes[mapping.nodeId];
    if (!node) return;

    if (node.parentId) {
      const parent = viewState.nodes[node.parentId];
      if (parent) {
        parent.children = parent.children.filter((child) => child.id !== node.id);
      }
    } else {
      viewState.rootNodeIds = viewState.rootNodeIds.filter((id) => id !== node.id);
    }

    node.parentId = null;
    node.depth = 0;
    this.updateChildrenDepth(node);
    viewState.rootNodeIds.push(node.id);

    await this.persistState();
  }

  /**
   * サブツリー全体を別のビューに移動
   */
  async moveSubtreeToView(tabId: number, targetViewId: string): Promise<void> {
    const mapping = this.tabToNode.get(tabId);
    if (!mapping) return;

    const sourceViewState = this.views.get(mapping.viewId);
    if (!sourceViewState) return;

    if (!this.views.has(targetViewId)) {
      this.createView({
        id: targetViewId,
        name: 'View',
        color: '#3B82F6',
      });
    }

    const targetViewState = this.views.get(targetViewId)!;
    const rootNode = sourceViewState.nodes[mapping.nodeId];
    if (!rootNode) return;

    const subtreeNodes: TabNode[] = [];
    this.collectSubtreeNodes(rootNode, subtreeNodes);

    if (rootNode.parentId) {
      const parentNode = sourceViewState.nodes[rootNode.parentId];
      if (parentNode) {
        parentNode.children = parentNode.children.filter((child) => child.id !== rootNode.id);
      }
    } else {
      sourceViewState.rootNodeIds = sourceViewState.rootNodeIds.filter((id) => id !== rootNode.id);
    }

    for (const node of subtreeNodes) {
      delete sourceViewState.nodes[node.id];
      targetViewState.nodes[node.id] = node;

      this.tabToNode.set(node.tabId, { viewId: targetViewId, nodeId: node.id });
    }

    rootNode.parentId = null;
    rootNode.depth = 0;
    this.updateChildrenDepth(rootNode);
    targetViewState.rootNodeIds.push(rootNode.id);

    await this.persistState();
  }

  /**
   * ノードの展開状態を切り替え
   */
  async toggleExpand(nodeId: string): Promise<void> {
    const result = this.getNodeById(nodeId);
    if (!result) return;

    result.node.isExpanded = !result.node.isExpanded;
    await this.persistState();
  }

  /**
   * ノードを展開する
   */
  async expandNode(nodeId: string): Promise<void> {
    const result = this.getNodeById(nodeId);
    if (!result) return;

    if (result.node.isExpanded) return;

    result.node.isExpanded = true;
    await this.persistState();
  }

  /**
   * 存在しないタブをクリーンアップ
   */
  async cleanupStaleNodes(existingTabIds: number[]): Promise<number> {
    const existingTabIdSet = new Set(existingTabIds);
    const staleTabIds: number[] = [];

    this.tabToNode.forEach((_, tabId) => {
      if (!existingTabIdSet.has(tabId)) {
        staleTabIds.push(tabId);
      }
    });

    if (staleTabIds.length === 0) {
      return 0;
    }

    for (const tabId of staleTabIds) {
      await this.removeStaleNode(tabId);
    }

    return staleTabIds.length;
  }

  /**
   * 存在しないタブノードを削除（内部用）
   */
  private async removeStaleNode(tabId: number): Promise<void> {
    const mapping = this.tabToNode.get(tabId);
    if (!mapping) return;

    const viewState = this.views.get(mapping.viewId);
    if (!viewState) return;

    const node = viewState.nodes[mapping.nodeId];
    if (!node) return;

    this.promoteChildren(viewState, node);

    if (node.parentId) {
      const parentNode = viewState.nodes[node.parentId];
      if (parentNode) {
        parentNode.children = parentNode.children.filter((child) => child.id !== node.id);
      }
    } else {
      viewState.rootNodeIds = viewState.rootNodeIds.filter((id) => id !== node.id);
    }

    delete viewState.nodes[node.id];
    this.tabToNode.delete(tabId);
  }

  /**
   * chrome.tabs APIと同期
   */
  async syncWithChromeTabs(userSettings?: {
    newTabPositionManual?: 'child' | 'nextSibling' | 'lastSibling' | 'end';
  }): Promise<void> {
    if (this.syncInProgress || this.syncCompleted) {
      return;
    }
    this.syncInProgress = true;

    try {
      await this.loadState();

      const tabs = await chrome.tabs.query({});
      const defaultViewId = 'default';

      if (!this.views.has(defaultViewId)) {
        this.createView({
          id: defaultViewId,
          name: 'Default',
          color: '#3B82F6',
        });
      }

      const state = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
      const treeStructure = state?.treeStructure;

      if (treeStructure && treeStructure.length > 0) {
        await this.restoreFromTreeStructure(tabs, treeStructure, defaultViewId, userSettings);
      } else {
        await this.syncWithOpenerTabId(tabs, defaultViewId, userSettings);
      }

      const hasPinnedData = this.pinnedTabIdsByWindow.size > 0;
      if (!hasPinnedData) {
        const pinnedTabs = tabs.filter(t => t.pinned && t.id !== undefined);
        for (const tab of pinnedTabs) {
          if (tab.windowId === undefined || tab.id === undefined) continue;
          const windowPinned = this.pinnedTabIdsByWindow.get(tab.windowId) ?? [];
          windowPinned.push(tab.id);
          this.pinnedTabIdsByWindow.set(tab.windowId, windowPinned);
        }
      }

      await this.persistState();

      await this.syncTreeStateToChromeTabs();

      this.syncCompleted = true;
      this.notifySyncComplete();
    } catch {
      this.syncCompleted = true;
      this.notifySyncComplete();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 現在のメモリ状態をストレージに永続化する
   *
   * TreeStateManagerはSingle Source of Truthであり、メモリ上の状態が常に正しい。
   * ストレージからの再読込み（loadState）は行わない。
   * loadStateを呼ぶと、進行中の操作（addTab等）で追加された状態が失われる可能性がある。
   */
  async refreshTreeStructure(): Promise<void> {
    try {
      await this.persistState();
    } catch {
      // 永続化失敗は無視（次回のアラームで再試行される）
    }
  }

  /**
   * TreeStateManagerの状態をChromeタブに冪等に反映する
   *
   * この関数は冪等であり、TreeStateManagerの状態が変わらない限り
   * 何回呼び出しても同じ結果になる。
   *
   * 同期内容：
   * - TreeStateManagerに存在しないタブの削除
   * - タブの順序（chrome.tabs.move）
   * - ピン留め状態（chrome.tabs.update({pinned})）
   *
   * @param windowId - 対象ウィンドウID（省略時は全ウィンドウ）
   */
  async syncTreeStateToChromeTabs(windowId?: number): Promise<void> {
    // 現在のChromeタブを取得
    const queryOptions = windowId !== undefined ? { windowId } : {};
    const currentTabs = await chrome.tabs.query(queryOptions);

    const windowIds = windowId !== undefined
      ? [windowId]
      : [...new Set(currentTabs.map(t => t.windowId).filter((id): id is number => id !== undefined))];

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
  }

  /**
   * 指定ウィンドウのピン留め状態を同期
   * TreeStateManagerのpinnedTabIdsByWindowが正
   */
  private async syncPinnedStateForWindow(windowId: number, currentTabs: chrome.tabs.Tab[]): Promise<void> {
    const expectedPinnedIds = new Set(this.pinnedTabIdsByWindow.get(windowId) ?? []);
    const windowTabs = currentTabs.filter(t => t.windowId === windowId);

    const actuallyPinnedIds = new Set<number>();
    for (const tab of windowTabs) {
      if (tab.id !== undefined && tab.pinned) {
        actuallyPinnedIds.add(tab.id);
      }
    }

    for (const tabId of expectedPinnedIds) {
      if (!actuallyPinnedIds.has(tabId)) {
        try {
          await chrome.tabs.update(tabId, { pinned: true });
        } catch {
          // タブが存在しない場合は無視
        }
      }
    }

    for (const tabId of actuallyPinnedIds) {
      if (!expectedPinnedIds.has(tabId)) {
        try {
          await chrome.tabs.update(tabId, { pinned: false });
        } catch {
          // タブが存在しない場合は無視
        }
      }
    }

    const expectedOrder = this.pinnedTabIdsByWindow.get(windowId) ?? [];
    for (let i = 0; i < expectedOrder.length; i++) {
      const tabId = expectedOrder[i];
      try {
        await chrome.tabs.move(tabId, { index: i });
      } catch {
        // タブが存在しない場合は無視
      }
    }
  }

  /**
   * 指定ウィンドウのタブ順序を同期
   */
  private async syncTabOrderForWindow(windowId: number, pinnedSet: Set<number>): Promise<void> {
    const currentTabs = await chrome.tabs.query({ windowId });
    const currentWindowTabIds = new Set<number>();
    for (const tab of currentTabs) {
      if (tab.id !== undefined) {
        currentWindowTabIds.add(tab.id);
      }
    }

    const orderedTabIds: number[] = [];
    const traverse = (node: TabNode): void => {
      if (!pinnedSet.has(node.tabId) && currentWindowTabIds.has(node.tabId)) {
        orderedTabIds.push(node.tabId);
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    for (const viewId of this.viewOrder) {
      const viewState = this.views.get(viewId);
      if (!viewState) continue;

      for (const rootNodeId of viewState.rootNodeIds) {
        const rootNode = viewState.nodes[rootNodeId];
        if (rootNode && !rootNode.parentId) {
          traverse(rootNode);
        }
      }
    }

    const pinnedCount = currentTabs.filter(t => t.pinned).length;

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
   * 指定ウィンドウのピン留めタブIDリストを取得
   */
  getPinnedTabIds(windowId: number): number[] {
    return this.pinnedTabIdsByWindow.get(windowId) ?? [];
  }

  /**
   * タブをピン留め状態に変更（メモリ状態のみ更新）
   * 実際のChromeタブのピン留めはsyncTreeStateToChromeTabs()で行う
   */
  async pinTabs(tabIds: number[], windowId: number): Promise<void> {
    const pinnedList = this.pinnedTabIdsByWindow.get(windowId) ?? [];

    for (const tabId of tabIds) {
      if (!pinnedList.includes(tabId)) {
        pinnedList.push(tabId);
      }
    }

    this.pinnedTabIdsByWindow.set(windowId, pinnedList);
    await this.persistState();
  }

  /**
   * タブのピン留めを解除（メモリ状態のみ更新）
   * 実際のChromeタブのピン留め解除はsyncTreeStateToChromeTabs()で行う
   */
  async unpinTabs(tabIds: number[], windowId: number): Promise<void> {
    const pinnedList = this.pinnedTabIdsByWindow.get(windowId) ?? [];
    const tabIdSet = new Set(tabIds);

    const newPinnedList = pinnedList.filter(id => !tabIdSet.has(id));
    this.pinnedTabIdsByWindow.set(windowId, newPinnedList);
    await this.persistState();
  }

  /**
   * ピン留めタブの順序を変更（メモリ状態のみ更新）
   * 実際のChromeタブの順序変更はsyncTreeStateToChromeTabs()で行う
   */
  async reorderPinnedTab(tabId: number, newIndex: number, windowId: number): Promise<void> {
    const pinnedList = this.pinnedTabIdsByWindow.get(windowId) ?? [];
    const currentIndex = pinnedList.indexOf(tabId);

    if (currentIndex === -1) return;
    if (newIndex < 0 || newIndex >= pinnedList.length) return;
    if (currentIndex === newIndex) return;

    pinnedList.splice(currentIndex, 1);
    pinnedList.splice(newIndex, 0, tabId);

    this.pinnedTabIdsByWindow.set(windowId, pinnedList);
    await this.persistState();
  }

  /**
   * Chromeイベントからのピン留め状態変更を反映
   * chrome.tabs.onUpdatedでpinnedが変わった場合に呼び出す
   */
  updatePinnedStateFromChromeEvent(tabId: number, windowId: number, isPinned: boolean): void {
    const pinnedList = this.pinnedTabIdsByWindow.get(windowId) ?? [];
    const isInList = pinnedList.includes(tabId);

    if (isPinned && !isInList) {
      pinnedList.push(tabId);
      this.pinnedTabIdsByWindow.set(windowId, pinnedList);
    } else if (!isPinned && isInList) {
      const newList = pinnedList.filter(id => id !== tabId);
      this.pinnedTabIdsByWindow.set(windowId, newList);
    }
  }

  /**
   * Chromeのピン留めタブ順序をTreeStateManagerに反映
   * chrome.tabs.onMovedでピン留めタブが移動された場合に呼び出す
   */
  async syncPinnedOrderFromChrome(windowId: number): Promise<void> {
    const tabs = await chrome.tabs.query({ windowId, pinned: true });
    tabs.sort((a, b) => a.index - b.index);
    const pinnedOrder = tabs.filter(t => t.id !== undefined).map(t => t.id!);
    this.pinnedTabIdsByWindow.set(windowId, pinnedOrder);
  }

  /**
   * treeStructureから親子関係を復元
   */
  private async restoreFromTreeStructure(
    tabs: chrome.tabs.Tab[],
    treeStructure: TreeStructureEntry[],
    defaultViewId: string,
    userSettings?: { newTabPositionManual?: 'child' | 'nextSibling' | 'lastSibling' | 'end' },
  ): Promise<void> {
    const currentTabIds = new Set(tabs.filter(t => t.id).map(t => t.id!));

    for (const [, viewState] of this.views) {
      const staleNodeIds: string[] = [];
      for (const nodeId of Object.keys(viewState.nodes)) {
        const node = viewState.nodes[nodeId];
        if (!currentTabIds.has(node.tabId)) {
          staleNodeIds.push(nodeId);
        }
      }

      for (const nodeId of staleNodeIds) {
        const node = viewState.nodes[nodeId];
        if (node) {
          this.tabToNode.delete(node.tabId);
          delete viewState.nodes[nodeId];
          viewState.rootNodeIds = viewState.rootNodeIds.filter(id => id !== nodeId);
        }
      }
    }

    const sortedTabs = [...tabs].filter(t => t.id).sort((a, b) => a.index - b.index);

    const indexToStructureEntry = new Map<number, { structureIndex: number; entry: TreeStructureEntry }>();
    for (let i = 0; i < treeStructure.length; i++) {
      const entry = treeStructure[i];
      indexToStructureEntry.set(entry.index, { structureIndex: i, entry });
    }

    const structureIndexToTabId = new Map<number, number>();
    const matchedTabIds = new Set<number>();

    for (const tab of sortedTabs) {
      if (!tab.id) continue;
      const structureData = indexToStructureEntry.get(tab.index);
      if (structureData && !matchedTabIds.has(tab.id)) {
        structureIndexToTabId.set(structureData.structureIndex, tab.id);
        matchedTabIds.add(tab.id);
      }
    }

    for (let i = 0; i < treeStructure.length; i++) {
      const tabId = structureIndexToTabId.get(i);
      if (!tabId) continue;

      const tab = tabs.find(t => t.id === tabId);
      if (!tab || !tab.id) continue;

      const entry = treeStructure[i];
      const viewId = entry.viewId || defaultViewId;

      const existing = this.tabToNode.get(tab.id);
      if (existing) {
        const viewState = this.views.get(existing.viewId);
        if (viewState) {
          const node = viewState.nodes[existing.nodeId];
          if (node) {
            node.isExpanded = entry.isExpanded;
          }
        }
        continue;
      }

      await this.addTab(tab, null, viewId);

      const mapping = this.tabToNode.get(tab.id);
      if (mapping) {
        const viewState = this.views.get(mapping.viewId);
        if (viewState) {
          const node = viewState.nodes[mapping.nodeId];
          if (node) {
            node.isExpanded = entry.isExpanded;
          }
        }
      }
    }

    const entriesWithDepth: Array<{ index: number; entry: TreeStructureEntry; depth: number }> = [];
    for (let i = 0; i < treeStructure.length; i++) {
      const entry = treeStructure[i];
      let depth = 0;
      let currentParentIndex = entry.parentIndex;
      while (currentParentIndex !== null) {
        depth++;
        currentParentIndex = treeStructure[currentParentIndex]?.parentIndex ?? null;
      }
      entriesWithDepth.push({ index: i, entry, depth });
    }
    entriesWithDepth.sort((a, b) => a.depth - b.depth);

    for (const { index: i, entry } of entriesWithDepth) {
      if (entry.parentIndex === null) continue;

      const tabId = structureIndexToTabId.get(i);
      const parentTabId = structureIndexToTabId.get(entry.parentIndex);
      if (!tabId || !parentTabId) continue;

      const childMapping = this.tabToNode.get(tabId);
      const parentMapping = this.tabToNode.get(parentTabId);
      if (!childMapping || !parentMapping) continue;

      if (childMapping.viewId !== parentMapping.viewId) continue;

      const viewState = this.views.get(childMapping.viewId);
      if (!viewState) continue;

      const childNode = viewState.nodes[childMapping.nodeId];
      const parentNode = viewState.nodes[parentMapping.nodeId];
      if (!childNode || !parentNode) continue;

      if (childNode.parentId === parentNode.id) continue;

      if (childNode.parentId) {
        const oldParent = viewState.nodes[childNode.parentId];
        if (oldParent) {
          oldParent.children = oldParent.children.filter(c => c.id !== childNode.id);
        }
      } else {
        viewState.rootNodeIds = viewState.rootNodeIds.filter(id => id !== childNode.id);
      }

      childNode.parentId = parentNode.id;
      childNode.depth = parentNode.depth + 1;

      if (!parentNode.children.some(c => c.id === childNode.id)) {
        parentNode.children.push(childNode);
      }

      this.updateChildrenDepth(childNode);
    }

    const newTabPosition = userSettings?.newTabPositionManual ?? 'end';

    for (const tab of tabs) {
      if (!tab.id) continue;
      if (matchedTabIds.has(tab.id)) continue;

      const existing = this.tabToNode.get(tab.id);
      if (!existing) {
        let parentId: string | null = null;

        if (newTabPosition !== 'end' && tab.openerTabId) {
          const parentMapping = this.tabToNode.get(tab.openerTabId);
          parentId = parentMapping?.nodeId || null;
        }

        await this.addTab(tab, parentId, defaultViewId);

        if (newTabPosition === 'end' && tab.windowId !== undefined) {
          try {
            await chrome.tabs.move(tab.id, { index: -1 });
          } catch {
            // ignore
          }
        }
      }
    }
  }

  /**
   * openerTabIdを使って親子関係を復元
   */
  private async syncWithOpenerTabId(
    tabs: chrome.tabs.Tab[],
    defaultViewId: string,
    userSettings?: { newTabPositionManual?: 'child' | 'nextSibling' | 'lastSibling' | 'end' },
  ): Promise<void> {
    const tabsMap = new Map(tabs.filter(t => t.id).map(t => [t.id!, t]));
    const processedTabs = new Set<number>();
    const orderedTabs: chrome.tabs.Tab[] = [];
    const newTabPosition = userSettings?.newTabPositionManual ?? 'end';

    const addTabAndChildren = (tab: chrome.tabs.Tab) => {
      if (!tab.id || processedTabs.has(tab.id)) return;

      if (tab.openerTabId && tabsMap.has(tab.openerTabId)) {
        addTabAndChildren(tabsMap.get(tab.openerTabId)!);
      }

      processedTabs.add(tab.id);
      orderedTabs.push(tab);
    };

    for (const tab of tabs) {
      if (tab.id) {
        addTabAndChildren(tab);
      }
    }

    for (const tab of orderedTabs) {
      if (!tab.id) continue;

      const existing = this.tabToNode.get(tab.id);
      if (!existing) {
        let parentId: string | null = null;

        if (newTabPosition !== 'end' && tab.openerTabId) {
          const parentMapping = this.tabToNode.get(tab.openerTabId);
          parentId = parentMapping?.nodeId || null;
        }

        await this.addTab(tab, parentId, defaultViewId);

        if (newTabPosition === 'end' && tab.windowId !== undefined) {
          try {
            await chrome.tabs.move(tab.id, { index: -1 });
          } catch {
            // ignore
          }
        }
      }
    }
  }

  /**
   * サブツリー全体のノード数を取得
   */
  getSubtreeSize(tabId: number): number {
    const result = this.getNodeByTabId(tabId);
    if (!result) return 0;
    return this.countSubtreeNodes(result.node);
  }

  /**
   * サブツリー全体のノードを取得
   */
  getSubtree(tabId: number): TabNode[] {
    const result = this.getNodeByTabId(tabId);
    if (!result) return [];

    const subtree: TabNode[] = [];
    this.collectSubtreeNodes(result.node, subtree);
    return subtree;
  }

  /**
   * タブIDを置き換える
   */
  async replaceTabId(oldTabId: number, newTabId: number): Promise<void> {
    const mapping = this.tabToNode.get(oldTabId);
    if (!mapping) return;

    const viewState = this.views.get(mapping.viewId);
    if (!viewState) return;

    const node = viewState.nodes[mapping.nodeId];
    if (!node) return;

    node.tabId = newTabId;
    this.tabToNode.delete(oldTabId);
    this.tabToNode.set(newTabId, mapping);

    await this.persistState();
  }

  /**
   * グループを作成
   */
  async createGroupWithRealTab(groupTabId: number, tabIds: number[], groupName: string = '新しいグループ'): Promise<string> {
    if (tabIds.length === 0) {
      throw new Error('No tabs specified for grouping');
    }

    const firstMapping = this.tabToNode.get(tabIds[0]);
    if (!firstMapping) {
      throw new Error('First tab not found');
    }

    const viewId = firstMapping.viewId;
    const viewState = this.views.get(viewId);
    if (!viewState) {
      throw new Error('View not found');
    }

    const groupNodeId = `group-${groupTabId}`;

    const parentIds = new Set<string | null>();
    for (const tabId of tabIds) {
      const mapping = this.tabToNode.get(tabId);
      if (mapping && mapping.viewId === viewId) {
        const node = viewState.nodes[mapping.nodeId];
        if (node) {
          parentIds.add(node.parentId);
        }
      }
    }

    const allSameParent = parentIds.size === 1;
    const firstNode = viewState.nodes[firstMapping.nodeId];
    const commonParentId = allSameParent ? firstNode?.parentId : null;
    const groupDepth = commonParentId !== null ? (viewState.nodes[commonParentId]?.depth ?? 0) + 1 : 0;

    const groupNode: TabNode = {
      id: groupNodeId,
      tabId: groupTabId,
      parentId: commonParentId,
      children: [],
      isExpanded: true,
      depth: groupDepth,
      groupId: groupNodeId,
    };

    viewState.nodes[groupNodeId] = groupNode;
    this.tabToNode.set(groupTabId, { viewId, nodeId: groupNodeId });

    if (commonParentId === null) {
      const firstNodeIndex = viewState.rootNodeIds.findIndex((nodeId) => {
        const node = viewState.nodes[nodeId];
        return node && tabIds.includes(node.tabId);
      });
      if (firstNodeIndex >= 0) {
        viewState.rootNodeIds.splice(firstNodeIndex, 0, groupNodeId);
      } else {
        viewState.rootNodeIds.push(groupNodeId);
      }
    } else {
      const parentNode = viewState.nodes[commonParentId];
      if (parentNode) {
        const firstChildIndex = parentNode.children.findIndex(
          (child) => tabIds.includes(child.tabId)
        );
        if (firstChildIndex >= 0) {
          parentNode.children.splice(firstChildIndex, 0, groupNode);
        } else {
          parentNode.children.push(groupNode);
        }
      }
    }

    for (const tabId of tabIds) {
      const mapping = this.tabToNode.get(tabId);
      if (!mapping || mapping.viewId !== viewId) continue;

      const node = viewState.nodes[mapping.nodeId];
      if (!node) continue;

      if (node.parentId) {
        const oldParent = viewState.nodes[node.parentId];
        if (oldParent) {
          oldParent.children = oldParent.children.filter((child) => child.id !== node.id);
        }
      } else {
        viewState.rootNodeIds = viewState.rootNodeIds.filter((id) => id !== node.id);
      }

      node.parentId = groupNodeId;
      node.depth = groupDepth + 1;
      node.groupId = groupNodeId;
      groupNode.children.push(node);

      this.updateChildrenDepth(node);
    }

    await this.persistState();

    try {
      const result = await chrome.storage.local.get('groups');
      const existingGroups: Record<string, { id: string; name: string; color: string; isExpanded: boolean }> = (result.groups as Record<string, { id: string; name: string; color: string; isExpanded: boolean }> | undefined) || {};
      existingGroups[groupNodeId] = {
        id: groupNodeId,
        name: groupName,
        color: '#f59e0b',
        isExpanded: true,
      };
      await chrome.storage.local.set({ groups: existingGroups });
    } catch {
      // ignore
    }

    return groupNodeId;
  }

  /**
   * グループを解除
   */
  async dissolveGroup(tabId: number): Promise<void> {
    const result = this.getNodeByTabId(tabId);
    if (!result) {
      throw new Error('Tab not found');
    }

    const { viewId, node } = result;
    const viewState = this.views.get(viewId);
    if (!viewState) {
      throw new Error('View not found');
    }

    let groupNode: TabNode | null = null;

    if (node.id.startsWith('group-')) {
      groupNode = node;
    } else if (node.groupId) {
      groupNode = viewState.nodes[node.groupId] || null;
    }

    if (!groupNode) {
      throw new Error('Group not found');
    }

    for (const child of [...groupNode.children]) {
      child.parentId = null;
      child.depth = 0;
      child.groupId = undefined;
      this.updateChildrenDepth(child);
      viewState.rootNodeIds.push(child.id);
    }

    if (groupNode.parentId) {
      const parentNode = viewState.nodes[groupNode.parentId];
      if (parentNode) {
        parentNode.children = parentNode.children.filter((child) => child.id !== groupNode!.id);
      }
    } else {
      viewState.rootNodeIds = viewState.rootNodeIds.filter((id) => id !== groupNode!.id);
    }

    delete viewState.nodes[groupNode.id];
    this.tabToNode.delete(groupNode.tabId);

    await this.persistState();
  }

  /**
   * グループ情報を取得
   */
  async getGroupInfo(tabId: number): Promise<{
    name: string;
    children: Array<{ tabId: number; title: string; url: string }>;
  }> {
    const result = this.getNodeByTabId(tabId);
    if (!result) {
      throw new Error('Group not found');
    }

    if (!result.node.id.startsWith('group-')) {
      throw new Error('Not a group tab');
    }

    let groupName = '新しいグループ';
    try {
      const storageResult = await chrome.storage.local.get('groups');
      const groups: Record<string, { id: string; name: string; color: string; isExpanded: boolean }> = (storageResult.groups as Record<string, { id: string; name: string; color: string; isExpanded: boolean }> | undefined) || {};
      if (groups[result.node.id]) {
        groupName = groups[result.node.id].name;
      }
    } catch {
      // ignore
    }

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
        // ignore
      }
    }

    return { name: groupName, children };
  }

  /**
   * すべてのビューを取得
   */
  getAllViews(): View[] {
    return Array.from(this.views.values()).map(vs => vs.info);
  }

  /**
   * 現在の状態をシリアライズ可能な形式に変換
   * STATE_UPDATEDメッセージのペイロードとして使用
   */
  toJSON(): TreeState {
    const viewsRecord: Record<string, ViewState> = {};

    for (const [viewId, viewState] of this.views) {
      const nodesRecord: Record<string, TabNode> = {};

      for (const [nodeId, node] of Object.entries(viewState.nodes)) {
        nodesRecord[nodeId] = {
          ...node,
          children: node.children.map(child => ({ id: child.id })) as unknown as TabNode[],
        };
      }

      viewsRecord[viewId] = {
        info: viewState.info,
        rootNodeIds: [...viewState.rootNodeIds],
        nodes: nodesRecord,
      };
    }

    const tabToNodeRecord: Record<number, { viewId: string; nodeId: string }> = {};
    this.tabToNode.forEach((mapping, tabId) => {
      tabToNodeRecord[tabId] = mapping;
    });

    const pinnedTabIdsByWindowRecord: Record<number, number[]> = {};
    this.pinnedTabIdsByWindow.forEach((tabIds, windowId) => {
      pinnedTabIdsByWindowRecord[windowId] = [...tabIds];
    });

    return {
      views: viewsRecord,
      viewOrder: [...this.viewOrder],
      currentViewId: this.currentViewId,
      currentViewByWindowId: { ...this.currentViewByWindowId },
      tabToNode: tabToNodeRecord,
      treeStructure: [],
      pinnedTabIdsByWindow: pinnedTabIdsByWindowRecord,
    };
  }

  /**
   * 状態変更後の通知を送信
   * payloadにシリアライズした状態を含める
   */
  notifyStateChanged(): void {
    const payload = this.toJSON();
    chrome.runtime.sendMessage({
      type: 'STATE_UPDATED',
      payload,
    }).catch(() => {
      // メッセージ送信失敗は無視（サイドパネルが閉じている場合など）
    });
  }

  /**
   * ストレージに状態を永続化
   */
  private async persistState(): Promise<void> {
    const viewsRecord: Record<string, ViewState> = {};

    for (const [viewId, viewState] of this.views) {
      const nodesRecord: Record<string, TabNode> = {};

      for (const [nodeId, node] of Object.entries(viewState.nodes)) {
        nodesRecord[nodeId] = {
          ...node,
          children: node.children.map(child => ({ id: child.id })) as unknown as TabNode[],
        };
      }

      viewsRecord[viewId] = {
        info: viewState.info,
        rootNodeIds: [...viewState.rootNodeIds],
        nodes: nodesRecord,
      };
    }

    const tabToNodeRecord: Record<number, { viewId: string; nodeId: string }> = {};
    this.tabToNode.forEach((mapping, tabId) => {
      tabToNodeRecord[tabId] = mapping;
    });

    const treeStructure = await this.buildTreeStructure();

    const pinnedTabIdsByWindowRecord: Record<number, number[]> = {};
    this.pinnedTabIdsByWindow.forEach((tabIds, windowId) => {
      pinnedTabIdsByWindowRecord[windowId] = [...tabIds];
    });

    const treeState: TreeState = {
      views: viewsRecord,
      viewOrder: [...this.viewOrder],
      currentViewId: this.currentViewId,
      currentViewByWindowId: { ...this.currentViewByWindowId },
      tabToNode: tabToNodeRecord,
      treeStructure,
      pinnedTabIdsByWindow: pinnedTabIdsByWindowRecord,
    };

    await this.storageService.set(STORAGE_KEYS.TREE_STATE, treeState);
  }

  /**
   * ツリー構造を順序付きで構築
   * 内部ツリーの順序（rootNodeIds + 深さ優先）を使用
   */
  private async buildTreeStructure(): Promise<TreeStructureEntry[]> {
    try {
      const tabs = await chrome.tabs.query({});
      const tabMap = new Map(tabs.filter(t => t.id).map(t => [t.id!, t]));

      const nodesInOrder: Array<{ node: TabNode; viewId: string }> = [];

      const collectInOrder = (node: TabNode, viewId: string): void => {
        nodesInOrder.push({ node, viewId });
        for (const child of node.children) {
          collectInOrder(child, viewId);
        }
      };

      for (const [viewId, viewState] of this.views) {
        for (const rootNodeId of viewState.rootNodeIds) {
          const rootNode = viewState.nodes[rootNodeId];
          if (rootNode && !rootNode.parentId) {
            collectInOrder(rootNode, viewId);
          }
        }
      }

      const nodeIdToIndex = new Map<string, number>();
      nodesInOrder.forEach(({ node }, index) => {
        nodeIdToIndex.set(node.id, index);
      });

      const treeStructure: TreeStructureEntry[] = nodesInOrder.map(({ node, viewId }) => {
        const tab = tabMap.get(node.tabId);
        return {
          url: tab?.pendingUrl || tab?.url || '',
          parentIndex: node.parentId ? (nodeIdToIndex.get(node.parentId) ?? null) : null,
          index: tab?.index ?? -1,
          viewId,
          isExpanded: node.isExpanded,
        };
      });

      return treeStructure;
    } catch {
      return [];
    }
  }

  /**
   * ストレージから状態を復元
   */
  async loadState(): Promise<void> {
    try {
      const state = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
      if (!state) {
        return;
      }

      this.views.clear();
      this.tabToNode.clear();

      if (state.viewOrder && Array.isArray(state.viewOrder)) {
        this.viewOrder = [...state.viewOrder];
      } else {
        this.viewOrder = Object.keys(state.views);
      }

      for (const [viewId, viewStateData] of Object.entries(state.views)) {
        const viewState: ViewState = {
          info: viewStateData.info,
          rootNodeIds: [...viewStateData.rootNodeIds],
          nodes: {},
        };

        for (const [nodeId, nodeData] of Object.entries(viewStateData.nodes)) {
          viewState.nodes[nodeId] = {
            ...nodeData,
            children: [],
          };
        }

        this.views.set(viewId, viewState);
      }

      for (const [tabIdStr, mapping] of Object.entries(state.tabToNode)) {
        const tabId = parseInt(tabIdStr);
        this.tabToNode.set(tabId, mapping);
      }
      for (const viewState of this.views.values()) {
        const addedChildIds = new Set<string>();

        for (const [, nodeData] of Object.entries(state.views[viewState.info.id]?.nodes || {})) {
          const parentId = nodeData.id;
          const parent = viewState.nodes[parentId];
          if (!parent) continue;

          if (nodeData.children && Array.isArray(nodeData.children)) {
            for (const storedChild of nodeData.children) {
              if (!storedChild || typeof storedChild !== 'object') continue;
              const childId = (storedChild as { id?: string }).id;
              if (!childId) continue;
              const child = viewState.nodes[childId];
              if (child && child.parentId === parentId) {
                parent.children.push(child);
                addedChildIds.add(childId);
              }
            }
          }
        }

        for (const [nodeId, node] of Object.entries(viewState.nodes)) {
          if (addedChildIds.has(nodeId)) continue;
          if (node.parentId) {
            const parent = viewState.nodes[node.parentId];
            if (parent) {
              parent.children.push(node);
            }
          }
        }

        const recalculateDepth = (node: TabNode, depth: number): void => {
          node.depth = depth;
          for (const child of node.children) {
            recalculateDepth(child, depth + 1);
          }
        };

        for (const nodeId of viewState.rootNodeIds) {
          const node = viewState.nodes[nodeId];
          if (node) {
            recalculateDepth(node, 0);
          }
        }
      }

      this.currentViewId = state.currentViewId || 'default';
      this.currentViewByWindowId = state.currentViewByWindowId || {};

      this.pinnedTabIdsByWindow.clear();
      if (state.pinnedTabIdsByWindow) {
        for (const [windowIdStr, tabIds] of Object.entries(state.pinnedTabIdsByWindow)) {
          const windowId = parseInt(windowIdStr);
          if (!isNaN(windowId) && Array.isArray(tabIds)) {
            this.pinnedTabIdsByWindow.set(windowId, [...tabIds]);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  private isDescendant(viewState: ViewState, ancestorId: string, descendantId: string): boolean {
    const ancestor = viewState.nodes[ancestorId];
    if (!ancestor) return false;

    for (const child of ancestor.children) {
      if (child.id === descendantId) return true;
      if (this.isDescendant(viewState, child.id, descendantId)) return true;
    }

    return false;
  }

  private updateChildrenDepth(node: TabNode): void {
    for (const child of node.children) {
      child.depth = node.depth + 1;
      this.updateChildrenDepth(child);
    }
  }

  private promoteChildren(viewState: ViewState, parentNode: TabNode): void {
    const children = [...parentNode.children];

    for (const child of children) {
      child.parentId = parentNode.parentId;
      child.depth = parentNode.depth;

      if (child.groupId === parentNode.id || child.groupId === parentNode.groupId) {
        child.groupId = parentNode.parentId ? viewState.nodes[parentNode.parentId]?.groupId : undefined;
      }

      this.updateChildrenDepth(child);

      if (parentNode.parentId) {
        const grandparentNode = viewState.nodes[parentNode.parentId];
        if (grandparentNode) {
          const parentIndex = grandparentNode.children.findIndex(
            (c) => c.id === parentNode.id,
          );
          if (parentIndex !== -1) {
            grandparentNode.children.splice(parentIndex + 1, 0, child);
          } else {
            grandparentNode.children.push(child);
          }
        }
      } else {
        const parentIndex = viewState.rootNodeIds.indexOf(parentNode.id);
        if (parentIndex !== -1) {
          const insertIndex = parentIndex + 1 + children.indexOf(child);
          viewState.rootNodeIds.splice(insertIndex, 0, child.id);
        } else {
          viewState.rootNodeIds.push(child.id);
        }
      }
    }

    parentNode.children = [];
  }

  private removeChildrenRecursively(viewState: ViewState, parentNode: TabNode): number[] {
    const closedTabIds: number[] = [];

    for (const child of [...parentNode.children]) {
      const grandchildTabIds = this.removeChildrenRecursively(viewState, child);
      closedTabIds.push(...grandchildTabIds);

      closedTabIds.push(child.tabId);

      viewState.rootNodeIds = viewState.rootNodeIds.filter((id) => id !== child.id);
      delete viewState.nodes[child.id];
      this.tabToNode.delete(child.tabId);
    }

    parentNode.children = [];

    return closedTabIds;
  }

  private countSubtreeNodes(node: TabNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this.countSubtreeNodes(child);
    }
    return count;
  }

  private collectSubtreeNodes(node: TabNode, result: TabNode[]): void {
    result.push(node);
    for (const child of node.children) {
      this.collectSubtreeNodes(child, result);
    }
  }

  /**
   * ノードを指定した親の子として移動（D&Dの子としてドロップ）
   * 複数選択対応：選択内でルートになるノードのみを移動先に移動し、
   * 選択内の親子関係は維持する
   *
   * @param nodeId - ドラッグしたノードID
   * @param targetParentId - ドロップ先の親ノードID
   * @param viewId - ビューID
   * @param selectedNodeIds - 選択されているノードID一覧
   */
  async moveNodeToParent(
    nodeId: string,
    targetParentId: string,
    viewId: string,
    selectedNodeIds: string[]
  ): Promise<void> {
    const viewState = this.views.get(viewId);
    if (!viewState) return;

    const activeNode = viewState.nodes[nodeId];
    const targetParent = viewState.nodes[targetParentId];
    if (!activeNode || !targetParent) return;

    const isActiveNodeSelected = selectedNodeIds.includes(nodeId);
    const nodesToMove = isActiveNodeSelected ? selectedNodeIds : [nodeId];
    const nodesToMoveSet = new Set(nodesToMove);

    for (const id of nodesToMove) {
      if (this.isDescendant(viewState, id, targetParentId)) {
        return;
      }
    }

    if (nodesToMoveSet.has(targetParentId)) {
      return;
    }

    const rootNodesInSelection = nodesToMove.filter(id => {
      const node = viewState.nodes[id];
      if (!node) return false;
      return !node.parentId || !nodesToMoveSet.has(node.parentId);
    });

    for (const id of rootNodesInSelection) {
      const node = viewState.nodes[id];
      if (!node) continue;

      if (node.parentId) {
        const oldParent = viewState.nodes[node.parentId];
        if (oldParent) {
          oldParent.children = oldParent.children.filter(child => child.id !== id);
        }
      } else {
        viewState.rootNodeIds = viewState.rootNodeIds.filter(rootId => rootId !== id);
      }
    }

    for (const id of rootNodesInSelection) {
      const node = viewState.nodes[id];
      if (!node) continue;

      node.parentId = targetParentId;
      node.depth = targetParent.depth + 1;
      this.updateChildrenDepth(node);
      targetParent.children.push(node);
    }

    targetParent.isExpanded = true;

    await this.persistState();
  }

  /**
   * ビュー色パレット
   */
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
   * ビューを切り替え
   * ウィンドウ毎のcurrentViewByWindowIdを更新し、グローバルなcurrentViewIdも更新
   */
  async switchView(
    viewId: string,
    windowId: number,
    _previousViewId: string,
    _activeTabId: number | null
  ): Promise<void> {
    this.currentViewId = viewId;
    this.currentViewByWindowId = {
      ...this.currentViewByWindowId,
      [windowId]: viewId,
    };

    const existingState = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
    if (!existingState) return;

    const updatedState: TreeState = {
      ...existingState,
      currentViewByWindowId: this.currentViewByWindowId,
      currentViewId: viewId,
    };

    await this.storageService.set(STORAGE_KEYS.TREE_STATE, updatedState);
  }

  /**
   * 新しいビューを自動で色を決定して作成
   */
  async createViewWithAutoColor(): Promise<string> {
    const viewCount = this.views.size;
    const colorIndex = viewCount % TreeStateManager.VIEW_COLOR_PALETTE.length;
    const newColor = TreeStateManager.VIEW_COLOR_PALETTE[colorIndex];

    const newViewId = `view_${Date.now()}`;
    this.createView({
      id: newViewId,
      name: 'View',
      color: newColor,
    });

    await this.persistState();
    return newViewId;
  }

  /**
   * グループを削除し、関連ノードのgroupIdをクリア
   */
  async deleteTreeGroup(groupId: string, viewId: string): Promise<void> {
    const viewState = this.views.get(viewId);
    if (!viewState) return;

    for (const nodeId of Object.keys(viewState.nodes)) {
      const node = viewState.nodes[nodeId];
      if (node && node.groupId === groupId) {
        node.groupId = undefined;
      }
    }

    await this.persistState();
  }

  /**
   * タブをグループに追加
   */
  async addTabToTreeGroup(nodeId: string, groupId: string, viewId: string): Promise<void> {
    const viewState = this.views.get(viewId);
    if (!viewState) return;

    const node = viewState.nodes[nodeId];
    if (!node) return;

    const groupNode = viewState.nodes[groupId];
    const groupDepth = groupNode?.depth ?? 0;

    if (node.parentId) {
      const oldParent = viewState.nodes[node.parentId];
      if (oldParent) {
        oldParent.children = oldParent.children.filter(child => child.id !== nodeId);
      }
    } else {
      viewState.rootNodeIds = viewState.rootNodeIds.filter(id => id !== nodeId);
    }

    node.groupId = groupId;
    node.parentId = groupId;
    node.depth = groupDepth + 1;
    this.updateChildrenDepth(node);

    if (groupNode) {
      groupNode.children.push(node);
    }

    await this.persistState();
  }

  /**
   * タブをグループから削除
   */
  async removeTabFromTreeGroup(nodeId: string, viewId: string): Promise<void> {
    const viewState = this.views.get(viewId);
    if (!viewState) return;

    const node = viewState.nodes[nodeId];
    if (!node) return;

    if (node.groupId && viewState.nodes[node.groupId]) {
      const groupNode = viewState.nodes[node.groupId];
      groupNode.children = groupNode.children.filter(child => child.id !== nodeId);
    }

    node.groupId = undefined;
    node.parentId = null;
    node.depth = 0;
    this.updateChildrenDepth(node);
    viewState.rootNodeIds.push(nodeId);

    await this.persistState();
  }

  /**
   * タブを別のビューに移動
   */
  async moveTabsToViewInternal(targetViewId: string, tabIds: number[]): Promise<void> {
    if (!this.views.has(targetViewId)) {
      const viewCount = this.views.size;
      const colorIndex = viewCount % TreeStateManager.VIEW_COLOR_PALETTE.length;
      this.createView({
        id: targetViewId,
        name: 'View',
        color: TreeStateManager.VIEW_COLOR_PALETTE[colorIndex],
      });
    }

    const targetViewState = this.views.get(targetViewId)!;

    const collectSubtreeNodeIds = (nodes: Record<string, TabNode>, nodeId: string): string[] => {
      const result: string[] = [nodeId];
      const node = nodes[nodeId];
      if (node && node.children) {
        for (const child of node.children) {
          result.push(...collectSubtreeNodeIds(nodes, child.id));
        }
      }
      return result;
    };

    const tabIdsSet = new Set(tabIds);
    const topLevelTabIds: number[] = [];
    for (const tabId of tabIds) {
      const mapping = this.tabToNode.get(tabId);
      if (!mapping) continue;
      const sourceViewState = this.views.get(mapping.viewId);
      if (!sourceViewState) continue;
      const node = sourceViewState.nodes[mapping.nodeId];
      if (!node) continue;
      if (!node.parentId) {
        topLevelTabIds.push(tabId);
      } else {
        const parentNode = sourceViewState.nodes[node.parentId];
        if (!parentNode || !tabIdsSet.has(parentNode.tabId)) {
          topLevelTabIds.push(tabId);
        }
      }
    }

    const topLevelTabIdSet = new Set(topLevelTabIds);

    for (const tabId of topLevelTabIds) {
      const mapping = this.tabToNode.get(tabId);
      if (!mapping) continue;

      const sourceViewId = mapping.viewId;
      if (sourceViewId === targetViewId) continue;

      const sourceViewState = this.views.get(sourceViewId);
      if (!sourceViewState) continue;

      const rootNode = sourceViewState.nodes[mapping.nodeId];
      if (!rootNode) continue;

      const subtreeNodeIds = collectSubtreeNodeIds(sourceViewState.nodes, rootNode.id);

      if (rootNode.parentId) {
        const parentNode = sourceViewState.nodes[rootNode.parentId];
        if (parentNode) {
          parentNode.children = parentNode.children.filter(c => c.id !== rootNode.id);
        }
      } else {
        sourceViewState.rootNodeIds = sourceViewState.rootNodeIds.filter(id => id !== rootNode.id);
      }

      for (const nodeId of subtreeNodeIds) {
        const node = sourceViewState.nodes[nodeId];
        if (!node) continue;

        delete sourceViewState.nodes[nodeId];

        if (topLevelTabIdSet.has(node.tabId)) {
          node.parentId = null;
          node.depth = 0;
        }

        targetViewState.nodes[nodeId] = node;
        this.tabToNode.set(node.tabId, { viewId: targetViewId, nodeId: node.id });
      }

      targetViewState.rootNodeIds.push(rootNode.id);
    }

    for (const nodeId of targetViewState.rootNodeIds) {
      const node = targetViewState.nodes[nodeId];
      if (node) {
        node.depth = 0;
        this.updateChildrenDepth(node);
      }
    }

    await this.persistState();
  }

  /**
   * ノードを兄弟として指定位置に挿入（D&DのGapドロップ）
   * 複数選択対応：選択内でルートになるノードのみを移動し、
   * 選択内の親子関係は維持する
   *
   * @param nodeId - ドラッグしたノードID
   * @param aboveNodeId - 上のノードID（挿入位置の上）
   * @param belowNodeId - 下のノードID（挿入位置の下）
   * @param viewId - ビューID
   * @param selectedNodeIds - 選択されているノードID一覧
   */
  async moveNodeAsSibling(
    nodeId: string,
    aboveNodeId: string | undefined,
    belowNodeId: string | undefined,
    viewId: string,
    selectedNodeIds: string[]
  ): Promise<void> {
    const viewState = this.views.get(viewId);
    if (!viewState) return;

    const activeNode = viewState.nodes[nodeId];
    if (!activeNode) return;

    const isActiveNodeSelected = selectedNodeIds.includes(nodeId);
    const nodesToMove = isActiveNodeSelected ? selectedNodeIds : [nodeId];
    const nodesToMoveSet = new Set(nodesToMove);

    let targetParentId: string | null = null;
    if (belowNodeId && viewState.nodes[belowNodeId]) {
      targetParentId = viewState.nodes[belowNodeId].parentId;
    } else if (aboveNodeId && viewState.nodes[aboveNodeId]) {
      targetParentId = viewState.nodes[aboveNodeId].parentId;
    }

    if (targetParentId) {
      for (const id of nodesToMove) {
        if (this.isDescendant(viewState, id, targetParentId)) {
          return;
        }
      }
    }

    const topLevelNodesToMove = nodesToMove.filter(id => {
      const node = viewState.nodes[id];
      if (!node) return false;
      return !node.parentId || !nodesToMoveSet.has(node.parentId);
    });

    for (const id of topLevelNodesToMove) {
      const node = viewState.nodes[id];
      if (!node) continue;

      if (node.parentId) {
        const oldParent = viewState.nodes[node.parentId];
        if (oldParent) {
          oldParent.children = oldParent.children.filter(child => child.id !== id);
        }
      } else {
        viewState.rootNodeIds = viewState.rootNodeIds.filter(rootId => rootId !== id);
      }
    }

    const sortedNodesToMove = topLevelNodesToMove
      .map(id => viewState.nodes[id])
      .filter((node): node is TabNode => node !== undefined);

    for (const node of sortedNodesToMove) {
      node.parentId = targetParentId;
      node.depth = targetParentId ? (viewState.nodes[targetParentId]?.depth ?? 0) + 1 : 0;
      this.updateChildrenDepth(node);
    }

    if (targetParentId) {
      const targetParent = viewState.nodes[targetParentId];
      if (targetParent) {
        if (belowNodeId) {
          const belowNode = viewState.nodes[belowNodeId];
          if (belowNode && belowNode.parentId === targetParentId) {
            const insertIndex = targetParent.children.findIndex(c => c.id === belowNodeId);
            if (insertIndex !== -1) {
              targetParent.children.splice(insertIndex, 0, ...sortedNodesToMove);
            } else {
              targetParent.children.push(...sortedNodesToMove);
            }
          } else {
            targetParent.children.push(...sortedNodesToMove);
          }
        } else if (aboveNodeId) {
          const aboveNode = viewState.nodes[aboveNodeId];
          if (aboveNode && aboveNode.parentId === targetParentId) {
            const insertIndex = targetParent.children.findIndex(c => c.id === aboveNodeId);
            if (insertIndex !== -1) {
              targetParent.children.splice(insertIndex + 1, 0, ...sortedNodesToMove);
            } else {
              targetParent.children.push(...sortedNodesToMove);
            }
          } else {
            targetParent.children.push(...sortedNodesToMove);
          }
        } else {
          targetParent.children.push(...sortedNodesToMove);
        }
      }
    } else {
      const nodesToInsertIds = sortedNodesToMove.map(n => n.id);
      if (belowNodeId) {
        const insertIndex = viewState.rootNodeIds.indexOf(belowNodeId);
        if (insertIndex !== -1) {
          viewState.rootNodeIds.splice(insertIndex, 0, ...nodesToInsertIds);
        } else {
          viewState.rootNodeIds.push(...nodesToInsertIds);
        }
      } else if (aboveNodeId) {
        const insertIndex = viewState.rootNodeIds.indexOf(aboveNodeId);
        if (insertIndex !== -1) {
          viewState.rootNodeIds.splice(insertIndex + 1, 0, ...nodesToInsertIds);
        } else {
          viewState.rootNodeIds.push(...nodesToInsertIds);
        }
      } else {
        viewState.rootNodeIds.push(...nodesToInsertIds);
      }
    }

    await this.persistState();
  }

  /**
   * タブを別ウィンドウに移動
   * ツリー状態を更新してからChromeタブを移動し、同期を行う
   */
  async moveTabToWindow(tabId: number, targetWindowId: number): Promise<void> {
    await this.moveTabToRootEnd(tabId);
    await chrome.tabs.move(tabId, { windowId: targetWindowId, index: -1 });
    await this.syncTreeStateToChromeTabs();
    await this.persistState();
  }

  /**
   * タブで新しいウィンドウを作成
   * ツリー状態を更新してから新ウィンドウを作成し、同期を行う
   */
  async createWindowWithTab(tabId: number): Promise<number | undefined> {
    await this.moveTabToRootEnd(tabId);
    const newWindow = await chrome.windows.create({ tabId });
    await this.syncTreeStateToChromeTabs();
    await this.persistState();
    return newWindow?.id;
  }

  /**
   * サブツリー全体で新しいウィンドウを作成
   * 先頭タブで新ウィンドウを作成し、残りのタブを移動する
   * @returns 作成されたウィンドウID（失敗時はundefined）
   */
  async createWindowWithSubtree(rootTabId: number): Promise<number | undefined> {
    const subtree = this.getSubtree(rootTabId);
    if (subtree.length === 0) return undefined;

    const tabIds = subtree.map(node => node.tabId);
    const firstTabId = tabIds[0];

    const newWindow = await chrome.windows.create({ tabId: firstTabId });
    if (!newWindow || newWindow.id === undefined) return undefined;

    if (tabIds.length > 1) {
      const remainingTabIds = tabIds.slice(1);
      for (const tid of remainingTabIds) {
        try {
          await chrome.tabs.move(tid, { windowId: newWindow.id, index: -1 });
        } catch {
          // タブ移動失敗は無視
        }
      }
    }

    await this.syncTreeStateToChromeTabs();
    await this.persistState();
    return newWindow.id;
  }

  /**
   * サブツリー全体を別ウィンドウに移動
   */
  async moveSubtreeToWindow(rootTabId: number, targetWindowId: number): Promise<void> {
    const subtree = this.getSubtree(rootTabId);
    if (subtree.length === 0) return;

    const tabIds = subtree.map(node => node.tabId);

    for (const tid of tabIds) {
      try {
        await chrome.tabs.move(tid, { windowId: targetWindowId, index: -1 });
      } catch {
        // タブ移動失敗は無視
      }
    }

    await this.syncTreeStateToChromeTabs();
    await this.persistState();
  }

  /**
   * 複数タブを新しいウィンドウに移動
   * コンテキストメニューの「新しいウィンドウに移動」で使用
   */
  async moveTabsToNewWindow(tabIds: number[]): Promise<number | undefined> {
    if (tabIds.length === 0) return undefined;

    const newWindow = await chrome.windows.create({ tabId: tabIds[0] });
    if (!newWindow || newWindow.id === undefined) return undefined;

    if (tabIds.length > 1) {
      for (let i = 1; i < tabIds.length; i++) {
        try {
          await chrome.tabs.move(tabIds[i], { windowId: newWindow.id, index: -1 });
        } catch {
          // タブ移動失敗は無視
        }
      }
    }

    await this.syncTreeStateToChromeTabs();
    await this.persistState();
    return newWindow.id;
  }

  /**
   * スナップショットからツリー状態を復元
   * メモリ上の状態を直接更新し、永続化する
   *
   * @param snapshotViews - スナップショットのビュー情報
   * @param indexToNewTabId - スナップショットのindex -> 新しいtabIdのマッピング
   * @param indexToSnapshot - スナップショットのindex -> タブ情報のマッピング
   * @param closeCurrentTabs - 既存タブを閉じるかどうか
   */
  async restoreTreeStateFromSnapshot(
    snapshotViews: Array<{ id: string; name: string; color: string }>,
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
    }>,
    closeCurrentTabs: boolean
  ): Promise<void> {
    const updatedViews: Map<string, ViewState> = new Map();
    const updatedTabToNode: Map<number, { viewId: string; nodeId: string }> = new Map();

    if (!closeCurrentTabs) {
      for (const [viewId, viewState] of this.views) {
        updatedViews.set(viewId, {
          info: { ...viewState.info },
          rootNodeIds: [...viewState.rootNodeIds],
          nodes: { ...viewState.nodes },
        });
      }
      for (const [tabId, mapping] of this.tabToNode) {
        updatedTabToNode.set(tabId, { ...mapping });
      }
    }

    for (const view of snapshotViews) {
      if (!updatedViews.has(view.id)) {
        updatedViews.set(view.id, {
          info: { id: view.id, name: view.name, color: view.color },
          rootNodeIds: [],
          nodes: {},
        });
      }
    }

    if (!updatedViews.has('default')) {
      updatedViews.set('default', {
        info: { id: 'default', name: 'Default', color: '#3B82F6' },
        rootNodeIds: [],
        nodes: {},
      });
    }

    const allNewNodes: Map<string, TabNode> = new Map();
    const nodeIdToViewId: Map<string, string> = new Map();

    for (const [index, newTabId] of indexToNewTabId) {
      const snapshot = indexToSnapshot.get(index);
      if (!snapshot) continue;

      const nodeId = `node-${newTabId}`;
      let parentId: string | null = null;
      let depth = 0;

      if (snapshot.parentIndex !== null) {
        const parentTabId = indexToNewTabId.get(snapshot.parentIndex);
        if (parentTabId !== undefined) {
          parentId = `node-${parentTabId}`;
          const parentNode = allNewNodes.get(parentId);
          if (parentNode) {
            depth = parentNode.depth + 1;
          }
        }
      }

      const newNode: TabNode = {
        id: nodeId,
        tabId: newTabId,
        parentId,
        children: [],
        isExpanded: snapshot.isExpanded,
        depth,
      };

      allNewNodes.set(nodeId, newNode);
      nodeIdToViewId.set(nodeId, snapshot.viewId);
      updatedTabToNode.set(newTabId, { viewId: snapshot.viewId, nodeId });
    }

    for (const [nodeId, node] of allNewNodes) {
      if (node.parentId && allNewNodes.has(node.parentId)) {
        const parent = allNewNodes.get(node.parentId)!;
        const childExists = parent.children.some(c => c.id === nodeId);
        if (!childExists) {
          parent.children = [...parent.children, node];
        }
      }
    }

    for (const [nodeId, node] of allNewNodes) {
      const viewId = nodeIdToViewId.get(nodeId) || 'default';
      let viewState = updatedViews.get(viewId);
      if (!viewState) {
        viewState = {
          info: { id: viewId, name: viewId === 'default' ? 'Default' : 'View', color: '#3B82F6' },
          rootNodeIds: [],
          nodes: {},
        };
        updatedViews.set(viewId, viewState);
      }
      viewState.nodes[nodeId] = node;

      if (!node.parentId) {
        viewState.rootNodeIds.push(nodeId);
      }
    }

    this.views = updatedViews;
    this.tabToNode = updatedTabToNode;

    const existingViewOrder = new Set(this.viewOrder);
    for (const viewId of updatedViews.keys()) {
      if (!existingViewOrder.has(viewId)) {
        this.viewOrder.push(viewId);
      }
    }

    await this.persistState();
  }
}
