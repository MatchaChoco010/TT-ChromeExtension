import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PinnedTabsSection from './PinnedTabsSection';
import type { TabInfoMap, ExtendedTabInfo } from '@/types';

describe('PinnedTabsSection', () => {
  const mockOnTabClick = vi.fn();
  const mockOnTabClose = vi.fn();

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
          onTabClose={mockOnTabClose}
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
          onTabClose={mockOnTabClose}
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
          onTabClose={mockOnTabClose}
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
          onTabClose={mockOnTabClose}
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
          onTabClose={mockOnTabClose}
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
          onTabClose={mockOnTabClose}
        />
      );

      const pinnedTab = screen.getByTestId('pinned-tab-1');
      await user.click(pinnedTab);

      expect(mockOnTabClick).toHaveBeenCalledWith(1);
    });
  });

  describe('閉じるボタン', () => {
    it('ホバー時に閉じるボタンが表示されること', async () => {
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
          onTabClose={mockOnTabClose}
        />
      );

      const pinnedTab = screen.getByTestId('pinned-tab-1');

      // 初期状態では閉じるボタンは表示されない
      expect(screen.queryByTestId('pinned-tab-1-close-button')).not.toBeInTheDocument();

      // ホバーすると閉じるボタンが表示される
      await user.hover(pinnedTab);
      expect(screen.getByTestId('pinned-tab-1-close-button')).toBeInTheDocument();

      // ホバーを外すと閉じるボタンが非表示になる
      await user.unhover(pinnedTab);
      expect(screen.queryByTestId('pinned-tab-1-close-button')).not.toBeInTheDocument();
    });

    it('閉じるボタンをクリックするとonTabCloseが呼ばれること', () => {
      const pinnedTabIds = [1];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          onTabClose={mockOnTabClose}
        />
      );

      const pinnedTab = screen.getByTestId('pinned-tab-1');

      // ホバーして閉じるボタンを表示
      fireEvent.mouseEnter(pinnedTab);
      const closeButton = screen.getByTestId('pinned-tab-1-close-button');

      // 閉じるボタンをクリック
      fireEvent.click(closeButton);

      expect(mockOnTabClose).toHaveBeenCalledWith(1);
      // タブ自体はクリックされない
      expect(mockOnTabClick).not.toHaveBeenCalled();
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
          onTabClose={mockOnTabClose}
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
          onTabClose={mockOnTabClose}
        />
      );

      expect(screen.getByTestId('pinned-tab-1')).toBeInTheDocument();
      expect(screen.queryByTestId('pinned-tab-2')).not.toBeInTheDocument();
      expect(screen.getByTestId('pinned-tab-3')).toBeInTheDocument();
    });
  });
});
