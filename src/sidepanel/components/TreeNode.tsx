import React, { useState } from 'react';
import type { TabNode, TabInfo, MenuAction } from '@/types';
import UnreadBadge from './UnreadBadge';
import CloseButton from './CloseButton';
import ConfirmDialog from './ConfirmDialog';
import { ContextMenu } from './ContextMenu';

interface TreeNodeProps {
  node: TabNode;
  tab: TabInfo;
  isUnread: boolean;
  isActive: boolean;
  isPinned?: boolean; // Task 15.2: ピン留め状態
  isGrouped?: boolean; // Task 15.2: グループ化状態
  isDiscarded?: boolean; // Task 4.1 (tab-tree-bugfix): 休止タブ状態（グレーアウト表示）
  showUnreadIndicator?: boolean;
  closeWarningThreshold?: number; // Task 11.3: Requirement 8.5 - 警告閾値
  onActivate: (tabId: number) => void;
  onToggle: (nodeId: string) => void;
  onClose: (tabId: number, hasChildren: boolean) => void;
  onContextMenu?: (action: MenuAction, tabIds: number[]) => void; // Task 15.2: コンテキストメニューアクション
}

/**
 * Task 4.2 (Requirement 4.3): スタートページURLを判定するヘルパー関数
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
 * Task 4.2 (Requirement 4.3): 新しいタブURLを判定するヘルパー関数
 * Vivaldi/Chromeの新しいタブ関連のURLを検出（スタートページ以外）
 */
const isNewTabUrl = (url: string): boolean => {
  if (!url) return false;

  const newTabUrlPatterns = [
    /^chrome:\/\/newtab/,
    /^chrome-extension:\/\//,
    /^vivaldi:\/\/newtab/,
    /^about:blank$/,
  ];

  return newTabUrlPatterns.some(pattern => pattern.test(url));
};

/**
 * Task 4.2 (Requirement 4.1, 4.2, 4.3, 4.4): 表示するタブタイトルを決定するヘルパー関数
 * - Loading状態の場合: 「Loading...」
 * - スタートページURLの場合: 「スタートページ」
 * - 新しいタブURLの場合: 「新しいタブ」
 * - それ以外: 元のタイトル
 */
const getDisplayTitle = (tab: { title: string; url: string; status: 'loading' | 'complete' }): string => {
  // Requirement 4.4: Loading状態の場合
  if (tab.status === 'loading') {
    return 'Loading...';
  }

  // Requirement 2.2: スタートページURLの場合
  if (isStartPageUrl(tab.url)) {
    return 'スタートページ';
  }

  // Requirement 4.3: 新しいタブURLの場合
  if (isNewTabUrl(tab.url)) {
    return '新しいタブ';
  }

  // Requirement 4.1, 4.2: 通常のタイトル
  return tab.title;
};

/**
 * 個別タブノードのUIコンポーネント
 * ファビコン、タイトル、インデント、展開/折りたたみトグルを表示
 *
 * Requirements: 8.3, 8.4 (タブ閉じ時の確認ダイアログ), 8.5 (警告閾値のカスタマイズ), 12.1 (コンテキストメニュー)
 * Task 4.2: 4.1, 4.2, 4.3, 4.4 (タブタイトル表示改善)
 * Task 4.1 (tab-tree-bugfix): 3.1, 3.2 (休止タブのグレーアウト表示)
 */
const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  tab,
  isUnread,
  isActive,
  isPinned = false,
  isGrouped = false,
  isDiscarded = false, // Task 4.1 (tab-tree-bugfix): 休止タブのグレーアウト表示
  showUnreadIndicator = true,
  closeWarningThreshold = 3, // Task 11.3: デフォルト閾値は3
  onActivate,
  onToggle,
  onClose,
  onContextMenu,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false); // Task 15.2: コンテキストメニューの表示状態
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 }); // Task 15.2: メニュー表示位置
  const hasChildren = node.children && node.children.length > 0;
  const indentSize = node.depth * 20 + 8;

  // Task 11.2: サブツリーのタブ数を再帰的に計算（親タブ自身を含む）
  const countTabsInSubtree = (currentNode: TabNode): number => {
    let count = 1; // 親タブ自身
    if (currentNode.children && currentNode.children.length > 0) {
      currentNode.children.forEach((child) => {
        count += countTabsInSubtree(child);
      });
    }
    return count;
  };

  const handleNodeClick = () => {
    onActivate(tab.id);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(node.id);
  };

  // Task 11.2, 11.3: Requirement 8.3, 8.5 - 折りたたまれたブランチを持つ親タブ閉じ時の確認（閾値チェック）
  const handleCloseClick = () => {
    // 折りたたまれた子ノードがある場合、かつサブツリーのタブ数が閾値以上の場合のみ確認ダイアログを表示
    if (hasChildren && !node.isExpanded) {
      const tabCount = countTabsInSubtree(node);
      if (tabCount >= closeWarningThreshold) {
        setShowConfirmDialog(true);
      } else {
        // タブ数が閾値未満の場合は確認不要、直接閉じる
        onClose(tab.id, hasChildren);
      }
    } else {
      // 確認不要の場合は直接閉じる
      onClose(tab.id, hasChildren);
    }
  };

  // Task 11.2: Requirement 8.4 - 確認後にタブを閉じる
  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    onClose(tab.id, hasChildren);
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
  };

  // Task 15.2: Requirement 12.1 - 右クリック時のコンテキストメニュー表示
  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  // Task 15.2: Requirement 12.3 - コンテキストメニューのアクション実行
  const handleContextMenuAction = (action: MenuAction) => {
    if (onContextMenu) {
      onContextMenu(action, [tab.id]);
    }
  };

  return (
    <>
      <div
        data-testid={`tree-node-${tab.id}`}
        data-node-id={node.id}
        data-expanded={node.isExpanded ? 'true' : 'false'}
        data-depth={node.depth}
        data-parent-group={node.groupId || ''}
        className={`flex items-center p-2 hover:bg-gray-100 cursor-pointer select-none ${
          isActive ? 'bg-gray-200' : ''
        }`}
        style={{ paddingLeft: `${indentSize}px` }}
        onClick={handleNodeClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleRightClick}
      >
        {/* 展開/折りたたみトグルボタン */}
        {hasChildren && (
          <button
            data-testid="expand-button"
            onClick={handleToggleClick}
            className="mr-2 w-4 h-4 flex items-center justify-center text-gray-600"
            aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
          >
            {node.isExpanded ? '▼' : '▶'}
          </button>
        )}

        {/* ファビコン */}
        <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0">
          {tab.favIconUrl ? (
            <img
              src={tab.favIconUrl}
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

        {/* タブコンテンツ - タイトルエリアと閉じるボタンを左右に分離 */}
        <div
          data-testid="tab-content"
          className="flex-1 flex items-center justify-between min-w-0"
        >
          {/* タブタイトルエリア - Task 4.2: タイトル表示改善 */}
          {/* Task 4.1 (tab-tree-bugfix): 休止タブにグレーアウトスタイルを適用 */}
          <div className="flex items-center min-w-0 flex-1">
            <span
              className={`truncate ${isDiscarded ? 'text-gray-400' : ''}`}
              data-testid={isDiscarded ? 'discarded-tab-title' : 'tab-title'}
            >
              {getDisplayTitle(tab)}
            </span>

            {/* ローディングインジケータ - Loading...テキスト表示時も回転アイコンを表示 */}
            {tab.status === 'loading' && (
              <span
                data-testid="loading-indicator"
                className="ml-2 text-xs text-gray-500 flex-shrink-0"
              >
                ⟳
              </span>
            )}

            {/* 未読インジケータ */}
            <UnreadBadge isUnread={isUnread} showIndicator={showUnreadIndicator} />
          </div>

          {/* 閉じるボタン (ホバー時のみ表示) - 常に右端に固定 */}
          {isHovered && <CloseButton onClose={handleCloseClick} />}
        </div>
      </div>

      {/* Task 11.2: Requirement 8.3, 8.4 - 確認ダイアログ */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="タブを閉じる"
        message="このタブと配下のすべてのタブを閉じますか？"
        tabCount={countTabsInSubtree(node)}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />

      {/* Task 15.2: Requirement 12.1 - コンテキストメニュー */}
      {contextMenuOpen && (
        <ContextMenu
          targetTabIds={[tab.id]}
          position={contextMenuPosition}
          onAction={handleContextMenuAction}
          onClose={() => setContextMenuOpen(false)}
          isPinned={isPinned}
          isGrouped={isGrouped}
          hasChildren={hasChildren}
          tabUrl={tab.url}
        />
      )}
    </>
  );
};

export default TreeNode;
