import React from 'react';
import type { UserSettings } from '@/types';

interface SettingsPanelProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
}

/**
 * 設定パネルコンポーネント
 * ユーザー設定のカスタマイズUIを提供します。
 *
 * Requirements: 10.1, 10.2, 10.3 (UI/UXカスタマイズ), 8.5 (警告閾値のカスタマイズ)
 */
const SettingsPanel: React.FC<SettingsPanelProps> = ({
  settings,
  onSettingsChange,
}) => {
  const handleCloseWarningThresholdChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseInt(e.target.value, 10);

    // 1以上の値のみ受け付ける (Requirement 8.5)
    if (value >= 1) {
      onSettingsChange({
        ...settings,
        closeWarningThreshold: value,
      });
    }
  };

  const handleNewTabPositionChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value as 'child' | 'sibling' | 'end';
    onSettingsChange({
      ...settings,
      newTabPosition: value,
    });
  };

  // Task 12.2: タブ開き方別の位置ルール (Requirements 9.2, 9.3, 9.4)
  const handleNewTabPositionFromLinkChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value as 'child' | 'sibling' | 'end';
    onSettingsChange({
      ...settings,
      newTabPositionFromLink: value,
    });
  };

  const handleNewTabPositionManualChange = (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const value = e.target.value as 'child' | 'sibling' | 'end';
    onSettingsChange({
      ...settings,
      newTabPositionManual: value,
    });
  };

  // Task 13.1: フォントサイズ調整 (Requirements 10.1, 10.2)
  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (value >= 8 && value <= 72) {
      onSettingsChange({
        ...settings,
        fontSize: value,
      });
    }
  };

  const handlePresetFontSize = (size: number) => {
    onSettingsChange({
      ...settings,
      fontSize: size,
    });
  };

  // Task 13.1: フォントファミリー選択 (Requirement 10.3)
  const handleFontFamilyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({
      ...settings,
      fontFamily: e.target.value,
    });
  };

  // Task 13.1: カスタムCSS (Requirements 10.4, 10.5)
  const handleCustomCSSChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onSettingsChange({
      ...settings,
      customCSS: e.target.value,
    });
  };

  return (
    <div className="settings-panel p-4">
      <h1 className="text-xl font-bold mb-6">設定</h1>

      {/* 外観のカスタマイズセクション (Requirements 10.1-10.6) */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">外観のカスタマイズ</h2>

        {/* フォントサイズ設定 (Requirements 10.1, 10.2) */}
        <div className="mb-4">
          <label
            htmlFor="fontSize"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            フォントサイズ
          </label>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => handlePresetFontSize(12)}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
            >
              小
            </button>
            <button
              onClick={() => handlePresetFontSize(14)}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
            >
              中
            </button>
            <button
              onClick={() => handlePresetFontSize(16)}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
            >
              大
            </button>
          </div>
          <input
            id="fontSize"
            type="number"
            min="8"
            max="72"
            value={settings.fontSize}
            onChange={handleFontSizeChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            タブアイテムのフォントサイズ (8-72px)
          </p>
        </div>

        {/* フォントファミリー設定 (Requirement 10.3) */}
        <div className="mb-4">
          <label
            htmlFor="fontFamily"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            フォントファミリー
          </label>
          <input
            id="fontFamily"
            type="text"
            value={settings.fontFamily}
            onChange={handleFontFamilyChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="system-ui, -apple-system, sans-serif"
          />
          <p className="text-xs text-gray-500 mt-1">
            フォントファミリーを指定します (例: Arial, sans-serif)
          </p>
        </div>

        {/* カスタムCSS設定 (Requirements 10.4, 10.5, 10.6) */}
        <div className="mb-4">
          <label
            htmlFor="customCSS"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            カスタムCSS
          </label>
          <textarea
            id="customCSS"
            value={settings.customCSS}
            onChange={handleCustomCSSChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            rows={6}
            placeholder=".tree-node { margin: 4px 0; }"
          />
          <p className="text-xs text-gray-500 mt-1">
            カスタムCSSでスタイルをオーバーライドできます
          </p>
        </div>
      </section>

      {/* タブの動作セクション */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-4">タブの動作</h2>

        {/* 新しいタブの位置設定 (Requirement 9.1) */}
        <div className="mb-4">
          <label
            htmlFor="newTabPosition"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            新しいタブの位置(デフォルト)
          </label>
          <select
            id="newTabPosition"
            value={settings.newTabPosition}
            onChange={handleNewTabPositionChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="child">現在のタブの子</option>
            <option value="sibling">現在のタブの隣</option>
            <option value="end">リストの最後</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            新しく開かれるタブの挿入位置を選択できます(デフォルト)
          </p>
        </div>

        {/* Task 12.2: タブ開き方別の位置ルール (Requirements 9.2, 9.3, 9.4) */}
        <div className="mb-4">
          <label
            htmlFor="newTabPositionFromLink"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            リンククリックから開かれたタブの位置
          </label>
          <select
            id="newTabPositionFromLink"
            value={settings.newTabPositionFromLink ?? settings.newTabPosition}
            onChange={handleNewTabPositionFromLinkChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="child">元のタブの子</option>
            <option value="sibling">元のタブの隣</option>
            <option value="end">リストの最後</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            リンククリックから開かれたタブの挿入位置
          </p>
        </div>

        <div className="mb-4">
          <label
            htmlFor="newTabPositionManual"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            手動で開かれたタブの位置
          </label>
          <select
            id="newTabPositionManual"
            value={settings.newTabPositionManual ?? settings.newTabPosition}
            onChange={handleNewTabPositionManualChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="child">現在のタブの子</option>
            <option value="sibling">現在のタブの隣</option>
            <option value="end">リストの最後</option>
          </select>
          <p className="text-xs text-gray-500 mt-1">
            手動で開かれたタブ(アドレスバー、新規タブボタンなど)の挿入位置
          </p>
        </div>

        {/* 警告閾値設定 (Requirement 8.5) */}
        <div className="mb-4">
          <label
            htmlFor="closeWarningThreshold"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            警告閾値
          </label>
          <input
            id="closeWarningThreshold"
            type="number"
            min="1"
            value={settings.closeWarningThreshold}
            onChange={handleCloseWarningThresholdChange}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            タブを閉じる際の警告を表示する閾値
          </p>
          <p className="text-xs text-gray-400 mt-1">
            この数以上のタブを閉じる際に確認ダイアログを表示します
          </p>
        </div>
      </section>
    </div>
  );
};

export default SettingsPanel;
