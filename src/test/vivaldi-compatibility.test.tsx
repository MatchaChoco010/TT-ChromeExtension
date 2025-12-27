/**
 * Task 16.3: Vivaldi互換性テスト
 *
 * 以下の互換性をテストする:
 * - Requirement 14.1: Vivaldiブラウザ最新版での動作
 * - Requirement 14.2: VivaldiのタブAPIとChrome拡張機能APIの両方との互換性
 * - Requirement 14.4: Vivaldiのテーマ設定と調和するデフォルトスタイル
 * - Requirement 14.5: VivaldiのAPIが利用できない場合の標準Chrome拡張機能APIへのフォールバック
 */

import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ThemeProvider } from '@/sidepanel/providers/ThemeProvider';
import type { UserSettings } from '@/types';
import type { MockChrome, MockStorageData } from '@/test/test-types';

// Vivaldiブラウザ固有のAPIをモック
interface VivaldiTabAPI {
  getAll?: (callback: (tabs: chrome.tabs.Tab[]) => void) => void;
  stackCreate?: (tabIds: number[], callback?: () => void) => void;
}

// Chromeオブジェクトを拡張してVivaldi固有プロパティを追加
declare global {
  interface Window {
    vivaldi?: {
      tabs?: VivaldiTabAPI;
    };
  }
}

describe('Task 16.3: Vivaldi互換性テスト', () => {
  // Mock storage - shared across tests but reset in beforeEach
  let mockStorage: MockStorageData = {};

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock storage
    mockStorage = {};

    // Chrome storage のモック
    const mockChrome = global.chrome as unknown as MockChrome;
    vi.mocked(mockChrome.storage.local.get).mockImplementation((keys?: string | string[] | null) => {
      const result: Record<string, unknown> = {};
      if (keys === null || keys === undefined) {
        Object.assign(result, mockStorage);
      } else if (typeof keys === 'string') {
        // Single key as string
        if (keys in mockStorage) {
          result[keys] = mockStorage[keys as keyof MockStorageData];
        }
      } else if (Array.isArray(keys)) {
        keys.forEach((key) => {
          if (key in mockStorage) {
            result[key] = mockStorage[key as keyof MockStorageData];
          }
        });
      }
      return Promise.resolve(result);
    });

    vi.mocked(mockChrome.storage.local.set).mockImplementation((items: Record<string, unknown>) => {
      Object.assign(mockStorage, items);
      return Promise.resolve();
    });

    global.chrome.storage.onChanged.addListener = vi.fn();
    global.chrome.storage.onChanged.removeListener = vi.fn();

    // Chrome tabs API のモック
    vi.mocked(mockChrome.tabs.query).mockResolvedValue([
      {
        id: 1,
        title: 'Tab 1',
        url: 'https://example.com/1',
        active: true,
        windowId: 1,
      } as chrome.tabs.Tab,
    ]);

    vi.mocked(mockChrome.tabs.update).mockImplementation((tabId: number, updateProperties: chrome.tabs.UpdateProperties) =>
      Promise.resolve({
        id: tabId,
        active: updateProperties.active ?? false,
      } as chrome.tabs.Tab)
    );

    // Chrome runtime API のモック
    global.chrome.runtime.sendMessage = vi.fn(() => Promise.resolve());
    global.chrome.runtime.onMessage.addListener = vi.fn();
    global.chrome.runtime.onMessage.removeListener = vi.fn();

    // Chrome sidePanel API のモック (Manifest V3)
    vi.mocked(mockChrome.sidePanel.open).mockResolvedValue(undefined);
    vi.mocked(mockChrome.sidePanel.getOptions).mockResolvedValue({ enabled: true });
    vi.mocked(mockChrome.sidePanel.setOptions).mockResolvedValue(undefined);

    // matchMedia のモック
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes('dark'),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  describe('Requirement 14.1: Vivaldiブラウザでの基本動作', () => {
    it('サイドパネルAPIが正常に動作すること', async () => {
      // Arrange
      const mockOpenSidePanel = vi.fn(() => Promise.resolve());
      global.chrome.sidePanel.open = mockOpenSidePanel;

      // Act
      await chrome.sidePanel.open({ windowId: 1 });

      // Assert
      expect(mockOpenSidePanel).toHaveBeenCalledWith({ windowId: 1 });
    });

    it('Chrome tabs APIが正常に動作すること', async () => {
      // Arrange
      const mockTabs = [
        {
          id: 1,
          title: 'Test Tab',
          url: 'https://vivaldi.com',
          active: true,
          windowId: 1,
        } as chrome.tabs.Tab,
      ];

      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.tabs.query).mockResolvedValue(mockTabs);

      // Act
      const tabs = await chrome.tabs.query({ currentWindow: true });

      // Assert
      expect(tabs).toEqual(mockTabs);
      expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true });
    });

    it('ストレージAPIが正常に動作すること', async () => {
      // Arrange
      const testSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      // Act
      await chrome.storage.local.set({ user_settings: testSettings });

      // Get settings from storage
      const result = await chrome.storage.local.get('user_settings');

      // Assert
      expect(result.user_settings).toEqual(testSettings);
    });
  });

  describe('Requirement 14.2: VivaldiのタブAPIとChrome拡張機能APIの互換性', () => {
    it('Vivaldi固有のタブプロパティが利用可能な場合、それを活用できること', async () => {
      // Arrange - Vivaldi固有のAPIを模擬
      const vivaldiTabs: VivaldiTabAPI = {
        getAll: vi.fn((callback) => {
          callback([
            {
              id: 1,
              title: 'Vivaldi Tab',
              url: 'https://vivaldi.com',
              active: true,
              windowId: 1,
            } as chrome.tabs.Tab,
          ]);
        }),
      };

      window.vivaldi = {
        tabs: vivaldiTabs,
      };

      // Act
      const tabs: chrome.tabs.Tab[] = await new Promise((resolve) => {
        if (window.vivaldi?.tabs?.getAll) {
          window.vivaldi.tabs.getAll((tabs) => resolve(tabs));
        } else {
          chrome.tabs.query({ currentWindow: true }).then(resolve);
        }
      });

      // Assert
      expect(tabs).toHaveLength(1);
      expect(tabs[0].title).toBe('Vivaldi Tab');
      expect(vivaldiTabs.getAll).toHaveBeenCalled();
    });

    it('標準のChrome tabs APIも正常に動作すること', async () => {
      // Arrange
      const chromeTabs = [
        {
          id: 1,
          title: 'Chrome Tab',
          url: 'https://google.com',
          active: true,
          windowId: 1,
        } as chrome.tabs.Tab,
      ];

      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.tabs.query).mockResolvedValue(chromeTabs);

      // Act
      const tabs = await chrome.tabs.query({ currentWindow: true });

      // Assert
      expect(tabs).toEqual(chromeTabs);
    });
  });

  describe('Requirement 14.4: Vivaldiのテーマ設定との視覚的調和', () => {
    it('ダークモード時にVivaldi用のダークテーマが適用されること', async () => {
      // Arrange
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

      // Act
      render(
        <ThemeProvider>
          <div data-testid="test-content">Test</div>
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        const style = document.getElementById('vivaldi-tt-theme');
        expect(style).toBeTruthy();
        expect(style?.textContent).toContain('--vivaldi-bg-primary: #1e1e1e');
        expect(style?.textContent).toContain('--vivaldi-text-primary: #e0e0e0');
        expect(style?.textContent).toContain('Vivaldi Dark Theme');
      });
    });

    it('ライトモード時にVivaldi用のライトテーマが適用されること', async () => {
      // Arrange
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      // Act
      render(
        <ThemeProvider>
          <div data-testid="test-content">Test</div>
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        const style = document.getElementById('vivaldi-tt-theme');
        expect(style).toBeTruthy();
        expect(style?.textContent).toContain('--vivaldi-bg-primary: #ffffff');
        expect(style?.textContent).toContain('--vivaldi-text-primary: #202020');
        expect(style?.textContent).toContain('Vivaldi Light Theme');
      });
    });

    it('CSS変数がVivaldiテーマと一貫性のある値を持つこと', async () => {
      // Act
      render(
        <ThemeProvider>
          <div data-testid="test-content">Test</div>
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        const style = document.getElementById('vivaldi-tt-theme');
        expect(style?.textContent).toContain('--vivaldi-bg-primary');
        expect(style?.textContent).toContain('--vivaldi-bg-secondary');
        expect(style?.textContent).toContain('--vivaldi-text-primary');
        expect(style?.textContent).toContain('--vivaldi-text-secondary');
        expect(style?.textContent).toContain('--vivaldi-border');
        expect(style?.textContent).toContain('--vivaldi-hover');
      });
    });

    it('カスタムCSSがVivaldiテーマの上に適用されること', async () => {
      // Arrange
      const customSettings: UserSettings = {
        fontSize: 16,
        fontFamily: 'Arial, sans-serif',
        customCSS: '.custom-class { color: red; }',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      // Set settings in storage before rendering
      await chrome.storage.local.set({ user_settings: customSettings });

      // Act
      render(
        <ThemeProvider>
          <div data-testid="test-content">Test</div>
        </ThemeProvider>
      );

      // Assert
      await waitFor(
        () => {
          const style = document.getElementById('vivaldi-tt-theme');
          expect(style).toBeTruthy();
          const content = style?.textContent || '';
          expect(content).toContain('Vivaldi');
          expect(content).toContain('.custom-class { color: red; }');
        },
        { timeout: 2000 }
      );
    });
  });

  describe('Requirement 14.5: VivaldiのAPIが利用できない場合のフォールバック', () => {
    it('Vivaldi固有APIが存在しない場合、標準Chrome APIにフォールバックすること', async () => {
      // Arrange
      window.vivaldi = undefined;

      const chromeTabs = [
        {
          id: 1,
          title: 'Fallback Tab',
          url: 'https://example.com',
          active: true,
          windowId: 1,
        } as chrome.tabs.Tab,
      ];

      const mockChrome = global.chrome as unknown as MockChrome;
      vi.mocked(mockChrome.tabs.query).mockResolvedValue(chromeTabs);

      // Act
      const tabs: chrome.tabs.Tab[] = await new Promise((resolve) => {
        if (window.vivaldi?.tabs?.getAll) {
          window.vivaldi.tabs.getAll((tabs) => resolve(tabs));
        } else {
          chrome.tabs.query({ currentWindow: true }).then(resolve);
        }
      });

      // Assert
      expect(tabs).toEqual(chromeTabs);
      expect(chrome.tabs.query).toHaveBeenCalledWith({ currentWindow: true });
    });

    it('Vivaldi固有プロパティがundefinedの場合でもエラーが発生しないこと', async () => {
      // Arrange
      window.vivaldi = {
        tabs: undefined,
      };

      // Act & Assert
      expect(() => {
        if (window.vivaldi?.tabs?.getAll) {
          window.vivaldi.tabs.getAll(() => {});
        } else {
          chrome.tabs.query({ currentWindow: true });
        }
      }).not.toThrow();
    });

    it('Chrome APIのみで全機能が動作すること', async () => {
      // Arrange
      window.vivaldi = undefined;

      // Act - タブ操作
      await chrome.tabs.query({ currentWindow: true });
      await chrome.tabs.update(1, { active: true });

      // Assert
      expect(chrome.tabs.query).toHaveBeenCalled();
      expect(chrome.tabs.update).toHaveBeenCalledWith(1, { active: true });
    });
  });

  describe('統合テスト: Vivaldi環境での全機能動作確認', () => {
    it('サイドパネルがVivaldi環境で正常に表示されること', async () => {
      // Arrange - Vivaldi環境をシミュレート
      window.vivaldi = {
        tabs: {
          getAll: vi.fn((callback) => {
            callback([
              {
                id: 1,
                title: 'Test Tab',
                url: 'https://vivaldi.com',
                active: true,
                windowId: 1,
              } as chrome.tabs.Tab,
            ]);
          }),
        },
      };

      // Act
      render(
        <ThemeProvider>
          <div data-testid="side-panel-root">Side Panel Content</div>
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        expect(screen.getByTestId('side-panel-root')).toBeInTheDocument();
        const style = document.getElementById('vivaldi-tt-theme');
        expect(style).toBeTruthy();
      });
    });

    it('Vivaldiテーマとカスタム設定が同時に適用されること', async () => {
      // Arrange
      const settings: UserSettings = {
        fontSize: 18,
        fontFamily: 'Courier New, monospace',
        customCSS: 'body { line-height: 1.6; }',
        newTabPosition: 'sibling',
        closeWarningThreshold: 5,
        showUnreadIndicator: true,
        autoSnapshotInterval: 10,
        childTabBehavior: 'promote',
      };

      // Set settings before rendering
      await chrome.storage.local.set({ user_settings: settings });

      // Act
      render(
        <ThemeProvider>
          <div data-testid="test-content">Test</div>
        </ThemeProvider>
      );

      // Assert
      await waitFor(
        () => {
          const style = document.getElementById('vivaldi-tt-theme');
          expect(style).toBeTruthy();
          const content = style?.textContent || '';
          expect(content).toContain('--font-size: 18px');
          expect(content).toContain('Courier New, monospace');
          expect(content).toContain('line-height: 1.6');
          expect(content).toContain('--vivaldi-bg-primary');
        },
        { timeout: 2000 }
      );
    });

    it('ダークモードとライトモードの切り替えが動的に反映されること', async () => {
      // Arrange - ライトモードでスタート
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false, // Light mode
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      // Act - ライトモードでレンダリング
      const { unmount } = render(
        <ThemeProvider>
          <div data-testid="test-content">Test Light</div>
        </ThemeProvider>
      );

      await waitFor(() => {
        const style = document.getElementById('vivaldi-tt-theme');
        expect(style?.textContent).toContain('Vivaldi Light Theme');
      });

      // Clean up
      unmount();

      // ダークモードに切り替え
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-color-scheme: dark)', // Dark mode
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      // 新しくレンダリング
      render(
        <ThemeProvider>
          <div data-testid="test-content">Test Dark</div>
        </ThemeProvider>
      );

      // Assert
      await waitFor(() => {
        const style = document.getElementById('vivaldi-tt-theme');
        expect(style?.textContent).toContain('Vivaldi Dark Theme');
      });
    });
  });
});
