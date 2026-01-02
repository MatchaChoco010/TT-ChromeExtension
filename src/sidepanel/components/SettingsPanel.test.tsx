import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import SettingsPanel from './SettingsPanel';
import type { UserSettings } from '@/types';

describe('SettingsPanel', () => {
  const defaultSettings: UserSettings = {
    fontSize: 14,
    fontFamily: 'system-ui',
    customCSS: '',
    newTabPosition: 'child',
    closeWarningThreshold: 3,
    showUnreadIndicator: true,
    autoSnapshotInterval: 10,
    childTabBehavior: 'promote',
  };

  let onSettingsChange: (settings: UserSettings) => void;

  beforeEach(() => {
    onSettingsChange = vi.fn();
  });

  describe('警告閾値のカスタマイズ', () => {
    it('should display current closeWarningThreshold value', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/警告閾値/i);
      expect(input).toHaveValue(3);
    });

    it('should allow user to change closeWarningThreshold', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/警告閾値/i);
      fireEvent.change(input, { target: { value: '5' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        closeWarningThreshold: 5,
      });
    });

    it('should display description for closeWarningThreshold setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(
        screen.getByText(/タブを閉じる際の警告を表示する閾値/i)
      ).toBeInTheDocument();
    });

    it('should accept valid threshold values (1 or more)', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/警告閾値/i) as HTMLInputElement;

      fireEvent.change(input, { target: { value: '1' } });
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        closeWarningThreshold: 1,
      });

      fireEvent.change(input, { target: { value: '10' } });
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        closeWarningThreshold: 10,
      });
    });

    it('should not accept invalid threshold values (0 or negative)', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/警告閾値/i) as HTMLInputElement;

      // 0は受け付けない
      fireEvent.change(input, { target: { value: '0' } });
      expect(onSettingsChange).not.toHaveBeenCalledWith({
        ...defaultSettings,
        closeWarningThreshold: 0,
      });

      // 負の数は受け付けない
      fireEvent.change(input, { target: { value: '-1' } });
      expect(onSettingsChange).not.toHaveBeenCalledWith({
        ...defaultSettings,
        closeWarningThreshold: -1,
      });
    });

    it('should show helper text for threshold setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(
        screen.getByText(/この数以上のタブを閉じる際に確認ダイアログを表示します/i)
      ).toBeInTheDocument();
    });
  });

  describe('個別のタブ位置設定', () => {
    it('should display link click tab position setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      // リンククリックから開かれたタブの位置設定ラベルが表示される
      expect(screen.getByLabelText(/リンククリックから開かれたタブの位置/i)).toBeInTheDocument();
    });

    it('should display manual tab position setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      // 手動で開かれたタブの位置設定ラベルが表示される
      expect(screen.getByLabelText(/手動で開かれたタブの位置/i)).toBeInTheDocument();
    });

    it('should display current newTabPositionFromLink value as selected option', () => {
      const settingsWithChild = {
        ...defaultSettings,
        newTabPositionFromLink: 'child' as const,
      };

      render(
        <SettingsPanel
          settings={settingsWithChild}
          onSettingsChange={onSettingsChange}
        />
      );

      const select = screen.getByLabelText(
        /リンククリックから開かれたタブの位置/i
      ) as HTMLSelectElement;
      expect(select.value).toBe('child');
    });

    it('should default to "child" for newTabPositionFromLink when not set', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const select = screen.getByLabelText(
        /リンククリックから開かれたタブの位置/i
      ) as HTMLSelectElement;
      // デフォルトは 'child'
      expect(select.value).toBe('child');
    });

    it('should default to "end" for newTabPositionManual when not set', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const select = screen.getByLabelText(
        /手動で開かれたタブの位置/i
      ) as HTMLSelectElement;
      // デフォルトは 'end'
      expect(select.value).toBe('end');
    });

    it('should allow user to change newTabPositionFromLink', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const select = screen.getByLabelText(/リンククリックから開かれたタブの位置/i);
      fireEvent.change(select, { target: { value: 'end' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        newTabPositionFromLink: 'end',
      });
    });

    it('should allow user to change newTabPositionManual', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const select = screen.getByLabelText(/手動で開かれたタブの位置/i);
      fireEvent.change(select, { target: { value: 'child' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        newTabPositionManual: 'child',
      });
    });

    it('should display all three options for both settings', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      // 各オプションが存在することを確認(複数のセレクトで同じテキストが使われているため getAllByText を使用)
      expect(screen.getAllByText(/現在のタブの子/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/現在のタブの隣/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/リストの最後/i).length).toBeGreaterThan(0);
    });

    it('should display description for manual tab position setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(
        screen.getByText(/手動で開かれたタブ\(アドレスバー、新規タブボタン、設定画面など\)の挿入位置/i)
      ).toBeInTheDocument();
    });
  });

  describe('Settings Panel UI', () => {
    it('should render settings panel with title', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('設定');
    });

    it('should have sections for different setting categories', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      // タブ動作セクションがある
      expect(screen.getByText(/タブの動作/i)).toBeInTheDocument();
    });
  });

  describe('フォントサイズ調整', () => {
    it('should display font size setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/フォントサイズ/i)).toBeInTheDocument();
    });

    it('should display current fontSize value', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/フォントサイズ/i) as HTMLInputElement;
      expect(input.value).toBe('14');
    });

    it('should allow user to change fontSize', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/フォントサイズ/i);
      fireEvent.change(input, { target: { value: '16' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontSize: 16,
      });
    });

    it('should have preset font size buttons (small, medium, large)', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText('小')).toBeInTheDocument();
      expect(screen.getByText('中')).toBeInTheDocument();
      expect(screen.getByText('大')).toBeInTheDocument();
    });

    it('should apply preset font sizes when buttons are clicked', () => {
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

  describe('フォントファミリー選択', () => {
    it('should display font family setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/フォントファミリー/i)).toBeInTheDocument();
    });

    it('should display current fontFamily value', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/フォントファミリー/i) as HTMLInputElement;
      expect(input.value).toBe('system-ui');
    });

    it('should allow user to change fontFamily', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/フォントファミリー/i);
      fireEvent.change(input, { target: { value: 'Arial, sans-serif' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        fontFamily: 'Arial, sans-serif',
      });
    });
  });

  describe('カスタムCSS機能', () => {
    it('should display custom CSS textarea', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/カスタムCSS/i)).toBeInTheDocument();
    });

    it('should display current customCSS value', () => {
      const settingsWithCSS = {
        ...defaultSettings,
        customCSS: '.test { color: red; }',
      };

      render(
        <SettingsPanel
          settings={settingsWithCSS}
          onSettingsChange={onSettingsChange}
        />
      );

      const textarea = screen.getByLabelText(/カスタムCSS/i) as HTMLTextAreaElement;
      expect(textarea.value).toBe('.test { color: red; }');
    });

    it('should allow user to change customCSS', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const textarea = screen.getByLabelText(/カスタムCSS/i);
      fireEvent.change(textarea, { target: { value: '.new { font-size: 18px; }' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        customCSS: '.new { font-size: 18px; }',
      });
    });

    it('should display description for custom CSS setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(
        screen.getByText(/カスタムCSSでスタイルをオーバーライドできます/i)
      ).toBeInTheDocument();
    });
  });

  describe('UI/UX Customization Section', () => {
    it('should have a UI/UX customization section', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText(/外観のカスタマイズ/i)).toBeInTheDocument();
    });
  });

  describe('スナップショット自動保存設定', () => {
    it('should display snapshot settings section', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByText(/スナップショットの自動保存/i)).toBeInTheDocument();
    });

    it('should display auto-save toggle switch', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/自動保存を有効にする/i)).toBeInTheDocument();
    });

    it('should toggle auto-save enabled state when clicked', () => {
      // autoSnapshotInterval が 0 の場合は無効
      const settingsWithDisabled = {
        ...defaultSettings,
        autoSnapshotInterval: 0,
      };

      render(
        <SettingsPanel
          settings={settingsWithDisabled}
          onSettingsChange={onSettingsChange}
        />
      );

      const toggle = screen.getByLabelText(/自動保存を有効にする/i);
      fireEvent.click(toggle);

      // 有効にするとデフォルトの間隔（10分）が設定される
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...settingsWithDisabled,
        autoSnapshotInterval: 10,
      });
    });

    it('should disable auto-save when toggle is turned off', () => {
      const settingsWithEnabled = {
        ...defaultSettings,
        autoSnapshotInterval: 10,
      };

      render(
        <SettingsPanel
          settings={settingsWithEnabled}
          onSettingsChange={onSettingsChange}
        />
      );

      const toggle = screen.getByLabelText(/自動保存を有効にする/i);
      fireEvent.click(toggle);

      // 無効にするとintervalが0になる
      expect(onSettingsChange).toHaveBeenCalledWith({
        ...settingsWithEnabled,
        autoSnapshotInterval: 0,
      });
    });

    it('should display interval input field', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/自動保存の間隔/i)).toBeInTheDocument();
    });

    it('should display current interval value', () => {
      const settingsWithInterval = {
        ...defaultSettings,
        autoSnapshotInterval: 15,
      };

      render(
        <SettingsPanel
          settings={settingsWithInterval}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/自動保存の間隔/i) as HTMLInputElement;
      expect(input.value).toBe('15');
    });

    it('should allow user to change interval', () => {
      const settingsWithInterval = {
        ...defaultSettings,
        autoSnapshotInterval: 10,
      };

      render(
        <SettingsPanel
          settings={settingsWithInterval}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/自動保存の間隔/i);
      fireEvent.change(input, { target: { value: '30' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...settingsWithInterval,
        autoSnapshotInterval: 30,
      });
    });

    it('should not accept interval less than 1', () => {
      const settingsWithInterval = {
        ...defaultSettings,
        autoSnapshotInterval: 10,
      };

      render(
        <SettingsPanel
          settings={settingsWithInterval}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/自動保存の間隔/i);
      fireEvent.change(input, { target: { value: '0' } });

      // 0以下は受け付けない
      expect(onSettingsChange).not.toHaveBeenCalledWith({
        ...settingsWithInterval,
        autoSnapshotInterval: 0,
      });
    });

    it('should display max snapshots input field', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(screen.getByLabelText(/最大スナップショット数/i)).toBeInTheDocument();
    });

    it('should display current max snapshots value', () => {
      const settingsWithMaxSnapshots = {
        ...defaultSettings,
        maxSnapshots: 20,
      };

      render(
        <SettingsPanel
          settings={settingsWithMaxSnapshots}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/最大スナップショット数/i) as HTMLInputElement;
      expect(input.value).toBe('20');
    });

    it('should use default value of 10 when maxSnapshots is not set', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/最大スナップショット数/i) as HTMLInputElement;
      expect(input.value).toBe('10');
    });

    it('should allow user to change max snapshots', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/最大スナップショット数/i);
      fireEvent.change(input, { target: { value: '25' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        maxSnapshots: 25,
      });
    });

    it('should not accept max snapshots less than 1', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const input = screen.getByLabelText(/最大スナップショット数/i);
      fireEvent.change(input, { target: { value: '0' } });

      // 0以下は受け付けない
      expect(onSettingsChange).not.toHaveBeenCalledWith({
        ...defaultSettings,
        maxSnapshots: 0,
      });
    });

    it('should disable interval and max snapshots inputs when auto-save is disabled', () => {
      const settingsWithDisabled = {
        ...defaultSettings,
        autoSnapshotInterval: 0,
      };

      render(
        <SettingsPanel
          settings={settingsWithDisabled}
          onSettingsChange={onSettingsChange}
        />
      );

      const intervalInput = screen.getByLabelText(/自動保存の間隔/i) as HTMLInputElement;
      const maxSnapshotsInput = screen.getByLabelText(/最大スナップショット数/i) as HTMLInputElement;

      expect(intervalInput).toBeDisabled();
      expect(maxSnapshotsInput).toBeDisabled();
    });

    it('should enable interval and max snapshots inputs when auto-save is enabled', () => {
      const settingsWithEnabled = {
        ...defaultSettings,
        autoSnapshotInterval: 10,
      };

      render(
        <SettingsPanel
          settings={settingsWithEnabled}
          onSettingsChange={onSettingsChange}
        />
      );

      const intervalInput = screen.getByLabelText(/自動保存の間隔/i) as HTMLInputElement;
      const maxSnapshotsInput = screen.getByLabelText(/最大スナップショット数/i) as HTMLInputElement;

      expect(intervalInput).not.toBeDisabled();
      expect(maxSnapshotsInput).not.toBeDisabled();
    });

    it('should display description for interval setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(
        screen.getByText(/スナップショットを自動的に保存する間隔/i)
      ).toBeInTheDocument();
    });

    it('should display description for max snapshots setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(
        screen.getByText(/保持するスナップショットの最大数/i)
      ).toBeInTheDocument();
    });
  });
});
