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
  isPinned?: boolean; // ピン留め状態
  isGrouped?: boolean; // グループ化状態
  isDiscarded?: boolean; // 休止タブ状態（グレーアウト表示）
  showUnreadIndicator?: boolean;
  closeWarningThreshold?: number; // 警告閾値
  onActivate: (tabId: number) => void;
  onToggle: (nodeId: string) => void;
  onClose: (tabId: number, hasChildren: boolean) => void;
  onContextMenu?: (action: MenuAction, tabIds: number[]) => void; // コンテキストメニューアクション
}

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
 * タイトルがURL形式かどうかを判定
 * PDFなど、file://でも正しいタイトルが設定されている場合がある
 */
const isTitleUrlFormat = (title: string): boolean => {
  // スキーム://で始まる場合はURL形式とみなす
  return /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(title);
};

/**
 * システムURLのフレンドリー名マッピング
 */
const SYSTEM_URL_FRIENDLY_NAMES: Record<string, string> = {
  'chrome://settings': '設定',
  'chrome://extensions': '拡張機能',
  'chrome://history': '履歴',
  'chrome://downloads': 'ダウンロード',
  'chrome://bookmarks': 'ブックマーク',
  'vivaldi://settings': '設定',
  'vivaldi://extensions': '拡張機能',
  'chrome://vivaldi-webui/startpage': 'スタートページ',
  'chrome://newtab': '新しいタブ',
};

/**
 * 表示するタブタイトルを決定するヘルパー関数
 *
 * 処理優先順位:
 * 1. Loading状態の場合: 「Loading...」
 * 2. タイトルがURL形式でない場合: そのまま表示（settings.html等の拡張機能ページを含む）
 * 3. スタートページURLの場合: 「スタートページ」
 * 4. 新しいタブURLの場合: 「新しいタブ」
 * 5. システムページでタイトルがURL形式の場合: フレンドリー名に置換
 * 6. file://でタイトルがURL形式の場合: ファイル名に置換
 * 7. それ以外: 元のタイトル
 *
 * chrome.tabs.Tab.titleをそのまま使用することを優先
 * - settings.htmlやgroup.htmlはHTMLの<title>タグで適切なタイトルを提供
 * - タイトルが正しく設定されている場合はそのまま表示
 *
 * Vivaldi専用URL（chrome://vivaldi-webui/startpage）の場合、
 * 拡張機能にはURLが公開されないことがあるため、タイトルもチェックする
 *
 * タイトルがURL形式の場合のみフレンドリー名に置き換え。
 * PDFなど既にタイトルが設定されている場合はそのまま表示。
 */
const getDisplayTitle = (tab: { title: string; url: string; status: 'loading' | 'complete' }): string => {
  const title = tab.title || '';
  const url = tab.url || '';

  // Loading状態の場合
  if (tab.status === 'loading') {
    return 'Loading...';
  }

  // タイトルがURL形式でない場合はそのまま表示
  // これにより、settings.html（タイトル: "Settings"）やgroup.html（タイトル: "Group"）など、
  // HTMLの<title>タグで適切なタイトルが設定されているページは正しく表示される
  if (!isTitleUrlFormat(title)) {
    return title;
  }

  // スタートページURLの場合
  // URLをチェック、またはタイトルがURL形式でスタートページパターンの場合もチェック
  if (isStartPageUrl(url) || isStartPageUrl(title)) {
    return 'スタートページ';
  }

  // 新しいタブURLの場合
  // URLをチェック、またはタイトルがURL形式で新しいタブパターンの場合もチェック
  if (isNewTabUrl(url) || isNewTabUrl(title)) {
    return '新しいタブ';
  }

  // タイトルがURL形式の場合、フレンドリー名があれば使用
  for (const [urlPattern, friendlyName] of Object.entries(SYSTEM_URL_FRIENDLY_NAMES)) {
    if (url.startsWith(urlPattern)) {
      return friendlyName;
    }
  }

  // file://の場合はファイル名を抽出
  if (url.startsWith('file://') && isTitleUrlFormat(title)) {
    const filename = url.split('/').pop() || title;
    return decodeURIComponent(filename);
  }

  // 通常のタイトル
  return title;
};

/**
 * 個別タブノードのUIコンポーネント
 * ファビコン、タイトル、インデント、展開/折りたたみトグルを表示
 *
 * タブ閉じ時の確認ダイアログ、警告閾値のカスタマイズ、コンテキストメニュー
 * タブタイトル表示改善
 * 休止タブのグレーアウト表示
 */
const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  tab,
  isUnread,
  isActive,
  isPinned = false,
  isGrouped = false,
  isDiscarded = false, // 休止タブのグレーアウト表示
  showUnreadIndicator = true,
  closeWarningThreshold = 3, // デフォルト閾値は3
  onActivate,
  onToggle,
  onClose,
  onContextMenu,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false); // コンテキストメニューの表示状態
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 }); // メニュー表示位置
  const hasChildren = node.children && node.children.length > 0;
  const indentSize = node.depth * 20 + 8;

  // サブツリーのタブ数を再帰的に計算（親タブ自身を含む）
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

  // 折りたたまれたブランチを持つ親タブ閉じ時の確認（閾値チェック）
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

  // 確認後にタブを閉じる
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

  // 右クリック時のコンテキストメニュー表示
  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  // コンテキストメニューのアクション実行
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
        className={`relative flex items-center p-2 hover:bg-gray-100 cursor-pointer select-none ${
          isActive ? 'bg-gray-200' : ''
        }`}
        style={{ paddingLeft: `${indentSize}px` }}
        onClick={handleNodeClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleRightClick}
      >
        {/* 未読インジケーター - 左下角の三角形切り欠き、depthに応じた位置 */}
        <UnreadBadge isUnread={isUnread} showIndicator={showUnreadIndicator} depth={node.depth} />

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

        {/* タブコンテンツ - タイトルエリアと右端固定アクションを左右に分離 */}
        <div
          data-testid="tab-content"
          className="flex-1 flex items-center justify-between min-w-0"
        >
          {/* タブタイトルエリア - タイトル表示改善 */}
          {/* 休止タブにグレーアウトスタイルを適用 */}
          <div data-testid="title-area" className="flex items-center min-w-0 flex-1">
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
          </div>

          {/* 右端固定コンテナ - 閉じるボタン */}
          <div
            data-testid="right-actions-container"
            className="flex items-center flex-shrink-0 ml-2"
          >
            {/* 閉じるボタン (ホバー時のみ表示) - 常に右端に固定 */}
            {isHovered && <CloseButton onClose={handleCloseClick} />}
          </div>
        </div>
      </div>

      {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="タブを閉じる"
        message="このタブと配下のすべてのタブを閉じますか？"
        tabCount={countTabsInSubtree(node)}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />

      {/* コンテキストメニュー */}
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
