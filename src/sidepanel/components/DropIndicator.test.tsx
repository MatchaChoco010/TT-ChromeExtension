/**
 * DropIndicator コンポーネントのユニットテスト
 * Task 4.1: DropIndicatorコンポーネントを作成する
 * Requirements: 7.2, 8.4, 16.4
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DropIndicator from './DropIndicator';

describe('DropIndicator', () => {
  const defaultProps = {
    targetIndex: 0,
    targetDepth: 0,
    indentWidth: 20,
    isVisible: true,
  };

  describe('基本的なレンダリング', () => {
    it('isVisibleがtrueの場合、インジケーターを表示する', () => {
      render(<DropIndicator {...defaultProps} isVisible={true} />);

      const indicator = screen.getByTestId('drop-indicator');
      expect(indicator).toBeInTheDocument();
    });

    it('isVisibleがfalseの場合、インジケーターを非表示にする', () => {
      render(<DropIndicator {...defaultProps} isVisible={false} />);

      const indicator = screen.queryByTestId('drop-indicator');
      expect(indicator).not.toBeInTheDocument();
    });
  });

  describe('インデント位置の計算', () => {
    it('depth=0の場合、左端に配置される', () => {
      render(<DropIndicator {...defaultProps} targetDepth={0} />);

      const indicator = screen.getByTestId('drop-indicator');
      // containerPadding(8px) + depth(0) * indentWidth(20) = 8px
      expect(indicator).toHaveStyle({ left: '8px' });
    });

    it('depth=1の場合、インデント幅分オフセットされる', () => {
      render(<DropIndicator {...defaultProps} targetDepth={1} />);

      const indicator = screen.getByTestId('drop-indicator');
      // containerPadding(8px) + depth(1) * indentWidth(20) = 28px
      expect(indicator).toHaveStyle({ left: '28px' });
    });

    it('depth=2の場合、インデント幅の2倍オフセットされる', () => {
      render(<DropIndicator {...defaultProps} targetDepth={2} />);

      const indicator = screen.getByTestId('drop-indicator');
      // containerPadding(8px) + depth(2) * indentWidth(20) = 48px
      expect(indicator).toHaveStyle({ left: '48px' });
    });

    it('カスタムindentWidthが適用される', () => {
      render(<DropIndicator {...defaultProps} targetDepth={1} indentWidth={30} />);

      const indicator = screen.getByTestId('drop-indicator');
      // containerPadding(8px) + depth(1) * indentWidth(30) = 38px
      expect(indicator).toHaveStyle({ left: '38px' });
    });
  });

  describe('スタイル', () => {
    it('水平線のスタイル（高さ2px）を持つ', () => {
      render(<DropIndicator {...defaultProps} />);

      const indicator = screen.getByTestId('drop-indicator');
      expect(indicator).toHaveStyle({ height: '2px' });
    });

    it('アクセントカラーの背景を持つ', () => {
      render(<DropIndicator {...defaultProps} />);

      const indicator = screen.getByTestId('drop-indicator');
      // Tailwind CSSのbg-blue-500に相当するカラー
      expect(indicator).toHaveClass('bg-blue-500');
    });

    it('position: absoluteを持つ', () => {
      render(<DropIndicator {...defaultProps} />);

      const indicator = screen.getByTestId('drop-indicator');
      expect(indicator).toHaveClass('absolute');
    });
  });

  describe('表示位置', () => {
    it('targetIndexプロパティを持つ（親コンポーネントで位置計算に使用）', () => {
      render(<DropIndicator {...defaultProps} targetIndex={3} />);

      const indicator = screen.getByTestId('drop-indicator');
      expect(indicator).toHaveAttribute('data-target-index', '3');
    });

    it('targetDepthプロパティを持つ（親コンポーネントでdepth視覚化に使用）', () => {
      render(<DropIndicator {...defaultProps} targetDepth={2} />);

      const indicator = screen.getByTestId('drop-indicator');
      expect(indicator).toHaveAttribute('data-target-depth', '2');
    });
  });

  describe('containerPadding', () => {
    it('カスタムcontainerPaddingが適用される', () => {
      render(
        <DropIndicator
          {...defaultProps}
          targetDepth={1}
          containerPadding={12}
        />
      );

      const indicator = screen.getByTestId('drop-indicator');
      // containerPadding(12px) + depth(1) * indentWidth(20) = 32px
      expect(indicator).toHaveStyle({ left: '32px' });
    });
  });

  describe('アニメーション', () => {
    it('高速なマウス移動に対応するtransition効果を持つ', () => {
      render(<DropIndicator {...defaultProps} />);

      const indicator = screen.getByTestId('drop-indicator');
      // ちらつき防止のためのスムーズな遷移
      expect(indicator).toHaveClass('transition-all');
    });
  });

  describe('topPosition (Task 4.1)', () => {
    it('topPositionが指定された場合、正しいY座標にインジケーターが配置される', () => {
      render(<DropIndicator {...defaultProps} topPosition={100} />);

      const indicator = screen.getByTestId('drop-indicator');
      expect(indicator).toHaveStyle({ top: '100px' });
    });

    it('topPositionが0の場合、top: 0pxが適用される', () => {
      render(<DropIndicator {...defaultProps} topPosition={0} />);

      const indicator = screen.getByTestId('drop-indicator');
      expect(indicator).toHaveStyle({ top: '0px' });
    });

    it('topPositionが指定されない場合、topスタイルは適用されない', () => {
      render(<DropIndicator {...defaultProps} />);

      const indicator = screen.getByTestId('drop-indicator');
      // topPositionがundefinedの場合、topスタイルは設定されない
      expect(indicator.style.top).toBe('');
    });

    it('topPositionとdepthが両方指定された場合、両方のスタイルが適用される', () => {
      render(<DropIndicator {...defaultProps} targetDepth={2} topPosition={80} />);

      const indicator = screen.getByTestId('drop-indicator');
      // containerPadding(8px) + depth(2) * indentWidth(20) = 48px
      expect(indicator).toHaveStyle({ left: '48px', top: '80px' });
    });
  });
});
