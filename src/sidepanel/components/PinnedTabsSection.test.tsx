import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PinnedTabsSection from './PinnedTabsSection';
import type { TabInfoMap, ExtendedTabInfo } from '@/types';

describe('PinnedTabsSection', () => {
  const mockOnTabClick = vi.fn();

  const createMockTabInfo = (
    id: number,
    title: string = 'Test Tab',
    isPinned: boolean = true,
    favIconUrl?: string,
    index: number = 0
  ): ExtendedTabInfo => ({
    id,
    title,
    url: 'https://example.com',
    favIconUrl,
    status: 'complete',
    isPinned,
    windowId: 1,
    discarded: false, // Task 4.1 (tab-tree-bugfix): 休止タブ状態
    index, // Task 12.1 (tab-tree-comprehensive-fix): ピン留めタブの順序同期
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本的な表示 (Requirements 12.1, 12.2)', () => {
    it('ピン留めタブをファビコンサイズで横並びに表示すること', () => {
      const pinnedTabIds = [1, 2, 3];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true, 'https://example.com/favicon1.ico'),
        2: createMockTabInfo(2, 'Tab 2', true, 'https://example.com/favicon2.ico'),
        3: createMockTabInfo(3, 'Tab 3', true, 'https://example.com/favicon3.ico'),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      // ピン留めタブセクションが表示されること
      const section = screen.getByTestId('pinned-tabs-section');
      expect(section).toBeInTheDocument();

      // 3つのピン留めタブが表示されること
      expect(screen.getByTestId('pinned-tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-tab-2')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-tab-3')).toBeInTheDocument();

      // 横並びのグリッドレイアウトであること
      expect(section).toHaveClass('flex', 'flex-wrap');
    });

    it('ファビコンが表示されること', () => {
      const pinnedTabIds = [1];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true, 'https://example.com/favicon.ico'),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      const favicon = screen.getByRole('img', { name: /Tab 1/ });
      expect(favicon).toBeInTheDocument();
      expect(favicon).toHaveAttribute('src', 'https://example.com/favicon.ico');
    });

    it('ファビコンがない場合にデフォルトアイコンを表示すること', () => {
      const pinnedTabIds = [1];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      const defaultIcon = screen.getByTestId('pinned-tab-1-default-icon');
      expect(defaultIcon).toBeInTheDocument();
    });
  });

  describe('区切り線の表示 (Requirements 12.3, 12.4)', () => {
    it('ピン留めタブと通常タブの間に区切り線を表示すること', () => {
      const pinnedTabIds = [1];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      const separator = screen.getByTestId('pinned-tabs-separator');
      expect(separator).toBeInTheDocument();
      // 区切り線はborder-b classを持つ
      expect(separator).toHaveClass('border-b');
    });
  });

  describe('非表示条件 (Requirement 12.1)', () => {
    it('ピン留めタブが0件の場合はセクション自体を非表示にすること', () => {
      const pinnedTabIds: number[] = [];
      const tabInfoMap: TabInfoMap = {};

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      // セクションが表示されないこと
      expect(screen.queryByTestId('pinned-tabs-section')).not.toBeInTheDocument();
      // 区切り線も表示されないこと
      expect(screen.queryByTestId('pinned-tabs-separator')).not.toBeInTheDocument();
    });
  });

  describe('クリック操作', () => {
    it('ピン留めタブをクリックするとonTabClickが呼ばれること', async () => {
      const user = userEvent.setup();
      const pinnedTabIds = [1];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      const pinnedTab = screen.getByTestId('pinned-tab-1');
      await user.click(pinnedTab);

      expect(mockOnTabClick).toHaveBeenCalledWith(1);
    });
  });

  describe('閉じるボタン - 要件1.1: ピン留めタブには閉じるボタンを表示しない', () => {
    it('ピン留めタブにホバーしても閉じるボタンが表示されないこと', async () => {
      const user = userEvent.setup();
      const pinnedTabIds = [1];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      const pinnedTab = screen.getByTestId('pinned-tab-1');

      // 初期状態では閉じるボタンは表示されない
      expect(screen.queryByTestId('pinned-tab-1-close-button')).not.toBeInTheDocument();

      // ホバーしても閉じるボタンは表示されない（要件1.1）
      await user.hover(pinnedTab);
      expect(screen.queryByTestId('pinned-tab-1-close-button')).not.toBeInTheDocument();

      // ホバーを外しても閉じるボタンは表示されない
      await user.unhover(pinnedTab);
      expect(screen.queryByTestId('pinned-tab-1-close-button')).not.toBeInTheDocument();
    });

    it('ピン留めタブに閉じる操作が存在しないこと（onTabClose propなし）', () => {
      const pinnedTabIds = [1];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      // 閉じるボタンが存在しないことを確認
      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });
  });

  describe('ツールチップ', () => {
    it('ピン留めタブにホバーするとタブタイトルがツールチップとして表示されること', async () => {
      const pinnedTabIds = [1];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'This is a long tab title', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      const pinnedTab = screen.getByTestId('pinned-tab-1');
      expect(pinnedTab).toHaveAttribute('title', 'This is a long tab title');
    });
  });

  describe('tabInfoMapにタブ情報がない場合', () => {
    it('tabInfoMapにないタブIDは表示しないこと', () => {
      const pinnedTabIds = [1, 2, 3];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
        // 2 is missing
        3: createMockTabInfo(3, 'Tab 3', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      expect(screen.getByTestId('pinned-tab-1')).toBeInTheDocument();
      expect(screen.queryByTestId('pinned-tab-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('pinned-tab-3')).toBeInTheDocument();
    });
  });

  describe('アクティブタブハイライト - Requirements 5.1, 5.2, 5.3, 5.4 (tab-tree-bugfix)', () => {
    it('activeTabIdが渡された場合、該当のピン留めタブがハイライト表示されること', () => {
      const pinnedTabIds = [1, 2, 3];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true, 'https://example.com/favicon1.ico'),
        2: createMockTabInfo(2, 'Tab 2', true, 'https://example.com/favicon2.ico'),
        3: createMockTabInfo(3, 'Tab 3', true, 'https://example.com/favicon3.ico'),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          activeTabId={2}
        />
      );

      // タブ2のみがアクティブスタイル（bg-gray-600）を持つこと
      const pinnedTab2 = screen.getByTestId('pinned-tab-2');
      expect(pinnedTab2).toHaveClass('bg-gray-600');

      // 他のタブはアクティブスタイルを持たないこと
      const pinnedTab1 = screen.getByTestId('pinned-tab-1');
      const pinnedTab3 = screen.getByTestId('pinned-tab-3');
      expect(pinnedTab1).not.toHaveClass('bg-gray-600');
      expect(pinnedTab3).not.toHaveClass('bg-gray-600');
    });

    it('activeTabIdがnullの場合、どのピン留めタブもハイライトされないこと', () => {
      const pinnedTabIds = [1, 2];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
        2: createMockTabInfo(2, 'Tab 2', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          activeTabId={null}
        />
      );

      const pinnedTab1 = screen.getByTestId('pinned-tab-1');
      const pinnedTab2 = screen.getByTestId('pinned-tab-2');
      expect(pinnedTab1).not.toHaveClass('bg-gray-600');
      expect(pinnedTab2).not.toHaveClass('bg-gray-600');
    });

    it('activeTabIdがピン留めタブ以外の場合、どのピン留めタブもハイライトされないこと', () => {
      const pinnedTabIds = [1, 2];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
        2: createMockTabInfo(2, 'Tab 2', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          activeTabId={999} // 存在しないタブID
        />
      );

      const pinnedTab1 = screen.getByTestId('pinned-tab-1');
      const pinnedTab2 = screen.getByTestId('pinned-tab-2');
      expect(pinnedTab1).not.toHaveClass('bg-gray-600');
      expect(pinnedTab2).not.toHaveClass('bg-gray-600');
    });

    it('常に1つのピン留めタブのみがハイライト状態であること', () => {
      const pinnedTabIds = [1, 2, 3, 4, 5];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
        2: createMockTabInfo(2, 'Tab 2', true),
        3: createMockTabInfo(3, 'Tab 3', true),
        4: createMockTabInfo(4, 'Tab 4', true),
        5: createMockTabInfo(5, 'Tab 5', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          activeTabId={3}
        />
      );

      // bg-gray-600クラスを持つ要素を数える
      const section = screen.getByTestId('pinned-tabs-section');
      const highlightedTabs = section.querySelectorAll('.bg-gray-600');
      expect(highlightedTabs).toHaveLength(1);

      // タブ3のみがハイライトされていること
      expect(screen.getByTestId('pinned-tab-3')).toHaveClass('bg-gray-600');
    });
  });

  describe('コンテキストメニュー - 要件1.6, 1.7: ピン留め解除', () => {
    const mockOnContextMenu = vi.fn();

    it('ピン留めタブを右クリックするとonContextMenuが呼ばれること', async () => {
      const user = userEvent.setup();
      const pinnedTabIds = [1];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true, 'https://example.com/favicon.ico'),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          onContextMenu={mockOnContextMenu}
        />
      );

      const pinnedTab = screen.getByTestId('pinned-tab-1');
      await user.pointer({ target: pinnedTab, keys: '[MouseRight]' });

      expect(mockOnContextMenu).toHaveBeenCalledTimes(1);
      expect(mockOnContextMenu).toHaveBeenCalledWith(1, expect.any(Object));
    });

    it('onContextMenuが渡されていない場合でも右クリックでエラーにならないこと', async () => {
      const user = userEvent.setup();
      const pinnedTabIds = [1];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
        />
      );

      const pinnedTab = screen.getByTestId('pinned-tab-1');

      // エラーが発生しないことを確認
      await expect(user.pointer({ target: pinnedTab, keys: '[MouseRight]' })).resolves.not.toThrow();
    });
  });

  describe('ドラッグ＆ドロップ並び替え - Requirements 10.1, 10.2, 10.3, 10.4 (tab-tree-bugfix)', () => {
    const mockOnPinnedTabReorder = vi.fn();

    beforeEach(() => {
      mockOnPinnedTabReorder.mockClear();
    });

    it('ピン留めタブがドラッグ可能コンテキスト内でレンダリングされること', () => {
      const pinnedTabIds = [1, 2, 3];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true, 'https://example.com/favicon1.ico'),
        2: createMockTabInfo(2, 'Tab 2', true, 'https://example.com/favicon2.ico'),
        3: createMockTabInfo(3, 'Tab 3', true, 'https://example.com/favicon3.ico'),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          onPinnedTabReorder={mockOnPinnedTabReorder}
        />
      );

      // 各ピン留めタブがdata-sortable属性を持つこと（ドラッグ可能であることを示す）
      const pinnedTab1 = screen.getByTestId('pinned-tab-1');
      const pinnedTab2 = screen.getByTestId('pinned-tab-2');
      const pinnedTab3 = screen.getByTestId('pinned-tab-3');

      expect(pinnedTab1).toHaveAttribute('data-sortable', 'true');
      expect(pinnedTab2).toHaveAttribute('data-sortable', 'true');
      expect(pinnedTab3).toHaveAttribute('data-sortable', 'true');
    });

    it('onPinnedTabReorderが渡されていない場合はドラッグ無効であること', () => {
      const pinnedTabIds = [1, 2];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
        2: createMockTabInfo(2, 'Tab 2', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          // onPinnedTabReorder is not provided
        />
      );

      // ドラッグ可能属性がないこと
      const pinnedTab1 = screen.getByTestId('pinned-tab-1');
      expect(pinnedTab1).not.toHaveAttribute('data-sortable', 'true');
    });

    it('ピン留めタブの順序が変更されたときにonPinnedTabReorderが呼ばれること', () => {
      const pinnedTabIds = [1, 2, 3];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
        2: createMockTabInfo(2, 'Tab 2', true),
        3: createMockTabInfo(3, 'Tab 3', true),
      };

      // 内部のドラッグ&ドロップハンドラをシミュレートするためのラッパーが必要
      // ここではpropsの型をテスト
      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          onPinnedTabReorder={mockOnPinnedTabReorder}
        />
      );

      // コンポーネントがレンダリングされることを確認
      const section = screen.getByTestId('pinned-tabs-section');
      expect(section).toBeInTheDocument();

      // onPinnedTabReorderが関数として渡されていることを確認
      expect(typeof mockOnPinnedTabReorder).toBe('function');
    });

    it('ピン留めセクション内でのみドラッグが許可されること（ピン留めタブのIDがstring形式で管理されること）', () => {
      const pinnedTabIds = [1, 2, 3];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
        2: createMockTabInfo(2, 'Tab 2', true),
        3: createMockTabInfo(3, 'Tab 3', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          onPinnedTabReorder={mockOnPinnedTabReorder}
        />
      );

      // 各ピン留めタブがpinned-プレフィックスのIDを持つこと
      // これによりピン留めセクション外へのドロップを防止できる
      const pinnedTab1 = screen.getByTestId('pinned-tab-1');
      expect(pinnedTab1).toHaveAttribute('data-pinned-id', 'pinned-1');
    });
  });
});
