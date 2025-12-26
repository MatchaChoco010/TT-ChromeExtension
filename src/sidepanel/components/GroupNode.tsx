import React, { useState } from 'react';
import type { Group } from '@/types';
import ConfirmDialog from './ConfirmDialog';

interface GroupNodeProps {
  group: Group;
  depth: number;
  onClick: (groupId: string) => void;
  onToggle: (groupId: string) => void;
  onClose?: (groupId: string) => void;
  tabCount?: number;
}

/**
 * グループノードのUIコンポーネント
 * グループページのカスタマイズ可能なタイトルと色を表示し、
 * グループのクリック時に概要を表示、展開/折りたたみ機能を提供します。
 *
 * Requirements: 5.2, 5.3, 5.4
 */
const GroupNode: React.FC<GroupNodeProps> = ({
  group,
  depth,
  onClick,
  onToggle,
  onClose,
  tabCount = 0,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const indentSize = depth * 20 + 8;

  const handleNodeClick = () => {
    onClick(group.id);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggle(group.id);
  };

  const handleCloseClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    // タブ数が0の場合は確認ダイアログを表示せずに直接閉じる
    if (tabCount === 0) {
      onClose?.(group.id);
      return;
    }

    // タブがある場合は確認ダイアログを表示
    setShowConfirmDialog(true);
  };

  const handleConfirmClose = () => {
    setShowConfirmDialog(false);
    onClose?.(group.id);
  };

  const handleCancelClose = () => {
    setShowConfirmDialog(false);
  };

  return (
    <div>
      <div
        data-testid={`group-node-${group.id}`}
        className="flex items-center p-2 hover:bg-gray-100 cursor-pointer bg-gray-50"
        style={{ paddingLeft: `${indentSize}px` }}
        onClick={handleNodeClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
      {/* 展開/折りたたみトグルボタン */}
      <button
        data-testid={`toggle-expand-${group.id}`}
        onClick={handleToggleClick}
        className="mr-2 w-4 h-4 flex items-center justify-center text-gray-600"
        aria-label={group.isExpanded ? 'Collapse' : 'Expand'}
      >
        {group.isExpanded ? '▼' : '▶'}
      </button>

      {/* グループアイコンインジケータ */}
      <div
        data-testid="group-icon"
        className="mr-2 w-4 h-4 flex items-center justify-center flex-shrink-0"
      >
        📁
      </div>

      {/* グループカラーインジケータ */}
      <div
        data-testid="group-color-indicator"
        className="mr-2 w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: group.color }}
      />

      {/* グループ名 */}
      <div className="flex-1 flex items-center min-w-0">
        <span className="text-sm font-medium truncate">{group.name}</span>
      </div>

      {/* 閉じるボタン（ホバー時のみ表示） */}
      {isHovered && onClose && (
        <button
          data-testid={`close-button-${group.id}`}
          onClick={handleCloseClick}
          className="ml-2 w-4 h-4 flex items-center justify-center text-gray-500 hover:text-red-600 flex-shrink-0"
          aria-label="Close group"
        >
          ×
        </button>
      )}
    </div>

    {/* 確認ダイアログ */}
      <ConfirmDialog
        isOpen={showConfirmDialog}
        title="グループを閉じる"
        message={`このグループには ${tabCount} 個のタブが含まれています。すべてのタブを閉じてもよろしいですか？`}
        onConfirm={handleConfirmClose}
        onCancel={handleCancelClose}
      />
    </div>
  );
};

export default GroupNode;
