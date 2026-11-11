import { useCallback } from 'react';
import type { MenuAction } from '@/types';
import { sendServiceWorkerRequest } from '@/messaging/service-worker-client';

export interface MenuActionOptions {
  url?: string;
  onSnapshot?: () => Promise<void>;
  isCollapsedParent?: boolean;
  groupName?: string;
}

export const useMenuActions = () => {
  const executeAction = useCallback(async (action: MenuAction, tabIds: number[], options?: MenuActionOptions) => {
    try {
      switch (action) {
        case 'close':
          if (options?.isCollapsedParent && tabIds.length === 1) {
            await sendServiceWorkerRequest('CLOSE_SUBTREE', { tabId: tabIds[0] });
          } else if (tabIds.length > 1) {
            await sendServiceWorkerRequest('CLOSE_TABS_WITH_COLLAPSED_SUBTREES', { tabIds });
          } else {
            await sendServiceWorkerRequest('CLOSE_TAB', { tabId: tabIds[0] });
          }
          break;

        case 'closeSubtree':
          await sendServiceWorkerRequest('CLOSE_SUBTREE', { tabId: tabIds[0] });
          break;

        case 'closeOthers':
          await sendServiceWorkerRequest('CLOSE_OTHER_TABS', { excludeTabIds: tabIds });
          break;

        case 'duplicate':
          if (options?.isCollapsedParent && tabIds.length === 1) {
            await sendServiceWorkerRequest('DUPLICATE_SUBTREE', { tabId: tabIds[0] });
          } else {
            await sendServiceWorkerRequest('DUPLICATE_TABS', { tabIds });
          }
          break;

        case 'pin':
          await sendServiceWorkerRequest('PIN_TABS', { tabIds });
          break;

        case 'unpin':
          await sendServiceWorkerRequest('UNPIN_TABS', { tabIds });
          break;

        case 'newWindow':
          await sendServiceWorkerRequest('MOVE_TABS_TO_NEW_WINDOW', { tabIds });
          break;

        case 'reload':
          await sendServiceWorkerRequest('RELOAD_TABS', { tabIds });
          break;

        case 'discard':
          await sendServiceWorkerRequest('DISCARD_TABS', { tabIds });
          break;

        case 'group':
          await sendServiceWorkerRequest('CREATE_GROUP', { tabIds, groupName: options?.groupName });
          break;

        case 'ungroup':
          await sendServiceWorkerRequest('DISSOLVE_GROUP', { tabIds });
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
