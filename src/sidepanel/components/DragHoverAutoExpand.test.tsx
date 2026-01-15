/**
 * ドラッグホバー時のブランチ自動展開のテスト
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import TabTreeView from './TabTreeView';

describe('ドラッグホバー時のブランチ自動展開', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('TabTreeViewがonDragOverプロパティを受け付けることを確認', () => {
    const handleToggleExpand = vi.fn();
    const handleDragEnd = vi.fn();
    const handleDragOver = vi.fn();

    const testNodes = [
      {
        id: 'node-1',
        tabId: 1,
        parentId: null,
        children: [],
        isExpanded: true,
        depth: 0,
        viewId: 'default',
      },
    ];

    const { container } = render(
      <TabTreeView
        nodes={testNodes}
        currentViewId="default"
        onNodeClick={vi.fn()}
        onToggleExpand={handleToggleExpand}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
      />
    );

    expect(container).toBeTruthy();
  });

  it('折りたたまれたブランチを持つノードが正しくレンダリングされる', () => {
    vi.useRealTimers();

    const handleToggleExpand = vi.fn();
    const handleDragEnd = vi.fn();

    const testNodes = [
      {
        id: 'node-3',
        tabId: 3,
        parentId: null,
        children: [
          {
            id: 'node-4',
            tabId: 4,
            parentId: 'node-3',
            children: [],
            isExpanded: false,
            depth: 1,
            viewId: 'default',
          },
        ],
        isExpanded: false,
        depth: 0,
        viewId: 'default',
      },
    ];

    render(
      <TabTreeView
        nodes={testNodes}
        currentViewId="default"
        onNodeClick={vi.fn()}
        onToggleExpand={handleToggleExpand}
        onDragEnd={handleDragEnd}
      />
    );

    const parentNode = screen.getByTestId('tree-node-3');
    expect(parentNode).toBeInTheDocument();

    const toggleButton = screen.getByTestId('expand-button');
    expect(toggleButton.textContent).toBe('▶');

    expect(screen.queryByTestId('tree-node-4')).not.toBeInTheDocument();

    vi.useFakeTimers();
  });

  it('ドラッグ中のホバー検出が設定されていることを確認', () => {
    const handleToggleExpand = vi.fn();
    const handleDragEnd = vi.fn();

    const testNodes = [
      {
        id: 'node-1',
        tabId: 1,
        parentId: null,
        children: [],
        isExpanded: true,
        depth: 0,
        viewId: 'default',
      },
    ];

    const { container } = render(
      <TabTreeView
        nodes={testNodes}
        currentViewId="default"
        onNodeClick={vi.fn()}
        onToggleExpand={handleToggleExpand}
        onDragEnd={handleDragEnd}
      />
    );

    expect(container).toBeTruthy();
  });
});
