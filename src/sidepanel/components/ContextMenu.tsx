import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import type { MenuAction, ContextMenuProps, SubMenuItem } from '@/types';
import { SubMenu } from './SubMenu';

export type { MenuAction };

export const ContextMenu: React.FC<ContextMenuProps> = ({
  targetTabIds,
  position,
  onAction,
  onClose,
  isPinned = false,
  isGrouped = false,
  isGroupTab = false,
  hasChildren: _hasChildren = false,
  tabUrl,
  views,
  currentViewId,
  onMoveToView,
  currentWindowId: _currentWindowId,
  otherWindows,
  onMoveToWindow,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const moveToViewButtonRef = useRef<HTMLDivElement>(null);
  const moveToWindowButtonRef = useRef<HTMLDivElement>(null);
  const viewSubMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const windowSubMenuCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMultipleSelection = targetTabIds.length > 1;

  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [subMenuParentRect, setSubMenuParentRect] = useState<DOMRect | null>(null);
  const [isWindowSubMenuOpen, setIsWindowSubMenuOpen] = useState(false);
  const [windowSubMenuParentRect, setWindowSubMenuParentRect] = useState<DOMRect | null>(null);

  const adjustedPosition = React.useMemo(() => {
    const menuWidth = 200;
    const menuHeight = 300;

    let { x, y } = position;

    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }

    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }

    x = Math.max(10, x);
    y = Math.max(10, y);

    return { x, y };
  }, [position]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

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

  useEffect(() => {
    const handleWindowBlur = () => {
      onClose();
    };

    window.addEventListener('blur', handleWindowBlur);

    return () => {
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [onClose]);

  const handleMenuItemClick = (action: MenuAction) => {
    onAction(action);
    onClose();
  };

  const availableViews = useMemo((): SubMenuItem[] => {
    if (!views || !currentViewId) return [];
    return views
      .filter(v => v.id !== currentViewId)
      .map(v => ({
        id: v.id,
        label: v.name,
      }));
  }, [views, currentViewId]);

  const showMoveToViewMenu = availableViews.length > 0 && onMoveToView;

  const handleViewSelect = useCallback((viewId: string) => {
    if (onMoveToView) {
      onMoveToView(viewId, targetTabIds);
      onClose();
    }
  }, [onMoveToView, targetTabIds, onClose]);

  const handleMoveToViewMouseEnter = useCallback(() => {
    if (viewSubMenuCloseTimeoutRef.current) {
      clearTimeout(viewSubMenuCloseTimeoutRef.current);
      viewSubMenuCloseTimeoutRef.current = null;
    }
    setIsWindowSubMenuOpen(false);
    if (moveToViewButtonRef.current) {
      setSubMenuParentRect(moveToViewButtonRef.current.getBoundingClientRect());
    } else {
      setSubMenuParentRect(new DOMRect(adjustedPosition.x, adjustedPosition.y, 200, 36));
    }
    setIsSubMenuOpen(true);
  }, [adjustedPosition]);

  const handleMoveToViewMouseLeave = useCallback(() => {
    if (viewSubMenuCloseTimeoutRef.current) {
      clearTimeout(viewSubMenuCloseTimeoutRef.current);
    }
    viewSubMenuCloseTimeoutRef.current = setTimeout(() => {
      setIsSubMenuOpen(false);
    }, 100);
  }, []);

  const handleSubMenuClose = useCallback(() => {
    setIsSubMenuOpen(false);
  }, []);

  const windowSubMenuItems = useMemo((): SubMenuItem[] => {
    const items: SubMenuItem[] = [];
    if (otherWindows) {
      for (const win of otherWindows) {
        items.push({
          id: `window-${win.id}`,
          label: `ウィンドウ ${win.id} (${win.tabCount}タブ)`,
        });
      }
    }
    items.push({
      id: 'new-window',
      label: '新しいウィンドウ',
    });
    return items;
  }, [otherWindows]);

  const handleMoveToWindowMouseEnter = useCallback(() => {
    if (windowSubMenuCloseTimeoutRef.current) {
      clearTimeout(windowSubMenuCloseTimeoutRef.current);
      windowSubMenuCloseTimeoutRef.current = null;
    }
    setIsSubMenuOpen(false);
    if (moveToWindowButtonRef.current) {
      setWindowSubMenuParentRect(moveToWindowButtonRef.current.getBoundingClientRect());
    } else {
      setWindowSubMenuParentRect(new DOMRect(adjustedPosition.x, adjustedPosition.y, 200, 36));
    }
    setIsWindowSubMenuOpen(true);
  }, [adjustedPosition]);

  const handleMoveToWindowMouseLeave = useCallback(() => {
    if (windowSubMenuCloseTimeoutRef.current) {
      clearTimeout(windowSubMenuCloseTimeoutRef.current);
    }
    windowSubMenuCloseTimeoutRef.current = setTimeout(() => {
      setIsWindowSubMenuOpen(false);
    }, 100);
  }, []);

  const handleWindowSubMenuClose = useCallback(() => {
    setIsWindowSubMenuOpen(false);
  }, []);

  const handleWindowSelect = useCallback((itemId: string) => {
    if (itemId === 'new-window') {
      onAction('newWindow');
    } else if (itemId.startsWith('window-')) {
      const windowId = parseInt(itemId.replace('window-', ''), 10);
      if (onMoveToWindow && !isNaN(windowId)) {
        onMoveToWindow(windowId, targetTabIds);
      }
    }
    onClose();
  }, [onAction, onMoveToWindow, targetTabIds, onClose]);

  const handleRegularItemMouseEnter = useCallback(() => {
    setIsSubMenuOpen(false);
    setIsWindowSubMenuOpen(false);
  }, []);

  return (
    <div
      ref={menuRef}
      role="menu"
      data-testid="tab-context-menu"
      className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 min-w-[200px] select-none"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
      }}
    >
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('close')}
        onMouseEnter={handleRegularItemMouseEnter}
      >
        {isMultipleSelection
          ? '選択されたタブを閉じる'
          : 'タブを閉じる'}
      </button>

      {isMultipleSelection && (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('closeOthers')}
          onMouseEnter={handleRegularItemMouseEnter}
        >
          他のタブを閉じる
        </button>
      )}

      <div className="border-t border-gray-700 my-1" />

      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('duplicate')}
        onMouseEnter={handleRegularItemMouseEnter}
      >
        タブを複製
      </button>

      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('reload')}
        onMouseEnter={handleRegularItemMouseEnter}
      >
        タブを再読み込み
      </button>

      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('discard')}
        onMouseEnter={handleRegularItemMouseEnter}
        data-testid="context-menu-discard"
      >
        タブを休止
      </button>

      <div className="border-t border-gray-700 my-1" />

      {isPinned ? (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('unpin')}
          onMouseEnter={handleRegularItemMouseEnter}
        >
          ピン留めを解除
        </button>
      ) : (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('pin')}
          onMouseEnter={handleRegularItemMouseEnter}
        >
          タブをピン留め
        </button>
      )}

      <div className="border-t border-gray-700 my-1" />

      <div
        ref={moveToWindowButtonRef}
        className="relative w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100 flex items-center justify-between cursor-default"
        onMouseEnter={handleMoveToWindowMouseEnter}
        onMouseLeave={handleMoveToWindowMouseLeave}
        data-testid="context-menu-move-to-window"
      >
        <span>別のウィンドウに移動</span>
        <span className="ml-2">▶</span>
        {isWindowSubMenuOpen && windowSubMenuParentRect && (
          <SubMenu
            label="別のウィンドウに移動"
            items={windowSubMenuItems}
            onSelect={handleWindowSelect}
            onClose={handleWindowSubMenuClose}
            parentRect={windowSubMenuParentRect}
          />
        )}
      </div>

      <div className="border-t border-gray-700 my-1" />

      {isGrouped ? (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('ungroup')}
          onMouseEnter={handleRegularItemMouseEnter}
        >
          グループを解除
        </button>
      ) : isMultipleSelection ? (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('group')}
          onMouseEnter={handleRegularItemMouseEnter}
        >
          選択されたタブをグループ化
        </button>
      ) : (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('group')}
          onMouseEnter={handleRegularItemMouseEnter}
        >
          タブをグループ化
        </button>
      )}

      {isGroupTab && !isMultipleSelection && (
        <button
          role="menuitem"
          data-testid="context-menu-edit-group-title"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('editGroupTitle')}
          onMouseEnter={handleRegularItemMouseEnter}
        >
          タイトルを編集
        </button>
      )}

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

      {!isMultipleSelection && tabUrl && (
        <>
          <div className="border-t border-gray-700 my-1" />
          <button
            role="menuitem"
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
            onClick={() => handleMenuItemClick('copyUrl')}
            onMouseEnter={handleRegularItemMouseEnter}
          >
            URLをコピー
          </button>
        </>
      )}

      <div className="border-t border-gray-700 my-1" />
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('snapshot')}
        onMouseEnter={handleRegularItemMouseEnter}
      >
        スナップショットを取得
      </button>
    </div>
  );
};
