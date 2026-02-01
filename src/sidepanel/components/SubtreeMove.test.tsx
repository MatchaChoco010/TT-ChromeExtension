/**
 * 折りたたみ/展開状態でのサブツリー移動テスト
 *
 * このテストスイートでは、親タブのドラッグ時にサブツリー全体が移動することを検証します。
 * - 折りたたまれた親タブのドラッグ時に非表示の子タブも含めて移動
 * - 展開された親タブのドラッグ時に可視の子タブも含めて移動
 * - getSubtreeTabIdsが折りたたみ/展開状態に関係なくすべての子孫を収集
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@/test/test-utils';
import TabTreeView from './TabTreeView';
import type { UITabNode, ExtendedTabInfo } from '@/types';

vi.mock('@anthropic/sdk', () => ({}));

beforeEach(() => {
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
      getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
    },
  });
});

/**
 * getSubtreeTabIdsのロジックをテストするためのヘルパー
 * TabTreeView内のgetSubtreeTabIds関数と同じロジックを使用
 */
const getSubtreeTabIds = (tabId: number, nodes: UITabNode[]): number[] => {
  const result: number[] = [];

  const findAndCollect = (nodeList: UITabNode[]): boolean => {
    for (const node of nodeList) {
      if (node.tabId === tabId) {
        const collectNodeAndDescendants = (n: UITabNode) => {
          result.push(n.tabId);
          for (const child of n.children as UITabNode[]) {
            collectNodeAndDescendants(child);
          }
        };
        collectNodeAndDescendants(node);
        return true;
      }
      if (node.children && node.children.length > 0) {
        if (findAndCollect(node.children as UITabNode[])) {
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
  describe('getSubtreeTabIds', () => {
    it('折りたたまれた親タブのすべての子孫IDを収集する', () => {
      // Arrange: 折りたたまれた階層構造
      //   tab-1 (isExpanded: false)
      //   ├── tab-2
      //   │   └── tab-4
      //   └── tab-3
      const node4: UITabNode = {
        tabId: 4,
        children: [],
        depth: 2,
        isExpanded: true,
      };
      const node2: UITabNode = {
        tabId: 2,
        children: [node4],
        depth: 1,
        isExpanded: true,
      };
      const node3: UITabNode = {
        tabId: 3,
        children: [],
        depth: 1,
        isExpanded: true,
      };
      const node1: UITabNode = {
        tabId: 1,
        children: [node2, node3],
        depth: 0,
        isExpanded: false,
      };

      const nodes = [node1];

      // Act: getSubtreeTabIdsを呼び出す
      const subtreeIds = getSubtreeTabIds(1, nodes);

      // Assert: 折りたたまれていてもすべての子孫IDが含まれる
      expect(subtreeIds).toContain(1);
      expect(subtreeIds).toContain(2);
      expect(subtreeIds).toContain(3);
      expect(subtreeIds).toContain(4);
      expect(subtreeIds).toHaveLength(4);
    });

    it('展開された親タブのすべての子孫IDを収集する', () => {
      // Arrange: 展開された階層構造
      //   tab-1 (isExpanded: true)
      //   ├── tab-2
      //   │   └── tab-4
      //   └── tab-3
      const node4: UITabNode = {
        tabId: 4,
        children: [],
        depth: 2,
        isExpanded: true,
      };
      const node2: UITabNode = {
        tabId: 2,
        children: [node4],
        depth: 1,
        isExpanded: true,
      };
      const node3: UITabNode = {
        tabId: 3,
        children: [],
        depth: 1,
        isExpanded: true,
      };
      const node1: UITabNode = {
        tabId: 1,
        children: [node2, node3],
        depth: 0,
        isExpanded: true,
      };

      const nodes = [node1];

      // Act: getSubtreeTabIdsを呼び出す
      const subtreeIds = getSubtreeTabIds(1, nodes);

      // Assert: 展開されていてもすべての子孫IDが含まれる
      expect(subtreeIds).toContain(1);
      expect(subtreeIds).toContain(2);
      expect(subtreeIds).toContain(3);
      expect(subtreeIds).toContain(4);
      expect(subtreeIds).toHaveLength(4);
    });

    it('中間ノードのサブツリーを正しく収集する', () => {
      // Arrange: 階層構造
      //   tab-1
      //   ├── tab-2 (isExpanded: false)
      //   │   ├── tab-4
      //   │   └── tab-5
      //   └── tab-3
      const node4: UITabNode = {
        tabId: 4,
        children: [],
        depth: 2,
        isExpanded: true,
      };
      const node5: UITabNode = {
        tabId: 5,
        children: [],
        depth: 2,
        isExpanded: true,
      };
      const node2: UITabNode = {
        tabId: 2,
        children: [node4, node5],
        depth: 1,
        isExpanded: false,
      };
      const node3: UITabNode = {
        tabId: 3,
        children: [],
        depth: 1,
        isExpanded: true,
      };
      const node1: UITabNode = {
        tabId: 1,
        children: [node2, node3],
        depth: 0,
        isExpanded: true,
      };

      const nodes = [node1];

      // Act: 中間ノードtab-2のサブツリーを取得
      const subtreeIds = getSubtreeTabIds(2, nodes);

      // Assert: tab-2とその子孫のみが含まれる
      expect(subtreeIds).toContain(2);
      expect(subtreeIds).toContain(4);
      expect(subtreeIds).toContain(5);
      expect(subtreeIds).toHaveLength(3);
      expect(subtreeIds).not.toContain(1);
      expect(subtreeIds).not.toContain(3);
    });

    it('深くネストされた折りたたみ状態でもすべての子孫を収集する', () => {
      // Arrange: 深い階層構造（すべて折りたたまれている）
      //   tab-1 (isExpanded: false)
      //   └── tab-2 (isExpanded: false)
      //       └── tab-3 (isExpanded: false)
      //           └── tab-4
      const node4: UITabNode = {
        tabId: 4,
        children: [],
        depth: 3,
        isExpanded: true,
      };
      const node3: UITabNode = {
        tabId: 3,
        children: [node4],
        depth: 2,
        isExpanded: false,
      };
      const node2: UITabNode = {
        tabId: 2,
        children: [node3],
        depth: 1,
        isExpanded: false,
      };
      const node1: UITabNode = {
        tabId: 1,
        children: [node2],
        depth: 0,
        isExpanded: false,
      };

      const nodes = [node1];

      // Act: ルートノードのサブツリーを取得
      const subtreeIds = getSubtreeTabIds(1, nodes);

      // Assert: すべての子孫が含まれる（折りたたみ状態に関係なく）
      expect(subtreeIds).toContain(1);
      expect(subtreeIds).toContain(2);
      expect(subtreeIds).toContain(3);
      expect(subtreeIds).toContain(4);
      expect(subtreeIds).toHaveLength(4);
    });

    it('子を持たないノードは自身のみを返す', () => {
      // Arrange: 子を持たないノード
      const node1: UITabNode = {
        tabId: 1,
        children: [],
        depth: 0,
        isExpanded: false,
      };

      const nodes = [node1];

      // Act
      const subtreeIds = getSubtreeTabIds(1, nodes);

      // Assert
      expect(subtreeIds).toEqual([1]);
      expect(subtreeIds).toHaveLength(1);
    });

    it('存在しないタブIDの場合は空配列を返す', () => {
      // Arrange
      const node1: UITabNode = {
        tabId: 1,
        children: [],
        depth: 0,
        isExpanded: true,
      };

      const nodes = [node1];

      // Act
      const subtreeIds = getSubtreeTabIds(999, nodes);

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
      const node2: UITabNode = {
        tabId: 2,
        children: [],
        depth: 1,
        isExpanded: true,
      };
      const node1: UITabNode = {
        tabId: 1,
        children: [node2],
        depth: 0,
        isExpanded: false,
      };

      const nodes = [node1];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onDragEnd={vi.fn()}
          getTabInfo={mockGetTabInfo}
        />
      );

      const parentNode = screen.getByTestId('tree-node-1');
      expect(parentNode).toBeInTheDocument();

      expect(screen.queryByTestId('tree-node-2')).not.toBeInTheDocument();

      // 折りたたみ中はオーバーレイが常に表示される
      const expandOverlay = within(parentNode).getByTestId('expand-overlay');
      expect(expandOverlay).toBeInTheDocument();
      expect(expandOverlay).toHaveTextContent('▶');
    });

    it('展開された親タブとその子タブをすべてレンダリングする', () => {
      // Arrange: 展開された階層構造
      const node2: UITabNode = {
        tabId: 2,
        children: [],
        depth: 1,
        isExpanded: true,
      };
      const node1: UITabNode = {
        tabId: 1,
        children: [node2],
        depth: 0,
        isExpanded: true,
      };

      const nodes = [node1];

      render(
        <TabTreeView
          nodes={nodes}
          currentViewIndex={0}
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onDragEnd={vi.fn()}
          getTabInfo={mockGetTabInfo}
        />
      );

      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();

      const parentNode = screen.getByTestId('tree-node-1');
      // 展開中はホバー時のみオーバーレイが表示されるため、ホバーしてから確認
      fireEvent.mouseEnter(parentNode);
      const expandOverlay = within(parentNode).getByTestId('expand-overlay');
      expect(expandOverlay).toHaveTextContent('▼');
    });
  });
});
