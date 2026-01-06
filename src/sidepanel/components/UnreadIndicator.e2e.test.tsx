import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TreeNode from './TreeNode';
import { UnreadTracker } from '@/services/UnreadTracker';
import { StorageService } from '@/storage/StorageService';
import type { TabNode, TabInfo } from '@/types';
import type { MockChrome, MockStorageLocal, MockStorage, MockRuntimeOnMessage } from '@/test/test-types';

describe('未読インジケータ E2Eテスト', () => {
  let storageService: StorageService;
  let unreadTracker: UnreadTracker;

  beforeEach(async () => {
    const mockStorageLocal: MockStorageLocal = {
      get: vi.fn().mockResolvedValue({}),
      set: vi.fn().mockResolvedValue(undefined),
      remove: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined),
    };

    const mockStorage: MockStorage = {
      local: mockStorageLocal,
      onChanged: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    };

    const mockRuntimeOnMessage: MockRuntimeOnMessage = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };

    const mockChrome: Partial<MockChrome> = {
      storage: mockStorage,
      runtime: {
        sendMessage: vi.fn().mockResolvedValue({}),
        getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
        onMessage: mockRuntimeOnMessage,
      },
    };

    global.chrome = mockChrome as unknown as typeof chrome;

    storageService = new StorageService();
    unreadTracker = new UnreadTracker(storageService);
    await unreadTracker.loadFromStorage();
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

  describe('新規タブに未読インジケータが表示される', () => {
    it('新しいタブが作成されると未読バッジが表示される', async () => {
      const tabId = 101;
      const node = createMockNode('node-101', tabId);
      const tab = createMockTab(tabId, '新しいタブ');

      await unreadTracker.markAsUnread(tabId);

      const { rerender } = render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={unreadTracker.isUnread(tabId)}
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

      await waitFor(() => {
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
          unread_tabs: expect.arrayContaining([tabId]),
        });
      });

      rerender(<></>);
    });

    it('複数の新しいタブがすべて未読バッジを表示する', async () => {
      const tabs = [
        { id: 201, title: 'タブ1' },
        { id: 202, title: 'タブ2' },
        { id: 203, title: 'タブ3' },
      ];

      for (const tab of tabs) {
        await unreadTracker.markAsUnread(tab.id);
      }

      const { container } = render(
        <>
          {tabs.map((tab) => (
            <TreeNode
              key={tab.id}
              node={createMockNode(`node-${tab.id}`, tab.id)}
              tab={createMockTab(tab.id, tab.title)}
              isUnread={unreadTracker.isUnread(tab.id)}
              isActive={false}
              showUnreadIndicator={true}
              onActivate={vi.fn()}
              onToggle={vi.fn()}
              onClose={vi.fn()}
            />
          ))}
        </>,
      );

      const badges = container.querySelectorAll('[data-testid="unread-badge"]');
      expect(badges).toHaveLength(3);

      expect(unreadTracker.getUnreadCount()).toBe(3);
    });
  });

  describe('タブアクティブ化で未読インジケータが削除される', () => {
    it('タブをクリックしてアクティブ化すると未読バッジが削除される', async () => {
      const user = userEvent.setup();
      const tabId = 301;
      const node = createMockNode('node-301', tabId);
      const tab = createMockTab(tabId, 'アクティブ化するタブ');

      await unreadTracker.markAsUnread(tabId);
      expect(unreadTracker.isUnread(tabId)).toBe(true);

      const handleActivate = vi.fn(async (activatedTabId: number) => {
        await unreadTracker.markAsRead(activatedTabId);
      });

      const { rerender } = render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={unreadTracker.isUnread(tabId)}
          isActive={false}
          showUnreadIndicator={true}
          onActivate={handleActivate}
          onToggle={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.getByTestId('unread-badge')).toBeInTheDocument();

      const treeNode = screen.getByTestId(`tree-node-${tabId}`);
      await user.click(treeNode);

      expect(handleActivate).toHaveBeenCalledWith(tabId);
      await waitFor(() => {
        expect(unreadTracker.isUnread(tabId)).toBe(false);
      });

      rerender(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={unreadTracker.isUnread(tabId)}
          isActive={true}
          showUnreadIndicator={true}
          onActivate={handleActivate}
          onToggle={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
          unread_tabs: expect.not.arrayContaining([tabId]),
        });
      });
    });

    it('複数の未読タブから1つをアクティブ化すると、そのタブだけ既読になる', async () => {
      const user = userEvent.setup();
      const tabs = [
        { id: 401, title: '未読タブ1' },
        { id: 402, title: '未読タブ2' },
        { id: 403, title: '未読タブ3' },
      ];

      for (const tab of tabs) {
        await unreadTracker.markAsUnread(tab.id);
      }
      expect(unreadTracker.getUnreadCount()).toBe(3);

      const handleActivate = vi.fn(async (activatedTabId: number) => {
        await unreadTracker.markAsRead(activatedTabId);
      });

      const { rerender } = render(
        <>
          {tabs.map((tab) => (
            <TreeNode
              key={tab.id}
              node={createMockNode(`node-${tab.id}`, tab.id)}
              tab={createMockTab(tab.id, tab.title)}
              isUnread={unreadTracker.isUnread(tab.id)}
              isActive={false}
              showUnreadIndicator={true}
              onActivate={handleActivate}
              onToggle={vi.fn()}
              onClose={vi.fn()}
            />
          ))}
        </>,
      );

      let badges = screen.getAllByTestId('unread-badge');
      expect(badges).toHaveLength(3);

      const secondTab = screen.getByTestId('tree-node-402');
      await user.click(secondTab);

      await waitFor(() => {
        expect(unreadTracker.isUnread(402)).toBe(false);
      });

      rerender(
        <>
          {tabs.map((tab) => (
            <TreeNode
              key={tab.id}
              node={createMockNode(`node-${tab.id}`, tab.id)}
              tab={createMockTab(tab.id, tab.title)}
              isUnread={unreadTracker.isUnread(tab.id)}
              isActive={tab.id === 402}
              showUnreadIndicator={true}
              onActivate={handleActivate}
              onToggle={vi.fn()}
              onClose={vi.fn()}
            />
          ))}
        </>,
      );

      badges = screen.getAllByTestId('unread-badge');
      expect(badges).toHaveLength(2);

      expect(unreadTracker.getUnreadCount()).toBe(2);
      expect(unreadTracker.isUnread(401)).toBe(true);
      expect(unreadTracker.isUnread(402)).toBe(false);
      expect(unreadTracker.isUnread(403)).toBe(true);
    });
  });

  describe('ストレージ永続化の統合', () => {
    it('ブラウザ再起動後もUnreadTrackerが未読状態をロードできる', async () => {
      await unreadTracker.markAsUnread(501);
      await unreadTracker.markAsUnread(502);

      await waitFor(() => {
        expect(global.chrome.storage.local.set).toHaveBeenCalledWith({
          unread_tabs: expect.arrayContaining([501, 502]),
        });
      });

      const savedUnreadTabs = [501, 502];
      global.chrome.storage.local.get = vi
        .fn()
        .mockResolvedValue({ unread_tabs: savedUnreadTabs });

      const newUnreadTracker = new UnreadTracker(storageService);
      await newUnreadTracker.loadFromStorage();

      expect(newUnreadTracker.isUnread(501)).toBe(true);
      expect(newUnreadTracker.isUnread(502)).toBe(true);
      expect(newUnreadTracker.getUnreadCount()).toBe(2);

      const { container } = render(
        <>
          <TreeNode
            node={createMockNode('node-501', 501)}
            tab={createMockTab(501, '復元されたタブ1')}
            isUnread={newUnreadTracker.isUnread(501)}
            isActive={false}
            showUnreadIndicator={true}
            onActivate={vi.fn()}
            onToggle={vi.fn()}
            onClose={vi.fn()}
          />
          <TreeNode
            node={createMockNode('node-502', 502)}
            tab={createMockTab(502, '復元されたタブ2')}
            isUnread={newUnreadTracker.isUnread(502)}
            isActive={false}
            showUnreadIndicator={true}
            onActivate={vi.fn()}
            onToggle={vi.fn()}
            onClose={vi.fn()}
          />
        </>,
      );

      const badges = container.querySelectorAll('[data-testid="unread-badge"]');
      expect(badges).toHaveLength(2);
    });
  });
});
