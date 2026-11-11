/**
 * ツリー構造を操作する要求の処理
 */
import { treeStateManager } from '../background-services';
import type { TreeState } from '@/types';

export async function handleGetState(): Promise<TreeState> {
  return treeStateManager.toJSON();
}

export async function handleMoveNode(
  tabId: number,
  targetParentTabId: number | null,
  selectedTabIds: number[],
): Promise<void> {
  await treeStateManager.moveNodeToParent(tabId, targetParentTabId, selectedTabIds);
  await treeStateManager.syncTreeStateToChromeTabs();
  treeStateManager.notifyStateChanged();
}

export async function handleMoveNodeAsSibling(
  tabId: number,
  aboveTabId: number | undefined,
  belowTabId: number | undefined,
  selectedTabIds: number[],
  targetDepth: number | undefined,
): Promise<void> {
  await treeStateManager.moveNodeAsSibling(tabId, aboveTabId, belowTabId, selectedTabIds, targetDepth);
  await treeStateManager.syncTreeStateToChromeTabs();
  treeStateManager.notifyStateChanged();
}

export async function handleToggleNodeExpand(tabId: number): Promise<void> {
  await treeStateManager.toggleExpand(tabId);
  treeStateManager.notifyStateChanged();
}
