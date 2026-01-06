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
  hasChildren = false,
  tabUrl,
  views,
  currentViewId,
  onMoveToView,
  groups,
  onAddToGroup,
  currentWindowId: _currentWindowId,
  otherWindows,
  onMoveToWindow,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const moveToViewButtonRef = useRef<HTMLDivElement>(null);
  const addToGroupButtonRef = useRef<HTMLDivElement>(null);
  const moveToWindowButtonRef = useRef<HTMLDivElement>(null);
  const isMultipleSelection = targetTabIds.length > 1;

  const [isSubMenuOpen, setIsSubMenuOpen] = useState(false);
  const [subMenuParentRect, setSubMenuParentRect] = useState<DOMRect | null>(null);
  const [isGroupSubMenuOpen, setIsGroupSubMenuOpen] = useState(false);
  const [groupSubMenuParentRect, setGroupSubMenuParentRect] = useState<DOMRect | null>(null);
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

    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
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
    if (moveToViewButtonRef.current) {
      setSubMenuParentRect(moveToViewButtonRef.current.getBoundingClientRect());
    } else {
      setSubMenuParentRect(new DOMRect(adjustedPosition.x, adjustedPosition.y, 200, 36));
    }
    setIsSubMenuOpen(true);
  }, [adjustedPosition]);

  const handleMoveToViewMouseLeave = useCallback(() => {
  }, []);

  const handleSubMenuClose = useCallback(() => {
    setIsSubMenuOpen(false);
  }, []);

  const availableGroups = useMemo((): SubMenuItem[] => {
    if (!groups) return [];
    return Object.values(groups).map(g => ({
      id: g.id,
      label: g.name,
    }));
  }, [groups]);

  const hasAvailableGroups = availableGroups.length > 0;

  const handleGroupSelect = useCallback((groupId: string) => {
    if (onAddToGroup) {
      onAddToGroup(groupId, targetTabIds);
      onClose();
    }
  }, [onAddToGroup, targetTabIds, onClose]);

  const handleAddToGroupMouseEnter = useCallback(() => {
    if (!hasAvailableGroups) return;
    if (addToGroupButtonRef.current) {
      setGroupSubMenuParentRect(addToGroupButtonRef.current.getBoundingClientRect());
    } else {
      setGroupSubMenuParentRect(new DOMRect(adjustedPosition.x, adjustedPosition.y, 200, 36));
    }
    setIsGroupSubMenuOpen(true);
  }, [adjustedPosition, hasAvailableGroups]);

  const handleAddToGroupMouseLeave = useCallback(() => {
  }, []);

  const handleGroupSubMenuClose = useCallback(() => {
    setIsGroupSubMenuOpen(false);
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
    if (moveToWindowButtonRef.current) {
      setWindowSubMenuParentRect(moveToWindowButtonRef.current.getBoundingClientRect());
    } else {
      setWindowSubMenuParentRect(new DOMRect(adjustedPosition.x, adjustedPosition.y, 200, 36));
    }
    setIsWindowSubMenuOpen(true);
  }, [adjustedPosition]);

  const handleMoveToWindowMouseLeave = useCallback(() => {
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
      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('close')}
      >
        {isMultipleSelection
          ? `選択されたタブを閉じる (${targetTabIds.length}件)`
          : 'タブを閉じる'}
      </button>

      {hasChildren && (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('closeSubtree')}
        >
          サブツリーを閉じる
        </button>
      )}

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

      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('duplicate')}
      >
        タブを複製
      </button>

      <button
        role="menuitem"
        className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
        onClick={() => handleMenuItemClick('reload')}
      >
        タブを再読み込み
      </button>

      <div className="border-t border-gray-700 my-1" />

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
        >
          グループを解除
        </button>
      ) : isMultipleSelection ? (
        <button
          role="menuitem"
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
          onClick={() => handleMenuItemClick('group')}
        >
          選択されたタブをグループ化
        </button>
      ) : (
        <>
          <button
            role="menuitem"
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-700 text-gray-100"
            onClick={() => handleMenuItemClick('group')}
          >
            タブをグループ化
          </button>
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
        </>
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
      >
        スナップショットを取得
      </button>
    </div>
  );
};
