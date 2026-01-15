/**
 * GapDropDetection水平ドロップターゲット計算テスト
 * サブツリーサイズを考慮したドロップ位置計算テスト
 */

import { describe, it, expect } from 'vitest';
import {
  calculateDropTarget,
  calculateHorizontalDropTarget,
  calculateHorizontalIndicatorX,
  DropTargetType,
  type TabPosition,
  type HorizontalTabPosition,
} from './GapDropDetection';

describe('calculateHorizontalDropTarget', () => {
  describe('タブリストが空の場合', () => {
    it('Noneを返す', () => {
      const result = calculateHorizontalDropTarget(50, []);
      expect(result.type).toBe(DropTargetType.None);
    });
  });

  describe('最初のタブより左の場合', () => {
    it('insertIndex=0のHorizontalGapを返す', () => {
      const tabs: HorizontalTabPosition[] = [
        { nodeId: 'tab-1', left: 10, right: 50, index: 0 },
        { nodeId: 'tab-2', left: 50, right: 90, index: 1 },
      ];

      const result = calculateHorizontalDropTarget(5, tabs);
      expect(result.type).toBe(DropTargetType.HorizontalGap);
      expect(result.insertIndex).toBe(0);
    });
  });

  describe('最後のタブより右の場合', () => {
    it('insertIndex=タブ数のHorizontalGapを返す', () => {
      const tabs: HorizontalTabPosition[] = [
        { nodeId: 'tab-1', left: 10, right: 50, index: 0 },
        { nodeId: 'tab-2', left: 50, right: 90, index: 1 },
      ];

      const result = calculateHorizontalDropTarget(100, tabs);
      expect(result.type).toBe(DropTargetType.HorizontalGap);
      expect(result.insertIndex).toBe(2);
    });
  });

  describe('タブの中心より左の場合', () => {
    it('そのタブの前に挿入するinsertIndexを返す', () => {
      const tabs: HorizontalTabPosition[] = [
        { nodeId: 'tab-1', left: 0, right: 40, index: 0 },   // center=20
        { nodeId: 'tab-2', left: 40, right: 80, index: 1 },  // center=60
        { nodeId: 'tab-3', left: 80, right: 120, index: 2 }, // center=100
      ];

      // tab-2の左側（center=60の左）にドロップ
      const result = calculateHorizontalDropTarget(50, tabs);
      expect(result.type).toBe(DropTargetType.HorizontalGap);
      expect(result.insertIndex).toBe(1); // tab-2の前
    });
  });

  describe('タブの中心より右の場合', () => {
    it('そのタブの後に挿入するinsertIndexを返す', () => {
      const tabs: HorizontalTabPosition[] = [
        { nodeId: 'tab-1', left: 0, right: 40, index: 0 },   // center=20
        { nodeId: 'tab-2', left: 40, right: 80, index: 1 },  // center=60
        { nodeId: 'tab-3', left: 80, right: 120, index: 2 }, // center=100
      ];

      // tab-2の右側（center=60の右）にドロップ
      const result = calculateHorizontalDropTarget(70, tabs);
      expect(result.type).toBe(DropTargetType.HorizontalGap);
      expect(result.insertIndex).toBe(2); // tab-2の後
    });
  });

  describe('タブの中心ちょうどの場合', () => {
    it('右側（後に挿入）と判定される', () => {
      const tabs: HorizontalTabPosition[] = [
        { nodeId: 'tab-1', left: 0, right: 40, index: 0 }, // center=20
      ];

      // 中心ちょうど
      const result = calculateHorizontalDropTarget(20, tabs);
      expect(result.type).toBe(DropTargetType.HorizontalGap);
      // 中心と同じ値の場合は右側（後に挿入）
      expect(result.insertIndex).toBe(1);
    });
  });
});

describe('calculateHorizontalIndicatorX', () => {
  const tabs: HorizontalTabPosition[] = [
    { nodeId: 'tab-1', left: 0, right: 40, index: 0 },  // center=20
    { nodeId: 'tab-2', left: 40, right: 80, index: 1 }, // center=60
    { nodeId: 'tab-3', left: 80, right: 120, index: 2 }, // center=100
  ];

  describe('空のタブリストの場合', () => {
    it('0を返す', () => {
      expect(calculateHorizontalIndicatorX(0, [])).toBe(0);
    });
  });

  describe('先頭に挿入する場合', () => {
    it('最初のタブの左端を返す', () => {
      expect(calculateHorizontalIndicatorX(0, tabs)).toBe(0);
    });
  });

  describe('末尾に挿入する場合', () => {
    it('最後のタブの右端を返す', () => {
      expect(calculateHorizontalIndicatorX(3, tabs)).toBe(120);
    });
  });

  describe('タブ間に挿入する場合', () => {
    it('左のタブの右端と右のタブの左端の中間を返す', () => {
      // tab-1とtab-2の間
      expect(calculateHorizontalIndicatorX(1, tabs)).toBe(40); // (40 + 40) / 2

      // tab-2とtab-3の間
      expect(calculateHorizontalIndicatorX(2, tabs)).toBe(80); // (80 + 80) / 2
    });
  });
});

/**
 * calculateDropTargetのサブツリー除外テスト
 * 下方向へのドラッグ時、サブツリーサイズを考慮したインデックス調整
 */
describe('calculateDropTarget with subtree exclusion', () => {
  // テスト用のタブ位置配列
  // タブA (ドラッグ中、サブツリーあり)
  //   子タブ1
  //   子タブ2
  // タブB
  // タブC
  const tabs: TabPosition[] = [
    { nodeId: 'tab-A', top: 0, bottom: 30, depth: 0 },
    { nodeId: 'child-1', top: 30, bottom: 60, depth: 1 },
    { nodeId: 'child-2', top: 60, bottom: 90, depth: 1 },
    { nodeId: 'tab-B', top: 90, bottom: 120, depth: 0 },
    { nodeId: 'tab-C', top: 120, bottom: 150, depth: 0 },
  ];

  // サブツリーノードID取得のモック関数
  const getSubtreeNodeIds = (nodeId: string): string[] => {
    if (nodeId === 'tab-A') {
      return ['tab-A', 'child-1', 'child-2'];
    }
    return [nodeId];
  };

  describe('サブツリー除外なしの場合', () => {
    it('従来通りのgapIndexを返す', () => {
      // タブBの下端付近（gapThreshold=7.5なので、112.5以上がGap領域）
      const result = calculateDropTarget(118, tabs); // タブBの下部Gap領域
      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBe(4);
    });
  });

  describe('サブツリー除外ありの場合', () => {
    it('ドラッグ中のノードとサブツリーを除外してgapIndexを計算', () => {
      // タブAとそのサブツリーを除外
      // 有効なタブ: タブB (index 0), タブC (index 1)
      // タブBの下部（90-120の間）→ 除外後のリストではgapIndex = 1（タブBとタブCの間）
      const result = calculateDropTarget(115, tabs, {
        draggedNodeId: 'tab-A',
        getSubtreeNodeIds,
      });

      expect(result.type).toBe(DropTargetType.Gap);
      // サブツリー除外後: [タブB (0-30相当), タブC (30-60相当)]
      // マウスY=115は元のタブBの下端付近だが、除外後のリストでは異なる位置になる
      // 実際には元のDOM位置を使用するため、タブBとタブCの間（gapIndex=1）になる
      expect(result.gapIndex).toBe(1);
    });

    it('ドラッグ中のサブツリーがリストから除外される', () => {
      // タブリストの先頭（gapIndex = 0）
      // サブツリー除外後は有効タブ [タブB, タブC] のみ
      const result = calculateDropTarget(-5, tabs, {
        draggedNodeId: 'tab-A',
        getSubtreeNodeIds,
      });

      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBe(0);
      // adjacentDepthsも有効タブに基づいて計算される
      expect(result.adjacentDepths?.above).toBeUndefined();
      expect(result.adjacentDepths?.below).toBe(0); // タブB（depth=0）
    });

    it('リスト末尾へのドロップ時も正しいgapIndexを返す', () => {
      // タブCより下（リスト末尾）
      const result = calculateDropTarget(160, tabs, {
        draggedNodeId: 'tab-A',
        getSubtreeNodeIds,
      });

      expect(result.type).toBe(DropTargetType.Gap);
      // 有効タブ: [タブB (index 0), タブC (index 1)]
      // リスト末尾 → gapIndex = 2
      expect(result.gapIndex).toBe(2);
      expect(result.adjacentDepths?.above).toBe(0); // タブC（depth=0）
      expect(result.adjacentDepths?.below).toBeUndefined();
    });
  });

  describe('空のサブツリーの場合', () => {
    it('単一ノードのみ除外される', () => {
      const getSingleNodeSubtree = (nodeId: string): string[] => [nodeId];

      // タブBを除外してドロップ位置を計算
      // 有効タブ: [タブA, child-1, child-2, タブC]
      // タブCの上部Gap領域（120-127.5の範囲）
      const result = calculateDropTarget(122, tabs, {
        draggedNodeId: 'tab-B',
        getSubtreeNodeIds: getSingleNodeSubtree,
      });

      expect(result.type).toBe(DropTargetType.Gap);
      // child-2とタブCの間 → gapIndex = 3（除外後のリストで）
      expect(result.gapIndex).toBe(3);
    });
  });

  describe('全タブがサブツリーに含まれる場合', () => {
    it('Noneを返す', () => {
      const getAllNodes = (): string[] => ['tab-A', 'child-1', 'child-2', 'tab-B', 'tab-C'];

      const result = calculateDropTarget(50, tabs, {
        draggedNodeId: 'tab-A',
        getSubtreeNodeIds: getAllNodes,
      });

      expect(result.type).toBe(DropTargetType.None);
    });
  });

  describe('後方互換性', () => {
    it('数値パラメータでも動作する', () => {
      // 従来の呼び出し方法（数値の閾値比率）
      // child-1の上部Gap領域（30-37.5）
      const result = calculateDropTarget(32, tabs, 0.25);

      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBeDefined();
    });

    it('containerBounds付きの呼び出しも動作する', () => {
      // 従来の呼び出し方法（数値 + containerBounds）
      // child-1の上部Gap領域（30-37.5）
      const result = calculateDropTarget(32, tabs, 0.25, { minY: 0, maxY: 200 });

      expect(result.type).toBe(DropTargetType.Gap);
    });

    it('オプションオブジェクトでcontainerBoundsを指定できる', () => {
      const result = calculateDropTarget(250, tabs, {
        containerBounds: { minY: 0, maxY: 200 },
      });

      // 境界外なのでNone
      expect(result.type).toBe(DropTargetType.None);
    });
  });
});
