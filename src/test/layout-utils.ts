/**
 * jsdomでレイアウトに依存する処理をテストするためのユーティリティ
 */
import { vi } from 'vitest';

interface LayoutMock {
  viewport: { width: number; height: number };
  /** getBoundingClientRectが返す要素の大きさ */
  elementSize: { width: number; height: number };
}

/**
 * ビューポートの大きさと、要素のgetBoundingClientRectが返す大きさを差し替える
 * jsdomはレイアウトを計算しないため、要素の大きさは全要素で共通の値になる
 * @returns 差し替えを元に戻す関数
 */
export function mockLayout({ viewport, elementSize }: LayoutMock): () => void {
  const originalWidth = window.innerWidth;
  const originalHeight = window.innerHeight;
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: viewport.width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: viewport.height });
  const rectSpy = vi
    .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, elementSize.width, elementSize.height));

  return () => {
    rectSpy.mockRestore();
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: originalWidth });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: originalHeight });
  };
}
