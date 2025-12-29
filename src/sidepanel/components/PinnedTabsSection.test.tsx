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
    favIconUrl?: string
  ): ExtendedTabInfo => ({
    id,
    title,
    url: 'https://example.com',
    favIconUrl,
    status: 'complete',
    isPinned,
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
});
