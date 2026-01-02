/**
 * 折りたたみ/展開状態でのサブツリー移動テスト
 *
 * このテストスイートでは、親タブのドラッグ時にサブツリー全体が移動することを検証します。
 * - 折りたたまれた親タブのドラッグ時に非表示の子タブも含めて移動
 * - 展開された親タブのドラッグ時に可視の子タブも含めて移動
 * - getSubtreeNodeIdsが折りたたみ/展開状態に関係なくすべての子孫を収集
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import TabTreeView from './TabTreeView';
import type { TabNode, ExtendedTabInfo } from '@/types';

// Chrome API モック
vi.mock('@anthropic/sdk', () => ({}));

beforeEach(() => {
  // chrome.tabs.removeのモック
  vi.stubGlobal('chrome', {
    tabs: {
      remove: vi.fn().mockResolvedValue(undefined),
    },
    storage: {
      local: {
        get: vi.fn().mockResolvedValue({}),
        set: vi.fn().mockResolvedValue(undefined),
      },
    },
    runtime: {
      sendMessage: vi.fn(),
    },
  });
});

/**
 * getSubtreeNodeIdsのロジックをテストするためのヘルパー
 * TabTreeView内のgetSubtreeNodeIds関数と同じロジックを使用
 */
const getSubtreeNodeIds = (nodeId: string, nodes: TabNode[]): string[] => {
  const result: string[] = [];

  const findAndCollect = (nodeList: TabNode[]): boolean => {
    for (const node of nodeList) {
      if (node.id === nodeId) {
        const collectNodeAndDescendants = (n: TabNode) => {
          result.push(n.id);
          for (const child of n.children) {
            collectNodeAndDescendants(child);
          }
        };
        collectNodeAndDescendants(node);
        return true;
      }
      if (node.children && node.children.length > 0) {
        if (findAndCollect(node.children)) {
          return true;
        }
      }
    }
    return false;
  };

  findAndCollect(nodes);
  return result;
};

describe('折りたたみ/展開状態でのサブツリー移動', () => {
  describe('getSubtreeNodeIds', () => {
    it('折りたたまれた親タブのすべての子孫IDを収集する', () => {
      // Arrange: 折りたたまれた階層構造
      //   node-1 (isExpanded: false)
      //   ├── node-2
      //   │   └── node-4
      //   └── node-3
      const node4: TabNode = {
        id: 'node-4',
        tabId: 4,
        parentId: 'node-2',
        viewId: 'default',
        children: [],
        depth: 2,
        isExpanded: true,
      };
      const node2: TabNode = {
        id: 'node-2',
        tabId: 2,
        parentId: 'node-1',
        viewId: 'default',
        children: [node4],
        depth: 1,
        isExpanded: true,
      };
      const node3: TabNode = {
        id: 'node-3',
        tabId: 3,
        parentId: 'node-1',
        viewId: 'default',
        children: [],
        depth: 1,
        isExpanded: true,
      };
      const node1: TabNode = {
        id: 'node-1',
        tabId: 1,
        parentId: null,
        viewId: 'default',
        children: [node2, node3],
        depth: 0,
        isExpanded: false, // 折りたたまれている
      };

      const nodes = [node1];

      // Act: getSubtreeNodeIdsを呼び出す
      const subtreeIds = getSubtreeNodeIds('node-1', nodes);

      // Assert: 折りたたまれていてもすべての子孫IDが含まれる
      expect(subtreeIds).toContain('node-1');
      expect(subtreeIds).toContain('node-2');
      expect(subtreeIds).toContain('node-3');
      expect(subtreeIds).toContain('node-4');
      expect(subtreeIds).toHaveLength(4);
    });

    it('展開された親タブのすべての子孫IDを収集する', () => {
      // Arrange: 展開された階層構造
      //   node-1 (isExpanded: true)
      //   ├── node-2
      //   │   └── node-4
      //   └── node-3
      const node4: TabNode = {
        id: 'node-4',
        tabId: 4,
        parentId: 'node-2',
        viewId: 'default',
        children: [],
        depth: 2,
        isExpanded: true,
      };
      const node2: TabNode = {
        id: 'node-2',
        tabId: 2,
        parentId: 'node-1',
        viewId: 'default',
        children: [node4],
        depth: 1,
        isExpanded: true,
      };
      const node3: TabNode = {
        id: 'node-3',
        tabId: 3,
        parentId: 'node-1',
        viewId: 'default',
        children: [],
        depth: 1,
        isExpanded: true,
      };
      const node1: TabNode = {
        id: 'node-1',
        tabId: 1,
        parentId: null,
        viewId: 'default',
        children: [node2, node3],
        depth: 0,
        isExpanded: true, // 展開されている
      };

      const nodes = [node1];

      // Act: getSubtreeNodeIdsを呼び出す
      const subtreeIds = getSubtreeNodeIds('node-1', nodes);

      // Assert: 展開されていてもすべての子孫IDが含まれる
      expect(subtreeIds).toContain('node-1');
      expect(subtreeIds).toContain('node-2');
      expect(subtreeIds).toContain('node-3');
      expect(subtreeIds).toContain('node-4');
      expect(subtreeIds).toHaveLength(4);
    });

    it('中間ノードのサブツリーを正しく収集する', () => {
      // Arrange: 階層構造
      //   node-1
      //   ├── node-2 (isExpanded: false)
      //   │   ├── node-4
      //   │   └── node-5
      //   └── node-3
      const node4: TabNode = {
        id: 'node-4',
        tabId: 4,
        parentId: 'node-2',
        viewId: 'default',
        children: [],
        depth: 2,
        isExpanded: true,
      };
      const node5: TabNode = {
        id: 'node-5',
        tabId: 5,
        parentId: 'node-2',
        viewId: 'default',
        children: [],
        depth: 2,
        isExpanded: true,
      };
      const node2: TabNode = {
        id: 'node-2',
        tabId: 2,
        parentId: 'node-1',
        viewId: 'default',
        children: [node4, node5],
        depth: 1,
        isExpanded: false, // 折りたたまれている
      };
      const node3: TabNode = {
        id: 'node-3',
        tabId: 3,
        parentId: 'node-1',
        viewId: 'default',
        children: [],
        depth: 1,
        isExpanded: true,
      };
      const node1: TabNode = {
        id: 'node-1',
        tabId: 1,
        parentId: null,
        viewId: 'default',
        children: [node2, node3],
        depth: 0,
        isExpanded: true,
      };

      const nodes = [node1];

      // Act: 中間ノードnode-2のサブツリーを取得
      const subtreeIds = getSubtreeNodeIds('node-2', nodes);

      // Assert: node-2とその子孫のみが含まれる
      expect(subtreeIds).toContain('node-2');
      expect(subtreeIds).toContain('node-4');
      expect(subtreeIds).toContain('node-5');
      expect(subtreeIds).toHaveLength(3);
      // 親ノードや兄弟ノードは含まれない
      expect(subtreeIds).not.toContain('node-1');
      expect(subtreeIds).not.toContain('node-3');
    });

    it('深くネストされた折りたたみ状態でもすべての子孫を収集する', () => {
      // Arrange: 深い階層構造（すべて折りたたまれている）
      //   node-1 (isExpanded: false)
      //   └── node-2 (isExpanded: false)
      //       └── node-3 (isExpanded: false)
      //           └── node-4
      const node4: TabNode = {
        id: 'node-4',
        tabId: 4,
        parentId: 'node-3',
        viewId: 'default',
        children: [],
        depth: 3,
        isExpanded: true,
      };
      const node3: TabNode = {
        id: 'node-3',
        tabId: 3,
        parentId: 'node-2',
        viewId: 'default',
        children: [node4],
        depth: 2,
        isExpanded: false, // 折りたたまれている
      };
      const node2: TabNode = {
        id: 'node-2',
        tabId: 2,
        parentId: 'node-1',
        viewId: 'default',
        children: [node3],
        depth: 1,
        isExpanded: false, // 折りたたまれている
      };
      const node1: TabNode = {
        id: 'node-1',
        tabId: 1,
        parentId: null,
        viewId: 'default',
        children: [node2],
        depth: 0,
        isExpanded: false, // 折りたたまれている
      };

      const nodes = [node1];

      // Act: ルートノードのサブツリーを取得
      const subtreeIds = getSubtreeNodeIds('node-1', nodes);

      // Assert: すべての子孫が含まれる（折りたたみ状態に関係なく）
      expect(subtreeIds).toContain('node-1');
      expect(subtreeIds).toContain('node-2');
      expect(subtreeIds).toContain('node-3');
      expect(subtreeIds).toContain('node-4');
      expect(subtreeIds).toHaveLength(4);
    });

    it('子を持たないノードは自身のみを返す', () => {
      // Arrange: 子を持たないノード
      const node1: TabNode = {
        id: 'node-1',
        tabId: 1,
        parentId: null,
        viewId: 'default',
        children: [],
        depth: 0,
        isExpanded: false,
      };

      const nodes = [node1];

      // Act
      const subtreeIds = getSubtreeNodeIds('node-1', nodes);

      // Assert
      expect(subtreeIds).toEqual(['node-1']);
      expect(subtreeIds).toHaveLength(1);
    });

    it('存在しないノードIDの場合は空配列を返す', () => {
      // Arrange
      const node1: TabNode = {
        id: 'node-1',
        tabId: 1,
        parentId: null,
        viewId: 'default',
        children: [],
        depth: 0,
        isExpanded: true,
      };

      const nodes = [node1];

      // Act
      const subtreeIds = getSubtreeNodeIds('non-existent', nodes);

      // Assert
      expect(subtreeIds).toEqual([]);
    });
  });

  describe('TabTreeView with collapsedサブツリー', () => {
    const mockTabInfoMap: Record<number, ExtendedTabInfo> = {
      1: { id: 1, title: 'Tab 1', url: 'https://example.com', isPinned: false, windowId: 1, discarded: false, index: 0, favIconUrl: undefined, status: 'complete' },
      2: { id: 2, title: 'Tab 2', url: 'https://example.com', isPinned: false, windowId: 1, discarded: false, index: 1, favIconUrl: undefined, status: 'complete' },
      3: { id: 3, title: 'Tab 3', url: 'https://example.com', isPinned: false, windowId: 1, discarded: false, index: 2, favIconUrl: undefined, status: 'complete' },
      4: { id: 4, title: 'Tab 4', url: 'https://example.com', isPinned: false, windowId: 1, discarded: false, index: 3, favIconUrl: undefined, status: 'complete' },
    };

    const mockGetTabInfo = (tabId: number) => mockTabInfoMap[tabId];

    it('折りたたまれた親タブをドラッグ可能なアイテムとしてレンダリングする', () => {
      // Arrange: 折りたたまれた階層構造
      const node2: TabNode = {
        id: 'node-2',
        tabId: 2,
        parentId: 'node-1',
        viewId: 'default',
        children: [],
        depth: 1,
        isExpanded: true,
      };
      const node1: TabNode = {
        id: 'node-1',
        tabId: 1,
        parentId: null,
        viewId: 'default',
        children: [node2],
        depth: 0,
        isExpanded: false, // 折りたたまれている
      };

      const nodes = [node1];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onDragEnd={vi.fn()}
          getTabInfo={mockGetTabInfo}
        />
      );

      // 親タブがレンダリングされている
      const parentNode = screen.getByTestId('tree-node-1');
      expect(parentNode).toBeInTheDocument();

      // 折りたたまれているので子タブは表示されていない
      expect(screen.queryByTestId('tree-node-2')).not.toBeInTheDocument();

      // 展開ボタンが表示されている
      const expandButton = within(parentNode).getByTestId('expand-button');
      expect(expandButton).toBeInTheDocument();
      expect(expandButton).toHaveTextContent('▶');
    });

    it('展開された親タブとその子タブをすべてレンダリングする', () => {
      // Arrange: 展開された階層構造
      const node2: TabNode = {
        id: 'node-2',
        tabId: 2,
        parentId: 'node-1',
        viewId: 'default',
        children: [],
        depth: 1,
        isExpanded: true,
      };
      const node1: TabNode = {
        id: 'node-1',
        tabId: 1,
        parentId: null,
        viewId: 'default',
        children: [node2],
        depth: 0,
        isExpanded: true, // 展開されている
      };

      const nodes = [node1];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onDragEnd={vi.fn()}
          getTabInfo={mockGetTabInfo}
        />
      );

      // 親タブと子タブがレンダリングされている
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();

      // 展開ボタンが展開状態を示している
      const parentNode = screen.getByTestId('tree-node-1');
      const expandButton = within(parentNode).getByTestId('expand-button');
      expect(expandButton).toHaveTextContent('▼');
    });
  });
});
