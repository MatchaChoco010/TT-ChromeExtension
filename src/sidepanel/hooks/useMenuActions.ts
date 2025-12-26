import { useCallback } from 'react';
import type { MenuAction } from '@/types';

/**
 * useMenuActions
 *
 * コンテキストメニューのアクションを実行するカスタムフック
 * Requirements: 12.2, 12.3, 12.4
 */
export const useMenuActions = () => {
  /**
   * メニューアクションを実行
   * @param action - 実行するアクション
   * @param tabIds - 対象のタブID配列
   */
  const executeAction = useCallback(async (action: MenuAction, tabIds: number[]) => {
    try {
      switch (action) {
        case 'close':
          // タブを閉じる
          await chrome.tabs.remove(tabIds);
          break;

        case 'closeOthers':
          // 他のタブを閉じる
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
          // タブを複製
          for (const tabId of tabIds) {
            await chrome.tabs.duplicate(tabId);
          }
          break;

        case 'pin':
          // タブをピン留め
          for (const tabId of tabIds) {
            await chrome.tabs.update(tabId, { pinned: true });
          }
          break;

        case 'unpin':
          // ピン留めを解除
          for (const tabId of tabIds) {
            await chrome.tabs.update(tabId, { pinned: false });
          }
          break;

        case 'newWindow':
          // 新しいウィンドウで開く
          for (const tabId of tabIds) {
            await chrome.windows.create({ tabId });
          }
          break;

        case 'reload':
          // タブを再読み込み
          for (const tabId of tabIds) {
            await chrome.tabs.reload(tabId);
          }
          break;

        case 'group':
          // グループ化 (Service Worker に委譲)
          await chrome.runtime.sendMessage({
            type: 'CREATE_GROUP',
            payload: { tabIds },
          });
          break;

        case 'ungroup':
          // グループ解除 (Service Worker に委譲)
          await chrome.runtime.sendMessage({
            type: 'DISSOLVE_GROUP',
            payload: { tabIds },
          });
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
