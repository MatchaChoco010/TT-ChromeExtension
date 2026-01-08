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

export { type DropTarget, DropTargetType };

export interface DragState {
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
  delta: { x: number; y: number };
  dropTarget: DropTarget | null;
  /** ドラッグ中の要素のオフセット（要素内でのクリック位置） */
  offset: { x: number; y: number };
}

export interface UseDragDropOptions {
  /** ドラッグ開始までの移動距離（デフォルト: 8px） */
  activationDistance?: number;
  /** ドラッグ方向（vertical: 縦方向、horizontal: 横方向） */
  direction?: 'vertical' | 'horizontal';
  containerRef: React.RefObject<HTMLElement | null>;
  items: Array<{ id: string; tabId: number }>;
  onDragStart?: (itemId: string, tabId: number) => void;
  onDragMove?: (position: { x: number; y: number }, dropTarget: DropTarget | null) => void;
  onDragEnd?: (itemId: string, dropTarget: DropTarget | null) => Promise<void>;
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

export interface UseDragDropReturn {
  dragState: DragState;
  /** アイテムに適用するprops（マウス操作のみ、タッチはスコープ外） */
  getItemProps: (itemId: string, tabId: number) => {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    'data-dragging': boolean;
  };
  getDragOverlayStyle: () => React.CSSProperties | null;
  /** プログラマティックにドラッグを開始（クロスウィンドウ用） */
  startDragProgrammatically: (itemId: string, tabId: number, position: { x: number; y: number }) => void;
  cancelDrag: () => void;
}

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
    dragOutBoundaryRef,
    getSubtreeNodeIds,
  } = options;

  const [dragState, setDragState] = useState<DragState>(initialDragState);

  const dragStateRef = useRef<DragState>(initialDragState);

  const callbacksRef = useRef({
    onDragStart,
    onDragMove,
    onDragEnd,
    onDragCancel,
    onExternalDrop,
  });

  const optionsRef = useRef({
    activationDistance,
    direction,
  });

  useEffect(() => {
    callbacksRef.current = {
      onDragStart,
      onDragMove,
      onDragEnd,
      onDragCancel,
      onExternalDrop,
    };
  }, [onDragStart, onDragMove, onDragEnd, onDragCancel, onExternalDrop]);

  useEffect(() => {
    optionsRef.current = {
      activationDistance,
      direction,
    };
  }, [activationDistance, direction]);

  const isOutsideDragOutBoundary = useCallback((clientX: number, clientY: number): boolean => {
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

  const getSubtreeNodeIdsRef = useRef(getSubtreeNodeIds);
  useEffect(() => {
    getSubtreeNodeIdsRef.current = getSubtreeNodeIds;
  }, [getSubtreeNodeIds]);

  const calculateVerticalDropTarget = useCallback((_clientX: number, clientY: number): DropTarget | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const scrollTop = container.scrollTop || 0;

    const mouseY = clientY - rect.top + scrollTop;

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

    const currentDragState = dragStateRef.current;
    const options: DropTargetOptions = {};

    if (currentDragState.draggedItemId && getSubtreeNodeIdsRef.current) {
      options.draggedNodeId = currentDragState.draggedItemId;
      options.getSubtreeNodeIds = getSubtreeNodeIdsRef.current;
    }

    return calculateDropTarget(mouseY, tabPositions, options);
  }, [containerRef]);

  const calculateHorizontalDropTargetFromDOM = useCallback((clientX: number, _clientY: number): DropTarget | null => {
    const container = containerRef.current;
    if (!container) return null;

    const rect = container.getBoundingClientRect();
    const scrollLeft = container.scrollLeft || 0;

    const mouseX = clientX - rect.left + scrollLeft;

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

  const calculateCurrentDropTarget = useCallback((clientX: number, clientY: number): DropTarget | null => {
    const { direction: dir } = optionsRef.current;
    if (dir === 'horizontal') {
      return calculateHorizontalDropTargetFromDOM(clientX, clientY);
    }
    return calculateVerticalDropTarget(clientX, clientY);
  }, [calculateVerticalDropTarget, calculateHorizontalDropTargetFromDOM]);

  const resetDragState = useCallback(() => {
    dragStateRef.current = initialDragState;
    setDragState(initialDragState);
  }, []);

  const handleDragStartRef = useRef<(e: DragEvent) => void>((e: DragEvent) => {
    e.preventDefault();
    console.log('[useDragDrop] dragstart prevented');
  });

  const handlersRef = useRef<{
    handleMouseMove: (e: MouseEvent) => void;
    handleMouseUp: (e: MouseEvent) => void | Promise<void>;
  }>({
    handleMouseMove: () => {},
    handleMouseUp: () => {},
  });

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

      const distance = dir === 'horizontal'
        ? Math.abs(delta.x)
        : Math.sqrt(delta.x ** 2 + delta.y ** 2);

      if (currentState.isPotentialDrag && distance >= actDist) {
        const dropTarget = calculateCurrentDropTarget(e.clientX, e.clientY);

        const newState: DragState = {
          ...currentState,
          isDragging: true,
          isPotentialDrag: false,
          currentPosition,
          delta,
          dropTarget,
        };

        dragStateRef.current = newState;
        setDragState(newState);

        if (currentState.draggedItemId && currentState.draggedTabId !== null) {
          callbacksRef.current.onDragStart?.(currentState.draggedItemId, currentState.draggedTabId);
        }
        return;
      }

      if (currentState.isDragging) {
        const dropTarget = calculateCurrentDropTarget(e.clientX, e.clientY);

        const newState: DragState = {
          ...currentState,
          currentPosition,
          delta,
          dropTarget,
        };

        dragStateRef.current = newState;
        setDragState(newState);

        callbacksRef.current.onDragMove?.(currentPosition, dropTarget);
      }
    };

    const handleMouseUp = async (e: MouseEvent) => {
      const currentState = dragStateRef.current;

      document.removeEventListener('mousemove', handlersRef.current.handleMouseMove);
      document.removeEventListener('mouseup', handlersRef.current.handleMouseUp);
      document.removeEventListener('dragstart', handleDragStartRef.current);

      if (currentState.isPotentialDrag) {
        resetDragState();
        return;
      }

      if (!currentState.isDragging) {
        return;
      }

      if (isOutsideDragOutBoundary(e.clientX, e.clientY)) {
        if (currentState.draggedTabId !== null && callbacksRef.current.onExternalDrop) {
          callbacksRef.current.onExternalDrop(currentState.draggedTabId);
        }
        resetDragState();
        return;
      }

      if (currentState.draggedItemId && callbacksRef.current.onDragEnd) {
        const dropTarget = calculateCurrentDropTarget(e.clientX, e.clientY);
        await callbacksRef.current.onDragEnd(currentState.draggedItemId, dropTarget);
      }

      resetDragState();
    };

    handlersRef.current = { handleMouseMove, handleMouseUp };
  }, [calculateCurrentDropTarget, isOutsideDragOutBoundary, resetDragState]);

  const handleMouseDown = useCallback((itemId: string, tabId: number, e: React.MouseEvent) => {
    if (e.button !== 0) return;

    e.preventDefault();

    const startPosition = { x: e.clientX, y: e.clientY };

    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    const newState: DragState = {
      isDragging: false,
      isPotentialDrag: true,
      draggedItemId: itemId,
      draggedTabId: tabId,
      startPosition,
      currentPosition: startPosition,
      delta: { x: 0, y: 0 },
      dropTarget: null,
      offset,
    };

    // Synchronously update the ref to avoid race condition with event handlers
    // Event handlers may fire before useEffect updates the ref
    dragStateRef.current = newState;
    setDragState(newState);

    document.addEventListener('mousemove', handlersRef.current.handleMouseMove);
    document.addEventListener('mouseup', handlersRef.current.handleMouseUp);
    document.addEventListener('dragstart', handleDragStartRef.current);
  }, []);

  const cancelDrag = useCallback(() => {
    document.removeEventListener('mousemove', handlersRef.current.handleMouseMove);
    document.removeEventListener('mouseup', handlersRef.current.handleMouseUp);
    document.removeEventListener('dragstart', handleDragStartRef.current);
    resetDragState();
    callbacksRef.current.onDragCancel?.();
  }, [resetDragState]);

  /** プログラマティックにドラッグを開始（クロスウィンドウ用） */
  const startDragProgrammatically = useCallback((
    itemId: string,
    tabId: number,
    position: { x: number; y: number }
  ) => {
    const newState: DragState = {
      isDragging: true,
      isPotentialDrag: false,
      draggedItemId: itemId,
      draggedTabId: tabId,
      startPosition: position,
      currentPosition: position,
      delta: { x: 0, y: 0 },
      dropTarget: null,
      offset: { x: 0, y: 0 },
    };

    // Synchronously update the ref to avoid race condition with event handlers
    dragStateRef.current = newState;
    setDragState(newState);

    document.addEventListener('mousemove', handlersRef.current.handleMouseMove);
    document.addEventListener('mouseup', handlersRef.current.handleMouseUp);

    callbacksRef.current.onDragStart?.(itemId, tabId);
  }, []);

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

  useEffect(() => {
    const handleDragStart = handleDragStartRef.current;
    return () => {
      document.removeEventListener('mousemove', handlersRef.current.handleMouseMove);
      document.removeEventListener('mouseup', handlersRef.current.handleMouseUp);
      document.removeEventListener('dragstart', handleDragStart);
    };
  }, []);

  // DRAG_SESSION_ENDEDメッセージを受信したらドラッグをキャンセル
  // クロスウィンドウドラッグ終了時に元ウィンドウのプレースホルダーをクリーンアップ
  useEffect(() => {
    const handleMessage = (message: { type: string }) => {
      if (message.type === 'DRAG_SESSION_ENDED') {
        console.log('[useDragDrop] DRAG_SESSION_ENDED received', {
          isDragging: dragStateRef.current.isDragging,
          isPotentialDrag: dragStateRef.current.isPotentialDrag,
          draggedItemId: dragStateRef.current.draggedItemId,
          draggedTabId: dragStateRef.current.draggedTabId,
        });
        const currentState = dragStateRef.current;
        if (currentState.isDragging || currentState.isPotentialDrag) {
          console.log('[useDragDrop] Resetting drag state due to DRAG_SESSION_ENDED');
          document.removeEventListener('mousemove', handlersRef.current.handleMouseMove);
          document.removeEventListener('mouseup', handlersRef.current.handleMouseUp);
          document.removeEventListener('dragstart', handleDragStartRef.current);
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
