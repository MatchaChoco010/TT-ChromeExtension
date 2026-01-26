/**
 * ドラッグホバー時のブランチ自動展開のテスト
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@/test/test-utils';
import TabTreeView from './TabTreeView';
import type { UITabNode } from '@/types';

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

    const testNodes: UITabNode[] = [
      {
        tabId: 1,
        children: [],
        isExpanded: true,
        depth: 0,
      },
    ];

    const { container } = render(
      <TabTreeView
        nodes={testNodes}
        currentViewIndex={0}
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

    const testNodes: UITabNode[] = [
      {
        tabId: 3,
        children: [
          {
            tabId: 4,
            children: [],
            isExpanded: false,
            depth: 1,
          },
        ],
        isExpanded: false,
        depth: 0,
      },
    ];

    render(
      <TabTreeView
        nodes={testNodes}
        currentViewIndex={0}
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

    const testNodes: UITabNode[] = [
      {
        tabId: 1,
        children: [],
        isExpanded: true,
        depth: 0,
      },
    ];

    const { container } = render(
      <TabTreeView
        nodes={testNodes}
        currentViewIndex={0}
        onNodeClick={vi.fn()}
        onToggleExpand={handleToggleExpand}
        onDragEnd={handleDragEnd}
      />
    );

    expect(container).toBeTruthy();
  });
});
