/**
 * マウスX座標からドロップ先のdepthを計算する
 *
 * @param mouseX - マウスの現在X座標（ビューポート基準）
 * @param containerLeft - ツリービューコンテナの左端X座標
 * @param indentWidth - 1段階のインデント幅（ピクセル）
 * @param maxDepth - 許容される最大depth（隣接ノードのdepth+1まで）
 * @returns 計算されたtargetDepth（0からmaxDepthの間）
 */
export const calculateTargetDepth = (
  mouseX: number,
  containerLeft: number,
  indentWidth: number,
  maxDepth: number
): number => {
  if (indentWidth <= 0) {
    return 0;
  }

  if (maxDepth < 0) {
    return 0;
  }

  const relativeX = mouseX - containerLeft;

  if (relativeX < 0) {
    return 0;
  }

  const calculatedDepth = Math.floor(relativeX / indentWidth);

  return Math.max(0, Math.min(calculatedDepth, maxDepth));
};
