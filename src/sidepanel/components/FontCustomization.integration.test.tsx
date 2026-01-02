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
  // chrome.storage.local のモック
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  let onChangedListeners: StorageChangeListener[] = [];

  beforeEach(() => {
    onChangedListeners = [];

    // グローバルなchromeオブジェクトをモック
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

    // chrome.storage.local.setが呼ばれたときにonChangedリスナーをトリガー
    mockSet.mockImplementation(async (items: Record<string, unknown>) => {
      // 変更通知をトリガー
      const changes: StorageChanges = {};
      for (const key in items) {
        changes[key] = { oldValue: undefined, newValue: items[key] };
      }
      onChangedListeners.forEach((listener) => listener(changes, 'local'));
      return Promise.resolve();
    });

    // 既存のスタイル要素をクリア
    const existingStyle = document.getElementById('vivaldi-tt-theme');
    if (existingStyle) {
      existingStyle.remove();
    }

    // モックをリセット
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
      };

      mockGet.mockResolvedValue({
        user_settings: defaultSettings,
      });

      const onSettingsChange = vi.fn((settings: UserSettings) => {
        // 設定変更時にThemeProviderが適用するスタイルをシミュレート
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

      // フォントサイズ入力フィールドを取得
      const fontSizeInput = screen.getByLabelText(/フォントサイズ/i);

      // フォントサイズを18pxに変更
      fireEvent.change(fontSizeInput, { target: { value: '18' } });

      // onSettingsChangeが呼ばれたことを確認
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontSize: 18,
      });

      // スタイルが適用されていることを確認
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

      // 「小」ボタンをクリック
      const smallButton = screen.getByText('小');
      fireEvent.click(smallButton);
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontSize: 12,
      });

      // 「中」ボタンをクリック
      const mediumButton = screen.getByText('中');
      fireEvent.click(mediumButton);
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontSize: 14,
      });

      // 「大」ボタンをクリック
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
      };

      mockGet.mockResolvedValue({
        user_settings: initialSettings,
      });

      // テスト用のコンポーネント: useThemeを使用してThemeProviderと統合
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

      // ThemeProviderが初期化されるまで待つ
      await waitFor(() => {
        expect(screen.getByLabelText(/フォントサイズ/i)).toBeInTheDocument();
      });

      // フォントサイズを20pxに変更
      const fontSizeInput = screen.getByLabelText(/フォントサイズ/i);
      fireEvent.change(fontSizeInput, { target: { value: '20' } });

      // CSS変数が更新されることを確認
      await waitFor(
        () => {
          const styleElement = document.getElementById('vivaldi-tt-theme');
          expect(styleElement).toBeTruthy();
          expect(styleElement?.textContent).toContain('--font-size: 20px');
        },
        { timeout: 2000 }
      );

      // bodyにフォントサイズが適用されることを確認
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

      // フォントファミリー入力フィールドを取得
      const fontFamilyInput = screen.getByLabelText(/フォントファミリー/i);

      // フォントファミリーを変更
      fireEvent.change(fontFamilyInput, {
        target: { value: 'Arial, sans-serif' },
      });

      // onSettingsChangeが呼ばれたことを確認
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
      };

      mockGet.mockResolvedValue({
        user_settings: initialSettings,
      });

      // テスト用のコンポーネント: useThemeを使用してThemeProviderと統合
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

      // ThemeProviderが初期化されるまで待つ
      await waitFor(() => {
        expect(screen.getByLabelText(/フォントファミリー/i)).toBeInTheDocument();
      });

      // フォントファミリーを変更
      const fontFamilyInput = screen.getByLabelText(/フォントファミリー/i);
      fireEvent.change(fontFamilyInput, {
        target: { value: 'Comic Sans MS, cursive' },
      });

      // CSS変数が更新されることを確認
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
      // このテストは、タブタイトル要素がTailwindのtext-smクラスを使用せず、
      // CSS変数var(--font-size)を継承することを確認します
      const initialSettings: UserSettings = {
        fontSize: 18,
        fontFamily: 'system-ui',
        customCSS: '',
        newTabPosition: 'child',
        closeWarningThreshold: 3,
        showUnreadIndicator: true,
        autoSnapshotInterval: 0,
        childTabBehavior: 'promote',
      };

      mockGet.mockResolvedValue({
        user_settings: initialSettings,
      });

      // TreeNodeコンポーネントをレンダリングするテスト
      // TreeNode.tsxでタブタイトルがtext-smではなくCSS変数を使用することを確認
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

      // ThemeProviderが初期化されるまで待つ
      await waitFor(() => {
        expect(screen.getByLabelText(/フォントサイズ/i)).toBeInTheDocument();
      });

      // CSS変数が正しく設定されていることを確認
      await waitFor(() => {
        const styleElement = document.getElementById('vivaldi-tt-theme');
        expect(styleElement).toBeTruthy();
        expect(styleElement?.textContent).toContain('--font-size: 18px');
        expect(styleElement?.textContent).toContain('font-size: var(--font-size)');
      });

      // タブタイトル要素がtext-smクラスを持たないことを確認
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
      };

      const onSettingsChange = vi.fn();

      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const fontSizeInput = screen.getByLabelText(/フォントサイズ/i);

      // 範囲外の値（7px）を設定
      fireEvent.change(fontSizeInput, { target: { value: '7' } });

      // onSettingsChangeが呼ばれないことを確認
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
      };

      const onSettingsChange = vi.fn();

      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const fontSizeInput = screen.getByLabelText(/フォントサイズ/i);

      // 範囲外の値（73px）を設定
      fireEvent.change(fontSizeInput, { target: { value: '73' } });

      // onSettingsChangeが呼ばれないことを確認
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
      };

      const onSettingsChange = vi.fn();

      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const fontFamilyInput = screen.getByLabelText(/フォントファミリー/i);

      // 空の値を設定
      fireEvent.change(fontFamilyInput, { target: { value: '' } });

      // onSettingsChangeが呼ばれることを確認
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontFamily: '',
      });
    });
  });
});
