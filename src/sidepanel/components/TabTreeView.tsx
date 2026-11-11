import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { UITabNode, TabTreeViewProps } from '@/types';
import { useDragDrop, type DropTarget, DropTargetType } from '../hooks/useDragDrop';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { DragOverlay } from './DragOverlay';
import DropIndicator from './DropIndicator';
import {
  calculateIndicatorYByNodeIds,
  type TabPosition,
} from './GapDropDetection';
import { TREE_INDENT_WIDTH_PX, calculateDepthRange } from '../utils';
import { getDisplayFavicon, getDisplayTitle } from '../utils/tab-display';
import { TreeNodeItem } from './TreeNodeItem';

const AUTO_EXPAND_HOVER_DELAY_MS = 1000;

const INDENT_WIDTH = TREE_INDENT_WIDTH_PX;

const TabTreeView: React.FC<TabTreeViewProps> = ({
  nodes,
  currentViewIndex,
  onNodeClick,
  onToggleExpand,
  onDragEnd,
  onDragStart: onDragStartProp,
  onDragCancel: onDragCancelProp,
  onSiblingDrop,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  getTabInfo,
  isNodeSelected,
  onSelect,
  getSelectedTabIds,
  clearSelection,
  onSnapshot,
  views,
  onMoveToView,
  currentWindowId,
  otherWindows,
  onMoveToWindow,
  onExternalDrop,
  onOutsideTreeChange,
  sidePanelRef,
  onGroupRequest,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [globalIsDragging, setGlobalIsDragging] = useState(false);
  const [activeTabIdForDrag, setActiveTabIdForDrag] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [overrideDepth, setOverrideDepth] = useState<number | null>(null);
  const overrideDepthRef = useRef<number | null>(null);
  const tabPositionsRef = useRef<TabPosition[]>([]);
  const isOutsideTreeRef = useRef<boolean>(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHoverTabIdRef = useRef<number | null>(null);
  const depthBaseXRef = useRef<number>(0);
  const currentDepthForMouseRef = useRef<number>(0);
  const currentGapIndexRef = useRef<number | null>(null);
  const gapDepthOffsetRef = useRef<number>(0);

  const filteredNodes = nodes;

  const isDraggable = !!onDragEnd;

  const handleDropTargetChange = useCallback((target: DropTarget | null, newTabPositions?: TabPosition[]) => {
    setDropTarget(target);
    setOverrideDepth(null);
    overrideDepthRef.current = null;
    if (newTabPositions) {
      tabPositionsRef.current = newTabPositions;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const items = useMemo(() => {
    const result: Array<{ id: string; tabId: number }> = [];
    const collectItems = (nodeList: UITabNode[]) => {
      nodeList.forEach((node) => {
        result.push({ id: node.tabId.toString(), tabId: node.tabId });
        if (node.children && node.children.length > 0 && node.isExpanded) {
          collectItems(node.children);
        }
      });
    };
    collectItems(filteredNodes);
    return result;
  }, [filteredNodes]);

  const getSubtreeTabIds = useCallback((tabId: number): number[] => {
    const result: number[] = [];

    const findAndCollect = (nodeList: UITabNode[]): boolean => {
      for (const node of nodeList) {
        if (node.tabId === tabId) {
          const collectNodeAndDescendants = (n: UITabNode) => {
            result.push(n.tabId);
            for (const child of n.children) {
              collectNodeAndDescendants(child);
            }
          };
          collectNodeAndDescendants(node);
          return true;
        }
        if (node.children && node.children.length > 0) {
          if (findAndCollect(node.children)) {
            return true;
          }
        }
      }
      return false;
    };

    findAndCollect(nodes);
    return result;
  }, [nodes]);

  const {
    dragState,
    getItemProps,
  } = useDragDrop({
    containerRef,
    items,
    activationDistance: 8,
    direction: 'vertical',
    getSubtreeNodeIds: useCallback((nodeId: string) => {
      const tabId = parseInt(nodeId, 10);
      if (isNaN(tabId)) return [];
      return getSubtreeTabIds(tabId).map(id => id.toString());
    }, [getSubtreeTabIds]),
    onDragStart: useCallback((itemId: string, _tabId: number) => {
      setGlobalIsDragging(true);
      const tabId = parseInt(itemId, 10);
      setActiveTabIdForDrag(isNaN(tabId) ? null : tabId);
      if (onDragStartProp) {
        onDragStartProp({ active: { id: itemId } } as Parameters<typeof onDragStartProp>[0]);
      }
    }, [onDragStartProp]),
    onDragMove: useCallback((position: { x: number; y: number }, newDropTarget: DropTarget | null) => {
      const newGapIndex = newDropTarget?.type === DropTargetType.Gap ? (newDropTarget.gapIndex ?? null) : null;

      if (newDropTarget?.type === DropTargetType.Gap) {
        const defaultDepth = newDropTarget.adjacentDepths?.below ?? newDropTarget.adjacentDepths?.above ?? 0;

        if (newGapIndex !== currentGapIndexRef.current) {
          // 別の隙間に移動した場合のみリセット
          depthBaseXRef.current = position.x;
          gapDepthOffsetRef.current = 0;
          currentDepthForMouseRef.current = defaultDepth;
          currentGapIndexRef.current = newGapIndex;
        }
        // 同じ隙間の場合（タブ上ドロップから戻った場合も含む）は基準点とオフセットを維持

        const deltaX = position.x - depthBaseXRef.current;
        const depthChange = Math.floor(deltaX / INDENT_WIDTH);
        const { minDepth, maxDepth } = calculateDepthRange(
          newDropTarget.adjacentDepths?.above,
          newDropTarget.adjacentDepths?.below
        );

        const rawDepth = defaultDepth + depthChange + gapDepthOffsetRef.current;
        const clampedDepth = Math.max(minDepth, Math.min(maxDepth, rawDepth));

        // clampされた場合、オフセットと基準点を調整
        if (clampedDepth !== rawDepth) {
          gapDepthOffsetRef.current = clampedDepth - defaultDepth;
          depthBaseXRef.current = position.x;
        }

        if (clampedDepth !== overrideDepthRef.current) {
          setOverrideDepth(clampedDepth);
          overrideDepthRef.current = clampedDepth;
          currentDepthForMouseRef.current = clampedDepth;
        }

        setDropTarget(newDropTarget);
      } else {
        // currentGapIndexRefとgapDepthOffsetRefは維持（同じ隙間に戻る可能性があるため）
        handleDropTargetChange(newDropTarget, tabPositionsRef.current);
      }

      const boundary = sidePanelRef?.current ?? containerRef.current;
      if (boundary) {
        const rect = boundary.getBoundingClientRect();
        const isOutside =
          position.x < rect.left ||
          position.x > rect.right ||
          position.y < rect.top ||
          position.y > rect.bottom;

        if (isOutsideTreeRef.current !== isOutside) {
          isOutsideTreeRef.current = isOutside;
          if (onOutsideTreeChange) {
            onOutsideTreeChange(isOutside);
          }
        }
      }

      if (newDropTarget?.type === DropTargetType.Tab && newDropTarget.targetNodeId) {
        const overTabId = parseInt(newDropTarget.targetNodeId, 10);

        if (!isNaN(overTabId) && overTabId !== lastHoverTabIdRef.current) {
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
          }

          lastHoverTabIdRef.current = overTabId;

          const findNode = (nodeList: UITabNode[]): UITabNode | null => {
            for (const n of nodeList) {
              if (n.tabId === overTabId) return n;
              if (n.children && n.children.length > 0) {
                const found = findNode(n.children);
                if (found) return found;
              }
            }
            return null;
          };

          const overNode = findNode(nodes);
          if (overNode && overNode.children && overNode.children.length > 0 && !overNode.isExpanded) {
            hoverTimerRef.current = setTimeout(() => {
              onToggleExpand(overTabId);
              hoverTimerRef.current = null;
              lastHoverTabIdRef.current = null;
            }, AUTO_EXPAND_HOVER_DELAY_MS);
          }
        }
      } else {
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        lastHoverTabIdRef.current = null;
      }
    }, [nodes, onToggleExpand, handleDropTargetChange, onOutsideTreeChange, sidePanelRef]),
    onDragEnd: useCallback(async (itemId: string, finalDropTarget: DropTarget | null): Promise<void> => {
      // 非同期処理の完了前に状態をリセットしない（waitForDragEndがis-draggingクラスで待機するため）
      setActiveTabIdForDrag(null);

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      lastHoverTabIdRef.current = null;

      const draggedTabId = parseInt(itemId, 10);
      if (isNaN(draggedTabId)) {
        handleDropTargetChange(null);
        setGlobalIsDragging(false);
        return;
      }

      if (isOutsideTreeRef.current && onExternalDrop) {
        isOutsideTreeRef.current = false;
        onExternalDrop(draggedTabId);
        handleDropTargetChange(null);
        setGlobalIsDragging(false);
        return;
      }

      isOutsideTreeRef.current = false;

      // ドラッグ中のノードとそのサブツリーを除外したtabPositionsを使用
      // calculateDropTargetはドラッグノードを除外したeffectiveTabPositionsでgapIndexを計算するため、
      // aboveTabId/belowTabIdの参照も同様に除外リストから取得する必要がある
      if (finalDropTarget && finalDropTarget.type === DropTargetType.Gap && onSiblingDrop) {
        const subtreeTabIds = getSubtreeTabIds(draggedTabId);
        const subtreeSet = new Set(subtreeTabIds.map(id => id.toString()));
        const effectiveTabPositions = tabPositionsRef.current.filter(pos => !subtreeSet.has(pos.nodeId));
        const gapIndex = finalDropTarget.gapIndex ?? 0;

        let aboveTabId: number | undefined;
        let belowTabId: number | undefined;

        if (gapIndex > 0 && gapIndex - 1 < effectiveTabPositions.length) {
          const aboveNodeId = effectiveTabPositions[gapIndex - 1]?.nodeId;
          if (aboveNodeId) {
            aboveTabId = parseInt(aboveNodeId, 10);
            if (isNaN(aboveTabId)) aboveTabId = undefined;
          }
        }
        if (gapIndex < effectiveTabPositions.length) {
          const belowNodeId = effectiveTabPositions[gapIndex]?.nodeId;
          if (belowNodeId) {
            belowTabId = parseInt(belowNodeId, 10);
            if (isNaN(belowTabId)) belowTabId = undefined;
          }
        }

        const targetDepth = overrideDepthRef.current ?? undefined;
        await onSiblingDrop({
          activeTabId: draggedTabId,
          insertIndex: gapIndex,
          aboveTabId,
          belowTabId,
          targetDepth,
        });
        handleDropTargetChange(null);
        setGlobalIsDragging(false);
        return;
      }

      if (finalDropTarget?.type === DropTargetType.Tab && onDragEnd) {
        await onDragEnd({
          active: { id: itemId },
          over: finalDropTarget.targetNodeId ? { id: finalDropTarget.targetNodeId } : null,
        } as Parameters<typeof onDragEnd>[0]);
      }

      handleDropTargetChange(null);
      setGlobalIsDragging(false);
    }, [onDragEnd, onSiblingDrop, onExternalDrop, handleDropTargetChange, getSubtreeTabIds]),
    onDragCancel: useCallback(() => {
      setGlobalIsDragging(false);
      setActiveTabIdForDrag(null);

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      lastHoverTabIdRef.current = null;
      handleDropTargetChange(null);

      if (onDragCancelProp) {
        onDragCancelProp();
      }
    }, [onDragCancelProp, handleDropTargetChange]),
    onExternalDrop: useCallback((tabId: number) => {
      onExternalDrop?.(tabId);
      setGlobalIsDragging(false);
    }, [onExternalDrop]),
    dragOutBoundaryRef: sidePanelRef,
  });

  const { handleAutoScroll, stopAutoScroll } = useAutoScroll(containerRef, {
    threshold: 50,
    speed: 8,
    clampToContent: true,
  });

  useEffect(() => {
    if (dragState.isDragging) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        handleAutoScroll(dragState.currentPosition.y, rect);
      }
    } else {
      stopAutoScroll();
    }
  }, [dragState.isDragging, dragState.currentPosition.y, handleAutoScroll, stopAutoScroll]);

  useEffect(() => {
    if (dragState.isDragging) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const scrollTop = container.scrollTop || 0;
        const tabPositions: TabPosition[] = [];
        const nodeElements = container.querySelectorAll('[data-tab-id]');

        nodeElements.forEach((element) => {
          const tabIdStr = element.getAttribute('data-tab-id');
          const depth = parseInt(element.getAttribute('data-depth') || '0', 10);
          const elemRect = element.getBoundingClientRect();

          if (tabIdStr) {
            tabPositions.push({
              nodeId: tabIdStr,
              top: elemRect.top - rect.top + scrollTop,
              bottom: elemRect.bottom - rect.top + scrollTop,
              depth,
            });
          }
        });

        tabPositionsRef.current = tabPositions;
      }
    }
  }, [dragState.isDragging, dragState.currentPosition]);

  const getItemPropsForNode = useCallback((tabId: number) => {
    return getItemProps(tabId.toString(), tabId);
  }, [getItemProps]);

  const isNodeDragging = useCallback((tabId: number) => {
    return dragState.isDragging && dragState.draggedItemId === tabId.toString();
  }, [dragState.isDragging, dragState.draggedItemId]);

  // adjacentNodeIdsを使って元のtabPositions（ドラッグ中ノード含む）での位置を計算
  // これにより、プレースホルダーがドラッグ中タブの中央に表示される問題を回避
  const dropIndicatorPosition = useMemo(() => {
    if (!dropTarget || dropTarget.type !== DropTargetType.Gap) {
      return null;
    }
    const gapIndex = dropTarget.gapIndex ?? 0;

    const aboveNodeId = dropTarget.adjacentNodeIds?.aboveNodeId;
    const belowNodeId = dropTarget.adjacentNodeIds?.belowNodeId;
    // eslint-disable-next-line react-hooks/refs -- ドロップターゲット変更時の位置計算に現在値が必要
    const topY = calculateIndicatorYByNodeIds(aboveNodeId, belowNodeId, tabPositionsRef.current);

    const defaultDepth = dropTarget.adjacentDepths?.below ?? dropTarget.adjacentDepths?.above ?? 0;
    const depth = overrideDepth ?? defaultDepth;

    return {
      index: gapIndex,
      depth,
      topY,
    };
  }, [dropTarget, overrideDepth]);

  const containerClassName = useMemo(() => {
    const baseClass = 'relative';
    if (globalIsDragging) {
      return `${baseClass} overflow-x-hidden is-dragging`;
    }
    return baseClass;
  }, [globalIsDragging]);

  const renderTabNode = (node: UITabNode): React.ReactNode => (
    <TreeNodeItem
      key={node.tabId}
      node={node}
      onNodeClick={onNodeClick}
      onToggleExpand={onToggleExpand}
      isDraggable={isDraggable}
      isTabUnread={isTabUnread}
      getUnreadChildCount={getUnreadChildCount}
      activeTabId={activeTabId}
      getTabInfo={getTabInfo}
      isNodeSelected={isNodeSelected}
      onSelect={onSelect}
      getSelectedTabIds={getSelectedTabIds}
      clearSelection={clearSelection}
      isDragHighlighted={
        isDraggable &&
        dropTarget?.type === DropTargetType.Tab &&
        dropTarget.targetNodeId === node.tabId.toString()
      }
      globalIsDragging={globalIsDragging}
      activeTabIdForDrag={activeTabIdForDrag}
      onSnapshot={onSnapshot}
      views={views}
      currentViewIndex={currentViewIndex}
      onMoveToView={onMoveToView}
      currentWindowId={currentWindowId}
      otherWindows={otherWindows}
      onMoveToWindow={onMoveToWindow}
      onGroupRequest={onGroupRequest}
      dragItemProps={isDraggable ? getItemPropsForNode(node.tabId) : undefined}
      isDragging={isDraggable && isNodeDragging(node.tabId)}
      getItemPropsForNode={isDraggable ? getItemPropsForNode : undefined}
      isNodeDragging={isDraggable ? isNodeDragging : undefined}
    />
  );


  const content = (
    <div
      ref={containerRef}
      className={containerClassName}
      data-drag-container
      data-drop-target-type={dropTarget?.type ?? 'none'}
      data-drop-target-node={dropTarget?.type === DropTargetType.Tab ? dropTarget.targetNodeId : undefined}
    >
      {filteredNodes.map((node) => {
        return renderTabNode(node);
      })}
      {dropIndicatorPosition && (
        <DropIndicator
          targetIndex={dropIndicatorPosition.index}
          targetDepth={dropIndicatorPosition.depth}
          indentWidth={INDENT_WIDTH}
          isVisible={true}
          topPosition={dropIndicatorPosition.topY}
        />
      )}
    </div>
  );

  const draggedNode = useMemo(() => {
    if (!dragState.isDragging || !dragState.draggedItemId) return null;
    const draggedTabId = parseInt(dragState.draggedItemId, 10);
    if (isNaN(draggedTabId)) return null;
    const findNode = (nodeList: UITabNode[]): UITabNode | null => {
      for (const n of nodeList) {
        if (n.tabId === draggedTabId) return n;
        if (n.children && n.children.length > 0) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(nodes);
  }, [dragState.isDragging, dragState.draggedItemId, nodes]);

  const draggedTabInfo = draggedNode && getTabInfo ? getTabInfo(draggedNode.tabId) : undefined;

  return (
    <div data-testid="tab-tree-view" className="w-full select-none">
      {filteredNodes.length === 0 ? (
        <div className="p-4 text-gray-400 text-sm">No tabs in this view</div>
      ) : (
        <>
          {content}
          <DragOverlay
            isDragging={dragState.isDragging}
            position={dragState.currentPosition}
            offset={dragState.offset}
          >
            {draggedNode && (
              <div
                className="flex items-center p-2 bg-gray-700 text-gray-100 shadow-lg rounded border border-gray-600"
                style={{ width: '250px' }}
              >
                {(() => {
                  const displayFavicon = draggedTabInfo ? getDisplayFavicon(draggedTabInfo) : null;
                  return displayFavicon ? (
                    <img
                      src={displayFavicon}
                      alt="Favicon"
                      className="w-4 h-4 mr-2 flex-shrink-0"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                        const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                        if (fallback) fallback.style.display = 'block';
                      }}
                    />
                  ) : null;
                })()}
                <div
                  className="w-4 h-4 mr-2 bg-gray-300 rounded-sm flex-shrink-0"
                  style={{ display: draggedTabInfo && getDisplayFavicon(draggedTabInfo) ? 'none' : 'block' }}
                />
                <span className="truncate">
                  {draggedTabInfo ? getDisplayTitle({ title: draggedTabInfo.title, url: draggedTabInfo.url || '', status: draggedTabInfo.status }) : `Tab ${draggedNode.tabId}`}
                </span>
              </div>
            )}
          </DragOverlay>
        </>
      )}
    </div>
  );
};

export default TabTreeView;
