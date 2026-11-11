/**
 * スナップショットの作成・復元要求の処理
 */
import { treeStateManager, snapshotManager } from '../background-services';
import { restoringTabIds, snapshotRestoreState } from '../pending-state';
import { ignoreMissingTabOrWindow } from '@/utils/chrome-errors';
import { trackHandler } from '../handler-tracking';
import { isSidePanelUrl } from '@/utils/extension-urls';

export async function handleCreateSnapshot(): Promise<void> {
  await snapshotManager.createManualSnapshot();
}

/**
 * 複数のタブをバッチ処理で休止状態にする
 * アクティブタブは自動的にスキップされる
 */
async function discardTabsInBatches(
  tabIds: number[],
  batchSize: number = 10,
  delayMs: number = 50
): Promise<void> {
  for (let i = 0; i < tabIds.length; i += batchSize) {
    const batch = tabIds.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (tabId) => {
        const tab = await ignoreMissingTabOrWindow(chrome.tabs.get(tabId));
        if (tab && !tab.active && tab.status === 'complete') {
          await ignoreMissingTabOrWindow(chrome.tabs.discard(tabId));
        }
      })
    );
    if (i + batchSize < tabIds.length) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function handleRestoreSnapshot(jsonData: string, closeCurrentTabs: boolean): Promise<void> {
  snapshotRestoreState.inProgress = true;
  const indexToNewTabId = new Map<number, number>();
  try {
    const parsed = JSON.parse(jsonData);
    const snapshotTabs: Array<{
      index: number;
      url: string;
      title: string;
      parentIndex: number | null;
      viewId: string;
      isExpanded: boolean;
      pinned: boolean;
      windowIndex?: number;
    }> = parsed.data.tabs;
    const snapshotViews: Array<{
      id: string;
      name: string;
      color: string;
    }> = parsed.data.views;

    if (snapshotTabs.length === 0) {
      return;
    }

    const existingTabs = await chrome.tabs.query({});
    const existingTabIds = existingTabs
      .filter((t) => !isSidePanelUrl(t.url))
      .map((t) => t.id)
      .filter((id): id is number => id !== undefined);

    const sortedTabs = [...snapshotTabs].sort((a, b) => {
      if (a.parentIndex === null && b.parentIndex !== null) return -1;
      if (a.parentIndex !== null && b.parentIndex === null) return 1;
      return a.index - b.index;
    });

    const indexToSnapshot = new Map<number, typeof sortedTabs[0]>();

    for (const tabSnapshot of sortedTabs) {
      indexToSnapshot.set(tabSnapshot.index, tabSnapshot);
    }

    const windowIndexSet = new Set<number>();
    for (const tabSnapshot of sortedTabs) {
      windowIndexSet.add(tabSnapshot.windowIndex ?? 0);
    }
    const windowIndices = Array.from(windowIndexSet).sort((a, b) => a - b);

    const windowIndexToNewWindowId = new Map<number, number>();
    const blankTabsToRemove: number[] = [];

    for (const windowIndex of windowIndices) {
      try {
        const newWindow = await chrome.windows.create({});
        if (newWindow && newWindow.id !== undefined) {
          windowIndexToNewWindowId.set(windowIndex, newWindow.id);
          if (newWindow.tabs && newWindow.tabs.length > 0) {
            const blankTabId = newWindow.tabs[0].id;
            if (blankTabId !== undefined) {
              blankTabsToRemove.push(blankTabId);
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
          restoringTabIds.add(newTab.id);
        }
      } catch (error) {
        console.error('Failed to create tab:', tabSnapshot.url, error);
      }
    }

    for (const blankTabId of blankTabsToRemove) {
      await ignoreMissingTabOrWindow(chrome.tabs.remove(blankTabId));
    }

    await treeStateManager.restoreTreeStateFromSnapshot(
      snapshotViews,
      indexToNewTabId,
      indexToSnapshot,
      closeCurrentTabs,
      windowIndexToNewWindowId
    );

    if (closeCurrentTabs) {
      for (const existingTabId of existingTabIds) {
        await ignoreMissingTabOrWindow(chrome.tabs.remove(existingTabId));
      }
    }

  } finally {
    restoringTabIds.clear();
    snapshotRestoreState.inProgress = false;
  }

  treeStateManager.notifyStateChanged();

  // 作成したタブを休止状態にする（メモリ節約）。応答を待たせないため完了は待たない
  trackHandler(() => discardTabsInBatches(Array.from(indexToNewTabId.values()))).catch((error: unknown) => {
    console.error('[handleRestoreSnapshot] Failed to discard restored tabs:', error);
  });
}
