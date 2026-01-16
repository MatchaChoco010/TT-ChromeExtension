import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ContextMenu } from './ContextMenu';
import { useMenuActions } from '../hooks/useMenuActions';
import { chromeMock } from '@/test/chrome-mock';

/**
 * MenuActions とメニュー項目の実装 - 統合テスト
 */
describe('ContextMenu Integration with MenuActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chromeMock.clearAllListeners();
  });

  describe('メニューから操作を選択すると対応するアクションが実行される', () => {
    it('「タブを閉じる」をクリックするとタブが閉じられる', async () => {
      const user = userEvent.setup();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const ContextMenuWrapper = () => {
        const { executeAction } = useMenuActions();
        const [menuOpen, setMenuOpen] = React.useState(true);

        return menuOpen ? (
          <ContextMenu
            targetTabIds={[1, 2]}
            position={{ x: 100, y: 100 }}
            onAction={async (action) => {
              await executeAction(action, [1, 2]);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
          />
        ) : null;
      };

      render(<ContextMenuWrapper />);

      const closeButton = screen.getByRole('menuitem', {
        name: /選択されたタブを閉じる/,
      });
      await user.click(closeButton);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CLOSE_TABS_WITH_COLLAPSED_SUBTREES',
        payload: { tabIds: [1, 2] },
      });
    });

    it('「タブを複製」をクリックするとタブが複製される', async () => {
      const user = userEvent.setup();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const ContextMenuWrapper = () => {
        const { executeAction } = useMenuActions();
        const [menuOpen, setMenuOpen] = React.useState(true);

        return menuOpen ? (
          <ContextMenu
            targetTabIds={[1]}
            position={{ x: 100, y: 100 }}
            onAction={async (action) => {
              await executeAction(action, [1]);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
          />
        ) : null;
      };

      render(<ContextMenuWrapper />);

      const duplicateButton = screen.getByRole('menuitem', {
        name: /タブを複製/,
      });
      await user.click(duplicateButton);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DUPLICATE_TABS',
        payload: { tabIds: [1] },
      });
    });

    it('「タブをピン留め」をクリックするとタブがピン留めされる', async () => {
      const user = userEvent.setup();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const ContextMenuWrapper = () => {
        const { executeAction } = useMenuActions();
        const [menuOpen, setMenuOpen] = React.useState(true);

        return menuOpen ? (
          <ContextMenu
            targetTabIds={[1]}
            position={{ x: 100, y: 100 }}
            onAction={async (action) => {
              await executeAction(action, [1]);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
            isPinned={false}
          />
        ) : null;
      };

      render(<ContextMenuWrapper />);

      const pinButton = screen.getByRole('menuitem', {
        name: /タブをピン留め/,
      });
      await user.click(pinButton);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'PIN_TABS',
        payload: { tabIds: [1] },
      });
    });

    it('「ピン留めを解除」をクリックするとピン留めが解除される', async () => {
      const user = userEvent.setup();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const ContextMenuWrapper = () => {
        const { executeAction } = useMenuActions();
        const [menuOpen, setMenuOpen] = React.useState(true);

        return menuOpen ? (
          <ContextMenu
            targetTabIds={[1]}
            position={{ x: 100, y: 100 }}
            onAction={async (action) => {
              await executeAction(action, [1]);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
            isPinned={true}
          />
        ) : null;
      };

      render(<ContextMenuWrapper />);

      const unpinButton = screen.getByRole('menuitem', {
        name: /ピン留めを解除/,
      });
      await user.click(unpinButton);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'UNPIN_TABS',
        payload: { tabIds: [1] },
      });
    });

    it('「タブを再読み込み」をクリックするとタブが再読み込みされる', async () => {
      const user = userEvent.setup();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const ContextMenuWrapper = () => {
        const { executeAction } = useMenuActions();
        const [menuOpen, setMenuOpen] = React.useState(true);

        return menuOpen ? (
          <ContextMenu
            targetTabIds={[1, 2]}
            position={{ x: 100, y: 100 }}
            onAction={async (action) => {
              await executeAction(action, [1, 2]);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
          />
        ) : null;
      };

      render(<ContextMenuWrapper />);

      const reloadButton = screen.getByRole('menuitem', {
        name: /タブを再読み込み/,
      });
      await user.click(reloadButton);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'RELOAD_TABS',
        payload: { tabIds: [1, 2] },
      });
    });

    it('「別のウィンドウに移動」サブメニューから「新しいウィンドウ」をクリックすると新しいウィンドウが作成される', async () => {
      const user = userEvent.setup();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const ContextMenuWrapper = () => {
        const { executeAction } = useMenuActions();
        const [menuOpen, setMenuOpen] = React.useState(true);

        return menuOpen ? (
          <ContextMenu
            targetTabIds={[1]}
            position={{ x: 100, y: 100 }}
            onAction={async (action) => {
              await executeAction(action, [1]);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
          />
        ) : null;
      };

      render(<ContextMenuWrapper />);

      // 別のウィンドウに移動のサブメニュートリガーにホバー
      const moveToWindowItem = screen.getByTestId('context-menu-move-to-window');
      await user.hover(moveToWindowItem);

      // サブメニューが表示されるのを待つ
      const newWindowSubItem = await screen.findByText('新しいウィンドウ');
      await user.click(newWindowSubItem);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'MOVE_TABS_TO_NEW_WINDOW',
        payload: { tabIds: [1] },
      });
    });

    it('「タブをグループ化」をクリックするとグループが作成される', async () => {
      const user = userEvent.setup();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const ContextMenuWrapper = () => {
        const { executeAction } = useMenuActions();
        const [menuOpen, setMenuOpen] = React.useState(true);

        return menuOpen ? (
          <ContextMenu
            targetTabIds={[1, 2, 3]}
            position={{ x: 100, y: 100 }}
            onAction={async (action) => {
              await executeAction(action, [1, 2, 3]);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
            isGrouped={false}
          />
        ) : null;
      };

      render(<ContextMenuWrapper />);

      const groupButton = screen.getByRole('menuitem', {
        name: /タブをグループ化/,
      });
      await user.click(groupButton);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CREATE_GROUP',
        payload: { tabIds: [1, 2, 3] },
      });
    });

    it('「グループを解除」をクリックするとグループが解除される', async () => {
      const user = userEvent.setup();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const ContextMenuWrapper = () => {
        const { executeAction } = useMenuActions();
        const [menuOpen, setMenuOpen] = React.useState(true);

        return menuOpen ? (
          <ContextMenu
            targetTabIds={[1, 2]}
            position={{ x: 100, y: 100 }}
            onAction={async (action) => {
              await executeAction(action, [1, 2]);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
            isGrouped={true}
          />
        ) : null;
      };

      render(<ContextMenuWrapper />);

      const ungroupButton = screen.getByRole('menuitem', {
        name: /グループを解除/,
      });
      await user.click(ungroupButton);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'DISSOLVE_GROUP',
        payload: { tabIds: [1, 2] },
      });
    });

    it('「他のタブを閉じる」をクリックすると選択されたタブ以外が閉じられる', async () => {
      const user = userEvent.setup();
      chromeMock.runtime.sendMessage.mockResolvedValue({ success: true });

      const ContextMenuWrapper = () => {
        const { executeAction } = useMenuActions();
        const [menuOpen, setMenuOpen] = React.useState(true);

        return menuOpen ? (
          <ContextMenu
            targetTabIds={[2, 3]}
            position={{ x: 100, y: 100 }}
            onAction={async (action) => {
              await executeAction(action, [2, 3]);
              setMenuOpen(false);
            }}
            onClose={() => setMenuOpen(false)}
          />
        ) : null;
      };

      render(<ContextMenuWrapper />);

      const closeOthersButton = screen.getByRole('menuitem', {
        name: /他のタブを閉じる/,
      });
      await user.click(closeOthersButton);

      expect(chromeMock.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'CLOSE_OTHER_TABS',
        payload: { excludeTabIds: [2, 3] },
      });
    });
  });
});
