import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GroupNode from './GroupNode';
import type { Group } from '@/types';

describe('GroupNode', () => {
  const mockGroup: Group = {
    id: 'group-1',
    name: 'Test Group',
    color: '#ff0000',
    isExpanded: true,
  };

  const mockOnClick = vi.fn();
  const mockOnToggle = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    mockOnClick.mockClear();
    mockOnToggle.mockClear();
    mockOnClose.mockClear();
  });

  it('should render group node with title and color', () => {
    render(
      <GroupNode
        group={mockGroup}
        depth={0}
        onClick={mockOnClick}
        onToggle={mockOnToggle}
      />
    );

    // グループ名が表示されていることを確認
    expect(screen.getByText('Test Group')).toBeInTheDocument();

    // グループノードが存在することを確認
    const groupNode = screen.getByTestId('group-node-group-1');
    expect(groupNode).toBeInTheDocument();
  });

  it('should apply custom color to group indicator', () => {
    render(
      <GroupNode
        group={mockGroup}
        depth={0}
        onClick={mockOnClick}
        onToggle={mockOnToggle}
      />
    );

    // カラーインジケータが存在することを確認
    const colorIndicator = screen.getByTestId('group-color-indicator');
    expect(colorIndicator).toBeInTheDocument();

    // 背景色が適用されていることを確認
    expect(colorIndicator).toHaveStyle({ backgroundColor: '#ff0000' });
  });

  it('should call onClick when group page is clicked', async () => {
    const user = userEvent.setup();

    render(
      <GroupNode
        group={mockGroup}
        depth={0}
        onClick={mockOnClick}
        onToggle={mockOnToggle}
      />
    );

    const groupNode = screen.getByTestId('group-node-group-1');
    await user.click(groupNode);

    // クリックハンドラが呼ばれることを確認
    expect(mockOnClick).toHaveBeenCalledWith('group-1');
  });

  it('should display expand toggle button', () => {
    render(
      <GroupNode
        group={mockGroup}
        depth={0}
        onClick={mockOnClick}
        onToggle={mockOnToggle}
      />
    );

    // 展開/折りたたみボタンが存在することを確認
    const toggleButton = screen.getByTestId('toggle-expand-group-1');
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveAttribute('aria-label', 'Collapse');
  });

  it('should call onToggle when toggle button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <GroupNode
        group={mockGroup}
        depth={0}
        onClick={mockOnClick}
        onToggle={mockOnToggle}
      />
    );

    const toggleButton = screen.getByTestId('toggle-expand-group-1');
    await user.click(toggleButton);

    // トグルハンドラが呼ばれることを確認
    expect(mockOnToggle).toHaveBeenCalledWith('group-1');
    // onClickは呼ばれないことを確認（イベント伝播が停止されている）
    expect(mockOnClick).not.toHaveBeenCalled();
  });

  it('should display collapsed state when isExpanded is false', () => {
    const collapsedGroup: Group = {
      ...mockGroup,
      isExpanded: false,
    };

    render(
      <GroupNode
        group={collapsedGroup}
        depth={0}
        onClick={mockOnClick}
        onToggle={mockOnToggle}
      />
    );

    const toggleButton = screen.getByTestId('toggle-expand-group-1');
    expect(toggleButton).toHaveAttribute('aria-label', 'Expand');
    expect(toggleButton).toHaveTextContent('▶');
  });

  it('should display expanded state when isExpanded is true', () => {
    render(
      <GroupNode
        group={mockGroup}
        depth={0}
        onClick={mockOnClick}
        onToggle={mockOnToggle}
      />
    );

    const toggleButton = screen.getByTestId('toggle-expand-group-1');
    expect(toggleButton).toHaveAttribute('aria-label', 'Collapse');
    expect(toggleButton).toHaveTextContent('▼');
  });

  it('should apply correct indentation based on depth', () => {
    render(
      <GroupNode
        group={mockGroup}
        depth={2}
        onClick={mockOnClick}
        onToggle={mockOnToggle}
      />
    );

    const groupNode = screen.getByTestId('group-node-group-1');

    // depth=2の場合、indentSize = 2 * 20 + 8 = 48px
    expect(groupNode).toHaveStyle({ paddingLeft: '48px' });
  });

  it('should display group icon indicator', () => {
    render(
      <GroupNode
        group={mockGroup}
        depth={0}
        onClick={mockOnClick}
        onToggle={mockOnToggle}
      />
    );

    // グループアイコンインジケータが存在することを確認
    const groupIcon = screen.getByTestId('group-icon');
    expect(groupIcon).toBeInTheDocument();
  });

  describe('Close button and confirmation dialog', () => {
    it('should display close button on hover', async () => {
      const user = userEvent.setup();

      render(
        <GroupNode
          group={mockGroup}
          depth={0}
          onClick={mockOnClick}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
          tabCount={5}
        />
      );

      const groupNode = screen.getByTestId('group-node-group-1');

      // 初期状態では閉じるボタンが表示されていないことを確認
      expect(screen.queryByTestId('close-button-group-1')).not.toBeInTheDocument();

      // ホバー
      await user.hover(groupNode);

      // ホバー時に閉じるボタンが表示されることを確認
      expect(screen.getByTestId('close-button-group-1')).toBeInTheDocument();
    });

    it('should show confirmation dialog when close button is clicked', async () => {
      render(
        <GroupNode
          group={mockGroup}
          depth={0}
          onClick={mockOnClick}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
          tabCount={5}
        />
      );

      const groupNode = screen.getByTestId('group-node-group-1');

      // マウスエンターイベントを発火してホバー状態にする
      fireEvent.mouseEnter(groupNode);

      // 閉じるボタンを取得してクリック
      const closeButton = screen.getByTestId('close-button-group-1');
      fireEvent.click(closeButton);

      // 確認ダイアログが表示されることを確認
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });
      expect(screen.getByText(/このグループには 5 個のタブが含まれています/)).toBeInTheDocument();
    });

    it('should call onClose when confirming dialog', async () => {
      const user = userEvent.setup();

      render(
        <GroupNode
          group={mockGroup}
          depth={0}
          onClick={mockOnClick}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
          tabCount={5}
        />
      );

      const groupNode = screen.getByTestId('group-node-group-1');

      // マウスエンターイベントを発火してホバー状態にする
      fireEvent.mouseEnter(groupNode);

      const closeButton = screen.getByTestId('close-button-group-1');
      fireEvent.click(closeButton);

      // ダイアログが表示されるのを待つ
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });

      // OKボタンをクリック
      const confirmButton = screen.getByTestId('confirm-button');
      await user.click(confirmButton);

      // onCloseが呼ばれることを確認
      expect(mockOnClose).toHaveBeenCalledWith('group-1');
    });

    it('should not call onClose when canceling dialog', async () => {
      const user = userEvent.setup();

      render(
        <GroupNode
          group={mockGroup}
          depth={0}
          onClick={mockOnClick}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
          tabCount={5}
        />
      );

      const groupNode = screen.getByTestId('group-node-group-1');

      // マウスエンターイベントを発火してホバー状態にする
      fireEvent.mouseEnter(groupNode);

      const closeButton = screen.getByTestId('close-button-group-1');
      fireEvent.click(closeButton);

      // ダイアログが表示されるのを待つ
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });

      // キャンセルボタンをクリック
      const cancelButton = screen.getByTestId('cancel-button');
      await user.click(cancelButton);

      // onCloseが呼ばれないことを確認
      expect(mockOnClose).not.toHaveBeenCalled();

      // ダイアログが閉じられることを確認
      await waitFor(() => {
        expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
      });
    });

    it('should not show close button when onClose is not provided', () => {
      render(
        <GroupNode
          group={mockGroup}
          depth={0}
          onClick={mockOnClick}
          onToggle={mockOnToggle}
        />
      );

      // グループノードが存在することを確認
      expect(screen.getByTestId('group-node-group-1')).toBeInTheDocument();

      // 閉じるボタンが存在しないことを確認
      expect(screen.queryByTestId('close-button-group-1')).not.toBeInTheDocument();
    });

    it('should not show confirmation dialog for groups with no tabs', () => {
      render(
        <GroupNode
          group={mockGroup}
          depth={0}
          onClick={mockOnClick}
          onToggle={mockOnToggle}
          onClose={mockOnClose}
          tabCount={0}
        />
      );

      const groupNode = screen.getByTestId('group-node-group-1');

      // マウスエンターイベントを発火してホバー状態にする
      fireEvent.mouseEnter(groupNode);

      const closeButton = screen.getByTestId('close-button-group-1');
      fireEvent.click(closeButton);

      // 確認ダイアログなしで直接onCloseが呼ばれることを確認
      expect(mockOnClose).toHaveBeenCalledWith('group-1');
      expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
    });
  });
});
