import type {
  Snapshot,
  TabSnapshot,
  IDownloadService,
  IStorageService,
  View,
  TabNode,
  TreeState,
} from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

/**
 * SnapshotManager
 *
 * セッションスナップショットの保存・復元を担当するサービス
 * スナップショットはchrome.downloads APIでJSONファイルとしてダウンロードフォルダに保存
 */
export class SnapshotManager {
  private static readonly SNAPSHOT_ID_PREFIX = 'snapshot-';
  private static readonly AUTO_SNAPSHOT_ALARM_NAME = 'auto-snapshot';
  private static readonly DEFAULT_SUBFOLDER = 'TT-Snapshots';

  private alarmListener: ((alarm: chrome.alarms.Alarm) => void) | null = null;

  constructor(
    private downloadService: IDownloadService,
    private storageService: IStorageService,
  ) {}

  /**
   * 現在状態のスナップショットを作成してダウンロード
   *
   * @param name - スナップショット名
   * @param isAutoSave - 自動保存フラグ（デフォルト: false）
   * @returns 作成されたスナップショット
   */
  async createSnapshot(
    name: string,
    isAutoSave: boolean = false,
  ): Promise<Snapshot> {
    const treeState = await this.storageService.get(STORAGE_KEYS.TREE_STATE);

    if (!treeState) {
      throw new Error('Tree state not found');
    }

    // 新しいデータ構造: views: Record<string, ViewState>
    const views: View[] = Object.values(treeState.views).map(vs => vs.info);
    const tabs: TabSnapshot[] = await this.createTabSnapshots(treeState);

    const snapshot: Snapshot = {
      id: this.generateSnapshotId(),
      createdAt: new Date(),
      name,
      isAutoSave,
      data: {
        views,
        tabs,
      },
    };

    const exportData = {
      ...snapshot,
      createdAt: snapshot.createdAt.toISOString(),
    };

    const jsonContent = JSON.stringify(exportData, null, 2);
    const filename = this.generateFilename(name, isAutoSave);

    const settings = await this.storageService.get(STORAGE_KEYS.USER_SETTINGS);
    const subfolder =
      settings?.snapshotSubfolder ?? SnapshotManager.DEFAULT_SUBFOLDER;

    await this.downloadService.downloadSnapshot(jsonContent, filename, subfolder);

    return snapshot;
  }

  /**
   * JSON文字列からタブを復元
   *
   * @param jsonData - JSON文字列
   */
  async restoreFromJson(jsonData: string): Promise<void> {
    const parsed = JSON.parse(jsonData);

    const snapshot: Snapshot = {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
    };

    await this.restoreTabsFromSnapshot(snapshot.data.tabs, snapshot.data.views);
  }

  /**
   * タブノードからタブスナップショットを作成
   *
   * 各タブにindexを割り当て、parentIdをparentIndexに変換する
   * マルチウィンドウ対応のため、windowIdをwindowIndexに変換して保存
   *
   * @param treeState - ツリー状態
   * @returns タブスナップショット配列
   */
  private async createTabSnapshots(
    treeState: TreeState,
  ): Promise<TabSnapshot[]> {
    const tabSnapshots: TabSnapshot[] = [];
    const tabs = await chrome.tabs.query({});
    const tabMap = new Map(tabs.map((tab) => [tab.id, tab]));

    // 新しいデータ構造: views: Record<string, ViewState>からノードを収集
    // { node, viewId } のペアを作成
    const nodeWithViewId: Array<{ node: TabNode; viewId: string }> = [];
    for (const [viewId, viewState] of Object.entries(treeState.views)) {
      for (const node of Object.values(viewState.nodes)) {
        nodeWithViewId.push({ node, viewId });
      }
    }

    const nodeIdToIndex = new Map<string, number>();
    nodeWithViewId.forEach(({ node }, index) => {
      nodeIdToIndex.set(node.id, index);
    });

    // windowIdをwindowIndexに変換するためのマッピング
    const windowIdSet = new Set<number>();
    for (const { node } of nodeWithViewId) {
      const tab = tabMap.get(node.tabId);
      if (tab && tab.windowId !== undefined) {
        windowIdSet.add(tab.windowId);
      }
    }
    const windowIds = Array.from(windowIdSet).sort((a, b) => a - b);
    const windowIdToIndex = new Map<number, number>();
    windowIds.forEach((windowId, index) => {
      windowIdToIndex.set(windowId, index);
    });

    for (let index = 0; index < nodeWithViewId.length; index++) {
      const { node, viewId } = nodeWithViewId[index];
      const tab = tabMap.get(node.tabId);

      if (tab && tab.url) {
        const parentIndex = node.parentId
          ? nodeIdToIndex.get(node.parentId) ?? null
          : null;
        const windowIndex = tab.windowId !== undefined
          ? windowIdToIndex.get(tab.windowId) ?? 0
          : 0;

        tabSnapshots.push({
          index,
          url: tab.url,
          title: tab.title || '',
          parentIndex,
          viewId,
          isExpanded: node.isExpanded,
          pinned: tab.pinned || false,
          windowIndex,
        });
      }
    }

    return tabSnapshots;
  }

  /**
   * スナップショットからタブを復元
   *
   * マルチウィンドウ対応の復元アルゴリズム:
   * 1. windowIndexごとに新しいウィンドウを作成
   * 2. 各ウィンドウ内で親を持たないタブ（ルートタブ）を先に作成
   * 3. 子タブを親の順に作成
   * 4. 全タブ作成後、ツリー状態を更新して親子関係と展開状態を反映
   *
   * @param tabs - タブスナップショット配列
   * @param views - ビュー配列
   */
  private async restoreTabsFromSnapshot(
    tabs: TabSnapshot[],
    views: View[],
  ): Promise<void> {
    if (tabs.length === 0) return;

    const sortedTabs = [...tabs].sort((a, b) => {
      if (a.parentIndex === null && b.parentIndex !== null) return -1;
      if (a.parentIndex !== null && b.parentIndex === null) return 1;
      return a.index - b.index;
    });

    const indexToNewTabId = new Map<number, number>();
    const indexToSnapshot = new Map<number, TabSnapshot>();

    for (const tabSnapshot of sortedTabs) {
      indexToSnapshot.set(tabSnapshot.index, tabSnapshot);
    }

    // windowIndexのセットを取得
    const windowIndexSet = new Set<number>();
    for (const tabSnapshot of sortedTabs) {
      windowIndexSet.add(tabSnapshot.windowIndex ?? 0);
    }
    const windowIndices = Array.from(windowIndexSet).sort((a, b) => a - b);

    // 各windowIndexに対して新しいウィンドウを作成
    const windowIndexToNewWindowId = new Map<number, number>();
    for (const windowIndex of windowIndices) {
      try {
        const newWindow = await chrome.windows.create({});
        if (newWindow.id !== undefined) {
          windowIndexToNewWindowId.set(windowIndex, newWindow.id);
          // 新しいウィンドウに自動で作成される空白タブを後で削除するため、タブIDを記録
          if (newWindow.tabs && newWindow.tabs.length > 0) {
            const blankTabId = newWindow.tabs[0].id;
            if (blankTabId !== undefined) {
              // 後で削除できるようにマークしておく
              setTimeout(() => {
                chrome.tabs.remove(blankTabId).catch(() => {
                  // 既に閉じられている場合は無視
                });
              }, 1000);
            }
          }
        }
      } catch (error) {
        console.error('Failed to create window for windowIndex:', windowIndex, error);
      }
    }

    for (const tabSnapshot of sortedTabs) {
      try {
        const windowIndex = tabSnapshot.windowIndex ?? 0;
        const targetWindowId = windowIndexToNewWindowId.get(windowIndex);

        const newTab = await chrome.tabs.create({
          url: tabSnapshot.url,
          active: false,
          pinned: tabSnapshot.pinned,
          windowId: targetWindowId,
        });

        if (newTab.id !== undefined) {
          indexToNewTabId.set(tabSnapshot.index, newTab.id);
        }
      } catch (error) {
        console.error('Failed to create tab:', tabSnapshot.url, error);
      }
    }

    const treeState = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
    if (!treeState) return;

    // 新しいデータ構造: views: Record<string, ViewState>
    // 既存のビューをコピー
    const updatedViews: Record<string, { info: View; rootNodeIds: string[]; nodes: Record<string, TabNode> }> = {};
    for (const [viewId, viewState] of Object.entries(treeState.views)) {
      updatedViews[viewId] = {
        info: { ...viewState.info },
        rootNodeIds: [...viewState.rootNodeIds],
        nodes: { ...viewState.nodes },
      };
    }

    // スナップショットのビューを追加（存在しない場合）
    for (const view of views) {
      if (!updatedViews[view.id]) {
        updatedViews[view.id] = {
          info: { id: view.id, name: view.name, color: view.color },
          rootNodeIds: [],
          nodes: {},
        };
      }
    }

    // デフォルトビューが存在しない場合は作成
    if (!updatedViews['default']) {
      updatedViews['default'] = {
        info: { id: 'default', name: 'Default', color: '#3B82F6' },
        rootNodeIds: [],
        nodes: {},
      };
    }

    // 一時的にすべてのノードを保持するマップ（親子関係構築用）
    const allNewNodes: Map<string, TabNode> = new Map();
    const nodeIdToViewId: Map<string, string> = new Map();
    const updatedTabToNode: Record<number, { viewId: string; nodeId: string }> = { ...treeState.tabToNode };

    for (const [index, newTabId] of indexToNewTabId) {
      const snapshot = indexToSnapshot.get(index);
      if (!snapshot) continue;

      const nodeId = `tab-${newTabId}`;
      let parentId: string | null = null;
      let depth = 0;

      if (snapshot.parentIndex !== null) {
        const parentTabId = indexToNewTabId.get(snapshot.parentIndex);
        if (parentTabId !== undefined) {
          parentId = `tab-${parentTabId}`;
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
      updatedTabToNode[newTabId] = { viewId: snapshot.viewId, nodeId };
    }

    // 親子関係を構築（childrenを設定）
    for (const [nodeId, node] of allNewNodes) {
      if (node.parentId && allNewNodes.has(node.parentId)) {
        const parent = allNewNodes.get(node.parentId)!;
        const childExists = parent.children.some((c) => c.id === nodeId);
        if (!childExists) {
          parent.children = [...parent.children, node];
        }
      }
    }

    // ノードを各ビューに配置
    for (const [nodeId, node] of allNewNodes) {
      const viewId = nodeIdToViewId.get(nodeId) || 'default';
      if (!updatedViews[viewId]) {
        updatedViews[viewId] = {
          info: { id: viewId, name: viewId === 'default' ? 'Default' : 'View', color: '#3B82F6' },
          rootNodeIds: [],
          nodes: {},
        };
      }
      updatedViews[viewId].nodes[nodeId] = node;

      // ルートノードの場合、rootNodeIdsに追加
      if (!node.parentId) {
        updatedViews[viewId].rootNodeIds.push(nodeId);
      }
    }

    const updatedTreeState: TreeState = {
      ...treeState,
      views: updatedViews,
      tabToNode: updatedTabToNode,
    };

    await this.storageService.set(STORAGE_KEYS.TREE_STATE, updatedTreeState);
  }

  /**
   * ユニークなスナップショットIDを生成
   *
   * @returns スナップショットID
   */
  private generateSnapshotId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${SnapshotManager.SNAPSHOT_ID_PREFIX}${timestamp}-${random}`;
  }

  /**
   * スナップショットファイル名を生成
   *
   * @param name - スナップショット名
   * @param isAutoSave - 自動保存フラグ
   * @returns ファイル名
   */
  private generateFilename(name: string, isAutoSave: boolean): string {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '')
      .replace('T', '_')
      .slice(0, 15);
    const suffix = isAutoSave ? '-auto' : '';
    const safeName = name.replace(/[^a-zA-Z0-9-_\s]/g, '').replace(/\s+/g, '-');
    return `vivaldi-tt-snapshot-${timestamp}${suffix}-${safeName}.json`;
  }

  /**
   * 自動スナップショット機能を開始
   * 定期的な自動スナップショット機能を提供する
   *
   * @param intervalMinutes - スナップショット間隔（分単位）。0の場合は無効化
   */
  startAutoSnapshot(intervalMinutes: number): void {
    chrome.alarms.clear(SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME);
    if (this.alarmListener) {
      chrome.alarms.onAlarm.removeListener(this.alarmListener);
      this.alarmListener = null;
    }

    if (intervalMinutes === 0) {
      return;
    }

    this.alarmListener = async (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME) {
        try {
          const timestamp = new Date().toISOString().split('T')[0];
          const name = `Auto Snapshot - ${timestamp} ${new Date().toLocaleTimeString()}`;
          await this.createSnapshot(name, true);
        } catch {
          // 自動スナップショット失敗は無視
        }
      }
    };

    chrome.alarms.onAlarm.addListener(this.alarmListener);

    chrome.alarms.create(SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME, {
      periodInMinutes: intervalMinutes,
    });
  }

  /**
   * 自動スナップショット設定を更新
   * 設定変更時にアラームを再設定する
   *
   * @param intervalMinutes - スナップショット間隔（分単位）。0の場合は無効化
   */
  updateAutoSnapshotSettings(intervalMinutes: number): void {
    this.startAutoSnapshot(intervalMinutes);
  }

  /**
   * 自動スナップショット機能を停止
   */
  async stopAutoSnapshot(): Promise<void> {
    await chrome.alarms.clear(SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME);

    if (this.alarmListener) {
      chrome.alarms.onAlarm.removeListener(this.alarmListener);
      this.alarmListener = null;
    }
  }
}
