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

    const views: View[] = treeState.views || [];
    const tabs: TabSnapshot[] = await this.createTabSnapshots(treeState.nodes);

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
   *
   * @param nodes - タブノードのレコード
   * @returns タブスナップショット配列
   */
  private async createTabSnapshots(
    nodes: Record<string, TabNode>,
  ): Promise<TabSnapshot[]> {
    const tabSnapshots: TabSnapshot[] = [];
    const tabs = await chrome.tabs.query({});
    const tabMap = new Map(tabs.map((tab) => [tab.id, tab]));

    const nodeArray = Object.values(nodes);
    const nodeIdToIndex = new Map<string, number>();

    nodeArray.forEach((node, index) => {
      nodeIdToIndex.set(node.id, index);
    });

    for (let index = 0; index < nodeArray.length; index++) {
      const node = nodeArray[index];
      const tab = tabMap.get(node.tabId);

      if (tab && tab.url) {
        const parentIndex = node.parentId
          ? nodeIdToIndex.get(node.parentId) ?? null
          : null;

        tabSnapshots.push({
          index,
          url: tab.url,
          title: tab.title || '',
          parentIndex,
          viewId: node.viewId,
          isExpanded: node.isExpanded,
          pinned: tab.pinned || false,
        });
      }
    }

    return tabSnapshots;
  }

  /**
   * スナップショットからタブを復元
   *
   * 親子関係を維持するため、以下のアルゴリズムで復元:
   * 1. 親を持たないタブ（ルートタブ）を先に作成
   * 2. 子タブを親の順に作成
   * 3. 全タブ作成後、ツリー状態を更新して親子関係と展開状態を反映
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

    for (const tabSnapshot of sortedTabs) {
      try {
        const newTab = await chrome.tabs.create({
          url: tabSnapshot.url,
          active: false,
          pinned: tabSnapshot.pinned,
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

    const updatedNodes: Record<string, TabNode> = { ...treeState.nodes };

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
          const parentNode = updatedNodes[parentId];
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
        viewId: snapshot.viewId,
      };

      updatedNodes[nodeId] = newNode;
    }

    for (const nodeId of Object.keys(updatedNodes)) {
      const node = updatedNodes[nodeId];
      if (node.parentId && updatedNodes[node.parentId]) {
        const parent = updatedNodes[node.parentId];
        const childExists = parent.children.some((c) => c.id === nodeId);
        if (!childExists) {
          const childNode = updatedNodes[nodeId];
          parent.children = [...parent.children, childNode];
        }
      }
    }

    const updatedTreeState: TreeState = {
      ...treeState,
      nodes: updatedNodes,
      views: views.length > 0 ? views : treeState.views,
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
