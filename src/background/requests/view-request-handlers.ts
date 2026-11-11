/**
 * ビューを操作する要求の処理
 */
import { treeStateManager } from '../background-services';

export async function handleSwitchView(viewIndex: number, windowId: number): Promise<void> {
  await treeStateManager.switchView(windowId, viewIndex);
  await treeStateManager.syncTreeStateToChromeTabs(windowId);
  treeStateManager.notifyStateChanged();
}

export async function handleCreateView(windowId: number) {
  const newViewIndex = await treeStateManager.createViewWithAutoColor(windowId);
  treeStateManager.notifyStateChanged();
  return { viewIndex: newViewIndex };
}

export async function handleDeleteView(windowId: number, viewIndex: number): Promise<void> {
  await treeStateManager.deleteView(windowId, viewIndex);
  treeStateManager.notifyStateChanged();
}

export async function handleUpdateView(
  windowId: number,
  viewIndex: number,
  updates: { name?: string; color?: string; icon?: string },
): Promise<void> {
  await treeStateManager.updateView(windowId, viewIndex, updates);
  treeStateManager.notifyStateChanged();
}

export async function handleReorderView(viewIndex: number, newIndex: number, windowId: number): Promise<void> {
  await treeStateManager.reorderView(viewIndex, newIndex, windowId);
  await treeStateManager.syncTreeStateToChromeTabs();
  treeStateManager.notifyStateChanged();
}

export async function handleMoveTabsToView(windowId: number, targetViewIndex: number, tabIds: number[]): Promise<void> {
  await treeStateManager.moveTabsToViewInternal(tabIds, windowId, targetViewIndex);
  await treeStateManager.syncTreeStateToChromeTabs(windowId);
  treeStateManager.notifyStateChanged();
}
