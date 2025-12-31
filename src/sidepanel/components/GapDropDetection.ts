/**
 * Task 4.3: タブとタブ間の隙間ドロップ判定ユーティリティ
 * Requirements: 7.1 (タブハイライト), 7.2 (隙間インジケーター), 7.3 (当たり判定)
 *
 * ドラッグ中のマウスY座標からドロップ先がタブ上か隙間上かを判定し、
 * 適切なビジュアルフィードバックを表示するための情報を提供する
 */

/**
 * ドロップターゲットの種類
 */
export enum DropTargetType {
  /** タブ上へのドロップ（子として配置） */
  Tab = 'tab',
  /** タブ間の隙間へのドロップ（兄弟として配置） */
  Gap = 'gap',
  /** 水平方向のタブ間の隙間へのドロップ（ピン留めタブ用） */
  HorizontalGap = 'horizontal_gap',
  /** ドロップ不可 */
  None = 'none',
}

/**
 * タブノードの位置情報
 */
export interface TabPosition {
  /** ノードID */
  nodeId: string;
  /** タブの上端Y座標（コンテナ相対） */
  top: number;
  /** タブの下端Y座標（コンテナ相対） */
  bottom: number;
  /** タブの階層深度 */
  depth: number;
}

/**
 * 隣接ノードのdepth情報
 */
export interface AdjacentDepths {
  /** 上のノードのdepth（存在しない場合はundefined） */
  above: number | undefined;
  /** 下のノードのdepth（存在しない場合はundefined） */
  below: number | undefined;
}

/**
 * ドロップターゲット情報
 */
export interface DropTarget {
  /** ドロップターゲットの種類 */
  type: DropTargetType;
  /** タブターゲットの場合のノードID */
  targetNodeId?: string;
  /** 隙間ターゲットの場合のインデックス（0=最初のタブの上、1=タブ1とタブ2の間、...） */
  gapIndex?: number;
  /** 隙間ターゲットの場合の隣接ノードdepth情報 */
  adjacentDepths?: AdjacentDepths;
  /** 水平ドロップの場合の挿入インデックス（ピン留めタブ用） */
  insertIndex?: number;
}

/**
 * Task 7.1: コンテナ境界情報
 * プレースホルダー表示をコンテナ境界内に制限するために使用
 */
export interface ContainerBounds {
  /** コンテナの最小Y座標（コンテナ相対） */
  minY: number;
  /** コンテナの最大Y座標（コンテナ相対） */
  maxY: number;
}

/**
 * デフォルトの隙間判定領域比率
 * タブの高さに対して上下この割合の領域は隙間判定となる
 */
const DEFAULT_GAP_THRESHOLD_RATIO = 0.25;

/**
 * ドロップターゲットを計算する
 *
 * @param mouseY - マウスのY座標（コンテナ相対）
 * @param tabPositions - タブノードの位置情報配列（上から順）
 * @param gapThresholdRatio - 隙間判定領域の比率（デフォルト: 0.25）
 * @param containerBounds - Task 7.1: コンテナ境界情報（オプション）。指定された場合、境界外ではNoneを返す
 * @returns ドロップターゲット情報
 */
export function calculateDropTarget(
  mouseY: number,
  tabPositions: TabPosition[],
  gapThresholdRatio: number = DEFAULT_GAP_THRESHOLD_RATIO,
  containerBounds?: ContainerBounds
): DropTarget {
  // タブリストが空の場合
  if (tabPositions.length === 0) {
    return { type: DropTargetType.None };
  }

  // Task 7.1: コンテナ境界チェック
  // 境界が指定されている場合、マウスがコンテナ外にある場合はNoneを返す
  if (containerBounds) {
    if (mouseY < containerBounds.minY || mouseY > containerBounds.maxY) {
      return { type: DropTargetType.None };
    }
  }

  // Y座標が最初のタブより上の場合
  const firstTab = tabPositions[0];
  if (mouseY < firstTab.top) {
    return {
      type: DropTargetType.Gap,
      gapIndex: 0,
      adjacentDepths: {
        above: undefined,
        below: firstTab.depth,
      },
    };
  }

  // Y座標が最後のタブより下の場合
  const lastTab = tabPositions[tabPositions.length - 1];
  if (mouseY >= lastTab.bottom) {
    return {
      type: DropTargetType.Gap,
      gapIndex: tabPositions.length,
      adjacentDepths: {
        above: lastTab.depth,
        below: undefined,
      },
    };
  }

  // 各タブを検索
  for (let i = 0; i < tabPositions.length; i++) {
    const tab = tabPositions[i];
    const tabHeight = tab.bottom - tab.top;
    const gapThreshold = tabHeight * gapThresholdRatio;

    // タブの範囲内かチェック
    if (mouseY >= tab.top && mouseY < tab.bottom) {
      // タブ内での相対位置
      const relativeY = mouseY - tab.top;

      // 上端の隙間領域
      if (relativeY < gapThreshold) {
        const aboveTab = i > 0 ? tabPositions[i - 1] : undefined;
        return {
          type: DropTargetType.Gap,
          gapIndex: i,
          adjacentDepths: {
            above: aboveTab?.depth,
            below: tab.depth,
          },
        };
      }

      // 下端の隙間領域
      if (relativeY >= tabHeight - gapThreshold) {
        const belowTab = i < tabPositions.length - 1 ? tabPositions[i + 1] : undefined;
        return {
          type: DropTargetType.Gap,
          gapIndex: i + 1,
          adjacentDepths: {
            above: tab.depth,
            below: belowTab?.depth,
          },
        };
      }

      // 中央領域（タブドロップ）
      return {
        type: DropTargetType.Tab,
        targetNodeId: tab.nodeId,
      };
    }
  }

  // ここには到達しないはずだが、安全のため
  return { type: DropTargetType.None };
}

/**
 * タブの高さからドロップインジケーターのY座標を計算する
 *
 * @param gapIndex - 隙間のインデックス
 * @param tabPositions - タブノードの位置情報配列
 * @returns ドロップインジケーターのY座標
 */
export function calculateIndicatorY(
  gapIndex: number,
  tabPositions: TabPosition[]
): number {
  if (tabPositions.length === 0) {
    return 0;
  }

  // 最初の隙間（最初のタブの上）
  if (gapIndex === 0) {
    return tabPositions[0].top;
  }

  // 最後の隙間（最後のタブの下）
  if (gapIndex >= tabPositions.length) {
    return tabPositions[tabPositions.length - 1].bottom;
  }

  // タブ間の隙間
  // 上のタブの下端と下のタブの上端の中間
  const aboveTab = tabPositions[gapIndex - 1];
  const belowTab = tabPositions[gapIndex];
  return (aboveTab.bottom + belowTab.top) / 2;
}

/**
 * Task 10.1: 水平方向のタブ位置情報（ピン留めタブ用）
 */
export interface HorizontalTabPosition {
  /** ノードID */
  nodeId: string;
  /** タブの左端X座標（コンテナ相対） */
  left: number;
  /** タブの右端X座標（コンテナ相対） */
  right: number;
  /** タブのインデックス */
  index: number;
}

/**
 * Task 10.1: 水平方向のドロップターゲットを計算する（ピン留めタブ用）
 *
 * @param mouseX - マウスのX座標（コンテナ相対）
 * @param tabPositions - タブノードの水平位置情報配列（左から順）
 * @returns ドロップターゲット情報
 */
export function calculateHorizontalDropTarget(
  mouseX: number,
  tabPositions: HorizontalTabPosition[]
): DropTarget {
  // タブリストが空の場合
  if (tabPositions.length === 0) {
    return { type: DropTargetType.None };
  }

  // X座標が最初のタブより左の場合
  const firstTab = tabPositions[0];
  if (mouseX < firstTab.left) {
    return {
      type: DropTargetType.HorizontalGap,
      insertIndex: 0,
    };
  }

  // X座標が最後のタブより右の場合
  const lastTab = tabPositions[tabPositions.length - 1];
  if (mouseX >= lastTab.right) {
    return {
      type: DropTargetType.HorizontalGap,
      insertIndex: tabPositions.length,
    };
  }

  // 各タブを検索して挿入位置を決定
  for (let i = 0; i < tabPositions.length; i++) {
    const tab = tabPositions[i];
    const tabWidth = tab.right - tab.left;
    const tabCenter = tab.left + tabWidth / 2;

    // タブの範囲内かチェック
    if (mouseX >= tab.left && mouseX < tab.right) {
      // タブの中心より左なら、このタブの前に挿入
      if (mouseX < tabCenter) {
        return {
          type: DropTargetType.HorizontalGap,
          insertIndex: i,
        };
      }
      // タブの中心より右なら、このタブの後に挿入
      return {
        type: DropTargetType.HorizontalGap,
        insertIndex: i + 1,
      };
    }
  }

  // ここには到達しないはずだが、安全のため
  return { type: DropTargetType.None };
}

/**
 * Task 10.1: 水平方向のドロップインジケーターのX座標を計算する
 *
 * @param insertIndex - 挿入インデックス
 * @param tabPositions - タブノードの水平位置情報配列
 * @returns ドロップインジケーターのX座標
 */
export function calculateHorizontalIndicatorX(
  insertIndex: number,
  tabPositions: HorizontalTabPosition[]
): number {
  if (tabPositions.length === 0) {
    return 0;
  }

  // 先頭に挿入
  if (insertIndex === 0) {
    return tabPositions[0].left;
  }

  // 末尾に挿入
  if (insertIndex >= tabPositions.length) {
    return tabPositions[tabPositions.length - 1].right;
  }

  // タブ間に挿入
  const leftTab = tabPositions[insertIndex - 1];
  const rightTab = tabPositions[insertIndex];
  return (leftTab.right + rightTab.left) / 2;
}
