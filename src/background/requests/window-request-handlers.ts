/**
 * ウィンドウ間でタブを移動する要求の処理
 */
import { treeStateManager } from '../background-services';

export async function handleCreateWindowWithSubtree(tabId: number): Promise<void> {
  const subtree = treeStateManager.getSubtree(tabId);
  if (subtree.length === 0) {
    throw new Error('Tab not found');
  }

  const newWindowId = await treeStateManager.createWindowWithSubtree(tabId);

  if (newWindowId === undefined) {
    throw new Error('Failed to create window');
  }

  treeStateManager.notifyStateChanged();
}

export async function handleMoveSubtreeToWindow(tabId: number, windowId: number): Promise<void> {
  const subtree = treeStateManager.getSubtree(tabId);
  if (subtree.length === 0) {
    throw new Error('Tab not found');
  }

  await treeStateManager.moveSubtreeToWindow(tabId, windowId);
  treeStateManager.notifyStateChanged();
}

export async function handleMoveTabsToNewWindow(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) {
    return;
  }

  const newWindowId = await treeStateManager.moveTabsToNewWindow(tabIds);
  if (newWindowId === undefined) {
    throw new Error('Failed to create new window');
  }

  treeStateManager.notifyStateChanged();
}
