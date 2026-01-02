/**
 * ViewContextMenu コンポーネントのテスト
 * ビューボタンの右クリックコンテキストメニューの実装
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { View } from '@/types';
import { ViewContextMenu } from './ViewContextMenu';

describe('ViewContextMenu', () => {
  const mockView: View = {
    id: 'view-1',
    name: 'Work',
    color: '#ef4444',
  };

  const defaultPosition = { x: 100, y: 100 };
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('基本的な表示', () => {
    it('コンテキストメニューが正しい位置に表示される', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const menu = screen.getByRole('menu');
      expect(menu).toBeInTheDocument();
      expect(menu).toHaveStyle({ left: '100px', top: '100px' });
    });

    it('ビューの編集オプションが表示される', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('menuitem', { name: /ビューを編集/i })).toBeInTheDocument();
    });

    it('ビューの削除オプションが表示される', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('menuitem', { name: /ビューを削除/i })).toBeInTheDocument();
    });
  });

  describe('右クリックでコンテキストメニュー表示', () => {
    it('メニュー項目が正しい順序で表示される', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems.length).toBe(2);
      expect(menuItems[0]).toHaveTextContent(/ビューを編集/i);
      expect(menuItems[1]).toHaveTextContent(/ビューを削除/i);
    });
  });

  describe('ビューの編集オプション', () => {
    it('ビューの編集をクリックするとonEditが呼ばれる', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const editButton = screen.getByRole('menuitem', { name: /ビューを編集/i });
      fireEvent.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(mockView);
      expect(mockOnEdit).toHaveBeenCalledTimes(1);
    });

    it('編集クリック後にメニューが閉じる', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const editButton = screen.getByRole('menuitem', { name: /ビューを編集/i });
      fireEvent.click(editButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('ビューの削除オプション', () => {
    it('ビューの削除をクリックするとonDeleteが呼ばれる', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const deleteButton = screen.getByRole('menuitem', { name: /ビューを削除/i });
      fireEvent.click(deleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith(mockView.id);
      expect(mockOnDelete).toHaveBeenCalledTimes(1);
    });

    it('削除クリック後にメニューが閉じる', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const deleteButton = screen.getByRole('menuitem', { name: /ビューを削除/i });
      fireEvent.click(deleteButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('最後のビューの場合は削除オプションが無効になる', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
          isLastView={true}
        />
      );

      const deleteButton = screen.getByRole('menuitem', { name: /ビューを削除/i });
      expect(deleteButton).toBeDisabled();
    });

    it('最後のビューでない場合は削除オプションが有効', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
          isLastView={false}
        />
      );

      const deleteButton = screen.getByRole('menuitem', { name: /ビューを削除/i });
      expect(deleteButton).not.toBeDisabled();
    });
  });

  describe('メニューのクローズ動作', () => {
    it('メニュー外をクリックするとonCloseが呼ばれる', async () => {
      const { container } = render(
        <div>
          <div data-testid="outside">Outside</div>
          <ViewContextMenu
            view={mockView}
            position={defaultPosition}
            onEdit={mockOnEdit}
            onDelete={mockOnDelete}
            onClose={mockOnClose}
          />
        </div>
      );

      // メニュー外クリックイベントを発火
      // 非同期でイベントリスナーが登録されるのを待つ
      await new Promise((resolve) => setTimeout(resolve, 10));

      const outsideElement = container.querySelector('[data-testid="outside"]');
      fireEvent.mouseDown(outsideElement!);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('Escapeキーを押すとonCloseが呼ばれる', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('画面端での位置調整', () => {
    it('右端を超える場合は左に調整される', () => {
      // ウィンドウ幅を設定
      Object.defineProperty(window, 'innerWidth', { value: 300, writable: true });

      render(
        <ViewContextMenu
          view={mockView}
          position={{ x: 250, y: 100 }}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const menu = screen.getByRole('menu');
      const style = menu.style;
      const leftValue = parseInt(style.left, 10);
      // メニュー幅（160px）+ マージン（10px）を考慮して調整される
      expect(leftValue).toBeLessThanOrEqual(250);
    });

    it('下端を超える場合は上に調整される', () => {
      // ウィンドウ高さを設定
      Object.defineProperty(window, 'innerHeight', { value: 200, writable: true });

      render(
        <ViewContextMenu
          view={mockView}
          position={{ x: 100, y: 180 }}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const menu = screen.getByRole('menu');
      const style = menu.style;
      const topValue = parseInt(style.top, 10);
      // メニュー高さ（80px）+ マージン（10px）を考慮して調整される
      expect(topValue).toBeLessThanOrEqual(180);
    });
  });

  describe('アクセシビリティ', () => {
    it('メニューにrole="menu"属性がある', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('各メニュー項目にrole="menuitem"属性がある', () => {
      render(
        <ViewContextMenu
          view={mockView}
          position={defaultPosition}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      );

      const menuItems = screen.getAllByRole('menuitem');
      expect(menuItems.length).toBeGreaterThan(0);
    });
  });
});
