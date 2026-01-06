import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TreeNode from './TreeNode';
import { UnreadTracker } from '@/services/UnreadTracker';
import type { TabNode, TabInfo, IStorageService } from '@/types';

describe('UnreadIndicator 統合テスト', () => {
  let mockStorageService: IStorageService;
  let unreadTracker: UnreadTracker;

  beforeEach(() => {
    mockStorageService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      onChange: vi.fn().mockReturnValue(() => {}),
    };

    unreadTracker = new UnreadTracker(mockStorageService);
    unreadTracker.setInitialLoadComplete();
  });

  const createMockNode = (
    id: string,
    tabId: number,
    depth: number = 0,
  ): TabNode => ({
    id,
    tabId,
    parentId: null,
    children: [],
    isExpanded: true,
    depth,
    viewId: 'default',
  });

  const createMockTab = (id: number, title: string = 'Test Tab'): TabInfo => ({
    id,
    title,
    url: 'https://example.com',
    favIconUrl: undefined,
    status: 'complete',
  });

  describe('未読タブに未読インジケータを表示', () => {
    it('新しく開かれた未読タブに未読バッジが表示される', async () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, '未読タブ');

      await unreadTracker.markAsUnread(tab.id);
      const isUnread = unreadTracker.isUnread(tab.id);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={isUnread}
          isActive={false}
          showUnreadIndicator={true}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByTestId('unread-badge')).toBeInTheDocument();
      expect(screen.getByTestId('unread-badge')).toHaveAttribute(
        'aria-label',
        'Unread',
      );
    });
  });

  describe('タブアクティブ化時に未読インジケータを削除', () => {
    it('タブをアクティブにすると未読バッジが削除される', async () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'アクティブ化するタブ');

      await unreadTracker.markAsUnread(tab.id);
      expect(unreadTracker.isUnread(tab.id)).toBe(true);

      const { rerender } = render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={true}
          isActive={false}
          showUnreadIndicator={true}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByTestId('unread-badge')).toBeInTheDocument();

      await unreadTracker.markAsRead(tab.id);
      expect(unreadTracker.isUnread(tab.id)).toBe(false);

      rerender(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={true}
          showUnreadIndicator={true}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    });
  });

  describe('設定による未読インジケータの表示/非表示切り替え', () => {
    it('showUnreadIndicator=trueの場合、未読バッジが表示される', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, '未読タブ');

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={true}
          isActive={false}
          showUnreadIndicator={true}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByTestId('unread-badge')).toBeInTheDocument();
    });

    it('showUnreadIndicator=falseの場合、未読タブでもバッジが表示されない', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, '未読タブ（設定でバッジ非表示）');

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={true}
          isActive={false}
          showUnreadIndicator={false}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    });
  });

  describe('未読タブ数のカウント表示（オプション）', () => {
    it('複数のタブが未読の場合、UnreadTrackerで未読数をカウントできる', async () => {
      await unreadTracker.markAsUnread(1);
      await unreadTracker.markAsUnread(2);
      await unreadTracker.markAsUnread(3);

      const unreadCount = unreadTracker.getUnreadCount();
      expect(unreadCount).toBe(3);
    });

    it('一部のタブを既読にすると、未読数が減る', async () => {
      await unreadTracker.markAsUnread(1);
      await unreadTracker.markAsUnread(2);
      await unreadTracker.markAsUnread(3);
      expect(unreadTracker.getUnreadCount()).toBe(3);

      await unreadTracker.markAsRead(2);
      expect(unreadTracker.getUnreadCount()).toBe(2);
      expect(unreadTracker.isUnread(1)).toBe(true);
      expect(unreadTracker.isUnread(2)).toBe(false);
      expect(unreadTracker.isUnread(3)).toBe(true);
    });
  });

  describe('ストレージ永続化', () => {
    it('未読状態がストレージに保存される', async () => {
      await unreadTracker.markAsUnread(1);
      await unreadTracker.markAsUnread(2);

      await waitFor(() => {
        expect(mockStorageService.set).toHaveBeenCalledWith(
          'unread_tabs',
          expect.arrayContaining([1, 2]),
        );
      });
    });

    it('ストレージから未読状態をロードできる', async () => {
      mockStorageService.get = vi.fn().mockResolvedValue([5, 6, 7]);

      await unreadTracker.loadFromStorage();

      expect(unreadTracker.isUnread(5)).toBe(true);
      expect(unreadTracker.isUnread(6)).toBe(true);
      expect(unreadTracker.isUnread(7)).toBe(true);
      expect(unreadTracker.getUnreadCount()).toBe(3);
    });
  });
});
