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
  private persistQueue: Promise<void> = Promise.resolve();
  private syncInProgress: boolean = false;
  private syncCompleted: boolean = false;

  constructor(private storageService: IStorageService) {}

  /**
   * 同期が完了しているかどうかを返す
   * ブラウザ起動時の初期同期が完了した後にtrueになる
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
   * 指定されたviewIdのタブツリーを取得
   * @param viewId - ビューID
   * @returns ルートノードの配列
   */
  getTree(viewId: string): TabNode[] {
    const nodeIds = this.views.get(viewId) || [];
    console.log('[DEBUG getTree] viewId:', viewId, 'nodeIds:', nodeIds);
    const rootNodes = nodeIds
      .map((id) => this.nodes.get(id))
      .filter((node): node is TabNode => node !== undefined && node.parentId === null);
    console.log('[DEBUG getTree] rootNodes order:', rootNodes.map(n => ({ id: n.id, tabId: n.tabId })));

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
   * nodeIdからTabNodeを取得
   * @param nodeId - ノードID
   * @returns TabNodeまたはnull
   */
  getNodeById(nodeId: string): TabNode | null {
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
    console.log('[DEBUG addTab] viewId:', viewId, 'insertAfterNodeId:', insertAfterNodeId, 'viewNodes before:', [...viewNodes]);
    if (!parentId && insertAfterNodeId) {
      const insertAfterIndex = viewNodes.indexOf(insertAfterNodeId);
      console.log('[DEBUG addTab] insertAfterIndex:', insertAfterIndex);
      if (insertAfterIndex !== -1) {
        viewNodes.splice(insertAfterIndex + 1, 0, nodeId);
        console.log('[DEBUG addTab] Inserted at index:', insertAfterIndex + 1);
      } else {
        viewNodes.push(nodeId);
        console.log('[DEBUG addTab] insertAfterNodeId not found, pushed to end');
      }
    } else {
      viewNodes.push(nodeId);
      console.log('[DEBUG addTab] No insertAfterNodeId or has parentId, pushed to end');
    }
    console.log('[DEBUG addTab] viewNodes after:', [...viewNodes]);
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

    // preserveExpandedStates: false で呼び出し、トグル変更を確実に保存
    await this.persistState(false);
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

    // preserveExpandedStates: false で呼び出し、展開変更を確実に保存
    await this.persistState(false);
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
   *
   * @param userSettings - ユーザー設定（未マッチタブの追加位置を決定するため）
   */
  async syncWithChromeTabs(userSettings?: {
    newTabPositionManual?: 'child' | 'sibling' | 'end';
  }): Promise<void> {
    // 並行実行を防止
    if (this.syncInProgress || this.syncCompleted) {
      return;
    }
    this.syncInProgress = true;

    try {
      // 同期前にストレージから最新状態を読み込む
      // 並行操作（handleTabCreatedなど）が保存した状態を上書きしないための競合防止
      await this.loadState();

      const tabs = await chrome.tabs.query({});

      // TreeStateProviderのdefaultのcurrentViewIdと一致させる必要がある
      const defaultViewId = 'default';

      const state = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
      const treeStructure = state?.treeStructure;

      if (treeStructure && treeStructure.length > 0) {
        await this.restoreFromTreeStructure(tabs, treeStructure, defaultViewId, userSettings);
      } else {
        await this.syncWithOpenerTabId(tabs, defaultViewId, userSettings);
      }

      await this.persistState();
      this.syncCompleted = true;
    } catch {
      // Chromeタブとの同期失敗は無視
    } finally {
      this.syncInProgress = false;
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
    } catch {
      // ツリー構造のリフレッシュ失敗は無視
    }
  }

  /**
   * treeStructureから親子関係を復元
   * タブのURLを優先して照合（ブラウザ再起動後にタブIDとインデックスが変わるため）
   *
   * 2パス処理：
   * 1. すべてのタブをルートノードとして追加
   * 2. 親子関係を設定
   *
   * マッチング優先順位:
   * 1. URL + index の両方が一致（最も信頼性が高い）
   * 2. URL のみが一致（ブラウザ再起動後にインデックスが変わった場合）
   * 3. index のみが一致（URLが変わった場合、フォールバック）
   *
   * @param userSettings - ユーザー設定（未マッチタブの追加位置を決定するため）
   */
  private async restoreFromTreeStructure(
    tabs: chrome.tabs.Tab[],
    treeStructure: TreeStructureEntry[],
    defaultViewId: string,
    userSettings?: { newTabPositionManual?: 'child' | 'sibling' | 'end' },
  ): Promise<void> {
    // ブラウザ再起動後、古いタブIDのノードが残っている可能性があるため
    // 新しいタブとマッチングする前に、存在しないタブIDのノードを特定する
    const currentTabIds = new Set(tabs.filter(t => t.id).map(t => t.id!));
    const staleNodeIds: string[] = [];
    this.nodes.forEach((node, nodeId) => {
      if (!currentTabIds.has(node.tabId)) {
        staleNodeIds.push(nodeId);
      }
    });

    // 古いノードを一時的にクリア（マッチングの邪魔にならないように）
    for (const nodeId of staleNodeIds) {
      const node = this.nodes.get(nodeId);
      if (node) {
        this.tabToNode.delete(node.tabId);
        this.nodes.delete(nodeId);
        this.expandedNodes.delete(nodeId);
        // ビューからも削除
        const viewNodes = this.views.get(node.viewId);
        if (viewNodes) {
          const index = viewNodes.indexOf(nodeId);
          if (index !== -1) {
            viewNodes.splice(index, 1);
          }
        }
      }
    }

    const sortedTabs = [...tabs].filter(t => t.id).sort((a, b) => a.index - b.index);

    // indexをキーにしたtreeStructureのマップを作成
    const indexToStructureEntry = new Map<number, { structureIndex: number; entry: TreeStructureEntry }>();
    for (let i = 0; i < treeStructure.length; i++) {
      const entry = treeStructure[i];
      indexToStructureEntry.set(entry.index, { structureIndex: i, entry });
    }

    const structureIndexToTabId = new Map<number, number>();
    const matchedTabIds = new Set<number>();

    // indexのみでマッチング（Chromeはブラウザ再起動時にタブの順序を維持する）
    for (const tab of sortedTabs) {
      if (!tab.id) continue;
      const structureData = indexToStructureEntry.get(tab.index);
      if (structureData && !matchedTabIds.has(tab.id)) {
        structureIndexToTabId.set(structureData.structureIndex, tab.id);
        matchedTabIds.add(tab.id);
      }
    }

    // マッチしたタブをノードとして追加（または既存ノードのviewIdを更新）
    for (let i = 0; i < treeStructure.length; i++) {
      const tabId = structureIndexToTabId.get(i);
      if (!tabId) continue;

      const tab = tabs.find(t => t.id === tabId);
      if (!tab || !tab.id) continue;

      const entry = treeStructure[i];
      const viewIdToUse = entry.viewId || defaultViewId;

      // 既存ノードがあればviewIdを更新
      const existingNode = this.getNodeByTabId(tab.id);
      if (existingNode) {
        const oldViewId = existingNode.viewId;
        if (oldViewId !== viewIdToUse) {
          // 古いビューからノードを削除
          const oldViewNodes = this.views.get(oldViewId);
          if (oldViewNodes) {
            const index = oldViewNodes.indexOf(existingNode.id);
            if (index !== -1) {
              oldViewNodes.splice(index, 1);
            }
          }
          // 新しいビューにノードを追加
          const newViewNodes = this.views.get(viewIdToUse) || [];
          if (!newViewNodes.includes(existingNode.id)) {
            newViewNodes.push(existingNode.id);
            this.views.set(viewIdToUse, newViewNodes);
          }
          // ノードのviewIdを更新
          existingNode.viewId = viewIdToUse;
        }
        // isExpandedも更新
        existingNode.isExpanded = entry.isExpanded;
        if (entry.isExpanded) {
          this.expandedNodes.add(existingNode.id);
        } else {
          this.expandedNodes.delete(existingNode.id);
        }
        continue;
      }

      await this.addTab(tab, null, viewIdToUse);

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

    // パス5: 親子関係を設定（すべてのマッチしたノード）
    // 深い階層（孫、ひ孫など）も正しく復元するため、depthの浅い順に処理
    const entriesWithDepth: Array<{ index: number; entry: TreeStructureEntry; depth: number }> = [];
    for (let i = 0; i < treeStructure.length; i++) {
      const entry = treeStructure[i];
      // depth計算: parentIndexを辿って深さを算出
      let depth = 0;
      let currentParentIndex = entry.parentIndex;
      while (currentParentIndex !== null) {
        depth++;
        currentParentIndex = treeStructure[currentParentIndex]?.parentIndex ?? null;
      }
      entriesWithDepth.push({ index: i, entry, depth });
    }
    // depthの浅い順にソート（親から先に処理）
    entriesWithDepth.sort((a, b) => a.depth - b.depth);

    for (const { index: i, entry } of entriesWithDepth) {
      if (entry.parentIndex === null) continue;

      const tabId = structureIndexToTabId.get(i);
      const parentTabId = structureIndexToTabId.get(entry.parentIndex);
      if (!tabId || !parentTabId) continue;

      const childNode = this.getNodeByTabId(tabId);
      const parentNode = this.getNodeByTabId(parentTabId);
      if (!childNode || !parentNode) continue;

      // 既に正しい親子関係が設定されている場合はスキップ
      if (childNode.parentId === parentNode.id) continue;

      // 古い親から子を削除
      if (childNode.parentId) {
        const oldParent = this.nodes.get(childNode.parentId);
        if (oldParent) {
          oldParent.children = oldParent.children.filter(c => c.id !== childNode.id);
        }
      }

      childNode.parentId = parentNode.id;
      childNode.depth = parentNode.depth + 1;

      if (!parentNode.children.some(c => c.id === childNode.id)) {
        parentNode.children.push(childNode);
      }

      this.updateChildrenDepth(childNode);
    }

    // 未マッチのタブを追加
    // ユーザー設定のnewTabPositionManualを考慮
    const newTabPosition = userSettings?.newTabPositionManual ?? 'end';

    for (const tab of tabs) {
      if (!tab.id) continue;
      if (matchedTabIds.has(tab.id)) continue;

      const existingNode = this.getNodeByTabId(tab.id);
      if (!existingNode) {
        let parentId: string | null = null;

        // 'end'の場合は親なし（ルートレベル）に追加
        // 'child'/'sibling'の場合はopenerTabIdを使用
        if (newTabPosition !== 'end' && tab.openerTabId) {
          const parentNode = this.getNodeByTabId(tab.openerTabId);
          parentId = parentNode?.id || null;
        }

        await this.addTab(tab, parentId, defaultViewId);

        // 'end'設定の場合、Chromeのタブ順序も最後に移動
        if (newTabPosition === 'end' && tab.windowId !== undefined) {
          try {
            await chrome.tabs.move(tab.id, { index: -1 });
          } catch {
            // タブ移動失敗は無視
          }
        }
      }
    }
  }

  /**
   * openerTabIdを使って親子関係を復元（従来の方法）
   *
   * @param userSettings - ユーザー設定（未マッチタブの追加位置を決定するため）
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

      const existingNode = this.getNodeByTabId(tab.id);
      if (!existingNode) {
        let parentId: string | null = null;

        // 'end'の場合は親なし（ルートレベル）に追加
        // 'child'/'sibling'の場合はopenerTabIdを使用
        if (newTabPosition !== 'end' && tab.openerTabId) {
          const parentNode = this.getNodeByTabId(tab.openerTabId);
          parentId = parentNode?.id || null;
        }

        await this.addTab(tab, parentId, defaultViewId);

        // 'end'設定の場合、Chromeのタブ順序も最後に移動
        if (newTabPosition === 'end' && tab.windowId !== undefined) {
          try {
            await chrome.tabs.move(tab.id, { index: -1 });
          } catch {
            // タブ移動失敗は無視
          }
        }
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
   * タブIDを置き換える
   * chrome.tabs.onReplacedで発火したときに使用
   * discardなどでタブIDが変わった場合に対応
   *
   * @param oldTabId - 古いタブID
   * @param newTabId - 新しいタブID
   */
  async replaceTabId(oldTabId: number, newTabId: number): Promise<void> {
    const nodeId = this.tabToNode.get(oldTabId);
    if (!nodeId) {
      return;
    }

    const node = this.nodes.get(nodeId);
    if (!node) {
      return;
    }

    // tabIdを更新
    node.tabId = newTabId;

    // tabToNodeマップを更新
    this.tabToNode.delete(oldTabId);
    this.tabToNode.set(newTabId, nodeId);

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
   *
   * @param preserveExpandedStates - trueの場合、既存ノードのisExpanded状態をストレージから保持する
   *   デフォルトはtrue。toggleExpandやexpandNodeでは明示的にfalseを渡して、
   *   バックグラウンドでの変更を確実に保存する。
   */
  private async persistState(preserveExpandedStates: boolean = true): Promise<void> {
    this.persistQueue = this.persistQueue
      .then(() => this.persistStateInternal(preserveExpandedStates))
      .catch(() => {
        // エラーは無視（次の処理に影響を与えない）
      });
    return this.persistQueue;
  }

  private async persistStateInternal(preserveExpandedStates: boolean): Promise<void> {
    const tabToNodeRecord: Record<number, string> = {};
    this.tabToNode.forEach((nodeId, tabId) => {
      tabToNodeRecord[tabId] = nodeId;
    });

    let existingViews: TreeState['views'] = [];
    let existingCurrentViewId = 'default';
    // 既存ノードのisExpanded状態を保持するためのマップ
    // UIで変更されたisExpanded状態がバックグラウンドのpersistStateで上書きされるのを防ぐ
    const existingExpandedStates = new Map<string, boolean>();

    try {
      const existingState = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
      if (existingState) {
        if (existingState.views && existingState.views.length > 0) {
          existingViews = existingState.views;
        }
        if (existingState.currentViewId) {
          existingCurrentViewId = existingState.currentViewId;
        }
        // 既存ノードのisExpanded状態を保存（preserveExpandedStatesがtrueの場合のみ使用）
        if (preserveExpandedStates && existingState.nodes) {
          Object.entries(existingState.nodes).forEach(([nodeId, node]) => {
            existingExpandedStates.set(nodeId, (node as TabNode).isExpanded);
          });
        }
      }
    } catch {
      // 既存状態読み込み失敗は無視
    }

    const nodesRecord: Record<string, TabNode> = {};
    this.nodes.forEach((node, id) => {
      // 循環参照を避けるため、子ノードはIDのみ保存（children配列の順序を保持）
      // preserveExpandedStatesがtrueで既存ノードの場合、ストレージに保存されているisExpanded状態を優先
      // これによりUIでの変更がバックグラウンド処理で上書きされるのを防ぐ
      const isExpanded = (preserveExpandedStates && existingExpandedStates.has(id))
        ? existingExpandedStates.get(id)!
        : node.isExpanded;
      nodesRecord[id] = {
        ...node,
        isExpanded,
        children: node.children.map(child => ({ id: child.id })) as unknown as TabNode[],
      };
    });

    const treeStructure = await this.buildTreeStructure();

    // 各ビュー内のノード順序を保存
    const viewNodeOrder: Record<string, string[]> = {};
    this.views.forEach((nodeIds, viewId) => {
      viewNodeOrder[viewId] = [...nodeIds];
    });

    const treeState: TreeState = {
      views: existingViews,
      currentViewId: existingCurrentViewId,
      nodes: nodesRecord,
      tabToNode: tabToNodeRecord,
      treeStructure,
      viewNodeOrder,
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

      // まずノードをマップに登録
      Object.entries(state.nodes).forEach(([id, node]) => {
        this.nodes.set(id, { ...node, children: [] });
        this.tabToNode.set(node.tabId, id);

        if (node.isExpanded) {
          this.expandedNodes.add(id);
        }
      });

      // viewNodeOrderが保存されている場合はそれを使用して順序を復元
      // そうでない場合は従来の方法でビューを構築
      console.log('[DEBUG loadState] state.viewNodeOrder exists:', !!state.viewNodeOrder);
      if (state.viewNodeOrder) {
        console.log('[DEBUG loadState] viewNodeOrder:', state.viewNodeOrder);
        Object.entries(state.viewNodeOrder).forEach(([viewId, nodeIds]) => {
          // 有効なノードIDのみフィルタリング（削除されたノードを除外）
          const validNodeIds = nodeIds.filter(id => this.nodes.has(id));
          console.log('[DEBUG loadState] Setting views for', viewId, ':', validNodeIds);
          this.views.set(viewId, validNodeIds);
        });
        // viewNodeOrderに含まれていないノードを追加（新しく作成されたビュー等）
        this.nodes.forEach((node, id) => {
          if (!node.parentId) {
            const viewNodes = this.views.get(node.viewId) || [];
            if (!viewNodes.includes(id)) {
              console.log('[DEBUG loadState] Adding missing root node to view:', id, 'viewId:', node.viewId);
              viewNodes.push(id);
              this.views.set(node.viewId, viewNodes);
            }
          }
        });
      } else {
        console.log('[DEBUG loadState] No viewNodeOrder, using fallback method');
        // 従来の方法：ノードのviewIdに基づいてビューを構築
        Object.entries(state.nodes).forEach(([id, node]) => {
          const viewNodes = this.views.get(node.viewId) || [];
          viewNodes.push(id);
          this.views.set(node.viewId, viewNodes);
        });
      }
      console.log('[DEBUG loadState] Final views:', Object.fromEntries(this.views.entries()));

      // ストレージに保存されたchildren配列の順序を維持して再構築
      // 2段階処理: 1. 保存順序で追加、2. parentIdで関連付けられた未追加の子を追加
      const addedChildIds = new Set<string>();

      // 第1段階: 保存されたchildren配列の順序で子を追加
      Object.entries(state.nodes).forEach(([parentId, parentNode]) => {
        const parent = this.nodes.get(parentId);
        if (!parent) return;

        if (parentNode.children && Array.isArray(parentNode.children)) {
          for (const storedChild of parentNode.children) {
            if (!storedChild || typeof storedChild !== 'object') continue;
            const childId = (storedChild as { id?: string }).id;
            if (!childId) continue;
            const child = this.nodes.get(childId);
            if (child && child.parentId === parentId) {
              parent.children.push(child);
              addedChildIds.add(childId);
            }
          }
        }
      });

      // 第2段階: parentIdで関連付けられているが未追加の子を追加（フォールバック）
      this.nodes.forEach((node, id) => {
        if (addedChildIds.has(id)) return;
        if (node.parentId) {
          const parent = this.nodes.get(node.parentId);
          if (parent) {
            parent.children.push(node);
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
    } catch {
      // 状態読み込み失敗は無視
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
    } catch {
      // グループ情報保存失敗は無視
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
    } catch {
      // グループ情報取得失敗は無視
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
      } catch {
        // タブ情報取得失敗は無視
      }
    }

    return {
      name: groupName,
      children,
    };
  }
}
