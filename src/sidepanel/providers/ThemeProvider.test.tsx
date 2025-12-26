/**
 * ThemeProvider テスト
 *
 * Requirements:
 * - 10.4: カスタムCSSファイルのロード機能を提供
 * - 10.5: カスタムCSSを適用してスタイルをオーバーライド
 * - 10.6: カスタムCSSのエラーを検出し、ユーザーに通知
 * - 14.4: Vivaldiのテーマ設定と調和するデフォルトスタイルを提供
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from './ThemeProvider';
import type { UserSettings } from '@/types';

// テスト用のコンポーネント
const TestComponent: React.FC<{ onThemeLoad?: (settings: UserSettings | null) => void }> = ({ onThemeLoad }) => {
  const { settings } = useTheme();

  React.useEffect(() => {
    if (onThemeLoad) {
      onThemeLoad(settings);
    }
  }, [settings, onThemeLoad]);

  return <div data-testid="test-component">Test</div>;
};

describe('ThemeProvider - Task 13.3', () => {
  beforeEach(() => {
    // chrome.storage モックをセットアップ
    global.chrome = {
      storage: {
        local: {
          get: vi.fn(),
          set: vi.fn(),
        },
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
      },
    } as any;

    // スタイル要素をクリア
    const existingStyle = document.getElementById('vivaldi-tt-theme');
    if (existingStyle) {
      existingStyle.remove();
    }

    const existingError = document.getElementById('vivaldi-tt-css-error');
    if (existingError) {
      existingError.remove();
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('カスタムCSS適用 (Requirement 10.5)', () => {
    it('カスタムCSSが正しく適用されること', async () => {
      const mockSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'Arial, sans-serif',
        customCSS: '.test { color: red; }',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      (chrome.storage.local.get as any).mockResolvedValue({
        user_settings: mockSettings,
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement).toBeTruthy();
        expect(styleElement?.textContent).toContain('.test { color: red; }');
      });
    });

    it('フォント設定が適用されること', async () => {
      const mockSettings: UserSettings = {
        fontSize: 16,
        fontFamily: 'Georgia, serif',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      (chrome.storage.local.get as any).mockResolvedValue({
        user_settings: mockSettings,
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement?.textContent).toContain('--font-size: 16px');
        expect(styleElement?.textContent).toContain('--font-family: Georgia, serif');
      });
    });
  });

  describe('カスタムCSSエラー検出 (Requirement 10.6)', () => {
    it('無効なCSSの場合、エラー通知を表示すること', async () => {
      const mockSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'Arial',
        customCSS: '{ invalid css syntax',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      (chrome.storage.local.get as any).mockResolvedValue({
        user_settings: mockSettings,
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        const errorElement = document.getElementById('vivaldi-tt-css-error');
        expect(errorElement).toBeTruthy();
        expect(errorElement?.textContent).toContain('CSS');
      });
    });

    it('有効なCSSの場合、エラー通知を表示しないこと', async () => {
      const mockSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'Arial',
        customCSS: '.valid { color: blue; }',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      (chrome.storage.local.get as any).mockResolvedValue({
        user_settings: mockSettings,
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement).toBeTruthy();
      });

      const errorElement = document.getElementById('vivaldi-tt-css-error');
      expect(errorElement).toBeNull();
    });

    it('CSSエラーから回復した場合、エラー通知を削除すること', async () => {
      const invalidSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'Arial',
        customCSS: '{ invalid',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      (chrome.storage.local.get as any).mockResolvedValue({
        user_settings: invalidSettings,
      });

      const { rerender } = render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.getElementById('vivaldi-tt-css-error')).toBeTruthy();
      });

      // 有効なCSSに変更
      const validSettings: UserSettings = {
        ...invalidSettings,
        customCSS: '.valid { color: green; }',
      };

      // ストレージ変更をシミュレート
      const listeners = (chrome.storage.onChanged.addListener as any).mock.calls;
      expect(listeners.length).toBeGreaterThan(0);

      const storageChangeHandler = listeners[0][0];
      storageChangeHandler({
        user_settings: {
          oldValue: invalidSettings,
          newValue: validSettings,
        },
      });

      await waitFor(() => {
        expect(document.getElementById('vivaldi-tt-css-error')).toBeNull();
      });
    });
  });

  describe('Vivaldiテーマとの調和 (Requirement 14.4)', () => {
    it('Vivaldiのダークテーマと調和するデフォルトスタイルを適用すること', async () => {
      // Vivaldiのダークテーマをシミュレート
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const mockSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      (chrome.storage.local.get as any).mockResolvedValue({
        user_settings: mockSettings,
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement).toBeTruthy();
        // ダークモード用のスタイルが含まれていることを確認
        expect(styleElement?.textContent).toMatch(/background|color/);
      });
    });

    it('Vivaldiのライトテーマと調和するデフォルトスタイルを適用すること', async () => {
      // Vivaldiのライトテーマをシミュレート
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-color-scheme: light)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const mockSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      (chrome.storage.local.get as any).mockResolvedValue({
        user_settings: mockSettings,
      });

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement).toBeTruthy();
      });
    });
  });

  describe('useTheme フック', () => {
    it('ThemeProviderの外で使用すると例外をスローすること', () => {
      // エラーをキャッチするためにconsole.errorをモック
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useTheme must be used within ThemeProvider');

      consoleError.mockRestore();
    });

    it('設定を更新できること', async () => {
      const mockSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'Arial',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      (chrome.storage.local.get as any).mockResolvedValue({
        user_settings: mockSettings,
      });

      const UpdateTestComponent = () => {
        const { settings, updateSettings } = useTheme();

        return (
          <div>
            <div data-testid="font-size">{settings?.fontSize}</div>
            <button
              onClick={() => {
                if (settings) {
                  updateSettings({ ...settings, fontSize: 20 });
                }
              }}
            >
              Update
            </button>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <UpdateTestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('font-size').textContent).toBe('14');
      });

      screen.getByText('Update').click();

      await waitFor(() => {
        expect(chrome.storage.local.set).toHaveBeenCalledWith({
          user_settings: expect.objectContaining({ fontSize: 20 }),
        });
      });
    });
  });
});
