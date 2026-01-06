import type {
  Snapshot,
  TabSnapshot,
  IIndexedDBService,
  IStorageService,
  View,
  Group,
  TabNode,
} from '@/types';
import { STORAGE_KEYS } from '@/storage/StorageService';

/**
 * SnapshotManager
 *
 * セッションスナップショットの保存・復元・管理を担当するサービス
 */
export class SnapshotManager {
  private static readonly SNAPSHOT_ID_PREFIX = 'snapshot-';
  private static readonly AUTO_SNAPSHOT_ALARM_NAME = 'auto-snapshot';

  private alarmListener: ((alarm: chrome.alarms.Alarm) => void) | null = null;
  private currentMaxSnapshots: number | undefined = undefined;

  constructor(
    private indexedDBService: IIndexedDBService,
    private storageService: IStorageService,
  ) {}

  /**
   * 現在状態のJSON形式スナップショット作成
   * スナップショットコマンドを実行し、タブのURL、タイトル、親子関係、グループ情報を含む
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
    const groupsRecord = await this.storageService.get(STORAGE_KEYS.GROUPS);

    if (!treeState) {
      throw new Error('Tree state not found');
    }

    const views: View[] = treeState.views || [];

    const groups: Group[] = groupsRecord
      ? Object.values(groupsRecord)
      : [];

    const tabs: TabSnapshot[] = await this.createTabSnapshots(
      treeState.nodes,
    );

    const snapshot: Snapshot = {
      id: this.generateSnapshotId(),
      createdAt: new Date(),
      name,
      isAutoSave,
      data: {
        views,
        tabs,
        groups,
      },
    };

    await this.indexedDBService.saveSnapshot(snapshot);

    return snapshot;
  }

  /**
   * スナップショットからのセッション復元
   * スナップショットをインポートする
   *
   * @param snapshotId - 復元するスナップショットのID
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    const snapshot = await this.indexedDBService.getSnapshot(snapshotId);

    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    await this.restoreTabsFromSnapshot(snapshot.data.tabs);
  }

  /**
   * スナップショットを削除
   *
   * @param snapshotId - 削除するスナップショットのID
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    await this.indexedDBService.deleteSnapshot(snapshotId);
  }

  /**
   * すべてのスナップショットを取得
   *
   * @returns スナップショット配列
   */
  async getSnapshots(): Promise<Snapshot[]> {
    return await this.indexedDBService.getAllSnapshots();
  }

  /**
   * スナップショットをJSON文字列としてエクスポート
   *
   * @param snapshotId - エクスポートするスナップショットのID
   * @returns JSON文字列
   */
  async exportSnapshot(snapshotId: string): Promise<string> {
    const snapshot = await this.indexedDBService.getSnapshot(snapshotId);

    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    const exportData = {
      ...snapshot,
      createdAt: snapshot.createdAt.toISOString(),
    };

    return JSON.stringify(exportData, null, 2);
  }

  /**
   * JSON文字列からスナップショットをインポート
   *
   * @param jsonData - JSON文字列
   * @returns インポートされたスナップショット
   */
  async importSnapshot(jsonData: string): Promise<Snapshot> {
    const parsed = JSON.parse(jsonData);

    const snapshot: Snapshot = {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
    };

    await this.indexedDBService.saveSnapshot(snapshot);

    return snapshot;
  }

  /**
   * タブノードからタブスナップショットを作成
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

    for (const node of Object.values(nodes)) {
      const tab = tabMap.get(node.tabId);

      if (tab && tab.url) {
        tabSnapshots.push({
          url: tab.url,
          title: tab.title || '',
          parentId: node.parentId,
          viewId: node.viewId,
        });
      }
    }

    return tabSnapshots;
  }

  /**
   * スナップショットからタブを復元
   *
   * @param tabs - タブスナップショット配列
   */
  private async restoreTabsFromSnapshot(
    tabs: TabSnapshot[],
  ): Promise<void> {
    for (const tabSnapshot of tabs) {
      await chrome.tabs.create({
        url: tabSnapshot.url,
        active: false,
      });
    }
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
   * 自動スナップショット機能を開始
   * 定期的な自動スナップショット機能を提供する
   * 最大保持数を超えた古いスナップショットを自動削除する
   *
   * @param intervalMinutes - スナップショット間隔（分単位）。0の場合は無効化
   * @param maxSnapshots - 保持するスナップショットの最大数（省略または0の場合は無制限）
   */
  startAutoSnapshot(intervalMinutes: number, maxSnapshots?: number): void {
    chrome.alarms.clear(SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME);
    if (this.alarmListener) {
      chrome.alarms.onAlarm.removeListener(this.alarmListener);
      this.alarmListener = null;
    }

    this.currentMaxSnapshots = maxSnapshots;

    if (intervalMinutes === 0) {
      return;
    }

    this.alarmListener = async (alarm: chrome.alarms.Alarm) => {
      if (alarm.name === SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME) {
        try {
          const timestamp = new Date().toISOString().split('T')[0];
          const name = `Auto Snapshot - ${timestamp} ${new Date().toLocaleTimeString()}`;
          await this.createSnapshot(name, true);

          if (this.currentMaxSnapshots && this.currentMaxSnapshots > 0) {
            try {
              await this.indexedDBService.deleteOldSnapshots(this.currentMaxSnapshots);
            } catch (_deleteError) {
              // Failed to delete old snapshots silently
            }
          }
        } catch (_error) {
          // Auto-snapshot failed silently
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
   * @param maxSnapshots - 保持するスナップショットの最大数（省略または0の場合は無制限）
   */
  updateAutoSnapshotSettings(intervalMinutes: number, maxSnapshots?: number): void {
    this.startAutoSnapshot(intervalMinutes, maxSnapshots);
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
