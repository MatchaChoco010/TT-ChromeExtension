import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import UnreadBadge from './UnreadBadge';

describe('UnreadBadge', () => {
  describe('基本的な表示', () => {
    it('未読の場合、バッジが表示される', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} />);

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('aria-label', 'Unread');
    });

    it('既読の場合、バッジが表示されない', () => {
      render(<UnreadBadge isUnread={false} showIndicator={true} />);

      const badge = screen.queryByTestId('unread-badge');
      expect(badge).not.toBeInTheDocument();
    });

    it('showIndicatorがfalseの場合、未読でもバッジが表示されない', () => {
      render(<UnreadBadge isUnread={true} showIndicator={false} />);

      const badge = screen.queryByTestId('unread-badge');
      expect(badge).not.toBeInTheDocument();
    });
  });

  describe('バッジのスタイル', () => {
    it('左下角の三角形切り欠きとして表示される', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} />);

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveStyle({
        width: '0',
        height: '0',
        borderStyle: 'solid',
      });
    });

    it('絶対位置指定で配置される', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} />);

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveStyle({
        position: 'absolute',
      });
    });

    it('カスタムクラスを適用できる', () => {
      render(
        <UnreadBadge
          isUnread={true}
          showIndicator={true}
          className="custom-class"
        />,
      );

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveClass('custom-class');
    });
  });

  describe('アクセシビリティ', () => {
    it('aria-labelが正しく設定される', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} />);

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveAttribute('aria-label', 'Unread');
    });
  });

  describe('depth対応', () => {
    it('depth=0の場合、左端に表示される（インデントなし）', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} depth={0} />);

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveStyle({
        left: '0px',
      });
    });

    it('depth=1の場合、20pxインデントされた位置に表示される', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} depth={1} />);

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveStyle({
        left: '20px',
      });
    });

    it('depth=2の場合、40pxインデントされた位置に表示される', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} depth={2} />);

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveStyle({
        left: '40px',
      });
    });

    it('depthが指定されない場合、デフォルトで左端に表示される', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} />);

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveStyle({
        left: '0px',
      });
    });
  });
});
