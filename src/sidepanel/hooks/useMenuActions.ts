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
          // isCollapsedParent（expanded: falseの親タブ）の場合はサブツリー全体を閉じる
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
            await chrome.tabs.remove(tabIds);
          }
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
            console.log('[DEBUG useMenuActions] Duplicate subtree - tabId:', tabIds[0]);
            await chrome.runtime.sendMessage({
              type: 'DUPLICATE_SUBTREE',
              payload: { tabId: tabIds[0] },
            });
          } else {
            // 設定を取得
            const settingsResult = await chrome.storage.local.get('user_settings');
            const duplicateTabPosition = settingsResult.user_settings?.duplicateTabPosition ?? 'sibling';
            console.log('[DEBUG useMenuActions] Duplicate - tabIds:', tabIds, 'duplicateTabPosition:', duplicateTabPosition);

            for (const tabId of tabIds) {
              console.log('[DEBUG useMenuActions] Processing duplicate for tabId:', tabId);
              await chrome.runtime.sendMessage({
                type: 'REGISTER_DUPLICATE_SOURCE',
                payload: { sourceTabId: tabId },
              });

              const duplicatedTab = await chrome.tabs.duplicate(tabId);
              console.log('[DEBUG useMenuActions] Duplicated tab created:', duplicatedTab?.id);

              // Vivaldiが複製タブを元の位置に配置した直後に、設定に基づいて移動
              // これにより、Vivaldiのタブ配置挙動との競合を防ぐ
              if (duplicatedTab?.id) {
                if (duplicateTabPosition === 'end') {
                  console.log('[DEBUG useMenuActions] Moving duplicated tab to end - tabId:', duplicatedTab.id);
                  await chrome.tabs.move(duplicatedTab.id, { index: -1 });
                  const afterMove = await chrome.tabs.get(duplicatedTab.id);
                  console.log('[DEBUG useMenuActions] After move to end - index:', afterMove.index);
                } else if (duplicateTabPosition === 'sibling') {
                  // sibling設定の場合、複製タブを元のタブの直後に移動
                  // 複数タブを順番に複製する際、各複製タブが対応する元のタブの直後に配置されるようにする
                  const originalTab = await chrome.tabs.get(tabId);
                  console.log('[DEBUG useMenuActions] Moving duplicated tab as sibling - tabId:', duplicatedTab.id, 'target index:', originalTab.index + 1);
                  await chrome.tabs.move(duplicatedTab.id, { index: originalTab.index + 1 });
                  const afterMove = await chrome.tabs.get(duplicatedTab.id);
                  console.log('[DEBUG useMenuActions] After move as sibling - index:', afterMove.index);
                }
              }
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

            const movedTabIds = new Set(tabIds);
            const remainingTabs = await chrome.tabs.query({ windowId: sourceWindowId });
            const actualRemainingTabs = remainingTabs.filter(
              (tab) => tab.id !== undefined && !movedTabIds.has(tab.id)
            );

            if (actualRemainingTabs.length === 0) {
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
            const tabs = await chrome.tabs.query({ currentWindow: true });
            const activeTab = tabs.find(tab => tab.active);
            const tabIdSet = new Set(tabIds);

            // アクティブタブは休止できないため、先に別のタブをアクティブにする
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
              try {
                const tab = await chrome.tabs.get(tabId);
                if (!tab.active) {
                  await chrome.tabs.discard(tabId);
                }
              } catch {
                // タブが既に休止されている場合などはエラーを無視
              }
            }
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
