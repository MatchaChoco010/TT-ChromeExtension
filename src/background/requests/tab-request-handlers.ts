/**
 * タブを操作する要求の処理
 */
import { treeStateManager } from '../background-services';
import { pendingDuplicateSources } from '../pending-state';
import { ignoreMissingTabOrWindow } from '@/utils/chrome-errors';

export async function handleActivateTab(tabId: number): Promise<void> {
  await chrome.tabs.update(tabId, { active: true });
}

export async function handleCloseTab(tabId: number): Promise<void> {
  await chrome.tabs.remove(tabId);
}

export async function handleCloseSubtree(tabId: number): Promise<void> {
  const subtree = treeStateManager.getSubtree(tabId);
  if (subtree.length === 0) {
    throw new Error('Tab not found');
  }

  const tabIds = subtree.map((node) => node.tabId);

  await chrome.tabs.remove(tabIds);

}

export async function handleCloseTabsWithCollapsedSubtrees(tabIds: number[]): Promise<void> {
  const allTabIdsToClose = new Set<number>();

  for (const tabId of tabIds) {
    const nodeResult = treeStateManager.getNodeByTabId(tabId);
    if (!nodeResult) {
      allTabIdsToClose.add(tabId);
      continue;
    }

    if (!nodeResult.node.isExpanded && nodeResult.node.children.length > 0) {
      const subtree = treeStateManager.getSubtree(tabId);
      for (const subtreeNode of subtree) {
        allTabIdsToClose.add(subtreeNode.tabId);
      }
    } else {
      allTabIdsToClose.add(tabId);
    }
  }

  await chrome.tabs.remove([...allTabIdsToClose]);

}

export async function handleCloseOtherTabs(excludeTabIds: number[]): Promise<void> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const excludeSet = new Set(excludeTabIds);
  const tabsToClose = tabs
    .filter(tab => tab.id !== undefined && !excludeSet.has(tab.id))
    .map(tab => tab.id as number);

  if (tabsToClose.length > 0) {
    await chrome.tabs.remove(tabsToClose);
  }

}

export async function handleDuplicateTabs(tabIds: number[]): Promise<void> {
  for (const tabId of tabIds) {
    const tab = await chrome.tabs.get(tabId);
    pendingDuplicateSources.set(tabId, {
      url: tab.url || tab.pendingUrl || '',
      windowId: tab.windowId,
      isSubtreeDuplicate: false,
    });
    await chrome.tabs.duplicate(tabId);
  }
}

export async function handleDuplicateSubtree(tabId: number): Promise<void> {
  const subtree = treeStateManager.getSubtree(tabId);
  if (subtree.length === 0) {
    throw new Error('Tab not found');
  }

  const oldTabIdToNewTabId = new Map<number, number>();

  for (const node of subtree) {
    const sourceTab = await chrome.tabs.get(node.tabId);
    pendingDuplicateSources.set(node.tabId, {
      url: sourceTab.url || '',
      windowId: sourceTab.windowId,
      isSubtreeDuplicate: true,
    });
    const duplicatedTab = await chrome.tabs.duplicate(node.tabId);
    if (duplicatedTab?.id) {
      oldTabIdToNewTabId.set(node.tabId, duplicatedTab.id);
    }
  }

  await Promise.all(
    Array.from(oldTabIdToNewTabId.values()).map((newTabId) =>
      treeStateManager.waitForTabRegistration(newTabId),
    ),
  );

  const rootNode = subtree[0];
  const rootNewTabId = oldTabIdToNewTabId.get(rootNode.tabId);
  const rootNewNodeResult = rootNewTabId ? treeStateManager.getNodeByTabId(rootNewTabId) : null;
  const originalRootNodeResult = treeStateManager.getNodeByTabId(rootNode.tabId);

  if (rootNewNodeResult && originalRootNodeResult) {
    const originalParentTabId = treeStateManager.getParentTabId(rootNode.tabId);
    if (originalParentTabId !== null) {
      const originalSiblingIndex = treeStateManager.getSiblingIndex(rootNode.tabId);
      await treeStateManager.moveNode(rootNewTabId!, originalParentTabId, originalSiblingIndex + 1);
    }

    if (!originalRootNodeResult.node.isExpanded) {
      await treeStateManager.toggleExpand(rootNewTabId!);
    }

    for (let i = 1; i < subtree.length; i++) {
      const originalNode = subtree[i];
      const newTabId = oldTabIdToNewTabId.get(originalNode.tabId);
      if (!newTabId) continue;

      const originalParentTabId2 = treeStateManager.getParentTabId(originalNode.tabId);
      if (originalParentTabId2 !== null) {
        const newParentTabId = oldTabIdToNewTabId.get(originalParentTabId2);
        if (newParentTabId) {
          await treeStateManager.moveNode(newTabId, newParentTabId, -1);
        }
      }
    }
  }

  treeStateManager.notifyStateChanged();
}

export async function handlePinTabs(tabIds: number[]): Promise<void> {
  const tabsByWindow = new Map<number, number[]>();
  for (const tabId of tabIds) {
    const tab = await ignoreMissingTabOrWindow(chrome.tabs.get(tabId));
    if (tab) {
      const windowTabs = tabsByWindow.get(tab.windowId) ?? [];
      windowTabs.push(tabId);
      tabsByWindow.set(tab.windowId, windowTabs);
    }
  }

  for (const [windowId, windowTabIds] of tabsByWindow) {
    await treeStateManager.pinTabs(windowTabIds, windowId);
  }

  await treeStateManager.syncTreeStateToChromeTabs();
  treeStateManager.notifyStateChanged();

}

export async function handleUnpinTabs(tabIds: number[]): Promise<void> {
  const tabsByWindow = new Map<number, number[]>();
  for (const tabId of tabIds) {
    const tab = await ignoreMissingTabOrWindow(chrome.tabs.get(tabId));
    if (tab) {
      const windowTabs = tabsByWindow.get(tab.windowId) ?? [];
      windowTabs.push(tabId);
      tabsByWindow.set(tab.windowId, windowTabs);
    }
  }

  for (const [windowId, windowTabIds] of tabsByWindow) {
    await treeStateManager.unpinTabs(windowTabIds, windowId);
  }

  await treeStateManager.syncTreeStateToChromeTabs();
  treeStateManager.notifyStateChanged();

}

export async function handleReorderPinnedTab(tabId: number, newIndex: number): Promise<void> {
  const tab = await chrome.tabs.get(tabId);
  if (tab.windowId === undefined) {
    throw new Error('Tab has no window');
  }

  await treeStateManager.reorderPinnedTab(tabId, newIndex, tab.windowId);

  await treeStateManager.syncTreeStateToChromeTabs();
  treeStateManager.notifyStateChanged();

}

export async function handleReloadTabs(tabIds: number[]): Promise<void> {
  for (const tabId of tabIds) {
    await chrome.tabs.reload(tabId);
  }
}

export async function handleDiscardTabs(tabIds: number[]): Promise<void> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const activeTab = tabs.find(tab => tab.active);
  const tabIdSet = new Set(tabIds);

  if (activeTab?.id && tabIdSet.has(activeTab.id)) {
    const alternativeTab = tabs.find(tab =>
      tab.id &&
      !tabIdSet.has(tab.id) &&
      !tab.discarded &&
      !tab.pinned
    );

    const alternativeTabWithPinned = alternativeTab ?? tabs.find(tab =>
      tab.id &&
      !tabIdSet.has(tab.id) &&
      !tab.discarded
    );

    if (alternativeTabWithPinned?.id) {
      await chrome.tabs.update(alternativeTabWithPinned.id, { active: true });
    }
  }

  for (const tabId of tabIds) {
    const tab = await ignoreMissingTabOrWindow(chrome.tabs.get(tabId));
    if (tab && !tab.active && !tab.discarded) {
      await ignoreMissingTabOrWindow(chrome.tabs.discard(tabId));
    }
  }

}

export async function handleCreateNewTab(): Promise<{ tabId: number | undefined }> {
  const tab = await chrome.tabs.create({
    active: true,
    url: 'chrome://vivaldi-webui/startpage',
  });
  return { tabId: tab.id };
}

export async function handleOpenSettingsTab(): Promise<{ tabId: number | undefined }> {
  const settingsUrl = chrome.runtime.getURL('settings.html');
  const tab = await chrome.tabs.create({ url: settingsUrl });
  return { tabId: tab.id };
}
