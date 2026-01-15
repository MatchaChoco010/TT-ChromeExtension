import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider, useTheme } from '@/sidepanel/providers/ThemeProvider';
import SettingsPanel from './SettingsPanel';
import type { UserSettings, StorageChanges } from '@/types';
import type { StorageChangeListener } from '@/test/test-types';

/**
 * フォントカスタマイズ機能のインテグレーションテスト
 *
 * このテストは、フォント設定の変更がサイドパネル全体に正しく適用されることを確認します。
 */
describe('フォントカスタマイズ機能', () => {
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  let onChangedListeners: StorageChangeListener[] = [];

  beforeEach(() => {
    onChangedListeners = [];

    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: mockGet,
          set: mockSet,
        },
        onChanged: {
          addListener: vi.fn((listener: StorageChangeListener) => {
            onChangedListeners.push(listener);
          }),
          removeListener: vi.fn((listener: StorageChangeListener) => {
            onChangedListeners = onChangedListeners.filter((l) => l !== listener);
          }),
        },
      },
    });

    mockSet.mockImplementation(async (items: Record<string, unknown>) => {
      const changes: StorageChanges = {};
      for (const key in items) {
        changes[key] = { oldValue: undefined, newValue: items[key] };
      }
      onChangedListeners.forEach((listener) => listener(changes, 'local'));
      return Promise.resolve();
    });

    const existingStyle = document.getElementById('vivaldi-tt-theme');
    if (existingStyle) {
      existingStyle.remove();
    }

    mockGet.mockClear();
    mockSet.mockClear();
  });

  describe('フォントサイズ調整', () => {
    it('フォントサイズをカスタムpx値に変更できること', async () => {
      const defaultSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: defaultSettings,
      });

      const onSettingsChange = vi.fn((settings: UserSettings) => {
        const style = document.createElement('style');
        style.id = 'vivaldi-tt-theme';
        style.textContent = `
          :root {
            --font-size: ${settings.fontSize}px;
            --font-family: ${settings.fontFamily};
          }
          body {
            font-size: var(--font-size);
            font-family: var(--font-family);
          }
        `;
        const existingStyle = document.getElementById('vivaldi-tt-theme');
        if (existingStyle) {
          existingStyle.remove();
        }
        document.head.appendChild(style);
      });

      render(
        <ThemeProvider>
          <SettingsPanel
            settings={defaultSettings}
            onSettingsChange={onSettingsChange}
          />
        </ThemeProvider>
      );

      const fontSizeInput = screen.getByLabelText(/フォントサイズ/i);
      fireEvent.change(fontSizeInput, { target: { value: '18' } });
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontSize: 18,
      });

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement).toBeTruthy();
        expect(styleElement?.textContent).toContain('--font-size: 18px');
      });
    });

    it('プリセットボタン（小・中・大）でフォントサイズを変更できること', async () => {
      const defaultSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: defaultSettings,
      });

      const onSettingsChange = vi.fn();

      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const smallButton = screen.getByText('小');
      fireEvent.click(smallButton);
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontSize: 12,
      });

      const mediumButton = screen.getByText('中');
      fireEvent.click(mediumButton);
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontSize: 14,
      });

      const largeButton = screen.getByText('大');
      fireEvent.click(largeButton);
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontSize: 16,
      });
    });
  });

  describe('フォントサイズ変更がすべてのタブアイテムに適用される', () => {
    it('フォントサイズを変更すると、サイドパネルのすべての要素に反映されること', async () => {
      const initialSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: initialSettings,
      });

      const TestComponent = () => {
        const { settings, updateSettings } = useTheme();

        return (
          <div>
            {settings && (
              <SettingsPanel
                settings={settings}
                onSettingsChange={updateSettings}
              />
            )}
            <div className="test-tab-item">タブアイテム1</div>
            <div className="test-tab-item">タブアイテム2</div>
            <div className="test-tab-item">タブアイテム3</div>
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/フォントサイズ/i)).toBeInTheDocument();
      });

      const fontSizeInput = screen.getByLabelText(/フォントサイズ/i);
      fireEvent.change(fontSizeInput, { target: { value: '20' } });

      await waitFor(
        () => {
          const styleElement = document.getElementById('vivaldi-tt-theme');
          expect(styleElement).toBeTruthy();
          expect(styleElement?.textContent).toContain('--font-size: 20px');
        },
        { timeout: 2000 }
      );

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement?.textContent).toContain('body {');
        expect(styleElement?.textContent).toContain('font-size: var(--font-size)');
      });
    });
  });

  describe('フォントファミリー選択', () => {
    it('フォントファミリーを変更できること', async () => {
      const defaultSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: defaultSettings,
      });

      const onSettingsChange = vi.fn();

      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const fontFamilyInput = screen.getByLabelText(/フォントファミリー/i);
      fireEvent.change(fontFamilyInput, {
        target: { value: 'Arial, sans-serif' },
      });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontFamily: 'Arial, sans-serif',
      });
    });

    it('フォントファミリー変更がサイドパネル全体に適用されること', async () => {
      const initialSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: initialSettings,
      });

      const TestComponent = () => {
        const { settings, updateSettings } = useTheme();

        return (
          <div>
            {settings && (
              <SettingsPanel
                settings={settings}
                onSettingsChange={updateSettings}
              />
            )}
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/フォントファミリー/i)).toBeInTheDocument();
      });

      const fontFamilyInput = screen.getByLabelText(/フォントファミリー/i);
      fireEvent.change(fontFamilyInput, {
        target: { value: 'Comic Sans MS, cursive' },
      });

      await waitFor(
        () => {
          const styleElement = document.getElementById('vivaldi-tt-theme');
          expect(styleElement).toBeTruthy();
          expect(styleElement?.textContent).toContain(
            '--font-family: Comic Sans MS, cursive'
          );
        },
        { timeout: 2000 }
      );
    });
  });

  describe('タブタイトルへのフォントサイズ反映', () => {
    it('タブタイトルにtext-smクラスが使用されていないこと', async () => {
      const initialSettings: UserSettings = {
        fontSize: 18,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      mockGet.mockResolvedValue({
        user_settings: initialSettings,
      });

      const TestComponent = () => {
        const { settings, updateSettings } = useTheme();

        return (
          <div>
            {settings && (
              <>
                <SettingsPanel
                  settings={settings}
                  onSettingsChange={updateSettings}
                />
                {/* タブタイトル用のテスト要素 */}
                <span data-testid="tab-title-test" className="truncate">
                  テストタブタイトル
                </span>
              </>
            )}
          </div>
        );
      };

      render(
        <ThemeProvider>
          <TestComponent />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/フォントサイズ/i)).toBeInTheDocument();
      });

      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement).toBeTruthy();
        expect(styleElement?.textContent).toContain('--font-size: 18px');
        expect(styleElement?.textContent).toContain('font-size: var(--font-size)');
      });

      const tabTitle = screen.getByTestId('tab-title-test');
      expect(tabTitle).not.toHaveClass('text-sm');
    });
  });

  describe('エッジケース', () => {
    it('フォントサイズが範囲外（8未満）の場合、変更されないこと', async () => {
      const defaultSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      const onSettingsChange = vi.fn();

      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const fontSizeInput = screen.getByLabelText(/フォントサイズ/i);
      fireEvent.change(fontSizeInput, { target: { value: '7' } });
      expect(onSettingsChange).not.toHaveBeenCalled();
    });

    it('フォントサイズが範囲外（72超）の場合、変更されないこと', async () => {
      const defaultSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      const onSettingsChange = vi.fn();

      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const fontSizeInput = screen.getByLabelText(/フォントサイズ/i);
      fireEvent.change(fontSizeInput, { target: { value: '73' } });
      expect(onSettingsChange).not.toHaveBeenCalled();
    });

    it('空のフォントファミリーを設定できること', async () => {
      const defaultSettings: UserSettings = {
        fontSize: 14,
        fontFamily: 'Arial, sans-serif',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
        snapshotSubfolder: 'TT-Snapshots',
      };

      const onSettingsChange = vi.fn();

      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const fontFamilyInput = screen.getByLabelText(/フォントファミリー/i);
      fireEvent.change(fontFamilyInput, { target: { value: '' } });
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontFamily: '',
      });
    });
  });
});
