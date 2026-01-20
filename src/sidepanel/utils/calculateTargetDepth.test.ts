import { describe, it, expect } from 'vitest';
import { calculateTargetDepth } from './calculateTargetDepth';

describe('calculateTargetDepth', () => {
  const defaultIndentWidth = 20;
  const defaultContainerLeft = 0;

  describe('基本的なdepth計算', () => {
    it('コンテナ左端でマウスを動かすとdepth=0を返す', () => {
      const result = calculateTargetDepth(0, defaultContainerLeft, defaultIndentWidth, 5);
      expect(result).toBe(0);
    });

    it('インデント幅1つ分右に動かすとdepth=1を返す', () => {
      const result = calculateTargetDepth(20, defaultContainerLeft, defaultIndentWidth, 5);
      expect(result).toBe(1);
    });

    it('インデント幅2つ分右に動かすとdepth=2を返す', () => {
      const result = calculateTargetDepth(40, defaultContainerLeft, defaultIndentWidth, 5);
      expect(result).toBe(2);
    });

    it('中間位置ではfloorされたdepthを返す', () => {
      const result = calculateTargetDepth(30, defaultContainerLeft, defaultIndentWidth, 5);
      expect(result).toBe(1);
    });
  });

  describe('maxDepth制限', () => {
    it('maxDepthを超える位置でもmaxDepthを返す', () => {
      const maxDepth = 3;
      const result = calculateTargetDepth(100, defaultContainerLeft, defaultIndentWidth, maxDepth);
      expect(result).toBe(3);
    });

    it('maxDepth=0の場合は常に0を返す', () => {
      const result = calculateTargetDepth(100, defaultContainerLeft, defaultIndentWidth, 0);
      expect(result).toBe(0);
    });

    it('maxDepth=1の場合は0または1を返す', () => {
      expect(calculateTargetDepth(10, defaultContainerLeft, defaultIndentWidth, 1)).toBe(0);
      expect(calculateTargetDepth(30, defaultContainerLeft, defaultIndentWidth, 1)).toBe(1);
      expect(calculateTargetDepth(100, defaultContainerLeft, defaultIndentWidth, 1)).toBe(1);
    });
  });

  describe('負のX座標', () => {
    it('負のX座標（コンテナ左端より左）ではdepth=0を返す', () => {
      const result = calculateTargetDepth(-20, defaultContainerLeft, defaultIndentWidth, 5);
      expect(result).toBe(0);
    });

    it('大きな負の値でもdepth=0を返す', () => {
      const result = calculateTargetDepth(-1000, defaultContainerLeft, defaultIndentWidth, 5);
      expect(result).toBe(0);
    });
  });

  describe('コンテナオフセット', () => {
    it('コンテナ左端が100pxの場合、150pxでdepth=2を返す', () => {
      const result = calculateTargetDepth(150, 100, defaultIndentWidth, 5);
      expect(result).toBe(2);
    });

    it('コンテナ左端より左側のマウス位置ではdepth=0を返す', () => {
      const result = calculateTargetDepth(50, 100, defaultIndentWidth, 5);
      expect(result).toBe(0);
    });
  });

  describe('カスタムインデント幅', () => {
    it('インデント幅30pxで、60pxの位置はdepth=2を返す', () => {
      const result = calculateTargetDepth(60, defaultContainerLeft, 30, 5);
      expect(result).toBe(2);
    });

    it('インデント幅10pxで、35pxの位置はdepth=3を返す', () => {
      const result = calculateTargetDepth(35, defaultContainerLeft, 10, 5);
      expect(result).toBe(3);
    });
  });

  describe('エッジケース', () => {
    it('インデント幅0の場合でもエラーなく0を返す', () => {
      const result = calculateTargetDepth(100, defaultContainerLeft, 0, 5);
      expect(result).toBe(0);
    });

    it('maxDepthが負の場合は0を返す', () => {
      const result = calculateTargetDepth(100, defaultContainerLeft, defaultIndentWidth, -1);
      expect(result).toBe(0);
    });

    it('全てのパラメータが0の場合は0を返す', () => {
      const result = calculateTargetDepth(0, 0, 0, 0);
      expect(result).toBe(0);
    });
  });
});
