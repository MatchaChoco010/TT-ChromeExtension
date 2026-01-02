import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  tabCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 確認ダイアログコンポーネント
 * グループ閉じ時など、ユーザーの確認が必要な操作で使用されます。
 */
const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  tabCount,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = (e: React.MouseEvent) => {
    // オーバーレイをクリックした場合のみキャンセル
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  const handleConfirm = () => {
    onConfirm();
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <div
      data-testid="dialog-overlay"
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50"
      onClick={handleOverlayClick}
    >
      <div
        data-testid="confirm-dialog"
        className="bg-gray-800 rounded-lg p-6 shadow-xl max-w-md w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* タイトル */}
        <h2 className="text-lg font-semibold mb-4 text-gray-100">{title}</h2>

        {/* メッセージ */}
        <p className="text-sm text-gray-300 mb-4">{message}</p>

        {/* タブ数表示 */}
        {tabCount !== undefined && (
          <div
            data-testid="tab-count-display"
            className="text-sm text-gray-400 mb-6 bg-gray-700 p-3 rounded"
          >
            {tabCount === 1
              ? `1個のタブが閉じられます`
              : `${tabCount}個のタブが閉じられます`}
          </div>
        )}

        {/* ボタン */}
        <div className="flex justify-end gap-3">
          <button
            data-testid="cancel-button"
            onClick={handleCancel}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-md transition-colors"
          >
            キャンセル
          </button>
          <button
            data-testid="confirm-button"
            onClick={handleConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
