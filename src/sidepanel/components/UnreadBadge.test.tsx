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
    it('デフォルトでは小さな青い丸として表示される', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} />);

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveClass('bg-blue-500');
      expect(badge).toHaveClass('rounded-full');
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

  describe('カウント表示', () => {
    it('countが指定されている場合、カウントを表示する', () => {
      render(
        <UnreadBadge isUnread={true} showIndicator={true} count={5} />,
      );

      const countElement = screen.getByTestId('unread-count');
      expect(countElement).toHaveTextContent('5');
    });

    it('countが0の場合、カウントを表示しない', () => {
      render(
        <UnreadBadge isUnread={true} showIndicator={true} count={0} />,
      );

      const countElement = screen.queryByTestId('unread-count');
      expect(countElement).not.toBeInTheDocument();
    });

    it('countが未指定の場合、カウントを表示しない', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} />);

      const countElement = screen.queryByTestId('unread-count');
      expect(countElement).not.toBeInTheDocument();
    });

    it('countが99より大きい場合、"99+"と表示する', () => {
      render(
        <UnreadBadge isUnread={true} showIndicator={true} count={150} />,
      );

      const countElement = screen.getByTestId('unread-count');
      expect(countElement).toHaveTextContent('99+');
    });
  });

  describe('アクセシビリティ', () => {
    it('aria-labelが正しく設定される', () => {
      render(<UnreadBadge isUnread={true} showIndicator={true} />);

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveAttribute('aria-label', 'Unread');
    });

    it('カウント表示時にaria-labelが更新される', () => {
      render(
        <UnreadBadge isUnread={true} showIndicator={true} count={5} />,
      );

      const badge = screen.getByTestId('unread-badge');
      expect(badge).toHaveAttribute('aria-label', 'Unread (5)');
    });
  });
});
