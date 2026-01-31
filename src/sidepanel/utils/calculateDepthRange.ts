/**
 * depth範囲を計算するユーティリティ
 *
 * タブの隙間へのドロップ時に、選択可能なdepthの範囲を計算する。
 * 他のタブの親子関係を壊さない範囲でのみdepthを変更可能。
 *
 * @param aboveDepth - 上のノードのdepth（上にノードがなければundefined）
 * @param belowDepth - 下のノードのdepth（下にノードがなければundefined）
 * @returns minDepth（最小depth）とmaxDepth（最大depth）
 *
 * ルール:
 * - maxDepth: (aboveDepth ?? -1) + 1
 *   - 上のノードのdepth + 1が最大値（そのノードの子として配置）
 *   - 上にノードがなければ maxDepth = 0
 * - minDepth: belowDepth ?? 0
 *   - 下のノードのdepthが最小値（これより小さいと下のノードの親が壊れる）
 *   - 下にノードがなければ minDepth = 0
 */
export function calculateDepthRange(
  aboveDepth: number | undefined,
  belowDepth: number | undefined
): { minDepth: number; maxDepth: number } {
  const maxDepth = (aboveDepth ?? -1) + 1;
  const minDepth = belowDepth ?? 0;

  // minDepth > maxDepth となる場合（論理的には起こり得ないが、安全のため）
  // minDepthをmaxDepthに合わせる
  if (minDepth > maxDepth) {
    return { minDepth: maxDepth, maxDepth };
  }

  return { minDepth, maxDepth };
}
