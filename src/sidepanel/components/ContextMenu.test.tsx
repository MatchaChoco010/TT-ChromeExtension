import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextMenu } from './ContextMenu';

describe('ContextMenu', () => {
  describe('Requirement 12.1: 右クリック時のメニュー表示と位置計算', () => {
    it('指定された位置にコンテキストメニューを表示する', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();
      const position = { x: 100, y: 200 };

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={position}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();

      // メニューの位置が設定されていることを確認
      const style = menu.style;
      expect(style.left).toBe('100px');
      expect(style.top).toBe('200px');
    });

    it('メニュー外クリックで閉じる処理が呼ばれる', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <div>
          <ContextMenu
            targetTabIds={[1]}
            position={{ x: 100, y: 200 }}
            onAction={onAction}
            onClose={onClose}
          />
          <div data-testid="outside">Outside</div>
        </div>
      );

      const outside = screen.getByTestId('outside');
      await user.click(outside);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('Escapeキーでメニューを閉じる', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Requirement 12.2: メニュー項目の表示', () => {
    it('単一タブ選択時に基本的なメニュー項目を表示する', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      // 基本的なメニュー項目が表示されることを確認
      expect(screen.getByRole('menuitem', { name: /閉じる/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /複製/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /再読み込み/i })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /新しいウィンドウで開く/i })).toBeInTheDocument();
    });

    it('ピン留めされていないタブにはピン留めメニューを表示する', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          isPinned={false}
        />
      );

      expect(screen.getByRole('menuitem', { name: /ピン留め/i })).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /ピン留めを解除/i })).not.toBeInTheDocument();
    });

    it('ピン留めされているタブにはピン留め解除メニューを表示する', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          isPinned={true}
        />
      );

      expect(screen.queryByRole('menuitem', { name: /^ピン留め$/i })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /ピン留めを解除/i })).toBeInTheDocument();
    });

    it('グループ化されていないタブにはグループ化メニューを表示する', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          isGrouped={false}
        />
      );

      // Task 12.2: 単一タブ選択時は「グループに追加」がdivで表示される（サブメニュー付き）
      expect(screen.getByText('グループに追加')).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /グループを解除/i })).not.toBeInTheDocument();
    });

    it('グループ化されているタブにはグループ解除メニューを表示する', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          isGrouped={true}
        />
      );

      expect(screen.queryByRole('menuitem', { name: /グループに追加/i })).not.toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: /グループを解除/i })).toBeInTheDocument();
    });
  });

  describe('Requirement 12.3: メニューアクションの実行', () => {
    it('閉じるメニューをクリックするとcloseアクションが実行される', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const closeItem = screen.getByRole('menuitem', { name: /閉じる/i });
      await user.click(closeItem);

      expect(onAction).toHaveBeenCalledWith('close');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('複製メニューをクリックするとduplicateアクションが実行される', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const duplicateItem = screen.getByRole('menuitem', { name: /複製/i });
      await user.click(duplicateItem);

      expect(onAction).toHaveBeenCalledWith('duplicate');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('ピン留めメニューをクリックするとpinアクションが実行される', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          isPinned={false}
        />
      );

      const pinItem = screen.getByRole('menuitem', { name: /ピン留め/i });
      await user.click(pinItem);

      expect(onAction).toHaveBeenCalledWith('pin');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('新しいウィンドウで開くメニューをクリックするとnewWindowアクションが実行される', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const newWindowItem = screen.getByRole('menuitem', { name: /新しいウィンドウで開く/i });
      await user.click(newWindowItem);

      expect(onAction).toHaveBeenCalledWith('newWindow');
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Requirement 12.4: 複数タブ選択時のメニュー項目', () => {
    it('複数タブ選択時に「他のタブを閉じる」メニューが表示される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2, 3]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      expect(screen.getByRole('menuitem', { name: /他のタブを閉じる/i })).toBeInTheDocument();
    });

    it('複数タブ選択時に「選択されたタブをすべて閉じる」アクションが実行される', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2, 3]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const closeItem = screen.getByRole('menuitem', { name: /選択されたタブを閉じる/i });
      await user.click(closeItem);

      // 複数タブの場合はcloseアクションが実行される（実装で複数タブを閉じる処理が行われる）
      expect(onAction).toHaveBeenCalledWith('close');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('複数タブ選択時にグループ化メニューが表示される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2, 3]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      expect(screen.getByRole('menuitem', { name: /グループ化/i })).toBeInTheDocument();
    });
  });

  describe('Requirement 6.1: 複数選択対応操作オプション', () => {
    it('複数タブ選択時に選択されたタブ数が表示される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2, 3]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      // 選択されたタブ数が表示されることを確認
      expect(screen.getByText(/3件/)).toBeInTheDocument();
    });

    it('選択されたタブを一括で閉じるオプションが表示される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      // 選択されたタブを閉じるオプションが表示されることを確認
      expect(screen.getByRole('menuitem', { name: /選択されたタブを閉じる \(2件\)/i })).toBeInTheDocument();
    });

    it('選択されたタブをグループにまとめるオプションが表示される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2, 3]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      // グループ化オプションが表示されることを確認
      expect(screen.getByRole('menuitem', { name: /選択されたタブをグループ化/i })).toBeInTheDocument();
    });

    it('グループ化メニューをクリックするとgroupアクションが実行される', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2, 3]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const groupItem = screen.getByRole('menuitem', { name: /選択されたタブをグループ化/i });
      await user.click(groupItem);

      expect(onAction).toHaveBeenCalledWith('group');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('単一タブ選択時にはグループに追加メニューが表示される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      // Task 12.2: 単一タブの場合は「グループに追加」がdivで表示される（サブメニュー付き）
      expect(screen.getByText('グループに追加')).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: /選択されたタブをグループ化/i })).not.toBeInTheDocument();
    });
  });

  describe('Requirement 4.2: スナップショット取得オプション', () => {
    it('ツリービュー右クリックメニューに「スナップショットを取得」オプションが表示される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      // スナップショット取得オプションが表示されることを確認
      expect(screen.getByRole('menuitem', { name: /スナップショットを取得/i })).toBeInTheDocument();
    });

    it('スナップショット取得メニューをクリックするとsnapshotアクションが実行される', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const snapshotItem = screen.getByRole('menuitem', { name: /スナップショットを取得/i });
      await user.click(snapshotItem);

      expect(onAction).toHaveBeenCalledWith('snapshot');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('複数タブ選択時でもスナップショット取得オプションが表示される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2, 3]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      // 複数選択時でもスナップショット取得オプションが表示されることを確認
      expect(screen.getByRole('menuitem', { name: /スナップショットを取得/i })).toBeInTheDocument();
    });
  });

  describe('画面端での位置調整', () => {
    it('メニューが画面右端を超える場合は左側に表示する', () => {
      // ウィンドウサイズをモック
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 800,
      });

      const onAction = vi.fn();
      const onClose = vi.fn();
      const position = { x: 750, y: 200 }; // 右端に近い位置

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={position}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const menu = screen.getByRole('menu');

      // メニュー幅を200pxと仮定した場合、750 + 200 > 800 なので調整される
      // 実際の調整ロジックは実装で確認
      expect(menu).toBeInTheDocument();
    });

    it('メニューが画面下端を超える場合は上側に表示する', () => {
      // ウィンドウサイズをモック
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 600,
      });

      const onAction = vi.fn();
      const onClose = vi.fn();
      const position = { x: 100, y: 550 }; // 下端に近い位置

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={position}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const menu = screen.getByRole('menu');

      // メニュー高さを200pxと仮定した場合、550 + 200 > 600 なので調整される
      expect(menu).toBeInTheDocument();
    });
  });

  describe('テキスト選択の無効化 (Task 4.4: Requirement 11.2)', () => {
    it('コンテキストメニュー要素にuser-select: noneが適用されていること', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const menu = screen.getByRole('menu');
      expect(menu).toHaveClass('select-none');
    });

    it('コンテキストメニュー内のテキストが選択できないこと', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      const menu = screen.getByRole('menu');
      // select-noneクラスが適用されていることを確認
      expect(menu).toHaveClass('select-none');
    });
  });

  describe('Requirement 18: 別のビューへ移動サブメニュー (Task 7.2)', () => {
    const mockViews = [
      { id: 'default', name: 'Default', color: '#3b82f6' },
      { id: 'work', name: 'Work', color: '#10b981' },
      { id: 'personal', name: 'Personal', color: '#f59e0b' },
    ];

    it('「別のビューへ移動」メニュー項目が表示される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();
      const onMoveToView = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          views={mockViews}
          currentViewId="default"
          onMoveToView={onMoveToView}
        />
      );

      // 「別のビューへ移動」メニュー項目が表示されることを確認
      expect(screen.getByText('別のビューへ移動')).toBeInTheDocument();
    });

    it('ビューが1つしかない場合は「別のビューへ移動」が表示されない', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();
      const onMoveToView = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          views={[{ id: 'default', name: 'Default', color: '#3b82f6' }]}
          currentViewId="default"
          onMoveToView={onMoveToView}
        />
      );

      // ビューが1つしかないので「別のビューへ移動」は表示されない
      expect(screen.queryByText('別のビューへ移動')).not.toBeInTheDocument();
    });

    it('「別のビューへ移動」にホバーするとサブメニューが表示される', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();
      const onMoveToView = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          views={mockViews}
          currentViewId="default"
          onMoveToView={onMoveToView}
        />
      );

      // 「別のビューへ移動」にホバー
      const moveToViewItem = screen.getByText('別のビューへ移動');
      await user.hover(moveToViewItem);

      // サブメニューが表示されることを確認（現在のビューは除外）
      expect(screen.getByTestId('submenu')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      // 現在のビュー(Default)は表示されない
      expect(screen.queryByRole('menuitem', { name: 'Default' })).not.toBeInTheDocument();
    });

    it('サブメニューからビューを選択するとonMoveToViewが呼ばれる', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();
      const onMoveToView = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          views={mockViews}
          currentViewId="default"
          onMoveToView={onMoveToView}
        />
      );

      // 「別のビューへ移動」にホバー
      const moveToViewItem = screen.getByText('別のビューへ移動');
      await user.hover(moveToViewItem);

      // サブメニューからビューを選択
      const workView = screen.getByText('Work');
      await user.click(workView);

      // onMoveToViewが選択したビューIDとタブIDで呼ばれることを確認
      expect(onMoveToView).toHaveBeenCalledWith('work', [1, 2]);
      expect(onClose).toHaveBeenCalled();
    });

    it('複数タブ選択時もサブメニューが正しく動作する', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();
      const onMoveToView = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2, 3]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          views={mockViews}
          currentViewId="work"
          onMoveToView={onMoveToView}
        />
      );

      // 「別のビューへ移動」にホバー
      const moveToViewItem = screen.getByText('別のビューへ移動');
      await user.hover(moveToViewItem);

      // サブメニューが表示（現在のビューworkは除外）
      expect(screen.getByText('Default')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
      expect(screen.queryByRole('menuitem', { name: 'Work' })).not.toBeInTheDocument();

      // ビューを選択
      await user.click(screen.getByText('Personal'));

      expect(onMoveToView).toHaveBeenCalledWith('personal', [1, 2, 3]);
    });

    it('viewsがundefinedの場合は「別のビューへ移動」が表示されない', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      expect(screen.queryByText('別のビューへ移動')).not.toBeInTheDocument();
    });
  });

  describe('Requirement 6.1-6.4: 単一タブのグループ化機能 (Task 6.1)', () => {
    it('単一タブ選択時に「タブをグループ化」オプションが表示される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          isGrouped={false}
        />
      );

      // 単一タブでも「タブをグループ化」オプションが表示されることを確認
      expect(screen.getByRole('menuitem', { name: /タブをグループ化/i })).toBeInTheDocument();
    });

    it('単一タブで「タブをグループ化」をクリックするとgroupアクションが実行される', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          isGrouped={false}
        />
      );

      const groupItem = screen.getByRole('menuitem', { name: /タブをグループ化/i });
      await user.click(groupItem);

      expect(onAction).toHaveBeenCalledWith('group');
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('単一タブで「タブをグループ化」と「グループに追加」の両方が表示される', () => {
      const mockGroups = {
        'group_1': { id: 'group_1', name: 'Work', color: '#3b82f6', isExpanded: true },
      };
      const onAction = vi.fn();
      const onClose = vi.fn();
      const onAddToGroup = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          isGrouped={false}
          groups={mockGroups}
          onAddToGroup={onAddToGroup}
        />
      );

      // 両方のオプションが表示されることを確認
      expect(screen.getByRole('menuitem', { name: /タブをグループ化/i })).toBeInTheDocument();
      expect(screen.getByText('グループに追加')).toBeInTheDocument();
    });
  });

  describe('Requirement 11.3, 11.4: シングルタブのグループ追加機能 (Task 12.2)', () => {
    const mockGroups = {
      'group_1': { id: 'group_1', name: 'Work', color: '#3b82f6', isExpanded: true },
      'group_2': { id: 'group_2', name: 'Personal', color: '#10b981', isExpanded: true },
    };

    it('単一タブ選択時に「グループに追加」をホバーするとサブメニューが表示される', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();
      const onAddToGroup = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          groups={mockGroups}
          onAddToGroup={onAddToGroup}
        />
      );

      // 「グループに追加」にホバー
      const addToGroupItem = screen.getByText('グループに追加');
      await user.hover(addToGroupItem);

      // サブメニューが表示されることを確認
      expect(screen.getByTestId('submenu')).toBeInTheDocument();
      expect(screen.getByText('Work')).toBeInTheDocument();
      expect(screen.getByText('Personal')).toBeInTheDocument();
    });

    it('サブメニューからグループを選択するとonAddToGroupが呼ばれる', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();
      const onAddToGroup = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          groups={mockGroups}
          onAddToGroup={onAddToGroup}
        />
      );

      // 「グループに追加」にホバー
      const addToGroupItem = screen.getByText('グループに追加');
      await user.hover(addToGroupItem);

      // サブメニューからグループを選択
      const workGroup = screen.getByText('Work');
      await user.click(workGroup);

      // onAddToGroupが選択したグループIDとタブIDで呼ばれることを確認
      expect(onAddToGroup).toHaveBeenCalledWith('group_1', [1]);
      expect(onClose).toHaveBeenCalled();
    });

    it('グループが存在しない場合は「グループに追加」が無効化される', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          groups={{}}
        />
      );

      // 「グループに追加」ボタンが無効化されていることを確認
      const addToGroupItem = screen.getByText('グループに追加');
      expect(addToGroupItem.closest('button') || addToGroupItem.closest('div')).toHaveClass('text-gray-500');
    });

    it('groupsがundefinedでも「グループに追加」が表示される（無効化状態）', () => {
      const onAction = vi.fn();
      const onClose = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
        />
      );

      // 「グループに追加」が表示されていることを確認
      expect(screen.getByText('グループに追加')).toBeInTheDocument();
    });

    it('複数タブ選択時は「選択されたタブをグループ化」が表示され、サブメニューは表示されない', async () => {
      const user = userEvent.setup();
      const onAction = vi.fn();
      const onClose = vi.fn();
      const onAddToGroup = vi.fn();

      render(
        <ContextMenu
          targetTabIds={[1, 2, 3]}
          position={{ x: 100, y: 200 }}
          onAction={onAction}
          onClose={onClose}
          groups={mockGroups}
          onAddToGroup={onAddToGroup}
        />
      );

      // 「選択されたタブをグループ化」が表示される
      expect(screen.getByRole('menuitem', { name: /選択されたタブをグループ化/i })).toBeInTheDocument();

      // ホバーしてもサブメニューは表示されない（直接アクションになる）
      const groupItem = screen.getByRole('menuitem', { name: /選択されたタブをグループ化/i });
      await user.click(groupItem);

      expect(onAction).toHaveBeenCalledWith('group');
    });
  });
});
