/**
 * グループを操作する要求の処理
 */
import { storageService, treeStateManager } from '../background-services';
import { STORAGE_KEYS } from '@/storage/StorageService';
import { ignoreMissingTabOrWindow } from '@/utils/chrome-errors';

export async function handleCreateGroup(
  tabIds: number[],
  groupName: string | undefined,
  contextMenuTabId: number | undefined,
) {
  if (tabIds.length === 0) {
    throw new Error('No tabs specified for grouping');
  }

  const targetTabId = contextMenuTabId ?? tabIds[0];
  const targetTab = await ignoreMissingTabOrWindow(chrome.tabs.get(targetTabId));
  const windowId = targetTab?.windowId;
  const targetTabIndex = targetTab?.index;

  const createOptions: chrome.tabs.CreateProperties = {
    url: `chrome-extension://${chrome.runtime.id}/group.html`,
    active: false,
  };
  if (windowId !== undefined) {
    createOptions.windowId = windowId;
  }
  if (targetTabIndex !== undefined) {
    createOptions.index = targetTabIndex;
  }

  const groupTab = await chrome.tabs.create(createOptions);

  if (!groupTab.id) {
    throw new Error('Failed to create group tab');
  }

  await treeStateManager.createGroupWithRealTab(groupTab.id, tabIds, groupName ?? 'グループ', windowId!, targetTabId);

  await treeStateManager.syncTreeStateToChromeTabs(windowId);

  await chrome.tabs.update(groupTab.id, { active: true });

  treeStateManager.notifyStateChanged();

  return { groupTabId: groupTab.id };
}

export async function handleDissolveGroup(tabIds: number[]): Promise<void> {
  if (tabIds.length === 0) {
    throw new Error('No tabs specified for ungrouping');
  }

  await treeStateManager.dissolveGroup(tabIds[0]);

  treeStateManager.notifyStateChanged();

}

export async function handleUpdateGroupName(tabId: number, name: string): Promise<void> {
  const updated = await treeStateManager.updateGroupName(tabId, name || 'グループ');
  if (!updated) {
    throw new Error('Group not found');
  }

  treeStateManager.notifyStateChanged();

}

export async function handleGetGroupInfo(tabId: number) {
  const groupInfo = await treeStateManager.getGroupInfo(tabId);
  return groupInfo;
}

export async function handleDeleteTreeGroup(tabId: number): Promise<void> {
  await treeStateManager.deleteTreeGroup(tabId);
  treeStateManager.notifyStateChanged();
}

export async function handleAddTabToTreeGroup(tabId: number, targetGroupTabId: number): Promise<void> {
  await treeStateManager.addTabToTreeGroup(tabId, targetGroupTabId);
  treeStateManager.notifyStateChanged();
}

export async function handleRemoveTabFromTreeGroup(tabId: number): Promise<void> {
  await treeStateManager.removeTabFromTreeGroup(tabId);
  treeStateManager.notifyStateChanged();
}

export async function handleSaveGroups(
  groups: Record<string,
  { id: string; name: string; color: string; isExpanded: boolean }>,
): Promise<void> {
  await storageService.set(STORAGE_KEYS.GROUPS, groups);
}
