import React, { useState, useCallback, useEffect, useRef } from 'react';

/**
 * デフォルトのグループ名を計算
 *
 * 複数タブで共通の単語がある場合はその単語を返し、
 * なければ「グループ」を返す
 */
export function getDefaultGroupTitle(tabTitles: string[]): string {
  if (tabTitles.length <= 1) return 'グループ';

  const wordSets = tabTitles.map((title) =>
    new Set(
      title
        .split(/[\s\-_・:：|｜/／]+/)
        .filter((w) => w.length >= 2)
    )
  );

  if (wordSets.length === 0 || wordSets[0].size === 0) return 'グループ';

  for (const word of wordSets[0]) {
    if (
      wordSets.every((set) =>
        [...set].some(
          (w) =>
            w.toLowerCase().includes(word.toLowerCase()) ||
            word.toLowerCase().includes(w.toLowerCase())
        )
      )
    ) {
      return word;
    }
  }

  return 'グループ';
}

export interface GroupNameModalProps {
  isOpen: boolean;
  tabTitles: string[];
  onSave: (name: string) => void;
  onClose: () => void;
}

export const GroupNameModal: React.FC<GroupNameModalProps> = ({
  isOpen,
  tabTitles,
  onSave,
  onClose,
}) => {
  const defaultName = getDefaultGroupTitle(tabTitles);
  const [name, setName] = useState(defaultName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      const newDefaultName = getDefaultGroupTitle(tabTitles);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setName(newDefaultName);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isOpen, tabTitles]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!isOpen) return;
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'Enter') {
        onSave(name.trim() || 'グループ');
      }
    },
    [isOpen, onClose, onSave, name]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleSave = () => {
    onSave(name.trim() || 'グループ');
  };

  const handleOverlayClick = (event: React.MouseEvent) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      data-testid="group-name-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={handleOverlayClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="group-name-modal-title"
        data-testid="group-name-modal"
        className="bg-gray-800 rounded-lg shadow-xl w-full max-w-sm mx-4 overflow-hidden"
      >
        <div onClick={(e) => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-gray-700">
            <h2
              id="group-name-modal-title"
              className="text-lg font-semibold text-gray-100"
            >
              グループ名
            </h2>
          </div>

          <div className="px-6 py-4">
            <input
              ref={inputRef}
              type="text"
              data-testid="group-name-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-700 text-gray-100"
              placeholder="グループ名を入力"
            />
          </div>

          <div className="px-6 py-4 border-t border-gray-700 flex justify-end gap-3">
            <button
              type="button"
              data-testid="group-name-cancel-button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 border border-gray-600 rounded-md shadow-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              キャンセル
            </button>
            <button
              type="button"
              data-testid="group-name-save-button"
              onClick={handleSave}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              作成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupNameModal;
