import { useCallback } from 'react';
import type { MenuAction } from '@/types';

export interface MenuActionOptions {
  url?: string;
  onSnapshot?: () => Promise<void>;
}

/**
 * useMenuActions
 *
 * コンテキストメニューのアクションを実行するカスタムフック
 */
export const useMenuActions = () => {
  /**
   * メニューアクションを実行
   * @param action - 実行するアクション
   * @param tabIds - 対象のタブID配列
   * @param options - オプション（URLなど）
   */
  const executeAction = useCallback(async (action: MenuAction, tabIds: number[], options?: MenuActionOptions) => {
    try {
      switch (action) {
        case 'close':
          // タブを閉じる
          await chrome.tabs.remove(tabIds);
          break;

        case 'closeSubtree':
          // サブツリーを閉じる (Service Worker に委譲)
          await chrome.runtime.sendMessage({
            type: 'CLOSE_SUBTREE',
            payload: { tabId: tabIds[0] },
          });
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
          // タブを複製（兄弟として配置）
          // 複製されたタブを元のタブの兄弟として配置
          for (const tabId of tabIds) {
            // 複製前にService Workerに複製元を登録（onCreatedより先に実行される必要がある）
            await chrome.runtime.sendMessage({
              type: 'REGISTER_DUPLICATE_SOURCE',
              payload: { sourceTabId: tabId },
            });
            // 複製を実行
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
          // グループ解除 (Service Worker に委譲)
          await chrome.runtime.sendMessage({
            type: 'DISSOLVE_GROUP',
            payload: { tabIds },
          });
          break;

        case 'copyUrl':
          // URLをコピー
          if (options?.url) {
            await navigator.clipboard.writeText(options.url);
          } else if (tabIds.length === 1) {
            // URLが渡されていない場合はタブからURLを取得
            const tab = await chrome.tabs.get(tabIds[0]);
            if (tab.url) {
              await navigator.clipboard.writeText(tab.url);
            }
          }
          break;

        case 'snapshot':
          // スナップショットを取得
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
