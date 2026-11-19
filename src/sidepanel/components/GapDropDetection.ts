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
 * 隣接ノードのID情報
 * プレースホルダー表示位置の計算に使用
 */
export interface AdjacentNodeIds {
  /** 上のノードのID（存在しない場合はundefined） */
  aboveNodeId: string | undefined;
  /** 下のノードのID（存在しない場合はundefined） */
  belowNodeId: string | undefined;
}

/**
 * 水平・グリッドドロップ時のインジケーター表示位置（コンテナ相対）
 */
export interface HorizontalIndicatorPosition {
  /** インジケーターのX座標（px） */
  left: number;
  /** インジケーターの上端Y座標（px） */
  top?: number;
  /** インジケーターの高さ（px） */
  height?: number;
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
  /** 隙間ターゲットの場合の隣接ノードID情報 */
  adjacentNodeIds?: AdjacentNodeIds;
  /** 水平ドロップの場合の挿入インデックス（ピン留めタブ用） */
  insertIndex?: number;
  /** 水平・グリッドドロップの場合のインジケーター表示位置 */
  indicatorPosition?: HorizontalIndicatorPosition;
}

/**
 * コンテナ境界情報
 * プレースホルダー表示をコンテナ境界内に制限するために使用
 */
export interface ContainerBounds {
  /** コンテナの最小Y座標（コンテナ相対） */
  minY: number;
  /** コンテナの最大Y座標（コンテナ相対） */
  maxY: number;
}

/**
 * ドロップターゲット計算オプション
 * サブツリーサイズを考慮したドロップ位置計算のためのオプション
 */
export interface DropTargetOptions {
  /** 隙間判定領域の比率（デフォルト: 0.25） */
  gapThresholdRatio?: number;
  /** コンテナ境界情報（オプション） */
  containerBounds?: ContainerBounds;
  /** ドラッグ中のノードID（このノードとサブツリーをgapIndex計算から除外） */
  draggedNodeId?: string;
  /**
   * ノードIDからそのサブツリー全体のノードIDを取得するコールバック
   * draggedNodeIdが指定された場合に必要
   */
  getSubtreeNodeIds?: (nodeId: string) => string[];
}

/**
 * デフォルトの隙間判定領域比率
 * タブの高さに対して上下この割合の領域は隙間判定となる
 */
const DEFAULT_GAP_THRESHOLD_RATIO = 0.25;

/**
 * 元のtabPositionsでマウスY座標に対応する隣接ノードIDを計算する
 * ドラッグ中のサブツリーを考慮して、プレースホルダーの表示位置を正確に計算する
 *
 * @param mouseY - マウスのY座標（コンテナ相対）
 * @param tabPositions - 元のタブノードの位置情報配列（ドラッグ中ノード含む）
 * @param gapThresholdRatio - 隙間判定領域の比率
 * @returns 隣接ノードID情報
 */
function calculateAdjacentNodeIdsFromOriginal(
  mouseY: number,
  tabPositions: TabPosition[],
  gapThresholdRatio: number
): AdjacentNodeIds {
  if (tabPositions.length === 0) {
    return { aboveNodeId: undefined, belowNodeId: undefined };
  }

  const firstTab = tabPositions[0];
  if (mouseY < firstTab.top) {
    return { aboveNodeId: undefined, belowNodeId: firstTab.nodeId };
  }

  const lastTab = tabPositions[tabPositions.length - 1];
  if (mouseY >= lastTab.bottom) {
    return { aboveNodeId: lastTab.nodeId, belowNodeId: undefined };
  }

  for (let i = 0; i < tabPositions.length; i++) {
    const tab = tabPositions[i];
    const tabHeight = tab.bottom - tab.top;
    const gapThreshold = tabHeight * gapThresholdRatio;

    if (mouseY >= tab.top && mouseY < tab.bottom) {
      const relativeY = mouseY - tab.top;

      if (relativeY < gapThreshold) {
        const aboveTab = i > 0 ? tabPositions[i - 1] : undefined;
        return {
          aboveNodeId: aboveTab?.nodeId,
          belowNodeId: tab.nodeId,
        };
      }

      if (relativeY >= tabHeight - gapThreshold) {
        const belowTab = i < tabPositions.length - 1 ? tabPositions[i + 1] : undefined;
        return {
          aboveNodeId: tab.nodeId,
          belowNodeId: belowTab?.nodeId,
        };
      }

      const aboveTab = i > 0 ? tabPositions[i - 1] : undefined;
      const belowTab = i < tabPositions.length - 1 ? tabPositions[i + 1] : undefined;
      return {
        aboveNodeId: aboveTab?.nodeId,
        belowNodeId: belowTab?.nodeId,
      };
    }
  }

  for (let i = 0; i < tabPositions.length - 1; i++) {
    const currentTab = tabPositions[i];
    const nextTab = tabPositions[i + 1];

    if (mouseY >= currentTab.bottom && mouseY < nextTab.top) {
      return {
        aboveNodeId: currentTab.nodeId,
        belowNodeId: nextTab.nodeId,
      };
    }
  }

  return { aboveNodeId: undefined, belowNodeId: undefined };
}

/**
 * ドロップターゲットを計算する
 *
 * @param mouseY - マウスのY座標（コンテナ相対）
 * @param tabPositions - タブノードの位置情報配列（上から順）
 * @param gapThresholdRatioOrOptions - 隙間判定領域の比率（デフォルト: 0.25）またはオプションオブジェクト
 * @param containerBounds - コンテナ境界情報（オプション）。指定された場合、境界外ではNoneを返す
 * @returns ドロップターゲット情報
 */
export function calculateDropTarget(
  mouseY: number,
  tabPositions: TabPosition[],
  gapThresholdRatioOrOptions: number | DropTargetOptions = DEFAULT_GAP_THRESHOLD_RATIO,
  containerBounds?: ContainerBounds
): DropTarget {
  let gapThresholdRatio: number;
  let bounds: ContainerBounds | undefined;
  let draggedNodeId: string | undefined;
  let getSubtreeNodeIds: ((nodeId: string) => string[]) | undefined;

  if (typeof gapThresholdRatioOrOptions === 'object') {
    gapThresholdRatio = gapThresholdRatioOrOptions.gapThresholdRatio ?? DEFAULT_GAP_THRESHOLD_RATIO;
    bounds = gapThresholdRatioOrOptions.containerBounds;
    draggedNodeId = gapThresholdRatioOrOptions.draggedNodeId;
    getSubtreeNodeIds = gapThresholdRatioOrOptions.getSubtreeNodeIds;
  } else {
    gapThresholdRatio = gapThresholdRatioOrOptions;
    bounds = containerBounds;
  }

  let effectiveTabPositions = tabPositions;
  let draggedSubtreeNodeIds: Set<string> | undefined;

  if (draggedNodeId && getSubtreeNodeIds) {
    const subtreeIds = getSubtreeNodeIds(draggedNodeId);
    draggedSubtreeNodeIds = new Set(subtreeIds);
    effectiveTabPositions = tabPositions.filter(pos => !draggedSubtreeNodeIds!.has(pos.nodeId));
  }

  if (effectiveTabPositions.length === 0) {
    return { type: DropTargetType.None };
  }

  if (bounds) {
    if (mouseY < bounds.minY || mouseY > bounds.maxY) {
      return { type: DropTargetType.None };
    }
  }

  const originalAdjacentNodeIds = calculateAdjacentNodeIdsFromOriginal(
    mouseY,
    tabPositions,
    gapThresholdRatio
  );

  const firstTab = effectiveTabPositions[0];
  if (mouseY < firstTab.top) {
    const originalFirstTab = tabPositions[0];
    return {
      type: DropTargetType.Gap,
      gapIndex: 0,
      adjacentDepths: {
        above: undefined,
        below: originalFirstTab.depth,
      },
      adjacentNodeIds: originalAdjacentNodeIds,
    };
  }

  const lastTab = effectiveTabPositions[effectiveTabPositions.length - 1];
  if (mouseY >= lastTab.bottom) {
    const originalLastTab = tabPositions[tabPositions.length - 1];
    return {
      type: DropTargetType.Gap,
      gapIndex: effectiveTabPositions.length,
      adjacentDepths: {
        above: originalLastTab.depth,
        below: undefined,
      },
      adjacentNodeIds: originalAdjacentNodeIds,
    };
  }

  for (let i = 0; i < effectiveTabPositions.length; i++) {
    const tab = effectiveTabPositions[i];
    const tabHeight = tab.bottom - tab.top;
    const gapThreshold = tabHeight * gapThresholdRatio;

    if (mouseY >= tab.top && mouseY < tab.bottom) {
      const relativeY = mouseY - tab.top;

      if (relativeY < gapThreshold) {
        const aboveTab = i > 0 ? effectiveTabPositions[i - 1] : undefined;
        return {
          type: DropTargetType.Gap,
          gapIndex: i,
          adjacentDepths: {
            above: aboveTab?.depth,
            below: tab.depth,
          },
          adjacentNodeIds: originalAdjacentNodeIds,
        };
      }

      if (relativeY >= tabHeight - gapThreshold) {
        const belowTab = i < effectiveTabPositions.length - 1 ? effectiveTabPositions[i + 1] : undefined;
        return {
          type: DropTargetType.Gap,
          gapIndex: i + 1,
          adjacentDepths: {
            above: tab.depth,
            below: belowTab?.depth,
          },
          adjacentNodeIds: originalAdjacentNodeIds,
        };
      }

      return {
        type: DropTargetType.Tab,
        targetNodeId: tab.nodeId,
      };
    }
  }

  return { type: DropTargetType.None };
}

/**
 * ノードIDを使ってドロップインジケーターのY座標を計算する
 * ドラッグ中のノードを含む元のtabPositionsを使用することで、
 * プレースホルダーが正しい視覚的位置に表示される
 *
 * @param aboveNodeId - 上のノードのID（先頭の場合はundefined）
 * @param belowNodeId - 下のノードのID（末尾の場合はundefined）
 * @param tabPositions - 元のタブノードの位置情報配列（ドラッグ中ノード含む）
 * @returns ドロップインジケーターのY座標
 */
export function calculateIndicatorYByNodeIds(
  aboveNodeId: string | undefined,
  belowNodeId: string | undefined,
  tabPositions: TabPosition[]
): number {
  if (tabPositions.length === 0) {
    return 0;
  }

  const aboveTab = aboveNodeId
    ? tabPositions.find(t => t.nodeId === aboveNodeId)
    : undefined;
  const belowTab = belowNodeId
    ? tabPositions.find(t => t.nodeId === belowNodeId)
    : undefined;

  if (!aboveTab && belowTab) {
    return belowTab.top;
  }

  if (aboveTab && !belowTab) {
    return aboveTab.bottom;
  }

  if (aboveTab && belowTab) {
    return (aboveTab.bottom + belowTab.top) / 2;
  }

  return 0;
}

/**
 * 水平方向のタブ位置情報（ピン留めタブ用）
 */
export interface HorizontalTabPosition {
  /** ノードID */
  nodeId: string;
  /** タブの左端X座標（コンテナ相対） */
  left: number;
  /** タブの右端X座標（コンテナ相対） */
  right: number;
  /** タブの上端Y座標（コンテナ相対、複数行レイアウト時に使用） */
  top?: number;
  /** タブの下端Y座標（コンテナ相対、複数行レイアウト時に使用） */
  bottom?: number;
  /** タブのインデックス */
  index: number;
}

interface HorizontalTabRow {
  top: number;
  bottom: number;
  tabs: HorizontalTabPosition[];
}

function hasVerticalBounds(tabPositions: HorizontalTabPosition[]): boolean {
  return tabPositions.every(
    (tab) => tab.top !== undefined && tab.bottom !== undefined && tab.bottom > tab.top
  );
}

function groupTabsIntoRows(
  tabPositions: HorizontalTabPosition[],
  useVerticalBounds: boolean
): HorizontalTabRow[] {
  if (!useVerticalBounds) {
    return [{ top: 0, bottom: 0, tabs: tabPositions }];
  }

  const rows: HorizontalTabRow[] = [];

  for (const tab of tabPositions) {
    const top = tab.top!;
    const bottom = tab.bottom!;
    const centerY = (top + bottom) / 2;
    const lastRow = rows[rows.length - 1];

    if (lastRow && centerY >= lastRow.top && centerY <= lastRow.bottom) {
      lastRow.tabs.push(tab);
      lastRow.top = Math.min(lastRow.top, top);
      lastRow.bottom = Math.max(lastRow.bottom, bottom);
    } else {
      rows.push({ top, bottom, tabs: [tab] });
    }
  }

  return rows;
}

function findTargetRow(rows: HorizontalTabRow[], mouseY: number | undefined): HorizontalTabRow {
  if (rows.length === 1 || mouseY === undefined) {
    return rows[0];
  }

  if (mouseY < rows[0].top) {
    return rows[0];
  }

  const lastRow = rows[rows.length - 1];
  if (mouseY >= lastRow.bottom) {
    return lastRow;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (mouseY >= row.top && mouseY < row.bottom) {
      return row;
    }

    if (i < rows.length - 1) {
      const nextRow = rows[i + 1];
      if (mouseY >= row.bottom && mouseY < nextRow.top) {
        const midY = (row.bottom + nextRow.top) / 2;
        return mouseY < midY ? row : nextRow;
      }
    }
  }

  let closestRow = rows[0];
  let minDistance = Infinity;
  for (const row of rows) {
    const rowCenterY = (row.top + row.bottom) / 2;
    const distance = Math.abs(mouseY - rowCenterY);
    if (distance < minDistance) {
      minDistance = distance;
      closestRow = row;
    }
  }
  return closestRow;
}

function estimateHorizontalGap(targetRow: HorizontalTabRow, rows: HorizontalTabRow[]): number {
  if (targetRow.tabs.length >= 2) {
    return Math.max(0, targetRow.tabs[1].left - targetRow.tabs[0].right);
  }

  for (const row of rows) {
    if (row.tabs.length >= 2) {
      return Math.max(0, row.tabs[1].left - row.tabs[0].right);
    }
  }

  return 0;
}

/**
 * 水平方向（単一行および複数行折り返し）のドロップターゲットを計算する
 *
 * @param mouseX - マウスのX座標（コンテナ相対）
 * @param tabPositions - タブノードの位置情報配列（DOM順）
 * @param mouseY - マウスのY座標（コンテナ相対、複数行レイアウト時に指定）
 * @returns ドロップターゲット情報
 */
export function calculateHorizontalDropTarget(
  mouseX: number,
  tabPositions: HorizontalTabPosition[],
  mouseY?: number
): DropTarget {
  if (tabPositions.length === 0) {
    return { type: DropTargetType.None };
  }

  const useVerticalBounds = hasVerticalBounds(tabPositions);
  const rows = groupTabsIntoRows(tabPositions, useVerticalBounds);
  const targetRow = findTargetRow(rows, useVerticalBounds ? mouseY : undefined);
  const rowTabs = targetRow.tabs;
  const gap = estimateHorizontalGap(targetRow, rows);

  const verticalIndicator = useVerticalBounds
    ? { top: targetRow.top, height: targetRow.bottom - targetRow.top }
    : {};

  const firstTab = rowTabs[0];
  const firstCenter = (firstTab.left + firstTab.right) / 2;
  if (mouseX < firstCenter) {
    return {
      type: DropTargetType.HorizontalGap,
      insertIndex: firstTab.index,
      indicatorPosition: {
        left: Math.max(0, firstTab.left - gap / 2),
        ...verticalIndicator,
      },
    };
  }

  for (let i = 0; i < rowTabs.length - 1; i++) {
    const currentTab = rowTabs[i];
    const nextTab = rowTabs[i + 1];
    const nextCenter = (nextTab.left + nextTab.right) / 2;

    if (mouseX < nextCenter) {
      return {
        type: DropTargetType.HorizontalGap,
        insertIndex: currentTab.index + 1,
        indicatorPosition: {
          left: (currentTab.right + nextTab.left) / 2,
          ...verticalIndicator,
        },
      };
    }
  }

  const lastTab = rowTabs[rowTabs.length - 1];
  return {
    type: DropTargetType.HorizontalGap,
    insertIndex: lastTab.index + 1,
    indicatorPosition: {
      left: lastTab.right + gap / 2,
      ...verticalIndicator,
    },
  };
}

/**
 * 水平方向のドロップインジケーターのX座標を計算する
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

  if (insertIndex === 0) {
    return tabPositions[0].left;
  }

  if (insertIndex >= tabPositions.length) {
    return tabPositions[tabPositions.length - 1].right;
  }

  const leftTab = tabPositions[insertIndex - 1];
  const rightTab = tabPositions[insertIndex];
  return (leftTab.right + rightTab.left) / 2;
}
