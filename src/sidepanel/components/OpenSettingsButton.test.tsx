import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const mockSendMessage = vi.fn();

beforeEach(() => {
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage: mockSendMessage,
    },
  });
  mockSendMessage.mockClear();
  mockSendMessage.mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

import { OpenSettingsButton, openSettingsInNewTab } from './OpenSettingsButton';

describe('OpenSettingsButton', () => {
  it('設定ボタンがレンダリングされる', () => {
    render(<OpenSettingsButton />);

    const button = screen.getByRole('button', { name: /設定/i });
    expect(button).toBeInTheDocument();
  });

  it('設定ボタンをクリックすると chrome.runtime.sendMessage が呼び出される', async () => {
    render(<OpenSettingsButton />);

    const button = screen.getByRole('button', { name: /設定/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledTimes(1);
    });
  });

  it('OPEN_SETTINGS_TAB メッセージが送信される', async () => {
    render(<OpenSettingsButton />);

    const button = screen.getByRole('button', { name: /設定/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSendMessage).toHaveBeenCalledWith({ type: 'OPEN_SETTINGS_TAB' });
    });
  });

  it('test-idが設定される', () => {
    render(<OpenSettingsButton />);

    const button = screen.getByTestId('open-settings-button');
    expect(button).toBeInTheDocument();
  });
});

describe('openSettingsInNewTab utility', () => {
  it('OPEN_SETTINGS_TAB メッセージを送信する', async () => {
    await openSettingsInNewTab();

    expect(mockSendMessage).toHaveBeenCalledWith({ type: 'OPEN_SETTINGS_TAB' });
  });

  it('chrome.runtime.sendMessage を1回呼び出す', async () => {
    await openSettingsInNewTab();

    expect(mockSendMessage).toHaveBeenCalledTimes(1);
  });
});
