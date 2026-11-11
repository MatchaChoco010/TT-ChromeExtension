/**
 * ポップアップ要素（コンテキストメニュー等）を画面内に収めて配置するフック
 */

import { useLayoutEffect, useState, type RefObject } from 'react';

/** 画面端との最小余白（px） */
export const VIEWPORT_MARGIN = 10;

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Placement {
  x: number;
  y: number;
  /** 画面内に収めるための最大の高さ。これを超える内容はスクロールさせる */
  maxHeight: number;
}

export interface PlacementInput {
  /** 要素の左上を置きたい位置 */
  anchor: Point;
  /** 要素の実際の大きさ */
  size: Size;
  viewport: Size;
  /**
   * anchorに置くと右端からはみ出す場合に、要素の右端を揃える位置。
   * サブメニューを親メニューの左側に出すときに使う。省略時は画面内に寄せるだけ
   */
  flipRightEdgeX?: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * 要素を画面内に収める表示位置を計算する
 * 画面より大きい要素は画面端の余白位置に置き、maxHeightを超える部分はスクロールで表示する前提とする
 */
export function calculateViewportClampedPlacement({
  anchor,
  size,
  viewport,
  flipRightEdgeX,
}: PlacementInput): Placement {
  const maxHeight = Math.max(0, viewport.height - VIEWPORT_MARGIN * 2);
  const height = Math.min(size.height, maxHeight);
  const rightLimit = viewport.width - VIEWPORT_MARGIN;

  let x = anchor.x;
  if (x + size.width > rightLimit && flipRightEdgeX !== undefined) {
    x = flipRightEdgeX - size.width;
  }

  return {
    x: clamp(x, VIEWPORT_MARGIN, rightLimit - size.width),
    y: clamp(anchor.y, VIEWPORT_MARGIN, viewport.height - VIEWPORT_MARGIN - height),
    maxHeight,
  };
}

const isSameSize = (a: Size, b: Size): boolean => a.width === b.width && a.height === b.height;

const getViewportSize = (): Size => ({ width: window.innerWidth, height: window.innerHeight });

/**
 * 要素の実際の大きさを測り、画面内に収まる位置を返す
 * 描画後・画面反映前に測定するため、はみ出した位置が一瞬表示されることはない。
 * 要素の大きさや画面サイズが変わった場合は位置を再計算する
 * @param elementRef - 配置する要素
 * @param anchor - 要素の左上を置きたい位置
 * @param flipRightEdgeX - 右端からはみ出す場合に要素の右端を揃える位置
 * @returns 要素のleft/topに使う位置と、要素に設定する最大の高さ
 */
export function useViewportClampedPlacement(
  elementRef: RefObject<HTMLElement | null>,
  anchor: Point,
  flipRightEdgeX?: number,
): Placement {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<Size>(getViewportSize);

  useLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const measure = (): void => {
      const { width, height } = element.getBoundingClientRect();
      const measured = { width, height };
      setSize((current) => (isSameSize(current, measured) ? current : measured));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef]);

  useLayoutEffect(() => {
    const handleResize = (): void => setViewport(getViewportSize());
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return calculateViewportClampedPlacement({ anchor, size, viewport, flipRightEdgeX });
}
