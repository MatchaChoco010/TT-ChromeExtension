/**
 * 自前ドラッグ&ドロップフック
 *
 * mousedown/mousemove/mouseupイベントでドラッグ操作を処理
 * 8px移動検知によるドラッグ開始（誤操作防止）
 * ドラッグ中の要素をマウスカーソルに追従
 * GapDropDetection.tsのロジックを流用してドロップ位置を計算
 * クロスウィンドウでのドラッグ状態継続を可能に
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import {
  calculateDropTarget,
  calculateHorizontalDropTarget,
  type DropTarget,
  type TabPosition,
  type HorizontalTabPosition,
  type DropTargetOptions,
  DropTargetType,
} from '../components/GapDropDetection';

// Re-export DropTarget for external use
export { type DropTarget, DropTargetType };

/**
 * ドラッグ状態
 */
export interface DragState {
  /** ドラッグ中かどうか */
  isDragging: boolean;
  /** ドラッグ準備中（mousedownからドラッグ開始までの間） */
  isPotentialDrag: boolean;
  /** ドラッグ中のアイテムID（タブID or グループID） */
  draggedItemId: string | null;
  /** ドラッグ中のタブID（実際のchrome.tabs.Tab.id） */
  draggedTabId: number | null;
  /** ドラッグ開始位置（スクリーン座標） */
  startPosition: { x: number; y: number };
  /** 現在のマウス位置（スクリーン座標） */
  currentPosition: { x: number; y: number };
  /** ドラッグ開始からの移動量 */
  delta: { x: number; y: number };
  /** 現在のドロップターゲット */
  dropTarget: DropTarget | null;
  /** ドラッグ中の要素のオフセット（要素内でのクリック位置） */
  offset: { x: number; y: number };
}

/**
 * useDragDropフックのオプション
 */
export interface UseDragDropOptions {
  /** ドラッグ開始までの移動距離（デフォルト: 8px） */
  activationDistance?: number;
  /** ドラッグ方向（vertical: 縦方向、horizontal: 横方向） */
  direction?: 'vertical' | 'horizontal';
  /** コンテナ要素のref */
  containerRef: React.RefObject<HTMLElement | null>;
  /** アイテムリスト（ドロップ位置計算用） */
  items: Array<{ id: string; tabId: number }>;
  /** ドラッグ開始コールバック */
  onDragStart?: (itemId: string, tabId: number) => void;
  /** ドラッグ移動コールバック */
  onDragMove?: (position: { x: number; y: number }, dropTarget: DropTarget | null) => void;
  /** ドラッグ終了コールバック */
  onDragEnd?: (itemId: string, dropTarget: DropTarget | null) => void;
  /** ドラッグキャンセルコールバック */
  onDragCancel?: () => void;
  /** 外部ドロップ（ツリー外へのドラッグ）コールバック */
  onExternalDrop?: (tabId: number) => void;
  /**
   * 外部ドロップ判定用の境界参照
   * ドラッグアウト判定はサイドパネル全体の境界を基準にする
   * 指定されていない場合はcontainerRefを使用（後方互換性維持）
   */
  dragOutBoundaryRef?: React.RefObject<HTMLElement | null>;
  /**
   * サブツリーノードID取得コールバック
   * 下方向へのドラッグ時、サブツリーサイズを考慮したインデックス調整
   * ドラッグ中のノードIDからそのサブツリー全体のノードIDを取得する
   */
  getSubtreeNodeIds?: (nodeId: string) => string[];
}

/**
 * useDragDropフックの戻り値
 */
export interface UseDragDropReturn {
  /** 現在のドラッグ状態 */
  dragState: DragState;
  /** アイテムに適用するprops（マウス操作のみ、タッチはスコープ外） */
  getItemProps: (itemId: string, tabId: number) => {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    'data-dragging': boolean;
  };
  /** ドラッグ中の要素のスタイル（transform含む） */
  getDragOverlayStyle: () => React.CSSProperties | null;
  /** プログラマティックにドラッグを開始（クロスウィンドウ用） */
  startDragProgrammatically: (itemId: string, tabId: number, position: { x: number; y: number }) => void;
  /** ドラッグをキャンセル */
  cancelDrag: () => void;
}

// 初期ドラッグ状態
const initialDragState: DragState = {
  isDragging: false,
  isPotentialDrag: false,
  draggedItemId: null,
  draggedTabId: null,
  startPosition: { x: 0, y: 0 },
  currentPosition: { x: 0, y: 0 },
  delta: { x: 0, y: 0 },
  dropTarget: null,
  offset: { x: 0, y: 0 },
};

/**
 * 自前ドラッグ&ドロップフック
 *
 * dnd-kitを置き換え、mousedown/mousemove/mouseupイベントで
 * ドラッグ操作を処理する。8px移動検知で誤操作を防止。
 */
export function useDragDrop(options: UseDragDropOptions): UseDragDropReturn {
  const {
    activationDistance = 8,
    direction = 'vertical',
    containerRef,
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
    onExternalDrop,
    // 外部ドロップ判定用の境界参照
    dragOutBoundaryRef,
    // サブツリーノードID取得コールバック
    getSubtreeNodeIds,
  } = options;

  const [dragState, setDragState] = useState<DragState>(initialDragState);

  // refでドラッグ状態を追跡（イベントハンドラ内で最新値を参照するため）
  const dragStateRef = useRef<DragState>(initialDragState);

  // コールバックをrefで保持（イベントハンドラ内で最新値を参照するため）
  const callbacksRef = useRef({
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
    onExternalDrop,
  });

  // オプションをrefで保持
  const optionsRef = useRef({
    activationDistance,
    direction,
  });

  // コールバックの更新を同期
  useEffect(() => {
    callbacksRef.current = {
      onDragStart,
      onDragMove,
      onDragEnd,
      onDragCancel,
      onExternalDrop,
    };
  }, [onDragStart, onDragMove, onDragEnd, onDragCancel, onExternalDrop]);

  // オプションの更新を同期
  useEffect(() => {
    optionsRef.current = {
      activationDistance,
      direction,
    };
  }, [activationDistance, direction]);

  // dragStateの更新をrefにも同期
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  /**
   * マウス位置が外部ドロップ境界外かどうかを判定
   * ドラッグアウト判定はサイドパネル全体の境界を基準にする
   * dragOutBoundaryRefが指定されている場合はそちらを使用、
   * 指定されていない場合はcontainerRefを使用（後方互換性維持）
   */
  const isOutsideDragOutBoundary = useCallback((clientX: number, clientY: number): boolean => {
    // dragOutBoundaryRefが指定されている場合はそちらを使用
    const boundary = dragOutBoundaryRef?.current ?? containerRef.current;
    if (!boundary) return false;

    const rect = boundary.getBoundingClientRect();
    return (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    );
  }, [containerRef, dragOutBoundaryRef]);

  // getSubtreeNodeIdsをrefで保持（useCallbackの依存配列を安定化）
  const getSubtreeNodeIdsRef = useRef(getSubtreeNodeIds);
  useEffect(() => {
    getSubtreeNodeIdsRef.current = getSubtreeNodeIds;
  }, [getSubtreeNodeIds]);

  /**
   * 垂直方向のドロップターゲットを計算
   * サブツリーサイズを考慮したドロップ位置計算
   * 下方向へのドラッグ時、サブツリーを除外してインデックス調整
   */
  const calculateVerticalDropTarget = useCallback((_clientX: number, clientY: number): DropTarget | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop || 0;

    // コンテナ相対のY座標
    const mouseY = clientY - rect.top + scrollTop;

    // 各タブノードの位置情報を構築
    const tabPositions: TabPosition[] = [];
    const nodeElements = container.querySelectorAll('[data-node-id]');

    nodeElements.forEach((element) => {
      const nodeId = element.getAttribute('data-node-id');
      const depth = parseInt(element.getAttribute('data-depth') || '0', 10);
      const elemRect = element.getBoundingClientRect();

      if (nodeId) {
        tabPositions.push({
          nodeId,
          top: elemRect.top - rect.top + scrollTop,
          bottom: elemRect.bottom - rect.top + scrollTop,
          depth,
        });
      }
    });

    // ドラッグ中のノードIDを取得してオプションを構築
    const currentDragState = dragStateRef.current;
    const options: DropTargetOptions = {};

    if (currentDragState.draggedItemId && getSubtreeNodeIdsRef.current) {
      options.draggedNodeId = currentDragState.draggedItemId;
      options.getSubtreeNodeIds = getSubtreeNodeIdsRef.current;
    }

    return calculateDropTarget(mouseY, tabPositions, options);
  }, [containerRef]);

  /**
   * 水平方向のドロップターゲットを計算（ピン留めタブ用）
   */
  const calculateHorizontalDropTargetFromDOM = useCallback((clientX: number, _clientY: number): DropTarget | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;

    // コンテナ相対のX座標
    const mouseX = clientX - rect.left + scrollLeft;

    // 各タブノードの水平位置情報を構築
    const tabPositions: HorizontalTabPosition[] = [];
    const nodeElements = container.querySelectorAll('[data-node-id]');

    nodeElements.forEach((element, idx) => {
      const nodeId = element.getAttribute('data-node-id');
      const pinnedIndex = element.getAttribute('data-pinned-index');
      const elemRect = element.getBoundingClientRect();

      if (nodeId) {
        tabPositions.push({
          nodeId,
          left: elemRect.left - rect.left + scrollLeft,
          right: elemRect.right - rect.left + scrollLeft,
          index: pinnedIndex !== null ? parseInt(pinnedIndex, 10) : idx,
        });
      }
    });

    return calculateHorizontalDropTarget(mouseX, tabPositions);
  }, [containerRef]);

  /**
   * 方向に応じたドロップターゲットを計算
   */
  const calculateCurrentDropTarget = useCallback((clientX: number, clientY: number): DropTarget | null => {
    const { direction: dir } = optionsRef.current;
    if (dir === 'horizontal') {
      return calculateHorizontalDropTargetFromDOM(clientX, clientY);
    }
    return calculateVerticalDropTarget(clientX, clientY);
  }, [calculateVerticalDropTarget, calculateHorizontalDropTargetFromDOM]);

  /**
   * ドラッグ状態をリセット
   */
  const resetDragState = useCallback(() => {
    setDragState(initialDragState);
  }, []);

  // イベントハンドラをrefで保持（循環依存を回避）
  const handlersRef = useRef<{
    handleMouseMove: (e: MouseEvent) => void;
    handleMouseUp: (e: MouseEvent) => void;
  }>({
    handleMouseMove: () => {},
    handleMouseUp: () => {},
  });

  // イベントハンドラを初期化
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const currentState = dragStateRef.current;
      const { activationDistance: actDist, direction: dir } = optionsRef.current;

      if (!currentState.isPotentialDrag && !currentState.isDragging) {
        return;
      }

      const currentPosition = { x: e.clientX, y: e.clientY };
      const delta = {
        x: currentPosition.x - currentState.startPosition.x,
        y: currentPosition.y - currentState.startPosition.y,
      };

      // 方向に応じた移動距離計算
      const distance = dir === 'horizontal'
        ? Math.abs(delta.x)
        : Math.sqrt(delta.x ** 2 + delta.y ** 2);

      // 潜在的ドラッグ中で、アクティベーション距離を超えたらドラッグ開始
      if (currentState.isPotentialDrag && distance >= actDist) {
        const dropTarget = calculateCurrentDropTarget(e.clientX, e.clientY);

        setDragState((prev) => ({
          ...prev,
          isDragging: true,
          isPotentialDrag: false,
          currentPosition,
          delta,
          dropTarget,
        }));

        if (currentState.draggedItemId && currentState.draggedTabId !== null) {
          callbacksRef.current.onDragStart?.(currentState.draggedItemId, currentState.draggedTabId);
        }
        return;
      }

      // ドラッグ中の移動更新
      if (currentState.isDragging) {
        const dropTarget = calculateCurrentDropTarget(e.clientX, e.clientY);

        setDragState((prev) => ({
          ...prev,
          currentPosition,
          delta,
          dropTarget,
        }));

        callbacksRef.current.onDragMove?.(currentPosition, dropTarget);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      const currentState = dragStateRef.current;

      // イベントリスナーを削除
      document.removeEventListener('mousemove', handlersRef.current.handleMouseMove);
      document.removeEventListener('mouseup', handlersRef.current.handleMouseUp);

      // 潜在的ドラッグ中（まだドラッグ開始していない）の場合はリセット
      if (currentState.isPotentialDrag) {
        resetDragState();
        return;
      }

      // ドラッグ中でない場合は何もしない
      if (!currentState.isDragging) {
        return;
      }

      // 外部ドロップ判定
      // ドラッグアウト判定はサイドパネル全体の境界を基準にする
      if (isOutsideDragOutBoundary(e.clientX, e.clientY)) {
        if (currentState.draggedTabId !== null && callbacksRef.current.onExternalDrop) {
          callbacksRef.current.onExternalDrop(currentState.draggedTabId);
        }
        resetDragState();
        return;
      }

      // 通常のドロップ終了
      if (currentState.draggedItemId && callbacksRef.current.onDragEnd) {
        callbacksRef.current.onDragEnd(currentState.draggedItemId, currentState.dropTarget);
      }

      resetDragState();
    };

    handlersRef.current = { handleMouseMove, handleMouseUp };
  }, [calculateCurrentDropTarget, isOutsideDragOutBoundary, resetDragState]);

  /**
   * mousedownイベントハンドラ
   */
  const handleMouseDown = useCallback((itemId: string, tabId: number, e: React.MouseEvent) => {
    // 左クリック以外は無視
    if (e.button !== 0) return;

    e.preventDefault();

    const startPosition = { x: e.clientX, y: e.clientY };

    // 要素内でのクリック位置オフセットを計算
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    setDragState({
      isDragging: false,
      isPotentialDrag: true,
      draggedItemId: itemId,
      draggedTabId: tabId,
      startPosition,
      currentPosition: startPosition,
      delta: { x: 0, y: 0 },
      dropTarget: null,
      offset,
    });

    // グローバルイベントリスナーを設定
    document.addEventListener('mousemove', handlersRef.current.handleMouseMove);
    document.addEventListener('mouseup', handlersRef.current.handleMouseUp);
  }, []);

  /**
   * ドラッグをキャンセル
   */
  const cancelDrag = useCallback(() => {
    document.removeEventListener('mousemove', handlersRef.current.handleMouseMove);
    document.removeEventListener('mouseup', handlersRef.current.handleMouseUp);
    resetDragState();
    callbacksRef.current.onDragCancel?.();
  }, [resetDragState]);

  /**
   * プログラマティックにドラッグを開始（クロスウィンドウ用）
   * 8px移動待機をスキップして即座にドラッグ状態を開始
   */
  const startDragProgrammatically = useCallback((
    itemId: string,
    tabId: number,
    position: { x: number; y: number }
  ) => {
    setDragState({
      isDragging: true,
      isPotentialDrag: false,
      draggedItemId: itemId,
      draggedTabId: tabId,
      startPosition: position,
      currentPosition: position,
      delta: { x: 0, y: 0 },
      dropTarget: null,
      offset: { x: 0, y: 0 }, // クロスウィンドウ移動時はオフセットなし
    });

    // グローバルイベントリスナーを設定
    document.addEventListener('mousemove', handlersRef.current.handleMouseMove);
    document.addEventListener('mouseup', handlersRef.current.handleMouseUp);

    callbacksRef.current.onDragStart?.(itemId, tabId);
  }, []);

  /**
   * アイテムに適用するpropsを取得
   */
  const getItemProps = useCallback((itemId: string, tabId: number) => {
    const isDragging = dragState.draggedItemId === itemId && dragState.isDragging;

    return {
      onMouseDown: (e: React.MouseEvent) => handleMouseDown(itemId, tabId, e),
      style: {
        opacity: isDragging ? 0.5 : 1,
        cursor: 'grab',
      } as React.CSSProperties,
      'data-dragging': isDragging,
    };
  }, [dragState.draggedItemId, dragState.isDragging, handleMouseDown]);

  /**
   * ドラッグオーバーレイのスタイルを取得
   */
  const getDragOverlayStyle = useCallback((): React.CSSProperties | null => {
    if (!dragState.isDragging) {
      return null;
    }

    const { currentPosition, offset } = dragState;

    return {
      position: 'fixed',
      left: 0,
      top: 0,
      transform: `translate3d(${currentPosition.x - offset.x}px, ${currentPosition.y - offset.y}px, 0)`,
      pointerEvents: 'none',
      zIndex: 9999,
      willChange: 'transform',
    };
  }, [dragState]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handlersRef.current.handleMouseMove);
      document.removeEventListener('mouseup', handlersRef.current.handleMouseUp);
    };
  }, []);

  // DRAG_SESSION_ENDEDメッセージを受信したらドラッグをキャンセル
  // クロスウィンドウドラッグ終了時に元ウィンドウのプレースホルダーをクリーンアップ
  useEffect(() => {
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'DRAG_SESSION_ENDED') {
        const currentState = dragStateRef.current;
        // ドラッグ中の場合のみキャンセル
        if (currentState.isDragging || currentState.isPotentialDrag) {
          document.removeEventListener('mousemove', handlersRef.current.handleMouseMove);
          document.removeEventListener('mouseup', handlersRef.current.handleMouseUp);
          resetDragState();
        }
      }
    };

    // chrome.runtime.onMessage が存在する場合のみリスナーを追加
    // テスト環境では存在しない場合がある
    if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
      chrome.runtime.onMessage.addListener(handleMessage);
      return () => {
        chrome.runtime.onMessage.removeListener(handleMessage);
      };
    }
  }, [resetDragState]);

  return {
    dragState,
    getItemProps,
    getDragOverlayStyle,
    startDragProgrammatically,
    cancelDrag,
  };
}
