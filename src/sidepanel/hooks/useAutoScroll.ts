/**
 * 自前自動スクロールフック
 *
 * ドラッグ中にマウスが端に近づいたら自動スクロール
 * スクロール可能範囲内のみスクロール（clampToContent: true）
 * スクロール可能量を超えるスクロールを防止
 */

import React, { useCallback, useRef } from 'react';

/**
 * useAutoScrollフックのオプション
 */
export interface UseAutoScrollOptions {
  /** スクロール開始しきい値（端からの距離、px） デフォルト: 50 */
  threshold?: number;
  /** スクロール速度（px/frame） デフォルト: 8 */
  speed?: number;
  /** スクロール間隔（ms） デフォルト: 16（約60fps） */
  interval?: number;
  /** スクロール可能範囲を超えないようにする デフォルト: true */
  clampToContent?: boolean;
}

/**
 * useAutoScrollフックの戻り値
 */
export interface UseAutoScrollReturn {
  /** スクロール処理を実行（ドラッグ中のmousemove時に呼び出す） */
  handleAutoScroll: (mouseY: number, containerRect: DOMRect) => void;
  /** スクロールを停止 */
  stopAutoScroll: () => void;
}

/**
 * 自前自動スクロールフック
 *
 * ドラッグ中にマウスがコンテナの端に近づいたとき自動的にスクロールする。
 * clampToContent=trueの場合、スクロール可能範囲を超えるスクロールを防止する。
 *
 * @param containerRef スクロールコンテナ要素のref
 * @param options オプション設定
 * @returns handleAutoScrollとstopAutoScroll関数
 */
export function useAutoScroll(
  containerRef: React.RefObject<HTMLElement | null>,
  options: UseAutoScrollOptions = {}
): UseAutoScrollReturn {
  const {
    threshold = 50, // 端から50pxでスクロール開始
    speed = 8, // フレームあたり8pxスクロール
    // interval = 16, // 約60fps（現在未使用だが将来のrAFベース実装用に残す）
    clampToContent = true, // コンテンツ範囲内に制限（デフォルトtrue）
  } = options;

  // requestAnimationFrameのIDを追跡（将来のrAFベース実装用）
  const animationFrameRef = useRef<number | null>(null);

  /**
   * 自動スクロール処理
   *
   * マウス位置に基づいてスクロールを実行する。
   * - 上端近く: 上にスクロール
   * - 下端近く: 下にスクロール
   * - それ以外: スクロールなし
   *
   * @param mouseY マウスのY座標（スクリーン座標）
   * @param containerRect コンテナのBoundingClientRect
   */
  const handleAutoScroll = useCallback(
    (mouseY: number, containerRect: DOMRect) => {
      const container = containerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      // 最大スクロール量（コンテンツがビューポートより小さい場合は0）
      const maxScroll = Math.max(0, scrollHeight - clientHeight);

      // マウスY座標のコンテナ上端からの相対位置
      const relativeY = mouseY - containerRect.top;

      // 上端近く（threshold内）で、まだ上にスクロールできる場合
      if (relativeY < threshold && scrollTop > 0) {
        const newScrollTop = Math.max(0, scrollTop - speed);
        container.scrollTop = newScrollTop;
        return;
      }

      // 下端近く（threshold内）の場合
      const distanceFromBottom = containerRect.bottom - mouseY;
      if (distanceFromBottom < threshold) {
        if (clampToContent) {
          // スクロール可能範囲内に制限
          const newScrollTop = Math.min(maxScroll, scrollTop + speed);
          container.scrollTop = newScrollTop;
        } else {
          // 制限なし（通常は使用しない）
          container.scrollTop = scrollTop + speed;
        }
        return;
      }

      // 中央付近ではスクロールしない
    },
    [containerRef, threshold, speed, clampToContent]
  );

  /**
   * スクロールを停止する
   *
   * requestAnimationFrameベースの連続スクロール実装時に使用
   */
  const stopAutoScroll = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  return {
    handleAutoScroll,
    stopAutoScroll,
  };
}
