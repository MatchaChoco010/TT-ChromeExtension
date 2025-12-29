import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SidePanelRoot from './SidePanelRoot';
import TabTreeView from './TabTreeView';
import type { TabNode } from '@/types';

/**
 * タスク 4.4: 基本UI表示の統合テスト
 *
 * このテストは以下の要件を検証します:
 * - サイドパネルが正しく開くことを確認
 * - 現在のウィンドウのタブがツリー表示されることを確認（Acceptance Criteria 1.2）
 * - タブクリックでアクティブ化されることを確認（Acceptance Criteria 1.5）
 *
 * Requirements: 1.2, 1.3, 1.5
 */
describe('基本UI表示の統合テスト (Task 4.4)', () => {
  beforeEach(() => {
    // Chrome APIのモックをリセット
    vi.clearAllMocks();
  });

  describe('Acceptance Criteria 1.1-1.2: サイドパネル表示とタブツリー表示', () => {
    it('サイドパネルが正しくレンダリングされ、ツリー構造でタブを表示できること', async () => {
      // モックのストレージデータを設定
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

      // chrome.storage.local.getのモック
      global.chrome.storage.local.get = vi
        .fn()
        .mockResolvedValue({ tree_state: mockTreeState });

      // SidePanelRootをレンダリング
      render(<SidePanelRoot />);

      // サイドパネルのルート要素が表示されるまで待機
      await waitFor(
        () => {
          expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // タブツリービューが表示されるまで待機（ローディング完了の確認）
      await waitFor(
        () => {
          expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Task 10.2: ヘッダーが削除されたことを確認（Vivaldi-TTタイトルは表示されない）
      expect(screen.queryByText('Vivaldi-TT')).not.toBeInTheDocument();
    });

    it('現在のウィンドウの全タブをツリー構造で表示すること (AC 1.2)', async () => {
      const mockOnNodeClick = vi.fn();
      const mockOnToggleExpand = vi.fn();

      // ツリー構造のモックデータ
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

      // タブツリービューが表示されることを確認
      expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();

      // 親タブが表示されることを確認（data-testidはtab.idを使用: tree-node-{tabId}）
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();

      // 子タブが表示されることを確認
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    });

    it('各タブのファビコン、タイトル、階層レベルを表示すること (AC 1.3)', () => {
      const mockOnNodeClick = vi.fn();
      const mockOnToggleExpand = vi.fn();

      // 異なる階層レベルのノードを作成
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

      // 親タブと子タブが表示されることを確認（data-testidはtab.idを使用: tree-node-{tabId}）
      const parentNode = screen.getByTestId('tree-node-1');
      const childNode = screen.getByTestId('tree-node-2');

      expect(parentNode).toBeInTheDocument();
      expect(childNode).toBeInTheDocument();

      // 階層レベルに基づくインデントを確認
      expect(parentNode).toHaveStyle({ paddingLeft: '8px' }); // depth 0: 0 * 20 + 8
      expect(childNode).toHaveStyle({ paddingLeft: '28px' }); // depth 1: 1 * 20 + 8
    });
  });

  describe('Acceptance Criteria 1.4: リアルタイム更新', () => {
    it('タブが開かれたり閉じられたりしたときにサイドパネルがリアルタイムで更新されること', async () => {
      const mockOnNodeClick = vi.fn();
      const mockOnToggleExpand = vi.fn();

      // 初期状態: 1つのタブ
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

      // 初期状態を確認（data-testidはtab.idを使用: tree-node-{tabId}）
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.queryByTestId('tree-node-2')).not.toBeInTheDocument();

      // 新しいタブが追加された状態に更新
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

      // 新しいタブが表示されることを確認（data-testidはtab.idを使用: tree-node-{tabId}）
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    });
  });

  describe('Acceptance Criteria 1.5: タブのアクティブ化', () => {
    it('サイドパネル内のタブをクリックしたときに対応するタブがアクティブになること', async () => {
      const user = userEvent.setup();
      const mockOnNodeClick = vi.fn();
      const mockOnToggleExpand = vi.fn();

      // chrome.tabs.update のモックを設定
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

      // タブ1をクリック（data-testidはtab.idを使用: tree-node-{tabId}）
      const tab1Element = screen.getByTestId('tree-node-1');
      await user.click(tab1Element);

      // onNodeClickコールバックが正しいtabIdで呼ばれることを確認
      expect(mockOnNodeClick).toHaveBeenCalledWith(1);
      expect(mockOnNodeClick).toHaveBeenCalledTimes(1);

      // タブ2をクリック
      const tab2Element = screen.getByTestId('tree-node-2');
      await user.click(tab2Element);

      // onNodeClickコールバックが正しいtabIdで呼ばれることを確認
      expect(mockOnNodeClick).toHaveBeenCalledWith(2);
      expect(mockOnNodeClick).toHaveBeenCalledTimes(2);
    });
  });

  describe('Task 5.1: ExternalDropZone削除の確認', () => {
    it('ツリービュー表示後もExternalDropZone（新規ウィンドウドロップエリア）が存在しないこと', async () => {
      // モックのストレージデータを設定
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

      // SidePanelRootをレンダリング
      render(<SidePanelRoot />);

      // タブツリービューが表示されるまで待機（ローディング完了の確認）
      await waitFor(
        () => {
          expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // 要件6.1: ExternalDropZone（「ここにドロップして新しいウィンドウで開く」の専用領域）が存在しないことを確認
      expect(screen.queryByTestId('external-drop-zone')).not.toBeInTheDocument();
      expect(screen.queryByText(/新しいウィンドウで開く/)).not.toBeInTheDocument();
    });
  });

  describe('統合シナリオ: サイドパネルからタブツリー表示まで', () => {
    it('サイドパネルが開いてからタブをツリー表示し、クリックでアクティブ化できること', async () => {
      // モックのストレージデータを設定
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

      // SidePanelRootをレンダリング
      render(<SidePanelRoot />);

      // サイドパネルのルート要素が表示されるまで待機
      await waitFor(
        () => {
          expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // タブツリービューが表示されるまで待機（ローディング完了の確認）
      await waitFor(
        () => {
          expect(screen.getByTestId('tab-tree-view')).toBeInTheDocument();
        },
        { timeout: 3000 }
      );

      // Task 10.2: ヘッダーが削除されたことを確認
      expect(screen.queryByText('Vivaldi-TT')).not.toBeInTheDocument();

      // この時点でストレージから状態がロードされていることを確認
      expect(global.chrome.storage.local.get).toHaveBeenCalledWith(
        'tree_state'
      );
    });
  });
});
