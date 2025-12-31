/**
 * Task 10.1: GapDropDetection水平ドロップターゲット計算テスト
 */

import { describe, it, expect } from 'vitest';
import {
  calculateHorizontalDropTarget,
  calculateHorizontalIndicatorX,
  DropTargetType,
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
    { nodeId: 'tab-1', left: 0, right: 40, index: 0 },
    { nodeId: 'tab-2', left: 40, right: 80, index: 1 },
    { nodeId: 'tab-3', left: 80, right: 120, index: 2 },
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
