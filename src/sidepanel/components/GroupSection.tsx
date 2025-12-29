import React, { useState } from 'react';
import type { Group } from '@/types';
import GroupNode from './GroupNode';

interface GroupSectionProps {
  groups: Record<string, Group>;
  onCreateGroup: (name: string, color: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onToggleGroup: (groupId: string) => void;
  onGroupClick: (groupId: string) => void;
  getGroupTabCount: (groupId: string) => number;
}

/**
 * グループセクション
 * グループの一覧表示と作成フォームを提供
 *
 * Task 4.9: グループ機能
 * Requirements: 3.9
 */
const GroupSection: React.FC<GroupSectionProps> = ({
  groups,
  onCreateGroup,
  onDeleteGroup,
  onToggleGroup,
  onGroupClick,
  getGroupTabCount,
}) => {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupColor, setNewGroupColor] = useState('#6b7280');

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newGroupName.trim()) {
      onCreateGroup(newGroupName.trim(), newGroupColor);
      setNewGroupName('');
      setNewGroupColor('#6b7280');
      setShowCreateForm(false);
    }
  };

  const handleCancelCreate = () => {
    setNewGroupName('');
    setNewGroupColor('#6b7280');
    setShowCreateForm(false);
  };

  const groupList = Object.values(groups);

  return (
    <div data-testid="groups-section" className="border-b border-gray-700 mb-2">
      {/* グループヘッダー */}
      <div className="flex items-center justify-between px-2 py-1 bg-gray-800">
        <span className="text-sm font-medium text-gray-200">Groups</span>
        <button
          aria-label="Create new group"
          onClick={() => setShowCreateForm(true)}
          className="text-blue-400 hover:text-blue-300 text-sm"
        >
          + New
        </button>
      </div>

      {/* グループ作成フォーム */}
      {showCreateForm && (
        <div data-testid="group-create-form" className="p-2 bg-gray-800 border-b border-gray-700">
          <form onSubmit={handleCreateSubmit}>
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                aria-label="Group Name"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Group name"
                className="flex-1 px-2 py-1 text-sm border border-gray-600 rounded bg-gray-700 text-gray-100"
                autoFocus
              />
              <input
                type="color"
                aria-label="Group Color"
                value={newGroupColor}
                onChange={(e) => setNewGroupColor(e.target.value)}
                className="w-8 h-8 cursor-pointer"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                aria-label="Cancel"
                onClick={handleCancelCreate}
                className="px-2 py-1 text-sm text-gray-400 hover:text-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                aria-label="Create group"
                className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-500"
              >
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      {/* グループ一覧 */}
      {groupList.length === 0 && !showCreateForm && (
        <div className="p-2 text-sm text-gray-400 text-center">
          No groups yet
        </div>
      )}

      {groupList.map((group) => (
        <GroupNode
          key={group.id}
          group={group}
          depth={0}
          onClick={onGroupClick}
          onToggle={onToggleGroup}
          onClose={onDeleteGroup}
          tabCount={getGroupTabCount(group.id)}
        />
      ))}
    </div>
  );
};

export default GroupSection;
