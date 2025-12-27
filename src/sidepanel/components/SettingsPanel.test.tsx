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

  describe('Requirement 8.5: 警告閾値のカスタマイズ', () => {
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

  describe('Requirement 9.1: 新規タブ位置設定', () => {
    it('should display newTabPosition setting options', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      // 新しいタブの位置設定ラベルが表示される
      expect(screen.getByText(/新しいタブの位置/i)).toBeInTheDocument();
    });

    it('should display current newTabPosition value as selected option', () => {
      const settingsWithChild = {
        ...defaultSettings,
        newTabPosition: 'child' as const,
      };

      render(
        <SettingsPanel
          settings={settingsWithChild}
          onSettingsChange={onSettingsChange}
        />
      );

      const select = screen.getByLabelText(
        /新しいタブの位置/i
      ) as HTMLSelectElement;
      expect(select.value).toBe('child');
    });

    it('should allow user to change newTabPosition to "child"', () => {
      const settingsWithEnd = {
        ...defaultSettings,
        newTabPosition: 'end' as const,
      };

      render(
        <SettingsPanel
          settings={settingsWithEnd}
          onSettingsChange={onSettingsChange}
        />
      );

      const select = screen.getByLabelText(/新しいタブの位置/i);
      fireEvent.change(select, { target: { value: 'child' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...settingsWithEnd,
        newTabPosition: 'child',
      });
    });

    it('should allow user to change newTabPosition to "sibling"', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const select = screen.getByLabelText(/新しいタブの位置/i);
      fireEvent.change(select, { target: { value: 'sibling' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        newTabPosition: 'sibling',
      });
    });

    it('should allow user to change newTabPosition to "end"', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      const select = screen.getByLabelText(/新しいタブの位置/i);
      fireEvent.change(select, { target: { value: 'end' } });

      expect(onSettingsChange).toHaveBeenCalledWith({
        ...defaultSettings,
        newTabPosition: 'end',
      });
    });

    it('should display all three options: child, sibling, end', () => {
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

    it('should display description for newTabPosition setting', () => {
      render(
        <SettingsPanel
          settings={defaultSettings}
          onSettingsChange={onSettingsChange}
        />
      );

      expect(
        screen.getByText(/新しく開かれるタブの挿入位置を選択できます/i)
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

      expect(screen.getByText(/設定/i)).toBeInTheDocument();
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

  describe('Requirement 10.1, 10.2: フォントサイズ調整', () => {
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

  describe('Requirement 10.3: フォントファミリー選択', () => {
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

  describe('Requirement 10.4, 10.5: カスタムCSS機能', () => {
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
});
