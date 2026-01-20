import { useCallback } from 'react';
import type { MenuAction } from '@/types';

export interface MenuActionOptions {
  url?: string;
  onSnapshot?: () => Promise<void>;
  isCollapsedParent?: boolean;
}

export const useMenuActions = () => {
  const executeAction = useCallback(async (action: MenuAction, tabIds: number[], options?: MenuActionOptions) => {
    try {
      switch (action) {
        case 'close':
          if (options?.isCollapsedParent && tabIds.length === 1) {
            await chrome.runtime.sendMessage({
              type: 'CLOSE_SUBTREE',
              payload: { tabId: tabIds[0] },
            });
          } else if (tabIds.length > 1) {
            // 複数選択時は、expanded: falseの親タブのサブツリーも含めて閉じる
            await chrome.runtime.sendMessage({
              type: 'CLOSE_TABS_WITH_COLLAPSED_SUBTREES',
              payload: { tabIds },
            });
          } else {
            await chrome.runtime.sendMessage({
              type: 'CLOSE_TAB',
              payload: { tabId: tabIds[0] },
            });
          }
          break;

        case 'closeSubtree':
          await chrome.runtime.sendMessage({
            type: 'CLOSE_SUBTREE',
            payload: { tabId: tabIds[0] },
          });
          break;

        case 'closeOthers':
          await chrome.runtime.sendMessage({
            type: 'CLOSE_OTHER_TABS',
            payload: { excludeTabIds: tabIds },
          });
          break;

        case 'duplicate':
          if (options?.isCollapsedParent && tabIds.length === 1) {
            await chrome.runtime.sendMessage({
              type: 'DUPLICATE_SUBTREE',
              payload: { tabId: tabIds[0] },
            });
          } else {
            await chrome.runtime.sendMessage({
              type: 'DUPLICATE_TABS',
              payload: { tabIds },
            });
          }
          break;

        case 'pin':
          await chrome.runtime.sendMessage({
            type: 'PIN_TABS',
            payload: { tabIds },
          });
          break;

        case 'unpin':
          await chrome.runtime.sendMessage({
            type: 'UNPIN_TABS',
            payload: { tabIds },
          });
          break;

        case 'newWindow':
          await chrome.runtime.sendMessage({
            type: 'MOVE_TABS_TO_NEW_WINDOW',
            payload: { tabIds },
          });
          break;

        case 'reload':
          await chrome.runtime.sendMessage({
            type: 'RELOAD_TABS',
            payload: { tabIds },
          });
          break;

        case 'discard':
          await chrome.runtime.sendMessage({
            type: 'DISCARD_TABS',
            payload: { tabIds },
          });
          break;

        case 'group':
          try {
            await chrome.runtime.sendMessage({
              type: 'CREATE_GROUP',
              payload: { tabIds },
            });
          } catch {
            // グループ化APIのエラーは無視（タブが存在しない場合など）
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
