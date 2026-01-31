import { describe, it, expect } from 'vitest';
import { calculateDepthRange } from './calculateDepthRange';

describe('calculateDepthRange', () => {
  describe('基本的なケース', () => {
    it('上下両方にノードがある場合', () => {
      // タブA (depth=0) の下、タブB (depth=1) の上
      const result = calculateDepthRange(0, 1);
      expect(result).toEqual({ minDepth: 1, maxDepth: 1 });
    });

    it('上のノードの深い位置の下にドロップする場合', () => {
      // タブA (depth=0)
      //   - タブB (depth=1)
      //   ドロップ位置
      // → minDepth=0, maxDepth=2
      const result = calculateDepthRange(1, undefined);
      expect(result).toEqual({ minDepth: 0, maxDepth: 2 });
    });

    it('上にだけノードがある場合（リスト末尾）', () => {
      // タブA (depth=0)
      //   - タブB (depth=1)
      //     - タブC (depth=2)
      //     ドロップ位置
      const result = calculateDepthRange(2, undefined);
      expect(result).toEqual({ minDepth: 0, maxDepth: 3 });
    });

    it('下にだけノードがある場合（リスト先頭）', () => {
      // ドロップ位置
      // - タブA (depth=0)
      const result = calculateDepthRange(undefined, 0);
      expect(result).toEqual({ minDepth: 0, maxDepth: 0 });
    });

    it('両方ともundefinedの場合（空のリスト）', () => {
      const result = calculateDepthRange(undefined, undefined);
      expect(result).toEqual({ minDepth: 0, maxDepth: 0 });
    });
  });

  describe('複数選択肢があるケース', () => {
    it('複数のdepthから選択可能な場合', () => {
      // タブA (depth=0)
      //   - タブB (depth=1)
      //   ドロップ位置
      //   - タブC (depth=1) または下にノードなし
      // → depth 1 または 2 を選択可能
      const result = calculateDepthRange(1, 1);
      expect(result).toEqual({ minDepth: 1, maxDepth: 2 });
    });

    it('depth 0から深い位置まで選択可能な場合', () => {
      // タブA (depth=0)
      //   - タブB (depth=1)
      //     - タブC (depth=2)
      //     ドロップ位置
      // - タブD (depth=0)
      const result = calculateDepthRange(2, 0);
      expect(result).toEqual({ minDepth: 0, maxDepth: 3 });
    });
  });

  describe('ルート位置へのドロップ', () => {
    it('ルートノードの下、別のルートノードの上', () => {
      const result = calculateDepthRange(0, 0);
      expect(result).toEqual({ minDepth: 0, maxDepth: 1 });
    });

    it('深いノードの下、ルートノードの上', () => {
      // タブA (depth=0)
      //   - タブB (depth=1)
      //   ドロップ位置
      // タブC (depth=0)
      const result = calculateDepthRange(1, 0);
      expect(result).toEqual({ minDepth: 0, maxDepth: 2 });
    });
  });
});
