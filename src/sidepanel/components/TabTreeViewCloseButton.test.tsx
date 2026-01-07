import { describe, it, expect, beforeEach, vi, afterEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/test/test-utils';
import TabTreeView from './TabTreeView';
import type { TabNode, ExtendedTabInfo } from '@/types';

describe('タブにホバー時の閉じるボタンを実装する', () => {
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
    windowId: 1,
    discarded: false,
    index: id,
  });

  const mockGetTabInfo = (nodes: TabNode[]): ((tabId: number) => ExtendedTabInfo | undefined) => {
    const tabInfoMap: Record<number, ExtendedTabInfo> = {};
    for (const node of nodes) {
      tabInfoMap[node.tabId] = createMockTabInfo(node.tabId, `Tab ${node.tabId}`);
    }
    return (tabId: number) => tabInfoMap[tabId];
  };

  describe('タブにホバー時に閉じるボタンを表示する', () => {
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

      const closeButtonWrapper = screen.getByTestId('close-button-wrapper');
      expect(closeButtonWrapper).toHaveClass('invisible');

      fireEvent.mouseEnter(treeNode);

      expect(closeButtonWrapper).toHaveClass('visible');
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

      fireEvent.mouseEnter(childTreeNode);

      const closeButtonWrappers = screen.getAllByTestId('close-button-wrapper');
      const childCloseButtonWrapper = closeButtonWrappers[1];
      expect(childCloseButtonWrapper).toHaveClass('visible');
    });
  });

  describe('閉じるボタンをクリックするとタブを閉じる', () => {
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

      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

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

      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      expect(onNodeClick).not.toHaveBeenCalled();
    });
  });

  describe('ホバー解除時に閉じるボタンを非表示にする', () => {
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
      const closeButtonWrapper = screen.getByTestId('close-button-wrapper');

      fireEvent.mouseEnter(treeNode);
      expect(closeButtonWrapper).toHaveClass('visible');

      fireEvent.mouseLeave(treeNode);

      expect(closeButtonWrapper).toHaveClass('invisible');
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
      const closeButtonWrappers = screen.getAllByTestId('close-button-wrapper');
      const wrapper1 = closeButtonWrappers[0];
      const wrapper2 = closeButtonWrappers[1];

      fireEvent.mouseEnter(treeNode1);
      expect(wrapper1).toHaveClass('visible');
      expect(wrapper2).toHaveClass('invisible');

      fireEvent.mouseLeave(treeNode1);

      fireEvent.mouseEnter(treeNode2);

      expect(wrapper1).toHaveClass('invisible');
      expect(wrapper2).toHaveClass('visible');
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
      const closeButtonWrapper = screen.getByTestId('close-button-wrapper');

      expect(closeButtonWrapper).toHaveClass('invisible');

      fireEvent.mouseEnter(treeNode);

      expect(closeButtonWrapper).toHaveClass('visible');
    });
  });

  describe('閉じるボタンの右端固定とホバー時サイズ安定化', () => {
    describe('閉じるボタンはタブの右端に固定される', () => {
      it('閉じるボタンのラッパーはflex-shrink-0クラスを持つ', () => {
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

        const closeButtonWrapper = screen.getByTestId('close-button-wrapper');
        expect(closeButtonWrapper).toHaveClass('flex-shrink-0');
      });

      it('タブコンテンツがjustify-betweenで配置されている', () => {
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

        const tabContent = screen.getByTestId('tab-content');
        expect(tabContent).toHaveClass('justify-between');
      });
    });

    describe('ホバー時にタブサイズが変わらない', () => {
      it('閉じるボタンラッパーは常にDOMに存在し、visible/invisibleで制御される', () => {
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

        const closeButtonWrapper = screen.getByTestId('close-button-wrapper');
        expect(closeButtonWrapper).toBeInTheDocument();

        expect(closeButtonWrapper).toHaveClass('invisible');

        const treeNode = screen.getByTestId('tree-node-1');

        fireEvent.mouseEnter(treeNode);
        expect(closeButtonWrapper).toBeInTheDocument();
        expect(closeButtonWrapper).toHaveClass('visible');

        fireEvent.mouseLeave(treeNode);
        expect(closeButtonWrapper).toBeInTheDocument();
        expect(closeButtonWrapper).toHaveClass('invisible');
      });

      it('ドラッグ可能なノードでも閉じるボタンラッパーは常にDOMに存在する', () => {
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

        const closeButtonWrapper = screen.getByTestId('close-button-wrapper');
        expect(closeButtonWrapper).toBeInTheDocument();

        expect(closeButtonWrapper).toHaveClass('invisible');
      });
    });
  });
});
