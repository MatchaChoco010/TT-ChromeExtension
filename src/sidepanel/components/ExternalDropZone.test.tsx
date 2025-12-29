import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ExternalDropZone from './ExternalDropZone';

describe('ExternalDropZone', () => {
  describe('表示状態', () => {
    it('ドラッグ中でない場合はドロップエリアが非アクティブ状態で表示される', () => {
      const onDrop = vi.fn();
      render(<ExternalDropZone isDragging={false} onDrop={onDrop} />);

      const dropZone = screen.getByTestId('external-drop-zone');
      expect(dropZone).toBeInTheDocument();
      // 非アクティブ状態を確認（視覚的に目立たない）
      expect(dropZone).toHaveClass('opacity-0');
    });

    it('ドラッグ中はドロップエリアがアクティブ状態で表示される', () => {
      const onDrop = vi.fn();
      render(<ExternalDropZone isDragging={true} onDrop={onDrop} />);

      const dropZone = screen.getByTestId('external-drop-zone');
      expect(dropZone).toBeInTheDocument();
      // アクティブ状態を確認（視覚的に目立つ）
      expect(dropZone).not.toHaveClass('opacity-0');
      expect(dropZone).toHaveClass('opacity-100');
    });

    it('ドラッグ中はドロップ可能であることを示すテキストが表示される', () => {
      const onDrop = vi.fn();
      render(<ExternalDropZone isDragging={true} onDrop={onDrop} />);

      // ドロップ可能であることを示すメッセージ
      expect(screen.getByText(/新しいウィンドウで開く/)).toBeInTheDocument();
    });
  });

  describe('ドロップ機能', () => {
    it('ドロップ時にonDropコールバックが呼び出される', () => {
      const onDrop = vi.fn();
      render(<ExternalDropZone isDragging={true} onDrop={onDrop} />);

      const dropZone = screen.getByTestId('external-drop-zone');

      // ドロップイベントをシミュレート（fireEventを使用）
      fireEvent.drop(dropZone);

      // onDropが呼び出されることを確認
      expect(onDrop).toHaveBeenCalled();
    });

    it('dragEnter時にホバー状態になる', () => {
      const onDrop = vi.fn();
      render(<ExternalDropZone isDragging={true} onDrop={onDrop} />);

      const dropZone = screen.getByTestId('external-drop-zone');

      // dragEnterイベントをシミュレート（fireEventを使用）
      fireEvent.dragEnter(dropZone);

      // ホバー状態のスタイルを確認（ダークテーマ）
      expect(dropZone).toHaveClass('bg-gray-700');
    });

    it('dragLeave時にホバー状態が解除される', () => {
      const onDrop = vi.fn();
      render(<ExternalDropZone isDragging={true} onDrop={onDrop} />);

      const dropZone = screen.getByTestId('external-drop-zone');

      // dragEnterイベントをシミュレート
      fireEvent.dragEnter(dropZone);

      // ホバー状態を確認（ダークテーマ）
      expect(dropZone).toHaveClass('bg-gray-700');

      // dragLeaveイベントをシミュレート
      fireEvent.dragLeave(dropZone);

      // ホバー状態が解除されていることを確認
      expect(dropZone).not.toHaveClass('bg-gray-700');
    });
  });

  describe('スタイル', () => {
    it('ドロップエリアはツリービュー下部に配置される', () => {
      const onDrop = vi.fn();
      render(<ExternalDropZone isDragging={true} onDrop={onDrop} />);

      const dropZone = screen.getByTestId('external-drop-zone');
      // ツリービュー下部に配置されるためのスタイルを確認
      expect(dropZone).toHaveClass('w-full');
      expect(dropZone).toHaveClass('min-h-[60px]');
    });

    it('ドラッグ中のアクティブ状態ではボーダーが点線で表示される', () => {
      const onDrop = vi.fn();
      render(<ExternalDropZone isDragging={true} onDrop={onDrop} />);

      const dropZone = screen.getByTestId('external-drop-zone');
      expect(dropZone).toHaveClass('border-dashed');
      expect(dropZone).toHaveClass('border-2');
    });
  });

  describe('アクセシビリティ', () => {
    it('適切なaria属性が設定されている', () => {
      const onDrop = vi.fn();
      render(<ExternalDropZone isDragging={true} onDrop={onDrop} />);

      const dropZone = screen.getByTestId('external-drop-zone');
      expect(dropZone).toHaveAttribute('aria-dropeffect', 'move');
    });

    it('ドラッグ中でない場合はaria-hiddenがtrueになる', () => {
      const onDrop = vi.fn();
      render(<ExternalDropZone isDragging={false} onDrop={onDrop} />);

      const dropZone = screen.getByTestId('external-drop-zone');
      expect(dropZone).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
