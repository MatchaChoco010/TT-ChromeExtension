/**
 * タブの隙間へのドロップ時に、選択可能なdepthの範囲を計算する。
 * 他のタブの親子関係を壊さない範囲でのみdepthを変更可能。
 *
 * @param aboveDepth - 上のノードのdepth（上にノードがなければundefined）
 * @param belowDepth - 下のノードのdepth（下にノードがなければundefined）
 * @returns minDepth（最小depth）とmaxDepth（最大depth）
 */
export function calculateDepthRange(
  aboveDepth: number | undefined,
  belowDepth: number | undefined
): { minDepth: number; maxDepth: number } {
  const maxDepth = (aboveDepth ?? -1) + 1;
  const minDepth = belowDepth ?? 0;

  // 論理的には起こり得ないが、安全のため
  if (minDepth > maxDepth) {
    return { minDepth: maxDepth, maxDepth };
  }

  return { minDepth, maxDepth };
}
