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
  private views: Map<string, string[]> = new Map(); // viewId -> nodeIds[]
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

    // 新しいノードを作成
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

    // マッピングに追加
    this.nodes.set(nodeId, newNode);
    this.tabToNode.set(tab.id, nodeId);
    this.expandedNodes.add(nodeId);

    // ビューに追加
    // ルートレベルでも特定のノードの直後に挿入（複製タブ用）
    const viewNodes = this.views.get(viewId) || [];
    if (!parentId && insertAfterNodeId) {
      // ルートレベルで挿入位置を指定された場合
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

    // 親ノードに子として追加
    if (parentId) {
      const parentNode = this.nodes.get(parentId);
      if (parentNode) {
        // 特定のノードの直後に挿入（複製タブ用）
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

    // ストレージに永続化
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

    // 子タブの処理
    if (childTabBehavior === 'promote') {
      // 子タブを昇格させる
      this.promoteChildren(node);
    } else if (childTabBehavior === 'close_all') {
      // 子タブを再帰的に削除
      const childTabIds = this.removeChildrenRecursively(node);
      closedTabIds.push(...childTabIds);
    }

    // 親ノードから削除
    if (node.parentId) {
      const parentNode = this.nodes.get(node.parentId);
      if (parentNode) {
        parentNode.children = parentNode.children.filter((child) => child.id !== nodeId);
      }
    }

    // ビューから削除
    const viewNodes = this.views.get(node.viewId) || [];
    this.views.set(
      node.viewId,
      viewNodes.filter((id) => id !== nodeId),
    );

    // マッピングから削除
    this.nodes.delete(nodeId);
    this.tabToNode.delete(tabId);
    this.expandedNodes.delete(nodeId);

    // ストレージに永続化
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

    // 循環参照のチェック
    // nodeId の子孫に newParentId があるかをチェック
    // （つまり、移動先の親が自分自身の子孫であれば循環参照）
    if (newParentId && this.isDescendant(nodeId, newParentId)) {
      return;
    }

    // 自己参照のチェック（自分自身を親にしようとした場合）
    if (newParentId === nodeId) {
      return;
    }

    // 古い親から削除
    if (node.parentId) {
      const oldParent = this.nodes.get(node.parentId);
      if (oldParent) {
        oldParent.children = oldParent.children.filter((child) => child.id !== nodeId);
      }
    }

    // 新しい親に追加
    node.parentId = newParentId;
    node.depth = newParentId ? (this.nodes.get(newParentId)?.depth || 0) + 1 : 0;

    // 子ノードの深さを再帰的に更新
    this.updateChildrenDepth(node);

    if (newParentId) {
      const newParent = this.nodes.get(newParentId);
      if (newParent) {
        newParent.children.splice(index, 0, node);
      }
    }

    // ストレージに永続化
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

    // ストレージに永続化
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

    // 既に展開されている場合は何もしない
    if (node.isExpanded) return;

    node.isExpanded = true;
    this.expandedNodes.add(nodeId);

    // ストレージに永続化
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

    // ツリー内の全タブIDを取得し、存在しないものを特定
    this.tabToNode.forEach((_, tabId) => {
      if (!existingTabIdSet.has(tabId)) {
        staleTabIds.push(tabId);
      }
    });

    // 存在しないタブがなければ早期リターン
    if (staleTabIds.length === 0) {
      return 0;
    }

    // 各存在しないタブを削除（子タブは昇格させる）
    for (const tabId of staleTabIds) {
      await this.removeStaleNode(tabId);
    }

    // ストレージに永続化
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

    // 子タブを昇格させる
    this.promoteChildren(node);

    // 親ノードから削除
    if (node.parentId) {
      const parentNode = this.nodes.get(node.parentId);
      if (parentNode) {
        parentNode.children = parentNode.children.filter((child) => child.id !== nodeId);
      }
    }

    // ビューから削除
    const viewNodes = this.views.get(node.viewId) || [];
    this.views.set(
      node.viewId,
      viewNodes.filter((id) => id !== nodeId),
    );

    // マッピングから削除
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

      // 現在のビューIDを取得（デフォルトビューを使用）
      // Must match TreeStateProvider's default currentViewId
      const defaultViewId = 'default';

      // ストレージからtreeStructureを取得
      const state = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
      const treeStructure = state?.treeStructure;

      // treeStructureがある場合は、それを使って親子関係を復元
      if (treeStructure && treeStructure.length > 0) {
        await this.restoreFromTreeStructure(tabs, treeStructure, defaultViewId);
      } else {
        // treeStructureがない場合は、従来のopenerTabIdベースの復元
        await this.syncWithOpenerTabId(tabs, defaultViewId);
      }

      // ストレージに永続化
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
      // ストレージから最新の状態を読み込み
      await this.loadState();
      // treeStructureを再構築して保存
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
    // タブをインデックスでソート
    const sortedTabs = [...tabs].filter(t => t.id).sort((a, b) => a.index - b.index);

    // treeStructureエントリとタブのマッチング
    // インデックスが同じでURLも一致する場合にマッチ
    // URLが変わっている場合もインデックスが近ければマッチ

    // まず、treeStructureのインデックスから新しいタブIDへのマッピングを作成
    const structureIndexToTabId = new Map<number, number>();
    const matchedTabIds = new Set<number>();

    // 1. 完全一致（インデックスとURL両方）を優先
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

    // 2. インデックス一致（URLは異なる）
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

    // 3. URL一致（インデックスは異なる）
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

    // パス1: すべてのマッチしたタブをルートノードとして追加
    for (let i = 0; i < treeStructure.length; i++) {
      const tabId = structureIndexToTabId.get(i);
      if (!tabId) continue;

      const tab = tabs.find(t => t.id === tabId);
      if (!tab || !tab.id) continue;

      const existingNode = this.getNodeByTabId(tab.id);
      if (existingNode) continue;

      const entry = treeStructure[i];

      // まずルートノードとして追加
      await this.addTab(tab, null, entry.viewId || defaultViewId);

      // 新規追加されたタブを追跡
      newlyAddedTabIds.add(tabId);

      // 展開状態を設定
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

      // 新規追加されたノードのみ親子関係を設定
      if (!newlyAddedTabIds.has(tabId)) continue;

      const childNode = this.getNodeByTabId(tabId);
      const parentNode = this.getNodeByTabId(parentTabId);
      if (!childNode || !parentNode) continue;

      // 親子関係を設定
      childNode.parentId = parentNode.id;
      childNode.depth = parentNode.depth + 1;

      // 親ノードのchildren配列に追加
      if (!parentNode.children.some(c => c.id === childNode.id)) {
        parentNode.children.push(childNode);
      }

      // 子孫の深さを再帰的に更新
      this.updateChildrenDepth(childNode);
    }

    // マッチしなかったタブはルートノードとして追加
    for (const tab of tabs) {
      if (!tab.id) continue;
      if (matchedTabIds.has(tab.id)) continue;

      const existingNode = this.getNodeByTabId(tab.id);
      if (!existingNode) {
        // openerTabIdがあればそれを使う
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
    // タブをopenerTabIdの依存関係順にソート（親が先、子が後）
    // これにより、親タブが必ず子タブより先にTreeに追加される
    const tabsMap = new Map(tabs.filter(t => t.id).map(t => [t.id!, t]));
    const processedTabs = new Set<number>();
    const orderedTabs: chrome.tabs.Tab[] = [];

    const addTabAndChildren = (tab: chrome.tabs.Tab) => {
      if (!tab.id || processedTabs.has(tab.id)) return;

      // 親がいる場合は、親を先に処理
      if (tab.openerTabId && tabsMap.has(tab.openerTabId)) {
        addTabAndChildren(tabsMap.get(tab.openerTabId)!);
      }

      processedTabs.add(tab.id);
      orderedTabs.push(tab);
    };

    // すべてのタブを依存関係順に処理
    for (const tab of tabs) {
      if (tab.id) {
        addTabAndChildren(tab);
      }
    }

    // 依存関係順に追加
    for (const tab of orderedTabs) {
      if (!tab.id) continue;

      // 既存のノードがない場合のみ追加
      const existingNode = this.getNodeByTabId(tab.id);
      if (!existingNode) {
        // openerTabIdから親を特定
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
    let count = 1; // 自分自身をカウント
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

    // サブツリー内のすべてのノードのviewIdを更新
    for (const node of subtree) {
      // 古いビューから削除
      const oldViewNodes = this.views.get(node.viewId) || [];
      this.views.set(
        node.viewId,
        oldViewNodes.filter((id) => id !== node.id),
      );

      // 新しいビューに追加
      node.viewId = newViewId;
      const newViewNodes = this.views.get(newViewId) || [];
      if (!newViewNodes.includes(node.id)) {
        newViewNodes.push(node.id);
        this.views.set(newViewId, newViewNodes);
      }
    }

    // ストレージに永続化
    await this.persistState();
  }

  /**
   * ノードとその子孫を再帰的に収集
   * @param node - 収集開始ノード
   * @param result - 結果配列
   */
  private collectSubtreeNodes(node: TabNode, result: TabNode[]): void {
    result.push(node);

    // 子ノードを再帰的に収集
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
      // children配列は保存せず、parentIdから再構築する
      nodesRecord[id] = {
        ...node,
        children: [], // 空配列で保存し、loadStateで再構築
      };
    });

    const tabToNodeRecord: Record<number, string> = {};
    this.tabToNode.forEach((nodeId, tabId) => {
      tabToNodeRecord[tabId] = nodeId;
    });

    // 既存のストレージからviews, currentViewIdを取得して保持
    // これにより、新規タブ追加時にビューがリセットされることを防ぐ
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
      // ストレージ読み取りに失敗した場合はデフォルト値を使用
    }

    // ツリー構造を順序付きで保存（ブラウザ再起動時の復元用）
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

      // ノードをChromeタブのインデックス順にソート
      const nodesWithIndex: Array<{ node: TabNode; tab: chrome.tabs.Tab }> = [];
      this.nodes.forEach((node) => {
        const tab = tabMap.get(node.tabId);
        if (tab) {
          nodesWithIndex.push({ node, tab });
        }
      });

      // インデックスでソート
      nodesWithIndex.sort((a, b) => a.tab.index - b.tab.index);

      // nodeIdからインデックスへのマッピングを作成
      const nodeIdToIndex = new Map<string, number>();
      nodesWithIndex.forEach(({ node }, index) => {
        nodeIdToIndex.set(node.id, index);
      });

      // TreeStructureEntryの配列を構築
      const treeStructure: TreeStructureEntry[] = nodesWithIndex.map(({ node, tab }) => ({
        url: tab.url || '',
        parentIndex: node.parentId ? (nodeIdToIndex.get(node.parentId) ?? null) : null,
        index: tab.index,
        viewId: node.viewId,
        isExpanded: node.isExpanded,
      }));

      return treeStructure;
    } catch {
      // タブ情報の取得に失敗した場合は空配列を返す
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

      // ノードの復元
      this.nodes.clear();
      this.tabToNode.clear();
      this.views.clear();

      // 最初にすべてのノードを空の children 配列でロード
      Object.entries(state.nodes).forEach(([id, node]) => {
        this.nodes.set(id, { ...node, children: [] });
        this.tabToNode.set(node.tabId, id);

        // ビューにノードを追加
        const viewNodes = this.views.get(node.viewId) || [];
        viewNodes.push(id);
        this.views.set(node.viewId, viewNodes);

        if (node.isExpanded) {
          this.expandedNodes.add(id);
        }
      });

      // parentId に基づいて children 参照を再構築
      Object.entries(state.nodes).forEach(([id, node]) => {
        if (node.parentId) {
          const parent = this.nodes.get(node.parentId);
          const child = this.nodes.get(id);
          if (parent && child) {
            parent.children.push(child);
          }
        }
      });

      // すべてのノードの depth を再計算（ルートノードから開始して再帰的に）
      // これにより、ストレージの破損やマイグレーション後でも正しい深さが保証される
      const recalculateDepth = (node: TabNode, depth: number): void => {
        node.depth = depth;
        for (const child of node.children) {
          recalculateDepth(child, depth + 1);
        }
      };

      // ルートノード（parentId が null）から開始
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

    // 再帰的に子ノードをチェック
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
      // 子ノードの親IDを親ノードの親IDに設定
      // (親がルートの場合はnullになり、子もルートノードになる)
      child.parentId = parentNode.parentId;

      // 深さを1レベル上げる
      child.depth = parentNode.depth;

      // グループIDをクリア（グループから解放された場合）
      if (child.groupId === parentNode.id || child.groupId === parentNode.groupId) {
        child.groupId = parentNode.parentId ? this.nodes.get(parentNode.parentId)?.groupId : undefined;
      }

      // 子ノードの子孫の深さも再帰的に更新
      this.updateChildrenDepth(child);

      // 親ノードに親がいる場合、その親の子として追加
      if (parentNode.parentId) {
        const grandparentNode = this.nodes.get(parentNode.parentId);
        if (grandparentNode) {
          // 親ノードの直後に子を挿入して順序を保つ
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
        // 親がルートノードの場合、子をビューノードリストに追加
        // 親ノードの直後の位置に挿入
        const viewNodes = this.views.get(parentNode.viewId) || [];
        const parentIndex = viewNodes.indexOf(parentNode.id);
        if (parentIndex !== -1) {
          // 親の後の位置に順番に挿入（最初の子は親の直後、2番目は最初の子の後、...）
          const insertIndex = parentIndex + 1 + children.indexOf(child);
          viewNodes.splice(insertIndex, 0, child.id);
        } else {
          viewNodes.push(child.id);
        }
        this.views.set(parentNode.viewId, viewNodes);
      }
    }

    // 親ノードの子配列をクリア
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

    // 配列のコピーを作成してイテレート（削除中に配列が変更されるのを防ぐ）
    for (const child of [...parentNode.children]) {
      // 孫タブを再帰的に削除（深さ優先）
      const grandchildTabIds = this.removeChildrenRecursively(child);
      closedTabIds.push(...grandchildTabIds);

      // 子タブのIDを記録
      closedTabIds.push(child.tabId);

      // ビューから削除
      const viewNodes = this.views.get(child.viewId) || [];
      this.views.set(
        child.viewId,
        viewNodes.filter((id) => id !== child.id),
      );

      // マッピングから削除
      this.nodes.delete(child.id);
      this.tabToNode.delete(child.tabId);
      this.expandedNodes.delete(child.id);
    }

    // 親ノードの子配列をクリア
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

    // 最初のタブからviewIdを取得
    const firstNode = this.getNodeByTabId(tabIds[0]);
    if (!firstNode) {
      throw new Error('First tab not found');
    }
    const viewId = firstNode.viewId;

    // グループノードIDを生成（実タブIDを使用）
    const groupNodeId = `group-${groupTabId}`;

    // グループタブの階層決定
    // すべてのタブが同じ親を持つかチェック
    const parentIds = new Set<string | null>();
    for (const tabId of tabIds) {
      const node = this.getNodeByTabId(tabId);
      if (node) {
        parentIds.add(node.parentId);
      }
    }

    // 階層決定: すべて同じ親を持つ場合はその親の子として、異なる場合はルートレベルに配置
    const allSameParent = parentIds.size === 1;
    const commonParentId = allSameParent ? firstNode.parentId : null;
    const groupDepth = commonParentId !== null ? (this.nodes.get(commonParentId)?.depth ?? 0) + 1 : 0;

    // グループノードを作成
    const groupNode: TabNode = {
      id: groupNodeId,
      tabId: groupTabId,
      parentId: commonParentId,
      children: [],
      isExpanded: true,
      depth: groupDepth,
      viewId,
      groupId: groupNodeId, // グループノード自体にgroupIdを設定
    };

    // マッピングに追加
    this.nodes.set(groupNodeId, groupNode);
    this.tabToNode.set(groupTabId, groupNodeId);
    this.expandedNodes.add(groupNodeId);

    // ビューノードリストを取得
    const viewNodes = this.views.get(viewId) || [];

    // グループ化対象の最初のノードのインデックスを取得
    const firstNodeIndex = viewNodes.findIndex((nodeId) => {
      const node = this.nodes.get(nodeId);
      return node && tabIds.includes(node.tabId);
    });

    // 親ノードがある場合は親の子リストに追加（グループ化対象の最初のノードの位置に挿入）
    if (commonParentId !== null) {
      const parentNode = this.nodes.get(commonParentId);
      if (parentNode) {
        // グループ化対象ノードの親の子リストでの位置を見つける
        const firstChildIndex = parentNode.children.findIndex(
          (child) => tabIds.includes(child.tabId)
        );
        if (firstChildIndex >= 0) {
          // グループ化対象ノードを親の子リストから削除
          parentNode.children = parentNode.children.filter(
            (child) => !tabIds.includes(child.tabId)
          );
          // グループノードを最初の子の位置に挿入
          parentNode.children.splice(firstChildIndex, 0, groupNode);
        } else {
          parentNode.children.push(groupNode);
        }
      }
    }

    // ビューに追加（グループ化対象の最初のノードの位置に挿入）
    if (firstNodeIndex >= 0) {
      viewNodes.splice(firstNodeIndex, 0, groupNodeId);
    } else {
      viewNodes.push(groupNodeId);
    }
    this.views.set(viewId, viewNodes);

    // 選択されたタブをグループの子として移動
    for (const tabId of tabIds) {
      const node = this.getNodeByTabId(tabId);
      if (!node) continue;

      // 既存の親から削除
      if (node.parentId) {
        const oldParent = this.nodes.get(node.parentId);
        if (oldParent) {
          oldParent.children = oldParent.children.filter((child) => child.id !== node.id);
        }
      }

      // ビューノードリストから削除（子になるのでルートレベルから削除）
      const nodeIndexInView = viewNodes.indexOf(node.id);
      if (nodeIndexInView >= 0) {
        viewNodes.splice(nodeIndexInView, 1);
      }

      // グループの子として追加
      node.parentId = groupNodeId;
      node.depth = groupDepth + 1; // グループの深さ + 1
      node.groupId = groupNodeId;
      groupNode.children.push(node);

      // 子ノードの深さを再帰的に更新
      this.updateChildrenDepth(node);
    }

    // ストレージに永続化
    await this.persistState();

    // グループ情報をgroupsストレージにも保存
    try {
      const result = await chrome.storage.local.get('groups');
      const existingGroups: Record<string, { id: string; name: string; color: string; isExpanded: boolean }> = result.groups || {};
      existingGroups[groupNodeId] = {
        id: groupNodeId,
        name: groupName,
        color: '#f59e0b',  // オレンジ色のデフォルト
        isExpanded: true,
      };
      await chrome.storage.local.set({ groups: existingGroups });
    } catch (_err) {
      // グループストレージの保存に失敗
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
    // タブIDからノードを取得
    let node = this.getNodeByTabId(tabId);
    if (!node) {
      throw new Error('Tab not found');
    }

    // グループノードを特定（ノード自体がグループか、親がグループの場合）
    let groupNode: TabNode | null = null;

    if (node.id.startsWith('group-')) {
      // ノード自体がグループノード
      groupNode = node;
    } else if (node.groupId) {
      // ノードがグループに属している場合、そのグループノードを取得
      groupNode = this.nodes.get(node.groupId) || null;
    }

    if (!groupNode) {
      throw new Error('Group not found');
    }

    // 子タブをルートレベルに昇格
    for (const child of [...groupNode.children]) {
      child.parentId = null;
      child.depth = 0;
      child.groupId = undefined;

      // 子ノードの深さを再帰的に更新
      this.updateChildrenDepth(child);
    }

    // グループノードをビューから削除
    const viewNodes = this.views.get(groupNode.viewId) || [];
    this.views.set(
      groupNode.viewId,
      viewNodes.filter((id) => id !== groupNode.id),
    );

    // グループノードをマッピングから削除
    this.nodes.delete(groupNode.id);
    this.tabToNode.delete(groupNode.tabId);
    this.expandedNodes.delete(groupNode.id);

    // ストレージに永続化
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

    // グループノードかどうかを確認
    if (!node.id.startsWith('group-')) {
      throw new Error('Not a group tab');
    }

    // グループ名をストレージから取得（デフォルト名：「新しいグループ」）
    let groupName = '新しいグループ';
    try {
      const result = await chrome.storage.local.get('groups');
      const groups: Record<string, { id: string; name: string; color: string; isExpanded: boolean }> = result.groups || {};
      if (groups[node.id]) {
        groupName = groups[node.id].name;
      }
    } catch (_err) {
      // グループ情報の取得に失敗した場合はデフォルト名を使用
    }

    // 子タブの情報を取得
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
        // タブが見つからない場合はスキップ
      }
    }

    return {
      name: groupName,
      children,
    };
  }
}
