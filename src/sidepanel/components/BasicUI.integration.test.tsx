import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import SidePanelRoot from './SidePanelRoot';
import TabTreeView from './TabTreeView';
import type { TabNode } from '@/types';

describe('基本UI表示の統合テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria 1.1-1.2: サイドパネル表示とタブツリー表示', () => {
    it('サイドパネルが正しくレンダリングされ、ツリー構造でタブを表示できること', async () => {
      const mockTreeState = {
        views: [
          {
            id: 'default',
            name: 'Default',
            color: '#3b82f6',
          },
        ],
        currentViewId: 'default',
        nodes: {
          'node-1': {
            id: 'node-1',
            tabId: 1,
            parentId: null,
            children: [],
            isExpanded: true,
            depth: 0,
            viewId: 'default',
          } as TabNode,
          'node-2': {
            id: 'node-2',
            tabId: 2,
            parentId: null,
            children: [],
            isExpanded: true,
            depth: 0,
            viewId: 'default',
          } as TabNode,
        },
        tabToNode: {
          1: 'node-1',
          2: 'node-2',
        },
      };

      global.chrome.storage.local.get = vi
        .fn()
        .mockResolvedValue({ tree_state: mockTreeState });

      render(<SidePanelRoot />);

      await waitFor(
        () => {
          expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await waitFor(
        () => {
          expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.queryByText('Vivaldi-TT')).not.toBeInTheDocument();
    });

    it('現在のウィンドウの全タブをツリー構造で表示すること (AC 1.2)', async () => {
      const mockOnNodeClick = vi.fn();
      const mockOnToggleExpand = vi.fn();

      const nodes: TabNode[] = [
        {
          id: 'node-1',
          tabId: 1,
          parentId: null,
          children: [
            {
              id: 'node-2',
              tabId: 2,
              parentId: 'node-1',
              children: [],
              isExpanded: true,
              depth: 1,
              viewId: 'default',
            },
          ],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
        {
          id: 'node-3',
          tabId: 3,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewId="default"
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();

      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();

      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    });

    it('各タブのファビコン、タイトル、階層レベルを表示すること (AC 1.3)', () => {
      const mockOnNodeClick = vi.fn();
      const mockOnToggleExpand = vi.fn();

      const nodes: TabNode[] = [
        {
          id: 'parent',
          tabId: 1,
          parentId: null,
          children: [
            {
              id: 'child',
              tabId: 2,
              parentId: 'parent',
              children: [],
              isExpanded: true,
              depth: 1,
              viewId: 'default',
            },
          ],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewId="default"
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const parentNode = screen.getByTestId('tree-node-1');
      const childNode = screen.getByTestId('tree-node-2');

      expect(parentNode).toBeInTheDocument();
      expect(childNode).toBeInTheDocument();

      expect(parentNode).toHaveStyle({ paddingLeft: '8px' });
      expect(childNode).toHaveStyle({ paddingLeft: '28px' });
    });
  });

  describe('Acceptance Criteria 1.4: リアルタイム更新', () => {
    it('タブが開かれたり閉じられたりしたときにサイドパネルがリアルタイムで更新されること', async () => {
      const mockOnNodeClick = vi.fn();
      const mockOnToggleExpand = vi.fn();

      const initialNodes: TabNode[] = [
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

      const { rerender } = render(
        <TabTreeView
          nodes={initialNodes}
          currentViewId="default"
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.queryByTestId('tree-node-2')).not.toBeInTheDocument();

      const updatedNodes: TabNode[] = [
        ...initialNodes,
        {
          id: 'node-2',
          tabId: 2,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
      ];

      rerender(
        <TabTreeView
          nodes={updatedNodes}
          currentViewId="default"
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria 1.5: タブのアクティブ化', () => {
    it('サイドパネル内のタブをクリックしたときに対応するタブがアクティブになること', async () => {
      const user = userEvent.setup();
      const mockOnNodeClick = vi.fn();
      const mockOnToggleExpand = vi.fn();

      global.chrome.tabs.update = vi.fn().mockResolvedValue({});

      const nodes: TabNode[] = [
        {
          id: 'node-1',
          tabId: 1,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
        {
          id: 'node-2',
          tabId: 2,
          parentId: null,
          children: [],
          isExpanded: true,
          depth: 0,
          viewId: 'default',
        },
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewId="default"
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      const tab1Element = screen.getByTestId('tree-node-1');
      await user.click(tab1Element);

      expect(mockOnNodeClick).toHaveBeenCalledWith(1);
      expect(mockOnNodeClick).toHaveBeenCalledTimes(1);

      const tab2Element = screen.getByTestId('tree-node-2');
      await user.click(tab2Element);

      expect(mockOnNodeClick).toHaveBeenCalledWith(2);
      expect(mockOnNodeClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('ExternalDropZone削除の確認', () => {
    it('ツリービュー表示後もExternalDropZone（新規ウィンドウドロップエリア）が存在しないこと', async () => {
      const mockTreeState = {
        views: [
          {
            id: 'default',
            name: 'Default',
            color: '#3b82f6',
          },
        ],
        currentViewId: 'default',
        nodes: {
          'node-1': {
            id: 'node-1',
            tabId: 1,
            parentId: null,
            children: [],
            isExpanded: true,
            depth: 0,
            viewId: 'default',
          } as TabNode,
        },
        tabToNode: {
          1: 'node-1',
        },
      };

      global.chrome.storage.local.get = vi
        .fn()
        .mockResolvedValue({ tree_state: mockTreeState });

      render(<SidePanelRoot />);

      await waitFor(
        () => {
          expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.queryByTestId('external-drop-zone')).not.toBeInTheDocument();
      expect(screen.queryByText(/新しいウィンドウで開く/)).not.toBeInTheDocument();
    });
  });

  describe('統合シナリオ: サイドパネルからタブツリー表示まで', () => {
    it('サイドパネルが開いてからタブをツリー表示し、クリックでアクティブ化できること', async () => {
      const mockTreeState = {
        views: [
          {
            id: 'default',
            name: 'Default',
            color: '#3b82f6',
          },
        ],
        currentViewId: 'default',
        nodes: {},
        tabToNode: {},
      };

      global.chrome.storage.local.get = vi
        .fn()
        .mockResolvedValue({ tree_state: mockTreeState });

      global.chrome.storage.local.set = vi.fn().mockResolvedValue(undefined);

      render(<SidePanelRoot />);

      await waitFor(
        () => {
          expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      await waitFor(
        () => {
          expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      expect(screen.queryByText('Vivaldi-TT')).not.toBeInTheDocument();

      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(
        'tree_state'
      );
    });
  });
});
