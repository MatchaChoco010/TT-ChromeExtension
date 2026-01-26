import type {
  Snapshot,
  TabSnapshot,
  IDownloadService,
  IStorageService,
  View,
  TabNode,
  TreeState,
  ViewState,
  WindowState,
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

    // 新構造: treeState.windows[].views からビュー情報を収集
    // ビューIDはviewIdとして保存（タブのviewIdと一致させるため）
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
   * 新構造: treeState.windows[] → views[] → rootNodes[] の階層を走査
   * 各タブにindexを割り当て、親子関係はparentIndexで表現
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

    // ノード情報を収集（親情報も含む）
    interface NodeInfo {
      node: TabNode;
      viewName: string;
      windowIndex: number;
      parent: TabNode | null;
    }

    const nodeInfos: NodeInfo[] = [];
    // ピン留めタブ情報を収集（tabId -> { viewName, windowIndex }）
    const pinnedTabInfos: Array<{
      tabId: number;
      viewName: string;
      windowIndex: number;
    }> = [];

    for (let windowIndex = 0; windowIndex < treeState.windows.length; windowIndex++) {
      const windowState = treeState.windows[windowIndex];
      for (const viewState of windowState.views) {
        // ピン留めタブを収集
        for (const tabId of viewState.pinnedTabIds) {
          pinnedTabInfos.push({
            tabId,
            viewName: viewState.name,
            windowIndex,
          });
        }

        // 通常タブを収集
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

    // ピン留めタブのスナップショットを先に作成（index 0から開始）
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

    // 通常タブのindexマッピング（ピン留めタブの後から開始）
    const tabIdToIndex = new Map<number, number>();
    nodeInfos.forEach((info, i) => {
      tabIdToIndex.set(info.node.tabId, currentIndex + i);
    });

    // 通常タブのスナップショットを作成
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

  /**
   * スナップショットからタブを復元
   *
   * 新構造対応の復元アルゴリズム:
   * 1. windowIndexごとに新しいウィンドウを作成
   * 2. 各ウィンドウ内で親を持たないタブ（ルートタブ）を先に作成
   * 3. 子タブを親の順に作成
   * 4. 全タブ作成後、新構造のWindowState[]を構築してTreeStateに追加
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

    const windowIndexSet = new Set<number>();
    for (const tabSnapshot of sortedTabs) {
      windowIndexSet.add(tabSnapshot.windowIndex ?? 0);
    }
    const windowIndices = Array.from(windowIndexSet).sort((a, b) => a - b);

    const windowIndexToNewWindowId = new Map<number, number>();
    for (const windowIndex of windowIndices) {
      try {
        const newWindow = await chrome.windows.create({});
        if (newWindow && newWindow.id !== undefined) {
          windowIndexToNewWindowId.set(windowIndex, newWindow.id);
          if (newWindow.tabs && newWindow.tabs.length > 0) {
            const blankTabId = newWindow.tabs[0].id;
            if (blankTabId !== undefined) {
              setTimeout(() => {
                chrome.tabs.remove(blankTabId).catch(() => {});
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

    // 新しいウィンドウ用のWindowStateを構築
    const newWindows: WindowState[] = [];

    for (const windowIndex of windowIndices) {
      const newWindowId = windowIndexToNewWindowId.get(windowIndex);
      if (newWindowId === undefined) continue;

      // このウィンドウのタブを収集
      const windowTabs = sortedTabs.filter(t => (t.windowIndex ?? 0) === windowIndex);

      // このウィンドウに存在するビュー名を収集
      const viewNamesInThisWindow = new Set<string>();
      for (const tab of windowTabs) {
        viewNamesInThisWindow.add(tab.viewId);
      }

      // views配列の順序でビューを構築（スナップショットのビュー順序を維持）
      const orderedViewNames: string[] = [];
      for (const view of views) {
        if (viewNamesInThisWindow.has(view.name)) {
          orderedViewNames.push(view.name);
        }
      }

      // 各ビューのViewStateを構築
      const viewStates: ViewState[] = [];
      for (const viewName of orderedViewNames) {
        const viewInfo = views.find(v => v.name === viewName);
        const viewTabs = windowTabs.filter(t => t.viewId === viewName);

        // TabNodeを構築
        const tabIdToNode = new Map<number, TabNode>();
        const rootNodes: TabNode[] = [];

        for (const tabSnapshot of viewTabs) {
          const newTabId = indexToNewTabId.get(tabSnapshot.index);
          if (newTabId === undefined) continue;

          const node: TabNode = {
            tabId: newTabId,
            isExpanded: tabSnapshot.isExpanded,
            children: [],
          };
          if (tabSnapshot.groupInfo) {
            node.groupInfo = tabSnapshot.groupInfo;
          }
          tabIdToNode.set(newTabId, node);
        }

        // 親子関係を構築
        for (const tabSnapshot of viewTabs) {
          const newTabId = indexToNewTabId.get(tabSnapshot.index);
          if (newTabId === undefined) continue;
          const node = tabIdToNode.get(newTabId);
          if (!node) continue;

          if (tabSnapshot.parentIndex !== null) {
            const parentTabId = indexToNewTabId.get(tabSnapshot.parentIndex);
            if (parentTabId !== undefined) {
              const parent = tabIdToNode.get(parentTabId);
              if (parent) {
                parent.children.push(node);
              } else {
                rootNodes.push(node);
              }
            } else {
              rootNodes.push(node);
            }
          } else {
            rootNodes.push(node);
          }
        }

        // ビュー内のピン留めタブを収集
        const viewPinnedTabIds: number[] = [];
        for (const tabSnapshot of viewTabs) {
          if (tabSnapshot.pinned) {
            const newTabId = indexToNewTabId.get(tabSnapshot.index);
            if (newTabId !== undefined) {
              viewPinnedTabIds.push(newTabId);
            }
          }
        }

        viewStates.push({
          name: viewInfo?.name ?? viewName,
          color: viewInfo?.color ?? '#3B82F6',
          icon: viewInfo?.icon,
          rootNodes,
          pinnedTabIds: viewPinnedTabIds,
        });
      }

      // デフォルトビューを追加（ビューが空の場合）
      if (viewStates.length === 0) {
        viewStates.push({
          name: 'Default',
          color: '#3B82F6',
          rootNodes: [],
          pinnedTabIds: [],
        });
      }

      newWindows.push({
        windowId: newWindowId,
        views: viewStates,
        activeViewIndex: 0,
      });
    }

    // TreeStateを更新（既存ウィンドウに追加）
    const updatedTreeState: TreeState = {
      windows: [...treeState.windows, ...newWindows],
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
