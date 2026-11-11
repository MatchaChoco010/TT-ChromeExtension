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
 * セッションスナップショットの保存を担当するサービス
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

    const views: View[] = [];
    for (let windowIndex = 0; windowIndex < treeState.windows.length; windowIndex++) {
      const windowState = treeState.windows[windowIndex];
      for (let viewIndex = 0; viewIndex < windowState.views.length; viewIndex++) {
        const viewState = windowState.views[viewIndex];
        views.push({
          id: viewState.name,
          name: viewState.name,
          color: viewState.color,
          icon: viewState.icon,
        });
      }
    }
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

  private async createTabSnapshots(
    treeState: TreeState,
  ): Promise<TabSnapshot[]> {
    const tabSnapshots: TabSnapshot[] = [];
    const tabs = await chrome.tabs.query({});
    const tabMap = new Map(tabs.map((tab) => [tab.id, tab]));

    interface NodeInfo {
      node: TabNode;
      viewName: string;
      windowIndex: number;
      parent: TabNode | null;
    }

    const nodeInfos: NodeInfo[] = [];
    const pinnedTabInfos: Array<{
      tabId: number;
      viewName: string;
      windowIndex: number;
    }> = [];

    for (let windowIndex = 0; windowIndex < treeState.windows.length; windowIndex++) {
      const windowState = treeState.windows[windowIndex];
      for (const viewState of windowState.views) {
        for (const tabId of viewState.pinnedTabIds) {
          pinnedTabInfos.push({
            tabId,
            viewName: viewState.name,
            windowIndex,
          });
        }

        const collectNodes = (nodes: TabNode[], parent: TabNode | null) => {
          for (const node of nodes) {
            nodeInfos.push({
              node,
              viewName: viewState.name,
              windowIndex,
              parent,
            });
            collectNodes(node.children, node);
          }
        };
        collectNodes(viewState.rootNodes, null);
      }
    }

    let currentIndex = 0;
    for (const pinnedInfo of pinnedTabInfos) {
      const tab = tabMap.get(pinnedInfo.tabId);
      if (tab && tab.url) {
        const snapshot: TabSnapshot = {
          index: currentIndex,
          url: tab.url,
          title: tab.title || '',
          parentIndex: null,
          viewId: pinnedInfo.viewName,
          isExpanded: true,
          pinned: true,
          windowIndex: pinnedInfo.windowIndex,
        };
        tabSnapshots.push(snapshot);
        currentIndex++;
      }
    }

    const tabIdToIndex = new Map<number, number>();
    nodeInfos.forEach((info, i) => {
      tabIdToIndex.set(info.node.tabId, currentIndex + i);
    });

    for (let i = 0; i < nodeInfos.length; i++) {
      const { node, viewName, windowIndex, parent } = nodeInfos[i];
      const tab = tabMap.get(node.tabId);

      if (tab && tab.url) {
        const parentIndex = parent !== null
          ? tabIdToIndex.get(parent.tabId) ?? null
          : null;

        const snapshot: TabSnapshot = {
          index: currentIndex + i,
          url: tab.url,
          title: tab.title || '',
          parentIndex,
          viewId: viewName,
          isExpanded: node.isExpanded,
          pinned: false,
          windowIndex,
        };
        if (node.groupInfo) {
          snapshot.groupInfo = node.groupInfo;
        }
        tabSnapshots.push(snapshot);
      }
    }

    return tabSnapshots;
  }

  private generateSnapshotId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${SnapshotManager.SNAPSHOT_ID_PREFIX}${timestamp}-${random}`;
  }

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
        } catch (error) {
          console.error('[SnapshotManager] Auto snapshot failed:', error);
        }
      }
    };

    chrome.alarms.onAlarm.addListener(this.alarmListener);

    chrome.alarms.create(SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME, {
      periodInMinutes: intervalMinutes,
    });
  }

  /**
   * @param intervalMinutes - スナップショット間隔（分単位）。0の場合は無効化
   */
  updateAutoSnapshotSettings(intervalMinutes: number): void {
    this.startAutoSnapshot(intervalMinutes);
  }

  async stopAutoSnapshot(): Promise<void> {
    await chrome.alarms.clear(SnapshotManager.AUTO_SNAPSHOT_ALARM_NAME);

    if (this.alarmListener) {
      chrome.alarms.onAlarm.removeListener(this.alarmListener);
      this.alarmListener = null;
    }
  }
}
