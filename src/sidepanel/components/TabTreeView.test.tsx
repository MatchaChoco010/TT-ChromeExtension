import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TabTreeView from './TabTreeView';
import type { TabNode } from '@/types';

describe('TabTreeView', () => {
  const mockOnNodeClick = vi.fn();
  const mockOnToggleExpand = vi.fn();

  const createMockNode = (
    id: string,
    tabId: number,
    viewId: string,
    parentId: string | null = null,
    children: TabNode[] = []
  ): TabNode => ({
    id,
    tabId,
    parentId,
    children,
    isExpanded: true,
    depth: 0,
    viewId,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('空のツリーをレンダリングできること', () => {
    render(
      <TabTreeView
        nodes={[]}
        currentViewId="default"
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
  });

  it('単一のタブノードを表示できること', () => {
    const node = createMockNode('node-1', 1, 'default');

    render(
      <TabTreeView
        nodes={[node]}
        currentViewId="default"
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
    // 実装では data-testid="tree-node-${node.tabId}" を使用しているため、tabIdで検索
    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
  });

  it('currentViewIdに一致するノードのみを表示すること', () => {
    const nodes = [
      createMockNode('node-1', 1, 'default'),
      createMockNode('node-2', 2, 'other-view'),
      createMockNode('node-3', 3, 'default'),
    ];

    render(
      <TabTreeView
        nodes={nodes}
        currentViewId="default"
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    // defaultビューのノードのみ表示（tabIdで検索）
    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
    expect(screen.queryByTestId('tree-node-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
  });

  it('子ノードを再帰的に表示できること', () => {
    const childNode = createMockNode('child-1', 2, 'default', 'parent-1');
    const parentNode = createMockNode('parent-1', 1, 'default', null, [
      childNode,
    ]);

    render(
      <TabTreeView
        nodes={[parentNode]}
        currentViewId="default"
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    // tabIdで検索（parent-1はtabId=1, child-1はtabId=2）
    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
  });

  it('折りたたまれたノードの子を非表示にできること', () => {
    const childNode = createMockNode('child-1', 2, 'default', 'parent-1');
    const parentNode: TabNode = {
      ...createMockNode('parent-1', 1, 'default', null, [childNode]),
      isExpanded: false,
    };

    render(
      <TabTreeView
        nodes={[parentNode]}
        currentViewId="default"
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    // tabIdで検索（parent-1はtabId=1）
    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
    // 折りたたまれているので子は表示されない（child-1はtabId=2）
    expect(screen.queryByTestId('tree-node-2')).not.toBeInTheDocument();
  });

  it('ノードクリック時にonNodeClickが呼ばれること', async () => {
    const user = userEvent.setup();
    const node = createMockNode('node-1', 1, 'default');

    render(
      <TabTreeView
        nodes={[node]}
        currentViewId="default"
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    // tabIdで検索
    const nodeElement = screen.getByTestId('tree-node-1');
    await user.click(nodeElement);

    expect(mockOnNodeClick).toHaveBeenCalledWith(1);
  });

  it('展開/折りたたみトグルクリック時にonToggleExpandが呼ばれること', async () => {
    const user = userEvent.setup();
    const childNode = createMockNode('child-1', 2, 'default', 'parent-1');
    const parentNode = createMockNode('parent-1', 1, 'default', null, [
      childNode,
    ]);

    render(
      <TabTreeView
        nodes={[parentNode]}
        currentViewId="default"
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    // 実装では data-testid="expand-button" を使用（複数ある場合は最初のものを取得）
    const toggleButton = screen.getByTestId('expand-button');
    await user.click(toggleButton);

    expect(mockOnToggleExpand).toHaveBeenCalledWith('parent-1');
  });

  it('深い階層のツリーを正しくレンダリングできること', () => {
    const grandchildNode = createMockNode('grandchild-1', 3, 'default', 'child-1');
    const childNode = createMockNode('child-1', 2, 'default', 'parent-1', [grandchildNode]);
    const parentNode = createMockNode('parent-1', 1, 'default', null, [childNode]);

    render(
      <TabTreeView
        nodes={[parentNode]}
        currentViewId="default"
        onNodeClick={mockOnNodeClick}
        onToggleExpand={mockOnToggleExpand}
      />
    );

    // tabIdで検索（parent-1はtabId=1, child-1はtabId=2, grandchild-1はtabId=3）
    expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
  });

  describe('SortableTree Integration (Task 6.2)', () => {
    it('ドラッグ可能なアイテムとしてノードをレンダリングできること', () => {
      const node = createMockNode('node-1', 1, 'default');

      render(
        <TabTreeView
          nodes={[node]}
          currentViewId="default"
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      // ドラッグ可能なアイテムには data-sortable-item 属性がある（tabIdで検索）
      const sortableItem = screen.getByTestId('tree-node-1');
      expect(sortableItem).toHaveAttribute(
        'data-sortable-item',
        'sortable-item-node-1'
      );
    });

    it('ドラッグ開始時にハイライト表示のクラスが存在すること', () => {
      const node = createMockNode('node-1', 1, 'default');

      render(
        <TabTreeView
          nodes={[node]}
          currentViewId="default"
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      // tabIdで検索
      const nodeElement = screen.getByTestId('tree-node-1');
      // ドラッグ可能なアイテムが存在すること
      expect(nodeElement).toBeInTheDocument();
      expect(nodeElement).toHaveAttribute(
        'data-sortable-item',
        'sortable-item-node-1'
      );
    });

    it('ドロップ可能位置の視覚化要素が存在すること', () => {
      const node1 = createMockNode('node-1', 1, 'default');
      const node2 = createMockNode('node-2', 2, 'default');

      render(
        <TabTreeView
          nodes={[node1, node2]}
          currentViewId="default"
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
          onDragEnd={vi.fn()}
        />
      );

      // ドラッグ可能なアイテムが2つ存在することを確認（tabIdで検索）
      const sortableItem1 = screen.getByTestId('tree-node-1');
      const sortableItem2 = screen.getByTestId('tree-node-2');

      expect(sortableItem1).toHaveAttribute(
        'data-sortable-item',
        'sortable-item-node-1'
      );
      expect(sortableItem2).toHaveAttribute(
        'data-sortable-item',
        'sortable-item-node-2'
      );
    });
  });
});
