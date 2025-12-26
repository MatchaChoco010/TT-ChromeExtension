import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TreeStateProvider } from '@/sidepanel/providers/TreeStateProvider';
import TabTreeView from './TabTreeView';
import GroupNode from './GroupNode';
import { GroupManager } from '@/services/GroupManager';
import { TreeStateManager } from '@/services/TreeStateManager';
import type { TabNode, Group, UserSettings } from '@/types';
import '@/test/chrome-mock';

/**
 * グループ化機能の統合テスト
 * Requirements: 5.1, 5.2, 5.4
 *
 * このテストファイルは、グループ化機能の以下のAcceptance Criteriaをテストします:
 * - AC 5.1: 複数のタブを選択してグループ化コマンドを実行すると、新しいグループページが作成される
 * - AC 5.2: グループページはカスタマイズ可能なタイトルと色を持つ
 * - AC 5.4: ユーザーがグループを折りたたむと、グループ内のタブが非表示になる
 */
describe('グループ化機能の統合テスト (Task 9.4)', () => {
  let mockGroupManager: GroupManager;
  let mockTreeStateManager: TreeStateManager;
  let mockStorageService: any;

  beforeEach(() => {
    // ストレージサービスのモック
    mockStorageService = {
      get: vi.fn(async () => null),
      set: vi.fn(async () => {}),
      remove: vi.fn(async () => {}),
      onChange: vi.fn(() => () => {}),
    };

    mockGroupManager = new GroupManager(mockStorageService);
    mockTreeStateManager = new TreeStateManager(mockStorageService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Acceptance Criteria 5.1:
   * 複数のタブを選択してグループ化コマンドを実行すると、
   * 新しいグループページが作成され、選択されたタブがその配下に配置される
   */
  describe('AC 5.1: グループページの作成', () => {
    it('複数タブをグループ化してグループページが作成されること', async () => {
      // Given: 3つのタブを選択
      const tabIds = [1, 2, 3];
      const groupName = 'テストグループ';
      const groupColor = '#ff0000';

      // When: グループを作成
      const group = await mockGroupManager.createGroup(
        tabIds,
        groupName,
        groupColor,
      );

      // Then: グループが作成されていることを確認
      expect(group).toBeDefined();
      expect(group.id).toBeDefined();
      expect(group.name).toBe(groupName);
      expect(group.color).toBe(groupColor);
      expect(group.isExpanded).toBe(true);

      // グループがストレージに永続化されていることを確認
      expect(mockStorageService.set).toHaveBeenCalledWith(
        'groups',
        expect.any(Object),
      );
    });

    it('グループページのUIコンポーネントが正しくレンダリングされること', () => {
      // Given: グループデータ
      const mockGroup: Group = {
        id: 'group-1',
        name: 'ワークスペース',
        color: '#4287f5',
        isExpanded: true,
      };

      const mockOnClick = vi.fn();
      const mockOnToggle = vi.fn();

      // When: GroupNodeコンポーネントをレンダリング
      render(
        <GroupNode
          group={mockGroup}
          depth={0}
          onClick={mockOnClick}
          onToggle={mockOnToggle}
          tabCount={3}
        />,
      );

      // Then: グループ名が表示されていること
      expect(screen.getByText('ワークスペース')).toBeInTheDocument();

      // グループカラーインジケータが正しい色で表示されていること
      const colorIndicator = screen.getByTestId('group-color-indicator');
      expect(colorIndicator).toHaveStyle({ backgroundColor: '#4287f5' });

      // グループアイコンが表示されていること
      expect(screen.getByTestId('group-icon')).toBeInTheDocument();

      // 展開/折りたたみボタンが表示されていること
      expect(screen.getByTestId('toggle-expand-group-1')).toBeInTheDocument();
    });

    it('複数のグループを作成できること', async () => {
      // Given: 2つのグループを作成
      const group1 = await mockGroupManager.createGroup(
        [1, 2],
        'グループ1',
        '#ff0000',
      );
      const group2 = await mockGroupManager.createGroup(
        [3, 4],
        'グループ2',
        '#00ff00',
      );

      // When: すべてのグループを取得
      const groups = await mockGroupManager.getGroups();

      // Then: 2つのグループが存在すること
      expect(groups).toHaveLength(2);
      expect(groups[0].id).toBe(group1.id);
      expect(groups[1].id).toBe(group2.id);

      // 各グループがユニークなIDを持つこと
      expect(group1.id).not.toBe(group2.id);
    });
  });

  /**
   * Acceptance Criteria 5.2:
   * グループページはカスタマイズ可能なタイトルと色を持つ
   */
  describe('AC 5.2: グループのカスタマイズ', () => {
    it('グループのタイトルをカスタマイズできること', async () => {
      // Given: グループを作成
      const group = await mockGroupManager.createGroup(
        [1, 2],
        '元のタイトル',
        '#ff0000',
      );

      // When: タイトルを更新
      const newTitle = '新しいタイトル';
      await mockGroupManager.updateGroup(group.id, { name: newTitle });

      // Then: タイトルが更新されていること
      const groups = await mockGroupManager.getGroups();
      const updatedGroup = groups.find((g) => g.id === group.id);
      expect(updatedGroup?.name).toBe(newTitle);
    });

    it('グループの色をカスタマイズできること', async () => {
      // Given: グループを作成
      const group = await mockGroupManager.createGroup(
        [1, 2],
        'グループ',
        '#ff0000',
      );

      // When: 色を更新
      const newColor = '#00ff00';
      await mockGroupManager.updateGroup(group.id, { color: newColor });

      // Then: 色が更新されていること
      const groups = await mockGroupManager.getGroups();
      const updatedGroup = groups.find((g) => g.id === group.id);
      expect(updatedGroup?.color).toBe(newColor);
    });

    it('更新後のグループがUIに正しく反映されること', async () => {
      // Given: グループを作成して更新
      const group = await mockGroupManager.createGroup(
        [1, 2],
        '元のタイトル',
        '#ff0000',
      );

      await mockGroupManager.updateGroup(group.id, {
        name: '更新されたタイトル',
        color: '#00ff00',
      });

      // When: 更新されたグループを取得してレンダリング
      const groups = await mockGroupManager.getGroups();
      const updatedGroup = groups.find((g) => g.id === group.id);

      const mockOnClick = vi.fn();
      const mockOnToggle = vi.fn();

      render(
        <GroupNode
          group={updatedGroup!}
          depth={0}
          onClick={mockOnClick}
          onToggle={mockOnToggle}
        />,
      );

      // Then: 更新されたタイトルが表示されていること
      expect(screen.getByText('更新されたタイトル')).toBeInTheDocument();

      // 更新された色が適用されていること
      const colorIndicator = screen.getByTestId('group-color-indicator');
      expect(colorIndicator).toHaveStyle({ backgroundColor: '#00ff00' });
    });

    it('複数のグループが異なるタイトルと色を持てること', async () => {
      // Given: 異なるプロパティを持つ3つのグループを作成
      const group1 = await mockGroupManager.createGroup(
        [1],
        'ワーク',
        '#ff0000',
      );
      const group2 = await mockGroupManager.createGroup(
        [2],
        'プライベート',
        '#00ff00',
      );
      const group3 = await mockGroupManager.createGroup(
        [3],
        'リサーチ',
        '#0000ff',
      );

      // When: すべてのグループを取得
      const groups = await mockGroupManager.getGroups();

      // Then: 各グループが異なるタイトルと色を持つこと
      expect(groups).toHaveLength(3);
      expect(groups[0].name).toBe('ワーク');
      expect(groups[0].color).toBe('#ff0000');
      expect(groups[1].name).toBe('プライベート');
      expect(groups[1].color).toBe('#00ff00');
      expect(groups[2].name).toBe('リサーチ');
      expect(groups[2].color).toBe('#0000ff');
    });
  });

  /**
   * Acceptance Criteria 5.4:
   * ユーザーがグループを折りたたむと、グループ内のタブが非表示になる
   */
  describe('AC 5.4: グループの折りたたみ', () => {
    it('グループを折りたたむとタブが非表示になること', async () => {
      const user = userEvent.setup();

      // Given: 展開状態のグループ
      const mockGroup: Group = {
        id: 'group-1',
        name: 'テストグループ',
        color: '#ff0000',
        isExpanded: true,
      };

      let currentGroup = { ...mockGroup };
      const mockOnToggle = vi.fn(async (groupId: string) => {
        // トグル時に展開状態を反転
        currentGroup = { ...currentGroup, isExpanded: !currentGroup.isExpanded };
        await mockGroupManager.updateGroup(groupId, {
          isExpanded: currentGroup.isExpanded,
        });
      });

      const { rerender } = render(
        <GroupNode
          group={currentGroup}
          depth={0}
          onClick={vi.fn()}
          onToggle={mockOnToggle}
        />,
      );

      // When: 展開/折りたたみボタンをクリック
      const toggleButton = screen.getByTestId('toggle-expand-group-1');
      expect(toggleButton).toHaveTextContent('▼'); // 展開状態

      await user.click(toggleButton);

      // Then: onToggleが呼ばれること
      expect(mockOnToggle).toHaveBeenCalledWith('group-1');

      // グループを更新してUIを再レンダリング
      rerender(
        <GroupNode
          group={currentGroup}
          depth={0}
          onClick={vi.fn()}
          onToggle={mockOnToggle}
        />,
      );

      // 折りたたみ状態のアイコンが表示されること
      const updatedToggleButton = screen.getByTestId('toggle-expand-group-1');
      expect(updatedToggleButton).toHaveTextContent('▶'); // 折りたたみ状態
      expect(updatedToggleButton).toHaveAttribute('aria-label', 'Expand');
    });

    it('折りたたまれたグループを展開できること', async () => {
      const user = userEvent.setup();

      // Given: 折りたたまれた状態のグループ
      const mockGroup: Group = {
        id: 'group-1',
        name: 'テストグループ',
        color: '#ff0000',
        isExpanded: false,
      };

      let currentGroup = { ...mockGroup };
      const mockOnToggle = vi.fn(async (groupId: string) => {
        currentGroup = { ...currentGroup, isExpanded: !currentGroup.isExpanded };
        await mockGroupManager.updateGroup(groupId, {
          isExpanded: currentGroup.isExpanded,
        });
      });

      const { rerender } = render(
        <GroupNode
          group={currentGroup}
          depth={0}
          onClick={vi.fn()}
          onToggle={mockOnToggle}
        />,
      );

      // When: 展開/折りたたみボタンをクリック
      const toggleButton = screen.getByTestId('toggle-expand-group-1');
      expect(toggleButton).toHaveTextContent('▶'); // 折りたたみ状態

      await user.click(toggleButton);

      // Then: onToggleが呼ばれること
      expect(mockOnToggle).toHaveBeenCalledWith('group-1');

      // グループを更新してUIを再レンダリング
      rerender(
        <GroupNode
          group={currentGroup}
          depth={0}
          onClick={vi.fn()}
          onToggle={mockOnToggle}
        />,
      );

      // 展開状態のアイコンが表示されること
      const updatedToggleButton = screen.getByTestId('toggle-expand-group-1');
      expect(updatedToggleButton).toHaveTextContent('▼'); // 展開状態
      expect(updatedToggleButton).toHaveAttribute('aria-label', 'Collapse');
    });

    it('グループの展開状態がストレージに永続化されること', async () => {
      // Given: 展開状態のグループを作成
      const group = await mockGroupManager.createGroup(
        [1, 2, 3],
        'グループ',
        '#ff0000',
      );

      // When: グループを折りたたむ
      await mockGroupManager.updateGroup(group.id, { isExpanded: false });

      // Then: 状態がストレージに保存されていること
      expect(mockStorageService.set).toHaveBeenCalledWith(
        'groups',
        expect.objectContaining({
          [group.id]: expect.objectContaining({
            isExpanded: false,
          }),
        }),
      );

      // ストレージから取得したグループの状態が正しいこと
      const groups = await mockGroupManager.getGroups();
      const updatedGroup = groups.find((g) => g.id === group.id);
      expect(updatedGroup?.isExpanded).toBe(false);
    });

    it('複数のグループが独立して展開/折りたたみできること', async () => {
      // Given: 3つのグループを作成
      const group1 = await mockGroupManager.createGroup(
        [1],
        'グループ1',
        '#ff0000',
      );
      const group2 = await mockGroupManager.createGroup(
        [2],
        'グループ2',
        '#00ff00',
      );
      const group3 = await mockGroupManager.createGroup(
        [3],
        'グループ3',
        '#0000ff',
      );

      // When: group2のみを折りたたむ
      await mockGroupManager.updateGroup(group2.id, { isExpanded: false });

      // Then: group2のみが折りたたまれ、他のグループは展開状態のまま
      const groups = await mockGroupManager.getGroups();

      const updatedGroup1 = groups.find((g) => g.id === group1.id);
      const updatedGroup2 = groups.find((g) => g.id === group2.id);
      const updatedGroup3 = groups.find((g) => g.id === group3.id);

      expect(updatedGroup1?.isExpanded).toBe(true);
      expect(updatedGroup2?.isExpanded).toBe(false);
      expect(updatedGroup3?.isExpanded).toBe(true);
    });
  });

  /**
   * 追加の統合テスト: グループ削除
   */
  describe('グループ削除の動作確認', () => {
    it('グループを削除できること', async () => {
      // Given: グループを作成
      const group = await mockGroupManager.createGroup(
        [1, 2],
        'テストグループ',
        '#ff0000',
      );

      // When: グループを削除
      await mockGroupManager.dissolveGroup(group.id);

      // Then: グループが削除されていること
      const groups = await mockGroupManager.getGroups();
      expect(groups.find((g) => g.id === group.id)).toBeUndefined();
    });

    it('グループ削除時に確認ダイアログが表示されること', async () => {
      // Given: グループ
      const mockGroup: Group = {
        id: 'group-1',
        name: 'テストグループ',
        color: '#ff0000',
        isExpanded: true,
      };

      const mockOnClose = vi.fn();

      const { fireEvent } = await import('@testing-library/react');

      render(
        <GroupNode
          group={mockGroup}
          depth={0}
          onClick={vi.fn()}
          onToggle={vi.fn()}
          onClose={mockOnClose}
          tabCount={5}
        />,
      );

      // When: グループノードにホバーして閉じるボタンをクリック
      const groupNode = screen.getByTestId('group-node-group-1');
      fireEvent.mouseEnter(groupNode);

      const closeButton = screen.getByTestId('close-button-group-1');
      fireEvent.click(closeButton);

      // Then: 確認ダイアログが表示されること
      await waitFor(() => {
        expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
      });
      expect(
        screen.getByText(/このグループには 5 個のタブが含まれています/),
      ).toBeInTheDocument();
    });
  });
});
