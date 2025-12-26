import React from 'react';

interface CloseButtonProps {
  onClose: () => void;
}

/**
 * タブを閉じるボタンコンポーネント
 * TreeNodeのホバー時に表示される
 */
const CloseButton: React.FC<CloseButtonProps> = ({ onClose }) => {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <button
      onClick={handleClick}
      className="ml-2 w-4 h-4 flex items-center justify-center text-gray-500 hover:text-red-600 hover:bg-red-100 rounded"
      aria-label="Close tab"
      data-testid="close-button"
    >
      ×
    </button>
  );
};

export default CloseButton;
