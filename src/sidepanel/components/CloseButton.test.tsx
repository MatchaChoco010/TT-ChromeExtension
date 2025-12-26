import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CloseButton from './CloseButton';

describe('CloseButton', () => {
  it('閉じるボタンが表示されること', () => {
    render(<CloseButton onClose={vi.fn()} />);
    const button = screen.getByRole('button', { name: /close/i });
    expect(button).toBeInTheDocument();
  });

  it('クリック時に onClose コールバックが呼ばれること', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CloseButton onClose={onClose} />);

    const button = screen.getByRole('button', { name: /close/i });
    await user.click(button);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('クリックイベントが親要素に伝播しないこと', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onParentClick = vi.fn();

    const { container } = render(
      <div onClick={onParentClick}>
        <CloseButton onClose={onClose} />
      </div>
    );

    const button = screen.getByRole('button', { name: /close/i });
    await user.click(button);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onParentClick).not.toHaveBeenCalled();
  });
});
