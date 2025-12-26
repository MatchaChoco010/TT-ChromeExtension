import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { ContextMenu } from './ContextMenu';
import { useMenuActions } from '../hooks/useMenuActions';

// Chrome API のモック
global.chrome = {
  tabs: {
    remove: vi.fn(),
    duplicate: vi.fn(),
    update: vi.fn(),
    reload: vi.fn(),
    query: vi.fn(),
  },
  windows: {
    create: vi.fn(),
  },
  runtime: {
    sendMessage: vi.fn(),
  },
} as any;

/**
 * Task 15.2: MenuActions とメニュー項目の実装 - 統合テスト
 * Requirements: 12.2, 12.3, 12.4
 */
describe('ContextMenu Integration with MenuActions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Requirement 12.3: メニューから操作を選択すると対応するアクションが実行される', () => {
    it('「タブを閉じる」をクリックするとタブが閉じられる', async () => {
      const user = userEvent.setup();
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      (chrome.tabs.remove as any) = mockRemove;

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

      expect(mockRemove).toHaveBeenCalledWith([1, 2]);
    });

    it('「タブを複製」をクリックするとタブが複製される', async () => {
      const user = userEvent.setup();
      const mockDuplicate = vi.fn().mockResolvedValue({ id: 3 });
      (chrome.tabs.duplicate as any) = mockDuplicate;

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

      expect(mockDuplicate).toHaveBeenCalledWith(1);
    });

    it('「タブをピン留め」をクリックするとタブがピン留めされる', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn().mockResolvedValue({ id: 1, pinned: true });
      (chrome.tabs.update as any) = mockUpdate;

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

      expect(mockUpdate).toHaveBeenCalledWith(1, { pinned: true });
    });

    it('「ピン留めを解除」をクリックするとピン留めが解除される', async () => {
      const user = userEvent.setup();
      const mockUpdate = vi.fn().mockResolvedValue({ id: 1, pinned: false });
      (chrome.tabs.update as any) = mockUpdate;

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

      expect(mockUpdate).toHaveBeenCalledWith(1, { pinned: false });
    });

    it('「タブを再読み込み」をクリックするとタブが再読み込みされる', async () => {
      const user = userEvent.setup();
      const mockReload = vi.fn().mockResolvedValue(undefined);
      (chrome.tabs.reload as any) = mockReload;

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

      expect(mockReload).toHaveBeenCalledTimes(2);
      expect(mockReload).toHaveBeenNthCalledWith(1, 1);
      expect(mockReload).toHaveBeenNthCalledWith(2, 2);
    });

    it('「新しいウィンドウで開く」をクリックすると新しいウィンドウが作成される', async () => {
      const user = userEvent.setup();
      const mockCreate = vi.fn().mockResolvedValue({ id: 2 });
      (chrome.windows.create as any) = mockCreate;

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

      const newWindowButton = screen.getByRole('menuitem', {
        name: /新しいウィンドウで開く/,
      });
      await user.click(newWindowButton);

      expect(mockCreate).toHaveBeenCalledWith({ tabId: 1 });
    });

    it('「タブをグループ化」をクリックするとグループが作成される', async () => {
      const user = userEvent.setup();
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
      (chrome.runtime.sendMessage as any) = mockSendMessage;

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

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'CREATE_GROUP',
        payload: { tabIds: [1, 2, 3] },
      });
    });

    it('「グループを解除」をクリックするとグループが解除される', async () => {
      const user = userEvent.setup();
      const mockSendMessage = vi.fn().mockResolvedValue({ success: true });
      (chrome.runtime.sendMessage as any) = mockSendMessage;

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

      expect(mockSendMessage).toHaveBeenCalledWith({
        type: 'DISSOLVE_GROUP',
        payload: { tabIds: [1, 2] },
      });
    });

    it('「他のタブを閉じる」をクリックすると選択されたタブ以外が閉じられる', async () => {
      const user = userEvent.setup();
      const mockQuery = vi.fn().mockResolvedValue([
        { id: 1 },
        { id: 2 },
        { id: 3 },
        { id: 4 },
      ]);
      const mockRemove = vi.fn().mockResolvedValue(undefined);
      (chrome.tabs.query as any) = mockQuery;
      (chrome.tabs.remove as any) = mockRemove;

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

      expect(mockQuery).toHaveBeenCalledWith({ currentWindow: true });
      expect(mockRemove).toHaveBeenCalledWith([1, 4]);
    });
  });
});
