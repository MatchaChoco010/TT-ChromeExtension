import { describe, it, expect } from 'vitest';
import { calculateTabsToMove } from './minimal-tab-moves';

describe('calculateTabsToMove', () => {
  it('既に目標の順序なら何も動かさない', () => {
    expect(calculateTabsToMove([1, 2, 3, 4], [1, 2, 3, 4])).toEqual(new Set());
  });

  it('1つのタブだけがずれている場合は、そのタブだけを動かす', () => {
    expect(calculateTabsToMove([4, 1, 2, 3], [1, 2, 3, 4])).toEqual(new Set([4]));
  });

  it('逆順の場合は、最長の増加部分列以外をすべて動かす', () => {
    expect(calculateTabsToMove([3, 2, 1], [1, 2, 3]).size).toBe(2);
  });

  it('現在の並びにないタブは移動対象に含めない', () => {
    const tabsToMove = calculateTabsToMove([2, 1], [1, 2, 99]);

    expect(tabsToMove.size).toBe(1);
    expect(tabsToMove.has(99)).toBe(false);
  });

  it('目標が空なら何も動かさない', () => {
    expect(calculateTabsToMove([1, 2], [])).toEqual(new Set());
  });
});
