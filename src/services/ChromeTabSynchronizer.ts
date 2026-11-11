/**
 * TreeStateManagerの状態（ピン留め・タブの並び）をChromeのタブに反映する
 */
import type { TabNode, WindowState } from '@/types';
import { ignoreMissingTabOrWindow } from '@/utils/chrome-errors';
import { calculateTabsToMove } from './minimal-tab-moves';

export class ChromeTabSynchronizer {
  private syncInProgress = false;

  /**
   * @param getWindowState - 同期元となるウィンドウの状態を返す関数
   */
  constructor(private readonly getWindowState: (windowId: number) => WindowState | null) {}

  /**
   * 同期中かを返す。同期によるChromeのイベントを、ユーザー操作と区別するために使う
   */
  isSyncing(): boolean {
    return this.syncInProgress;
  }

  /**
   * TreeStateの状態をChromeタブに同期
   */
  async sync(windowId?: number): Promise<void> {
    // 既に同期中の場合は再入を防止
    if (this.syncInProgress) {
      return;
    }
    this.syncInProgress = true;
    try {
      const queryOptions = windowId !== undefined ? { windowId } : {};
      const currentTabs = await chrome.tabs.query(queryOptions);

      const windowIds =
        windowId !== undefined
          ? [windowId]
          : [
              ...new Set(
                currentTabs
                  .map((t) => t.windowId)
                  .filter((id): id is number => id !== undefined)
              ),
            ];

      for (const wid of windowIds) {
        await this.syncPinnedStateForWindow(wid, currentTabs);
      }

      const refreshedTabs = await chrome.tabs.query(queryOptions);
      const pinnedSet = new Set<number>();
      for (const tab of refreshedTabs) {
        if (tab.id !== undefined && tab.pinned) {
          pinnedSet.add(tab.id);
        }
      }

      for (const wid of windowIds) {
        await this.syncTabOrderForWindow(wid, pinnedSet);
      }

      await this.closeEmptyWindows();
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * ピン留め状態を同期
   * すべてのビューのピン留めタブをChromeに同期
   */
  private async syncPinnedStateForWindow(
    windowId: number,
    currentTabs: chrome.tabs.Tab[]
  ): Promise<void> {
    const windowState = this.getWindowState(windowId);
    if (!windowState) return;

    const expectedPinnedIds = new Set<number>();
    const orderedPinnedIds: number[] = [];

    for (const viewState of windowState.views) {
      for (const tabId of viewState.pinnedTabIds) {
        orderedPinnedIds.push(tabId);
        expectedPinnedIds.add(tabId);
      }
    }

    const windowTabs = currentTabs.filter((t) => t.windowId === windowId);

    const actuallyPinnedIds = new Set<number>();
    for (const tab of windowTabs) {
      if (tab.id !== undefined && tab.pinned) {
        actuallyPinnedIds.add(tab.id);
      }
    }

    for (const tabId of expectedPinnedIds) {
      if (!actuallyPinnedIds.has(tabId)) {
        await ignoreMissingTabOrWindow(chrome.tabs.update(tabId, { pinned: true }));
      }
    }

    for (const tabId of actuallyPinnedIds) {
      if (!expectedPinnedIds.has(tabId)) {
        await ignoreMissingTabOrWindow(chrome.tabs.update(tabId, { pinned: false }));
      }
    }

    const currentIndexMap = new Map<number, number>();
    for (const tab of windowTabs) {
      if (tab.id !== undefined) {
        currentIndexMap.set(tab.id, tab.index);
      }
    }

    for (let i = 0; i < orderedPinnedIds.length; i++) {
      const tabId = orderedPinnedIds[i];
      const currentIndex = currentIndexMap.get(tabId);
      if (currentIndex !== undefined && currentIndex !== i) {
        await ignoreMissingTabOrWindow(chrome.tabs.move(tabId, { index: i }));
        const updatedTabs = await chrome.tabs.query({ windowId });
        currentIndexMap.clear();
        for (const tab of updatedTabs) {
          if (tab.id !== undefined) {
            currentIndexMap.set(tab.id, tab.index);
          }
        }
      }
    }
  }

  /**
   * タブの順序を同期
   */
  private async syncTabOrderForWindow(
    windowId: number,
    pinnedSet: Set<number>
  ): Promise<void> {
    const currentTabs = await chrome.tabs.query({ windowId });
    const currentWindowTabIds = new Set<number>();
    for (const tab of currentTabs) {
      if (tab.id !== undefined) {
        currentWindowTabIds.add(tab.id);
      }
    }

    const windowState = this.getWindowState(windowId);
    if (!windowState) return;

    const orderedTabIds: number[] = [];
    const traverse = (node: TabNode): void => {
      if (!pinnedSet.has(node.tabId) && currentWindowTabIds.has(node.tabId)) {
        orderedTabIds.push(node.tabId);
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    for (const viewState of windowState.views) {
      for (const rootNode of viewState.rootNodes) {
        traverse(rootNode);
      }
    }

    // 現在のChrome順序を取得（非ピンタブのみ）
    const nonPinnedTabs = currentTabs
      .filter((t) => t.id !== undefined && !t.pinned)
      .sort((a, b) => a.index - b.index);
    const currentNonPinnedOrder = nonPinnedTabs.map((t) => t.id!);

    // LISベースで移動が必要なタブを計算
    const tabsToMove = calculateTabsToMove(currentNonPinnedOrder, orderedTabIds);

    const pinnedCount = currentTabs.filter((t) => t.pinned).length;

    const currentIndexMap = new Map<number, number>();
    for (const tab of currentTabs) {
      if (tab.id !== undefined) {
        currentIndexMap.set(tab.id, tab.index);
      }
    }

    // 移動が必要なタブがない場合でも、位置確認のループは実行する
    for (let i = 0; i < orderedTabIds.length; i++) {
      const tabId = orderedTabIds[i];
      const expectedIndex = pinnedCount + i;
      const currentIndex = currentIndexMap.get(tabId);

      // LIS最適化: 移動不要なタブはスキップ
      // ただし、tabsToMoveが空の場合は従来通り位置チェックを行う
      if (tabsToMove.size > 0 && !tabsToMove.has(tabId)) {
        continue;
      }

      if (currentIndex !== undefined && currentIndex !== expectedIndex) {
        await ignoreMissingTabOrWindow(chrome.tabs.move(tabId, { index: expectedIndex }));
        const updatedTabs = await chrome.tabs.query({ windowId });
        currentIndexMap.clear();
        for (const tab of updatedTabs) {
          if (tab.id !== undefined) {
            currentIndexMap.set(tab.id, tab.index);
          }
        }
      }
    }
  }

  /**
   * 空ウィンドウを閉じる
   * 最初に1回だけwindows.getAll()を呼び出し、各ウィンドウのタブ数をチェック
   */
  private async closeEmptyWindows(): Promise<void> {
    const allWindows = await chrome.windows.getAll({ windowTypes: ['normal'] });
    if (allWindows.length <= 1) return;

    const emptyWindowIds: number[] = [];
    for (const window of allWindows) {
      if (window.id === undefined) continue;
      const tabs = await chrome.tabs.query({ windowId: window.id });
      if (tabs.length === 0) {
        emptyWindowIds.push(window.id);
      }
    }

    // 最後の1ウィンドウは空でも閉じない（閉じるとブラウザが終了する）
    let remainingCount = allWindows.length;
    for (const windowId of emptyWindowIds) {
      if (remainingCount <= 1) break;
      await ignoreMissingTabOrWindow(chrome.windows.remove(windowId));
      remainingCount--;
    }
  }
}
