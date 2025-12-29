import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { MenuAction, ContextMenuProps, SubMenuItem } from '@/types';
import { SubMenu } from './SubMenu';

// Re-export MenuAction for backward compatibility
export type { MenuAction };

export const ContextMenu: React.FC<ContextMenuProps> = ({
  targetTabIds,
  position,
  onAction,
  onClose,
  isPinned = false,
  isGrouped = false,
  hasChildren = false,
  tabUrl,
  views,
  currentViewId,
  onMoveToView,
  groups,
  onAddToGroup,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const moveToViewButtonRef = useRef<HTMLDivElement>(null);
  const addToGroupButtonRef = useRef<HTMLDivElement>(null);
  const isMultipleSelection = targetTabIds.length > 1;

  // Task 7.2: サブメニューの表示状態（ビュー移動用）
  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  // Task 7.2: サブメニューの親要素の位置（レンダリング中にrefを参照しないよう状態として保持）
  const [subMenuParentRect, setSubMenuParentRect] = useState<DOMRect | null>(null);
  // Task 12.2 (tab-tree-bugfix): グループ追加サブメニューの表示状態
  const [isGroupSubMenuOpen, setIsGroupSubMenuOpen] = useState(false);
  const [groupSubMenuParentRect, setGroupSubMenuParentRect] = useState<DOMRect | null>(null);

  // 画面端での位置調整
  const adjustedPosition = React.useMemo(() => {
    const menuWidth = 200; // メニューの推定幅
    const menuHeight = 300; // メニューの推定高さ

    let { x, y } = position;

    // 右端を超える場合は左に調整
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }

    // 下端を超える場合は上に調整
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    // 最小位置を保証
    x = Math.max(10, x);
    y = Math.max(10, y);

    return { x, y };
  }, [position]);

  // メニュー外クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // クリックイベントを非同期で登録（現在のクリックイベントが終わった後）
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Escapeキーで閉じる
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleMenuItemClick = (action: MenuAction) => {
    onAction(action);
    onClose();
  };

  // Task 7.2: 「別のビューへ移動」サブメニュー用のビューリスト
  // 現在のビューを除外し、移動先ビューのみを表示
  const availableViews = useMemo((): SubMenuItem[] => {
    if (!views || !currentViewId) return [];
    return views
      .filter(v => v.id !== currentViewId)
      .map(v => ({
        id: v.id,
        label: v.name,
      }));
  }, [views, currentViewId]);

  // Task 7.2: ビューが2つ以上ある場合のみ「別のビューへ移動」を表示
  const showMoveToViewMenu = availableViews.length > 0 && onMoveToView;

  // Task 7.2: サブメニューでビューを選択したときのハンドラ
  const handleViewSelect = useCallback((viewId: string) => {
    if (onMoveToView) {
      onMoveToView(viewId, targetTabIds);
      onClose();
    }
  }, [onMoveToView, targetTabIds, onClose]);

  // Task 7.2: 「別のビューへ移動」のホバーハンドラ
  const handleMoveToViewMouseEnter = useCallback(() => {
    // ホバー時にrefから位置を取得して状態に保持
    if (moveToViewButtonRef.current) {
      setSubMenuParentRect(moveToViewButtonRef.current.getBoundingClientRect());
    } else {
      // フォールバック: adjustedPosition を使用
      setSubMenuParentRect(new DOMRect(adjustedPosition.x, adjustedPosition.y, 200, 36));
    }
    setIsSubMenuOpen(true);
  }, [adjustedPosition]);

  const handleMoveToViewMouseLeave = useCallback(() => {
    // SubMenuの外に出た時のみ閉じる（SubMenu内のonMouseLeaveで処理）
  }, []);

  const handleSubMenuClose = useCallback(() => {
    setIsSubMenuOpen(false);
  }, []);

  // Task 12.2 (tab-tree-bugfix): グループ一覧サブメニュー用のアイテムリスト
  const availableGroups = useMemo((): SubMenuItem[] => {
    if (!groups) return [];
    return Object.values(groups).map(g => ({
      id: g.id,
      label: g.name,
    }));
  }, [groups]);

  // Task 12.2 (tab-tree-bugfix): グループが存在し、単一タブ選択時のみサブメニューを表示可能
  const hasAvailableGroups = availableGroups.length > 0;

  // Task 12.2 (tab-tree-bugfix): サブメニューでグループを選択したときのハンドラ
  const handleGroupSelect = useCallback((groupId: string) => {
    if (onAddToGroup) {
      onAddToGroup(groupId, targetTabIds);
      onClose();
    }
  }, [onAddToGroup, targetTabIds, onClose]);

  // Task 12.2 (tab-tree-bugfix): 「グループに追加」のホバーハンドラ
  const handleAddToGroupMouseEnter = useCallback(() => {
    if (!hasAvailableGroups) return; // グループがない場合はサブメニューを表示しない
    if (addToGroupButtonRef.current) {
      setGroupSubMenuParentRect(addToGroupButtonRef.current.getBoundingClientRect());
    } else {
      setGroupSubMenuParentRect(new DOMRect(adjustedPosition.x, adjustedPosition.y, 200, 36));
    }
    setIsGroupSubMenuOpen(true);
  }, [adjustedPosition, hasAvailableGroups]);

  const handleAddToGroupMouseLeave = useCallback(() => {
    // SubMenuの外に出た時のみ閉じる
  }, []);

  const handleGroupSubMenuClose = useCallback(() => {
    setIsGroupSubMenuOpen(false);
  }, []);

  return (
    <div
      ref={menuRef}
      role="menu"
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 min-w-[200px] select-none"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      {/* 閉じる */}
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('close')}
      >
        {isMultipleSelection
          ? `選択されたタブを閉じる (${targetTabIds.length}件)`
          : 'タブを閉じる'}
      </button>

      {/* サブツリーを閉じる（子タブがある場合のみ） */}
      {hasChildren && (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('closeSubtree')}
        >
          サブツリーを閉じる
        </button>
      )}

      {/* 他のタブを閉じる (複数選択時のみ) */}
      {isMultipleSelection && (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('closeOthers')}
        >
          他のタブを閉じる
        </button>
      )}

      <div className="border-t border-gray-700 my-1" />

      {/* 複製 */}
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('duplicate')}
      >
        タブを複製
      </button>

      {/* 再読み込み */}
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('reload')}
      >
        タブを再読み込み
      </button>

      <div className="border-t border-gray-700 my-1" />

      {/* ピン留め/ピン留め解除 */}
      {isPinned ? (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('unpin')}
        >
          ピン留めを解除
        </button>
      ) : (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('pin')}
        >
          タブをピン留め
        </button>
      )}

      <div className="border-t border-gray-700 my-1" />

      {/* 新しいウィンドウで開く */}
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('newWindow')}
      >
        新しいウィンドウで開く
      </button>

      <div className="border-t border-gray-700 my-1" />

      {/* グループ化/グループ解除 */}
      {isGrouped ? (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('ungroup')}
        >
          グループを解除
        </button>
      ) : isMultipleSelection ? (
        // 複数選択時: 従来通りのグループ化ボタン
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('group')}
        >
          選択されたタブをグループ化
        </button>
      ) : (
        // Task 12.2 (tab-tree-bugfix): 単一タブ選択時はグループ一覧サブメニューを表示
        <div
          ref={addToGroupButtonRef}
          className={`relative w-full px-4 py-2 text-left text-sm flex items-center justify-between cursor-default ${
            hasAvailableGroups
              ? 'hover:bg-gray-700 text-gray-100'
              : 'text-gray-500 cursor-not-allowed'
          }`}
          onMouseEnter={handleAddToGroupMouseEnter}
          onMouseLeave={handleAddToGroupMouseLeave}
        >
          <span>グループに追加</span>
          {hasAvailableGroups && <span className="ml-2">▶</span>}
          {isGroupSubMenuOpen && groupSubMenuParentRect && hasAvailableGroups && (
            <SubMenu
              label="グループに追加"
              items={availableGroups}
              onSelect={handleGroupSelect}
              onClose={handleGroupSubMenuClose}
              parentRect={groupSubMenuParentRect}
            />
          )}
        </div>
      )}

      {/* Task 7.2: 別のビューへ移動 (Requirements 18.1, 18.2, 18.3) */}
      {showMoveToViewMenu && (
        <>
          <div className="border-t border-gray-700 my-1" />
          <div
            ref={moveToViewButtonRef}
            className="relative w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100 flex items-center justify-between cursor-default"
            onMouseEnter={handleMoveToViewMouseEnter}
            onMouseLeave={handleMoveToViewMouseLeave}
          >
            <span>別のビューへ移動</span>
            <span className="ml-2">▶</span>
            {isSubMenuOpen && subMenuParentRect && (
              <SubMenu
                label="別のビューへ移動"
                items={availableViews}
                onSelect={handleViewSelect}
                onClose={handleSubMenuClose}
                parentRect={subMenuParentRect}
              />
            )}
          </div>
        </>
      )}

      {/* URLをコピー（単一選択時のみ） */}
      {!isMultipleSelection && tabUrl && (
        <>
          <div className="border-t border-gray-700 my-1" />
          <button
            role="menuitem"
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
            onClick={() => handleMenuItemClick('copyUrl')}
          >
            URLをコピー
          </button>
        </>
      )}

      {/* スナップショットを取得 */}
      <div className="border-t border-gray-700 my-1" />
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('snapshot')}
      >
        スナップショットを取得
      </button>
    </div>
  );
};
