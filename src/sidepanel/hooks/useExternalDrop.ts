import { useState, useCallback } from 'react';
import type { MessageResponse } from '@/types';

/**
 * Task 5.2: 新規ウィンドウ作成機能
 *
 * ツリービュー外へのドロップ時に新規ウィンドウを作成し、
 * ドラッグしたタブとそのサブツリー全体を移動する。
 *
 * Requirements:
 * - 15.2: ツリービュー外へのドロップ時にchrome.windows.createで新規ウィンドウを作成
 * - 15.3: ドラッグしたタブとその子タブ（サブツリー全体）を新規ウィンドウに移動
 * - 15.4: タブグループをドロップした場合はグループ配下のすべてのタブを移動
 * - 15.5: 新規ウィンドウでもツリー構造（親子関係）を維持
 */
export function useExternalDrop() {
  // ドラッグ中かどうかの状態
  const [isDragging, setIsDragging] = useState(false);

  // ドラッグ中のタブID
  const [activeTabId, setActiveTabId] = useState<number | null>(null);

  /**
   * サブツリー全体で新規ウィンドウを作成
   * @param tabId 移動するタブのID（nullまたはundefinedの場合は何もしない）
   */
  const handleExternalDrop = useCallback(async (tabId: number | null | undefined) => {
    if (tabId === null || tabId === undefined) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'CREATE_WINDOW_WITH_SUBTREE',
        payload: { tabId },
      }) as MessageResponse<null>;

      if (!response.success) {
        console.error('Failed to create window with subtree:', response.error);
      }
    } catch (error) {
      console.error('Failed to create window with subtree:', error);
    }
  }, []);

  /**
   * ExternalDropZoneのonDropコールバック
   * 現在のactiveTabIdを使って新規ウィンドウを作成
   */
  const onExternalDrop = useCallback(async () => {
    await handleExternalDrop(activeTabId);
  }, [activeTabId, handleExternalDrop]);

  return {
    isDragging,
    setIsDragging,
    activeTabId,
    setActiveTabId,
    handleExternalDrop,
    onExternalDrop,
  };
}
