import { useCallback } from 'react';
import type { MenuAction } from '@/types';

export interface MenuActionOptions {
  url?: string;
  onSnapshot?: () => Promise<void>;
}

export const useMenuActions = () => {
  const executeAction = useCallback(async (action: MenuAction, tabIds: number[], options?: MenuActionOptions) => {
    try {
      switch (action) {
        case 'close':
          await chrome.tabs.remove(tabIds);
          break;

        case 'closeSubtree':
          await chrome.runtime.sendMessage({
            type: 'CLOSE_SUBTREE',
            payload: { tabId: tabIds[0] },
          });
          break;

        case 'closeOthers':
          {
            const allTabs = await chrome.tabs.query({ currentWindow: true });
            const tabIdsToClose = allTabs
              .filter((tab) => tab.id && !tabIds.includes(tab.id))
              .map((tab) => tab.id!);
            if (tabIdsToClose.length > 0) {
              await chrome.tabs.remove(tabIdsToClose);
            }
          }
          break;

        case 'duplicate':
          for (const tabId of tabIds) {
            // 複製前にService Workerに複製元を登録（onCreatedより先に実行される必要がある）
            await chrome.runtime.sendMessage({
              type: 'REGISTER_DUPLICATE_SOURCE',
              payload: { sourceTabId: tabId },
            });
            await chrome.tabs.duplicate(tabId);
          }
          break;

        case 'pin':
          for (const tabId of tabIds) {
            await chrome.tabs.update(tabId, { pinned: true });
          }
          break;

        case 'unpin':
          for (const tabId of tabIds) {
            await chrome.tabs.update(tabId, { pinned: false });
          }
          break;

        case 'newWindow':
          for (const tabId of tabIds) {
            await chrome.windows.create({ tabId });
          }
          break;

        case 'reload':
          for (const tabId of tabIds) {
            await chrome.tabs.reload(tabId);
          }
          break;

        case 'group':
          try {
            await chrome.runtime.sendMessage({
              type: 'CREATE_GROUP',
              payload: { tabIds },
            });
          } catch (_err) {
            // グループ化に失敗
          }
          break;

        case 'ungroup':
          await chrome.runtime.sendMessage({
            type: 'DISSOLVE_GROUP',
            payload: { tabIds },
          });
          break;

        case 'copyUrl':
          if (options?.url) {
            await navigator.clipboard.writeText(options.url);
          } else if (tabIds.length === 1) {
            const tab = await chrome.tabs.get(tabIds[0]);
            if (tab.url) {
              await navigator.clipboard.writeText(tab.url);
            }
          }
          break;

        case 'snapshot':
          if (options?.onSnapshot) {
            await options.onSnapshot();
          }
          break;

        default:
          console.error('Unknown menu action:', action);
      }
    } catch (error) {
      console.error(`Failed to execute menu action ${action}:`, error);
    }
  }, []);

  return { executeAction };
};
