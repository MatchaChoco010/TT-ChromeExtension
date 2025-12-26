import type {
  Snapshot,
  SnapshotData,
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
 * Task 14.1: SnapshotManager サービスの実装
 * Task 14.2: 自動スナップショット機能
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5
 */
export class SnapshotManager {
  private static readonly SNAPSHOT_ID_PREFIX = 'snapshot-';
  private static readonly AUTO_SNAPSHOT_ALARM_NAME = 'auto-snapshot';

  private alarmListener: ((alarm: chrome.alarms.Alarm) => void) | null = null;

  constructor(
    private indexedDBService: IIndexedDBService,
    private storageService: IStorageService,
  ) {}

  /**
   * 現在状態のJSON形式スナップショット作成
   * Requirement 11.1: スナップショットコマンドを実行する
   * Requirement 11.2: タブのURL、タイトル、親子関係、グループ情報を含む
   *
   * @param name - スナップショット名
   * @param isAutoSave - 自動保存フラグ（デフォルト: false）
   * @returns 作成されたスナップショット
   */
  async createSnapshot(
    name: string,
    isAutoSave: boolean = false,
  ): Promise<Snapshot> {
    try {
      // 現在の状態を取得
      const treeState = await this.storageService.get(STORAGE_KEYS.TREE_STATE);
      const groupsRecord = await this.storageService.get(STORAGE_KEYS.GROUPS);

      if (!treeState) {
        throw new Error('Tree state not found');
      }

      // ビューを取得
      const views: View[] = treeState.views || [];

      // グループを取得
      const groups: Group[] = groupsRecord
        ? Object.values(groupsRecord)
        : [];

      // タブスナップショットを作成
      const tabs: TabSnapshot[] = await this.createTabSnapshots(
        treeState.nodes,
      );

      // スナップショットオブジェクトを作成
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

      // IndexedDBに保存
      await this.indexedDBService.saveSnapshot(snapshot);

      return snapshot;
    } catch (error) {
      console.error('SnapshotManager.createSnapshot error:', error);
      throw error;
    }
  }

  /**
   * スナップショットからのセッション復元
   * Requirement 11.3: スナップショットをインポートする
   *
   * @param snapshotId - 復元するスナップショットのID
   */
  async restoreSnapshot(snapshotId: string): Promise<void> {
    try {
      // スナップショットを取得
      const snapshot = await this.indexedDBService.getSnapshot(snapshotId);

      if (!snapshot) {
        throw new Error('Snapshot not found');
      }

      // タブを復元
      await this.restoreTabsFromSnapshot(snapshot.data.tabs);

      // ビューを復元（将来実装）
      // グループを復元（将来実装）
    } catch (error) {
      console.error('SnapshotManager.restoreSnapshot error:', error);
      throw error;
    }
  }

  /**
   * スナップショットを削除
   *
   * @param snapshotId - 削除するスナップショットのID
   */
  async deleteSnapshot(snapshotId: string): Promise<void> {
    try {
      await this.indexedDBService.deleteSnapshot(snapshotId);
    } catch (error) {
      console.error('SnapshotManager.deleteSnapshot error:', error);
      throw error;
    }
  }

  /**
   * すべてのスナップショットを取得
   *
   * @returns スナップショット配列
   */
  async getSnapshots(): Promise<Snapshot[]> {
    try {
      return await this.indexedDBService.getAllSnapshots();
    } catch (error) {
      console.error('SnapshotManager.getSnapshots error:', error);
      throw error;
    }
  }

  /**
   * スナップショットをJSON文字列としてエクスポート
   *
   * @param snapshotId - エクスポートするスナップショットのID
   * @returns JSON文字列
   */
  async exportSnapshot(snapshotId: string): Promise<string> {
    try {
      const snapshot = await this.indexedDBService.getSnapshot(snapshotId);

      if (!snapshot) {
        throw new Error('Snapshot not found');
      }

      // Date を ISO文字列に変換してシリアライズ可能にする
      const exportData = {
        ...snapshot,
        createdAt: snapshot.createdAt.toISOString(),
      };

      return JSON.stringify(exportData, null, 2);
    } catch (error) {
      console.error('SnapshotManager.exportSnapshot error:', error);
      throw error;
    }
  }

  /**
   * JSON文字列からスナップショットをインポート
   *
   * @param jsonData - JSON文字列
   * @returns インポートされたスナップショット
   */
  async importSnapshot(jsonData: string): Promise<Snapshot> {
    try {
      const parsed = JSON.parse(jsonData);

      // Date オブジェクトに変換
      const snapshot: Snapshot = {
        ...parsed,
        createdAt: new Date(parsed.createdAt),
      };

      // IndexedDBに保存
      await this.indexedDBService.saveSnapshot(snapshot);

      return snapshot;
    } catch (error) {
      console.error('SnapshotManager.importSnapshot error:', error);
      throw error;
    }
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

    // chrome.tabs APIでタブ情報を取得
    const tabs = await chrome.tabs.query({});
    const tabMap = new Map(tabs.map((tab) => [tab.id, tab]));

    // 各ノードからスナップショットを作成
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
    // タブを順番に作成
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
   * Requirement 11.4, 11.5: 定期的な自動スナップショット機能を提供する
   *
   * @param intervalMinutes - スナップショット間隔（分単位）。0の場合は無効化
   */
  startAutoSnapshot(intervalMinutes: number): void {
    try {
      // 既存のアラームとリスナーをクリア
      chrome.alarms.clear(SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME);
      if (this.alarmListener) {
        chrome.alarms.onAlarm.removeListener(this.alarmListener);
        this.alarmListener = null;
      }

      // intervalが0の場合は無効化（アラームを作成しない）
      if (intervalMinutes === 0) {
        return;
      }

      // アラームリスナーを作成
      this.alarmListener = async (alarm: chrome.alarms.Alarm) => {
        if (alarm.name === SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME) {
          try {
            // 自動スナップショットを作成
            const timestamp = new Date().toISOString().split('T')[0];
            const name = `Auto Snapshot - ${timestamp} ${new Date().toLocaleTimeString()}`;
            await this.createSnapshot(name, true);
            console.log('Auto-snapshot created:', name);
          } catch (error) {
            console.error('Auto-snapshot failed:', error);
          }
        }
      };

      // アラームリスナーを登録
      chrome.alarms.onAlarm.addListener(this.alarmListener);

      // アラームを作成
      chrome.alarms.create(SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME, {
        periodInMinutes: intervalMinutes,
      });

      console.log(
        `Auto-snapshot enabled with interval: ${intervalMinutes} minutes`,
      );
    } catch (error) {
      console.error('SnapshotManager.startAutoSnapshot error:', error);
      throw error;
    }
  }

  /**
   * 自動スナップショット機能を停止
   */
  async stopAutoSnapshot(): Promise<void> {
    try {
      // アラームをクリア
      await chrome.alarms.clear(SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME);

      // リスナーを削除
      if (this.alarmListener) {
        chrome.alarms.onAlarm.removeListener(this.alarmListener);
        this.alarmListener = null;
      }

      console.log('Auto-snapshot disabled');
    } catch (error) {
      console.error('SnapshotManager.stopAutoSnapshot error:', error);
      throw error;
    }
  }
}
