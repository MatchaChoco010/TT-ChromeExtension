/**
 * DragOverlayコンポーネントのテスト
 *
 * ドラッグ中の要素をマウスカーソルに追従させること
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DragOverlay } from './DragOverlay';

describe('DragOverlay', () => {
  describe('表示制御', () => {
    it('isDragging=falseの場合、何もレンダリングしない', () => {
      render(
        <DragOverlay
          isDragging={false}
          position={{ x: 100, y: 200 }}
          offset={{ x: 10, y: 10 }}
        >
          <div data-testid="drag-content">ドラッグ中のコンテンツ</div>
        </DragOverlay>
      );

      expect(document.querySelector('[data-testid="drag-overlay"]')).toBeNull();
      expect(screen.queryByTestId('drag-content')).toBeNull();
    });

    it('isDragging=trueの場合、子要素をレンダリングする', () => {
      render(
        <DragOverlay
          isDragging={true}
          position={{ x: 100, y: 200 }}
          offset={{ x: 10, y: 10 }}
        >
          <div data-testid="drag-content">ドラッグ中のコンテンツ</div>
        </DragOverlay>
      );

      expect(document.querySelector('[data-testid="drag-overlay"]')).not.toBeNull();
      expect(screen.getByTestId('drag-content')).toBeInTheDocument();
      expect(screen.getByText('ドラッグ中のコンテンツ')).toBeInTheDocument();
    });
  });

  describe('位置計算', () => {
    it('position - offset の位置にtransformで配置される', () => {
      render(
        <DragOverlay
          isDragging={true}
          position={{ x: 150, y: 250 }}
          offset={{ x: 20, y: 30 }}
        >
          <div>コンテンツ</div>
        </DragOverlay>
      );

      const overlay = document.querySelector('[data-testid="drag-overlay"]') as HTMLElement;
      expect(overlay).not.toBeNull();

      const style = overlay.style;
      expect(style.transform).toBe('translate3d(130px, 220px, 0px)');
    });

    it('offsetが0の場合、positionそのままの位置に配置される', () => {
      render(
        <DragOverlay
          isDragging={true}
          position={{ x: 100, y: 200 }}
          offset={{ x: 0, y: 0 }}
        >
          <div>コンテンツ</div>
        </DragOverlay>
      );

      const overlay = document.querySelector('[data-testid="drag-overlay"]') as HTMLElement;
      expect(overlay.style.transform).toBe('translate3d(100px, 200px, 0px)');
    });

    it('負のoffsetでも正しく計算される', () => {
      render(
        <DragOverlay
          isDragging={true}
          position={{ x: 50, y: 50 }}
          offset={{ x: -10, y: -20 }}
        >
          <div>コンテンツ</div>
        </DragOverlay>
      );

      const overlay = document.querySelector('[data-testid="drag-overlay"]') as HTMLElement;
      expect(overlay.style.transform).toBe('translate3d(60px, 70px, 0px)');
    });
  });

  describe('スタイル', () => {
    it('pointer-events: noneが設定されている', () => {
      render(
        <DragOverlay
          isDragging={true}
          position={{ x: 100, y: 200 }}
          offset={{ x: 0, y: 0 }}
        >
          <div>コンテンツ</div>
        </DragOverlay>
      );

      const overlay = document.querySelector('[data-testid="drag-overlay"]') as HTMLElement;
      expect(overlay.style.pointerEvents).toBe('none');
    });

    it('position: fixedが設定されている', () => {
      render(
        <DragOverlay
          isDragging={true}
          position={{ x: 100, y: 200 }}
          offset={{ x: 0, y: 0 }}
        >
          <div>コンテンツ</div>
        </DragOverlay>
      );

      const overlay = document.querySelector('[data-testid="drag-overlay"]') as HTMLElement;
      expect(overlay.style.position).toBe('fixed');
    });

    it('高いz-indexが設定されている', () => {
      render(
        <DragOverlay
          isDragging={true}
          position={{ x: 100, y: 200 }}
          offset={{ x: 0, y: 0 }}
        >
          <div>コンテンツ</div>
        </DragOverlay>
      );

      const overlay = document.querySelector('[data-testid="drag-overlay"]') as HTMLElement;
      const zIndex = parseInt(overlay.style.zIndex, 10);
      expect(zIndex).toBeGreaterThanOrEqual(9999);
    });

    it('willChange: transformが設定されている（パフォーマンス最適化）', () => {
      render(
        <DragOverlay
          isDragging={true}
          position={{ x: 100, y: 200 }}
          offset={{ x: 0, y: 0 }}
        >
          <div>コンテンツ</div>
        </DragOverlay>
      );

      const overlay = document.querySelector('[data-testid="drag-overlay"]') as HTMLElement;
      expect(overlay.style.willChange).toBe('transform');
    });
  });

  describe('Portalレンダリング', () => {
    it('document.body直下にレンダリングされる', () => {
      render(
        <div data-testid="parent-container">
          <DragOverlay
            isDragging={true}
            position={{ x: 100, y: 200 }}
            offset={{ x: 0, y: 0 }}
          >
            <div data-testid="drag-content">コンテンツ</div>
          </DragOverlay>
        </div>
      );

      const overlay = document.querySelector('[data-testid="drag-overlay"]');
      const parentContainer = screen.getByTestId('parent-container');

      expect(parentContainer.contains(overlay)).toBe(false);

      expect(overlay?.parentElement).toBe(document.body);
    });
  });

  describe('子要素のレンダリング', () => {
    it('複数の子要素をレンダリングできる', () => {
      render(
        <DragOverlay
          isDragging={true}
          position={{ x: 100, y: 200 }}
          offset={{ x: 0, y: 0 }}
        >
          <div data-testid="child-1">子要素1</div>
          <div data-testid="child-2">子要素2</div>
        </DragOverlay>
      );

      expect(screen.getByTestId('child-1')).toBeInTheDocument();
      expect(screen.getByTestId('child-2')).toBeInTheDocument();
    });

    it('nullの子要素も受け入れる', () => {
      render(
        <DragOverlay
          isDragging={true}
          position={{ x: 100, y: 200 }}
          offset={{ x: 0, y: 0 }}
        >
          {null}
        </DragOverlay>
      );

      const overlay = document.querySelector('[data-testid="drag-overlay"]');
      expect(overlay).not.toBeNull();
    });
  });

  describe('状態変更時の動作', () => {
    it('isDraggingがtrueからfalseに変わったらアンマウントされる', () => {
      const { rerender } = render(
        <DragOverlay
          isDragging={true}
          position={{ x: 100, y: 200 }}
          offset={{ x: 0, y: 0 }}
        >
          <div data-testid="drag-content">コンテンツ</div>
        </DragOverlay>
      );

      expect(document.querySelector('[data-testid="drag-overlay"]')).not.toBeNull();

      rerender(
        <DragOverlay
          isDragging={false}
          position={{ x: 100, y: 200 }}
          offset={{ x: 0, y: 0 }}
        >
          <div data-testid="drag-content">コンテンツ</div>
        </DragOverlay>
      );

      expect(document.querySelector('[data-testid="drag-overlay"]')).toBeNull();
    });

    it('positionが変更されたらtransformが更新される', () => {
      const { rerender } = render(
        <DragOverlay
          isDragging={true}
          position={{ x: 100, y: 200 }}
          offset={{ x: 0, y: 0 }}
        >
          <div>コンテンツ</div>
        </DragOverlay>
      );

      const overlay = document.querySelector('[data-testid="drag-overlay"]') as HTMLElement;
      expect(overlay.style.transform).toBe('translate3d(100px, 200px, 0px)');

      rerender(
        <DragOverlay
          isDragging={true}
          position={{ x: 300, y: 400 }}
          offset={{ x: 0, y: 0 }}
        >
          <div>コンテンツ</div>
        </DragOverlay>
      );

      expect(overlay.style.transform).toBe('translate3d(300px, 400px, 0px)');
    });
  });
});
