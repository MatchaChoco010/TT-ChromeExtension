/**
 * Task 5.3: ドロップ判定領域の改善 - 統合テスト
 * Requirements: 8.1, 8.2, 8.3, 8.4
 *
 * このテストでは、ドロップ判定領域に基づく兄弟/子要素の配置を検証します。
 * - タブの上部25%にドロップ → 上に兄弟として挿入
 * - タブの下部25%にドロップ → 下に兄弟として挿入
 * - タブの中央50%にドロップ → 子要素として配置
 */
import { describe, it, expect } from 'vitest';
import {
  calculateDropTarget,
  DropTargetType,
  type TabPosition,
} from './GapDropDetection';

describe('Task 5.3: ドロップ判定領域の改善', () => {
  // テスト用のタブ位置情報（各タブの高さは40px）
  const createTabPositions = (): TabPosition[] => [
    { nodeId: 'node-1', top: 0, bottom: 40, depth: 0 },
    { nodeId: 'node-2', top: 40, bottom: 80, depth: 0 },
    { nodeId: 'node-3', top: 80, bottom: 120, depth: 0 },
  ];

  describe('Requirements 8.1, 8.2: 上部25%と下部25%は兄弟挿入ゾーン', () => {
    it('タブの上部25%領域にドロップすると上に兄弟として挿入するための情報が返される', () => {
      const tabPositions = createTabPositions();
      // タブ2の上部25%領域（タブ2は40-80px、上部25%は40-50px）
      // 45pxはタブ2の上端から5px = 上部12.5%
      const result = calculateDropTarget(45, tabPositions);

      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBe(1); // タブ1とタブ2の間
      expect(result.adjacentDepths?.above).toBe(0); // タブ1のdepth
      expect(result.adjacentDepths?.below).toBe(0); // タブ2のdepth
    });

    it('タブの下部25%領域にドロップすると下に兄弟として挿入するための情報が返される', () => {
      const tabPositions = createTabPositions();
      // タブ2の下部25%領域（タブ2は40-80px、下部25%は70-80px）
      // 75pxはタブ2の下端から5px = 下部12.5%
      const result = calculateDropTarget(75, tabPositions);

      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBe(2); // タブ2とタブ3の間
      expect(result.adjacentDepths?.above).toBe(0); // タブ2のdepth
      expect(result.adjacentDepths?.below).toBe(0); // タブ3のdepth
    });
  });

  describe('Requirement 8.2: 中央50%は子要素ゾーン', () => {
    it('タブの中央50%領域にドロップすると子要素として配置するための情報が返される', () => {
      const tabPositions = createTabPositions();
      // タブ2の中央50%領域（タブ2は40-80px、中央50%は50-70px）
      // 60pxはタブ2の真ん中
      const result = calculateDropTarget(60, tabPositions);

      expect(result.type).toBe(DropTargetType.Tab);
      expect(result.targetNodeId).toBe('node-2');
    });
  });

  describe('Requirements 8.3, 8.4: 上部/下部ドロップ時の兄弟挿入', () => {
    it('最初のタブの上部にドロップすると、リストの最初の位置に兄弟として挿入される', () => {
      const tabPositions = createTabPositions();
      // タブ1の上部25%領域（タブ1は0-40px、上部25%は0-10px）
      const result = calculateDropTarget(5, tabPositions);

      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBe(0); // 最初の位置
      expect(result.adjacentDepths?.above).toBeUndefined(); // 上にタブがない
      expect(result.adjacentDepths?.below).toBe(0); // タブ1のdepth
    });

    it('最後のタブの下部にドロップすると、リストの最後の位置に兄弟として挿入される', () => {
      const tabPositions = createTabPositions();
      // タブ3の下部25%領域（タブ3は80-120px、下部25%は110-120px）
      const result = calculateDropTarget(115, tabPositions);

      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBe(3); // 最後の位置（タブ3の後ろ）
      expect(result.adjacentDepths?.above).toBe(0); // タブ3のdepth
      expect(result.adjacentDepths?.below).toBeUndefined(); // 下にタブがない
    });

    it('隣接する2つのタブの境界にドロップすると、その間に兄弟として挿入される', () => {
      const tabPositions = createTabPositions();
      // タブ1の下部25%領域（35px）またはタブ2の上部25%領域（45px）
      // どちらも同じgapIndex=1を返すはず

      const resultFromTab1Bottom = calculateDropTarget(35, tabPositions);
      expect(resultFromTab1Bottom.type).toBe(DropTargetType.Gap);
      expect(resultFromTab1Bottom.gapIndex).toBe(1);

      const resultFromTab2Top = calculateDropTarget(45, tabPositions);
      expect(resultFromTab2Top.type).toBe(DropTargetType.Gap);
      expect(resultFromTab2Top.gapIndex).toBe(1);
    });
  });

  describe('ネストされたタブでのdepth情報', () => {
    it('異なるdepthのタブ間にドロップする場合、両方のdepthが返される', () => {
      const tabPositions: TabPosition[] = [
        { nodeId: 'parent', top: 0, bottom: 40, depth: 0 },
        { nodeId: 'child', top: 40, bottom: 80, depth: 1 },
        { nodeId: 'grandchild', top: 80, bottom: 120, depth: 2 },
      ];

      // parentとchildの間（gapIndex=1）
      const result = calculateDropTarget(35, tabPositions);

      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBe(1);
      expect(result.adjacentDepths?.above).toBe(0); // parentのdepth
      expect(result.adjacentDepths?.below).toBe(1); // childのdepth
    });
  });

  describe('境界値テスト', () => {
    it('タブの上端25%境界ちょうど（10px）はタブドロップになる', () => {
      const tabPositions = createTabPositions();
      // タブ1（0-40px）の上端25%境界 = 10px
      const result = calculateDropTarget(10, tabPositions);

      expect(result.type).toBe(DropTargetType.Tab);
      expect(result.targetNodeId).toBe('node-1');
    });

    it('タブの上端25%境界より少し上（9px）は隙間ドロップになる', () => {
      const tabPositions = createTabPositions();
      const result = calculateDropTarget(9, tabPositions);

      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBe(0);
    });

    it('タブの下端25%境界ちょうど手前（30px）はタブドロップになる', () => {
      const tabPositions = createTabPositions();
      // タブ1（0-40px）の下端25%境界 = 40 - 10 = 30px
      // 29pxは中央領域の最後
      const result = calculateDropTarget(29, tabPositions);

      expect(result.type).toBe(DropTargetType.Tab);
      expect(result.targetNodeId).toBe('node-1');
    });

    it('タブの下端25%境界ちょうど（30px）は隙間ドロップになる', () => {
      const tabPositions = createTabPositions();
      // 30pxは下部25%領域の開始
      const result = calculateDropTarget(30, tabPositions);

      expect(result.type).toBe(DropTargetType.Gap);
      expect(result.gapIndex).toBe(1);
    });
  });
});
