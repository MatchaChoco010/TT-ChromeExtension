/**
 * ドラッグ中のdepth計算ロジック
 *
 * マウスX座標からドロップ先のdepthを計算するユーティリティ関数
 */

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
  // エッジケース: インデント幅が0以下の場合は0を返す
  if (indentWidth <= 0) {
    return 0;
  }

  // エッジケース: maxDepthが負の場合は0を返す
  if (maxDepth < 0) {
    return 0;
  }

  // コンテナ左端からの相対X座標を計算
  const relativeX = mouseX - containerLeft;

  // 負の座標（コンテナ左端より左）の場合はdepth=0
  if (relativeX < 0) {
    return 0;
  }

  // X座標からdepthを計算（floor関数で切り捨て）
  const calculatedDepth = Math.floor(relativeX / indentWidth);

  // depth範囲を0からmaxDepthの間に制限
  return Math.max(0, Math.min(calculatedDepth, maxDepth));
};
