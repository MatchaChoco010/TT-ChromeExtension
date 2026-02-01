/**
 * タブとタブ間の隙間ドロップ判定テスト
 */
import { describe, it, expect } from 'vitest';
import {
  calculateDropTarget,
  DropTargetType,
} from './GapDropDetection';

describe('タブとタブ間の隙間ドロップ判定', () => {
  // テスト用のタブノード位置情報
  // 各タブの高さは40px、隙間判定領域は上下10pxと仮定
  const tabPositions = [
    { nodeId: 'node-1', top: 0, bottom: 40, depth: 0 },
    { nodeId: 'node-2', top: 40, bottom: 80, depth: 0 },
    { nodeId: 'node-3', top: 80, bottom: 120, depth: 1 },
  ];

  describe('calculateDropTarget関数', () => {
    describe('タブ中央付近へのホバー（タブドロップ判定）', () => {
      it('タブの中央付近にホバーするとタブドロップとして判定される', () => {
        // タブ1の中央付近 (20px = タブの真ん中)
        const result = calculateDropTarget(20, tabPositions);

        expect(result.type).toBe(DropTargetType.Tab);
        expect(result.targetNodeId).toBe('node-1');
      });

      it('タブ2の中央付近にホバーするとタブ2がターゲットになる', () => {
        // タブ2の中央付近 (60px)
        const result = calculateDropTarget(60, tabPositions);

        expect(result.type).toBe(DropTargetType.Tab);
        expect(result.targetNodeId).toBe('node-2');
      });

      it('タブ3の中央付近にホバーするとタブ3がターゲットになる', () => {
        // タブ3の中央付近 (100px)
        const result = calculateDropTarget(100, tabPositions);

        expect(result.type).toBe(DropTargetType.Tab);
        expect(result.targetNodeId).toBe('node-3');
      });
    });

    describe('タブ端付近へのホバー（隙間ドロップ判定）', () => {
      it('タブの上端付近にホバーすると上側の隙間として判定される', () => {
        // タブ1の上端付近 (5px = タブの上端から5px)
        const result = calculateDropTarget(5, tabPositions);

        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.gapIndex).toBe(0); // タブ1の上の隙間
      });

      it('タブの下端付近にホバーすると下側の隙間として判定される', () => {
        // タブ1の下端付近 (35px = タブの下端から5px上)
        const result = calculateDropTarget(35, tabPositions);

        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.gapIndex).toBe(1); // タブ1とタブ2の間
      });

      it('タブ2の上端付近にホバーするとタブ1-2間の隙間として判定される', () => {
        // タブ2の上端付近 (45px)
        const result = calculateDropTarget(45, tabPositions);

        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.gapIndex).toBe(1); // タブ1とタブ2の間
      });

      it('タブ2の下端付近にホバーするとタブ2-3間の隙間として判定される', () => {
        // タブ2の下端付近 (75px)
        const result = calculateDropTarget(75, tabPositions);

        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.gapIndex).toBe(2); // タブ2とタブ3の間
      });
    });

    describe('当たり判定の境界値テスト', () => {
      // 隙間判定領域はタブの高さの25%（上下10px）と仮定
      const gapThresholdRatio = 0.25;

      it('タブの上端25%領域は隙間判定になる', () => {
        // タブ1の上端25%領域内 (8px)
        const result = calculateDropTarget(8, tabPositions, gapThresholdRatio);

        expect(result.type).toBe(DropTargetType.Gap);
      });

      it('タブの上端25%境界ちょうどはタブ判定になる', () => {
        // タブ1の上端25%境界 (10px)
        const result = calculateDropTarget(10, tabPositions, gapThresholdRatio);

        expect(result.type).toBe(DropTargetType.Tab);
      });

      it('タブの下端25%領域は隙間判定になる', () => {
        // タブ1の下端25%領域内 (32px)
        const result = calculateDropTarget(32, tabPositions, gapThresholdRatio);

        expect(result.type).toBe(DropTargetType.Gap);
      });

      it('タブの下端25%境界ちょうど手前はタブ判定になる', () => {
        // タブ1の下端25%境界の手前 (29px - 中央領域の最後)
        // タブ高さ40px、上端10px〜下端30px(=40-10)が中央領域
        const result = calculateDropTarget(29, tabPositions, gapThresholdRatio);

        expect(result.type).toBe(DropTargetType.Tab);
      });

      it('タブの中央50%領域はタブ判定になる', () => {
        // タブ1の中央 (20px)
        const result = calculateDropTarget(20, tabPositions, gapThresholdRatio);

        expect(result.type).toBe(DropTargetType.Tab);
        expect(result.targetNodeId).toBe('node-1');
      });
    });

    describe('隙間のdepth情報', () => {
      it('隙間にドロップする際に隣接ノードのdepth情報が取得できる', () => {
        // タブ2とタブ3の間の隙間
        const result = calculateDropTarget(75, tabPositions);

        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.adjacentDepths).toBeDefined();
        // タブ2の深さは0、タブ3の深さは1
        expect(result.adjacentDepths?.above).toBe(0);
        expect(result.adjacentDepths?.below).toBe(1);
      });

      it('最初の隙間（タブ1の上）では上のdepthがundefined', () => {
        const result = calculateDropTarget(2, tabPositions);

        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.adjacentDepths?.above).toBeUndefined();
        expect(result.adjacentDepths?.below).toBe(0);
      });

      it('最後の隙間（タブ3の下）では下のdepthがundefined', () => {
        // タブ3の下端付近 (118px)
        const result = calculateDropTarget(118, tabPositions);

        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.adjacentDepths?.above).toBe(1);
        expect(result.adjacentDepths?.below).toBeUndefined();
      });
    });

    describe('エッジケース', () => {
      it('タブリストが空の場合、Noneを返す', () => {
        const result = calculateDropTarget(50, []);

        expect(result.type).toBe(DropTargetType.None);
      });

      it('Y座標が負の場合、最初のタブの上の隙間として判定される', () => {
        const result = calculateDropTarget(-10, tabPositions);

        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.gapIndex).toBe(0);
      });

      it('Y座標がすべてのタブより下の場合、最後のタブの下の隙間として判定される', () => {
        const result = calculateDropTarget(200, tabPositions);

        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.gapIndex).toBe(tabPositions.length);
      });
    });

    describe('コンテナ境界チェック', () => {
      it('containerBoundsが指定され、マウスがコンテナ外上側にある場合、Noneを返す', () => {
        // コンテナの境界: 0-120
        const result = calculateDropTarget(-20, tabPositions, 0.25, {
          minY: 0,
          maxY: 120,
        });

        expect(result.type).toBe(DropTargetType.None);
      });

      it('containerBoundsが指定され、マウスがコンテナ外下側にある場合、Noneを返す', () => {
        // コンテナの境界: 0-120
        const result = calculateDropTarget(150, tabPositions, 0.25, {
          minY: 0,
          maxY: 120,
        });

        expect(result.type).toBe(DropTargetType.None);
      });

      it('containerBoundsが指定され、マウスがコンテナ内にある場合、通常通り判定される', () => {
        // コンテナの境界: 0-120
        const result = calculateDropTarget(60, tabPositions, 0.25, {
          minY: 0,
          maxY: 120,
        });

        expect(result.type).toBe(DropTargetType.Tab);
        expect(result.targetNodeId).toBe('node-2');
      });

      it('containerBoundsが指定されていない場合、後方互換性のため従来通りの判定を行う', () => {
        // コンテナ境界なしで負のY座標
        const result = calculateDropTarget(-10, tabPositions, 0.25);

        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.gapIndex).toBe(0);
      });

      it('containerBoundsが指定され、境界ちょうど（minY）の場合は有効として判定される', () => {
        const result = calculateDropTarget(0, tabPositions, 0.25, {
          minY: 0,
          maxY: 120,
        });

        // 0は最初のタブの上部領域内
        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.gapIndex).toBe(0);
      });

      it('containerBoundsが指定され、境界ちょうど（maxY）の場合は有効として判定される', () => {
        const result = calculateDropTarget(120, tabPositions, 0.25, {
          minY: 0,
          maxY: 120,
        });

        // 120は最後のタブの下
        expect(result.type).toBe(DropTargetType.Gap);
        expect(result.gapIndex).toBe(tabPositions.length);
      });
    });
  });

  describe('DropTarget型の構造', () => {
    it('タブターゲットの場合、targetNodeIdが設定される', () => {
      const result = calculateDropTarget(60, tabPositions);

      expect(result.type).toBe(DropTargetType.Tab);
      expect(result.targetNodeId).toBeDefined();
      expect(result.gapIndex).toBeUndefined();
    });

    it('隙間ターゲットの場合、gapIndexとadjacentDepthsが設定される', () => {
      const result = calculateDropTarget(45, tabPositions);

      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBeDefined();
      expect(result.adjacentDepths).toBeDefined();
      expect(result.targetNodeId).toBeUndefined();
    });
  });
});
