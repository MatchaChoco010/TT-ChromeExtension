/**
 * SubMenu コンポーネント
 * 汎用サブメニューコンポーネント
 *
 * ホバーで展開する汎用サブメニューを提供します。
 * - 親メニュー項目ホバーで子メニュー表示
 * - 画面端での位置自動調整
 * - キーボードナビゲーション対応
 */

import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import type { SubMenuItem, SubMenuProps } from '@/types';

// Re-export types for backward compatibility
export type { SubMenuItem, SubMenuProps };

/**
 * SubMenu コンポーネント
 *
 * 親メニュー項目にネストして使用するサブメニューを提供します。
 */
export const SubMenu: React.FC<SubMenuProps> = ({
  label,
  items,
  onSelect,
  onClose,
  parentRect,
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // サブメニューの推定サイズ
  const SUBMENU_WIDTH = 160;
  const SUBMENU_ITEM_HEIGHT = 36;
  const SUBMENU_PADDING = 8;

  // 画面端での位置調整
  const adjustedPosition = useMemo(() => {
    const submenuHeight = items.length * SUBMENU_ITEM_HEIGHT + SUBMENU_PADDING * 2;

    let x = parentRect.right;
    let y = parentRect.top;

    // 右端を超える場合は左側に表示
    if (x + SUBMENU_WIDTH > window.innerWidth) {
      x = parentRect.left - SUBMENU_WIDTH;
    }

    // 左端を超える場合は最小位置を保証
    if (x < 10) {
      x = 10;
    }

    // 下端を超える場合は上に調整
    if (y + submenuHeight > window.innerHeight) {
      y = window.innerHeight - submenuHeight - 10;
    }

    // 上端を超える場合は最小位置を保証
    if (y < 10) {
      y = 10;
    }

    return { x, y };
  }, [parentRect, items.length]);

  // 有効な項目のインデックスを取得
  const enabledIndices = useMemo(() => {
    return items
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => !item.disabled)
      .map(({ index }) => index);
  }, [items]);

  // フォーカスを設定
  const setFocus = useCallback((index: number) => {
    if (index >= 0 && index < items.length && itemRefs.current[index]) {
      itemRefs.current[index]?.focus();
      setFocusedIndex(index);
    }
  }, [items.length]);

  // キーボードイベントハンドラ
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      switch (event.key) {
        case 'Escape':
          event.preventDefault();
          onClose();
          break;

        case 'ArrowDown': {
          event.preventDefault();
          // 次の有効な項目にフォーカス
          const currentPos = enabledIndices.indexOf(focusedIndex);
          const nextPos = currentPos === -1 ? 0 : Math.min(currentPos + 1, enabledIndices.length - 1);
          setFocus(enabledIndices[nextPos]);
          break;
        }

        case 'ArrowUp': {
          event.preventDefault();
          // 前の有効な項目にフォーカス
          const currentPos = enabledIndices.indexOf(focusedIndex);
          const prevPos = currentPos === -1 ? enabledIndices.length - 1 : Math.max(currentPos - 1, 0);
          setFocus(enabledIndices[prevPos]);
          break;
        }

        case 'Enter': {
          event.preventDefault();
          if (focusedIndex >= 0 && !items[focusedIndex].disabled) {
            onSelect(items[focusedIndex].id);
          }
          break;
        }

        case 'ArrowLeft':
          // 親メニューに戻る（閉じる）
          event.preventDefault();
          onClose();
          break;

        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, onSelect, focusedIndex, enabledIndices, setFocus, items]);

  // マウスが離れた時のハンドラ
  const handleMouseLeave = useCallback(() => {
    // 遅延なしで閉じる
    onClose();
  }, [onClose]);

  // 項目クリックハンドラ
  const handleItemClick = useCallback((itemId: string, disabled?: boolean) => {
    if (!disabled) {
      onSelect(itemId);
    }
  }, [onSelect]);

  // 項目参照を設定
  const setItemRef = useCallback((index: number) => (el: HTMLButtonElement | null) => {
    itemRefs.current[index] = el;
  }, []);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      className="fixed z-[60] bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-1 select-none"
      style={{
        left: `${adjustedPosition.x}px`,
        top: `${adjustedPosition.y}px`,
        minWidth: `${SUBMENU_WIDTH}px`,
      }}
      onMouseLeave={handleMouseLeave}
      data-testid="submenu"
    >
      {items.map((item, index) => (
        <button
          key={item.id}
          ref={setItemRef(index)}
          role="menuitem"
          className={`w-full px-4 py-2 text-left text-sm ${
            item.disabled
              ? 'text-gray-500 cursor-not-allowed'
              : 'hover:bg-gray-700 text-gray-100'
          } ${focusedIndex === index ? 'bg-gray-700' : ''}`}
          onClick={() => handleItemClick(item.id, item.disabled)}
          disabled={item.disabled}
          tabIndex={focusedIndex === index ? 0 : -1}
          onFocus={() => setFocusedIndex(index)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
};

export default SubMenu;
