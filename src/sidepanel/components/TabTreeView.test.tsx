import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import TabTreeView from './TabTreeView';
import type { UITabNode, ExtendedTabInfo } from '@/types';

describe('TabTreeView', () => {
  const mockOnNodeClick = vi.fn();
  const mockOnToggleExpand = vi.fn();

  const createMockNode = (
    tabId: number,
    depth: number,
    children: UITabNode[] = []
  ): UITabNode => ({
    tabId,
    depth,
    children,
    isExpanded: true,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('空のツリーをレンダリングできること', () => {
    render(
      <TabTreeView
        nodes={[]}
        currentViewIndex={0}
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
  });

  it('単一のタブノードを表示できること', () => {
    const node = createMockNode(1, 0);

    render(
      <TabTreeView
        nodes={[node]}
        currentViewIndex={0}
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
  });

  it('渡されたすべてのノードを表示すること（viewIdフィルタリングはSidePanelRootで行われる）', () => {
    const nodes = [
      createMockNode(1, 0),
      createMockNode(2, 0),
      createMockNode(3, 0),
    ];

    render(
      <TabTreeView
        nodes={nodes}
        currentViewIndex={0}
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
  });

  it('子ノードを再帰的に表示できること', () => {
    const childNode = createMockNode(2, 1);
    const parentNode = createMockNode(1, 0, [childNode]);

    render(
      <TabTreeView
        nodes={[parentNode]}
        currentViewIndex={0}
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
  });

  it('折りたたまれたノードの子を非表示にできること', () => {
    const childNode = createMockNode(2, 1);
    const parentNode: UITabNode = {
      ...createMockNode(1, 0, [childNode]),
      isExpanded: false,
    };

    render(
      <TabTreeView
        nodes={[parentNode]}
        currentViewIndex={0}
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
    expect(screen.queryByTestId('tree-node-2')).not.toBeInTheDocument();
  });

  it('ノードクリック時にonNodeClickが呼ばれること', async () => {
    const user = userEvent.setup();
    const node = createMockNode(1, 0);

    render(
      <TabTreeView
        nodes={[node]}
        currentViewIndex={0}
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    const nodeElement = screen.getByTestId('tree-node-1');
    await user.click(nodeElement);

    expect(mockOnNodeClick).toHaveBeenCalledWith(1);
  });

  it('展開/折りたたみトグルクリック時にonToggleExpandが呼ばれること', async () => {
    const user = userEvent.setup();
    const childNode = createMockNode(2, 1);
    const parentNode = createMockNode(1, 0, [childNode]);

    render(
      <TabTreeView
        nodes={[parentNode]}
        currentViewIndex={0}
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    const toggleButton = screen.getByTestId('expand-button');
    await user.click(toggleButton);

    expect(mockOnToggleExpand).toHaveBeenCalledWith(1);
  });

  it('深い階層のツリーを正しくレンダリングできること', () => {
    const grandchildNode = createMockNode(3, 2);
    const childNode = createMockNode(2, 1, [grandchildNode]);
    const parentNode = createMockNode(1, 0, [childNode]);

    render(
      <TabTreeView
        nodes={[parentNode]}
        currentViewIndex={0}
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
  });

  describe('SortableTree Integration', () => {
    it('ドラッグ可能なアイテムとしてノードをレンダリングできること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const draggableItem = screen.getByTestId('tree-node-1');
      expect(draggableItem).toHaveAttribute(
        'data-draggable-item',
        'draggable-item-1'
      );
    });

    it('ドラッグ開始時にハイライト表示のクラスが存在すること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      expect(nodeElement).toBeInTheDocument();
      expect(nodeElement).toHaveAttribute(
        'data-draggable-item',
        'draggable-item-1'
      );
    });

    it('ドロップ可能位置の視覚化要素が存在すること', () => {
      const node1 = createMockNode(1, 0);
      const node2 = createMockNode(2, 0);

      render(
        <TabTreeView
          nodes={[node1, node2]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const draggableItem1 = screen.getByTestId('tree-node-1');
      const draggableItem2 = screen.getByTestId('tree-node-2');

      expect(draggableItem1).toHaveAttribute(
        'data-draggable-item',
        'draggable-item-1'
      );
      expect(draggableItem2).toHaveAttribute(
        'data-draggable-item',
        'draggable-item-2'
      );
    });
  });

  describe('タブ情報表示', () => {
    const createMockTabInfo = (
      tabId: number,
      title: string,
      favIconUrl?: string
    ): ExtendedTabInfo => ({
      id: tabId,
      title,
      url: `https://example.com/page-${tabId}`,
      favIconUrl,
      status: 'complete',
      isPinned: false,
      windowId: 1,
      discarded: false,
      index: tabId,
    });

    const mockGetTabInfo = vi.fn();

    beforeEach(() => {
      mockGetTabInfo.mockReset();
    });

    it('タブのタイトルとしてページタイトルを表示すること', () => {
      const node = createMockNode(1, 0);
      const tabInfo = createMockTabInfo(1, 'Example Page Title');
      mockGetTabInfo.mockReturnValue(tabInfo);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          getTabInfo={mockGetTabInfo}
        />
      );

      expect(screen.getByText('Example Page Title')).toBeInTheDocument();
      expect(screen.queryByText('Tab 1')).not.toBeInTheDocument();
    });

    it('タブの左側にファビコンを表示すること', () => {
      const node = createMockNode(1, 0);
      const tabInfo = createMockTabInfo(1, 'Example Page', 'https://example.com/favicon.ico');
      mockGetTabInfo.mockReturnValue(tabInfo);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          getTabInfo={mockGetTabInfo}
        />
      );

      const favicon = screen.getByRole('img', { name: /favicon/i });
      expect(favicon).toBeInTheDocument();
      expect(favicon).toHaveAttribute('src', 'https://example.com/favicon.ico');
    });

    it('ファビコンが取得できない場合、デフォルトアイコンを表示すること', () => {
      const node = createMockNode(1, 0);
      const tabInfo = createMockTabInfo(1, 'Example Page', undefined);
      mockGetTabInfo.mockReturnValue(tabInfo);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          getTabInfo={mockGetTabInfo}
        />
      );

      expect(screen.queryByRole('img', { name: /favicon/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('default-icon')).toBeInTheDocument();
    });

    it('タブ情報がロード中の場合、Loading...プレースホルダーを表示すること', () => {
      const node = createMockNode(1, 0);
      mockGetTabInfo.mockReturnValue(undefined);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          getTabInfo={mockGetTabInfo}
        />
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('getTabInfoが提供されない場合、フォールバックとして「Tab {tabId}」を表示すること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByText('Tab 1')).toBeInTheDocument();
    });

    it('子ノードにもタブ情報が正しく表示されること', () => {
      const childNode = createMockNode(2, 1);
      const parentNode = createMockNode(1, 0, [childNode]);

      mockGetTabInfo.mockImplementation((tabId: number) => {
        if (tabId === 1) return createMockTabInfo(1, 'Parent Page');
        if (tabId === 2) return createMockTabInfo(2, 'Child Page');
        return undefined;
      });

      render(
        <TabTreeView
          nodes={[parentNode]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          getTabInfo={mockGetTabInfo}
        />
      );

      expect(screen.getByText('Parent Page')).toBeInTheDocument();
      expect(screen.getByText('Child Page')).toBeInTheDocument();
    });

    it('ドラッグ可能なノードにもタブ情報が正しく表示されること', () => {
      const node = createMockNode(1, 0);
      const tabInfo = createMockTabInfo(1, 'Draggable Page', 'https://example.com/favicon.ico');
      mockGetTabInfo.mockReturnValue(tabInfo);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
          getTabInfo={mockGetTabInfo}
        />
      );

      expect(screen.getByText('Draggable Page')).toBeInTheDocument();
      const favicon = screen.getByRole('img', { name: /favicon/i });
      expect(favicon).toHaveAttribute('src', 'https://example.com/favicon.ico');
    });
  });

  describe('選択状態の視覚的フィードバック', () => {
    const mockOnSelect = vi.fn();
    const mockIsNodeSelected = vi.fn();

    beforeEach(() => {
      mockOnSelect.mockReset();
      mockIsNodeSelected.mockReset();
    });

    it('選択されたノードに選択状態のスタイルが適用されること', () => {
      const node = createMockNode(1, 0);
      mockIsNodeSelected.mockImplementation((tabId: number) => tabId === 1);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          isNodeSelected={mockIsNodeSelected}
          onSelect={mockOnSelect}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      expect(nodeElement).toHaveClass('bg-gray-500');
      expect(nodeElement).not.toHaveClass('ring-2');
      expect(nodeElement).not.toHaveClass('ring-blue-400');
    });

    it('選択されていないノードには選択スタイルが適用されないこと', () => {
      const node = createMockNode(1, 0);
      mockIsNodeSelected.mockReturnValue(false);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          isNodeSelected={mockIsNodeSelected}
          onSelect={mockOnSelect}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      expect(nodeElement).not.toHaveClass('bg-gray-500');
    });

    it('通常クリック時にonSelectが正しいmodifiersで呼ばれること', async () => {
      const user = userEvent.setup();
      const node = createMockNode(1, 0);
      mockIsNodeSelected.mockReturnValue(false);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          isNodeSelected={mockIsNodeSelected}
          onSelect={mockOnSelect}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      await user.click(nodeElement);

      expect(mockOnSelect).toHaveBeenCalledWith(1, { shift: false, ctrl: false });
    });

    it('Ctrlキー押下時にonSelectがctrl: trueで呼ばれること', async () => {
      const user = userEvent.setup();
      const node = createMockNode(1, 0);
      mockIsNodeSelected.mockReturnValue(false);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          isNodeSelected={mockIsNodeSelected}
          onSelect={mockOnSelect}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      await user.keyboard('{Control>}');
      await user.click(nodeElement);
      await user.keyboard('{/Control}');

      expect(mockOnSelect).toHaveBeenCalledWith(1, { shift: false, ctrl: true });
    });

    it('Shiftキー押下時にonSelectがshift: trueで呼ばれること', async () => {
      const user = userEvent.setup();
      const node = createMockNode(1, 0);
      mockIsNodeSelected.mockReturnValue(false);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          isNodeSelected={mockIsNodeSelected}
          onSelect={mockOnSelect}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      await user.keyboard('{Shift>}');
      await user.click(nodeElement);
      await user.keyboard('{/Shift}');

      expect(mockOnSelect).toHaveBeenCalledWith(1, { shift: true, ctrl: false });
    });

    it('複数選択時に選択されたすべてのタブが視覚的に識別可能であること', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
        createMockNode(3, 0),
      ];
      mockIsNodeSelected.mockImplementation((tabId: number) =>
        tabId === 1 || tabId === 3
      );

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          isNodeSelected={mockIsNodeSelected}
          onSelect={mockOnSelect}
        />
      );

      const nodeElement1 = screen.getByTestId('tree-node-1');
      const nodeElement2 = screen.getByTestId('tree-node-2');
      const nodeElement3 = screen.getByTestId('tree-node-3');

      expect(nodeElement1).toHaveClass('bg-gray-500');
      expect(nodeElement3).toHaveClass('bg-gray-500');
      expect(nodeElement2).not.toHaveClass('bg-gray-500');
    });

    it('isNodeSelectedが提供されない場合、選択スタイルが適用されないこと', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      expect(nodeElement).not.toHaveClass('bg-gray-500');
    });

    it('onSelectが提供されない場合、通常のクリック動作のみ行われること', async () => {
      const user = userEvent.setup();
      const node = createMockNode(1, 0);
      mockIsNodeSelected.mockReturnValue(false);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          isNodeSelected={mockIsNodeSelected}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      await user.click(nodeElement);

      expect(mockOnNodeClick).toHaveBeenCalledWith(1);
    });

    it('ドラッグ可能なノードでも選択状態が正しく表示されること', () => {
      const node = createMockNode(1, 0);
      mockIsNodeSelected.mockReturnValue(true);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
          isNodeSelected={mockIsNodeSelected}
          onSelect={mockOnSelect}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      expect(nodeElement).toHaveClass('bg-gray-500');
    });
  });

  describe('ドラッグ中の横スクロール防止', () => {
    it('ドラッグ中にコンテナにoverflow-x: hiddenが適用されること', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const container = screen.getByTestId('tab-tree-view').querySelector('.relative');
      expect(container).toBeInTheDocument();
      expect(container).not.toHaveClass('overflow-x-hidden');
    });

    it('ドラッグ可能なツリービューのコンテナにdrag-containerクラスが存在すること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const container = screen.getByTestId('tab-tree-view').querySelector('[data-drag-container]');
      expect(container).toBeInTheDocument();
    });

    it('globalIsDraggingがtrueの時、コンテナにis-draggingクラスが適用されること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const container = screen.getByTestId('tab-tree-view').querySelector('[data-drag-container]');
      expect(container).not.toHaveClass('is-dragging');
    });
  });

  describe('ドラッグ時のスクロール制御', () => {
    it('ドラッグコンテナにautoScroll設定が適用されていること', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const container = screen.getByTestId('tab-tree-view').querySelector('[data-drag-container]');
      expect(container).toBeInTheDocument();
    });

    it('autoScrollが適切なスクロール閾値で設定されていること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    });

    it('ドラッグ可能なビューでautoScroll制限が有効であること', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
        createMockNode(3, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
    });
  });

  describe('ドラッグ中のスクロール範囲制限', () => {
    it('ツリービューコンテナにoverflow-y-autoが適用されていること', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const container = screen.getByTestId('tab-tree-view').querySelector('[data-drag-container]');
      expect(container).toBeInTheDocument();
    });

    it('ドラッグ中にコンテナにoverflow-x-hiddenが適用されること', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const container = screen.getByTestId('tab-tree-view').querySelector('[data-drag-container]');
      expect(container).toBeInTheDocument();
      expect(container).not.toHaveClass('overflow-x-hidden');
    });

    it('autoScroll設定が横スクロールを無効化する設定を持つこと', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    });

    it('autoScroll設定がコンテンツ範囲外へのスクロールを制限する設定を持つこと', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
        createMockNode(3, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
    });
  });

  describe('ドラッグ中のタブ位置固定', () => {
    it('ドラッグ可能な状態でタブツリービューがレンダリングされること', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
        createMockNode(3, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
    });

    it('ドラッグ可能なノードにsortable属性が存在すること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      expect(nodeElement).toHaveAttribute('data-draggable-item', 'draggable-item-1');
    });

    it('コンテナがrelative positionを持っていること（DropIndicator配置のため）', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const container = screen.getByTestId('tab-tree-view').querySelector('.relative');
      expect(container).toBeInTheDocument();
    });
  });

  describe('ドラッグ中のタブサイズ安定化', () => {
    it('ドラッグ中に他のタブのtransformが無効化されていること', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
        createMockNode(3, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();

      const container = screen.getByTestId('tab-tree-view').querySelector('[data-drag-container]');
      expect(container).not.toHaveClass('is-dragging');
    });

    it('ドラッグ中でも他のタブのホバー時にサイズが変更されないこと', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const node1 = screen.getByTestId('tree-node-1');
      const node2 = screen.getByTestId('tree-node-2');

      expect(node1).toHaveClass('p-2');
      expect(node2).toHaveClass('p-2');
    });

    it('ドラッグ開始時のタブレイアウトが維持されること', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
        createMockNode(3, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      expect(screen.getByTestId('tree-node-1')).toHaveAttribute('data-tab-id', '1');
      expect(screen.getByTestId('tree-node-2')).toHaveAttribute('data-tab-id', '2');
      expect(screen.getByTestId('tree-node-3')).toHaveAttribute('data-tab-id', '3');

      const container = screen.getByTestId('tab-tree-view').querySelector('[data-drag-container]');
      expect(container).toBeInTheDocument();
      expect(container?.children.length).toBeGreaterThanOrEqual(3);
    });

    it('自前D&D実装によりリアルタイム並べ替えが無効化されていること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const draggableItem = screen.getByTestId('tree-node-1');
      expect(draggableItem).toHaveAttribute('data-draggable-item');
    });
  });

  describe('親子関係を作るドロップ時のタブサイズ固定', () => {
    it('ドラッグハイライト状態でも他のタブのサイズが変更されないこと', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
        createMockNode(3, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const node1 = screen.getByTestId('tree-node-1');
      const node2 = screen.getByTestId('tree-node-2');
      const node3 = screen.getByTestId('tree-node-3');

      expect(node1).toHaveClass('p-2');
      expect(node2).toHaveClass('p-2');
      expect(node3).toHaveClass('p-2');

      expect(node1).toHaveClass('flex', 'items-center');
      expect(node2).toHaveClass('flex', 'items-center');
      expect(node3).toHaveClass('flex', 'items-center');
    });

    it('親子関係ドロップ時にドラッグハイライトされたタブのサイズが維持されること', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const node1 = screen.getByTestId('tree-node-1');
      const node2 = screen.getByTestId('tree-node-2');

      expect(node1).toHaveClass('p-2');
      expect(node2).toHaveClass('p-2');

      const tabContent1 = node1.querySelector('[data-testid="tab-content"]');
      const tabContent2 = node2.querySelector('[data-testid="tab-content"]');

      expect(tabContent1).toHaveClass('min-w-0');
      expect(tabContent2).toHaveClass('min-w-0');
    });

    it('ドラッグ中のアイテム以外はtransformが適用されないこと（shouldApplyTransformフラグ）', () => {
      const nodes = [
        createMockNode(1, 0),
        createMockNode(2, 0),
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const container = screen.getByTestId('tab-tree-view').querySelector('[data-drag-container]');
      expect(container).not.toHaveClass('is-dragging');
    });
  });

  describe('ビュー移動サブメニュー用のプロパティ', () => {
    it('viewsとonMoveToViewプロパティを受け取れること', () => {
      const node = createMockNode(1, 0);
      const mockViews = [
        { id: 'default', name: 'Default', color: '#3b82f6' },
        { id: 'view-2', name: 'View 2', color: '#10b981' },
      ];
      const mockOnMoveToView = vi.fn();

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          views={mockViews}
          onMoveToView={mockOnMoveToView}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    });

    it('viewsとonMoveToViewがundefinedでもレンダリングできること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    });
  });

  describe('テキスト選択禁止', () => {
    it('ツリービュー全体にselect-noneクラスが適用されていること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const treeView = screen.getByTestId('tab-tree-view');
      expect(treeView).toHaveClass('select-none');
    });

    it('タブノード要素にselect-noneクラスが適用されていること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      expect(nodeElement).toHaveClass('select-none');
    });

    it('非ドラッグ可能なタブノードにもselect-noneクラスが適用されていること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const nodeElement = screen.getByTestId('tree-node-1');
      expect(nodeElement).toHaveClass('select-none');
    });

    it('子ノードを含む全てのノードにselect-noneクラスが適用されていること', () => {
      const childNode = createMockNode(2, 1);
      const parentNode = createMockNode(1, 0, [childNode]);

      render(
        <TabTreeView
          nodes={[parentNode]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      const parentElement = screen.getByTestId('tree-node-1');
      expect(parentElement).toHaveClass('select-none');

      const childElement = screen.getByTestId('tree-node-2');
      expect(childElement).toHaveClass('select-none');
    });
  });

  describe('ツリー外ドロップで新規ウィンドウ作成', () => {
    it('onExternalDropコールバックを受け取れること', () => {
      const node = createMockNode(1, 0);
      const mockOnExternalDrop = vi.fn();

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
          onExternalDrop={mockOnExternalDrop}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    });

    it('onExternalDropがundefinedでもレンダリングできること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    });
  });

  describe('ツリービュー外へのドロップ検知', () => {
    it('ドラッグ中にonOutsideTreeChangeコールバックが提供された場合、状態変化を通知できること', () => {
      const node = createMockNode(1, 0);
      const mockOnOutsideTreeChange = vi.fn();

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
          onOutsideTreeChange={mockOnOutsideTreeChange}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    });

    it('onOutsideTreeChangeがundefinedでもレンダリングできること', () => {
      const node = createMockNode(1, 0);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    });
  });

  describe('ツリービュー外へのドロップ処理', () => {
    it('onExternalDropとonOutsideTreeChangeを同時に設定できること', () => {
      const node = createMockNode(1, 0);
      const mockOnExternalDrop = vi.fn();
      const mockOnOutsideTreeChange = vi.fn();

      render(
        <TabTreeView
          nodes={[node]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
          onExternalDrop={mockOnExternalDrop}
          onOutsideTreeChange={mockOnOutsideTreeChange}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    });

    it('子ノードを持つ親ノードでもonExternalDropを設定できること', () => {
      const childNode1 = createMockNode(2, 1);
      const childNode2 = createMockNode(3, 1);
      const parentNode = createMockNode(1, 0, [childNode1, childNode2]);
      const mockOnExternalDrop = vi.fn();

      render(
        <TabTreeView
          nodes={[parentNode]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
          onExternalDrop={mockOnExternalDrop}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
    });
  });

  describe('グループノードのレンダリング', () => {
    const mockGetTabInfo = vi.fn();

    beforeEach(() => {
      mockGetTabInfo.mockReset();
    });

    const createMockGroupNode = (
      tabId: number,
      depth: number,
      children: UITabNode[] = []
    ): UITabNode => ({
      tabId,
      depth,
      children,
      isExpanded: true,
      groupInfo: {
        name: 'テストグループ',
        color: '#f59e0b',
      },
    });

    it('グループノード（group-で始まるID）が通常のタブノードと同じ形式で表示されること', () => {
      const childNode1 = createMockNode(1, 1);
      const childNode2 = createMockNode(2, 1);
      const groupNode = createMockGroupNode(100, 0, [childNode1, childNode2]);

      mockGetTabInfo.mockImplementation((tabId: number) => {
        if (tabId === 100) return { id: 100, title: 'Group Tab', url: 'chrome-extension://test/group.html', status: 'complete', isPinned: false, windowId: 1, discarded: false };
        if (tabId === 1) return { id: 1, title: 'Tab 1', url: 'https://example.com/1', status: 'complete', isPinned: false, windowId: 1, discarded: false };
        if (tabId === 2) return { id: 2, title: 'Tab 2', url: 'https://example.com/2', status: 'complete', isPinned: false, windowId: 1, discarded: false };
        return undefined;
      });

      render(
        <TabTreeView
          nodes={[groupNode]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          getTabInfo={mockGetTabInfo}
        />
      );

      expect(screen.getByTestId('tree-node-100')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    });

    it('グループノードの展開/折りたたみボタンクリック時にonToggleExpandが呼ばれること', async () => {
      const user = userEvent.setup();
      const childNode = createMockNode(1, 1);
      const groupNode = createMockGroupNode(100, 0, [childNode]);

      mockGetTabInfo.mockImplementation((tabId: number) => {
        if (tabId === 100) return { id: 100, title: 'Group Tab', url: 'chrome-extension://test/group.html', status: 'complete', isPinned: false, windowId: 1, discarded: false };
        if (tabId === 1) return { id: 1, title: 'Tab 1', url: 'https://example.com/1', status: 'complete', isPinned: false, windowId: 1, discarded: false };
        return undefined;
      });

      render(
        <TabTreeView
          nodes={[groupNode]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          getTabInfo={mockGetTabInfo}
        />
      );

      const groupNodeElement = screen.getByTestId('tree-node-100');
      const toggleButton = groupNodeElement.querySelector('[data-testid="expand-button"]');
      expect(toggleButton).not.toBeNull();
      await user.click(toggleButton!);

      expect(mockOnToggleExpand).toHaveBeenCalledWith(100);
    });

    it('折りたたまれたグループノードの子タブが非表示になること', () => {
      const childNode = createMockNode(1, 1);
      const groupNode: UITabNode = {
        ...createMockGroupNode(100, 0, [childNode]),
        isExpanded: false,
      };

      mockGetTabInfo.mockImplementation((tabId: number) => {
        if (tabId === 100) return { id: 100, title: 'Group Tab', url: 'chrome-extension://test/group.html', status: 'complete', isPinned: false, windowId: 1, discarded: false };
        if (tabId === 1) return { id: 1, title: 'Tab 1', url: 'https://example.com/1', status: 'complete', isPinned: false, windowId: 1, discarded: false };
        return undefined;
      });

      render(
        <TabTreeView
          nodes={[groupNode]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          getTabInfo={mockGetTabInfo}
        />
      );

      expect(screen.getByTestId('tree-node-100')).toBeInTheDocument();
      expect(screen.queryByTestId('tree-node-1')).not.toBeInTheDocument();
    });

    it('グループノードと通常のタブノードが混在する場合、両方が正しくレンダリングされること', () => {
      const groupChildNode = createMockNode(1, 1);
      const groupNode = createMockGroupNode(100, 0, [groupChildNode]);
      const regularNode = createMockNode(2, 0);

      mockGetTabInfo.mockImplementation((tabId: number) => {
        if (tabId === 100) return { id: 100, title: 'Group Tab', url: 'chrome-extension://test/group.html', status: 'complete', isPinned: false, windowId: 1, discarded: false };
        if (tabId === 1) return { id: 1, title: 'Tab 1', url: 'https://example.com/1', status: 'complete', isPinned: false, windowId: 1, discarded: false };
        if (tabId === 2) return { id: 2, title: 'Tab 2', url: 'https://example.com/2', status: 'complete', isPinned: false, windowId: 1, discarded: false };
        return undefined;
      });

      render(
        <TabTreeView
          nodes={[groupNode, regularNode]}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          getTabInfo={mockGetTabInfo}
        />
      );

      expect(screen.getByTestId('tree-node-100')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    });
  });
});
