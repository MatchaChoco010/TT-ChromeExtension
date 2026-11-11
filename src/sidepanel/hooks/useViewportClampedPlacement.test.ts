import { describe, it, expect } from 'vitest';
import { calculateViewportClampedPlacement, VIEWPORT_MARGIN } from './useViewportClampedPlacement';

describe('calculateViewportClampedPlacement', () => {
  const viewport = { width: 400, height: 600 };

  it('画面内に収まる場合はanchorの位置にそのまま置く', () => {
    const placement = calculateViewportClampedPlacement({
      anchor: { x: 50, y: 100 },
      size: { width: 200, height: 300 },
      viewport,
    });

    expect(placement).toEqual({ x: 50, y: 100, maxHeight: 600 - VIEWPORT_MARGIN * 2 });
  });

  it('下端からはみ出す場合は、下端が余白位置に来るまで上に寄せる', () => {
    const placement = calculateViewportClampedPlacement({
      anchor: { x: 50, y: 500 },
      size: { width: 200, height: 400 },
      viewport,
    });

    expect(placement.y).toBe(600 - VIEWPORT_MARGIN - 400);
  });

  it('右端からはみ出す場合は、右端が余白位置に来るまで左に寄せる', () => {
    const placement = calculateViewportClampedPlacement({
      anchor: { x: 350, y: 100 },
      size: { width: 200, height: 300 },
      viewport,
    });

    expect(placement.x).toBe(400 - VIEWPORT_MARGIN - 200);
  });

  it('画面より高い場合は上端の余白位置に置き、最大の高さを画面内に制限する', () => {
    const placement = calculateViewportClampedPlacement({
      anchor: { x: 50, y: 300 },
      size: { width: 200, height: 900 },
      viewport,
    });

    expect(placement.y).toBe(VIEWPORT_MARGIN);
    expect(placement.maxHeight).toBe(600 - VIEWPORT_MARGIN * 2);
  });

  it('画面より幅が広い場合は左端の余白位置に置く', () => {
    const placement = calculateViewportClampedPlacement({
      anchor: { x: 100, y: 100 },
      size: { width: 500, height: 300 },
      viewport,
    });

    expect(placement.x).toBe(VIEWPORT_MARGIN);
  });

  it('右端からはみ出しflipRightEdgeXが指定されている場合は、要素の右端をその位置に揃える', () => {
    const placement = calculateViewportClampedPlacement({
      anchor: { x: 300, y: 100 },
      size: { width: 160, height: 120 },
      viewport,
      flipRightEdgeX: 200,
    });

    expect(placement.x).toBe(200 - 160);
  });

  it('flipRightEdgeXに揃えても左端からはみ出す場合は、左端の余白位置に寄せる', () => {
    const placement = calculateViewportClampedPlacement({
      anchor: { x: 300, y: 100 },
      size: { width: 160, height: 120 },
      viewport,
      flipRightEdgeX: 100,
    });

    expect(placement.x).toBe(VIEWPORT_MARGIN);
  });

  it('右端に収まる場合はflipRightEdgeXを使わない', () => {
    const placement = calculateViewportClampedPlacement({
      anchor: { x: 100, y: 100 },
      size: { width: 160, height: 120 },
      viewport,
      flipRightEdgeX: 50,
    });

    expect(placement.x).toBe(100);
  });
});
