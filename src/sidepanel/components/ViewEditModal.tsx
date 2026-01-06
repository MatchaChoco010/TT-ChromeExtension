import React, { useState, useCallback, useEffect } from 'react';
import type { View } from '@/types';
import { IconPicker, getIconByName, isCustomIcon } from './IconPicker';

const PRESET_COLORS = [
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#22c55e', // Green
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#d946ef', // Fuchsia
  '#ec4899', // Pink
];

export interface ViewEditModalProps {
  /** 編集対象のビュー（nullの場合はモーダルを表示しない） */
  view: View | null;
  /** モーダルが開いているかどうか */
  isOpen: boolean;
  /** 保存時のコールバック */
  onSave: (view: View) => void;
  /** クローズ時のコールバック */
  onClose: () => void;
  /** 即時更新用のコールバック（モーダルを閉じずにビューを更新） */
  onImmediateUpdate?: (view: View) => void;
}

/**
 * ViewEditModal コンポーネント
 *
 * ビュー編集用のモーダルダイアログを提供します。
 * - ビュー名の編集
 * - 色の選択（カラーピッカー + プリセット）
 * - アイコンURLの設定（オプション）
 * - 保存/キャンセル操作
 */
export const ViewEditModal: React.FC<ViewEditModalProps> = ({
  view,
  isOpen,
  onSave,
  onClose,
  onImmediateUpdate,
}) => {
  const [name, setName] = useState(view?.name ?? '');
  const [color, setColor] = useState(view?.color ?? '#3b82f6');
  const [icon, setIcon] = useState(view?.icon ?? '');
  const [showIconPicker, setShowIconPicker] = useState(false);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleIconSelect = useCallback((selectedIcon: string) => {
    setIcon(selectedIcon);
    setShowIconPicker(false);
    if (view && name.trim() && onImmediateUpdate) {
      onImmediateUpdate({
        id: view.id,
        name: name.trim(),
        color,
        icon: selectedIcon.trim() || undefined,
      });
    }
  }, [view, name, color, onImmediateUpdate]);

  const handleIconPickerCancel = useCallback(() => {
    setShowIconPicker(false);
  }, []);

  const handleIconClear = useCallback(() => {
    setIcon('');
  }, []);

  const handleSave = () => {
    if (!view || !name.trim()) {
      return;
    }

    onSave({
      id: view.id,
      name: name.trim(),
      color,
      icon: icon.trim() || undefined,
    });
  };

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen || !view) {
    return null;
  }

  return (
    <div
      data-testid="modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        data-testid="view-edit-modal"
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 overflow-hidden"
        data-testid-content="modal-content"
      >
        <div data-testid="modal-content" onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-gray-700">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-gray-100"
            >
              Edit View
            </h2>
          </div>

          <div className="px-6 py-4 space-y-4">
            <div>
              <label
                htmlFor="view-name"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                View Name
              </label>
              <input
                type="text"
                id="view-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
                placeholder="Enter view name"
              />
            </div>

            <div>
              <label
                htmlFor="view-color"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Color
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="view-color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-10 h-10 rounded cursor-pointer border border-gray-600"
                />
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100 font-mono text-sm"
                  placeholder="#000000"
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {PRESET_COLORS.map((presetColor) => (
                  <button
                    key={presetColor}
                    type="button"
                    data-testid={`preset-color-${presetColor.replace('#', '')}`}
                    onClick={() => setColor(presetColor)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      color === presetColor
                        ? 'border-white ring-2 ring-blue-500'
                        : 'border-transparent hover:border-gray-500'
                    }`}
                    style={{ backgroundColor: presetColor }}
                    aria-label={`Select color ${presetColor}`}
                  />
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                Icon (optional)
              </label>
              {showIconPicker ? (
                <IconPicker
                  currentIcon={icon || undefined}
                  onSelect={handleIconSelect}
                  onCancel={handleIconPickerCancel}
                />
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    data-testid="icon-select-button"
                    onClick={() => setShowIconPicker(true)}
                    className="flex items-center gap-2 px-3 py-2 border border-gray-600 rounded-md shadow-sm hover:bg-gray-600 bg-gray-700 text-gray-100 text-sm"
                  >
                    <div className="w-6 h-6 flex items-center justify-center bg-gray-600 rounded">
                      {icon.trim() ? (
                        isCustomIcon(icon) ? (
                          <span data-testid="custom-icon-preview" className="w-5 h-5 text-gray-200">
                            {getIconByName(icon)?.svg}
                          </span>
                        ) : (
                          <img
                            data-testid="icon-preview"
                            src={icon.trim()}
                            alt="Icon preview"
                            className="w-5 h-5 object-contain"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        )
                      ) : (
                        <svg
                          className="w-4 h-4 text-gray-400"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                          <circle cx="9" cy="9" r="2" />
                          <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                        </svg>
                      )}
                    </div>
                    <span>
                      {icon.trim()
                        ? isCustomIcon(icon)
                          ? icon
                          : 'Custom URL'
                        : 'Select icon...'}
                    </span>
                  </button>

                  {icon.trim() && (
                    <button
                      type="button"
                      data-testid="icon-clear-button"
                      onClick={handleIconClear}
                      className="px-2 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded"
                      title="Clear icon"
                    >
                      <svg
                        className="w-4 h-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Choose from preset icons or enter a custom URL
              </p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewEditModal;
