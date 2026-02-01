import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TreeNode from './TreeNode';
import type { UITabNode, TabInfo } from '@/types';

describe('タブ閉じる機能の統合テスト', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
  });

  const createMockNode = (
    tabId: number,
    depth: number = 0,
    children: UITabNode[] = [],
    isExpanded: boolean = true,
  ): UITabNode => ({
    tabId,
    depth,
    children,
    isExpanded,
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
      const node = createMockNode(1);
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

      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();

      fireEvent.mouseEnter(treeNode);

      expect(screen.getByTestId('close-button')).toBeInTheDocument();
    });

    it('タブノードからマウスを離すと、閉じるボタンが非表示になる', () => {
      const node = createMockNode(1);
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

      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      fireEvent.mouseLeave(treeNode);

      expect(screen.queryByTestId('close-button')).not.toBeInTheDocument();
    });

    it('閉じるボタンをクリックすると、onCloseコールバックが呼ばれる', () => {
      const node = createMockNode(1);
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

      fireEvent.mouseEnter(treeNode);
      expect(screen.getByTestId('close-button')).toBeInTheDocument();

      const closeButton = screen.getByTestId('close-button');
      fireEvent.click(closeButton);

      expect(onClose).toHaveBeenCalledWith(1, false);
    });
  });

  describe('折りたたまれたブランチを持つ親タブ閉じ時に確認ダイアログが表示される', () => {
    it('折りたたまれた子タブを持つ親タブを閉じようとすると、確認ダイアログが表示される', () => {
      const childNode1 = createMockNode(2, 1);
      const childNode2 = createMockNode(3, 1);
      const parentNode = createMockNode(
        1,
        0,
        [childNode1, childNode2],
        false,
      );

      const tab = createMockTab(1, '親タブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={3}
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

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      expect(screen.getByTestId('tab-count-display')).toHaveTextContent(
        '3個のタブが閉じられます',
      );
    });

    it('確認ダイアログでOKを選択すると、親タブとすべての子タブが閉じられる', async () => {
      const childNode = createMockNode(2, 1);
      const parentNode = createMockNode(
        1,
        0,
        [childNode],
        false,
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

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      const confirmButton = screen.getByTestId('confirm-button');
      await user.click(confirmButton);

      expect(onClose).toHaveBeenCalledWith(1, true);

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('確認ダイアログでキャンセルを選択すると、タブは閉じられない', async () => {
      const childNode = createMockNode(2, 1);
      const parentNode = createMockNode(
        1,
        0,
        [childNode],
        false,
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

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      expect(onClose).not.toHaveBeenCalled();

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });

    it('展開された子タブを持つ親タブを閉じる場合、確認ダイアログは表示されない', () => {
      const childNode = createMockNode(2, 1);
      const parentNode = createMockNode(
        1,
        0,
        [childNode],
        true,
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

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

      expect(onClose).toHaveBeenCalledWith(1, true);
    });
  });

  describe('警告閾値のカスタマイズ', () => {
    it('サブツリーのタブ数が閾値未満の場合、確認ダイアログは表示されない', () => {
      const childNode = createMockNode(2, 1);
      const parentNode = createMockNode(
        1,
        0,
        [childNode],
        false,
      );

      const tab = createMockTab(1, '親タブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={5}
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

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

      expect(onClose).toHaveBeenCalledWith(1, true);
    });

    it('サブツリーのタブ数が閾値以上の場合、確認ダイアログが表示される', () => {
      const grandChild1 = createMockNode(4, 2);
      const grandChild2 = createMockNode(5, 2);
      const grandChild3 = createMockNode(6, 2);
      const child1 = createMockNode(2, 1, [grandChild1, grandChild2]);
      const child2 = createMockNode(3, 1, [grandChild3]);
      const parentNode = createMockNode(
        1,
        0,
        [child1, child2],
        false,
      );

      const tab = createMockTab(1, '親タブ（大きなサブツリー）');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
          tab={tab}
          isUnread={false}
          isActive={false}
          closeWarningThreshold={5}
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

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();

      expect(screen.getByTestId('tab-count-display')).toHaveTextContent(
        '6個のタブが閉じられます',
      );
    });

    it('閾値が1の場合、単一の子タブでも確認ダイアログが表示される', () => {
      const childNode = createMockNode(2, 1);
      const parentNode = createMockNode(
        1,
        0,
        [childNode],
        false,
      );

      const tab = createMockTab(1, '親タブ');
      const onClose = vi.fn();

      render(
        <TreeNode
          node={parentNode}
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

      expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    });
  });

  describe('エッジケース', () => {
    it('子タブを持たない単一のタブを閉じる場合、確認ダイアログは表示されない', () => {
      const node = createMockNode(1);
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

      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();

      expect(onClose).toHaveBeenCalledWith(1, false);
    });

    it('閉じるボタンのクリックがノードのクリックイベントを伝播しない', () => {
      const node = createMockNode(1);
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

      expect(onActivate).not.toHaveBeenCalled();

      expect(onClose).toHaveBeenCalledWith(1, false);
    });
  });
});
