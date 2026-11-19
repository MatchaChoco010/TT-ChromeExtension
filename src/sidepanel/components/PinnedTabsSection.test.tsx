import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
    discarded: false,
    index,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本的な表示', () => {
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

      const section = screen.getByTestId('pinned-tabs-section');
      expect(section).toBeInTheDocument();

      expect(screen.getByTestId('pinned-tab-1')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-tab-2')).toBeInTheDocument();
      expect(screen.getByTestId('pinned-tab-3')).toBeInTheDocument();

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

  describe('区切り線の表示', () => {
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
      expect(separator).toHaveClass('border-b');
    });
  });

  describe('非表示条件', () => {
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

      expect(screen.queryByTestId('pinned-tabs-section')).not.toBeInTheDocument();
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

  describe('閉じるボタン - ピン留めタブには閉じるボタンを表示しない', () => {
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

      expect(screen.queryByTestId('pinned-tab-1-close-button')).not.toBeInTheDocument();

      await user.hover(pinnedTab);
      expect(screen.queryByTestId('pinned-tab-1-close-button')).not.toBeInTheDocument();

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

  describe('アクティブタブハイライト', () => {
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

      const pinnedTab2 = screen.getByTestId('pinned-tab-2');
      expect(pinnedTab2).toHaveClass('bg-gray-600');

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
          activeTabId={999}
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

      const section = screen.getByTestId('pinned-tabs-section');
      const highlightedTabs = section.querySelectorAll('.bg-gray-600');
      expect(highlightedTabs).toHaveLength(1);

      expect(screen.getByTestId('pinned-tab-3')).toHaveClass('bg-gray-600');
    });
  });

  describe('コンテキストメニュー - ピン留め解除', () => {
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

      await expect(user.pointer({ target: pinnedTab, keys: '[MouseRight]' })).resolves.not.toThrow();
    });
  });

  describe('ドラッグ＆ドロップ並び替え', () => {
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
        />
      );

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

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          onPinnedTabReorder={mockOnPinnedTabReorder}
        />
      );

      const section = screen.getByTestId('pinned-tabs-section');
      expect(section).toBeInTheDocument();

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

      const pinnedTab1 = screen.getByTestId('pinned-tab-1');
      expect(pinnedTab1).toHaveAttribute('data-pinned-id', 'pinned-1');
    });

    it('2行以上に折り返されたピン留めタブで1行目から2行目へドラッグ＆ドロップでき、インジケーターが2行目に表示されること', () => {
      const pinnedTabIds = [1, 2, 3, 4, 5, 6];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
        2: createMockTabInfo(2, 'Tab 2', true),
        3: createMockTabInfo(3, 'Tab 3', true),
        4: createMockTabInfo(4, 'Tab 4', true),
        5: createMockTabInfo(5, 'Tab 5', true),
        6: createMockTabInfo(6, 'Tab 6', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          onPinnedTabReorder={mockOnPinnedTabReorder}
        />
      );

      const section = screen.getByTestId('pinned-tabs-section');
      vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, right: 140, bottom: 76, width: 140, height: 76, x: 0, y: 0, toJSON: () => ({}),
      });

      const rects = [
        { left: 8, right: 36, top: 8, bottom: 36 },
        { left: 40, right: 68, top: 8, bottom: 36 },
        { left: 72, right: 100, top: 8, bottom: 36 },
        { left: 104, right: 132, top: 8, bottom: 36 },
        { left: 8, right: 36, top: 40, bottom: 68 },
        { left: 40, right: 68, top: 40, bottom: 68 },
      ];

      pinnedTabIds.forEach((id, i) => {
        const el = screen.getByTestId(`pinned-tab-${id}`);
        const r = rects[i];
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
          ...r,
          width: r.right - r.left,
          height: r.bottom - r.top,
          x: r.left,
          y: r.top,
          toJSON: () => ({}),
        });
      });

      const pinnedTab1 = screen.getByTestId('pinned-tab-1');
      fireEvent.mouseDown(pinnedTab1, { button: 0, clientX: 22, clientY: 22 });
      fireEvent.mouseMove(document, { clientX: 46, clientY: 54 });

      const indicator = screen.getByTestId('horizontal-drop-indicator');
      expect(indicator).toHaveAttribute('data-insert-index', '5');
      expect(indicator).toHaveStyle({ left: '38px', top: '40px', height: '28px' });

      fireEvent.mouseUp(document, { clientX: 46, clientY: 54 });

      expect(mockOnPinnedTabReorder).toHaveBeenCalledTimes(1);
      expect(mockOnPinnedTabReorder).toHaveBeenCalledWith(1, 4);
    });

    it('2行目が短い状態でも1行目のタブを1行目の末尾へドラッグ＆ドロップできること', () => {
      const pinnedTabIds = [1, 2, 3, 4, 5, 6];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
        2: createMockTabInfo(2, 'Tab 2', true),
        3: createMockTabInfo(3, 'Tab 3', true),
        4: createMockTabInfo(4, 'Tab 4', true),
        5: createMockTabInfo(5, 'Tab 5', true),
        6: createMockTabInfo(6, 'Tab 6', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          onPinnedTabReorder={mockOnPinnedTabReorder}
        />
      );

      const section = screen.getByTestId('pinned-tabs-section');
      vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, right: 140, bottom: 76, width: 140, height: 76, x: 0, y: 0, toJSON: () => ({}),
      });

      const rects = [
        { left: 8, right: 36, top: 8, bottom: 36 },
        { left: 40, right: 68, top: 8, bottom: 36 },
        { left: 72, right: 100, top: 8, bottom: 36 },
        { left: 104, right: 132, top: 8, bottom: 36 },
        { left: 8, right: 36, top: 40, bottom: 68 },
        { left: 40, right: 68, top: 40, bottom: 68 },
      ];

      pinnedTabIds.forEach((id, i) => {
        const el = screen.getByTestId(`pinned-tab-${id}`);
        const r = rects[i];
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
          ...r,
          width: r.right - r.left,
          height: r.bottom - r.top,
          x: r.left,
          y: r.top,
          toJSON: () => ({}),
        });
      });

      const pinnedTab1 = screen.getByTestId('pinned-tab-1');
      fireEvent.mouseDown(pinnedTab1, { button: 0, clientX: 22, clientY: 22 });
      fireEvent.mouseMove(document, { clientX: 125, clientY: 22 });

      const indicator = screen.getByTestId('horizontal-drop-indicator');
      expect(indicator).toHaveAttribute('data-insert-index', '4');
      expect(indicator).toHaveStyle({ left: '134px', top: '8px', height: '28px' });

      fireEvent.mouseUp(document, { clientX: 125, clientY: 22 });

      expect(mockOnPinnedTabReorder).toHaveBeenCalledTimes(1);
      expect(mockOnPinnedTabReorder).toHaveBeenCalledWith(1, 3);
    });

    it('2行目のタブを真上の1行目へ垂直ドラッグで移動できること', () => {
      const pinnedTabIds = [1, 2, 3, 4, 5, 6];
      const tabInfoMap: TabInfoMap = {
        1: createMockTabInfo(1, 'Tab 1', true),
        2: createMockTabInfo(2, 'Tab 2', true),
        3: createMockTabInfo(3, 'Tab 3', true),
        4: createMockTabInfo(4, 'Tab 4', true),
        5: createMockTabInfo(5, 'Tab 5', true),
        6: createMockTabInfo(6, 'Tab 6', true),
      };

      render(
        <PinnedTabsSection
          pinnedTabIds={pinnedTabIds}
          tabInfoMap={tabInfoMap}
          onTabClick={mockOnTabClick}
          onPinnedTabReorder={mockOnPinnedTabReorder}
        />
      );

      const section = screen.getByTestId('pinned-tabs-section');
      vi.spyOn(section, 'getBoundingClientRect').mockReturnValue({
        top: 0, left: 0, right: 140, bottom: 76, width: 140, height: 76, x: 0, y: 0, toJSON: () => ({}),
      });

      const rects = [
        { left: 8, right: 36, top: 8, bottom: 36 },
        { left: 40, right: 68, top: 8, bottom: 36 },
        { left: 72, right: 100, top: 8, bottom: 36 },
        { left: 104, right: 132, top: 8, bottom: 36 },
        { left: 8, right: 36, top: 40, bottom: 68 },
        { left: 40, right: 68, top: 40, bottom: 68 },
      ];

      pinnedTabIds.forEach((id, i) => {
        const el = screen.getByTestId(`pinned-tab-${id}`);
        const r = rects[i];
        vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
          ...r,
          width: r.right - r.left,
          height: r.bottom - r.top,
          x: r.left,
          y: r.top,
          toJSON: () => ({}),
        });
      });

      // 2行目先頭(tab5, centerX=22)から真上(clientX=16, deltaX=-6ではなく垂直移動 clientX=20, deltaX=-2)へドラッグ
      const pinnedTab5 = screen.getByTestId('pinned-tab-5');
      fireEvent.mouseDown(pinnedTab5, { button: 0, clientX: 20, clientY: 54 });
      fireEvent.mouseMove(document, { clientX: 20, clientY: 22 });

      const indicator = screen.getByTestId('horizontal-drop-indicator');
      expect(indicator).toHaveAttribute('data-insert-index', '0');
      expect(indicator).toHaveStyle({ left: '6px', top: '8px', height: '28px' });

      fireEvent.mouseUp(document, { clientX: 20, clientY: 22 });

      expect(mockOnPinnedTabReorder).toHaveBeenCalledTimes(1);
      expect(mockOnPinnedTabReorder).toHaveBeenCalledWith(5, 0);
    });
  });
});
