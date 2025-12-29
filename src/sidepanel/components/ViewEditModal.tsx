/**
 * ViewEditModal コンポーネント
 * Task 7.2: ビュー編集モーダルダイアログの実装
 * Requirements: 3.4
 *
 * ビュー名、色、アイコンを編集するためのモーダルダイアログを提供します。
 * モーダルオーバーレイで表示され、保存/キャンセル操作が可能です。
 */

import React, { useState, useEffect, useCallback } from 'react';
import type { View } from '@/types';

/**
 * プリセットカラーの配列
 * ダークテーマに合う色を選定
 */
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
}) => {
  // フォーム状態
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [icon, setIcon] = useState('');

  // viewが変更されたらフォームを初期化
  useEffect(() => {
    if (view) {
      setName(view.name);
      setColor(view.color);
      setIcon(view.icon || '');
    }
  }, [view]);

  // Escapeキーでモーダルを閉じる
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

  // 保存処理
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

  // オーバーレイクリックでモーダルを閉じる
  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  // モーダルを表示しない条件
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
          {/* ヘッダー */}
          <div className="px-6 py-4 border-b border-gray-700">
            <h2
              id="modal-title"
              className="text-lg font-semibold text-gray-100"
            >
              Edit View
            </h2>
          </div>

          {/* フォーム */}
          <div className="px-6 py-4 space-y-4">
            {/* ビュー名 */}
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

            {/* 色選択 */}
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

              {/* プリセットカラー */}
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

            {/* アイコンURL */}
            <div>
              <label
                htmlFor="view-icon"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Icon URL (optional)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  id="view-icon"
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100 text-sm"
                  placeholder="https://example.com/icon.png"
                />
                {/* アイコンプレビュー */}
                {icon.trim() && (
                  <div className="flex-shrink-0 w-8 h-8 rounded border border-gray-600 overflow-hidden bg-gray-700">
                    <img
                      data-testid="icon-preview"
                      src={icon.trim()}
                      alt="Icon preview"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-400">
                Enter a URL to an image to use as the view icon
              </p>
            </div>
          </div>

          {/* フッター */}
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
