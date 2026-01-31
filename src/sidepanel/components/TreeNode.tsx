import React, { useState } from 'react';
import type { UITabNode, TabNode, TabInfo, MenuAction } from '@/types';
import UnreadBadge from './UnreadBadge';
import CloseButton from './CloseButton';
import ConfirmDialog from './ConfirmDialog';
import { ContextMenu } from './ContextMenu';
import { TREE_INDENT_WIDTH_PX } from '../utils';
import { getVivaldiInternalPageTitle } from '@/utils/vivaldi-internal-pages';

interface TreeNodeProps {
  node: UITabNode;
  tab: TabInfo;
  isUnread: boolean;
  isActive: boolean;
  isPinned?: boolean;
  isGrouped?: boolean;
  isDiscarded?: boolean;
  showUnreadIndicator?: boolean;
  closeWarningThreshold?: number;
  onActivate: (tabId: number) => void;
  onToggle: (tabId: number) => void;
  onClose: (tabId: number, hasChildren: boolean) => void;
  onContextMenu?: (action: MenuAction, tabIds: number[]) => void;
}

/**
 * スタートページURLを判定するヘルパー関数
 * Vivaldi/Chromeのスタートページ関連のURLを検出
 *
 * 注意: chrome://vivaldi-webui/startpage?section=XXX はセクションページなので
 * スタートページとは判定しない（カレンダー、メールなど個別の機能ページ）
 */
const isStartPageUrl = (url: string): boolean => {
  if (!url) return false;

  // ?section= パラメータがある場合は、セクションページなのでスタートページではない
  if (url.includes('?section=')) return false;

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

  if (tab.status === 'loading') {
    return 'Loading...';
  }

  if (!isTitleUrlFormat(title)) {
    return title;
  }

  if (isStartPageUrl(url) || isStartPageUrl(title)) {
    return 'スタートページ';
  }

  if (isNewTabUrl(url) || isNewTabUrl(title)) {
    return '新しいタブ';
  }

  // Vivaldi内部ページ（設定、カレンダーなど）のタイトル生成
  const vivaldiTitle = getVivaldiInternalPageTitle(url);
  if (vivaldiTitle) {
    return vivaldiTitle;
  }

  for (const [urlPattern, friendlyName] of Object.entries(SYSTEM_URL_FRIENDLY_NAMES)) {
    if (url.startsWith(urlPattern)) {
      return friendlyName;
    }
  }

  if (url.startsWith('file://') && isTitleUrlFormat(title)) {
    const filename = url.split('/').pop() || title;
    return decodeURIComponent(filename);
  }

  return title;
};

/**
 * 個別タブノードのUIコンポーネント
 * ファビコン、タイトル、インデント、展開/折りたたみトグルを表示
 */
const TreeNode: React.FC<TreeNodeProps> = ({
  node,
  tab,
  isUnread,
  isActive,
  isPinned = false,
  isGrouped = false,
  isDiscarded = false,
  showUnreadIndicator = true,
  closeWarningThreshold = 3,
  onActivate,
  onToggle,
  onClose,
  onContextMenu,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const hasChildren = node.children && node.children.length > 0;
  const indentSize = node.depth * TREE_INDENT_WIDTH_PX + 8;

  const countTabsInSubtree = (currentNode: TabNode): number => {
    let count = 1;
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
    onToggle(node.tabId);
  };

  const handleCloseClick = () => {
    if (hasChildren && !node.isExpanded) {
      const tabCount = countTabsInSubtree(node);
      if (tabCount >= closeWarningThreshold) {
        setShowConfirmDialog(true);
      } else {
        onClose(tab.id, hasChildren);
      }
    } else {
      onClose(tab.id, hasChildren);
    }
  };

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

  const handleRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPosition({ x: e.clientX, y: e.clientY });
    setContextMenuOpen(true);
  };

  const handleContextMenuAction = (action: MenuAction) => {
    if (onContextMenu) {
      onContextMenu(action, [tab.id]);
    }
  };

  return (
    <>
      <div
        data-testid={`tree-node-${tab.id}`}
        data-node-id={node.tabId}
        data-expanded={node.isExpanded ? 'true' : 'false'}
        data-depth={node.depth}
        className={`relative flex items-center p-2 hover:bg-gray-100 cursor-pointer select-none ${
          isActive ? 'bg-gray-200' : ''
        }`}
        style={{ paddingLeft: `${indentSize}px` }}
        onClick={handleNodeClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleRightClick}
      >
        <UnreadBadge isUnread={isUnread} showIndicator={showUnreadIndicator} depth={node.depth} />

        <div className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0 relative">
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
          {isDiscarded && (
            <div
              data-testid="discarded-favicon-overlay"
              className="absolute inset-0 bg-black/50 rounded-sm"
            />
          )}
          {hasChildren && (node.isExpanded ? isHovered : true) && (
            <div
              data-testid="expand-overlay"
              className="absolute inset-0 flex items-center justify-center cursor-pointer rounded-sm bg-black/50"
              onClick={handleToggleClick}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label={node.isExpanded ? 'Collapse' : 'Expand'}
              role="button"
            >
              <span className="text-white text-[10px]">
                {node.isExpanded ? '▼' : '▶'}
              </span>
            </div>
          )}
        </div>

        <div
          data-testid="tab-content"
          className="flex-1 flex items-center justify-between min-w-0"
        >
          <div data-testid="title-area" className="flex items-center min-w-0 flex-1">
            <span
              className={`truncate ${isDiscarded ? 'text-gray-400' : ''}`}
              data-testid={isDiscarded ? 'discarded-tab-title' : 'tab-title'}
            >
              {getDisplayTitle(tab)}
            </span>

            {tab.status === 'loading' && (
              <span
                data-testid="loading-indicator"
                className="ml-2 text-xs text-gray-500 flex-shrink-0"
              >
                ⟳
              </span>
            )}
          </div>

          <div
            data-testid="right-actions-container"
            className="flex items-center flex-shrink-0 ml-2"
          >
            {isHovered && <CloseButton onClose={handleCloseClick} />}
          </div>
        </div>
      </div>

      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="タブを閉じる"
        message="このタブと配下のすべてのタブを閉じますか？"
        tabCount={countTabsInSubtree(node)}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />

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
