import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TreeNode from './TreeNode';
import type { TabNode, TabInfo } from '@/types';

/**
 * タブ閉じる機能のテスト
 *
 * 統合テスト: TreeNode + CloseButton + ConfirmDialog + UserSettings
 *
 * - マウスホバー時に閉じるボタンが表示される
 * - 折りたたまれたブランチを持つ親タブ閉じ時に確認ダイアログが表示される
 */
describe('タブ閉じる機能の統合テスト', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
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

  const createMockTab = (id: number, title: string = 'Test Tab'): TabInfo => ({
    id,
    title,
    url: 'https://example.com',
    favIconUrl: undefined,
    status: 'complete',
  });

  describe('マウスホバー時に閉じるボタンが表示される', () => {
    it('タブノードにマウスをホバーすると、閉じるボタンが表示される', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'ホバーするタブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
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

    it('タブノードからマウスを離すと、閉じるボタンが非表示になる', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'ホバー解除するタブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');

      // マウスをホバー
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      // マウスを離す
      fireEvent.mouseLeave(treeNode);

      // 閉じるボタンが非表示になる
      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();
    });

    it('閉じるボタンをクリックすると、onCloseコールバックが呼ばれる', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, '閉じるタブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');

      // マウスをホバー
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      // 閉じるボタンをクリック
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // onCloseコールバックが呼ばれる
      expect(onClose).toHaveBeenCalledWith(1, false);
    });
  });

  describe('折りたたまれたブランチを持つ親タブ閉じ時に確認ダイアログが表示される', () => {
    it('折りたたまれた子タブを持つ親タブを閉じようとすると、確認ダイアログが表示される', () => {
      // 子タブを持つ親ノード（折りたたまれている）
      const childNode1 = createMockNode('child-1', 2, 1);
      const childNode2 = createMockNode('child-2', 3, 1);
      const parentNode = createMockNode(
        'parent-1',
        1,
        0,
        [childNode1, childNode2],
        false, // 折りたたまれている
      );

      const tab = createMockTab(1, '親タブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={3} // デフォルト閾値
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');

      // マウスをホバー
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      // 閉じるボタンをクリック
      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログが表示される
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      // タブ数が表示される（親タブ1 + 子タブ2 = 3個）
      expect(screen.getByTestId('tab-count-display')).toHaveTextContent(
        '3個のタブが閉じられます',
      );
    });

    it('確認ダイアログでOKを選択すると、親タブとすべての子タブが閉じられる', async () => {
      const childNode = createMockNode('child-1', 2, 1);
      const parentNode = createMockNode(
        'parent-1',
        1,
        0,
        [childNode],
        false, // 折りたたまれている
      );

      const tab = createMockTab(1, '親タブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={2}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログが表示される
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      // OKボタンをクリック
      const confirmButton = screen.getByTestId('confirm-button');
      await user.click(confirmButton);

      // onCloseコールバックが呼ばれる
      expect(onClose).toHaveBeenCalledWith(1, true);

      // ダイアログが閉じられる
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('確認ダイアログでキャンセルを選択すると、タブは閉じられない', async () => {
      const childNode = createMockNode('child-1', 2, 1);
      const parentNode = createMockNode(
        'parent-1',
        1,
        0,
        [childNode],
        false, // 折りたたまれている
      );

      const tab = createMockTab(1, '親タブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={2}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログが表示される
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      // キャンセルボタンをクリック
      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      // onCloseコールバックは呼ばれない
      expect(onClose).not.toHaveBeenCalled();

      // ダイアログが閉じられる
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('展開された子タブを持つ親タブを閉じる場合、確認ダイアログは表示されない', () => {
      const childNode = createMockNode('child-1', 2, 1);
      const parentNode = createMockNode(
        'parent-1',
        1,
        0,
        [childNode],
        true, // 展開されている
      );

      const tab = createMockTab(1, '親タブ（展開済み）');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={2}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログは表示されない（展開されているため）
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

      // onCloseコールバックが直接呼ばれる
      expect(onClose).toHaveBeenCalledWith(1, true);
    });
  });

  describe('警告閾値のカスタマイズ', () => {
    it('サブツリーのタブ数が閾値未満の場合、確認ダイアログは表示されない', () => {
      const childNode = createMockNode('child-1', 2, 1);
      const parentNode = createMockNode(
        'parent-1',
        1,
        0,
        [childNode],
        false, // 折りたたまれている
      );

      const tab = createMockTab(1, '親タブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={5} // 閾値を5に設定（サブツリーは2個なので閾値未満）
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログは表示されない（タブ数が閾値未満のため）
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

      // onCloseコールバックが直接呼ばれる
      expect(onClose).toHaveBeenCalledWith(1, true);
    });

    it('サブツリーのタブ数が閾値以上の場合、確認ダイアログが表示される', () => {
      // 3階層のツリーを作成（親1 + 子2 + 孫3 = 合計6個のタブ）
      const grandChild1 = createMockNode('grandchild-1', 4, 2);
      const grandChild2 = createMockNode('grandchild-2', 5, 2);
      const grandChild3 = createMockNode('grandchild-3', 6, 2);
      const child1 = createMockNode('child-1', 2, 1, [grandChild1, grandChild2]);
      const child2 = createMockNode('child-2', 3, 1, [grandChild3]);
      const parentNode = createMockNode(
        'parent-1',
        1,
        0,
        [child1, child2],
        false, // 折りたたまれている
      );

      const tab = createMockTab(1, '親タブ（大きなサブツリー）');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={5} // 閾値を5に設定（サブツリーは6個なので閾値以上）
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログが表示される
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      // 正しいタブ数が表示される
      expect(screen.getByTestId('tab-count-display')).toHaveTextContent(
        '6個のタブが閉じられます',
      );
    });

    it('閾値が1の場合、単一の子タブでも確認ダイアログが表示される', () => {
      const childNode = createMockNode('child-1', 2, 1);
      const parentNode = createMockNode(
        'parent-1',
        1,
        0,
        [childNode],
        false, // 折りたたまれている
      );

      const tab = createMockTab(1, '親タブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={1} // 閾値を1に設定
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログが表示される
      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });
  });

  describe('エッジケース', () => {
    it('子タブを持たない単一のタブを閉じる場合、確認ダイアログは表示されない', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, '単一タブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={1}
          onActivate={vi.fn()}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // 確認ダイアログは表示されない
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

      // onCloseコールバックが直接呼ばれる
      expect(onClose).toHaveBeenCalledWith(1, false);
    });

    it('閉じるボタンのクリックがノードのクリックイベントを伝播しない', () => {
      const node = createMockNode('node-1', 1);
      const tab = createMockTab(1, 'クリック伝播テスト');
      const onActivate = vi.fn();
      const onClose = vi.fn();

      render(
        <TreeNode
          node={node}
          tab={tab}
          isUnread={false}
          isActive={false}
          onActivate={onActivate}
          onToggle={vi.fn()}
          onClose={onClose}
        />,
      );

      const treeNode = screen.getByTestId('tree-node-1');
      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      // onActivateは呼ばれない（イベント伝播が停止されている）
      expect(onActivate).not.toHaveBeenCalled();

      // onCloseは呼ばれる
      expect(onClose).toHaveBeenCalledWith(1, false);
    });
  });
});
