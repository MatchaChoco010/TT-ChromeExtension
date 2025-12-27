import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TreeNode from './TreeNode';
import type { TabNode, TabInfo } from '@/types';

describe('TreeNode', () => {
  const mockOnActivate = vi.fn();
  const mockOnToggle = vi.fn();
  const mockOnClose = vi.fn();

  const createMockNode = (
    id: string,
    tabId: number,
    depth: number = 0,
    children: TabNode[] = []
  ): TabNode => ({
    id,
    tabId,
    parentId: null,
    children,
    isExpanded: true,
    depth,
    viewId: 'default',
  });

  const createMockTab = (
    id: number,
    title: string = 'Test Tab',
    url: string = 'https://example.com',
    favIconUrl?: string
  ): TabInfo => ({
    id,
    title,
    url,
    favIconUrl,
    status: 'complete',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本的な表示', () => {
    it('タブのタイトルを表示できること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'Test Tab Title');

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Test Tab Title')).toBeInTheDocument();
    });

    it('ファビコンを表示できること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(
        1,
        'Test Tab',
        'https://example.com',
        'https://example.com/favicon.ico'
      );

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const favicon = screen.getByRole('img', { name: /favicon/i });
      expect(favicon).toBeInTheDocument();
      expect(favicon).toHaveAttribute('src', 'https://example.com/favicon.ico');
    });

    it('ファビコンがない場合にデフォルトアイコンを表示できること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'Test Tab', 'https://example.com');

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      // デフォルトアイコンが表示されていることを確認
      const defaultIcon = screen.getByTestId('default-icon');
      expect(defaultIcon).toBeInTheDocument();
    });

    it('depthに基づいてインデントを適用できること', () => {
      const node = createMockNode('node-1', 1, 2); // depth: 2
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      // TreeNodeコンポーネントはdata-testid={`tree-node-${tab.id}`}を使用している
      const treeNodeElement = screen.getByTestId('tree-node-1');
      // depth * 20 + 8 = 2 * 20 + 8 = 48px
      expect(treeNodeElement).toHaveStyle({ paddingLeft: '48px' });
    });
  });

  describe('展開/折りたたみトグル', () => {
    it('子ノードがある場合に展開トグルボタンを表示できること', () => {
      const childNode = createMockNode('child-1', 2);
      const node = createMockNode('node-1', 1, 0, [childNode]);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('expand-button')).toBeInTheDocument();
    });

    it('子ノードがない場合は展開トグルボタンを表示しないこと', () => {
      const node = createMockNode('node-1', 1, 0, []);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('expand-button')).not.toBeInTheDocument();
    });

    it('展開トグルボタンをクリックするとonToggleが呼ばれること', async () => {
      const user = userEvent.setup();
      const childNode = createMockNode('child-1', 2);
      const node = createMockNode('node-1', 1, 0, [childNode]);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const toggleButton = screen.getByTestId('expand-button');
      await user.click(toggleButton);

      expect(mockOnToggle).toHaveBeenCalledWith('node-1');
      // ノード自体はクリックされない
      expect(mockOnActivate).not.toHaveBeenCalled();
    });

    it('展開状態に応じてトグルアイコンが変わること', () => {
      const childNode = createMockNode('child-1', 2);
      const expandedNode = createMockNode('node-1', 1, 0, [childNode]);
      const tab = createMockTab(1);

      const { rerender } = render(
        <TreeNode
          node={expandedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const toggleButton = screen.getByTestId('expand-button');
      expect(toggleButton).toHaveTextContent('▼');

      // 折りたたみ状態に変更
      const collapsedNode = { ...expandedNode, isExpanded: false };
      rerender(
        <TreeNode
          node={collapsedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(toggleButton).toHaveTextContent('▶');
    });
  });

  describe('タブのアクティブ化', () => {
    it('ノードをクリックするとonActivateが呼ばれること', async () => {
      const user = userEvent.setup();
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      await user.click(treeNodeElement);

      expect(mockOnActivate).toHaveBeenCalledWith(1);
    });

    it('アクティブなタブに視覚的なスタイルが適用されること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1);

      const { rerender } = render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      expect(treeNodeElement).not.toHaveClass('bg-blue-100');

      // アクティブ状態に変更
      rerender(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={true}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(treeNodeElement).toHaveClass('bg-blue-100');
    });
  });

  describe('未読インジケータ', () => {
    it('未読タブに未読インジケータが表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={true}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('unread-badge')).toBeInTheDocument();
    });

    it('既読タブに未読インジケータが表示されないこと', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    });

    it('showUnreadIndicatorがfalseの場合、未読でもバッジが表示されないこと', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={true}
          isActive={false}
          showUnreadIndicator={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('unread-badge')).not.toBeInTheDocument();
    });
  });

  describe('ローディング状態', () => {
    it('ローディング中のタブにローディングインジケータが表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        ...createMockTab(1),
        status: 'loading',
      };

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    });

    it('完了状態のタブにローディングインジケータが表示されないこと', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        ...createMockTab(1),
        status: 'complete',
      };

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    });
  });

  describe('タブを閉じる機能 (Requirement 8.1, 8.2)', () => {
    it('マウスホバー時に閉じるボタンが表示されること', async () => {
      const user = userEvent.setup();
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');

      // 初期状態では閉じるボタンは表示されていない
      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();

      // ホバーすると閉じるボタンが表示される
      await user.hover(treeNodeElement);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      // ホバーを外すと閉じるボタンが非表示になる
      await user.unhover(treeNodeElement);
      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();
    });

    it('閉じるボタンをクリックするとonCloseが呼ばれること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');

      // ホバーして閉じるボタンを表示
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');

      // 閉じるボタンをクリック
      fireEvent.click(closeButton);

      // 子ノードがないので hasChildren は false
      expect(mockOnClose).toHaveBeenCalledWith(1, false);
      // ノード自体はアクティブ化されない
      expect(mockOnActivate).not.toHaveBeenCalled();
    });

    it('閉じるボタンをクリック時に子ノードの有無が正しく渡されること', () => {
      const childNode = createMockNode('child-1', 2);
      const node = createMockNode('node-1', 1, 0, [childNode]);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');

      // ホバーして閉じるボタンを表示
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');

      // 閉じるボタンをクリック
      fireEvent.click(closeButton);

      // 子ノードがあるので hasChildren は true
      expect(mockOnClose).toHaveBeenCalledWith(1, true);
    });
  });

  describe('確認ダイアログの統合 (Task 11.2: Requirement 8.3, 8.4)', () => {
    it('折りたたまれたブランチを持つ親タブを閉じようとすると確認ダイアログが表示されること', () => {
      const childNode = createMockNode('child-1', 2);
      const node = createMockNode('node-1', 1, 0, [childNode]);
      const collapsedNode = { ...node, isExpanded: false };
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={collapsedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={2} // Task 11.3: 閾値を2に設定（タブ数2なので表示される）
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');

      // ホバーして閉じるボタンを表示
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');

      // 閉じるボタンをクリック
      fireEvent.click(closeButton);

      // 確認ダイアログが表示されることを確認
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(screen.getByText(/閉じる/i)).toBeInTheDocument();
    });

    it('確認ダイアログにタブ数が表示されること', () => {
      const child1 = createMockNode('child-1', 2);
      const child2 = createMockNode('child-2', 3);
      const node = createMockNode('node-1', 1, 0, [child1, child2]);
      const collapsedNode = { ...node, isExpanded: false };
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={collapsedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // タブ数が表示されることを確認（親タブ + 子タブ2つ = 3）
      expect(screen.getByTestId('tab-count-display')).toHaveTextContent('3');
    });

    it('確認ダイアログでOKをクリックするとonCloseが呼ばれること', async () => {
      const user = userEvent.setup();
      const childNode = createMockNode('child-1', 2);
      const node = createMockNode('node-1', 1, 0, [childNode]);
      const collapsedNode = { ...node, isExpanded: false };
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={collapsedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={2} // Task 11.3: 閾値を2に設定（タブ数2なので表示される）
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // OKボタンをクリック
      const confirmButton = screen.getByTestId('confirm-button');
      await user.click(confirmButton);

      // onCloseが呼ばれることを確認
      expect(mockOnClose).toHaveBeenCalledWith(1, true);
    });

    it('確認ダイアログでキャンセルをクリックするとonCloseが呼ばれないこと', async () => {
      const user = userEvent.setup();
      const childNode = createMockNode('child-1', 2);
      const node = createMockNode('node-1', 1, 0, [childNode]);
      const collapsedNode = { ...node, isExpanded: false };
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={collapsedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={2} // Task 11.3: 閾値を2に設定（タブ数2なので表示される）
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // Cancelボタンをクリック
      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      // onCloseが呼ばれないことを確認
      expect(mockOnClose).not.toHaveBeenCalled();
      // ダイアログが閉じられることを確認
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('展開されたブランチを持つ親タブを閉じる場合は確認ダイアログを表示しないこと', () => {
      const childNode = createMockNode('child-1', 2);
      const node = createMockNode('node-1', 1, 0, [childNode]);
      const expandedNode = { ...node, isExpanded: true };
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={expandedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログは表示されない
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      // onCloseは直接呼ばれる
      expect(mockOnClose).toHaveBeenCalledWith(1, true);
    });

    it('子ノードがない場合は確認ダイアログを表示しないこと', () => {
      const node = createMockNode('node-1', 1, 0, []);
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログは表示されない
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      // onCloseは直接呼ばれる
      expect(mockOnClose).toHaveBeenCalledWith(1, false);
    });
  });

  describe('警告閾値によるダイアログ制御 (Task 11.3: Requirement 8.5)', () => {
    it('サブツリーのタブ数が閾値未満の場合は確認ダイアログを表示しないこと', () => {
      // 閾値を5に設定、サブツリーは親+子1つ=2タブ
      const childNode = createMockNode('child-1', 2);
      const node = createMockNode('node-1', 1, 0, [childNode]);
      const collapsedNode = { ...node, isExpanded: false };
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={collapsedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={5}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログは表示されない（タブ数2 < 閾値5）
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      // onCloseは直接呼ばれる
      expect(mockOnClose).toHaveBeenCalledWith(1, true);
    });

    it('サブツリーのタブ数が閾値以上の場合は確認ダイアログを表示すること', () => {
      // 閾値を3に設定、サブツリーは親+子2つ=3タブ
      const child1 = createMockNode('child-1', 2);
      const child2 = createMockNode('child-2', 3);
      const node = createMockNode('node-1', 1, 0, [child1, child2]);
      const collapsedNode = { ...node, isExpanded: false };
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={collapsedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={3}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログが表示される（タブ数3 >= 閾値3）
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('サブツリーのタブ数が閾値ちょうどの場合は確認ダイアログを表示すること', () => {
      // 閾値を2に設定、サブツリーは親+子1つ=2タブ
      const childNode = createMockNode('child-1', 2);
      const node = createMockNode('node-1', 1, 0, [childNode]);
      const collapsedNode = { ...node, isExpanded: false };
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={collapsedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={2}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログが表示される（タブ数2 >= 閾値2）
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('閾値が指定されていない場合は、デフォルト値(3)を使用すること', () => {
      // 閾値を指定しない、サブツリーは親+子1つ=2タブ
      const childNode = createMockNode('child-1', 2);
      const node = createMockNode('node-1', 1, 0, [childNode]);
      const collapsedNode = { ...node, isExpanded: false };
      const tab = createMockTab(1);

      render(
        <TreeNode
          node={collapsedNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          // closeWarningThresholdを指定しない
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      const treeNodeElement = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNodeElement);
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // デフォルト閾値3で、タブ数2 < 3なので確認ダイアログは表示されない
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      expect(mockOnClose).toHaveBeenCalledWith(1, true);
    });
  });
});
