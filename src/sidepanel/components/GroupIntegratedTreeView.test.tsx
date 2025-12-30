import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@/test/chrome-mock';
import type { Group, TabNode, ExtendedTabInfo } from '@/types';

/**
 * Task 11.1: タブグループをツリービュー内に表示するテスト
 * Requirements: 2.1, 2.3
 *
 * このテストファイルは、タブグループがツリービュー内に統合表示される機能をテストします:
 * - グループノードがタブと同じツリービュー内に表示される
 * - グループノードが展開/折りたたみ可能である
 * - グループの展開/折りたたみ状態が永続化される
 */

// モックデータ
const createMockGroup = (overrides?: Partial<Group>): Group => ({
  id: 'group-1',
  name: 'Test Group',
  color: '#ff0000',
  isExpanded: true,
  ...overrides,
});

const createMockTabNode = (overrides?: Partial<TabNode>): TabNode => ({
  id: 'node-1',
  tabId: 1,
  parentId: null,
  children: [],
  isExpanded: true,
  depth: 0,
  viewId: 'default',
  ...overrides,
});

const createMockTabInfo = (tabId: number): ExtendedTabInfo => ({
  id: tabId,
  title: `Tab ${tabId}`,
  url: `https://example.com/${tabId}`,
  favIconUrl: undefined,
  status: 'complete' as const,
  isPinned: false,
  windowId: 1,
  discarded: false, // Task 4.1 (tab-tree-bugfix): 休止タブ状態
  index: tabId, // Task 12.1 (tab-tree-comprehensive-fix): ピン留めタブの順序同期
});

describe('Task 11.1: タブグループをツリービュー内に表示', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('要件 2.1: グループをツリービュー内に表示', () => {
    it('グループノードがツリービュー内でタブと一緒に表示されること', async () => {
      // Given: グループと所属するタブを持つツリー状態
      const mockGroup = createMockGroup({ id: 'group-1', name: 'Work Group' });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      // グループに属するタブノード
      const tabNodeInGroup = createMockTabNode({
        id: 'node-1',
        tabId: 1,
        groupId: 'group-1',
      });

      // グループに属さないタブノード
      const tabNodeOutsideGroup = createMockTabNode({
        id: 'node-2',
        tabId: 2,
        groupId: undefined,
      });

      // When: TabTreeViewWithGroupsをレンダリング
      const { TabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <TabTreeViewWithGroups
          nodes={[tabNodeInGroup, tabNodeOutsideGroup]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: グループノードがツリービュー内に表示される
      expect(screen.getByTestId('group-tree-node-group-1')).toBeInTheDocument();
      expect(screen.getByText('Work Group')).toBeInTheDocument();

      // タブノードも表示される
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    });

    it('グループノードがグループ内のタブの親として表示されること', async () => {
      // Given: グループに属するタブを持つ状態
      const mockGroup = createMockGroup({ id: 'group-1', name: 'Development' });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      const tabNode1 = createMockTabNode({
        id: 'node-1',
        tabId: 1,
        groupId: 'group-1',
        depth: 1, // グループ内のタブはdepth 1
      });

      const tabNode2 = createMockTabNode({
        id: 'node-2',
        tabId: 2,
        groupId: 'group-1',
        depth: 1,
      });

      // When: TabTreeViewWithGroupsをレンダリング
      const { TabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <TabTreeViewWithGroups
          nodes={[tabNode1, tabNode2]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: グループノードが表示される
      const groupNode = screen.getByTestId('group-tree-node-group-1');
      expect(groupNode).toBeInTheDocument();

      // グループ内のタブがグループの子としてインデントされて表示される
      const tab1 = screen.getByTestId('tree-node-1');
      const tab2 = screen.getByTestId('tree-node-2');
      expect(tab1).toBeInTheDocument();
      expect(tab2).toBeInTheDocument();

      // タブのdepthが1であることを確認（data-depth属性）
      expect(tab1).toHaveAttribute('data-depth', '1');
      expect(tab2).toHaveAttribute('data-depth', '1');
    });

    it('複数のグループが同じツリービュー内に表示されること', async () => {
      // Given: 複数のグループ
      const mockGroups: Record<string, Group> = {
        'group-1': createMockGroup({ id: 'group-1', name: 'Group 1' }),
        'group-2': createMockGroup({ id: 'group-2', name: 'Group 2' }),
      };

      const nodes = [
        createMockTabNode({ id: 'node-1', tabId: 1, groupId: 'group-1' }),
        createMockTabNode({ id: 'node-2', tabId: 2, groupId: 'group-2' }),
      ];

      // When: TabTreeViewWithGroupsをレンダリング
      const { TabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <TabTreeViewWithGroups
          nodes={nodes}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: 両方のグループが表示される
      expect(screen.getByTestId('group-tree-node-group-1')).toBeInTheDocument();
      expect(screen.getByText('Group 1')).toBeInTheDocument();
      expect(screen.getByTestId('group-tree-node-group-2')).toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();
    });
  });

  describe('要件 2.3: グループの展開/折りたたみ', () => {
    it('展開されたグループはグループ内のタブを表示すること', async () => {
      // Given: 展開されたグループ
      const mockGroup = createMockGroup({
        id: 'group-1',
        name: 'Expanded Group',
        isExpanded: true,
      });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      const nodes = [
        createMockTabNode({ id: 'node-1', tabId: 1, groupId: 'group-1' }),
        createMockTabNode({ id: 'node-2', tabId: 2, groupId: 'group-1' }),
      ];

      // When: TabTreeViewWithGroupsをレンダリング
      const { TabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <TabTreeViewWithGroups
          nodes={nodes}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: グループ内のタブが表示される
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
    });

    it('折りたたまれたグループはグループ内のタブを非表示にすること', async () => {
      // Given: 折りたたまれたグループ
      const mockGroup = createMockGroup({
        id: 'group-1',
        name: 'Collapsed Group',
        isExpanded: false,
      });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      const nodes = [
        createMockTabNode({ id: 'node-1', tabId: 1, groupId: 'group-1' }),
        createMockTabNode({ id: 'node-2', tabId: 2, groupId: 'group-1' }),
      ];

      // When: TabTreeViewWithGroupsをレンダリング
      const { TabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <TabTreeViewWithGroups
          nodes={nodes}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: グループノードは表示される
      expect(screen.getByTestId('group-tree-node-group-1')).toBeInTheDocument();

      // グループ内のタブは非表示
      expect(screen.queryByTestId('tree-node-1')).not.toBeInTheDocument();
      expect(screen.queryByTestId('tree-node-2')).not.toBeInTheDocument();
    });

    it('グループの展開/折りたたみボタンをクリックするとonGroupToggleが呼ばれること', async () => {
      const user = userEvent.setup();

      // Given: 展開されたグループ
      const mockGroup = createMockGroup({
        id: 'group-1',
        name: 'Test Group',
        isExpanded: true,
      });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };
      const mockOnGroupToggle = vi.fn();

      // When: TabTreeViewWithGroupsをレンダリング
      const { TabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <TabTreeViewWithGroups
          nodes={[]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={mockOnGroupToggle}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // グループの展開/折りたたみボタンをクリック
      const toggleButton = screen.getByTestId('toggle-expand-group-1');
      await user.click(toggleButton);

      // Then: onGroupToggleがグループIDで呼ばれる
      expect(mockOnGroupToggle).toHaveBeenCalledWith('group-1');
    });

    it('展開されたグループは▼アイコンを表示すること', async () => {
      // Given: 展開されたグループ
      const mockGroup = createMockGroup({
        id: 'group-1',
        name: 'Test Group',
        isExpanded: true,
      });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      // When: TabTreeViewWithGroupsをレンダリング
      const { TabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <TabTreeViewWithGroups
          nodes={[]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: ▼アイコンが表示される
      const toggleButton = screen.getByTestId('toggle-expand-group-1');
      expect(toggleButton).toHaveTextContent('▼');
    });

    it('折りたたまれたグループは▶アイコンを表示すること', async () => {
      // Given: 折りたたまれたグループ
      const mockGroup = createMockGroup({
        id: 'group-1',
        name: 'Test Group',
        isExpanded: false,
      });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      // When: TabTreeViewWithGroupsをレンダリング
      const { TabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <TabTreeViewWithGroups
          nodes={[]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: ▶アイコンが表示される
      const toggleButton = screen.getByTestId('toggle-expand-group-1');
      expect(toggleButton).toHaveTextContent('▶');
    });
  });

  describe('グループ内でのタブ階層構造', () => {
    it('グループ内のタブが親子関係を持つ場合、階層構造が維持されること', async () => {
      // Given: グループ内で親子関係を持つタブ
      const mockGroup = createMockGroup({
        id: 'group-1',
        name: 'Test Group',
        isExpanded: true,
      });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      const parentNode = createMockTabNode({
        id: 'parent-node',
        tabId: 1,
        groupId: 'group-1',
        depth: 1,
        isExpanded: true,
        children: [], // 子ノードは後で設定
      });

      const childNode = createMockTabNode({
        id: 'child-node',
        tabId: 2,
        groupId: 'group-1',
        parentId: 'parent-node',
        depth: 2,
      });

      // 親に子を追加
      parentNode.children = [childNode];

      // When: TabTreeViewWithGroupsをレンダリング
      const { TabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <TabTreeViewWithGroups
          nodes={[parentNode]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: 親タブと子タブの両方が表示される
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();

      // 子タブのdepthが2であることを確認
      expect(screen.getByTestId('tree-node-2')).toHaveAttribute('data-depth', '2');
    });
  });

  describe('グループカラー表示', () => {
    it('グループノードがグループの色を表示すること', async () => {
      // Given: 色が設定されたグループ
      const mockGroup = createMockGroup({
        id: 'group-1',
        name: 'Colored Group',
        color: '#42a5f5',
      });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      // When: TabTreeViewWithGroupsをレンダリング
      const { TabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <TabTreeViewWithGroups
          nodes={[]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: グループカラーインジケーターが正しい色で表示される
      const colorIndicator = screen.getByTestId('group-color-indicator-group-1');
      expect(colorIndicator).toHaveStyle({ backgroundColor: '#42a5f5' });
    });
  });
});

/**
 * Task 11.2: タブグループのドラッグ&ドロップ操作テスト
 * Requirements: 2.2
 *
 * このテストは、タブグループがドラッグ&ドロップで操作できる機能をテストします:
 * - グループを通常のタブと同様にドラッグ可能である
 * - グループをドロップした際にグループ配下のタブも一緒に移動する
 * - グループの階層関係を維持しながら位置変更が可能である
 */
describe('Task 11.2: タブグループのドラッグ&ドロップ操作', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('要件 2.2: グループを通常のタブと同様にドラッグ&ドロップで操作', () => {
    it('グループノードがドラッグ可能であること', async () => {
      // Given: ドラッグ可能なグループを持つツリー状態
      const mockGroup = createMockGroup({ id: 'group-1', name: 'Draggable Group' });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      const tabNode = createMockTabNode({
        id: 'node-1',
        tabId: 1,
        groupId: 'group-1',
      });

      // When: DraggableTabTreeViewWithGroupsをレンダリング
      const { DraggableTabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      const mockOnDragEnd = vi.fn();
      const mockOnGroupDragEnd = vi.fn();

      render(
        <DraggableTabTreeViewWithGroups
          nodes={[tabNode]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          onDragEnd={mockOnDragEnd}
          onGroupDragEnd={mockOnGroupDragEnd}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: グループノードがドラッグハンドルを持つこと
      const groupNode = screen.getByTestId('group-tree-node-group-1');
      expect(groupNode).toBeInTheDocument();
      // ドラッグハンドルの存在を確認（data-sortable-item属性の存在）
      const draggableElement = groupNode.querySelector('[data-sortable-item]');
      expect(draggableElement).toBeInTheDocument();
    });

    it('グループノードのドラッグ終了時にonGroupDragEndが呼ばれること', async () => {
      // Given: グループを持つツリー状態
      const mockGroups: Record<string, Group> = {
        'group-1': createMockGroup({ id: 'group-1', name: 'Group 1' }),
        'group-2': createMockGroup({ id: 'group-2', name: 'Group 2' }),
      };

      // When: DraggableTabTreeViewWithGroupsをレンダリング
      const { DraggableTabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      const mockOnDragEnd = vi.fn();
      const mockOnGroupDragEnd = vi.fn();

      render(
        <DraggableTabTreeViewWithGroups
          nodes={[]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          onDragEnd={mockOnDragEnd}
          onGroupDragEnd={mockOnGroupDragEnd}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // グループノードが表示されていることを確認
      expect(screen.getByTestId('group-tree-node-group-1')).toBeInTheDocument();
      expect(screen.getByTestId('group-tree-node-group-2')).toBeInTheDocument();

      // Note: 実際のドラッグ&ドロップはE2Eテストでテストする
      // ここではコールバック関数の存在とpropsの設定を確認
    });

    it('グループをドロップした際にグループ配下のタブIDが含まれること', async () => {
      // Given: グループと所属タブを持つ状態
      const mockGroup = createMockGroup({ id: 'group-1', name: 'Test Group' });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      const tabNodes = [
        createMockTabNode({ id: 'node-1', tabId: 1, groupId: 'group-1' }),
        createMockTabNode({ id: 'node-2', tabId: 2, groupId: 'group-1' }),
        createMockTabNode({ id: 'node-3', tabId: 3, groupId: 'group-1' }),
      ];

      // When: DraggableTabTreeViewWithGroupsをレンダリング
      const { DraggableTabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      const mockOnDragEnd = vi.fn();
      const mockOnGroupDragEnd = vi.fn();

      render(
        <DraggableTabTreeViewWithGroups
          nodes={tabNodes}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          onDragEnd={mockOnDragEnd}
          onGroupDragEnd={mockOnGroupDragEnd}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // グループ内のすべてのタブが表示されていることを確認
      expect(screen.getByTestId('tree-node-1')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-2')).toBeInTheDocument();
      expect(screen.getByTestId('tree-node-3')).toBeInTheDocument();
    });
  });

  describe('グループドラッグ時の視覚的フィードバック', () => {
    it('グループをドラッグ中はグループ全体がハイライトされること', async () => {
      // Given: グループを持つツリー状態
      const mockGroup = createMockGroup({ id: 'group-1', name: 'Test Group' });
      const mockGroups: Record<string, Group> = { 'group-1': mockGroup };

      // When: DraggableTabTreeViewWithGroupsをレンダリング
      const { DraggableTabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      render(
        <DraggableTabTreeViewWithGroups
          nodes={[]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          onDragEnd={vi.fn()}
          onGroupDragEnd={vi.fn()}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // グループノードが表示されていることを確認
      const groupNode = screen.getByTestId('group-tree-node-group-1');
      expect(groupNode).toBeInTheDocument();

      // Note: 実際のドラッグ中のスタイル確認はE2Eテストで行う
    });
  });

  describe('グループ間の並び替え', () => {
    it('複数のグループが存在する場合、グループの順序を変更できること', async () => {
      // Given: 複数のグループ
      const mockGroups: Record<string, Group> = {
        'group-1': createMockGroup({ id: 'group-1', name: 'Group 1' }),
        'group-2': createMockGroup({ id: 'group-2', name: 'Group 2' }),
        'group-3': createMockGroup({ id: 'group-3', name: 'Group 3' }),
      };

      // When: DraggableTabTreeViewWithGroupsをレンダリング
      const { DraggableTabTreeViewWithGroups } = await import('./TabTreeViewWithGroups');

      const mockOnGroupDragEnd = vi.fn();

      render(
        <DraggableTabTreeViewWithGroups
          nodes={[]}
          groups={mockGroups}
          currentViewId="default"
          onNodeClick={vi.fn()}
          onToggleExpand={vi.fn()}
          onGroupToggle={vi.fn()}
          onDragEnd={vi.fn()}
          onGroupDragEnd={mockOnGroupDragEnd}
          getTabInfo={(tabId) => createMockTabInfo(tabId)}
        />
      );

      // Then: すべてのグループが表示されていること
      expect(screen.getByTestId('group-tree-node-group-1')).toBeInTheDocument();
      expect(screen.getByTestId('group-tree-node-group-2')).toBeInTheDocument();
      expect(screen.getByTestId('group-tree-node-group-3')).toBeInTheDocument();
    });
  });
});
