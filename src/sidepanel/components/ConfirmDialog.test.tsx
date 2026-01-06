import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

describe('ConfirmDialog', () => {
  const mockOnConfirm = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    mockOnConfirm.mockClear();
    mockOnCancel.mockClear();
  });

  it('should not render when isOpen is false', () => {
    render(
      <ConfirmDialog
        isOpen={false}
        title="Confirm"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByTestId('confirm-dialog')).not.toBeInTheDocument();
  });

  it('should render when isOpen is true', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm Action"
        message="Are you sure you want to proceed?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('confirm-dialog')).toBeInTheDocument();
    expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
  });

  it('should display tab count in message', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Close Group"
        message="This group contains 5 tabs."
        tabCount={5}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText('This group contains 5 tabs.')).toBeInTheDocument();
  });

  it('should call onConfirm when OK button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const confirmButton = screen.getByTestId('confirm-button');
    await user.click(confirmButton);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnCancel).not.toHaveBeenCalled();
  });

  it('should call onCancel when Cancel button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const cancelButton = screen.getByTestId('cancel-button');
    await user.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).not.toHaveBeenCalled();
  });

  it('should call onCancel when clicking outside the dialog', async () => {
    const user = userEvent.setup();

    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    const overlay = screen.getByTestId('dialog-overlay');
    await user.click(overlay);

    expect(mockOnCancel).toHaveBeenCalledTimes(1);
  });

  it('should have OK and Cancel buttons', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('confirm-button')).toBeInTheDocument();
    expect(screen.getByTestId('cancel-button')).toBeInTheDocument();
  });

  it('should display tab count when tabCount is provided', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Close Tabs"
        message="Do you want to close this tab and all its children?"
        tabCount={5}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByText(/5/)).toBeInTheDocument();
    expect(screen.getByTestId('tab-count-display')).toHaveTextContent('5');
  });

  it('should display correct singular form when tabCount is 1', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Close Tab"
        message="Do you want to close this tab?"
        tabCount={1}
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.getByTestId('tab-count-display')).toHaveTextContent('1');
  });

  it('should not display tab count when tabCount is not provided', () => {
    render(
      <ConfirmDialog
        isOpen={true}
        title="Confirm"
        message="Are you sure?"
        onConfirm={mockOnConfirm}
        onCancel={mockOnCancel}
      />
    );

    expect(screen.queryByTestId('tab-count-display')).not.toBeInTheDocument();
  });
});
