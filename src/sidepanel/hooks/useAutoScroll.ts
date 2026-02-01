/**
 * 自前自動スクロールフック
 *
 * ドラッグ中にマウスが端に近づいたら自動スクロール
 */

import React, { useCallback, useRef } from 'react';

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

export interface UseAutoScrollReturn {
  /** スクロール処理を実行（ドラッグ中のmousemove時に呼び出す） */
  handleAutoScroll: (mouseY: number, containerRect: DOMRect) => void;
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
    threshold = 50,
    speed = 8,
    clampToContent = true,
  } = options;

  const animationFrameRef = useRef<number | null>(null);

  const handleAutoScroll = useCallback(
    (mouseY: number, containerRect: DOMRect) => {
      const container = containerRef.current;
      if (!container) return;

      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      const maxScroll = Math.max(0, scrollHeight - clientHeight);
      const relativeY = mouseY - containerRect.top;

      if (relativeY < threshold && scrollTop > 0) {
        const newScrollTop = Math.max(0, scrollTop - speed);
        container.scrollTop = newScrollTop;
        return;
      }

      const distanceFromBottom = containerRect.bottom - mouseY;
      if (distanceFromBottom < threshold) {
        if (clampToContent) {
          const newScrollTop = Math.min(maxScroll, scrollTop + speed);
          container.scrollTop = newScrollTop;
        } else {
          container.scrollTop = scrollTop + speed;
        }
        return;
      }
    },
    [containerRef, threshold, speed, clampToContent]
  );

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
