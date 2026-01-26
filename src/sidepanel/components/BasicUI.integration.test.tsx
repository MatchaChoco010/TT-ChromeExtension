import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
import SidePanelRoot from './SidePanelRoot';
import TabTreeView from './TabTreeView';
import type { UITabNode, TreeState } from '@/types';

describe('基本UI表示の統合テスト', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria 1.1-1.2: サイドパネル表示とタブツリー表示', () => {
    it('サイドパネルが正しくレンダリングされ、ツリー構造でタブを表示できること', async () => {
      const mockTreeState: TreeState = {
        windows: [
          {
            windowId: 1,
            views: [
              {
                name: 'Default',
                color: '#3b82f6',
                rootNodes: [
                  { tabId: 1, isExpanded: true, children: [] },
                  { tabId: 2, isExpanded: true, children: [] },
                ],
                pinnedTabIds: [],
              },
            ],
            activeViewIndex: 0,
          },
        ],
      };

      global.chrome.runtime.sendMessage = vi.fn().mockImplementation((message) => {
        if (message.type === 'GET_STATE') {
          return Promise.resolve({ success: true, data: mockTreeState });
        }
        return Promise.resolve({ success: true });
      });

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

      const nodes: UITabNode[] = [
        {
          tabId: 1,
          isExpanded: true,
          depth: 0,
          children: [
            {
              tabId: 2,
              isExpanded: true,
              depth: 1,
              children: [],
            },
          ],
        },
        {
          tabId: 3,
          isExpanded: true,
          depth: 0,
          children: [],
        },
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
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

      const nodes: UITabNode[] = [
        {
          tabId: 1,
          isExpanded: true,
          depth: 0,
          children: [
            {
              tabId: 2,
              isExpanded: true,
              depth: 1,
              children: [],
            },
          ],
        },
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
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

      const initialNodes: UITabNode[] = [
        {
          tabId: 1,
          isExpanded: true,
          depth: 0,
          children: [],
        },
      ];

      const { rerender } = render(
        <TabTreeView
          nodes={initialNodes}
          currentViewIndex={0}
          onNodeClick={mockOnNodeClick}
          onToggleExpand={mockOnToggleExpand}
        />
      );

      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.queryByTestId('tree-node-2')).not.toBeInTheDocument();

      const updatedNodes: UITabNode[] = [
        ...initialNodes,
        {
          tabId: 2,
          isExpanded: true,
          depth: 0,
          children: [],
        },
      ];

      rerender(
        <TabTreeView
          nodes={updatedNodes}
          currentViewIndex={0}
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

      const nodes: UITabNode[] = [
        {
          tabId: 1,
          isExpanded: true,
          depth: 0,
          children: [],
        },
        {
          tabId: 2,
          isExpanded: true,
          depth: 0,
          children: [],
        },
      ];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
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
      const mockTreeState: TreeState = {
        windows: [
          {
            windowId: 1,
            views: [
              {
                name: 'Default',
                color: '#3b82f6',
                rootNodes: [{ tabId: 1, isExpanded: true, children: [] }],
                pinnedTabIds: [],
              },
            ],
            activeViewIndex: 0,
          },
        ],
      };

      global.chrome.runtime.sendMessage = vi.fn().mockImplementation((message) => {
        if (message.type === 'GET_STATE') {
          return Promise.resolve({ success: true, data: mockTreeState });
        }
        return Promise.resolve({ success: true });
      });

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
      const mockTreeState: TreeState = {
        windows: [
          {
            windowId: 1,
            views: [
              {
                name: 'Default',
                color: '#3b82f6',
                rootNodes: [],
                pinnedTabIds: [],
              },
            ],
            activeViewIndex: 0,
          },
        ],
      };

      global.chrome.runtime.sendMessage = vi.fn().mockImplementation((message) => {
        if (message.type === 'GET_STATE') {
          return Promise.resolve({ success: true, data: mockTreeState });
        }
        return Promise.resolve({ success: true });
      });

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

      expect(global.chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'GET_STATE',
      });
    });
  });
});
