/**
 * Task 13.2: useCrossWindowDragフックの実装
 *
 * Requirements:
 * - 6.1: 別ウィンドウでドラッグ中のタブが新しいウィンドウのツリービューにホバーされたとき、タブを新しいウィンドウに移動
 * - 6.2: クロスウィンドウドラッグが発生したとき、ドロップ位置に応じてツリーにタブを配置
 * - 6.3: クロスウィンドウドラッグはドラッグアウトとして判定されない
 * - 6.4: ドラッグ中のタブが新しいウィンドウのツリービューに入ったとき、元のウィンドウはタブをタブツリーから削除
 * - 6.5: ドラッグ中のタブが新しいウィンドウのツリービューに入ったとき、新しいウィンドウはタブをタブツリーに追加してドラッグ状態で表示
 * - 6.7: Service Worker接続エラーが発生した場合、ドラッグ操作はサイレントにキャンセル
 */
import { useEffect, useRef, useCallback } from 'react';
import type { RefObject } from 'react';
import type { MessageResponse } from '@/types';
import type { DragSession } from '@/background/drag-session-manager';

/**
 * Position interface
 */
export interface Position {
  x: number;
  y: number;
}

/**
 * useCrossWindowDragフックのオプション
 */
export interface UseCrossWindowDragProps {
  /** コンテナ要素のref */
  containerRef: RefObject<HTMLElement | null>;
  /** ドラッグ受信時のコールバック */
  onDragReceived: (tabId: number, position: Position) => void;
}

/**
 * クロスウィンドウドラッグの検知と処理を行うフック
 *
 * mouseenterイベントでドラッグセッションをチェックし、
 * 別ウィンドウからのドラッグの場合、タブ移動を実行して
 * ドラッグ状態を継続させる。
 */
export function useCrossWindowDrag({
  containerRef,
  onDragReceived,
}: UseCrossWindowDragProps): void {
  const currentWindowIdRef = useRef<number | null>(null);
  const onDragReceivedRef = useRef(onDragReceived);

  // コールバックの更新を同期
  useEffect(() => {
    onDragReceivedRef.current = onDragReceived;
  }, [onDragReceived]);

  // 現在のウィンドウIDを取得
  useEffect(() => {
    chrome.windows.getCurrent().then((window) => {
      currentWindowIdRef.current = window.id ?? null;
    });
  }, []);

  /**
   * mouseenterイベントハンドラ
   * Service Workerからドラッグセッションを取得し、
   * 別ウィンドウからのドラッグの場合はタブ移動を実行
   */
  const handleMouseEnter = useCallback(async (e: MouseEvent) => {
    const currentWindowId = currentWindowIdRef.current;
    if (currentWindowId === null) return;

    try {
      // Service Workerからドラッグセッションを取得
      const response = await chrome.runtime.sendMessage({
        type: 'GET_DRAG_SESSION',
      }) as MessageResponse<DragSession | null>;

      if (!response.success) {
        return;
      }

      const session = response.data;

      // セッションがない、またはidleの場合は何もしない
      if (!session || session.state === 'idle') {
        return;
      }

      // 同じウィンドウからのドラッグは無視
      if (session.currentWindowId === currentWindowId) {
        return;
      }

      // クロスウィンドウ移動を開始
      const moveResponse = await chrome.runtime.sendMessage({
        type: 'BEGIN_CROSS_WINDOW_MOVE',
        targetWindowId: currentWindowId,
      }) as MessageResponse<void>;

      if (!moveResponse.success) {
        console.error('[CrossWindowDrag] Failed to move tab:', moveResponse.error);
        return;
      }

      // 移動成功：ドラッグ状態を継続
      onDragReceivedRef.current(session.tabId, { x: e.clientX, y: e.clientY });
    } catch (error) {
      // エラー時はサイレントにログを出力（Requirement 6.7）
      console.error('[CrossWindowDrag] Failed to move tab:', error);
      // onDragReceivedは呼ばない（ドラッグをキャンセル）
    }
  }, []);

  // イベントリスナーの設定とクリーンアップ
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseenter', handleMouseEnter);
    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [containerRef, handleMouseEnter]);
}
