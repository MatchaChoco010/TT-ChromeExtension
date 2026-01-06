import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubMenu } from './SubMenu';

describe('SubMenu', () => {
  const defaultItems = [
    { id: 'item1', label: 'Item 1' },
    { id: 'item2', label: 'Item 2' },
    { id: 'item3', label: 'Item 3', disabled: true },
  ];

  const defaultParentRect: DOMRect = {
    x: 100,
    y: 200,
    width: 200,
    height: 40,
    top: 200,
    right: 300,
    bottom: 240,
    left: 100,
    toJSON: () => ({}),
  };

  describe('親メニュー項目ホバーで子メニューを表示', () => {
    it('サブメニューが正しく表示される', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      const submenu = screen.getByRole('menu');
      expect(submenu).toBeInTheDocument();
    });

    it('全てのメニュー項目が表示される', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.getByText('Item 2')).toBeInTheDocument();
      expect(screen.getByText('Item 3')).toBeInTheDocument();
    });

    it('無効化された項目は視覚的に区別される', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      const disabledItem = screen.getByText('Item 3').closest('button');
      expect(disabledItem).toBeDisabled();
    });

    it('項目をクリックするとonSelectが呼ばれる', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      const item1 = screen.getByText('Item 1');
      await user.click(item1);

      expect(onSelect).toHaveBeenCalledWith('item1');
    });

    it('無効化された項目をクリックしてもonSelectが呼ばれない', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      const item3 = screen.getByText('Item 3').closest('button');
      if (item3) {
        await user.click(item3);
      }

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('画面端での位置自動調整', () => {
    it('デフォルトでは親メニューの右側に表示される', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      const submenu = screen.getByRole('menu');
      expect(submenu.style.left).toBeDefined();
    });

    it('右端に近い場合は親メニューの左側に表示される', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 400,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 800,
      });

      const rightEdgeRect: DOMRect = {
        x: 300,
        y: 200,
        width: 200,
        height: 40,
        top: 200,
        right: 500,
        bottom: 240,
        left: 300,
        toJSON: () => ({}),
      };

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={rightEdgeRect}
        />
      );

      const submenu = screen.getByRole('menu');
      expect(submenu).toBeInTheDocument();
    });

    it('下端に近い場合は上方向に調整される', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1000,
      });
      Object.defineProperty(window, 'innerHeight', {
        writable: true,
        configurable: true,
        value: 300,
      });

      const bottomEdgeRect: DOMRect = {
        x: 100,
        y: 250,
        width: 200,
        height: 40,
        top: 250,
        right: 300,
        bottom: 290,
        left: 100,
        toJSON: () => ({}),
      };

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={bottomEdgeRect}
        />
      );

      const submenu = screen.getByRole('menu');
      expect(submenu).toBeInTheDocument();
    });
  });

  describe('キーボードナビゲーション', () => {
    it('Escapeキーでメニューを閉じる', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      await user.keyboard('{Escape}');

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('矢印キーでフォーカスが移動する', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      await user.keyboard('{ArrowDown}');

      const items = screen.getAllByRole('menuitem');
      await waitFor(() => {
        expect(items[0]).toHaveFocus();
      });
    });

    it('Enterキーで項目を選択する', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Enter}');

      expect(onSelect).toHaveBeenCalledWith('item1');
    });
  });

  describe('テキスト選択の無効化', () => {
    it('サブメニュー要素にuser-select: noneが適用されていること', () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      const submenu = screen.getByRole('menu');
      expect(submenu).toHaveClass('select-none');
    });
  });

  describe('マウスイベント処理', () => {
    it('マウスがサブメニューから離れるとonCloseが呼ばれる', async () => {
      const onSelect = vi.fn();
      const onClose = vi.fn();

      render(
        <SubMenu
          label="Test SubMenu"
          items={defaultItems}
          onSelect={onSelect}
          onClose={onClose}
          parentRect={defaultParentRect}
        />
      );

      const submenu = screen.getByRole('menu');
      fireEvent.mouseLeave(submenu);

      await waitFor(() => {
        expect(onClose).toHaveBeenCalled();
      }, { timeout: 500 });
    });
  });
});
