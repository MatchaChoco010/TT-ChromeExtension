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
          if (options?.isCollapsedParent && tabIds.length === 1) {
            await chrome.runtime.sendMessage({
              type: 'DUPLICATE_SUBTREE',
              payload: { tabId: tabIds[0] },
            });
          } else {
            for (const tabId of tabIds) {
              await chrome.runtime.sendMessage({
                type: 'REGISTER_DUPLICATE_SOURCE',
                payload: { sourceTabId: tabId },
              });
              await chrome.tabs.duplicate(tabId);
            }
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
          {
            const sourceTab = await chrome.tabs.get(tabIds[0]);
            const sourceWindowId = sourceTab.windowId;

            const newWindow = await chrome.windows.create({ tabId: tabIds[0] });

            if (tabIds.length > 1 && newWindow.id) {
              await chrome.tabs.move(tabIds.slice(1), { windowId: newWindow.id, index: -1 });
            }

            const remainingTabs = await chrome.tabs.query({ windowId: sourceWindowId });
            if (remainingTabs.length === 0) {
              try {
                await chrome.windows.remove(sourceWindowId);
              } catch {
                // ウィンドウが既に閉じられている場合のエラーは無視
              }
            }
          }
          break;

        case 'reload':
          for (const tabId of tabIds) {
            await chrome.tabs.reload(tabId);
          }
          break;

        case 'discard':
          {
            console.log('[DISCARD DEBUG] Starting discard action with tabIds:', tabIds);
            const tabs = await chrome.tabs.query({ currentWindow: true });
            console.log('[DISCARD DEBUG] Current window tabs:', tabs.map(t => ({ id: t.id, url: t.url, active: t.active })));
            const activeTab = tabs.find(tab => tab.active);
            console.log('[DISCARD DEBUG] Active tab:', activeTab?.id, activeTab?.url);
            const tabIdSet = new Set(tabIds);
            console.log('[DISCARD DEBUG] tabIdSet:', [...tabIdSet]);

            // アクティブタブは休止できないため、先に別のタブをアクティブにする
            if (activeTab?.id && tabIdSet.has(activeTab.id)) {
              console.log('[DISCARD DEBUG] Active tab is in discard set, finding alternative...');
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

              console.log('[DISCARD DEBUG] Alternative tab:', alternativeTabWithPinned?.id, alternativeTabWithPinned?.url);
              if (alternativeTabWithPinned?.id) {
                await chrome.tabs.update(alternativeTabWithPinned.id, { active: true });
                console.log('[DISCARD DEBUG] Activated alternative tab');
              }
            } else {
              console.log('[DISCARD DEBUG] Active tab is NOT in discard set, skipping tab switch');
            }

            console.log('[DISCARD DEBUG] Starting discard loop for:', tabIds);
            for (const tabId of tabIds) {
              console.log('[DISCARD DEBUG] Processing tabId:', tabId);
              try {
                const tab = await chrome.tabs.get(tabId);
                console.log('[DISCARD DEBUG] Tab info:', { id: tab.id, url: tab.url, active: tab.active });
                if (!tab.active) {
                  console.log('[DISCARD DEBUG] Discarding tab:', tabId);
                  await chrome.tabs.discard(tabId);
                  console.log('[DISCARD DEBUG] Successfully discarded tab:', tabId);
                } else {
                  console.log('[DISCARD DEBUG] Skipping active tab:', tabId);
                }
              } catch (_err) {
                console.log('[DISCARD DEBUG] Error discarding tab:', tabId, _err);
                // タブが既に休止されている場合などはエラーを無視
              }
            }
            console.log('[DISCARD DEBUG] Discard action completed');
          }
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
