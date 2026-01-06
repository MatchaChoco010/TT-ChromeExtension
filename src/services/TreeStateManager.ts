import type { TabNode, TreeState, TreeStructureEntry, IStorageService } from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

/**
 * TreeStateManager
 *
 * タブツリー状態の集中管理と永続化を担当するサービス
 */
export class TreeStateManager {
  private nodes: Map<string, TabNode> = new Map();
  private tabToNode: Map<number, string> = new Map();
  private views: Map<string, string[]> = new Map();
  private expandedNodes: Set<string> = new Set();

  constructor(private storageService: IStorageService) {}

  /**
   * 指定されたviewIdのタブツリーを取得
   * @param viewId - ビューID
   * @returns ルートノードの配列
   */
  getTree(viewId: string): TabNode[] {
    const nodeIds = this.views.get(viewId) || [];
    const rootNodes = nodeIds
      .map((id) => this.nodes.get(id))
      .filter((node): node is TabNode => node !== undefined && node.parentId === null);

    return rootNodes;
  }

  /**
   * tabIdからTabNodeを取得
   * @param tabId - タブID
   * @returns TabNodeまたはnull
   */
  getNodeByTabId(tabId: number): TabNode | null {
    const nodeId = this.tabToNode.get(tabId);
    if (!nodeId) return null;
    return this.nodes.get(nodeId) || null;
  }

  /**
   * 新しいタブを追加
   * @param tab - Chrome タブオブジェクト
   * @param parentId - 親ノードID（nullの場合はルートノード）
   * @param viewId - ビューID
   * @param insertAfterNodeId - このノードの直後に挿入（兄弟配置時に使用、複製タブ用）
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

    const nodeId = `node-${tab.id}`;
    const parentNode = parentId ? this.nodes.get(parentId) : null;
    const depth = parentNode ? parentNode.depth + 1 : 0;

    const newNode: TabNode = {
      id: nodeId,
      tabId: tab.id,
      parentId,
      children: [],
      isExpanded: true,
      depth,
      viewId,
    };

    this.nodes.set(nodeId, newNode);
    this.tabToNode.set(tab.id, nodeId);
    this.expandedNodes.add(nodeId);

    const viewNodes = this.views.get(viewId) || [];
    if (!parentId && insertAfterNodeId) {
      const insertAfterIndex = viewNodes.indexOf(insertAfterNodeId);
      if (insertAfterIndex !== -1) {
        viewNodes.splice(insertAfterIndex + 1, 0, nodeId);
      } else {
        viewNodes.push(nodeId);
      }
    } else {
      viewNodes.push(nodeId);
    }
    this.views.set(viewId, viewNodes);

    if (parentId) {
      const parentNode = this.nodes.get(parentId);
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
    const nodeId = this.tabToNode.get(tabId);
    if (!nodeId) return [];

    const node = this.nodes.get(nodeId);
    if (!node) return [];

    const closedTabIds: number[] = [tabId];

    if (childTabBehavior === 'promote') {
      this.promoteChildren(node);
    } else if (childTabBehavior === 'close_all') {
      const childTabIds = this.removeChildrenRecursively(node);
      closedTabIds.push(...childTabIds);
    }

    if (node.parentId) {
      const parentNode = this.nodes.get(node.parentId);
      if (parentNode) {
        parentNode.children = parentNode.children.filter((child) => child.id !== nodeId);
      }
    }

    const viewNodes = this.views.get(node.viewId) || [];
    this.views.set(
      node.viewId,
      viewNodes.filter((id) => id !== nodeId),
    );

    this.nodes.delete(nodeId);
    this.tabToNode.delete(tabId);
    this.expandedNodes.delete(nodeId);

    await this.persistState();

    return closedTabIds;
  }

  /**
   * ノードを移動
   * @param nodeId - ノードID
   * @param newParentId - 新しい親ノードID（nullの場合はルート）
   * @param index - 挿入位置
   */
  async moveNode(
    nodeId: string,
    newParentId: string | null,
    index: number,
  ): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }

    if (newParentId && this.isDescendant(nodeId, newParentId)) {
      return;
    }

    if (newParentId === nodeId) {
      return;
    }

    if (node.parentId) {
      const oldParent = this.nodes.get(node.parentId);
      if (oldParent) {
        oldParent.children = oldParent.children.filter((child) => child.id !== nodeId);
      }
    }

    node.parentId = newParentId;
    node.depth = newParentId ? (this.nodes.get(newParentId)?.depth || 0) + 1 : 0;

    this.updateChildrenDepth(node);

    if (newParentId) {
      const newParent = this.nodes.get(newParentId);
      if (newParent) {
        newParent.children.splice(index, 0, node);
      }
    }

    await this.persistState();
  }

  /**
   * ノードの展開状態を切り替え
   * @param nodeId - ノードID
   */
  async toggleExpand(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    node.isExpanded = !node.isExpanded;

    if (node.isExpanded) {
      this.expandedNodes.add(nodeId);
    } else {
      this.expandedNodes.delete(nodeId);
    }

    await this.persistState();
  }

  /**
   * ノードを展開する
   * 新規タブ作成時に親タブを自動展開
   *
   * @param nodeId - ノードID
   */
  async expandNode(nodeId: string): Promise<void> {
    const node = this.nodes.get(nodeId);
    if (!node) return;

    if (node.isExpanded) return;

    node.isExpanded = true;
    this.expandedNodes.add(nodeId);

    await this.persistState();
  }

  /**
   * 存在しないタブをクリーンアップ
   *
   * ブラウザ起動時に、ツリー状態に保存されているが実際には存在しないタブを
   * 自動的に削除します。
   *
   * @param existingTabIds - 現在ブラウザに存在するタブIDの配列
   * @returns 削除されたノード数
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

    await this.persistState();

    return staleTabIds.length;
  }

  /**
   * 存在しないタブノードを削除（内部用、子タブを昇格させる）
   * @param tabId - 削除するタブのID
   */
  private async removeStaleNode(tabId: number): Promise<void> {
    const nodeId = this.tabToNode.get(tabId);
    if (!nodeId) return;

    const node = this.nodes.get(nodeId);
    if (!node) return;

    this.promoteChildren(node);

    if (node.parentId) {
      const parentNode = this.nodes.get(node.parentId);
      if (parentNode) {
        parentNode.children = parentNode.children.filter((child) => child.id !== nodeId);
      }
    }

    const viewNodes = this.views.get(node.viewId) || [];
    this.views.set(
      node.viewId,
      viewNodes.filter((id) => id !== nodeId),
    );

    this.nodes.delete(nodeId);
    this.tabToNode.delete(tabId);
    this.expandedNodes.delete(nodeId);
  }

  /**
   * chrome.tabs APIと同期
   * ブラウザ再起動時はtreeStructureから親子関係を復元
   */
  async syncWithChromeTabs(): Promise<void> {
    try {
      const tabs = await chrome.tabs.query({});

      // Must match TreeStateProvider's default currentViewId
      const defaultViewId = 'default';

      const state = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
      const treeStructure = state?.treeStructure;

      if (treeStructure && treeStructure.length > 0) {
        await this.restoreFromTreeStructure(tabs, treeStructure, defaultViewId);
      } else {
        await this.syncWithOpenerTabId(tabs, defaultViewId);
      }

      await this.persistState();
    } catch (_error) {
      // Error syncing with Chrome tabs silently
    }
  }

  /**
   * treeStructureをリフレッシュする
   * Side Panelからのドラッグ&ドロップ操作後に呼び出す
   * ストレージから最新の状態を読み込み、treeStructureを再構築して保存
   */
  async refreshTreeStructure(): Promise<void> {
    try {
      await this.loadState();
      await this.persistState();
    } catch (_error) {
      // Error refreshing tree structure silently
    }
  }

  /**
   * treeStructureから親子関係を復元
   * タブのインデックスとURLを使って照合
   *
   * 2パス処理：
   * 1. すべてのタブをルートノードとして追加
   * 2. 親子関係を設定
   */
  private async restoreFromTreeStructure(
    tabs: chrome.tabs.Tab[],
    treeStructure: TreeStructureEntry[],
    defaultViewId: string,
  ): Promise<void> {
    const sortedTabs = [...tabs].filter(t => t.id).sort((a, b) => a.index - b.index);

    const structureIndexToTabId = new Map<number, number>();
    const matchedTabIds = new Set<number>();

    for (let i = 0; i < treeStructure.length; i++) {
      const entry = treeStructure[i];
      const matchingTab = sortedTabs.find(
        t => t.id && !matchedTabIds.has(t.id) && t.index === entry.index && t.url === entry.url
      );
      if (matchingTab && matchingTab.id) {
        structureIndexToTabId.set(i, matchingTab.id);
        matchedTabIds.add(matchingTab.id);
      }
    }

    for (let i = 0; i < treeStructure.length; i++) {
      if (structureIndexToTabId.has(i)) continue;
      const entry = treeStructure[i];
      const matchingTab = sortedTabs.find(
        t => t.id && !matchedTabIds.has(t.id) && t.index === entry.index
      );
      if (matchingTab && matchingTab.id) {
        structureIndexToTabId.set(i, matchingTab.id);
        matchedTabIds.add(matchingTab.id);
      }
    }

    for (let i = 0; i < treeStructure.length; i++) {
      if (structureIndexToTabId.has(i)) continue;
      const entry = treeStructure[i];
      const matchingTab = sortedTabs.find(
        t => t.id && !matchedTabIds.has(t.id) && t.url === entry.url
      );
      if (matchingTab && matchingTab.id) {
        structureIndexToTabId.set(i, matchingTab.id);
        matchedTabIds.add(matchingTab.id);
      }
    }

    // パス1で新規追加されたタブIDを追跡
    // 既存ノードはloadState()で正しくparentIdが設定されているため、Pass2で上書きしない
    const newlyAddedTabIds = new Set<number>();

    for (let i = 0; i < treeStructure.length; i++) {
      const tabId = structureIndexToTabId.get(i);
      if (!tabId) continue;

      const tab = tabs.find(t => t.id === tabId);
      if (!tab || !tab.id) continue;

      const existingNode = this.getNodeByTabId(tab.id);
      if (existingNode) continue;

      const entry = treeStructure[i];

      await this.addTab(tab, null, entry.viewId || defaultViewId);

      newlyAddedTabIds.add(tabId);

      const newNode = this.getNodeByTabId(tab.id);
      if (newNode) {
        newNode.isExpanded = entry.isExpanded;
        if (entry.isExpanded) {
          this.expandedNodes.add(newNode.id);
        } else {
          this.expandedNodes.delete(newNode.id);
        }
      }
    }

    // パス2: 親子関係を設定（新規追加されたノードのみ）
    // 既存ノードのparentIdはloadState()で正しく設定されているため、上書きしない
    for (let i = 0; i < treeStructure.length; i++) {
      const entry = treeStructure[i];
      if (entry.parentIndex === null) continue;

      const tabId = structureIndexToTabId.get(i);
      const parentTabId = structureIndexToTabId.get(entry.parentIndex);
      if (!tabId || !parentTabId) continue;

      if (!newlyAddedTabIds.has(tabId)) continue;

      const childNode = this.getNodeByTabId(tabId);
      const parentNode = this.getNodeByTabId(parentTabId);
      if (!childNode || !parentNode) continue;

      childNode.parentId = parentNode.id;
      childNode.depth = parentNode.depth + 1;

      if (!parentNode.children.some(c => c.id === childNode.id)) {
        parentNode.children.push(childNode);
      }

      this.updateChildrenDepth(childNode);
    }

    for (const tab of tabs) {
      if (!tab.id) continue;
      if (matchedTabIds.has(tab.id)) continue;

      const existingNode = this.getNodeByTabId(tab.id);
      if (!existingNode) {
        const parentNode = tab.openerTabId
          ? this.getNodeByTabId(tab.openerTabId)
          : null;
        await this.addTab(tab, parentNode?.id || null, defaultViewId);
      }
    }
  }

  /**
   * openerTabIdを使って親子関係を復元（従来の方法）
   */
  private async syncWithOpenerTabId(
    tabs: chrome.tabs.Tab[],
    defaultViewId: string,
  ): Promise<void> {
    const tabsMap = new Map(tabs.filter(t => t.id).map(t => [t.id!, t]));
    const processedTabs = new Set<number>();
    const orderedTabs: chrome.tabs.Tab[] = [];

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

      const existingNode = this.getNodeByTabId(tab.id);
      if (!existingNode) {
        const parentNode = tab.openerTabId
          ? this.getNodeByTabId(tab.openerTabId)
          : null;

        await this.addTab(tab, parentNode?.id || null, defaultViewId);
      }
    }
  }

  /**
   * サブツリー全体のノード数を取得 (サブツリーサイズ計算)
   * サブツリー全体のノード数を正確に計算
   *
   * @param tabId - ルートタブのID
   * @returns サブツリー全体のノード数（ルートを含む）、タブが存在しない場合は0
   */
  getSubtreeSize(tabId: number): number {
    const rootNode = this.getNodeByTabId(tabId);
    if (!rootNode) {
      return 0;
    }
    return this.countSubtreeNodes(rootNode);
  }

  /**
   * ノードとその子孫の数を再帰的にカウント
   * @param node - カウント開始ノード
   * @returns ノード数
   */
  private countSubtreeNodes(node: TabNode): number {
    let count = 1;
    for (const child of node.children) {
      count += this.countSubtreeNodes(child);
    }
    return count;
  }

  /**
   * 指定されたタブとそのすべての子孫タブを取得 (サブツリー全体の移動)
   * 親タブとそのサブツリー全体を移動
   *
   * @param tabId - ルートタブのID
   * @returns サブツリー全体のノード配列（ルートを含む）
   */
  getSubtree(tabId: number): TabNode[] {
    const rootNode = this.getNodeByTabId(tabId);
    if (!rootNode) {
      return [];
    }

    const subtree: TabNode[] = [];
    this.collectSubtreeNodes(rootNode, subtree);
    return subtree;
  }

  /**
   * サブツリー全体を別のビューに移動 (サブツリー全体の移動)
   * クロスウィンドウ移動時にタブのツリー構造を維持
   *
   * @param tabId - ルートタブのID
   * @param newViewId - 移動先のビューID
   */
  async moveSubtreeToView(tabId: number, newViewId: string): Promise<void> {
    const subtree = this.getSubtree(tabId);
    if (subtree.length === 0) {
      return;
    }

    for (const node of subtree) {
      const oldViewNodes = this.views.get(node.viewId) || [];
      this.views.set(
        node.viewId,
        oldViewNodes.filter((id) => id !== node.id),
      );

      node.viewId = newViewId;
      const newViewNodes = this.views.get(newViewId) || [];
      if (!newViewNodes.includes(node.id)) {
        newViewNodes.push(node.id);
        this.views.set(newViewId, newViewNodes);
      }
    }

    await this.persistState();
  }

  /**
   * ノードとその子孫を再帰的に収集
   * @param node - 収集開始ノード
   * @param result - 結果配列
   */
  private collectSubtreeNodes(node: TabNode, result: TabNode[]): void {
    result.push(node);

    for (const child of node.children) {
      this.collectSubtreeNodes(child, result);
    }
  }

  /**
   * ストレージに状態を永続化
   * 既存のviews, currentViewIdを保持
   * 新規タブ追加後もビューを維持
   */
  private async persistState(): Promise<void> {
    const nodesRecord: Record<string, TabNode> = {};
    this.nodes.forEach((node, id) => {
      nodesRecord[id] = {
        ...node,
        children: [],
      };
    });

    const tabToNodeRecord: Record<number, string> = {};
    this.tabToNode.forEach((nodeId, tabId) => {
      tabToNodeRecord[tabId] = nodeId;
    });

    let existingViews: TreeState['views'] = [];
    let existingCurrentViewId = 'default';

    try {
      const existingState = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
      if (existingState) {
        if (existingState.views && existingState.views.length > 0) {
          existingViews = existingState.views;
        }
        if (existingState.currentViewId) {
          existingCurrentViewId = existingState.currentViewId;
        }
      }
    } catch {
    }

    const treeStructure = await this.buildTreeStructure();

    const treeState: TreeState = {
      views: existingViews,
      currentViewId: existingCurrentViewId,
      nodes: nodesRecord,
      tabToNode: tabToNodeRecord,
      treeStructure,
    };

    await this.storageService.set(STORAGE_KEYS.TREE_STATE, treeState);
  }

  /**
   * ツリー構造を順序付きで構築
   * Chromeタブのインデックス順にソートし、親子関係を保持
   */
  private async buildTreeStructure(): Promise<TreeStructureEntry[]> {
    try {
      const tabs = await chrome.tabs.query({});
      const tabMap = new Map(tabs.filter(t => t.id).map(t => [t.id!, t]));

      const nodesWithIndex: Array<{ node: TabNode; tab: chrome.tabs.Tab }> = [];
      this.nodes.forEach((node) => {
        const tab = tabMap.get(node.tabId);
        if (tab) {
          nodesWithIndex.push({ node, tab });
        }
      });

      nodesWithIndex.sort((a, b) => a.tab.index - b.tab.index);

      const nodeIdToIndex = new Map<string, number>();
      nodesWithIndex.forEach(({ node }, index) => {
        nodeIdToIndex.set(node.id, index);
      });

      const treeStructure: TreeStructureEntry[] = nodesWithIndex.map(({ node, tab }) => ({
        url: tab.url || '',
        parentIndex: node.parentId ? (nodeIdToIndex.get(node.parentId) ?? null) : null,
        index: tab.index,
        viewId: node.viewId,
        isExpanded: node.isExpanded,
      }));

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

      this.nodes.clear();
      this.tabToNode.clear();
      this.views.clear();

      Object.entries(state.nodes).forEach(([id, node]) => {
        this.nodes.set(id, { ...node, children: [] });
        this.tabToNode.set(node.tabId, id);

        const viewNodes = this.views.get(node.viewId) || [];
        viewNodes.push(id);
        this.views.set(node.viewId, viewNodes);

        if (node.isExpanded) {
          this.expandedNodes.add(id);
        }
      });

      Object.entries(state.nodes).forEach(([id, node]) => {
        if (node.parentId) {
          const parent = this.nodes.get(node.parentId);
          const child = this.nodes.get(id);
          if (parent && child) {
            parent.children.push(child);
          }
        }
      });

      const recalculateDepth = (node: TabNode, depth: number): void => {
        node.depth = depth;
        for (const child of node.children) {
          recalculateDepth(child, depth + 1);
        }
      };

      this.nodes.forEach((node) => {
        if (!node.parentId) {
          recalculateDepth(node, 0);
        }
      });
    } catch (_error) {
      // Error loading state silently
    }
  }

  /**
   * ノードが別のノードの子孫かどうかをチェック
   * @param ancestorId - 祖先ノードID
   * @param descendantId - 子孫ノードID
   * @returns true if descendantId is a descendant of ancestorId
   */
  private isDescendant(ancestorId: string, descendantId: string): boolean {
    const ancestor = this.nodes.get(ancestorId);
    if (!ancestor) return false;

    for (const child of ancestor.children) {
      if (child.id === descendantId) return true;
      if (this.isDescendant(child.id, descendantId)) return true;
    }

    return false;
  }

  /**
   * ノードの子ノードの深さを再帰的に更新
   * @param node - 更新するノード
   */
  private updateChildrenDepth(node: TabNode): void {
    for (const child of node.children) {
      child.depth = node.depth + 1;
      this.updateChildrenDepth(child);
    }
  }

  /**
   * 子タブを親のレベルに昇格させる (promote)
   *
   * 親タブが削除された時、その子タブを親のレベルに昇格させます:
   * - 親がルートノードの場合: 子タブもルートノードになる
   * - 親が子ノードの場合: 子タブは親の兄弟ノードになる
   *
   * @param parentNode - 削除される親ノード
   */
  private promoteChildren(parentNode: TabNode): void {
    const children = [...parentNode.children];

    for (const child of children) {
      child.parentId = parentNode.parentId;

      child.depth = parentNode.depth;

      if (child.groupId === parentNode.id || child.groupId === parentNode.groupId) {
        child.groupId = parentNode.parentId ? this.nodes.get(parentNode.parentId)?.groupId : undefined;
      }

      this.updateChildrenDepth(child);

      if (parentNode.parentId) {
        const grandparentNode = this.nodes.get(parentNode.parentId);
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
        const viewNodes = this.views.get(parentNode.viewId) || [];
        const parentIndex = viewNodes.indexOf(parentNode.id);
        if (parentIndex !== -1) {
          const insertIndex = parentIndex + 1 + children.indexOf(child);
          viewNodes.splice(insertIndex, 0, child.id);
        } else {
          viewNodes.push(child.id);
        }
        this.views.set(parentNode.viewId, viewNodes);
      }
    }

    parentNode.children = [];
  }

  /**
   * 子タブを再帰的に削除 (close_all)
   *
   * 親タブが削除された時、その子タブとすべての子孫タブを再帰的に削除します。
   * 深さ優先探索で子孫から順に削除していきます。
   *
   * @param parentNode - 削除される親ノード
   * @returns 削除された子タブのIDリスト(親ノード自身は含まない)
   */
  private removeChildrenRecursively(parentNode: TabNode): number[] {
    const closedTabIds: number[] = [];

    for (const child of [...parentNode.children]) {
      const grandchildTabIds = this.removeChildrenRecursively(child);
      closedTabIds.push(...grandchildTabIds);

      closedTabIds.push(child.tabId);

      const viewNodes = this.views.get(child.viewId) || [];
      this.views.set(
        child.viewId,
        viewNodes.filter((id) => id !== child.id),
      );

      this.nodes.delete(child.id);
      this.tabToNode.delete(child.tabId);
      this.expandedNodes.delete(child.id);
    }

    parentNode.children = [];

    return closedTabIds;
  }

  /**
   * 実タブを使用してグループを作成
   *
   * chrome.tabs.create()で作成された実際のタブIDを使用してグループノードを作成し、
   * 選択されたタブをその子要素として移動します。
   *
   * 階層決定ロジック:
   * - 選択されたタブがすべて同じ親を持つ場合、グループタブはその親の子として配置
   * - 選択されたタブが異なる親を持つ場合、グループタブはルートレベルに配置
   *
   * @param groupTabId - chrome.tabs.create()で作成されたグループタブのID（実タブID）
   * @param tabIds - グループ化するタブIDの配列
   * @param groupName - グループ名
   * @returns 作成されたグループノードのID
   */
  async createGroupWithRealTab(groupTabId: number, tabIds: number[], groupName: string = '新しいグループ'): Promise<string> {
    if (tabIds.length === 0) {
      throw new Error('No tabs specified for grouping');
    }

    const firstNode = this.getNodeByTabId(tabIds[0]);
    if (!firstNode) {
      throw new Error('First tab not found');
    }
    const viewId = firstNode.viewId;

    const groupNodeId = `group-${groupTabId}`;

    const parentIds = new Set<string | null>();
    for (const tabId of tabIds) {
      const node = this.getNodeByTabId(tabId);
      if (node) {
        parentIds.add(node.parentId);
      }
    }

    const allSameParent = parentIds.size === 1;
    const commonParentId = allSameParent ? firstNode.parentId : null;
    const groupDepth = commonParentId !== null ? (this.nodes.get(commonParentId)?.depth ?? 0) + 1 : 0;

    const groupNode: TabNode = {
      id: groupNodeId,
      tabId: groupTabId,
      parentId: commonParentId,
      children: [],
      isExpanded: true,
      depth: groupDepth,
      viewId,
      groupId: groupNodeId,
    };

    this.nodes.set(groupNodeId, groupNode);
    this.tabToNode.set(groupTabId, groupNodeId);
    this.expandedNodes.add(groupNodeId);

    const viewNodes = this.views.get(viewId) || [];

    const firstNodeIndex = viewNodes.findIndex((nodeId) => {
      const node = this.nodes.get(nodeId);
      return node && tabIds.includes(node.tabId);
    });

    if (commonParentId !== null) {
      const parentNode = this.nodes.get(commonParentId);
      if (parentNode) {
        const firstChildIndex = parentNode.children.findIndex(
          (child) => tabIds.includes(child.tabId)
        );
        if (firstChildIndex >= 0) {
          parentNode.children = parentNode.children.filter(
            (child) => !tabIds.includes(child.tabId)
          );
          parentNode.children.splice(firstChildIndex, 0, groupNode);
        } else {
          parentNode.children.push(groupNode);
        }
      }
    }

    if (firstNodeIndex >= 0) {
      viewNodes.splice(firstNodeIndex, 0, groupNodeId);
    } else {
      viewNodes.push(groupNodeId);
    }
    this.views.set(viewId, viewNodes);

    for (const tabId of tabIds) {
      const node = this.getNodeByTabId(tabId);
      if (!node) continue;

      if (node.parentId) {
        const oldParent = this.nodes.get(node.parentId);
        if (oldParent) {
          oldParent.children = oldParent.children.filter((child) => child.id !== node.id);
        }
      }

      const nodeIndexInView = viewNodes.indexOf(node.id);
      if (nodeIndexInView >= 0) {
        viewNodes.splice(nodeIndexInView, 1);
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
      const existingGroups: Record<string, { id: string; name: string; color: string; isExpanded: boolean }> = result.groups || {};
      existingGroups[groupNodeId] = {
        id: groupNodeId,
        name: groupName,
        color: '#f59e0b',
        isExpanded: true,
      };
      await chrome.storage.local.set({ groups: existingGroups });
    } catch (_err) {
    }

    return groupNodeId;
  }

  /**
   * グループを解除
   * グループを解除し、子タブをルートレベルに移動
   *
   * グループノードを削除し、その子タブをルートレベルに昇格させます。
   *
   * @param tabId - グループノードのタブID（または解除したいグループ内のタブID）
   */
  async dissolveGroup(tabId: number): Promise<void> {
    let node = this.getNodeByTabId(tabId);
    if (!node) {
      throw new Error('Tab not found');
    }

    let groupNode: TabNode | null = null;

    if (node.id.startsWith('group-')) {
      groupNode = node;
    } else if (node.groupId) {
      groupNode = this.nodes.get(node.groupId) || null;
    }

    if (!groupNode) {
      throw new Error('Group not found');
    }

    for (const child of [...groupNode.children]) {
      child.parentId = null;
      child.depth = 0;
      child.groupId = undefined;

      this.updateChildrenDepth(child);
    }

    const viewNodes = this.views.get(groupNode.viewId) || [];
    this.views.set(
      groupNode.viewId,
      viewNodes.filter((id) => id !== groupNode.id),
    );

    this.nodes.delete(groupNode.id);
    this.tabToNode.delete(groupNode.tabId);
    this.expandedNodes.delete(groupNode.id);

    await this.persistState();
  }

  /**
   * グループ情報を取得
   *
   * グループタブのタブIDからグループ情報（名前と子タブリスト）を取得します。
   *
   * @param tabId - グループノードのタブID
   * @returns グループ情報（名前と子タブのリスト）
   */
  async getGroupInfo(tabId: number): Promise<{
    name: string;
    children: Array<{ tabId: number; title: string; url: string }>;
  }> {
    const node = this.getNodeByTabId(tabId);
    if (!node) {
      throw new Error('Group not found');
    }

    if (!node.id.startsWith('group-')) {
      throw new Error('Not a group tab');
    }

    let groupName = '新しいグループ';
    try {
      const result = await chrome.storage.local.get('groups');
      const groups: Record<string, { id: string; name: string; color: string; isExpanded: boolean }> = result.groups || {};
      if (groups[node.id]) {
        groupName = groups[node.id].name;
      }
    } catch (_err) {
    }

    const children: Array<{ tabId: number; title: string; url: string }> = [];
    for (const child of node.children) {
      try {
        const tab = await chrome.tabs.get(child.tabId);
        children.push({
          tabId: child.tabId,
          title: tab.title || '',
          url: tab.url || '',
        });
      } catch (_err) {
      }
    }

    return {
      name: groupName,
      children,
    };
  }
}
