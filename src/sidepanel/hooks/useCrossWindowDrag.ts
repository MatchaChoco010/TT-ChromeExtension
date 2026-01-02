/**
 * useCrossWindowDragフックの実装
 * mousemoveによるホバー検知とセッションキャッシュを追加
 *
 * - 別ウィンドウでドラッグ中のタブが新しいウィンドウのツリービューにホバーされたとき、タブを新しいウィンドウに移動
 * - クロスウィンドウドラッグが発生したとき、ドロップ位置に応じてツリーにタブを配置
 * - クロスウィンドウドラッグはドラッグアウトとして判定されない
 * - ドラッグ中のタブが新しいウィンドウのツリービューに入ったとき、元のウィンドウはタブをタブツリーから削除
 * - ドラッグ中のタブが新しいウィンドウのツリービューに入ったとき、新しいウィンドウはタブをタブツリーに追加してドラッグ状態で表示
 * - Service Worker接続エラーが発生した場合、ドラッグ操作はサイレントにキャンセル
 * - mousemoveイベントでホバー検知し、別ウィンドウへのフォーカス移動を通知
 * - バックグラウンドスロットリング回避のためのフォーカス移動
 */
import { useEffect, useRef, useCallback, useState } from 'react';
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
 * - mouseenterイベントでドラッグセッションをチェックし、別ウィンドウからのドラッグの場合はタブ移動を実行
 * - mousemoveイベントでツリービュー上のホバーを検知し、Service Workerに通知（バックグラウンドスロットリング回避）
 * - セッション状態のローカルキャッシュを実装（パフォーマンス最適化）
 */
export function useCrossWindowDrag({
  containerRef,
  onDragReceived,
}: UseCrossWindowDragProps): void {
  const currentWindowIdRef = useRef<number | null>(null);
  const onDragReceivedRef = useRef(onDragReceived);
  // セッション状態のローカルキャッシュ
  const [cachedSession, setCachedSession] = useState<DragSession | null>(null);
  // 重複通知防止のためのウィンドウID記録
  const lastNotifiedWindowRef = useRef<number | null>(null);
  // セッション更新用インターバルID
  const sessionPollingIntervalRef = useRef<number | null>(null);

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
   * セッション状態をポーリングで更新
   * mousemove毎にService Workerに問い合わせるとパフォーマンスが悪いため、
   * 定期的にセッション状態を取得してキャッシュする
   */
  useEffect(() => {
    const pollSession = async () => {
      try {
        const response = await chrome.runtime.sendMessage({
          type: 'GET_DRAG_SESSION',
        }) as MessageResponse<DragSession | null>;

        if (response.success) {
          setCachedSession(response.data);
          // セッションが終了したらlastNotifiedWindowをリセット
          if (!response.data) {
            lastNotifiedWindowRef.current = null;
          }
        }
      } catch (_error) {
        // エラー時はセッションをクリア
        setCachedSession(null);
        lastNotifiedWindowRef.current = null;
      }
    };

    // 初回取得
    pollSession();

    // 100msごとにポーリング（ドラッグ中のレスポンスを確保）
    sessionPollingIntervalRef.current = window.setInterval(pollSession, 100);

    return () => {
      if (sessionPollingIntervalRef.current !== null) {
        clearInterval(sessionPollingIntervalRef.current);
        sessionPollingIntervalRef.current = null;
      }
    };
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
      // エラー時はサイレントにログを出力
      console.error('[CrossWindowDrag] Failed to move tab:', error);
      // onDragReceivedは呼ばない（ドラッグをキャンセル）
    }
  }, []);

  /**
   * mousemoveイベントハンドラ
   * ツリービュー上のホバーを検知し、Service Workerに通知
   * バックグラウンドスロットリング回避のためフォーカス移動を実行
   */
  const handleMouseMove = useCallback(async () => {
    const currentWindowId = currentWindowIdRef.current;
    if (currentWindowId === null) return;

    // ローカルキャッシュを参照（Service Workerへの問い合わせなし）
    const session = cachedSession;

    // セッションがない、またはドラッグ中でない場合は何もしない
    if (!session || session.state === 'idle') {
      return;
    }

    // 同じウィンドウからのドラッグは通知不要
    if (session.sourceWindowId === currentWindowId) {
      return;
    }

    // 既に同じウィンドウを通知済みなら何もしない（重複呼び出し防止）
    if (lastNotifiedWindowRef.current === currentWindowId) {
      return;
    }

    // 通知済みウィンドウを記録
    lastNotifiedWindowRef.current = currentWindowId;

    // Service Workerにホバー通知を送信
    // notifyTreeViewHover内でウィンドウフォーカスも移動する
    try {
      await chrome.runtime.sendMessage({
        type: 'NOTIFY_TREE_VIEW_HOVER',
        payload: { windowId: currentWindowId },
      });
    } catch (_error) {
      // 通知失敗は無視（サイレントに処理）
    }
  }, [cachedSession]);

  // イベントリスナーの設定とクリーンアップ
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseenter', handleMouseEnter);
    container.addEventListener('mousemove', handleMouseMove);
    return () => {
      container.removeEventListener('mouseenter', handleMouseEnter);
      container.removeEventListener('mousemove', handleMouseMove);
    };
  }, [containerRef, handleMouseEnter, handleMouseMove]);
}
