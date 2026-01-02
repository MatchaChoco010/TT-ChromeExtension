import React, { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import type { TabNode, TabTreeViewProps, MenuAction, ExtendedTabInfo, Group, View } from '@/types';
import { useDragDrop, type DropTarget, DropTargetType } from '../hooks/useDragDrop';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { DragOverlay } from './DragOverlay';
import { ContextMenu } from './ContextMenu';
import { useMenuActions } from '../hooks/useMenuActions';
import UnreadBadge from './UnreadBadge';
import CloseButton from './CloseButton';
import DropIndicator from './DropIndicator';
import {
  calculateIndicatorYByNodeIds,
  type TabPosition,
} from './GapDropDetection';

// ドラッグホバー時のブランチ自動展開の閾値（ミリ秒）
// ホバー時間が1秒を超えたら展開
const AUTO_EXPAND_HOVER_DELAY_MS = 1000;

/**
 * スタートページURLを判定するヘルパー関数
 * Vivaldi/Chromeのスタートページ関連のURLを検出
 */
const isStartPageUrl = (url: string): boolean => {
  if (!url) return false;

  const startPageUrlPatterns = [
    /^chrome:\/\/vivaldi-webui\/startpage/,
    /^vivaldi:\/\/startpage/,
  ];

  return startPageUrlPatterns.some(pattern => pattern.test(url));
};

/**
 * 新しいタブURLを判定するヘルパー関数
 * Vivaldi/Chromeの新しいタブ関連のURLを検出（スタートページ以外）
 *
 * chrome-extension://URLは新しいタブと判定しない
 * 拡張機能ページ（settings.html, group.html等）は独自のタイトルを持つため
 */
const isNewTabUrl = (url: string): boolean => {
  if (!url) return false;

  const newTabUrlPatterns = [
    /^chrome:\/\/newtab/,
    // Note: chrome-extension://は削除。拡張機能ページは独自タイトルを持つ
    /^vivaldi:\/\/newtab/,
    /^about:blank$/,
  ];

  return newTabUrlPatterns.some(pattern => pattern.test(url));
};

/**
 * 表示するタブタイトルを決定するヘルパー関数
 * - Loading状態の場合: 「Loading...」
 * - スタートページURLの場合: 「スタートページ」
 * - 新しいタブURLの場合: 「新しいタブ」
 * - それ以外: 元のタイトル
 *
 * Vivaldi専用URL（chrome://vivaldi-webui/startpage）の場合、
 * 拡張機能にはURLが公開されないことがあるため、タイトルもチェックする
 */
const getDisplayTitle = (tab: { title: string; url: string; status?: 'loading' | 'complete' }): string => {
  // Loading状態の場合
  if (tab.status === 'loading') {
    return 'Loading...';
  }

  // スタートページURLの場合
  // URLをチェック、またはタイトルがURL形式でスタートページパターンの場合もチェック
  if (isStartPageUrl(tab.url) || isStartPageUrl(tab.title)) {
    return 'スタートページ';
  }

  // 新しいタブURLの場合
  // URLをチェック、またはタイトルがURL形式で新しいタブパターンの場合もチェック
  if (isNewTabUrl(tab.url) || isNewTabUrl(tab.title)) {
    return '新しいタブ';
  }

  // 通常のタイトル
  return tab.title;
};

// インデント幅（ピクセル）
const INDENT_WIDTH = 20;

interface TreeNodeItemProps {
  node: TabNode;
  onNodeClick: (tabId: number) => void;
  onToggleExpand: (nodeId: string) => void;
  isDraggable: boolean;
  // 未読状態を確認する関数
  isTabUnread?: (tabId: number) => boolean;
  // 子孫の未読数を取得する関数
  getUnreadChildCount?: (nodeId: string) => number;
  // アクティブタブID
  activeTabId?: number;
  // タブ情報取得関数
  getTabInfo?: (tabId: number) => ExtendedTabInfo | undefined;
  // 選択状態管理
  isNodeSelected?: (nodeId: string) => boolean;
  onSelect?: (nodeId: string, modifiers: { shift: boolean; ctrl: boolean }) => void;
  // 選択されたすべてのタブIDを取得するヘルパー
  getSelectedTabIds?: () => number[];
  // ドラッグホバーハイライト状態
  isDragHighlighted?: boolean;
  // グローバルドラッグ中フラグ（他のノードのtransformを無効化するため）
  globalIsDragging?: boolean;
  // ドラッグ中のアクティブノードID
  activeNodeId?: string | null;
  // スナップショット取得コールバック
  onSnapshot?: () => Promise<void>;
  // ビュー移動サブメニュー用
  views?: View[];
  currentViewId?: string;
  onMoveToView?: (viewId: string, tabIds: number[]) => void;
  // グループ追加サブメニュー用
  groups?: Record<string, Group>;
  onAddToGroup?: (groupId: string, tabIds: number[]) => void;
  // 自前D&D実装用のprops
  /** getItemPropsから取得したprops */
  dragItemProps?: {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    'data-dragging': boolean;
  };
  /** ドラッグ中かどうか（自前D&D） */
  isDragging?: boolean;
  /** 子ノード用のgetItemProps関数 */
  getItemPropsForNode?: (nodeId: string, tabId: number) => {
    onMouseDown: (e: React.MouseEvent) => void;
    style: React.CSSProperties;
    'data-dragging': boolean;
  };
  /** 子ノードがドラッグ中かどうかを判定する関数 */
  isNodeDragging?: (nodeId: string) => boolean;
}

/**
 * ドラッグ可能なツリーノード項目コンポーネント
 * コンテキストメニュー機能を追加
 * 未読バッジ表示を追加
 * タブ情報（タイトル、ファビコン）表示を追加
 * dnd-kitからuseDragDropに移行
 */
const DraggableTreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  onNodeClick,
  onToggleExpand,
  isDraggable,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  getTabInfo,
  isNodeSelected,
  onSelect,
  getSelectedTabIds,
  isDragHighlighted,
  globalIsDragging,
  activeNodeId,
  onSnapshot,
  views,
  currentViewId,
  onMoveToView,
  groups,
  onAddToGroup,
  dragItemProps,
  isDragging: isDraggingProp,
  getItemPropsForNode,
  isNodeDragging,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  // ホバー状態管理
  const [isHovered, setIsHovered] = useState(false);
  const { executeAction } = useMenuActions();

  // 未読状態を計算
  const isUnread = isTabUnread ? isTabUnread(node.tabId) : false;
  // getUnreadChildCountは使用しない（親タブへの不要なバッジ表示削除）
  // アクティブ状態を計算
  const isActive = activeTabId === node.tabId;
  // タブ情報を取得
  const tabInfo = getTabInfo ? getTabInfo(node.tabId) : undefined;
  // 選択状態を計算
  const isSelected = isNodeSelected ? isNodeSelected(node.id) : false;
  // ドラッグ中かどうか（propsから取得）
  const isDragging = isDraggingProp ?? false;

  // ホバー時のイベントハンドラ
  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // 閉じるボタンクリック時にchrome.tabs.removeを呼び出す
  const handleCloseClick = () => {
    chrome.tabs.remove(node.tabId);
  };

  // 自前D&D用のスタイル
  // ドラッグ中のアイテムは半透明に
  const style: React.CSSProperties = {
    opacity: isDragging ? 0.5 : 1,
    ...dragItemProps?.style,
  };

  // 右クリック時のコンテキストメニュー表示
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  // コンテキストメニューのアクション実行
  // snapshotアクションにはonSnapshotコールバックを渡す
  // 複数選択時は選択されたすべてのタブIDを使用
  const handleContextMenuAction = (action: MenuAction) => {
    const targetTabIds = isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId];
    executeAction(action, targetTabIds, { url: tabInfo?.url || 'about:blank', onSnapshot });
  };

  // クリック時に選択状態を処理
  const handleNodeClick = (e: React.MouseEvent) => {
    // 選択機能が有効な場合は選択処理を行う
    if (onSelect) {
      onSelect(node.id, {
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
      });
    }
    // タブをアクティブにする
    onNodeClick(node.tabId);
  };

  // マウスダウンハンドラ（自前D&D用）
  const handleMouseDown = (e: React.MouseEvent) => {
    // 展開ボタンや閉じるボタンのクリックを除外
    const target = e.target as HTMLElement;
    if (target.closest('button')) {
      return;
    }
    // isDraggableでない場合は無視
    if (!isDraggable) {
      return;
    }
    // 自前D&DのonMouseDownを呼び出し
    dragItemProps?.onMouseDown(e);
  };

  return (
    <div style={style}>
      {/* ノードの内容 */}
      <div
        data-testid={`tree-node-${node.tabId}`}
        data-node-id={node.id}
        data-draggable-item={`draggable-item-${node.id}`}
        data-expanded={node.isExpanded ? 'true' : 'false'}
        data-depth={node.depth}
        className={`relative flex items-center p-2 hover:bg-gray-700 cursor-pointer text-gray-100 select-none ${isDragging ? 'bg-gray-600 ring-2 ring-gray-500 ring-inset is-dragging' : ''} ${isActive && !isDragging ? 'bg-gray-600' : ''} ${isSelected ? 'bg-gray-500' : ''} ${isDragHighlighted && !isDragging ? 'bg-gray-500 ring-2 ring-gray-400 ring-inset' : ''}`}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
      >
        {/* 未読インジケーター - 左下角の三角形切り欠き、depthに応じた位置 */}
        <UnreadBadge isUnread={isUnread} showIndicator={true} depth={node.depth} />
        {/* 展開/折りたたみボタン - サイズ縮小版 */}
        {/* 子がある場合はボタン、ない場合は同じ幅のプレースホルダー */}
        {hasChildren ? (
          <button
            data-testid="expand-button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="mr-1 w-3 h-3 flex items-center justify-center text-[10px] leading-none"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <div className="mr-1 w-3 h-3 flex-shrink-0" />
        )}

        {/* ファビコン表示 */}
        {getTabInfo && tabInfo ? (
          <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0">
            {tabInfo.favIconUrl ? (
              <img
                src={tabInfo.favIconUrl}
                alt="Favicon"
                className="w-full h-full object-contain"
              />
            ) : (
              <div
                data-testid="default-icon"
                className="w-full h-full bg-gray-300 rounded-sm"
              />
            )}
          </div>
        ) : getTabInfo && !tabInfo ? (
          /* タブ情報ロード中のプレースホルダー */
          <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0">
            <div
              data-testid="default-icon"
              className="w-full h-full bg-gray-300 rounded-sm animate-pulse"
            />
          </div>
        ) : null}

        {/* タブの内容 - justify-betweenで閉じるボタンを右端に固定 */}
        <div
          data-testid="tab-content"
          className="flex-1 flex items-center justify-between min-w-0"
        >
          {/* タブタイトルエリア - 左側エリア */}
          {/* 休止タブにグレーアウトスタイルを適用 */}
          <div data-testid="title-area" className="flex items-center min-w-0 flex-1">
            {/* タブタイトル表示 - フォントサイズはCSS変数から継承 */}
            {/* 休止タブにグレーアウトスタイルを適用 */}
            {/* getDisplayTitleでスタートページ/新しいタブタイトルを変換 */}
            <span
              className={`truncate ${tabInfo?.discarded ? 'text-gray-500' : ''}`}
              data-testid={tabInfo?.discarded ? 'discarded-tab-title' : 'tab-title'}
            >
              {getTabInfo ? (tabInfo ? getDisplayTitle({ title: tabInfo.title, url: tabInfo.url || '', status: tabInfo.status }) : 'Loading...') : `Tab ${node.tabId}`}
            </span>
          </div>
          {/* 右端固定コンテナ - 閉じるボタン */}
          {/* 親タブへの不要なバッジ表示は削除 */}
          {/* 未読の子タブがある場合でも、親タブに未読子タブ数のバッジを表示しない */}
          <div
            data-testid="right-actions-container"
            className="flex items-center flex-shrink-0 ml-2"
          >
            {/* 閉じるボタン - 常にDOMに存在し、visible/invisibleで制御してサイズ変化を防止 */}
            <div
              data-testid="close-button-wrapper"
              className={`flex-shrink-0 ${isHovered ? 'visible' : 'invisible'}`}
            >
              <CloseButton onClose={handleCloseClick} />
            </div>
          </div>
        </div>
      </div>

      {/* コンテキストメニュー */}
      {/* 複数選択時は選択されたすべてのタブIDを使用 */}
      {contextMenuOpen && (
        <ContextMenu
          targetTabIds={isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId]}
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuOpen(false)}
          hasChildren={hasChildren}
          tabUrl={tabInfo?.url || 'about:blank'}
          views={views}
          currentViewId={currentViewId}
          onMoveToView={onMoveToView}
          groups={groups}
          onAddToGroup={onAddToGroup}
        />
      )}

      {/* 子ノードの再帰的レンダリング */}
      {hasChildren && node.isExpanded && (
        <div>
          {node.children.map((child) => (
            <DraggableTreeNodeItem
              key={child.id}
              node={child}
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
              globalIsDragging={globalIsDragging}
              activeNodeId={activeNodeId}
              onSnapshot={onSnapshot}
              views={views}
              currentViewId={currentViewId}
              onMoveToView={onMoveToView}
              groups={groups}
              onAddToGroup={onAddToGroup}
              dragItemProps={getItemPropsForNode?.(child.id, child.tabId)}
              isDragging={isNodeDragging?.(child.id)}
              getItemPropsForNode={getItemPropsForNode}
              isNodeDragging={isNodeDragging}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * 非ドラッグ可能なツリーノード項目コンポーネント
 * コンテキストメニュー機能を追加
 * 未読バッジ表示を追加
 * タブ情報（タイトル、ファビコン）表示を追加
 * 選択状態管理を追加
 */
const TreeNodeItem: React.FC<TreeNodeItemProps> = ({
  node,
  onNodeClick,
  onToggleExpand,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  getTabInfo,
  isNodeSelected,
  onSelect,
  getSelectedTabIds,
  onSnapshot,
  views,
  currentViewId,
  onMoveToView,
  groups,
  onAddToGroup,
}) => {
  const hasChildren = node.children && node.children.length > 0;
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  // ホバー状態管理
  const [isHovered, setIsHovered] = useState(false);
  const { executeAction } = useMenuActions();

  const isUnread = isTabUnread ? isTabUnread(node.tabId) : false;
  const isActive = activeTabId === node.tabId;
  const tabInfo = getTabInfo ? getTabInfo(node.tabId) : undefined;
  const isSelected = isNodeSelected ? isNodeSelected(node.id) : false;

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  const handleCloseClick = () => {
    chrome.tabs.remove(node.tabId);
  };

  // 右クリック時のコンテキストメニュー表示
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  // コンテキストメニューのアクション実行
  // snapshotアクションにはonSnapshotコールバックを渡す
  // 複数選択時は選択されたすべてのタブIDを使用
  const handleContextMenuAction = (action: MenuAction) => {
    const targetTabIds = isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId];
    executeAction(action, targetTabIds, { url: tabInfo?.url || 'about:blank', onSnapshot });
  };

  // クリック時に選択状態を処理
  const handleNodeClick = (e: React.MouseEvent) => {
    // 選択機能が有効な場合は選択処理を行う
    if (onSelect) {
      onSelect(node.id, {
        shift: e.shiftKey,
        ctrl: e.ctrlKey || e.metaKey,
      });
    }
    // タブをアクティブにする
    onNodeClick(node.tabId);
  };

  return (
    <div>
      {/* ノードの内容 */}
      <div
        data-testid={`tree-node-${node.tabId}`}
        data-node-id={node.id}
        data-expanded={node.isExpanded ? 'true' : 'false'}
        data-depth={node.depth}
        className={`relative flex items-center p-2 hover:bg-gray-700 cursor-pointer text-gray-100 select-none ${isActive ? 'bg-gray-600' : ''} ${isSelected ? 'bg-gray-500' : ''}`}
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
        onClick={handleNodeClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* 未読インジケーター - 左下角の三角形切り欠き、depthに応じた位置 */}
        <UnreadBadge isUnread={isUnread} showIndicator={true} depth={node.depth} />
        {/* 展開/折りたたみボタン - サイズ縮小版 */}
        {/* 子がある場合はボタン、ない場合は同じ幅のプレースホルダー */}
        {hasChildren ? (
          <button
            data-testid="expand-button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            className="mr-1 w-3 h-3 flex items-center justify-center text-[10px] leading-none"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <div className="mr-1 w-3 h-3 flex-shrink-0" />
        )}

        {/* ファビコン表示 */}
        {getTabInfo && tabInfo ? (
          <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0">
            {tabInfo.favIconUrl ? (
              <img
                src={tabInfo.favIconUrl}
                alt="Favicon"
                className="w-full h-full object-contain"
              />
            ) : (
              <div
                data-testid="default-icon"
                className="w-full h-full bg-gray-300 rounded-sm"
              />
            )}
          </div>
        ) : getTabInfo && !tabInfo ? (
          /* タブ情報ロード中のプレースホルダー */
          <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0">
            <div
              data-testid="default-icon"
              className="w-full h-full bg-gray-300 rounded-sm animate-pulse"
            />
          </div>
        ) : null}

        {/* タブの内容 - justify-betweenで閉じるボタンを右端に固定 */}
        <div
          data-testid="tab-content"
          className="flex-1 flex items-center justify-between min-w-0"
        >
          {/* タブタイトルエリア - 左側エリア */}
          {/* 休止タブにグレーアウトスタイルを適用 */}
          <div data-testid="title-area" className="flex items-center min-w-0 flex-1">
            {/* タブタイトル表示 - フォントサイズはCSS変数から継承 */}
            {/* 休止タブにグレーアウトスタイルを適用 */}
            {/* getDisplayTitleでスタートページ/新しいタブタイトルを変換 */}
            <span
              className={`truncate ${tabInfo?.discarded ? 'text-gray-500' : ''}`}
              data-testid={tabInfo?.discarded ? 'discarded-tab-title' : 'tab-title'}
            >
              {getTabInfo ? (tabInfo ? getDisplayTitle({ title: tabInfo.title, url: tabInfo.url || '', status: tabInfo.status }) : 'Loading...') : `Tab ${node.tabId}`}
            </span>
          </div>
          {/* 右端固定コンテナ - 閉じるボタン */}
          {/* 親タブへの不要なバッジ表示は削除 */}
          {/* 未読の子タブがある場合でも、親タブに未読子タブ数のバッジを表示しない */}
          <div
            data-testid="right-actions-container"
            className="flex items-center flex-shrink-0 ml-2"
          >
            {/* 閉じるボタン - 常にDOMに存在し、visible/invisibleで制御してサイズ変化を防止 */}
            <div
              data-testid="close-button-wrapper"
              className={`flex-shrink-0 ${isHovered ? 'visible' : 'invisible'}`}
            >
              <CloseButton onClose={handleCloseClick} />
            </div>
          </div>
        </div>
      </div>

      {/* コンテキストメニュー */}
      {/* 複数選択時は選択されたすべてのタブIDを使用 */}
      {contextMenuOpen && (
        <ContextMenu
          targetTabIds={isSelected && getSelectedTabIds ? getSelectedTabIds() : [node.tabId]}
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuOpen(false)}
          hasChildren={hasChildren}
          tabUrl={tabInfo?.url || 'about:blank'}
          views={views}
          currentViewId={currentViewId}
          onMoveToView={onMoveToView}
          groups={groups}
          onAddToGroup={onAddToGroup}
        />
      )}

      {/* 子ノードの再帰的レンダリング */}
      {hasChildren && node.isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              onNodeClick={onNodeClick}
              onToggleExpand={onToggleExpand}
              isDraggable={false}
              isTabUnread={isTabUnread}
              getUnreadChildCount={getUnreadChildCount}
              activeTabId={activeTabId}
              getTabInfo={getTabInfo}
              isNodeSelected={isNodeSelected}
              onSelect={onSelect}
              getSelectedTabIds={getSelectedTabIds}
              onSnapshot={onSnapshot}
              views={views}
              currentViewId={currentViewId}
              onMoveToView={onMoveToView}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// DragMonitorコンポーネントとcollectAllNodeIds関数は削除（自前useDragDropに統合）

/**
 * グループノードかどうかを判定するヘルパー関数
 * TreeStateManager.createGroupWithRealTabで作成されたノードは:
 * - idが'group-'で始まる
 * - tabIdは正の値（実タブ）
 *
 * 注意: グループ化は実タブを使用するように変更されたため、
 * tabIdの符号ではなくIDプレフィックスのみで判定する
 */
const isGroupNode = (node: TabNode): boolean => {
  return node.id.startsWith('group-');
};

/**
 * グループノードヘッダーコンポーネント
 * グループをツリー内に統合表示するためのヘッダー
 */
interface GroupNodeHeaderProps {
  group: Group;
  onToggle: (groupId: string) => void;
}

const GroupNodeHeader: React.FC<GroupNodeHeaderProps> = ({ group, onToggle }) => {
  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(group.id);
  };

  return (
    <div
      data-testid={`group-tree-node-${group.id}`}
      className="flex items-center p-2 bg-gray-800 hover:bg-gray-700 cursor-pointer"
      style={{ paddingLeft: '8px' }}
    >
      {/* 展開/折りたたみボタン */}
      <button
        data-testid={`toggle-expand-${group.id}`}
        onClick={handleToggleClick}
        className="mr-2 w-4 h-4 flex items-center justify-center text-gray-300"
        aria-label={group.isExpanded ? 'Collapse' : 'Expand'}
      >
        {group.isExpanded ? '▼' : '▶'}
      </button>

      {/* グループカラーインジケータ */}
      <div
        data-testid={`group-color-indicator-${group.id}`}
        className="mr-2 w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: group.color }}
      />

      {/* グループ名 */}
      <span className="text-sm font-medium truncate text-gray-100">{group.name}</span>
    </div>
  );
};

/**
 * TreeStateManagerのグループノードヘッダーコンポーネント
 * TreeStateManager.createGroupFromTabsで作成されたグループノードを表示
 * 通常のタブとは異なる専用の表示スタイル
 */
interface TreeGroupNodeHeaderProps {
  node: TabNode;
  onToggle: (nodeId: string) => void;
  renderChildren: () => React.ReactNode;
}

const TreeGroupNodeHeader: React.FC<TreeGroupNodeHeaderProps> = ({ node, onToggle, renderChildren }) => {
  const hasChildren = node.children && node.children.length > 0;

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  };

  return (
    <div>
      <div
        data-testid={`group-header-${node.id}`}
        className="flex items-center p-2 bg-gray-800 hover:bg-gray-700 cursor-pointer select-none"
        style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
      >
        {/* 展開/折りたたみボタン */}
        {hasChildren && (
          <button
            data-testid={`toggle-expand-${node.id}`}
            onClick={handleToggleClick}
            className="mr-2 w-4 h-4 flex items-center justify-center text-gray-300"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* グループアイコン（フォルダアイコンとして表示） */}
        <div className="mr-2 w-4 h-4 flex items-center justify-center text-gray-400 flex-shrink-0">
          📁
        </div>

        {/* グループ名（グループIDから抽出またはデフォルト名） */}
        <span className="text-sm font-medium truncate text-gray-100">
          グループ
        </span>

        {/* 子タブ数の表示 */}
        {hasChildren && (
          <span className="ml-2 text-xs text-gray-400">
            ({node.children.length})
          </span>
        )}
      </div>

      {/* 子ノードの表示（展開時のみ） */}
      {node.isExpanded && renderChildren()}
    </div>
  );
};

/**
 * タブツリービューコンポーネント
 * タブのツリー構造を表示し、現在のビューに基づいてフィルタリングする
 * onDragEndが提供されている場合、ドラッグ&ドロップ機能を有効化
 * 未読状態表示機能を追加
 * タブ情報（タイトル、ファビコン）表示機能を追加
 * 選択状態管理機能を追加
 * 隙間ドロップ判定とビジュアルフィードバック
 * スナップショット取得機能を追加
 * グループ機能をツリー内に統合表示
 */
const TabTreeView: React.FC<TabTreeViewProps> = ({
  nodes,
  currentViewId,
  onNodeClick,
  onToggleExpand,
  onDragEnd,
  // onDragOver is not used in the custom D&D implementation
  onDragStart: onDragStartProp,
  onDragCancel: onDragCancelProp,
  // 兄弟としてドロップ（Gapドロップ）時のコールバック
  onSiblingDrop,
  isTabUnread,
  getUnreadChildCount,
  activeTabId,
  getTabInfo,
  isNodeSelected,
  onSelect,
  getSelectedTabIds,
  onSnapshot,
  // グループ機能をツリー内に統合表示
  groups,
  onGroupToggle,
  // グループ追加サブメニュー用
  onAddToGroup,
  // ビュー移動サブメニュー用
  views,
  onMoveToView,
  // ツリー外ドロップで新規ウィンドウ作成
  onExternalDrop,
  // ツリービュー外へのドロップ検知
  onOutsideTreeChange,
  // サイドパネル境界参照
  sidePanelRef,
}) => {
  // コンテナ参照
  const containerRef = useRef<HTMLDivElement>(null);
  // ドラッグ中のグローバル状態とアクティブノードID
  const [globalIsDragging, setGlobalIsDragging] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  // ドロップターゲット状態
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  // tabPositionsもrefで追跡（Gapドロップ時のノードID特定用）
  const tabPositionsRef = useRef<TabPosition[]>([]);
  // ツリービュー外へのドラッグ状態を追跡するref
  const isOutsideTreeRef = useRef<boolean>(false);
  // ドラッグホバー時のブランチ自動展開
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastHoverNodeIdRef = useRef<string | null>(null);

  // currentViewIdでフィルタリング
  const filteredNodes = useMemo(
    () => nodes.filter((node) => node.viewId === currentViewId),
    [nodes, currentViewId]
  );

  // グループ別にタブをグループ化
  const { groupedNodes, ungroupedNodes } = useMemo(() => {
    if (!groups) {
      return { groupedNodes: {}, ungroupedNodes: filteredNodes };
    }

    const grouped: Record<string, TabNode[]> = {};
    const ungrouped: TabNode[] = [];

    filteredNodes.forEach((node) => {
      if (node.groupId && groups[node.groupId]) {
        if (!grouped[node.groupId]) {
          grouped[node.groupId] = [];
        }
        grouped[node.groupId].push(node);
      } else {
        ungrouped.push(node);
      }
    });

    return { groupedNodes: grouped, ungroupedNodes: ungrouped };
  }, [filteredNodes, groups]);

  const isDraggable = !!onDragEnd;

  // ドロップターゲット変更ハンドラ
  const handleDropTargetChange = useCallback((target: DropTarget | null, newTabPositions?: TabPosition[]) => {
    setDropTarget(target);
    if (newTabPositions) {
      tabPositionsRef.current = newTabPositions;
    }
  }, []);

  // ホバータイマーをクリーンアップ
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // アイテムリストをuseDragDrop用に構築
  const items = useMemo(() => {
    const result: Array<{ id: string; tabId: number }> = [];
    const collectItems = (nodeList: TabNode[]) => {
      nodeList.forEach((node) => {
        result.push({ id: node.id, tabId: node.tabId });
        if (node.children && node.children.length > 0 && node.isExpanded) {
          collectItems(node.children);
        }
      });
    };
    collectItems(filteredNodes);
    return result;
  }, [filteredNodes]);

  /**
   * サブツリーノードID取得コールバック
   * 下方向へのドラッグ時、サブツリーサイズを考慮したインデックス調整
   * ノードIDからそのノードと子孫ノードすべてのIDを取得
   */
  const getSubtreeNodeIds = useCallback((nodeId: string): string[] => {
    const result: string[] = [];

    // ノードを探して、そのノードと子孫のIDを収集
    const findAndCollect = (nodeList: TabNode[]): boolean => {
      for (const node of nodeList) {
        if (node.id === nodeId) {
          // 見つかったノードとその子孫を収集
          const collectNodeAndDescendants = (n: TabNode) => {
            result.push(n.id);
            for (const child of n.children) {
              collectNodeAndDescendants(child);
            }
          };
          collectNodeAndDescendants(node);
          return true;
        }
        // 子ノードを再帰的に検索
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

  // 自前D&D hookを使用
  const {
    dragState,
    getItemProps,
    cancelDrag,
  } = useDragDrop({
    containerRef,
    items,
    activationDistance: 8,
    direction: 'vertical',
    // サブツリーサイズを考慮したドロップ位置計算
    getSubtreeNodeIds,
    onDragStart: useCallback((itemId: string, _tabId: number) => {
      setGlobalIsDragging(true);
      setActiveNodeId(itemId);
      // 外部ドロップ連携のため、propsのonDragStartも呼び出す
      // 自前実装では軽量なイベントオブジェクトを渡す
      if (onDragStartProp) {
        onDragStartProp({ active: { id: itemId } } as Parameters<typeof onDragStartProp>[0]);
      }
    }, [onDragStartProp]),
    onDragMove: useCallback((position: { x: number; y: number }, newDropTarget: DropTarget | null) => {
      // ドロップターゲットを更新
      handleDropTargetChange(newDropTarget, tabPositionsRef.current);

      // 外部ドロップ判定（サイドパネル境界を基準にする）
      // サイドパネル内の空白領域へのドラッグでは外部ドロップとしない
      // sidePanelRefが指定されている場合はそちらを使用、そうでない場合はcontainerRefを使用（後方互換性維持）
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

      // 自動展開ロジック（ホバー1秒後に折りたたまれたブランチを展開）
      if (newDropTarget?.type === DropTargetType.Tab && newDropTarget.targetNodeId) {
        const overId = newDropTarget.targetNodeId;

        if (overId !== lastHoverNodeIdRef.current) {
          // 前回のタイマーをクリア
          if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
          }

          lastHoverNodeIdRef.current = overId;

          // ノードを探す
          const findNode = (nodeList: TabNode[]): TabNode | null => {
            for (const n of nodeList) {
              if (n.id === overId) return n;
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
              onToggleExpand(overId);
              hoverTimerRef.current = null;
              lastHoverNodeIdRef.current = null;
            }, AUTO_EXPAND_HOVER_DELAY_MS);
          }
        }
      } else {
        // Gapの場合はタイマーをクリア
        if (hoverTimerRef.current) {
          clearTimeout(hoverTimerRef.current);
          hoverTimerRef.current = null;
        }
        lastHoverNodeIdRef.current = null;
      }
    }, [nodes, onToggleExpand, handleDropTargetChange, onOutsideTreeChange, sidePanelRef]),
    onDragEnd: useCallback((itemId: string, finalDropTarget: DropTarget | null) => {
      // ドラッグ終了時にフラグをリセット
      setGlobalIsDragging(false);
      setActiveNodeId(null);

      // ホバータイマーをクリア
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      lastHoverNodeIdRef.current = null;

      // ツリー外ドロップの検出
      if (isOutsideTreeRef.current && onExternalDrop) {
        const findTabIdByNodeId = (nodeId: string): number | null => {
          for (const node of nodes) {
            if (node.id === nodeId) return node.tabId;
            const findInChildren = (children: typeof nodes): number | null => {
              for (const child of children) {
                if (child.id === nodeId) return child.tabId;
                const found = findInChildren(child.children);
                if (found !== null) return found;
              }
              return null;
            };
            const found = findInChildren(node.children);
            if (found !== null) return found;
          }
          return null;
        };

        const tabId = findTabIdByNodeId(itemId);
        if (tabId !== null) {
          isOutsideTreeRef.current = false;
          onExternalDrop(tabId);
          handleDropTargetChange(null);
          return;
        }
      }

      isOutsideTreeRef.current = false;

      // Gap判定の場合はonSiblingDropを呼び出す
      if (finalDropTarget && finalDropTarget.type === DropTargetType.Gap && onSiblingDrop) {
        // ドラッグ中のノードとそのサブツリーを除外したtabPositionsを使用
        // calculateDropTargetはドラッグノードを除外したeffectiveTabPositionsでgapIndexを計算するため、
        // aboveNodeId/belowNodeIdの参照も同様に除外リストから取得する必要がある
        const subtreeIds = getSubtreeNodeIds(itemId);
        const subtreeSet = new Set(subtreeIds);
        const effectiveTabPositions = tabPositionsRef.current.filter(pos => !subtreeSet.has(pos.nodeId));
        const gapIndex = finalDropTarget.gapIndex ?? 0;

        let aboveNodeId: string | undefined;
        let belowNodeId: string | undefined;

        if (gapIndex > 0 && gapIndex - 1 < effectiveTabPositions.length) {
          aboveNodeId = effectiveTabPositions[gapIndex - 1]?.nodeId;
        }
        if (gapIndex < effectiveTabPositions.length) {
          belowNodeId = effectiveTabPositions[gapIndex]?.nodeId;
        }

        onSiblingDrop({
          activeNodeId: itemId,
          insertIndex: gapIndex,
          aboveNodeId,
          belowNodeId,
        });
        handleDropTargetChange(null);
        return;
      }

      // Tab判定の場合は元のonDragEndを呼び出す（子として配置）
      if (finalDropTarget?.type === DropTargetType.Tab && onDragEnd) {
        // dnd-kit形式のイベントオブジェクトを構築
        onDragEnd({
          active: { id: itemId },
          over: finalDropTarget.targetNodeId ? { id: finalDropTarget.targetNodeId } : null,
        } as Parameters<typeof onDragEnd>[0]);
      }

      handleDropTargetChange(null);
    }, [nodes, onDragEnd, onSiblingDrop, onExternalDrop, handleDropTargetChange, getSubtreeNodeIds]),
    onDragCancel: useCallback(() => {
      setGlobalIsDragging(false);
      setActiveNodeId(null);

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
        hoverTimerRef.current = null;
      }
      lastHoverNodeIdRef.current = null;
      handleDropTargetChange(null);

      if (onDragCancelProp) {
        onDragCancelProp();
      }
    }, [onDragCancelProp, handleDropTargetChange]),
    onExternalDrop,
    // サイドパネル境界を基準にドラッグアウト判定
    // サイドパネル内の空白領域へのドラッグでは新規ウィンドウを作成しない
    dragOutBoundaryRef: sidePanelRef,
  });

  // 自動スクロールフックを使用
  const { handleAutoScroll, stopAutoScroll } = useAutoScroll(containerRef, {
    threshold: 50,
    speed: 8,
    clampToContent: true,
  });

  // ドラッグ中の自動スクロール処理
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

  // tabPositionsRefを更新
  useEffect(() => {
    if (dragState.isDragging) {
      const container = containerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const scrollTop = container.scrollTop || 0;
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

        tabPositionsRef.current = tabPositions;
      }
    }
  }, [dragState.isDragging, dragState.currentPosition]);

  // ESCキーでドラッグキャンセル
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && dragState.isDragging) {
        cancelDrag();
      }
    };

    if (dragState.isDragging) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [dragState.isDragging, cancelDrag]);

  // getItemPropsをラップして子ノード用に提供
  const getItemPropsForNode = useCallback((nodeId: string, tabId: number) => {
    return getItemProps(nodeId, tabId);
  }, [getItemProps]);

  // ノードがドラッグ中かどうかを判定
  const isNodeDragging = useCallback((nodeId: string) => {
    return dragState.isDragging && dragState.draggedItemId === nodeId;
  }, [dragState.isDragging, dragState.draggedItemId]);

  // ドロップインジケーターの位置を計算
  // Y座標（top）も計算してDropIndicatorに渡す
  const dropIndicatorPosition = useMemo(() => {
    if (!dropTarget || dropTarget.type !== DropTargetType.Gap) {
      return null;
    }
    const gapIndex = dropTarget.gapIndex ?? 0;

    // adjacentNodeIdsを使って元のtabPositions（ドラッグ中ノード含む）での位置を計算
    // これにより、プレースホルダーがドラッグ中タブの中央に表示される問題を回避
    const aboveNodeId = dropTarget.adjacentNodeIds?.aboveNodeId;
    const belowNodeId = dropTarget.adjacentNodeIds?.belowNodeId;
    const topY = calculateIndicatorYByNodeIds(aboveNodeId, belowNodeId, tabPositionsRef.current);

    return {
      index: gapIndex,
      depth: dropTarget.adjacentDepths?.below ?? dropTarget.adjacentDepths?.above ?? 0,
      topY,
    };
  }, [dropTarget]);

  // ドラッグ中の横スクロール防止
  // isDraggingがtrueの間はoverflow-x: hiddenを適用
  const containerClassName = useMemo(() => {
    const baseClass = 'relative';
    if (globalIsDragging) {
      return `${baseClass} overflow-x-hidden is-dragging`;
    }
    return baseClass;
  }, [globalIsDragging]);

  // タブノードをレンダリングするヘルパー関数
  // グループノード（TreeStateManager作成）の場合は専用ヘッダーを表示
  const renderTabNode = (node: TabNode): React.ReactNode => {
    // グループノードの場合は専用コンポーネントでレンダリング
    if (isGroupNode(node)) {
      return (
        <TreeGroupNodeHeader
          key={node.id}
          node={node}
          onToggle={onToggleExpand}
          renderChildren={() => (
            <>
              {node.children.map((child) => renderTabNode(child))}
            </>
          )}
        />
      );
    }

    if (isDraggable) {
      return (
        <DraggableTreeNodeItem
          key={node.id}
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
          isDragHighlighted={
            dropTarget?.type === DropTargetType.Tab &&
            dropTarget.targetNodeId === node.id
          }
          globalIsDragging={globalIsDragging}
          activeNodeId={activeNodeId}
          onSnapshot={onSnapshot}
          views={views}
          currentViewId={currentViewId}
          onMoveToView={onMoveToView}
          groups={groups}
          onAddToGroup={onAddToGroup}
          dragItemProps={getItemPropsForNode(node.id, node.tabId)}
          isDragging={isNodeDragging(node.id)}
          getItemPropsForNode={getItemPropsForNode}
          isNodeDragging={isNodeDragging}
        />
      );
    }
    return (
      <TreeNodeItem
        key={node.id}
        node={node}
        onNodeClick={onNodeClick}
        onToggleExpand={onToggleExpand}
        isDraggable={false}
        isTabUnread={isTabUnread}
        getUnreadChildCount={getUnreadChildCount}
        activeTabId={activeTabId}
        getTabInfo={getTabInfo}
        isNodeSelected={isNodeSelected}
        onSelect={onSelect}
        getSelectedTabIds={getSelectedTabIds}
        onSnapshot={onSnapshot}
        views={views}
        currentViewId={currentViewId}
        onMoveToView={onMoveToView}
        groups={groups}
        onAddToGroup={onAddToGroup}
      />
    );
  };

  const content = (
    <div ref={containerRef} className={containerClassName} data-drag-container>
      {/* グループとそのタブを表示 */}
      {groups && onGroupToggle && Object.entries(groups).map(([groupId, group]) => {
        const childNodes = groupedNodes[groupId] || [];
        return (
          <div key={groupId}>
            <GroupNodeHeader group={group} onToggle={onGroupToggle} />
            {/* グループ内のタブ（展開時のみ表示） */}
            {group.isExpanded && childNodes.map((node) => renderTabNode(node))}
          </div>
        );
      })}

      {/* グループに属さないタブを表示 */}
      {ungroupedNodes.map((node) => renderTabNode(node))}
      {/* ドロップインジケーター表示 */}
      {/* topPositionを渡して正しい位置にインジケーターを表示 */}
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

  // ドラッグ中のノード情報を取得
  const draggedNode = useMemo(() => {
    if (!dragState.isDragging || !dragState.draggedItemId) return null;
    const findNode = (nodeList: TabNode[]): TabNode | null => {
      for (const n of nodeList) {
        if (n.id === dragState.draggedItemId) return n;
        if (n.children && n.children.length > 0) {
          const found = findNode(n.children);
          if (found) return found;
        }
      }
      return null;
    };
    return findNode(nodes);
  }, [dragState.isDragging, dragState.draggedItemId, nodes]);

  // ドラッグオーバーレイ用のタブ情報
  const draggedTabInfo = draggedNode && getTabInfo ? getTabInfo(draggedNode.tabId) : undefined;

  return (
    <div data-testid="tab-tree-view" className="w-full select-none">
      {filteredNodes.length === 0 ? (
        <div className="p-4 text-gray-400 text-sm">No tabs in this view</div>
      ) : (
        <>
          {content}
          {/* ドラッグオーバーレイ - 自前D&D実装 */}
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
                {/* ファビコン */}
                {draggedTabInfo?.favIconUrl ? (
                  <img
                    src={draggedTabInfo.favIconUrl}
                    alt="Favicon"
                    className="w-4 h-4 mr-2 flex-shrink-0"
                  />
                ) : (
                  <div className="w-4 h-4 mr-2 bg-gray-300 rounded-sm flex-shrink-0" />
                )}
                {/* タイトル */}
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
