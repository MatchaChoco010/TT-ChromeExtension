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
      expect(treeNodeElement).not.toHaveClass('bg-gray-200');

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

      // Requirement 3.1, 3.2: アクティブタブは青い枠線ではなく背景色で控えめに識別
      expect(treeNodeElement).toHaveClass('bg-gray-200');
      // 青い枠線が表示されないこと
      expect(treeNodeElement).not.toHaveClass('ring-2');
      expect(treeNodeElement).not.toHaveClass('ring-blue-400');
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

  describe('閉じるボタンの位置 (Task 4.1: Requirement 3.1, 3.2, 3.3)', () => {
    it('閉じるボタンがタブの右端に固定配置されていること', async () => {
      const user = userEvent.setup();
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'Very Long Tab Title That Should Not Push Close Button');

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
      await user.hover(treeNodeElement);

      // 閉じるボタンを含むコンテナの親要素がjustify-betweenを持つことを確認
      // タイトルエリアとCloseButtonが左右に分かれる
      const closeButton = screen.getByTestId('close-button');
      const contentContainer = closeButton.closest('[data-testid="tab-content"]');
      expect(contentContainer).toBeInTheDocument();
      expect(contentContainer).toHaveClass('justify-between');
    });

    it('タブタイトルの長さに関係なく閉じるボタンが常に右端にあること', async () => {
      const user = userEvent.setup();
      // 短いタイトル
      const nodeShort = createMockNode('node-short', 1);
      const tabShort = createMockTab(1, 'Short');

      const { rerender } = render(
        <TreeNode
          node={nodeShort}
          tab={tabShort}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      let treeNodeElement = screen.getByTestId('tree-node-1');
      await user.hover(treeNodeElement);

      let closeButton = screen.getByTestId('close-button');
      let contentContainer = closeButton.closest('[data-testid="tab-content"]');
      expect(contentContainer).toHaveClass('justify-between');

      // 長いタイトルに変更
      const nodeLong = createMockNode('node-long', 2);
      const tabLong = createMockTab(
        2,
        'This is a very very very long tab title that extends beyond normal width'
      );

      rerender(
        <TreeNode
          node={nodeLong}
          tab={tabLong}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      treeNodeElement = screen.getByTestId('tree-node-2');
      await user.hover(treeNodeElement);

      closeButton = screen.getByTestId('close-button');
      contentContainer = closeButton.closest('[data-testid="tab-content"]');
      expect(contentContainer).toHaveClass('justify-between');
    });

    it('ホバーしていない場合は閉じるボタンが非表示であること', () => {
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

      // ホバーしていない状態では閉じるボタンは表示されない
      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();
    });

    it('ホバー時のみ閉じるボタンが表示されること', async () => {
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

      // ホバー前は閉じるボタンがない
      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();

      // ホバーすると閉じるボタンが表示される
      await user.hover(treeNodeElement);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      // ホバーを外すと閉じるボタンが非表示になる
      await user.unhover(treeNodeElement);
      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();
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

  describe('タブタイトルの表示改善 (Task 4.2: Requirement 4.1, 4.2, 4.3, 4.4)', () => {
    it('Loading状態の場合「Loading...」と表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        id: 1,
        title: 'Some Title',
        url: 'https://example.com',
        favIconUrl: undefined,
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

      // Loading状態では「Loading...」と表示される
      expect(screen.getByText('Loading...')).toBeInTheDocument();
      // 元のタイトルは表示されない
      expect(screen.queryByText('Some Title')).not.toBeInTheDocument();
    });

    it('ロード完了後はタイトルが正しく表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        id: 1,
        title: 'Loaded Page Title',
        url: 'https://example.com',
        favIconUrl: undefined,
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

      expect(screen.getByText('Loaded Page Title')).toBeInTheDocument();
    });

    it('Vivaldi/Chromeの内部URL (chrome://vivaldi-webui/startpage) に対して「スタートページ」と表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        id: 1,
        title: 'Start Page',
        url: 'chrome://vivaldi-webui/startpage',
        favIconUrl: undefined,
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

      expect(screen.getByText('スタートページ')).toBeInTheDocument();
      expect(screen.queryByText('Start Page')).not.toBeInTheDocument();
    });

    it('vivaldi://startpage URLに対して「スタートページ」と表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        id: 1,
        title: 'Speed Dial',
        url: 'vivaldi://startpage/',
        favIconUrl: undefined,
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

      expect(screen.getByText('スタートページ')).toBeInTheDocument();
    });

    it('chrome-extension://内部URLに対して「新しいタブ」と表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        id: 1,
        title: 'New Tab',
        url: 'chrome-extension://abcdefg/newtab.html',
        favIconUrl: undefined,
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

      expect(screen.getByText('新しいタブ')).toBeInTheDocument();
    });

    it('chrome://newtab URLに対して「新しいタブ」と表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        id: 1,
        title: 'New Tab',
        url: 'chrome://newtab/',
        favIconUrl: undefined,
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

      expect(screen.getByText('新しいタブ')).toBeInTheDocument();
    });

    it('vivaldi://newtab URLに対して「新しいタブ」と表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        id: 1,
        title: 'Speed Dial',
        url: 'vivaldi://newtab/',
        favIconUrl: undefined,
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

      expect(screen.getByText('新しいタブ')).toBeInTheDocument();
    });

    it('通常のURLに対しては元のタイトルがそのまま表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        id: 1,
        title: 'Example Domain',
        url: 'https://example.com',
        favIconUrl: undefined,
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

      expect(screen.getByText('Example Domain')).toBeInTheDocument();
    });

    it('タイトルが変更された場合、再レンダリングで即座に更新されること', () => {
      const node = createMockNode('node-1', 1);
      const initialTab: TabInfo = {
        id: 1,
        title: 'Initial Title',
        url: 'https://example.com',
        favIconUrl: undefined,
        status: 'complete',
      };

      const { rerender } = render(
        <TreeNode
          node={node}
          tab={initialTab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Initial Title')).toBeInTheDocument();

      // タイトルが変更された場合
      const updatedTab: TabInfo = {
        ...initialTab,
        title: 'Updated Title',
      };

      rerender(
        <TreeNode
          node={node}
          tab={updatedTab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByText('Updated Title')).toBeInTheDocument();
      expect(screen.queryByText('Initial Title')).not.toBeInTheDocument();
    });

    it('Loadingから完了に状態が変わった場合、タイトルが更新されること', () => {
      const node = createMockNode('node-1', 1);
      const loadingTab: TabInfo = {
        id: 1,
        title: 'Page Title',
        url: 'https://example.com',
        favIconUrl: undefined,
        status: 'loading',
      };

      const { rerender } = render(
        <TreeNode
          node={node}
          tab={loadingTab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      // Loading中は「Loading...」と表示される
      expect(screen.getByText('Loading...')).toBeInTheDocument();

      // ロード完了後
      const completeTab: TabInfo = {
        ...loadingTab,
        status: 'complete',
      };

      rerender(
        <TreeNode
          node={node}
          tab={completeTab}
          isUnread={false}
          isActive={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      // 完了後は実際のタイトルが表示される
      expect(screen.getByText('Page Title')).toBeInTheDocument();
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('about:blank URLに対して「新しいタブ」と表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab: TabInfo = {
        id: 1,
        title: 'about:blank',
        url: 'about:blank',
        favIconUrl: undefined,
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

      expect(screen.getByText('新しいタブ')).toBeInTheDocument();
    });
  });

  describe('テキスト選択の無効化 (Task 4.4: Requirement 11.1, 11.2, 11.3)', () => {
    it('タブ要素にuser-select: noneが適用されていること', () => {
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
      expect(treeNodeElement).toHaveClass('select-none');
    });

    it('タブ要素内のテキストがselect-noneクラスを持つこと', () => {
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

      const treeNodeElement = screen.getByTestId('tree-node-1');
      // select-noneクラスが適用されていることを確認
      expect(treeNodeElement).toHaveClass('select-none');
    });
  });

  describe('未読インジケーターの右端固定表示 (Task 11.1: Requirement 11.1, 11.2, 11.3, 11.4)', () => {
    it('未読インジケーターがタブの右端に固定表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'Test Tab');

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

      // 未読バッジが表示される
      const unreadBadge = screen.getByTestId('unread-badge');
      expect(unreadBadge).toBeInTheDocument();

      // 未読バッジが右端固定コンテナ内にあること（right-actions-container）
      const rightActionsContainer = unreadBadge.closest('[data-testid="right-actions-container"]');
      expect(rightActionsContainer).toBeInTheDocument();
    });

    it('短いタイトルでも未読インジケーターがタブの右端に表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'A');

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

      const unreadBadge = screen.getByTestId('unread-badge');
      const rightActionsContainer = unreadBadge.closest('[data-testid="right-actions-container"]');
      expect(rightActionsContainer).toBeInTheDocument();
      // flex-shrink-0でサイズが維持される
      expect(rightActionsContainer).toHaveClass('flex-shrink-0');
    });

    it('長いタイトルでも未読インジケーターがタブの右端に表示されること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(
        1,
        'This is a very very very long tab title that extends beyond normal width'
      );

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

      const unreadBadge = screen.getByTestId('unread-badge');
      const rightActionsContainer = unreadBadge.closest('[data-testid="right-actions-container"]');
      expect(rightActionsContainer).toBeInTheDocument();
      // flex-shrink-0でサイズが維持される
      expect(rightActionsContainer).toHaveClass('flex-shrink-0');
    });

    it('未読インジケーターがタイトルエリアの外（右端固定コンテナ内）に配置されること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'Test Tab');

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

      const unreadBadge = screen.getByTestId('unread-badge');
      // タイトルエリア（title-area）の外にあることを確認
      const titleArea = screen.getByTestId('title-area');
      expect(titleArea).not.toContainElement(unreadBadge);
    });

    it('ホバー時に閉じるボタンと未読インジケーターが両方表示されること', async () => {
      const user = userEvent.setup();
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'Test Tab');

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

      const treeNodeElement = screen.getByTestId('tree-node-1');
      await user.hover(treeNodeElement);

      // 両方が表示される
      expect(screen.getByTestId('unread-badge')).toBeInTheDocument();
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      // 両方が同じ右端固定コンテナ内にあること
      const rightActionsContainer = screen.getByTestId('right-actions-container');
      expect(rightActionsContainer).toContainElement(screen.getByTestId('unread-badge'));
      expect(rightActionsContainer).toContainElement(screen.getByTestId('close-button'));
    });
  });

  describe('休止タブのグレーアウト表示 (Task 4.1 tab-tree-bugfix: Requirement 3.1, 3.2)', () => {
    it('休止タブの場合、タイトルにグレーアウトスタイルが適用されること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'Discarded Tab');

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          isDiscarded={true}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      // discarded-tab-titleテストIDを持つ要素が存在することを確認
      const discardedTitle = screen.getByTestId('discarded-tab-title');
      expect(discardedTitle).toBeInTheDocument();
      expect(discardedTitle).toHaveClass('text-gray-400');
    });

    it('休止タブでない場合、グレーアウトスタイルが適用されないこと', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'Normal Tab');

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          isDiscarded={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      // discarded-tab-titleテストIDが存在しないことを確認
      expect(screen.queryByTestId('discarded-tab-title')).not.toBeInTheDocument();
      // タイトルは表示されている
      expect(screen.getByText('Normal Tab')).toBeInTheDocument();
    });

    it('isDiscardedがundefinedの場合、グレーアウトスタイルが適用されないこと（デフォルト）', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'Default Tab');

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          // isDiscardedを指定しない（デフォルト値false）
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      // discarded-tab-titleテストIDが存在しないことを確認
      expect(screen.queryByTestId('discarded-tab-title')).not.toBeInTheDocument();
      // タイトルは表示されている
      expect(screen.getByText('Default Tab')).toBeInTheDocument();
    });

    it('休止タブからアクティブタブになった場合、グレーアウトが解除されること', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'Tab Title');

      // 最初は休止タブ
      const { rerender } = render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          isDiscarded={true}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      // 休止タブなのでグレーアウトが適用されている
      expect(screen.getByTestId('discarded-tab-title')).toBeInTheDocument();

      // 休止状態が解除された
      rerender(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={true}
          isDiscarded={false}
          onActivate={mockOnActivate}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
        />
      );

      // グレーアウトが解除されている
      expect(screen.queryByTestId('discarded-tab-title')).not.toBeInTheDocument();
      expect(screen.getByText('Tab Title')).toBeInTheDocument();
    });
  });
});
