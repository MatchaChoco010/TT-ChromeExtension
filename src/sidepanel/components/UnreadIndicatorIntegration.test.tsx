import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import TreeNode from './TreeNode';
import { UnreadTracker } from '@/services/UnreadTracker';
import type { TabNode, TabInfo, IStorageService } from '@/types';

/**
 * 統合テスト: UnreadBadge + UnreadTracker + UserSettings
 *
 * Task 10.2 の要件を検証:
 * - TreeNode に未読インジケータ（バッジまたは色変更）を表示
 * - 未読タブ数のカウント表示機能
 * - 設定による未読インジケータの表示/非表示切り替え
 */
describe('UnreadIndicator 統合テスト', () => {
  let mockStorageService: IStorageService;
  let unreadTracker: UnreadTracker;

  beforeEach(() => {
    // モックストレージサービス
    mockStorageService = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      onChange: vi.fn().mockReturnValue(() => {}),
    };

    unreadTracker = new UnreadTracker(mockStorageService);
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

  describe('Requirement 7.1: 未読タブに未読インジケータを表示', () => {
    it('新しく開かれた未読タブに未読バッジが表示される', async () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, '未読タブ');

      // タブを未読としてマーク
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

      // 未読バッジが表示されることを確認
      expect(screen.getByTestId('unread-badge')).toBeInTheDocument();
      expect(screen.getByTestId('unread-badge')).toHaveAttribute(
        'aria-label',
        'Unread',
      );
    });
  });

  describe('Requirement 7.2: タブアクティブ化時に未読インジケータを削除', () => {
    it('タブをアクティブにすると未読バッジが削除される', async () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'アクティブ化するタブ');

      // 最初は未読
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

      // 未読バッジが表示される
      expect(screen.getByTestId('unread-badge')).toBeInTheDocument();

      // タブをアクティブ化（既読にする）
      await unreadTracker.markAsRead(tab.id);
      expect(unreadTracker.isUnread(tab.id)).toBe(false);

      // 再レンダリング
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

      // 未読バッジが削除される
      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    });
  });

  describe('Requirement 7.3: 設定による未読インジケータの表示/非表示切り替え', () => {
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

      // バッジが表示されない
      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    });
  });

  describe('Requirement 7.4: 未読タブ数のカウント表示（オプション）', () => {
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

      // タブ2を既読にする
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
      // ストレージに未読タブがある状態をシミュレート
      mockStorageService.get = vi.fn().mockResolvedValue([5, 6, 7]);

      await unreadTracker.loadFromStorage();

      expect(unreadTracker.isUnread(5)).toBe(true);
      expect(unreadTracker.isUnread(6)).toBe(true);
      expect(unreadTracker.isUnread(7)).toBe(true);
      expect(unreadTracker.getUnreadCount()).toBe(3);
    });
  });
});
