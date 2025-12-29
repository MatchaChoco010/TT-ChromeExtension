/**
 * 設定画面を新規タブで開くボタンのテスト
 * Task 8.2: 設定画面を新規タブで開く機能を実装する
 * Requirements: 5.1, 5.2, 5.4
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// chrome.tabs.create のモック
const mockChromeTabs = {
  create: vi.fn(),
};

const mockChromeRuntime = {
  getURL: vi.fn((path: string) => `chrome-extension://test-extension-id/${path}`),
};

// グローバル chrome オブジェクトのモック
beforeEach(() => {
  vi.stubGlobal('chrome', {
    tabs: mockChromeTabs,
    runtime: mockChromeRuntime,
  });
  mockChromeTabs.create.mockClear();
  mockChromeRuntime.getURL.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// OpenSettingsButton コンポーネントをインポート
import { OpenSettingsButton } from './OpenSettingsButton';

describe('OpenSettingsButton', () => {
  it('設定ボタンがレンダリングされる', () => {
    render(<OpenSettingsButton />);

    const button = screen.getByRole('button', { name: /設定/i });
    expect(button).toBeInTheDocument();
  });

  it('設定ボタンをクリックすると chrome.tabs.create が呼び出される', async () => {
    mockChromeTabs.create.mockResolvedValue({ id: 1 });

    render(<OpenSettingsButton />);

    const button = screen.getByRole('button', { name: /設定/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockChromeTabs.create).toHaveBeenCalledTimes(1);
    });
  });

  it('settings.html が新規タブで開かれる', async () => {
    mockChromeTabs.create.mockResolvedValue({ id: 1 });

    render(<OpenSettingsButton />);

    const button = screen.getByRole('button', { name: /設定/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockChromeRuntime.getURL).toHaveBeenCalledWith('settings.html');
      expect(mockChromeTabs.create).toHaveBeenCalledWith({
        url: 'chrome-extension://test-extension-id/settings.html',
      });
    });
  });

  it('test-idが設定される', () => {
    render(<OpenSettingsButton />);

    const button = screen.getByTestId('open-settings-button');
    expect(button).toBeInTheDocument();
  });
});

describe('openSettingsInNewTab utility', () => {
  it('chrome.runtime.getURL で settings.html の URL を取得する', async () => {
    mockChromeTabs.create.mockResolvedValue({ id: 1 });

    // openSettingsInNewTab をインポートしてテスト
    const { openSettingsInNewTab } = await import('./OpenSettingsButton');
    await openSettingsInNewTab();

    expect(mockChromeRuntime.getURL).toHaveBeenCalledWith('settings.html');
  });

  it('chrome.tabs.create で新規タブを作成する', async () => {
    mockChromeTabs.create.mockResolvedValue({ id: 1 });

    const { openSettingsInNewTab } = await import('./OpenSettingsButton');
    await openSettingsInNewTab();

    expect(mockChromeTabs.create).toHaveBeenCalledWith({
      url: 'chrome-extension://test-extension-id/settings.html',
    });
  });
});
