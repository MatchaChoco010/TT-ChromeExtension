/**
 * タブの並びを目標の順序にするために動かす必要があるタブの計算
 */

/**
 * 配列からLongest Increasing Subsequence (LIS)を計算
 * O(n log n)のpatience sortingアルゴリズムを使用
 * @returns LISに含まれる要素のインデックス集合
 */
function findLongestIncreasingSubsequence(arr: number[]): Set<number> {
  if (arr.length === 0) return new Set();

  const tails: number[] = [];
  const prev: number[] = new Array(arr.length).fill(-1);
  const tailIndices: number[] = [];

  for (let i = 0; i < arr.length; i++) {
    const val = arr[i];
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (arr[tailIndices[mid]] < val) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    if (lo > 0) {
      prev[i] = tailIndices[lo - 1];
    }
    if (lo === tails.length) {
      tails.push(val);
      tailIndices.push(i);
    } else {
      tails[lo] = val;
      tailIndices[lo] = i;
    }
  }

  const lisIndices = new Set<number>();
  let idx = tailIndices[tailIndices.length - 1];
  while (idx !== -1) {
    lisIndices.add(idx);
    idx = prev[idx];
  }
  return lisIndices;
}

/**
 * 現在の順序から目標順序への最小移動タブセットを計算
 * LISを使用して移動不要なタブを特定
 */
export function calculateTabsToMove(
  currentOrder: number[],
  targetOrder: number[]
): Set<number> {
  if (targetOrder.length === 0) return new Set();

  const currentPositionMap = new Map<number, number>();
  for (let i = 0; i < currentOrder.length; i++) {
    currentPositionMap.set(currentOrder[i], i);
  }

  const positionsInCurrent: number[] = [];
  const validTargetOrder: number[] = [];
  for (const tabId of targetOrder) {
    const pos = currentPositionMap.get(tabId);
    if (pos !== undefined) {
      positionsInCurrent.push(pos);
      validTargetOrder.push(tabId);
    }
  }

  const lisIndices = findLongestIncreasingSubsequence(positionsInCurrent);

  const tabsToMove = new Set<number>();
  for (let i = 0; i < validTargetOrder.length; i++) {
    if (!lisIndices.has(i)) {
      tabsToMove.add(validTargetOrder[i]);
    }
  }
  return tabsToMove;
}
