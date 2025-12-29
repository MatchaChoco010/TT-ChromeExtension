import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import TabTreeView from './TabTreeView';
import type { TabNode, ExtendedTabInfo } from '@/types';

/**
 * タスク 2.2: タブにホバー時の閉じるボタンを実装するテスト
 *
 * Requirements:
 * - 10.1: タブにマウスカーソルをホバーした場合、タブの右側に閉じるボタンを表示する
 * - 10.2: 閉じるボタンをクリックした場合、そのタブを閉じる
 * - 10.3: タブにホバーしていない場合、閉じるボタンを非表示にする
 */
describe('Task 2.2: タブにホバー時の閉じるボタンを実装する', () => {
  let originalChrome: typeof chrome;
  let mockTabsRemove: Mock;

  beforeEach(() => {
    originalChrome = globalThis.chrome;
    mockTabsRemove = vi.fn().mockResolvedValue(undefined);
    globalThis.chrome = {
      tabs: {
        remove: mockTabsRemove,
      },
    } as unknown as typeof chrome;
  });

  afterEach(() => {
    globalThis.chrome = originalChrome;
    vi.clearAllMocks();
  });

  const createMockNode = (
    id: string,
    tabId: number,
    depth: number = 0,
    children: TabNode[] = [],
    isExpanded: boolean = true,
  ): TabNode => ({
    id,
    tabId,
    parentId: null,
    children,
    isExpanded,
    depth,
    viewId: 'default',
  });

  const createMockTabInfo = (id: number, title: string = 'Test Tab'): ExtendedTabInfo => ({
    id,
    title,
    url: 'https://example.com',
    favIconUrl: undefined,
    status: 'complete',
    isPinned: false,
  });

  const mockGetTabInfo = (nodes: TabNode[]): ((tabId: number) => ExtendedTabInfo | undefined) => {
    const tabInfoMap: Record<number, ExtendedTabInfo> = {};
    for (const node of nodes) {
      tabInfoMap[node.tabId] = createMockTabInfo(node.tabId, `Tab ${node.tabId}`);
    }
    return (tabId: number) => tabInfoMap[tabId];
  };

  describe('Requirement 10.1: タブにホバー時に閉じるボタンを表示する', () => {
    it('タブノードにマウスをホバーすると、閉じるボタンが表示される', () => {
      const node = createMockNode('node-1', 1);
      const getTabInfo = mockGetTabInfo([node]);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          getTabInfo={getTabInfo}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');

      // 最初は閉じるボタンが表示されていない
      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();

      // マウスをホバー
      fireEvent.mouseEnter(treeNode);

      // 閉じるボタンが表示される (Requirement 10.1)
      expect(screen.getByTestId('close-button')).toBeInTheDocument();
    });

    it('子ノードにホバーしても閉じるボタンが表示される', () => {
      const childNode = createMockNode('child-1', 2, 1);
      const parentNode = createMockNode('parent-1', 1, 0, [childNode], true);
      const getTabInfo = mockGetTabInfo([parentNode, childNode]);

      render(
        <TabTreeView
          nodes={[parentNode]}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          getTabInfo={getTabInfo}
        />,
      );

      const childTreeNode = screen.getByTestId('tree-node-2');

      // マウスをホバー
      fireEvent.mouseEnter(childTreeNode);

      // 閉じるボタンが表示される
      expect(screen.getByTestId('close-button')).toBeInTheDocument();
    });
  });

  describe('Requirement 10.2: 閉じるボタンをクリックするとタブを閉じる', () => {
    it('閉じるボタンをクリックすると、chrome.tabs.removeが呼ばれる', async () => {
      const node = createMockNode('node-1', 123);
      const getTabInfo = mockGetTabInfo([node]);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          getTabInfo={getTabInfo}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-123');

      // マウスをホバー
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      // 閉じるボタンをクリック
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // chrome.tabs.removeが呼ばれる (Requirement 10.2)
      await waitFor(() => {
        expect(mockTabsRemove).toHaveBeenCalledWith(123);
      });
    });

    it('閉じるボタンのクリックがノードのクリックイベントを伝播しない', async () => {
      const node = createMockNode('node-1', 1);
      const getTabInfo = mockGetTabInfo([node]);
      const onNodeClick = vi.fn();

      render(
        <TabTreeView
          nodes={[node]}
          currentViewId="default"
          onNodeClick={onNodeClick}
          onToggleExpand={vi.fn()}
          getTabInfo={getTabInfo}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');

      // マウスをホバー
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      // 閉じるボタンをクリック
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // onNodeClickは呼ばれない（イベント伝播が停止されている）
      expect(onNodeClick).not.toHaveBeenCalled();
    });
  });

  describe('Requirement 10.3: ホバー解除時に閉じるボタンを非表示にする', () => {
    it('タブノードからマウスを離すと、閉じるボタンが非表示になる', () => {
      const node = createMockNode('node-1', 1);
      const getTabInfo = mockGetTabInfo([node]);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          getTabInfo={getTabInfo}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');

      // マウスをホバー
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      // マウスを離す
      fireEvent.mouseLeave(treeNode);

      // 閉じるボタンが非表示になる (Requirement 10.3)
      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();
    });

    it('別のノードにホバーすると、元のノードの閉じるボタンが非表示になる', () => {
      const node1 = createMockNode('node-1', 1);
      const node2 = createMockNode('node-2', 2);
      const getTabInfo = mockGetTabInfo([node1, node2]);

      render(
        <TabTreeView
          nodes={[node1, node2]}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          getTabInfo={getTabInfo}
        />,
      );

      const treeNode1 = screen.getByTestId('tree-node-1');
      const treeNode2 = screen.getByTestId('tree-node-2');

      // ノード1にホバー
      fireEvent.mouseEnter(treeNode1);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      // ノード1から離れる
      fireEvent.mouseLeave(treeNode1);

      // ノード2にホバー
      fireEvent.mouseEnter(treeNode2);

      // 閉じるボタンは1つだけ表示されている
      const closeButtons = screen.getAllByTestId('close-button');
      expect(closeButtons).toHaveLength(1);
    });
  });

  describe('ドラッグ可能なノードでのホバー時閉じるボタン', () => {
    it('ドラッグ可能なノードにホバーしても閉じるボタンが表示される', () => {
      const node = createMockNode('node-1', 1);
      const getTabInfo = mockGetTabInfo([node]);

      render(
        <TabTreeView
          nodes={[node]}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onDragEnd={vi.fn()}
          getTabInfo={getTabInfo}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');

      // 最初は閉じるボタンが表示されていない
      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();

      // マウスをホバー
      fireEvent.mouseEnter(treeNode);

      // 閉じるボタンが表示される
      expect(screen.getByTestId('close-button')).toBeInTheDocument();
    });
  });
});
