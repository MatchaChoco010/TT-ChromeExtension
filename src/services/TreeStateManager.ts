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
  private persistQueue: Promise<void> = Promise.resolve();
  private syncInProgress: boolean = false;
  private syncCompleted: boolean = false;

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
   * テスト用: 内部状態をリセットし、syncCompletedをtrueに設定
   * 本番コードでは使用しない
   */
  resetForTesting(): void {
    this.views.clear();
    this.tabToNode.clear();
    this.syncInProgress = false;
    this.syncCompleted = true;
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
   * ビューを作成
   */
  createView(info: View): void {
    if (this.views.has(info.id)) return;

    this.views.set(info.id, {
      info,
      rootNodeIds: [],
      nodes: {},
    });
    // viewOrderに追加（まだ存在しない場合のみ）
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
    // 存在するビューIDのみを保持
    this.viewOrder = newOrder.filter(id => this.views.has(id));
    // 新しい順序に含まれていないビューを末尾に追加
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

    // すべてのノードをターゲットビューに移動
    for (const nodeId of Object.keys(viewState.nodes)) {
      const node = viewState.nodes[nodeId];
      if (node) {
        // ルートノードとして移動
        node.parentId = null;
        node.depth = 0;
        targetView.nodes[nodeId] = node;
        targetView.rootNodeIds.push(nodeId);

        // tabToNodeを更新
        const mapping = this.tabToNode.get(node.tabId);
        if (mapping) {
          this.tabToNode.set(node.tabId, { viewId: targetViewId, nodeId });
        }
      }
    }

    this.views.delete(viewId);
    // viewOrderから削除
    this.viewOrder = this.viewOrder.filter(id => id !== viewId);
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

    // ビューが存在しない場合は作成
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

    // ルートノードの場合、rootNodeIdsに追加
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
      // 親ノードのchildrenに追加
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

    // 親ノードから削除
    if (node.parentId) {
      const parentNode = viewState.nodes[node.parentId];
      if (parentNode) {
        parentNode.children = parentNode.children.filter((child) => child.id !== node.id);
      }
    } else {
      // ルートノードから削除
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

    // 古い親から削除
    if (node.parentId) {
      const oldParent = viewState.nodes[node.parentId];
      if (oldParent) {
        oldParent.children = oldParent.children.filter((child) => child.id !== nodeId);
      }
    } else {
      viewState.rootNodeIds = viewState.rootNodeIds.filter((id) => id !== nodeId);
    }

    // 新しい親に追加
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
   * サブツリー全体を別のビューに移動
   */
  async moveSubtreeToView(tabId: number, targetViewId: string): Promise<void> {
    const mapping = this.tabToNode.get(tabId);
    if (!mapping) return;

    const sourceViewState = this.views.get(mapping.viewId);
    if (!sourceViewState) return;

    // ターゲットビューが存在しない場合は作成
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

    // サブツリーのすべてのノードを収集
    const subtreeNodes: TabNode[] = [];
    this.collectSubtreeNodes(rootNode, subtreeNodes);

    // ソースビューから削除
    if (rootNode.parentId) {
      const parentNode = sourceViewState.nodes[rootNode.parentId];
      if (parentNode) {
        parentNode.children = parentNode.children.filter((child) => child.id !== rootNode.id);
      }
    } else {
      sourceViewState.rootNodeIds = sourceViewState.rootNodeIds.filter((id) => id !== rootNode.id);
    }

    // ノードをターゲットビューに移動
    for (const node of subtreeNodes) {
      delete sourceViewState.nodes[node.id];
      targetViewState.nodes[node.id] = node;

      // tabToNodeを更新
      this.tabToNode.set(node.tabId, { viewId: targetViewId, nodeId: node.id });
    }

    // ルートノードとして追加
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
   * Chrome側のタブ順序変更をツリーのルートノード順序に反映
   * @param windowId - 対象ウィンドウID
   */
  async syncRootOrderFromChrome(windowId: number): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({ windowId });
      // ピン留めタブを除外し、tabIdとindexのマップを作成
      const tabIndexMap = new Map<number, number>();
      for (const tab of tabs) {
        if (tab.id !== undefined && !tab.pinned) {
          tabIndexMap.set(tab.id, tab.index);
        }
      }

      // 各ビューのルートノード順序を更新
      for (const viewState of this.views.values()) {
        // 現在のルートノードIDを取得
        const currentRootNodeIds = [...viewState.rootNodeIds];

        // ルートノードをChrome indexでソート
        currentRootNodeIds.sort((aId, bId) => {
          const nodeA = viewState.nodes[aId];
          const nodeB = viewState.nodes[bId];
          if (!nodeA || !nodeB) return 0;

          const indexA = tabIndexMap.get(nodeA.tabId) ?? Number.MAX_SAFE_INTEGER;
          const indexB = tabIndexMap.get(nodeB.tabId) ?? Number.MAX_SAFE_INTEGER;

          return indexA - indexB;
        });

        viewState.rootNodeIds = currentRootNodeIds;
      }

      await this.persistState();
    } catch {
      // エラーは無視
    }
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
    newTabPositionManual?: 'child' | 'sibling' | 'end';
  }): Promise<void> {
    if (this.syncInProgress || this.syncCompleted) {
      return;
    }
    this.syncInProgress = true;

    try {
      await this.loadState();

      const tabs = await chrome.tabs.query({});
      const defaultViewId = 'default';

      // デフォルトビューが存在しない場合は作成
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

      await this.persistState();

      // 内部ツリーの順序をChromeタブに反映
      await this.syncTreeOrderToChromeTabs();

      this.syncCompleted = true;
    } catch {
      // エラーは無視
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * treeStructureをリフレッシュする
   */
  async refreshTreeStructure(): Promise<void> {
    try {
      await this.loadState();
      await this.persistState();
    } catch {
      // エラーは無視
    }
  }

  /**
   * 内部ツリーの順序をChromeタブの順序に反映する
   * viewOrderの順序で全ビューを処理し、各ビュー内は深さ優先でフラット化
   */
  async syncTreeOrderToChromeTabs(): Promise<void> {
    try {
      // 現在のタブ情報を取得
      const currentTabs = await chrome.tabs.query({ currentWindow: true });
      const pinnedSet = new Set<number>();
      const currentWindowTabIds = new Set<number>();
      for (const tab of currentTabs) {
        if (tab.id !== undefined) {
          currentWindowTabIds.add(tab.id);
          if (tab.pinned) {
            pinnedSet.add(tab.id);
          }
        }
      }

      // viewOrderの順序で全ビューを処理し、ツリーを深さ優先でフラット化（ピン留めタブは除外）
      const orderedTabIds: number[] = [];
      const traverse = (node: TabNode): void => {
        // 現在のウィンドウに存在するタブのみを含める
        if (!pinnedSet.has(node.tabId) && currentWindowTabIds.has(node.tabId)) {
          orderedTabIds.push(node.tabId);
        }
        for (const child of node.children) {
          traverse(child);
        }
      };

      // viewOrderの順序でビューを処理
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

      const pinnedCount = pinnedSet.size;

      // 最新のタブインデックスを取得
      const currentIndexMap = new Map<number, number>();
      for (const tab of currentTabs) {
        if (tab.id !== undefined) {
          currentIndexMap.set(tab.id, tab.index);
        }
      }

      // 各タブを正しい位置に移動
      for (let i = 0; i < orderedTabIds.length; i++) {
        const tabId = orderedTabIds[i];
        const expectedIndex = pinnedCount + i;
        const currentIndex = currentIndexMap.get(tabId);

        if (currentIndex !== undefined && currentIndex !== expectedIndex) {
          try {
            await chrome.tabs.move(tabId, { index: expectedIndex });
            // 移動後にインデックスマップを更新
            const updatedTabs = await chrome.tabs.query({ currentWindow: true });
            currentIndexMap.clear();
            for (const tab of updatedTabs) {
              if (tab.id !== undefined) {
                currentIndexMap.set(tab.id, tab.index);
              }
            }
          } catch {
            // タブが存在しない場合などのエラーは無視
          }
        }
      }
    } catch {
      // エラーは無視
    }
  }

  /**
   * treeStructureから親子関係を復元
   */
  private async restoreFromTreeStructure(
    tabs: chrome.tabs.Tab[],
    treeStructure: TreeStructureEntry[],
    defaultViewId: string,
    userSettings?: { newTabPositionManual?: 'child' | 'sibling' | 'end' },
  ): Promise<void> {
    // 古いノードをクリア
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

    // indexでマッチング
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

    // マッチしたタブをノードとして追加
    for (let i = 0; i < treeStructure.length; i++) {
      const tabId = structureIndexToTabId.get(i);
      if (!tabId) continue;

      const tab = tabs.find(t => t.id === tabId);
      if (!tab || !tab.id) continue;

      const entry = treeStructure[i];
      const viewId = entry.viewId || defaultViewId;

      // 既存ノードがあれば更新
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

    // 親子関係を設定
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

      // 同じビューの場合のみ親子関係を設定
      if (childMapping.viewId !== parentMapping.viewId) continue;

      const viewState = this.views.get(childMapping.viewId);
      if (!viewState) continue;

      const childNode = viewState.nodes[childMapping.nodeId];
      const parentNode = viewState.nodes[parentMapping.nodeId];
      if (!childNode || !parentNode) continue;

      if (childNode.parentId === parentNode.id) continue;

      // 古い親から削除
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

    // 未マッチのタブを追加
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
            // エラーは無視
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
    userSettings?: { newTabPositionManual?: 'child' | 'sibling' | 'end' },
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
            // エラーは無視
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

    // 全タブの親を確認
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

    // rootNodeIdsまたは親のchildrenに追加
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

    // タブをグループの子に移動
    for (const tabId of tabIds) {
      const mapping = this.tabToNode.get(tabId);
      if (!mapping || mapping.viewId !== viewId) continue;

      const node = viewState.nodes[mapping.nodeId];
      if (!node) continue;

      // 古い親から削除
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

    // グループ情報を保存
    try {
      const result = await chrome.storage.local.get('groups');
      const existingGroups: Record<string, { id: string; name: string; color: string; isExpanded: boolean }> = result.groups || {};
      existingGroups[groupNodeId] = {
        id: groupNodeId,
        name: groupName,
        color: '#f59e0b',
        isExpanded: true,
      };
      await chrome.storage.local.set({ groups: existingGroups });
    } catch {
      // エラーは無視
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

    // 子ノードをルートに昇格
    for (const child of [...groupNode.children]) {
      child.parentId = null;
      child.depth = 0;
      child.groupId = undefined;
      this.updateChildrenDepth(child);
      viewState.rootNodeIds.push(child.id);
    }

    // グループノードを削除
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
      const groups: Record<string, { id: string; name: string; color: string; isExpanded: boolean }> = storageResult.groups || {};
      if (groups[result.node.id]) {
        groupName = groups[result.node.id].name;
      }
    } catch {
      // エラーは無視
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
        // エラーは無視
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
   * ストレージに状態を永続化
   */
  private async persistState(): Promise<void> {
    this.persistQueue = this.persistQueue
      .then(() => this.persistStateInternal())
      .catch(() => {
        // エラーは無視
      });
    return this.persistQueue;
  }

  private async persistStateInternal(): Promise<void> {
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

    // 既存のcurrentViewIdとcurrentViewByWindowIdを保持
    const existingState = await this.storageService.get(STORAGE_KEYS.TREE_STATE);

    const treeState: TreeState = {
      views: viewsRecord,
      viewOrder: [...this.viewOrder],
      currentViewId: existingState?.currentViewId || 'default',
      currentViewByWindowId: existingState?.currentViewByWindowId,
      tabToNode: tabToNodeRecord,
      treeStructure,
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

      // 内部ツリーの順序（深さ優先）でノードを収集
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
          url: tab?.url || '',
          parentIndex: node.parentId ? (nodeIdToIndex.get(node.parentId) ?? null) : null,
          index: tab?.index ?? -1, // Chromeタブの実際のindexを使用
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
      if (!state) return;

      this.views.clear();
      this.tabToNode.clear();

      // viewOrderを復元
      if (state.viewOrder && Array.isArray(state.viewOrder)) {
        this.viewOrder = [...state.viewOrder];
      } else {
        // viewOrderがない場合はviewsのキーから復元
        this.viewOrder = Object.keys(state.views);
      }

      // ビューを復元
      for (const [viewId, viewStateData] of Object.entries(state.views)) {
        const viewState: ViewState = {
          info: viewStateData.info,
          rootNodeIds: [...viewStateData.rootNodeIds],
          nodes: {},
        };

        // ノードを復元（children配列は空で初期化）
        for (const [nodeId, nodeData] of Object.entries(viewStateData.nodes)) {
          viewState.nodes[nodeId] = {
            ...nodeData,
            children: [],
          };
        }

        this.views.set(viewId, viewState);
      }

      // tabToNodeを復元
      for (const [tabIdStr, mapping] of Object.entries(state.tabToNode)) {
        const tabId = parseInt(tabIdStr);
        this.tabToNode.set(tabId, mapping);
      }

      // children配列を再構築
      for (const viewState of this.views.values()) {
        const addedChildIds = new Set<string>();

        // 保存されたchildren配列の順序で子を追加
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

        // parentIdで関連付けられているが未追加の子を追加
        for (const [nodeId, node] of Object.entries(viewState.nodes)) {
          if (addedChildIds.has(nodeId)) continue;
          if (node.parentId) {
            const parent = viewState.nodes[node.parentId];
            if (parent) {
              parent.children.push(node);
            }
          }
        }

        // depthを再計算
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
    } catch {
      // エラーは無視
    }
  }

  // ヘルパーメソッド

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
}
